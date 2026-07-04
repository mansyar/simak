# Specification: Atomic Checkpoint State Transitions in Review Handlers

**Track Type:** Bug / Hardening (concurrency race-condition elimination)

## Overview

`openForReviewHandler` and `submitReviewHandler` — and, on audit, `submitCheckpointHandler` — mutate checkpoint state using a non-atomic check-then-act pattern: the checkpoint's `state` is read and validated **before** the row is locked, then mutated in a separate step. Under concurrent invocation this allows harmful interleavings:

1. **Conflicting review decisions** — Two concurrent `submitReviewHandler` calls both read `state = 'under_review'`, both pass validation, and both insert `reviews` rows with different decisions (`pass` vs `revise`). Both checkpoint mutations apply; the final state is nondeterministic and two review records persist for a single submission.
2. **Late `openForReview` revert** — A `submitReviewHandler` call completes and sets the checkpoint to `passed`/`revise`. A concurrent `openForReviewHandler` call that read `state = 'submitted'` before the review committed then executes its `UPDATE ... SET state = 'under_review'`, reverting a completed review back to `under_review`.
3. **Duplicate submission** — Two concurrent `submitCheckpointHandler` calls both read a submittable state (`unlocked`/`revise`); both pass the gate and insert submissions / transition to `submitted`. (The `submissions_checkpoint_version_unq` unique constraint backstops the version collision but does not prevent the duplicate state transition.)

### Root Cause (per handler)

- **`openForReviewHandler`** (`src/server/reviews-extras.server.ts:26`): reads `checkpointState` at lines 37–54 with **no transaction at all**, then mutates at 68–71.
- **`submitReviewHandler`** (`src/server/reviews.server.ts:228`): reads `checkpointState` at lines 239–266 **outside** the transaction (tx begins at line 301), validates at 273–277, then mutates inside the tx at 354–388.
- **`submitCheckpointHandler`** (`src/server/submissions.server.ts:32`): reads `checkpointState` at lines 46–66 **inside** its transaction but **without** `SELECT ... FOR UPDATE`, so no row lock is acquired.

### Established Pattern

The codebase already uses `SELECT ... FOR UPDATE` for atomic read-validate-consume on `uploadIntents`:
- `submitReviewHandler` line 319: `tx.select().from(uploadIntents)...for('update')`
- `submitCheckpointHandler` line 127: `tx.select().from(uploadIntents)...for('update')`

This track extends that same pattern to the checkpoint-state read in all three handlers.

## Functional Requirements

### FR1 — Lock the checkpoint row inside the transaction
Each handler must read the checkpoint row with `SELECT ... FOR UPDATE` **inside** the transaction that performs the state mutation, so concurrent callers block on the row lock until the first commits.
- **FR1.1 `openForReviewHandler`**: Wrap the checkpoint read, state validation, and `under_review` mutation in a single transaction. Read the checkpoint row with `.for('update')`.
- **FR1.2 `submitReviewHandler`**: Move the checkpoint-state read **inside** the existing transaction. Read with `.for('update')`. Re-validate `REVIEWABLE_STATES` **after** acquiring the lock, before inserting the review / mutating state.
- **FR1.3 `submitCheckpointHandler`**: Add `.for('update')` to the existing in-transaction checkpoint read (line 46–66). The read is already inside the tx; only the row lock is missing.

### FR2 — Re-validate state after acquiring the lock
After `FOR UPDATE` blocks and the lock is acquired, the handler must re-check the state predicate against the now-current value. If the state no longer satisfies the precondition:
- `openForReviewHandler`: state ≠ `submitted` → return the existing `notInSubmittedState` error.
- `submitReviewHandler`: state ∉ `REVIEWABLE_STATES` → return the existing `'Checkpoint is not in a reviewable state'` error.
- `submitCheckpointHandler`: state ∉ `SUBMITTABLE_STATES` → return the existing `'Checkpoint is not in a submittable state'` error.

### FR3 — Reuse existing error messages (no new i18n keys)
No new user-facing strings. Stale-state rejections reuse the existing state-error messages. No changes to `locales/en.json` or `locales/id.json`.

### FR4 — Preserve existing transactional side-effects
The fix must not alter existing post-commit advisory work (audit logging, SLA breach notifications) or in-transaction side-effects (notification insertion, upload-intent consumption, next-checkpoint unlock, deadline adjustment). Only the checkpoint read's location and locking change.

## Non-Functional Requirements

- **NFR1 — No schema/migration changes**: `SELECT ... FOR UPDATE` is a query-level change; no Drizzle migration is generated.
- **NFR2 — No new dependencies.**
- **NFR3 — Minimal lock contention**: The row lock is held only for the duration of the short handler transaction; no long-running operations are introduced inside the locked region.
- **NFR4 — Surgical**: Only the three handlers and their tests change. No refactoring of adjacent code.

## Acceptance Criteria

- **AC1** — `openForReviewHandler` performs the checkpoint read, `submitted`-state validation, and `under_review` mutation inside a single transaction with `SELECT ... FOR UPDATE` on the checkpoint row.
- **AC2** — `submitReviewHandler` reads the checkpoint state inside its transaction with `FOR UPDATE` and re-validates `REVIEWABLE_STATES` after acquiring the lock, before inserting the review record or mutating state.
- **AC3** — `submitCheckpointHandler`'s in-transaction checkpoint read acquires `FOR UPDATE`.
- **AC4** — No new i18n keys are introduced; stale-state rejections return the existing error messages for all three handlers.
- **AC5** — The existing review/submission handler unit tests (≈12 across `tests/unit/server/reviews-*.test.ts` and `tests/unit/server/submissions*.test.ts`) are modified in place so the checkpoint read flows through `tx.select(...).for('update')` and re-validation reflects locked semantics; all unit tests pass.
- **AC6** — Integration tests mirroring the C2/H3 concurrency precedent (`tests/integration/server/submissions-intent.test.ts`, `tests/integration/submissions/concurrent-version-race.test.ts`) assert that exactly one of two concurrent `submitReviewHandler` calls (pass vs revise) succeeds, and that a late `openForReviewHandler` after a completed review is rejected.
- **AC7** — `pnpm typecheck` and `pnpm lint` are clean; coverage thresholds (≥80% lines/functions/branches/statements) are maintained.

## Out of Scope

- E2E / Playwright tests.
- Changes to read-only handlers (`listPendingReviewsHandler`, `getReviewDetailHandler`, `getLatestReviewHandler`) — they do not mutate state.
- New error messages or i18n keys.
- Refactoring of post-commit advisory work (audit log, SLA breach notifications).
- Changes to the `submissions_checkpoint_version_unq` unique constraint (existing backstop, retained as-is).
- Any change to the manual `unlockCheckpoint` / `extendDeadline` server functions (Track 5.2).
