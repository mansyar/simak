# Implementation Plan: Per-Student Deadline Isolation

## Phase 1: Remove Non-Scoped finalDeadline Writes

- [ ] Task: Write failing tests asserting finalDeadline isolation (Red)
    - [ ] Add test asserting `calculateExtensionAdjustment` (via `approveExtensionHandler`) does NOT mutate `assignments.finalDeadline`; only the target student's checkpoints move; other students' checkpoints unchanged
    - [ ] Add test asserting `bulkExtendHandler` does NOT mutate `assignments.finalDeadline`; only the target student's unfinished checkpoints move
    - [ ] Add test asserting `adjustDeadlinesForBreach` does NOT mutate `assignments.finalDeadline`; only the target student's affected + subsequent checkpoints move; other students' checkpoints unchanged
- [ ] Task: Remove finalDeadline write blocks (Green)
    - [ ] Remove the "Extend assignment finalDeadline" block from `calculateExtensionAdjustment` in `src/server/extensions-extras.server.ts` (lines 81-95)
    - [ ] Remove the "Also extend assignment finalDeadline" block from `bulkExtendHandler` in `src/server/extensions-extras.server.ts` (lines 364-380)
    - [ ] Remove the "Extend assignment finalDeadline" block from `adjustDeadlinesForBreach` in `src/lib/review-sla.ts` (lines 72-82)
- [ ] Task: Update existing tests that encoded the old buggy behavior
    - [ ] Invert `tests/unit/lib/review-sla.test.ts` — "should extend assignment finalDeadline when present" -> assert finalDeadline is NOT extended
    - [ ] Invert `tests/unit/server/extensions-bulk.test.ts` — "should extend assignment finalDeadline when it exists" -> assert NOT extended
    - [ ] Invert `tests/unit/reviews/deadline-adjustment.test.ts` — "should extend assignment finalDeadline when review is late" -> assert NOT extended
    - [ ] Review and update `tests/unit/reviews/sla-integration.test.ts` and `tests/unit/server/notifications-events.test.ts` for finalDeadline write assertions
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Remove Non-Scoped finalDeadline Writes' (Protocol in workflow.md)

## Phase 2: Derive Per-Student Effective Deadline in Reader Views

- [ ] Task: Write failing tests for effective deadline derivation (Red)
    - [ ] Add test asserting `listStudentAssignmentsHandler` returns `effectiveDeadline` derived from the student's last checkpoint dueDate
    - [ ] Add test asserting `getStudentAssignmentDetailHandler` returns `effectiveDeadline` from last checkpoint dueDate
    - [ ] Add test asserting `getStudentDashboardDataHandler` returns and sorts by `effectiveDeadline`
    - [ ] Add test asserting `getAssignmentDetailHandler` (instructor) returns per-student `effectiveDeadline` alongside the course-wide `finalDeadline`
- [ ] Task: Implement effectiveDeadline in student reader handlers (Green)
    - [ ] `listStudentAssignmentsHandler` (`src/server/assignments-extras.server.ts`): enhance the checkpoints query to select `dueDate` + `order`; compute `effectiveDeadline` (highest-order checkpoint dueDate) per assignment
    - [ ] `getStudentAssignmentDetailHandler` (`src/server/assignments-extras.server.ts`): compute `effectiveDeadline` from the already-loaded checkpoints (highest order)
    - [ ] `getStudentDashboardDataHandler` (`src/server/dashboard-student.server.ts`): compute `effectiveDeadline` from loaded checkpoints; sort active assignments by `effectiveDeadline` instead of `finalDeadline`
- [ ] Task: Implement per-student effectiveDeadline in instructor detail handler
    - [ ] `getAssignmentDetailHandler` (`src/server/assignments.server.ts`): add per-student `effectiveDeadline` (last checkpoint dueDate) to each `AssignmentDetailStudent`; keep assignment-level `finalDeadline`
    - [ ] Verify `listInstructorAssignmentsHandler` and `getInstructorDashboardDataHandler` read the course-wide `finalDeadline` correctly (no code change expected)
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Derive Per-Student Effective Deadline in Reader Views' (Protocol in workflow.md)

## Phase 3: Frontend Display + i18n

- [ ] Task: Write failing component tests for effective deadline display (Red)
    - [ ] Add test asserting `StudentAssignmentCard` displays the effective deadline
    - [ ] Add test asserting `AssignmentDetailHeader` (student) displays the effective deadline
    - [ ] Add test asserting `StudentDashboard` displays the effective deadline
    - [ ] Add test asserting `AssignmentOverviewTab` (instructor) displays both the course-wide finalDeadline and per-student effectiveDeadline
- [ ] Task: Update frontend components to display effective deadline (Green)
    - [ ] `StudentAssignmentCard` (`src/components/student/assignments/StudentAssignmentCard.tsx`): display effectiveDeadline
    - [ ] `AssignmentDetailHeader` (`src/components/student/assignments/AssignmentDetailHeader.tsx`): display effectiveDeadline
    - [ ] `StudentDashboard` (`src/components/dashboard/StudentDashboard.tsx`): display effectiveDeadline
    - [ ] `AssignmentOverviewTab` (`src/components/instructor/assignments/AssignmentOverviewTab.tsx`): display both course-wide finalDeadline + per-student effectiveDeadline
    - [ ] `src/routes/_authenticated/student/assignments/$id.tsx`: pass `effectiveDeadline` to the header component
- [ ] Task: Add i18n keys for new labels
    - [ ] Add effective/original deadline label keys to `locales/en.json` and `locales/id.json`
    - [ ] Run `pnpm generate:i18n` and validate with `pnpm check:i18n`
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Frontend Display + i18n' (Protocol in workflow.md)

## Phase 4: Final Verification

- [ ] Task: Run full quality gates
    - [ ] Run `pnpm typecheck`
    - [ ] Run `pnpm lint`
    - [ ] Run `pnpm test:coverage` (verify >=80% thresholds: lines, functions, branches, statements)
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Final Verification' (Protocol in workflow.md)
