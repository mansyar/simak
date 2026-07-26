<protect>
# Implementation Plan: TRACK-027 — Critical Business Flow E2E Coverage

> **Methodology:** TDD per `conductor/workflow.md`. For an E2E test track, the test spec IS the deliverable — the Red→Green cycle is "write the spec → run it (fails if the app misbehaves or the spec is wrong) → fix until green." Seed/decoupling work is verified by re-running the seed and confirming existing specs stay green. Each phase ends with the mandatory Phase Completion Verification & Checkpointing Protocol.

---

## Phase 1: Seed Data Expansion + Test Decoupling

- [x] Task: Read `spec.md` and `conductor/workflow.md` to re-anchor context before implementing this phase
- [x] Task: Expand `scripts/seed-e2e.ts` with new seed data (FR8) [46c0641]
    - [x] Add `student2@e2e.test` enrolled in the existing assignment (for multi-student review queue scenarios)
    - [x] Add `student3@e2e.test` NOT enrolled in any assignment (for cross-student access denial tests)
    - [x] Add one pending consultation on the Proposal checkpoint for the instructor verification queue
    - [x] Run the seed script and verify it completes without errors
    - [x] Verify backward compatibility: run existing specs and confirm they still pass
- [x] Task: Decouple `tests/e2e/instructor-review.spec.ts` (FR7) [46c0641]
    - [x] Refactor each of the 4 tests to set up its own submission state via the `createSubmissionForCheckpoint` DB helper
    - [x] Remove the implicit order dependency (Revise test no longer relies on the Pass test having unlocked Chapter 1)
    - [x] Run each test independently via `--grep` and verify each passes in isolation
- [x] Task: Update unit test mocks for seed script changes [46c0641]
    - [x] Run `pnpm test:unit` and fix any unit test mocks broken by the seed script changes (3607 tests pass)
    - [x] Run `pnpm typecheck` and verify clean
- [x] Task: Conductor - User Manual Verification 'Phase 1: Seed Data Expansion + Test Decoupling' (Protocol in workflow.md) [checkpoint: 69cb81f]

---

## Phase 2: Critical Flow Specs — Consultation, Extension, Password Setup

- [x] Task: Read `spec.md` and `conductor/workflow.md` to re-anchor context before implementing this phase
- [x] Task: Create `tests/e2e/consultation.spec.ts` (FR1) [69992d6]
    - [x] Write consultation logging test (student logs consultation → "pending" badge in ConsultationList → instructor verification queue on `/instructor/assignments/$id` → instructor verifies via VerificationDialog → state transitions to "verified" in DB → count increments in ConsultationProgress)
    - [x] Write consultation rejection test (instructor rejects a second consultation with a reason → "rejected" badge appears)
    - [x] Write consultation gating UI test (locked checkpoint shows "insufficient verified consultations (0/1)" blocking reason alongside "previous checkpoint not passed"; after instructor verifies a consultation, reload and verify count updates to (1/1))
    - [x] Run `pnpm test:e2e tests/e2e/consultation.spec.ts` and verify all tests pass (Red→Green) — 3 tests pass, verified non-flaky on 3 runs
- [x] Task: Create `tests/e2e/extension.spec.ts` (FR2) [aa6f2ba]
    - [x] Write extension request test (student submits request: category/reason≥10/duration 1–7 days → "pending" in history → instructor approves with optional comment → `dueDate` extended in DB by requested duration → "approved" badge)
    - [x] Write extension rejection test (instructor rejects with reason ≥20 chars → "rejected" badge → deadline NOT extended)
    - [x] Write bulk extension test (adapted: instructor extends checkpoint deadline via DeadlineManager UI since no bulk extension UI exists — `bulkExtend` server fn exists but no UI calls it)
    - [x] Run `pnpm test:e2e tests/e2e/extension.spec.ts` and verify all tests pass (Red→Green) — 3 tests pass, verified non-flaky on 3 runs
- [x] Task: Create `tests/e2e/password-setup.spec.ts` (FR3) [5f04419]
    - [x] Write password setup test (admin creates user via create-user dialog → extract token via `SELECT value FROM verification WHERE identifier = ...` → navigate to `/auth/setup-password?token=<token>` → fill & submit → redirect to login → login with new credentials via `loginWithCredentials` → redirect to role-specific dashboard)
    - [x] Write token reuse test (reuse the same token → verify "Invalid or expired token" error)
    - [x] Write expired token test (insert an expired token in DB → navigate to setup-password → verify same error)
    - [x] Run `pnpm test:e2e tests/e2e/password-setup.spec.ts` and verify all tests pass (Red→Green) — 3 tests pass, verified non-flaky on 3 runs
- [x] Task: Verify full suite and test count increase
    - [x] Run `pnpm test:e2e` full suite and verify all tests pass — 23 passed (1.6m)
    - [x] Confirm test count increased from 14 to ~28 — 14→23 after Phase 2 (Phase 3 will add ~6-9 more to reach ~28-32)
- [x] Task: Conductor - User Manual Verification 'Phase 2: Critical Flow Specs' (Protocol in workflow.md) [checkpoint: ad70c55]

---

## Phase 3: Notification Assertions, Upload UI, Negative Cases

- [x] Task: Read `spec.md` and `conductor/workflow.md` to re-anchor context before implementing this phase
- [ ] Task: Add notification delivery assertions to existing specs (FR4)
    - [ ] `student-submission.spec.ts`: after submission, log in as instructor, verify notification badge count incremented and `submission_received` notification item appears in NotificationCenter
    - [ ] `instructor-review.spec.ts`: after Pass review, log in as student, verify `review_completed` notification appears
    - [ ] `consultation.spec.ts`: after verify consultation, log in as student, verify `consultation_verified` notification appears
    - [ ] Verify mark-as-read and mark-all-read functionality
    - [ ] Run affected specs and verify they pass
- [ ] Task: Expand upload UI test in `student-submission.spec.ts` (FR5)
    - [ ] Expand existing test: click Submit → verify `[data-testid="drop-zone"]` and `[data-testid="file-input"]` are visible
    - [ ] Attempt to upload a `.txt` file via `setInputFiles` → verify wrong file type validation error
    - [ ] Attempt to upload a file >25MB → verify size validation error
    - [ ] Run `pnpm test:e2e tests/e2e/student-submission.spec.ts` and verify it passes (R2 upload remains bypassed via DB insertion)
- [ ] Task: Add negative test cases (FR6)
    - [ ] `auth.spec.ts`: invalid login credentials (wrong password) → verify inline error message on login page
    - [ ] `student-submission.spec.ts`: navigate directly to a locked checkpoint's submission URL → verify the Submit button is not present or is disabled
    - [ ] Cross-student access denial: log in as `student3@e2e.test` (not enrolled) → navigate to the seeded assignment URL → verify not-found or access-denied state
    - [ ] `admin-users.spec.ts`: superadmin creates an Admin account → verify the Admin role option is available for superadmin but NOT for regular admin
    - [ ] Run affected specs and verify they pass
- [ ] Task: Final verification — full suite green, runtime, flakiness, quality gates
    - [ ] Run `pnpm test:e2e` — all tests pass; full suite runtime ≤ 3 minutes
    - [ ] Run the full e2e suite 3 consecutive times — confirm no flaky tests
    - [ ] Run `pnpm test:unit` — all existing unit tests still pass
    - [ ] Run `pnpm typecheck` — clean
    - [ ] Run `pnpm check:i18n` — parity maintained
    - [ ] Verify all new test files ≤ 500 lines (`scripts/check-modularity.js`)
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Notification Assertions, Upload UI, Negative Cases' (Protocol in workflow.md)
</protect>
