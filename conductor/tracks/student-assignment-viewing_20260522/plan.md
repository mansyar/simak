# Plan: Track 3.2 — Student Assignment Viewing

## Phase 1: Student Layout & Sidebar

- [ ] Task: Create server functions for student assignment queries
  - [ ] Add Zod schemas and `createServerFn` stubs in `src/server/assignments.ts`
  - [ ] Implement handlers in `src/server/assignments.server.ts`
  - [ ] Write unit tests for Zod schemas (validation, auth checks)
  - [ ] Write integration test for `listStudentAssignments` (student sees only own assignments)
  - [ ] Write integration test for `getStudentAssignmentDetail` (ownership check, forbidden for other student)
- [ ] Task: Create student sidebar layout route
  - [ ] Create `src/routes/_authenticated/student.tsx` with `requireRole(['student'])` guard
  - [ ] Create `src/components/layout/student-sidebar.tsx` (matching instructor pattern)
  - [ ] Write unit tests for student layout (role guard, sidebar rendering)
  - [ ] Write unit tests for student sidebar (link rendering, active state, i18n)
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Student Layout & Sidebar' (Protocol in workflow.md)

## Phase 2: Student Assignment List Page

- [ ] Task: Build student assignment list UI
  - [ ] Create `src/routes/_authenticated/student/assignments/index.tsx` route
  - [ ] Create `src/components/student/assignments/AssignmentCard.tsx` with title, template badge, deadline, progress
  - [ ] Create `src/components/student/assignments/AssignmentListEmptyState.tsx`
  - [ ] Create `src/components/student/assignments/AssignmentListLoadingSkeleton.tsx`
  - [ ] Write unit tests for AssignmentCard (metadata rendering, progress display)
  - [ ] Write unit tests for AssignmentListEmptyState (message, prompt)
  - [ ] Write unit tests for AssignmentListLoadingSkeleton (skeleton count, default)
  - [ ] Write unit tests for assignment list route (pagination, search, loading states)
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Student Assignment List Page' (Protocol in workflow.md)

## Phase 3: Student Assignment Detail & Checkpoint Timeline

- [ ] Task: Build student assignment detail page
  - [ ] Create `src/routes/_authenticated/student/assignments/$id.tsx` route (SSR with client hydration)
  - [ ] Create `src/components/student/assignments/CheckpointTimeline.tsx` vertical timeline layout
  - [ ] Create `src/components/student/assignments/CheckpointCard.tsx` with state badge, due date, blocking reasons
  - [ ] Create `src/components/student/assignments/AssignmentDetailHeader.tsx` with title, description, instructor, deadline
  - [ ] Write unit tests for CheckpointTimeline (order, all checkpoints displayed)
  - [ ] Write unit tests for CheckpointCard (state badge colors, due date, overdue indicator, lock reasons, consultation progress)
  - [ ] Write unit tests for AssignmentDetailHeader (metadata display, instructor name)
  - [ ] Write unit tests for assignment detail route (SSR data, ownership guard, loading state)
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Student Assignment Detail & Checkpoint Timeline' (Protocol in workflow.md)

## Phase 4: i18n Translations & Final Polish

- [ ] Task: Add translation keys for student assignment views
  - [ ] Add all `studentAssignments` keys to `locales/en.json`
  - [ ] Add all `studentAssignments` keys to `locales/id.json`
- [ ] Task: Verify no hardcoded strings across all new components
- [ ] Task: Run full test suite and verify coverage >80%
- [ ] Task: Conductor - User Manual Verification 'Phase 4: i18n Translations & Final Polish' (Protocol in workflow.md)
