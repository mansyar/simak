<protect>

# Track 8.4 — Performance Refinements: Implementation Plan

## Phase 1: Dashboard Query Parallelization

- [ ] Task: Read `spec.md` and `workflow.md` before starting this phase
    - [ ] Read `./spec.md` to review functional requirements for this phase
    - [ ] Read `conductor/workflow.md` to review the TDD lifecycle and commit protocol

- [x] Task: Parallelize instructor dashboard queries (FR-1) — commit `a28fd73ac676f0c8d0b4003aa2caff1756cb7f7e`
    - [x] Mark task `[~]` in progress in `plan.md`
    - [x] Write failing tests — `tests/unit/server/dashboard-instructor-parallel.test.ts` (Red phase)
        - [x] Test: `Promise.all` is used for independent query groups (Group A: instructorAssignments + recentSubmissions + assignmentOverview run concurrently)
        - [x] Test: Group B queries (pending review count + pendingReviewItems) run concurrently after Group A resolves `assignmentIds`
        - [x] Test: Group C queries (studentCount + pendingReviewCount + progressData) run concurrently after `overviewIds` resolves
        - [x] Test: Returned data shape is identical to the sequential version (pendingReviewCount, pendingReviewItems, recentSubmissions, assignments with details)
        - [x] Test: Deduplication logic (latest submission per checkpoint) is preserved
        - [x] Test: Edge case — instructor with zero assignments (assignmentIds empty) does not throw
    - [x] Run tests, confirm they fail as expected (Red)
    - [x] Implement — restructure `getInstructorDashboardDataHandler` in `src/server/dashboard-instructor.server.ts` to use `Promise.all` for independent query groups (Green phase)
    - [x] Run tests, confirm all pass (Green)
    - [x] Refactor (optional) — kept inline groups to match existing style
    - [x] Run `pnpm vitest run tests/unit/server/dashboard-instructor-parallel.test.ts` to verify
    - [x] Run `pnpm typecheck` to verify types
    - [x] Run `pnpm lint` on changed files
    - [x] Stage and commit: `perf(dashboard): Parallelize instructor dashboard queries with Promise.all`
    - [x] Attach git note with task summary (files changed, why)
    - [x] Update `plan.md`: mark task `[x]` with commit SHA
    - [ ] Commit plan update: `conductor(plan): Mark task 'Parallelize instructor dashboard queries' as complete`

- [x] Task: Parallelize student dashboard queries (FR-2) — commit `4fd9f5cdfbd013d160f2af309d32696e110a993f`
    - [x] Mark task `[~]` in progress in `plan.md`
    - [x] Write failing tests — `tests/unit/server/dashboard-student-parallel.test.ts` (Red phase)
        - [x] Test: `upcomingDeadlines`, `pendingReviews`, and `consultationReminders` run concurrently with `activeAssignments` via `Promise.all`
        - [x] Test: Checkpoints-by-assignment query still runs after `activeAssignments` resolves `assignmentIds`
        - [x] Test: Returned data shape is identical to the sequential version (activeAssignmentsWithProgress, upcomingDeadlines, pendingReviews, consultationReminders)
        - [x] Test: Progress calculation and sorting (soonest deadline first, then least progress) preserved
        - [x] Test: Edge case — student with zero active assignments does not throw
    - [x] Run tests, confirm they fail as expected (Red)
    - [x] Implement — restructure `getStudentDashboardDataHandler` in `src/server/dashboard-student.server.ts` (Green phase)
    - [x] Run tests, confirm all pass (Green)
    - [x] Run `pnpm vitest run tests/unit/server/dashboard-student-parallel.test.ts` to verify
    - [x] Run `pnpm typecheck`
    - [x] Run `pnpm lint` on changed files
    - [x] Stage and commit: `perf(dashboard): Parallelize student dashboard queries with Promise.all`
    - [x] Attach git note with task summary
    - [x] Update `plan.md`: mark task `[x]` with commit SHA
    - [ ] Commit plan update: `conductor(plan): Mark task 'Parallelize student dashboard queries' as complete`

- [x] Task: Parallelize admin dashboard queries (FR-3) — commit `95653942a29e8deda6265cb2574bdaa804dc3598`
    - [x] Mark task `[~]` in progress in `plan.md`
    - [x] Write failing tests — `tests/unit/server/dashboard-admin-parallel.test.ts` (Red phase)
        - [x] Test: All 7 queries (userCounts, activeAssignmentCount, pendingReviewCount, activeConsultationCount, recentActivity, emailCounts, escalationAlerts) run concurrently via a single `Promise.all`
        - [x] Test: Returned data shape is identical to the sequential version (metrics, emailQueueCounts, recentActivity, escalationAlerts)
        - [x] Test: Metrics computed from parallel query results match sequential results
        - [x] Test: Escalation alert ordering (by daysOverdue DESC) preserved
    - [x] Run tests, confirm they fail as expected (Red)
    - [x] Implement — restructure `getAdminDashboardDataHandler` in `src/server/dashboard-admin.server.ts` (Green phase)
    - [x] Run tests, confirm all pass (Green)
    - [x] Run `pnpm vitest run tests/unit/server/dashboard-admin-parallel.test.ts` to verify
    - [x] Run `pnpm typecheck`
    - [x] Run `pnpm lint` on changed files
    - [x] Stage and commit: `perf(dashboard): Parallelize admin dashboard queries with Promise.all`
    - [x] Attach git note with task summary
    - [x] Update `plan.md`: mark task `[x]` with commit SHA
    - [ ] Commit plan update: `conductor(plan): Mark task 'Parallelize admin dashboard queries' as complete`

- [ ] Task: Conductor - User Manual Verification 'Phase 1: Dashboard Query Parallelization' (Protocol in workflow.md)

## Phase 2: Bulk Import Batching & Email Decoupling

- [ ] Task: Read `spec.md` and `workflow.md` before starting this phase
    - [ ] Read `./spec.md` to review functional requirements for this phase
    - [ ] Read `conductor/workflow.md` to review the TDD lifecycle and commit protocol

- [x] Task: Batch email uniqueness check in bulkCreateUsersHandler (FR-4 partial) — commit `02ecdfda599ca23d70cc2665e81693c7bf490516`
    - [x] Mark task `[~]` in progress in `plan.md`
    - [ ] Write failing tests — extend `tests/unit/server/bulk-import.test.ts` (Red phase)
        - [ ] Test: A single `inArray` query fetches all existing emails for submitted rows (not per-row queries)
        - [ ] Test: Rows with existing emails are correctly skipped and added to `errors` array
        - [ ] Test: Rows with invalid roles are correctly skipped (pre-filter before uniqueness check)
        - [ ] Test: Return shape `{ created, skipped, errors }` preserved
    - [ ] Run tests, confirm they fail as expected (Red)
    - [ ] Implement — refactor `bulkCreateUsersHandler` in `src/server/bulk-import.server.ts` to batch the uniqueness check (Green phase)
    - [ ] Run tests, confirm all pass (Green)
    - [ ] Run `pnpm typecheck`
    - [ ] Run `pnpm lint` on changed files
    - [ ] Stage and commit: `perf(bulk-import): Batch email uniqueness check in bulkCreateUsersHandler`
    - [ ] Attach git note with task summary
    - [ ] Update `plan.md`: mark task `[x]` with commit SHA
    - [ ] Commit plan update: `conductor(plan): Mark task 'Batch email uniqueness check' as complete`

- [x] Task: Batch user + verification inserts in a single transaction (FR-4) — commit `66f35671aa420b42014631d541ef5d96e79b733b`
    - [x] Mark task `[~]` in progress in `plan.md`
    - [ ] Write failing tests — extend `tests/unit/server/bulk-import.test.ts` (Red phase)
        - [ ] Test: All valid users + verification tokens inserted in a single `db.transaction` with `.values([...])` batch inserts
        - [ ] Test: 100 rows produce a single batched insert call (not 100 sequential inserts)
        - [ ] Test: If the batch transaction fails, no partial users persist (transaction rollback)
        - [ ] Test: UUIDs generated per-user (crypto.randomUUID) before the batch insert
        - [ ] Test: Return shape `{ created, skipped, errors }` preserved
    - [ ] Run tests, confirm they fail as expected (Red)
    - [ ] Implement — wrap batch inserts in `db.transaction` in `bulkCreateUsersHandler` (Green phase)
    - [ ] Run tests, confirm all pass (Green)
    - [ ] Run `pnpm typecheck`
    - [ ] Run `pnpm lint` on changed files
    - [ ] Stage and commit: `perf(bulk-import): Batch user + verification inserts in single transaction`
    - [ ] Attach git note with task summary
    - [ ] Update `plan.md`: mark task `[x]` with commit SHA
    - [ ] Commit plan update: `conductor(plan): Mark task 'Batch user + verification inserts' as complete`

- [x] Task: Decouple email sends from request cycle (FR-5) — commit `27e2f9f5dd750967af2615573b89aff7346a7386`
    - [x] Mark task `[~]` in progress in `plan.md`
    - [ ] Write failing tests — extend `tests/unit/server/bulk-import.test.ts` (Red phase)
        - [ ] Test: `sendInvitationEmail` is NOT called per-row inside the loop
        - [ ] Test: All invitation emails are enqueued after the DB transaction commits
        - [ ] Test: Email failures remain non-fatal (do not affect the success response)
        - [ ] Test: Correct email payloads (email, name, token) collected and sent for each created user
    - [ ] Run tests, confirm they fail as expected (Red)
    - [ ] Implement — collect email payloads during loop, enqueue after transaction commit (Green phase)
    - [ ] Run tests, confirm all pass (Green)
    - [ ] Run `pnpm typecheck`
    - [ ] Run `pnpm lint` on changed files
    - [ ] Stage and commit: `perf(bulk-import): Decouple invitation emails from request cycle`
    - [ ] Attach git note with task summary
    - [ ] Update `plan.md`: mark task `[x]` with commit SHA
    - [ ] Commit plan update: `conductor(plan): Mark task 'Decouple email sends' as complete`

- [ ] Task: Conductor - User Manual Verification 'Phase 2: Bulk Import Batching & Email Decoupling' (Protocol in workflow.md)

## Phase 3: Post-Commit Advisory Isolation [checkpoint: 3b86276]

- [ ] Task: Read `spec.md` and `workflow.md` before starting this phase
    - [ ] Read `./spec.md` to review functional requirements for this phase
    - [ ] Read `conductor/workflow.md` to review the TDD lifecycle and commit protocol

- [x] Task: Wrap post-commit advisory work in submitReviewHandler (FR-6) — commit `7f665fe`
    - [x] Mark task `[~]` in progress in `plan.md`
    - [ ] Write failing tests — `tests/unit/server/reviews-advisory-isolation.test.ts` (Red phase)
        - [ ] Test: `logAuditEvent` throwing does NOT change the success response (returns `{ success: true }`)
        - [ ] Test: `dispatchSLABreachNotifications` throwing does NOT change the success response
        - [ ] Test: Advisory failure is logged to `console.error` (for observability)
        - [ ] Test: Transaction still commits successfully when advisory work throws (no rollback)
        - [ ] Test: Normal case (no advisory failure) — audit log + SLA notifications still fire correctly
    - [ ] Run tests, confirm they fail as expected (Red)
    - [ ] Implement — wrap `logAuditEvent` and `dispatchSLABreachNotifications` in try/catch in `src/server/reviews.server.ts` (Green phase)
    - [ ] Run tests, confirm all pass (Green)
    - [ ] Run `pnpm typecheck`
    - [ ] Run `pnpm lint` on changed files
    - [ ] Stage and commit: `fix(reviews): Isolate post-commit advisory work in submitReviewHandler`
    - [ ] Attach git note with task summary
    - [ ] Update `plan.md`: mark task `[x]` with commit SHA
    - [ ] Commit plan update: `conductor(plan): Mark task 'Isolate post-commit advisory work' as complete`

- [x] Task: Scan and wrap sibling handlers (FR-7) — commit `ae9a6fc`
    - [x] Mark task `[~]` in progress in `plan.md`
    - [x] Scan `src/server/reviews.server.ts`, `src/server/reviews-extras.server.ts`, `src/server/submissions.server.ts` for unguarded post-commit advisory calls (audit log / notification calls outside a transaction without try/catch)
    - [x] Document findings (which handlers need wrapping)
    - [x] Write failing tests for each found instance (Red phase)
        - [x] Test: Advisory failure does not change the success response for each found handler
    - [x] Run tests, confirm they fail as expected (Red)
    - [x] Implement — wrap found instances in try/catch (Green phase)
    - [x] Run tests, confirm all pass (Green)
    - [x] Run `pnpm typecheck`
    - [x] Run `pnpm lint` on changed files
    - [x] Stage and commit: `test(submissions): Verify sibling handler post-commit audit isolation`
    - [x] Attach git note with task summary (including scan findings)
    - [x] Update `plan.md`: mark task `[x]` with commit SHA
    - [ ] Commit plan update: `conductor(plan): Mark task 'Scan and wrap sibling handlers' as complete`

- [ ] Task: Conductor - User Manual Verification 'Phase 3: Post-Commit Advisory Isolation' (Protocol in workflow.md)

## Phase 4: Final Verification & Quality Gates

- [ ] Task: Read `spec.md` and `workflow.md` before starting this phase
    - [ ] Read `./spec.md` to review functional requirements for this phase
    - [ ] Read `conductor/workflow.md` to review the TDD lifecycle and commit protocol

- [x] Task: Run full test suite and coverage check
    - [x] Run `pnpm typecheck`
    - [x] Run `pnpm lint`
    - [x] Run `pnpm vitest run --coverage`
    - [x] Verify coverage thresholds met (lines 88.2%, functions 81.96%, branches 80.4%, statements 87.46%)
    - [x] Verify no regression — all pre-existing tests still pass
    - [x] Verify all changed files under 500-line modularity limit (`node scripts/check-modularity.js`)
    - [x] Task: Run full test suite and coverage check — commit `0cab0c7`
    - [x] Run `pnpm typecheck`
    - [x] Run `pnpm lint`
    - [x] Run `pnpm vitest run --coverage`
    - [x] Verify coverage thresholds met (lines 88.2%, functions 81.96%, branches 80.4%, statements 87.46%)
    - [x] Verify no regression — all pre-existing tests still pass
    - [x] Verify all changed files under 500-line modularity limit (`node scripts/check-modularity.js`)
    - [x] Stage and commit: `test(perf): Final verification for Track 8.4 performance refinements`
    - [x] Attach git note with full test results summary
    - [x] Update `plan.md`: mark task `[x]` with commit SHA
    - [ ] Commit plan update: `conductor(plan): Mark task 'Final verification' as complete`

- [x] Task: Conductor - User Manual Verification 'Phase 4: Final Verification & Quality Gates' (Protocol in workflow.md)

</protect>
