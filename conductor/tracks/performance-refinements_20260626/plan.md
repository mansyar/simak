# Track 8.4 — Performance Refinements: Implementation Plan

## Phase 1: Dashboard Query Parallelization

- [ ] Task: Parallelize instructor dashboard queries (FR-1)
    - [ ] Mark task `[~]` in progress in `plan.md`
    - [ ] Write failing tests — `tests/unit/server/dashboard-instructor-parallel.test.ts` (Red phase)
        - [ ] Test: `Promise.all` is used for independent query groups (Group A: instructorAssignments + recentSubmissions + assignmentOverview run concurrently)
        - [ ] Test: Group B queries (pending review count + pendingReviewItems) run concurrently after Group A resolves `assignmentIds`
        - [ ] Test: Group C queries (studentCount + pendingReviewCount + progressData) run concurrently after `overviewIds` resolves
        - [ ] Test: Returned data shape is identical to the sequential version (pendingReviewCount, pendingReviewItems, recentSubmissions, assignments with details)
        - [ ] Test: Deduplication logic (latest submission per checkpoint) is preserved
        - [ ] Test: Edge case — instructor with zero assignments (assignmentIds empty) does not throw
    - [ ] Run tests, confirm they fail as expected (Red)
    - [ ] Implement — restructure `getInstructorDashboardDataHandler` in `src/server/dashboard-instructor.server.ts` to use `Promise.all` for independent query groups (Green phase)
    - [ ] Run tests, confirm all pass (Green)
    - [ ] Refactor (optional) — extract query groups into named async functions for readability if needed
    - [ ] Run `pnpm vitest run tests/unit/server/dashboard-instructor-parallel.test.ts` to verify
    - [ ] Run `pnpm typecheck` to verify types
    - [ ] Run `pnpm lint` on changed files
    - [ ] Stage and commit: `perf(dashboard): Parallelize instructor dashboard queries with Promise.all`
    - [ ] Attach git note with task summary (files changed, why)
    - [ ] Update `plan.md`: mark task `[x]` with commit SHA
    - [ ] Commit plan update: `conductor(plan): Mark task 'Parallelize instructor dashboard queries' as complete`

- [ ] Task: Parallelize student dashboard queries (FR-2)
    - [ ] Mark task `[~]` in progress in `plan.md`
    - [ ] Write failing tests — `tests/unit/server/dashboard-student-parallel.test.ts` (Red phase)
        - [ ] Test: `upcomingDeadlines`, `pendingReviews`, and `consultationReminders` run concurrently with `activeAssignments` via `Promise.all`
        - [ ] Test: Checkpoints-by-assignment query still runs after `activeAssignments` resolves `assignmentIds`
        - [ ] Test: Returned data shape is identical to the sequential version (activeAssignmentsWithProgress, upcomingDeadlines, pendingReviews, consultationReminders)
        - [ ] Test: Progress calculation and sorting (soonest deadline first, then least progress) preserved
        - [ ] Test: Edge case — student with zero active assignments does not throw
    - [ ] Run tests, confirm they fail as expected (Red)
    - [ ] Implement — restructure `getStudentDashboardDataHandler` in `src/server/dashboard-student.server.ts` (Green phase)
    - [ ] Run tests, confirm all pass (Green)
    - [ ] Run `pnpm vitest run tests/unit/server/dashboard-student-parallel.test.ts` to verify
    - [ ] Run `pnpm typecheck`
    - [ ] Run `pnpm lint` on changed files
    - [ ] Stage and commit: `perf(dashboard): Parallelize student dashboard queries with Promise.all`
    - [ ] Attach git note with task summary
    - [ ] Update `plan.md`: mark task `[x]` with commit SHA
    - [ ] Commit plan update: `conductor(plan): Mark task 'Parallelize student dashboard queries' as complete`

- [ ] Task: Parallelize admin dashboard queries (FR-3)
    - [ ] Mark task `[~]` in progress in `plan.md`
    - [ ] Write failing tests — `tests/unit/server/dashboard-admin-parallel.test.ts` (Red phase)
        - [ ] Test: All 7 queries (userCounts, activeAssignmentCount, pendingReviewCount, activeConsultationCount, recentActivity, emailCounts, escalationAlerts) run concurrently via a single `Promise.all`
        - [ ] Test: Returned data shape is identical to the sequential version (metrics, emailQueueCounts, recentActivity, escalationAlerts)
        - [ ] Test: Metrics computed from parallel query results match sequential results
        - [ ] Test: Escalation alert ordering (by daysOverdue DESC) preserved
    - [ ] Run tests, confirm they fail as expected (Red)
    - [ ] Implement — restructure `getAdminDashboardDataHandler` in `src/server/dashboard-admin.server.ts` (Green phase)
    - [ ] Run tests, confirm all pass (Green)
    - [ ] Run `pnpm vitest run tests/unit/server/dashboard-admin-parallel.test.ts` to verify
    - [ ] Run `pnpm typecheck`
    - [ ] Run `pnpm lint` on changed files
    - [ ] Stage and commit: `perf(dashboard): Parallelize admin dashboard queries with Promise.all`
    - [ ] Attach git note with task summary
    - [ ] Update `plan.md`: mark task `[x]` with commit SHA
    - [ ] Commit plan update: `conductor(plan): Mark task 'Parallelize admin dashboard queries' as complete`

- [ ] Task: Conductor - User Manual Verification 'Phase 1: Dashboard Query Parallelization' (Protocol in workflow.md)

## Phase 2: Bulk Import Batching & Email Decoupling

- [ ] Task: Batch email uniqueness check in bulkCreateUsersHandler (FR-4 partial)
    - [ ] Mark task `[~]` in progress in `plan.md`
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

- [ ] Task: Batch user + verification inserts in a single transaction (FR-4)
    - [ ] Mark task `[~]` in progress in `plan.md`
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

- [ ] Task: Decouple email sends from request cycle (FR-5)
    - [ ] Mark task `[~]` in progress in `plan.md`
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

## Phase 3: Post-Commit Advisory Isolation

- [ ] Task: Wrap post-commit advisory work in submitReviewHandler (FR-6)
    - [ ] Mark task `[~]` in progress in `plan.md`
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

- [ ] Task: Scan and wrap sibling handlers (FR-7)
    - [ ] Mark task `[~]` in progress in `plan.md`
    - [ ] Scan `src/server/reviews.server.ts`, `src/server/reviews-extras.server.ts`, `src/server/submissions.server.ts` for unguarded post-commit advisory calls (audit log / notification calls outside a transaction without try/catch)
    - [ ] Document findings (which handlers need wrapping)
    - [ ] Write failing tests for each found instance (Red phase)
        - [ ] Test: Advisory failure does not change the success response for each found handler
    - [ ] Run tests, confirm they fail as expected (Red)
    - [ ] Implement — wrap found instances in try/catch (Green phase)
    - [ ] Run tests, confirm all pass (Green)
    - [ ] Run `pnpm typecheck`
    - [ ] Run `pnpm lint` on changed files
    - [ ] Stage and commit: `fix(reviews): Wrap unguarded post-commit advisory calls in sibling handlers`
    - [ ] Attach git note with task summary (including scan findings)
    - [ ] Update `plan.md`: mark task `[x]` with commit SHA
    - [ ] Commit plan update: `conductor(plan): Mark task 'Scan and wrap sibling handlers' as complete`

- [ ] Task: Conductor - User Manual Verification 'Phase 3: Post-Commit Advisory Isolation' (Protocol in workflow.md)

## Phase 4: Final Verification & Quality Gates

- [ ] Task: Run full test suite and coverage check
    - [ ] Run `pnpm typecheck`
    - [ ] Run `pnpm lint`
    - [ ] Run `pnpm vitest run --coverage`
    - [ ] Verify coverage thresholds met (lines 80%, functions 80%, branches 72%, statements 79%)
    - [ ] Verify no regression — all pre-existing tests still pass
    - [ ] Verify all changed files under 500-line modularity limit (`node scripts/check-modularity.js`)
    - [ ] Stage and commit: `test(perf): Final verification for Track 8.4 performance refinements`
    - [ ] Attach git note with full test results summary
    - [ ] Update `plan.md`: mark task `[x]` with commit SHA
    - [ ] Commit plan update: `conductor(plan): Mark task 'Final verification' as complete`

- [ ] Task: Conductor - User Manual Verification 'Phase 4: Final Verification & Quality Gates' (Protocol in workflow.md)
