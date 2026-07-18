<protect>
# Implementation Plan: Concurrency & Transaction Safety (TRACK-001)

## Phase 1: Consultations (BUG-1, BUG-17) [checkpoint: 507ac9c]

- [x] Task: Read `spec.md` and `conductor/workflow.md` to load context for this phase
- [x] Task: Write failing unit tests for `verifyConsultationHandler` concurrency
    - [x] Test: stale-state rejection — status no longer `pending` after lock returns descriptive "already processed" error
    - [x] Test: successful verify transitions `status` to `verified` within transaction
    - [x] Test: handler uses `db.transaction` with `.for('update', { of: consultations })`
    - [x] Run `pnpm test` — confirm new tests fail as expected (Red)
- [x] Task: Refactor `verifyConsultationHandler` — move SELECT inside `db.transaction`, add `.for('update', { of: consultations })`, re-check `status === 'pending'` after lock
    - [x] Run `pnpm test` — verify new tests pass (Green)
- [x] Task: Write failing unit tests for `rejectConsultationHandler` concurrency
    - [x] Test: stale-state rejection after lock returns descriptive error
    - [x] Test: successful reject transitions `status` to `rejected` within transaction
    - [x] Run `pnpm test` — confirm new tests fail as expected (Red)
- [x] Task: Refactor `rejectConsultationHandler` — same pattern (transaction + `FOR UPDATE` + post-lock status re-check)
    - [x] Run `pnpm test` — verify new tests pass (Green)
- [x] Task: Run quality gates for Phase 1 (commit: 4149eea)
    - [x] Run `pnpm typecheck`
    - [x] Run `pnpm lint`
    - [x] Run `pnpm test:coverage` — verify ≥80% thresholds on all four metrics
- [x] Task: Conductor - User Manual Verification 'Phase 1: Consultations' (checkpoint: 507ac9c)

## Phase 2: Extensions (BUG-2, BUG-5, BUG-6, BUG-7) [checkpoint: 30667f0]

- [x] Task: Read `spec.md` and `conductor/workflow.md` to load context for this phase
- [x] Task: Write failing unit tests for `approveExtensionHandler` and `rejectExtensionHandler` concurrency (ac2cf9b)
    - [x] Test: stale-state rejection — status no longer `pending` after lock returns descriptive error
    - [x] Test: successful approve/reject transitions `status` correctly within transaction
    - [x] Test: handler uses `db.transaction` with `.for('update')` on extension request
    - [x] Run `pnpm test` — confirm new tests fail as expected (Red)
- [x] Task: Refactor `approveExtensionHandler` and `rejectExtensionHandler` — move SELECT inside `db.transaction`, add `.for('update')`, re-check `status === 'pending'` after lock (ac2cf9b)
    - [x] Run `pnpm test` — verify new tests pass (Green)
- [x] Task: Write failing unit tests for `requestExtensionHandler` TOCTOU fix (BUG-5) (325bc11)
    - [x] Test: extension count check occurs inside transaction under lock — concurrent requests cannot exceed `maxTotalExtensions`
    - [x] Run `pnpm test` — confirm new tests fail as expected (Red)
- [x] Task: Refactor `requestExtensionHandler` — move extension count check inside transaction with row locking (325bc11)
    - [x] Run `pnpm test` — verify new tests pass (Green)
- [x] Task: Write failing unit tests for `calculateExtensionAdjustment` checkpoint locking (BUG-6) (9418316)
    - [x] Test: checkpoint rows are locked inside transaction before reading
    - [x] Run `pnpm test` — confirm new tests fail as expected (Red)
- [x] Task: Refactor `calculateExtensionAdjustment` — lock checkpoint rows inside transaction before reading (9418316)
    - [x] Run `pnpm test` — verify new tests pass (Green)
- [x] Task: Move notification INSERTs inside the transaction for extension handlers (keep audit log post-commit with try/catch) (ac2cf9b)
    - [x] Run `pnpm test` — verify existing tests still pass
- [x] Task: Run quality gates for Phase 2
    - [x] Run `pnpm typecheck`
    - [x] Run `pnpm lint`
    - [x] Run `pnpm test:coverage` — verify ≥80% thresholds on all four metrics
- [x] Task: Conductor - User Manual Verification 'Phase 2: Extensions' (Protocol in workflow.md) (30667f0)

## Phase 3: 2FA & Users (BUG-8, BUG-13, BUG-22)

- [x] Task: Read `spec.md` and `conductor/workflow.md` to load context for this phase
- [x] Task: Write failing unit tests for `disableTwoFactorHandler` (BUG-8) (06218fd)
    - [x] Test: DB operations (update `users.twoFactorEnabled` + delete `twoFactor` row) occur inside a single `db.transaction`
    - [x] Test: `auth.api.disableTwoFactor` is called AFTER the DB commit (last step)
    - [x] Test: if auth API call fails post-commit, no DB rollback occurs (reconcile on next login)
    - [x] Run `pnpm test` — confirm new tests fail as expected (Red)
- [x] Task: Refactor `disableTwoFactorHandler` — wrap DB ops in `db.transaction`, call auth API last (06218fd)
    - [x] Run `pnpm test` — verify new tests pass (Green)
- [x] Task: Write failing unit tests for `generateSetupLinkHandler` (BUG-13) (1a9b01c)
    - [x] Test: DELETE + INSERT occur in a single `db.transaction` — failure rolls back both
    - [x] Run `pnpm test` — confirm new tests fail as expected (Red)
- [x] Task: Refactor `generateSetupLinkHandler` — wrap DELETE + INSERT in a single `db.transaction` (1a9b01c)
    - [x] Run `pnpm test` — verify new tests pass (Green)
- [~] Task: Write failing unit tests for `createUserHandler` and `updateUserHandler` email uniqueness (BUG-22)
    - [ ] Test: email uniqueness check occurs inside transaction with `FOR UPDATE` on users rows
    - [ ] Test: PG error `23505` is caught and returns clean "Email already in use" message
    - [ ] Run `pnpm test` — confirm new tests fail as expected (Red)
- [ ] Task: Refactor `createUserHandler` and `updateUserHandler` — move email check inside transaction with `FOR UPDATE`, catch PG error `23505`
    - [ ] Run `pnpm test` — verify new tests pass (Green)
- [ ] Task: Run quality gates for Phase 3
    - [ ] Run `pnpm typecheck`
    - [ ] Run `pnpm lint`
    - [ ] Run `pnpm test:coverage` — verify ≥80% thresholds on all four metrics
- [ ] Task: Conductor - User Manual Verification 'Phase 3: 2FA & Users' (Protocol in workflow.md)

## Phase 4: Soft-Delete Cleanup (BUG-9)

- [ ] Task: Read `spec.md` and `conductor/workflow.md` to load context for this phase
- [ ] Task: Write failing unit tests for student soft-delete auto-reject (FR-4.1)
    - [ ] Test: pending consultations are auto-rejected with reason "User deleted"
    - [ ] Test: pending extension requests are auto-rejected with reason "User deleted"
    - [ ] Test: open upload intents are revoked
    - [ ] Run `pnpm test` — confirm new tests fail as expected (Red)
- [ ] Task: Implement student soft-delete cleanup in `deleteUserHandler` — auto-reject pending consultations/extensions, revoke upload intents
    - [ ] Run `pnpm test` — verify new tests pass (Green)
- [ ] Task: Write failing unit tests for instructor soft-delete block (FR-4.2)
    - [ ] Test: soft-delete blocked with descriptive error when instructor has active (non-deleted) assignments
    - [ ] Test: soft-delete proceeds when instructor has NO active assignments
    - [ ] Run `pnpm test` — confirm new tests fail as expected (Red)
- [ ] Task: Implement instructor active-assignments check in `deleteUserHandler` — block if any active assignments exist
    - [ ] Run `pnpm test` — verify new tests pass (Green)
- [ ] Task: Write failing unit tests for `reassignAssignment` server function (FR-4.3, FR-4.5)
    - [ ] Test: admin/superadmin-only access — instructor/student roles rejected
    - [ ] Test: target assignment must exist and be active (not deleted)
    - [ ] Test: replacement instructor must be active (`role='instructor'` AND `deletedAt IS NULL`)
    - [ ] Test: `under_review` checkpoints transition to `submitted` on reassignment
    - [ ] Test: `submitted` checkpoints stay as-is
    - [ ] Run `pnpm test` — confirm new tests fail as expected (Red)
- [ ] Task: Implement `reassignAssignment` server function — Zod validation, admin-only guard, instructor validation, checkpoint state transition
    - [ ] Create `reassignAssignment` stub in `src/server/users.ts` (client-safe) and handler in `src/server/users.server.ts`
    - [ ] Run `pnpm test` — verify new tests pass (Green)
- [ ] Task: Write failing unit tests for reassignment UI component (FR-4.4)
    - [ ] Test: dialog renders list of active assignments when instructor has active assignments
    - [ ] Test: replacement-instructor picker (dropdown of active instructors) per assignment
    - [ ] Test: soft-delete button disabled until ALL assignments are reassigned
    - [ ] Run `pnpm test` — confirm new tests fail as expected (Red)
- [ ] Task: Implement reassignment dialog component — assignment list, instructor picker, block-until-all-reassigned logic
    - [ ] Wire into existing user management delete flow (`/admin/users`)
    - [ ] Run `pnpm test` — verify new tests pass (Green)
- [ ] Task: Add i18n keys for Phase 4 (NFR-2)
    - [ ] Add reassignment dialog labels, replacement-instructor picker, "active assignments block delete" error, and "User deleted" rejection reason to `locales/en.json`
    - [ ] Add same keys to `locales/id.json` with Indonesian translations
    - [ ] Run `pnpm generate:i18n` to regenerate types
    - [ ] Run `pnpm check:i18n` — verify parity
- [ ] Task: Run quality gates for Phase 4
    - [ ] Run `pnpm typecheck`
    - [ ] Run `pnpm lint` (including `simak-i18n/no-hardcoded`)
    - [ ] Run `pnpm test:coverage` — verify ≥80% thresholds on all four metrics
    - [ ] Run `pnpm check:i18n` — verify key parity
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Soft-Delete Cleanup' (Protocol in workflow.md)

## Phase 5: Final Verification & Coverage

- [ ] Task: Read `spec.md` and `conductor/workflow.md` to load context for this phase
- [ ] Task: Verify no SELECT-then-UPDATE patterns remain outside transactions for all in-scope handlers
    - [ ] Grep `src/server/**/*.server.ts` for state-transition handlers — confirm all use `db.transaction` + `FOR UPDATE`
- [ ] Task: Run full quality gate suite
    - [ ] Run `pnpm test:coverage` — verify ≥80% on lines, statements, branches, functions
    - [ ] Run `pnpm typecheck`
    - [ ] Run `pnpm lint`
    - [ ] Run `pnpm check:i18n`
- [ ] Task: Conductor - User Manual Verification 'Phase 5: Final Verification & Coverage' (Protocol in workflow.md)
</protect>
