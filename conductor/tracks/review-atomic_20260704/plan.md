<protect>
# Implementation Plan: Atomic Checkpoint State Transitions in Review Handlers

Each phase follows the TDD lifecycle from `workflow.md`: Red (failing tests) → Green (implement) → Refactor → Verify coverage → Commit + git note. A Phase Completion meta-task closes each phase per the Checkpointing Protocol.

## Phase 1: Atomic Checkpoint Read in `submitCheckpointHandler` (partial gap — in-tx read missing the lock) [checkpoint `9e589e3`]

- [x] Task: Read spec.md and workflow.md
    - [x] Read the confirmed spec.md and workflow.md to re-establish context before beginning implementation.
- [x] Task: Write failing unit tests (Red phase) (`395d0bf`)
    - [x] Reshape existing `submitCheckpointHandler` unit tests in `tests/unit/server/submissions*.test.ts` so the checkpoint read is asserted via `tx.select(...).for('update')` (MockTx queue routing).
    - [x] Add a stale-state assertion: when the locked re-read returns a non-submittable state (e.g. `submitted`), the handler returns the existing `'Checkpoint is not in a submittable state'` error and inserts nothing.
    - [x] Run `pnpm vitest run tests/unit/server/submissions.test.ts tests/unit/server/submissions-transaction.test.ts` and confirm the tests fail (Red).
- [x] Task: Implement (Green phase) (`395d0bf`)
    - [x] In `src/server/submissions.server.ts`, add `.for('update')` to the checkpoint read (lines 46–66, inside the existing transaction).
    - [x] Add post-lock re-validation of `SUBMITTABLE_STATES` against the locked row.
    - [x] Run the unit tests; confirm they now pass (Green).
- [x] Task: Refactor (optional) (`395d0bf`)
    - [x] If the re-validation duplicates the pre-lock check, consolidate into a single predicate applied post-lock (surgical, no behavior change).
    - [x] Re-run unit tests to confirm still passing.
- [x] Task: Verify coverage (`395d0bf`)
    - [x] Run `pnpm test:coverage` and confirm ≥80% thresholds hold for `src/server/submissions.server.ts`.
- [x] Task: Commit and attach git note (`395d0bf`)
    - [x] Stage handler + test changes; commit as `fix(submissions): Lock checkpoint row in submitCheckpointHandler with FOR UPDATE`.
    - [x] Attach a git note summarizing the change, files touched, and the why (serialize concurrent submissions).
- [x] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)

## Phase 2: Atomic Checkpoint Read in `openForReviewHandler` (full gap — no transaction at all) [checkpoint `0857fb8`]

- [x] Task: Read spec.md and workflow.md (`09a9dfb`)
    - [x] Read the confirmed spec.md and workflow.md to re-establish context before beginning implementation.
- [x] Task: Write failing unit tests (Red phase) (`09a9dfb`)
    - [x] Reshape existing `openForReviewHandler` unit tests in `tests/unit/server/reviews-*.test.ts` to assert a transaction wraps the read + `FOR UPDATE` + mutation (MockTx queue routing).
    - [x] Add a stale-state test: a late `openForReview` that re-reads `passed`/`revise` returns the existing `notInSubmittedState` error and does NOT mutate state.
    - [x] Run the relevant test files and confirm they fail (Red).
- [x] Task: Implement (Green phase) (`09a9dfb`)
    - [x] In `src/server/reviews-extras.server.ts`, wrap the checkpoint read, `submitted` validation, and `under_review` mutation in `db.transaction(async (tx) => {...})`.
    - [x] Read the checkpoint row with `.for('update')` inside the tx; re-validate state after acquiring the lock.
    - [x] Run the unit tests; confirm they pass (Green).
- [x] Task: Refactor (optional) (`09a9dfb`)
    - [x] Ensure the error path returns the existing `translateKey('instructorReviews.errors.notInSubmittedState', locale)` message unchanged (no new i18n keys).
    - [x] Re-run unit tests.
- [x] Task: Verify coverage (`09a9dfb`)
    - [x] Run `pnpm test:coverage`; confirm thresholds hold for `src/server/reviews-extras.server.ts`.
- [x] Task: Commit and attach git note (`09a9dfb`)
    - [x] Commit as `fix(reviews): Make openForReview atomic with SELECT FOR UPDATE`.
    - [x] Attach a git note.
- [x] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

## Phase 3: Atomic Checkpoint Read in `submitReviewHandler` (full gap — read outside the tx) [checkpoint `d4b843a`]

- [x] Task: Read spec.md and workflow.md
    - [x] Read the confirmed spec.md and workflow.md to re-establish context before beginning implementation.
- [x] Task: Write failing unit tests (Red phase) (`d4b843a`)
    - [x] Reshape the existing `submitReviewHandler` unit tests (`reviews-handlers.test.ts`, `reviews-intent.test.ts`, `reviews-advisory-isolation.test.ts`) so the checkpoint read flows through `tx.select(...).for('update')` (MockTx queue: outer read removed; in-tx locked read enqueued).
    - [x] Add stale-state tests: a concurrent submitReview that re-reads a non-reviewable state returns the existing `'Checkpoint is not in a reviewable state'` error and inserts no review.
    - [x] Run the relevant test files and confirm they fail (Red).
- [x] Task: Implement (Green phase) (`d4b843a`)
    - [x] In `src/server/reviews.server.ts`, move the checkpoint read (lines 239–266) inside the existing `db.transaction` (starts at 301); read with `.for('update')`.
    - [x] Re-validate `REVIEWABLE_STATES` after acquiring the lock, before the review insert / state mutation / next-checkpoint unlock.
    - [x] Preserve upload-intent consumption, SLA, notification, and post-commit advisory logic unchanged.
    - [x] Run unit tests; confirm pass (Green).
- [x] Task: Refactor (optional) (`d4b843a`)
    - [x] Remove now-dead outer-read variables; consolidate duplicate state predicates if a pre-lock validation is retained.
    - [x] Re-run unit tests.
- [x] Task: Verify coverage (`d4b843a`)
    - [x] Run `pnpm test:coverage`; confirm thresholds hold for `src/server/reviews.server.ts`.
- [x] Task: Commit and attach git note (`d4b843a`)
    - [x] Commit as `fix(reviews): Make submitReview atomic with SELECT FOR UPDATE on checkpoint`.
    - [x] Attach git note.
- [ ] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)

## Phase 4: Concurrency Integration Tests (C2/H3 Precedent)

- [ ] Task: Read spec.md and workflow.md
    - [ ] Read the confirmed spec.md and workflow.md to re-establish context before beginning implementation.
- [ ] Task: Write integration tests
    - [ ] Add `tests/integration/server/reviews-concurrency.test.ts` mirroring the `submissions-intent.test.ts` / `concurrent-version-race.test.ts` precedent.
    - [ ] Test: two concurrent `submitReviewHandler` calls (pass vs revise) on the same submission → exactly one succeeds, exactly one `reviews` row inserted, checkpoint ends in a single deterministic state.
    - [ ] Test: a late `openForReviewHandler` invoked after a completed `submitReview` (pass) → rejected with `notInSubmittedState`, checkpoint remains `passed`.
    - [ ] Test (optional): two concurrent `submitCheckpointHandler` calls → exactly one inserts + transitions; the second rejects on stale state.
- [ ] Task: Run integration tests
    - [ ] Ensure local PostgreSQL is up (`docker-compose up -d`).
    - [ ] Run `pnpm test:integration` and confirm all pass.
- [ ] Task: Verify full suite + gates
    - [ ] Run `pnpm typecheck`, `pnpm lint`, `pnpm test:coverage`; confirm clean and thresholds met (AC7).
- [ ] Task: Commit and attach git note
    - [ ] Commit as `test(reviews): Add concurrency integration tests for atomic review transitions`.
    - [ ] Attach git note.
- [ ] Task: Conductor - User Manual Verification 'Phase 4' (Protocol in workflow.md)
</protect>
