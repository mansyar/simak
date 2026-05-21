# Plan: Track 3.2 — Student Assignment Viewing

## Phase 1: Student Layout & Sidebar [checkpoint: 81c609b]

- [x] Task: Create server functions for student assignment queries [f43884c]
  - [x] Add Zod schemas and `createServerFn` stubs in `src/server/assignments.ts`
  - [x] Implement handlers in `src/server/assignments.server.ts`
  - [x] Write unit tests for Zod schemas (validation, auth checks)
  - [x] Write integration test for `listStudentAssignments` (student sees only own assignments)
  - [x] Write integration test for `getStudentAssignmentDetail` (ownership check, forbidden for other student)
- [x] Task: Create student sidebar layout route [0961315]
  - [x] Create `src/routes/_authenticated/student.tsx` with `requireRole(['student'])` guard
  - [x] Create `src/components/layout/student-sidebar.tsx` (matching instructor pattern)
  - [x] Add `studentSidebar` translation keys to `locales/en.json` and `locales/id.json`
  - [x] Write unit tests for student layout (role guard, sidebar rendering)
  - [x] Write unit tests for student sidebar (link rendering, active state, i18n)
- [x] Task: Conductor - User Manual Verification 'Phase 1: Student Layout & Sidebar' (Protocol in workflow.md)

## Phase 2: Student Assignment List Page

- [x] Task: Build student assignment list UI [b44ce6d]
  - [x] Create `src/routes/_authenticated/student/assignments/index.tsx` route
  - [x] Create `src/components/student/assignments/StudentAssignmentCard.tsx` with title, template badge, deadline, progress
  - [x] Create `src/components/student/assignments/StudentAssignmentFilters.tsx` with search input for filtering by title
  - [x] Create `src/components/student/assignments/StudentAssignmentEmptyState.tsx`
  - [x] Create `src/components/student/assignments/StudentAssignmentLoadingSkeleton.tsx`
  - [x] Add `studentAssignments` list translation keys to `locales/en.json` and `locales/id.json`
  - [x] Update `scripts/generate-i18n-types.ts` with `studentAssignments` section in `Translation` type
  - [x] Write unit tests for StudentAssignmentCard (metadata rendering, progress display)
  - [x] Write unit tests for StudentAssignmentFilters (search input render, change handler)
  - [x] Write unit tests for StudentAssignmentEmptyState (message, prompt)
  - [x] Write unit tests for StudentAssignmentLoadingSkeleton (skeleton count, default)
  - [x] Write unit tests for assignment list route (pagination, search, loading states)
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Student Assignment List Page' (Protocol in workflow.md)

## Phase 3: Student Assignment Detail & Checkpoint Timeline

- [ ] Task: Build student assignment detail page
  - [ ] Create `src/routes/_authenticated/student/assignments/$id.tsx` route (SSR with client hydration)
  - [ ] Create `src/components/student/assignments/CheckpointTimeline.tsx` vertical timeline layout
  - [ ] Create `src/components/student/assignments/CheckpointCard.tsx` with state badge, due date, blocking reasons, and consultation progress (X/Y verified)
  - [ ] Create `src/components/student/assignments/AssignmentDetailHeader.tsx` with title, description, instructor, deadline
  - [ ] Add `studentAssignments.detail` and `studentAssignments.status` translation keys to `locales/en.json` and `locales/id.json`
  - [ ] Write unit tests for CheckpointTimeline (order, all checkpoints displayed)
  - [ ] Write unit tests for CheckpointCard (state badge colors, due date, overdue indicator, lock reasons, consultation progress bar)
  - [ ] Write unit tests for AssignmentDetailHeader (metadata display, instructor name)
  - [ ] Write unit tests for assignment detail route (SSR data, ownership guard, loading state)
- [ ] Task: Add consultation count to assignment detail server function
  - [ ] Extend `getStudentAssignmentDetailHandler` to query `consultations` table (group by `checkpoint_id`, count where `status = 'verified'`)
  - [ ] Return `verifiedConsultationCount` per checkpoint in the response payload
  - [ ] Write unit test for consultation count query logic
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Student Assignment Detail & Checkpoint Timeline' (Protocol in workflow.md)

## Phase 4: Final Verification & Polish

- [ ] Task: Audit all new components for i18n coverage
  - [ ] Verify no hardcoded user-facing strings exist in any new component
  - [ ] Verify all `en.json` and `id.json` entries for `studentSidebar`, `studentAssignments` have complete key parity
- [ ] Task: Run full test suite and verify coverage >80%
- [ ] Task: Run typecheck (`pnpm typecheck`) and lint (`pnpm lint`) and fix any issues
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Final Verification & Polish' (Protocol in workflow.md)
