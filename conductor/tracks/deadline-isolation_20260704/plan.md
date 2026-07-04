<protect>
# Implementation Plan: Per-Student Deadline Isolation

## Phase 1: Remove Non-Scoped finalDeadline Writes [checkpoint: 1d431ee]

- [x] Task: Read spec.md and workflow.md
    - [x] Read `./spec.md` to confirm requirements and acceptance criteria
    - [x] Read `../../../../workflow.md` to confirm TDD workflow and phase completion protocol
- [x] Task: Write failing tests asserting finalDeadline isolation (Red) [fdc3edf]
    - [x] Add test asserting `calculateExtensionAdjustment` (via `approveExtensionHandler`) does NOT mutate `assignments.finalDeadline`; only the target student's checkpoints move; other students' checkpoints unchanged
    - [x] Add test asserting `bulkExtendHandler` does NOT mutate `assignments.finalDeadline`; only the target student's unfinished checkpoints move
    - [x] Add test asserting `adjustDeadlinesForBreach` does NOT mutate `assignments.finalDeadline`; only the target student's affected + subsequent checkpoints move; other students' checkpoints unchanged
- [x] Task: Remove finalDeadline write blocks (Green) [fdc3edf]
    - [x] Remove the "Extend assignment finalDeadline" block from `calculateExtensionAdjustment` in `src/server/extensions-extras.server.ts` (lines 81-95)
    - [x] Remove the "Also extend assignment finalDeadline" block from `bulkExtendHandler` in `src/server/extensions-extras.server.ts` (lines 364-380)
    - [x] Remove the "Extend assignment finalDeadline" block from `adjustDeadlinesForBreach` in `src/lib/review-sla.ts` (lines 72-82)
- [x] Task: Update existing tests that encoded the old buggy behavior [fdc3edf]
    - [x] Invert `tests/unit/lib/review-sla.test.ts` — "should extend assignment finalDeadline when present" -> assert finalDeadline is NOT extended
    - [x] Invert `tests/unit/server/extensions-bulk.test.ts` — "should extend assignment finalDeadline when it exists" -> assert NOT extended
    - [x] Invert `tests/unit/reviews/deadline-adjustment.test.ts` — "should extend assignment finalDeadline when review is late" -> assert NOT extended
    - [x] Review and update `tests/unit/reviews/sla-integration.test.ts` and `tests/unit/server/notifications-events.test.ts` for finalDeadline write assertions
- [x] Task: Conductor - User Manual Verification 'Phase 1: Remove Non-Scoped finalDeadline Writes' (Protocol in workflow.md) [1d431ee]

## Phase 2: Derive Per-Student Effective Deadline in Reader Views [checkpoint: f920786]

- [x] Task: Read spec.md and workflow.md [654dc95]
    - [x] Read `./spec.md` to confirm requirements and acceptance criteria
    - [x] Read `../../../../workflow.md` to confirm TDD workflow and phase completion protocol
- [x] Task: Write failing tests for effective deadline derivation (Red) [654dc95]
    - [x] Add test asserting `listStudentAssignmentsHandler` returns `effectiveDeadline` derived from the student's last checkpoint dueDate
    - [x] Add test asserting `getStudentAssignmentDetailHandler` returns `effectiveDeadline` from last checkpoint dueDate
    - [x] Add test asserting `getStudentDashboardDataHandler` returns and sorts by `effectiveDeadline`
    - [x] Add test asserting `getAssignmentDetailHandler` (instructor) returns per-student `effectiveDeadline` alongside the course-wide `finalDeadline`
- [x] Task: Implement effectiveDeadline in student reader handlers (Green) [654dc95]
    - [x] `listStudentAssignmentsHandler` (`src/server/assignments-extras.server.ts`): enhance the checkpoints query to select `dueDate` + `order`; compute `effectiveDeadline` (highest-order checkpoint dueDate) per assignment
    - [x] `getStudentAssignmentDetailHandler` (`src/server/assignments-extras.server.ts`): compute `effectiveDeadline` from the already-loaded checkpoints (highest order)
    - [x] `getStudentDashboardDataHandler` (`src/server/dashboard-student.server.ts`): compute `effectiveDeadline` from loaded checkpoints; sort active assignments by `effectiveDeadline` instead of `finalDeadline`
- [x] Task: Implement per-student effectiveDeadline in instructor detail handler [654dc95]
    - [x] `getAssignmentDetailHandler` (`src/server/assignments.server.ts`): add per-student `effectiveDeadline` (last checkpoint dueDate) to each `AssignmentDetailStudent`; keep assignment-level `finalDeadline`
    - [x] Verify `listInstructorAssignmentsHandler` and `getInstructorDashboardDataHandler` read the course-wide `finalDeadline` correctly (no code change expected)
- [x] Task: Conductor - User Manual Verification 'Phase 2: Derive Per-Student Effective Deadline in Reader Views' (Protocol in workflow.md) [f920786]

## Phase 3: Frontend Display + i18n [checkpoint: 170bbc8]

- [x] Task: Read spec.md and workflow.md [467ef2c]
    - [x] Read `./spec.md` to confirm requirements and acceptance criteria
    - [x] Read `../../../../workflow.md` to confirm TDD workflow and phase completion protocol
- [x] Task: Write failing component tests for effective deadline display (Red) [467ef2c]
    - [x] Add test asserting `StudentAssignmentCard` displays the effective deadline
    - [x] Add test asserting `AssignmentDetailHeader` (student) displays the effective deadline
    - [x] Add test asserting `StudentDashboard` displays the effective deadline
    - [x] Add test asserting `AssignmentOverviewTab` (instructor) displays both the course-wide finalDeadline and per-student effectiveDeadline
- [x] Task: Update frontend components to display effective deadline (Green) [467ef2c]
    - [x] `StudentAssignmentCard` (`src/components/student/assignments/StudentAssignmentCard.tsx`): display effectiveDeadline
    - [x] `AssignmentDetailHeader` (`src/components/student/assignments/AssignmentDetailHeader.tsx`): display effectiveDeadline
    - [x] `StudentDashboard` (`src/components/dashboard/StudentDashboard.tsx`): display effectiveDeadline
    - [x] `AssignmentOverviewTab` (`src/components/instructor/assignments/AssignmentOverviewTab.tsx`): display both course-wide finalDeadline + per-student effectiveDeadline
    - [x] `src/routes/_authenticated/student/assignments/$id.tsx`: pass `effectiveDeadline` to the header component
- [x] Task: Add i18n keys for new labels [467ef2c]
    - [x] Add effective/original deadline label keys to `locales/en.json` and `locales/id.json`
    - [x] Run `pnpm generate:i18n` and validate with `pnpm check:i18n`
- [x] Task: Conductor - User Manual Verification 'Phase 3: Frontend Display + i18n' (Protocol in workflow.md) [170bbc8]

## Phase 4: Final Verification [~]

- [~] Task: Read spec.md and workflow.md
    - [x] Read `./spec.md` to confirm requirements and acceptance criteria
    - [x] Read `../../../../workflow.md` to confirm TDD workflow and phase completion protocol
- [~] Task: Run full quality gates
    - [~] Run `pnpm typecheck`
    - [~] Run `pnpm lint`
    - [~] Run `pnpm test:coverage` (verify >=80% thresholds: lines, functions, branches, statements)
- [~] Task: Conductor - User Manual Verification 'Phase 4: Final Verification' (Protocol in workflow.md)
</protect>
