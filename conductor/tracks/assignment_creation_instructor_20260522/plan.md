# Track 3.1 — Assignment Creation (Instructor) Implementation Plan

## Phase 1: Server-Side Functions & Testing

- [x] Task: Implement Drizzle Query logic & split server files for Assignments
  - [x] Define client stubs, routes validation schemas and Zod types in `src/server/assignments.ts`
  - [x] Create database query logic in `src/server/assignments.server.ts`
  - [x] Implement `listInstructorAssignments` with paginated offset, title search, and instructor ownership filtering
  - [x] Implement `createAssignment` with transaction to insert assignments, assignment_students, and copy/instantiate checkpoints per student
  - [x] Implement `getAssignmentDetail` to fetch assignment summary, assigned students list, and checkpoint progress statuses
- [x] Task: TDD - Unit and Integration Tests for Assignment Server Functions
  - [x] Write failing unit test suite `tests/unit/assignments/creation.test.ts` to test checkpoint copy/instantiation logic (Red Phase)
  - [x] Write failing integration test suite `tests/integration/assignments/create-assignment.test.ts` to test complete wizard save flow in DB transaction (Red Phase)
  - [x] Implement and verify both test suites pass successfully (Green Phase)
  - [x] Verify test coverage for `src/server/assignments.server.ts` is > 80%
- [x] Task: Conductor - User Manual Verification 'Phase 1: Server-Side Functions & Testing' (Protocol in workflow.md)

## Phase 2: Listing & Detail Views UI

- [ ] Task: Create i18n translation keys
  - [ ] Add English translations for instructor dashboard, assignments list, table headers, and status badges in `locales/en.json`
  - [ ] Add Indonesian translations in `locales/id.json`
- [ ] Task: Implement Assignment Listing View
  - [ ] Add sidebar navigation link for Instructor Assignments
  - [ ] Create layout/route file `src/routes/_authenticated/instructor/assignments/index.tsx`
  - [ ] Build card-based and list view of instructor-owned assignments with search filter, pagination, and skeleton loading card states
- [ ] Task: Implement Assignment Detail and Progress Dashboard
  - [ ] Create dynamic route file `src/routes/_authenticated/instructor/assignments/$id.tsx`
  - [ ] Create `progress-table.tsx` component displaying assigned students, current checkpoint, and overall completion percentages
  - [ ] Add status badge colors for checkpoint states (passed, under_review, submitted, locked, unlocked, revise)
- [ ] Task: TDD - Unit Tests for Listing & Detail Components
  - [ ] Write failing component tests for Assignments list page filters, skeleton loading, and empty states (Red Phase)
  - [ ] Write failing component tests for progress-table component row rendering and status badges (Red Phase)
  - [ ] Implement and verify both test suites pass successfully (Green Phase)
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Listing & Detail Views UI' (Protocol in workflow.md)

## Phase 3: Creation Wizard UI & Flow

- [ ] Task: Implement step-by-step Wizard Container & Forms
  - [ ] Create wizard route file `src/routes/_authenticated/instructor/assignments/new.tsx`
  - [ ] Create dynamic wizard container `assignment-wizard.tsx` with a premium visual step indicator (Select Template -> Fill Details -> Select Students -> Confirm)
  - [ ] Integrate React Hook Form and Zod resolver for input validations
- [ ] Task: Create Wizard Steps components
  - [ ] Create `template-picker.tsx` showing template cards and checkpoint previews
  - [ ] Create `student-picker.tsx` with a searchable multi-select combobox filtering role = student
  - [ ] Build the confirmation summary step showcasing all choices before submitting
- [ ] Task: Integration & Validation Tests for Wizard UI
  - [ ] Write failing integration tests for wizard navigation, validation guards on each step, and final transaction submission (Red Phase)
  - [ ] Verify validation errors for empty fields, past dates, or empty student list are correctly displayed inline
  - [ ] Make all wizard tests pass (Green Phase)
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Creation Wizard UI & Flow' (Protocol in workflow.md)
