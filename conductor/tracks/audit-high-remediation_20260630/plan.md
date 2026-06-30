<protect>
# Implementation Plan — Audit HIGH-Remediation (H1, H2, H3 + L1)

**Track ID:** `audit-high-remediation_20260630`
**Spec:** `./spec.md`
**Workflow:** `../../workflow.md` (TDD Red→Green→Refactor; the task lifecycle steps 8-11 — commit + git note + plan.md status update — apply to every task)

> **Task lifecycle (per workflow.md):** mark task `[ ]`→`[~]` → write failing tests (Red) → implement to pass (Green) → refactor → verify >80% coverage → commit (`<type>(<scope>): <desc>`) → attach git note → mark `[x]` + commit SHA in plan.md. Every code task ends with: commit + git note + plan.md status update.

## Phase 1: H1 — Upload-intent trust boundary

- [ ] Task: Review spec.md and workflow.md before beginning work
    - [ ] Read `./spec.md` — confirm scope, acceptance criteria, out-of-scope items for this phase
    - [ ] Read `../../workflow.md` — confirm TDD Red→Green→Refactor lifecycle, commit format, phase-completion checkpointing protocol

- [x] Task: Define `upload_intents` Drizzle schema & generate migration [d382148]
    - [x] Add `uploadIntents` table to the DB schema (`fileKey` unique, `userId`, `purpose` enum `'submission'|'review_feedback'`, `checkpointId` nullable, `fileName`, `fileSize`, `contentType`, `expiresAt`, `consumedAt`)
    - [x] Run `pnpm db:generate`; verify generated migration SQL (unique on `fileKey`, index on `userId`/`fileKey`)
    - [x] Apply to dev DB (`pnpm db:push` or `pnpm db:migrate`); confirm table exists
    - [x] Commit, attach git note, mark task [x] in plan.md

- [x] Task: Write failing tests for presign intent insertion (Red) [899bba8]
    - [x] Test `getPresignedUploadUrl` inserts an `upload_intents` row bound to session user + `checkpointId`, `purpose='submission'`, `consumedAt=null`, `expiresAt` ~now+15min
    - [x] Test `getPresignedReviewFeedbackUploadUrl` inserts intent with `purpose='review_feedback'`, `checkpointId` null
    - [x] Run tests; confirm they fail (intent not yet inserted)
    - [x] Commit, attach git note, mark task [x] in plan.md

- [ ] Task: Implement presign intent insertion (Green)
    - [ ] Insert intent row at presign in `files.server.ts` and the review-feedback presign handler
    - [ ] Run presign tests; confirm they pass
    - [ ] Verify coverage >80% on changed code
    - [ ] Commit, attach git note, mark task [x] in plan.md

- [ ] Task: Write failing tests for submit intent verification + HEAD size check (Red)
    - [ ] AC-H1-1: submit with fileKey having no matching unconsumed/unexpired intent → rejected
    - [ ] AC-H1-2: submit with fileKey issued for different user/checkpoint/purpose → rejected
    - [ ] AC-H1-3: valid presign→submit consumes intent; second submit reusing same fileKey → rejected
    - [ ] AC-H1-4: R2 HEAD `Content-Length` >25MB → rejected (mock `@/lib/storage` HEAD)
    - [ ] Run tests; confirm they fail
    - [ ] Commit, attach git note, mark task [x] in plan.md

- [ ] Task: Implement submit intent verification + HEAD size check (Green)
    - [ ] `submitCheckpointHandler`: `SELECT…FOR UPDATE WHERE fileKey=? AND userId=? AND consumedAt IS NULL AND expiresAt>now`; verify checkpointId/purpose; set `consumedAt=now`; reject if none
    - [ ] `submitReviewHandler`: same verification for `feedbackFileKey` (purpose='review_feedback')
    - [ ] R2 HEAD `Content-Length` enforcement (25MB max); intent `fileSize` audit-only (no cross-validation)
    - [ ] Run tests; confirm pass; verify >80% coverage
    - [ ] Commit, attach git note, mark task [x] in plan.md

- [ ] Task: Write opt-in integration test (AC-H1-5)
    - [ ] Add `tests/integration/server/submissions-intent.test.ts` proving fabricated-key rejection end-to-end (mock R2, real DB tx)
    - [ ] Run via `pnpm test:integration`; confirm it passes (not in pre-push gate)
    - [ ] Commit, attach git note, mark task [x] in plan.md

- [ ] Task: Conductor - User Manual Verification 'H1 — Upload-intent trust boundary' (Protocol in workflow.md)

## Phase 2: H2 — SLA anchored at submission time (+ L1)

- [ ] Task: Review spec.md and workflow.md before beginning work
    - [ ] Read `./spec.md` — confirm scope, acceptance criteria, out-of-scope items for this phase
    - [ ] Read `../../workflow.md` — confirm TDD Red→Green→Refactor lifecycle, commit format, phase-completion checkpointing protocol

- [ ] Task: Verify extension-grant path under new anchor (impl-time verification per spec risk)
    - [ ] Read `review-sla.ts` / `due-dates.server.ts`; confirm student-earns-extension assumption holds when `underReviewAt = submission.uploadedAt`
    - [ ] If it diverges, surface decision before proceeding
    - [ ] Commit findings/note, mark task [x] in plan.md

- [ ] Task: Write failing tests for submission-anchored SLA (Red)
    - [ ] AC-H2-1: direct `submitReview` on a `submitted` checkpoint (no openForReview) → non-zero breach when past the SLA window
    - [ ] Test `underReviewAt = submission.uploadedAt` regardless of checkpoint state
    - [ ] Run tests; confirm they fail
    - [ ] Commit, attach git note, mark task [x] in plan.md

- [ ] Task: Implement `underReviewAt = submission.uploadedAt` (Green)
    - [ ] Update `reviews.server.ts` SLA anchor (replace state-conditional `checkpointUpdatedAt`/`now`)
    - [ ] Run tests; confirm pass; verify >80% coverage
    - [ ] Commit, attach git note, mark task [x] in plan.md

- [ ] Task: Write failing test for L1 openForReview error message (Red)
    - [ ] AC-H2-2: `openForReview` on a non-submitted checkpoint returns an accurate message (not "submittable state")
    - [ ] Run test; confirm it fails
    - [ ] Commit, attach git note, mark task [x] in plan.md

- [ ] Task: Implement L1 fix + i18n keys (Green)
    - [ ] Correct error message at `reviews-extras.server.ts:61`
    - [ ] Add i18n keys to `locales/en.json` + `locales/id.json`; run `pnpm generate:i18n`
    - [ ] Run test; confirm pass; `pnpm check:i18n` parity OK
    - [ ] Commit, attach git note, mark task [x] in plan.md

- [ ] Task: Conductor - User Manual Verification 'H2 — SLA anchored at submission time' (Protocol in workflow.md)

## Phase 3: H3 — Bulk import + single-create restore-on-soft-deleted

- [ ] Task: Review spec.md and workflow.md before beginning work
    - [ ] Read `./spec.md` — confirm scope, acceptance criteria, out-of-scope items for this phase
    - [ ] Read `../../workflow.md` — confirm TDD Red→Green→Refactor lifecycle, commit format, phase-completion checkpointing protocol

- [ ] Task: Write failing tests for bulk import restore/skip (Red)
    - [ ] AC-H3-1: bulk import with email matching a soft-deleted user → restored (name/cohort/role from row; password/id/history preserved); batch survives
    - [ ] AC-H3-2: bulk import with duplicate active email → skipped with reason; batch survives (no whole-batch rollback on 23505)
    - [ ] AC-H3-4: per-row report shape `{results:[{rowIndex,email,status,reason?}]}`; audit events `user.created`/`user.reactivated`
    - [ ] Run tests; confirm they fail
    - [ ] Commit, attach git note, mark task [x] in plan.md

- [ ] Task: Implement bulk import savepoint + restore (Green)
    - [ ] Remove `isNull(users.deletedAt)` pre-check from `bulkCreateUsersHandler`
    - [ ] One outer tx + SAVEPOINT per row; catch `23505` → per-row skip; non-23505 → rollback whole batch
    - [ ] Restore-on-soft-deleted: overwrite name/cohort/role from import row (role wins incl. mismatch); preserve password/password-setup-state/id/history
    - [ ] Per-row report + `user.created`/`user.reactivated` audit events
    - [ ] Run tests; confirm pass; verify >80% coverage
    - [ ] Commit, attach git note, mark task [x] in plan.md

- [ ] Task: Write failing test for single-create restore (Red)
    - [ ] AC-H3-3: `createUserHandler` with email matching a soft-deleted user → restores (consistent with bulk)
    - [ ] Run test; confirm it fails
    - [ ] Commit, attach git note, mark task [x] in plan.md

- [ ] Task: Implement single-create restore (Green)
    - [ ] Apply same restore policy to `createUserHandler`
    - [ ] Run test; confirm pass; verify >80% coverage
    - [ ] Commit, attach git note, mark task [x] in plan.md

- [ ] Task: Add i18n keys for import results
    - [ ] Add `created`/`restored`/`skipped` + skip-reason variants to `locales/en.json` + `locales/id.json`
    - [ ] Run `pnpm generate:i18n`; `pnpm check:i18n` + `pnpm check:i18n:unused` clean
    - [ ] Commit, attach git note, mark task [x] in plan.md

- [ ] Task: Conductor - User Manual Verification 'H3 — Bulk import + restore-on-soft-deleted' (Protocol in workflow.md)

## Phase 4: Final hardening & quality gates

- [ ] Task: Review spec.md and workflow.md before beginning work
    - [ ] Read `./spec.md` — confirm scope, acceptance criteria, out-of-scope items for this phase
    - [ ] Read `../../workflow.md` — confirm TDD Red→Green→Refactor lifecycle, commit format, phase-completion checkpointing protocol

- [ ] Task: Full unit suite + coverage gate
    - [ ] Run `CI=true pnpm test:coverage`; confirm >80% lines/functions/branches/statements
    - [ ] Address any coverage gaps in changed modules
    - [ ] Commit, attach git note, mark task [x] in plan.md

- [ ] Task: Typecheck + lint + format
    - [ ] `pnpm typecheck` passes
    - [ ] `pnpm lint` (oxlint) clean
    - [ ] `pnpm format` (oxfmt) applied to changed files
    - [ ] Commit, attach git note, mark task [x] in plan.md

- [ ] Task: Integration tests + i18n parity
    - [ ] Run `pnpm test:integration` (H1 opt-in test passes)
    - [ ] `pnpm check:i18n` + `pnpm check:i18n:unused` clean
    - [ ] Commit, attach git note, mark task [x] in plan.md

- [ ] Task: Conductor - User Manual Verification 'Final hardening & quality gates' (Protocol in workflow.md)

</protect>
