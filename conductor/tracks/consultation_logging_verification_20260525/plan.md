# Implementation Plan: Consultation Logging & Verification

## Phase 1: Database Migration & Schema Update [checkpoint: c3a6b30]

- [x] Task: Add minConsultations column to template_checkpoints (24b32a2)
  - [ ] Update `src/db/schema/templates.ts` — add `minConsultations: integer('min_consultations').default(0)`
  - [ ] Generate migration: `pnpm db:generate`
  - [ ] Apply migration: `pnpm db:migrate`
- [x] Task: Verify migration and schema integrity (09d7685)
  - [x] Write test to confirm `template_checkpoints` has `min_consultations` column
  - [x] Run tests to confirm all existing tests still pass
- [x] Task: Conductor - User Manual Verification 'Phase 1: Database Migration & Schema Update' (Protocol in workflow.md)

## Phase 2: Server Functions — Templates Update

- [x] Task: Update Zod schemas for template CRUD to include minConsultations (becbb4e)
  - [x] Update `CreateTemplateSchema` — add `minConsultations: z.number().int().min(0).default(0)` to each checkpoint in the array
  - [x] Update `UpdateTemplateSchema` — same addition
  - [x] Update type inference files
- [x] Task: Update template server handlers (becbb4e)
  - [x] Update `createTemplateHandler` to persist `minConsultations` to `template_checkpoints`
  - [x] Update `updateTemplateHandler` to persist `minConsultations` to `template_checkpoints`
  - [x] Update `getTemplateHandler` and `listTemplatesHandler` to return `minConsultations`
- [x] Task: Update assignment creation to copy minConsultations (becbb4e)
  - [x] Update `createAssignment` handler in `assignments.server.ts` — copy `minConsultations` from `template_checkpoints` to each `checkpoint` row
- [x] Task: Write tests for template minConsultations (becbb4e)
  - [x] Write unit tests for create/update template with minConsultations
  - [x] Write unit test verifying assignment creation copies minConsultations
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Server Functions — Templates Update' (Protocol in workflow.md)

## Phase 3: Server Functions — Consultation CRUD

- [ ] Task: Create Zod schemas and server function stubs (`src/server/consultations.ts`)
  - [ ] Define `LogConsultationSchema` (checkpointId, sessionType, externalConsultantName optional, notes)
  - [ ] Define `ListConsultationsSchema` (assignmentId, checkpointId optional)
  - [ ] Define `ListPendingConsultationsSchema` (assignmentId)
  - [ ] Define `VerifyConsultationSchema` (consultationId)
  - [ ] Define `RejectConsultationSchema` (consultationId, reason)
  - [ ] Define `GetConsultationDetailSchema` (consultationId)
  - [ ] Define `ListVerifiedCountsSchema` (assignmentId)
  - [ ] Create server function stubs with dynamic imports (`logConsultation`, `listConsultations`, `listPendingConsultations`, `verifyConsultation`, `rejectConsultation`, `getConsultationDetail`, `listVerifiedCounts`)
- [ ] Task: Implement server-only handlers (`src/server/consultations.server.ts`)
  - [ ] `logConsultationHandler` — Validate student ownership via assignmentStudents, insert consultation with status `pending`, create notification for instructor
  - [ ] `listConsultationsHandler` — Fetch consultations for student's assignment, newest first, role-aware (student sees own, instructor sees all)
  - [ ] `listPendingConsultationsHandler` — Fetch pending consultations across all students for an instructor's assignment, oldest first (FIFO)
  - [ ] `getConsultationDetailHandler` — Full consultation details with student name, checkpoint info
  - [ ] `verifyConsultationHandler` — Update status to `verified`, set `verifiedById`, `verifiedAt`, create notification for student
  - [ ] `rejectConsultationHandler` — Update status to `rejected`, set rejection reason, create notification for student
  - [ ] `listVerifiedCountsHandler` — Aggregate query returning `{ checkpointId, verifiedCount, minConsultations }` per checkpoint
- [ ] Task: Write tests for consultation server functions
  - [ ] Unit tests for `logConsultation` — success, unauthorized, wrong role, invalid checkpoint
  - [ ] Unit tests for `listConsultations` — student view, instructor view, empty
  - [ ] Unit tests for `listPendingConsultations` — FIFO ordering, empty, ownership guard
  - [ ] Unit tests for `verifyConsultation` — success, already verified, not found
  - [ ] Unit tests for `rejectConsultation` — success, requires reason
  - [ ] Unit tests for `listVerifiedCounts` — correct aggregation
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Server Functions — Consultation CRUD' (Protocol in workflow.md)

## Phase 4: Server Functions — Gating Integration

- [ ] Task: Integrate gating check into submission flow
  - [ ] Update `submitCheckpointHandler` in `submissions.server.ts` — before allowing submission, query verified consultation count for the checkpoint and compare against `minConsultations`
  - [ ] Return descriptive error: "Checkpoint requires X verified consultations before submission (currently Y)"
- [ ] Task: Integrate gating into checkpoint unlock logic
  - [ ] The existing unlock logic (triggered when previous checkpoint is passed) already runs in `submitReviewHandler`. Add check: if `verifiedConsultations < minConsultations`, keep checkpoint state as `locked` with the unlock reason showing consultation requirement
  - [ ] The student assignment detail page already displays blocking reasons; ensure "insufficient consultations" reason is displayed for locked checkpoints
- [ ] Task: Write tests for gating logic
  - [ ] Unit test: submission blocked when insufficient verified consultations
  - [ ] Unit test: submission allowed when sufficient verified consultations
  - [ ] Unit test: unlock blocked when insufficient verified consultations
  - [ ] Unit test: unlock proceeds when sufficient verified consultations and previous checkpoint passed
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Server Functions — Gating Integration' (Protocol in workflow.md)

## Phase 5: Student UI — Consultation Tab

- [ ] Task: Create ConsultationForm component
  - [ ] Checkpoint selector dropdown (filtered to this assignment)
  - [ ] Session type radio/select (internal/external)
  - [ ] External consultant name input (shown conditionally)
  - [ ] Notes textarea
  - [ ] Form validation with Zod
  - [ ] Submit calls `logConsultation` server function
  - [ ] Loading, success, and error states
- [ ] Task: Create ConsultationList component
  - [ ] List of consultation records with status badges (pending/verified/rejected)
  - [ ] Display: checkpoint name, session type, notes preview, timestamp
  - [ ] Badge colors: pending=yellow, verified=green, rejected=red
  - [ ] Empty state when no consultations logged
  - [ ] Loading skeleton state
- [ ] Task: Create ConsultationProgress component
  - [ ] Per-checkpoint progress bar: "X/Y verified"
  - [ ] Color coding: full=green, partial=yellow, zero=gray
  - [ ] Display on checkpoint timeline cards
  - [ ] Assignment-level summary section
- [ ] Task: Integrate consultation tab into student assignment detail page
  - [ ] Add tab navigation to `src/routes/_authenticated/student/assignments/$id.tsx` (existing page)
  - [ ] Add "Consultations" tab alongside existing timeline/submission content
  - [ ] Tab contains ConsultationForm + ConsultationList + ConsultationProgress
  - [ ] Fetch verified counts on page load for progress display
- [ ] Task: Write tests for student consultation UI
  - [ ] Test ConsultationForm renders and validates
  - [ ] Test ConsultationList renders status badges correctly
  - [ ] Test ConsultationProgress displays correct ratio
- [ ] Task: Conductor - User Manual Verification 'Phase 5: Student UI — Consultation Tab' (Protocol in workflow.md)

## Phase 6: Instructor UI — Verification Tab

- [ ] Task: Create VerificationQueueItem component
  - [ ] Display: student name, checkpoint name, notes preview (truncated), session type, logged date
  - [ ] Click handler to open VerificationDialog
- [ ] Task: Create VerificationDialog component
  - [ ] Full consultation details: student name, checkpoint, session type, full notes, external consultant name, timestamp
  - [ ] Verify button — calls `verifyConsultation`, shows loading, closes on success
  - [ ] Reject button — expands inline text input for reason, calls `rejectConsultation`, closes on success
  - [ ] Error state display
- [ ] Task: Integrate verification tab into instructor assignment detail page
  - [ ] Add tab navigation to `src/routes/_authenticated/instructor/assignments/$id.tsx` (existing page)
  - [ ] Add "Consultations" tab alongside existing DeadlineManager section
  - [ ] Tab contains pending queue list (VerificationQueueItem components)
  - [ ] Re-fetch pending queue after verify/reject
  - [ ] Show count badge on tab: "Consultations (3)"
  - [ ] Empty state when no pending consultations
- [ ] Task: Write tests for instructor verification UI
  - [ ] Test VerificationDialog renders consultation details
  - [ ] Test verify and reject actions
- [ ] Task: Conductor - User Manual Verification 'Phase 6: Instructor UI — Verification Tab' (Protocol in workflow.md)

## Phase 7: i18n Translations

- [ ] Task: Add consultation translation keys to types
  - [ ] Update `src/i18n/types.ts` — add `consultations` section to `Translation` type
- [ ] Task: Add English translations to `locales/en.json`
  - [ ] Tab labels, form fields, status badges, progress display, verify/reject actions
  - [ ] Error messages, gating error messages, notification titles
- [ ] Task: Add Indonesian translations to `locales/id.json`
  - [ ] Same keys as English, translated to Indonesian
- [ ] Task: Update template form i18n for minConsultations field
  - [ ] Add `minConsultations` label and description to `adminTemplates.form`
- [ ] Task: Regenerate i18n types
  - [ ] Run `pnpm generate:i18n`
- [ ] Task: Conductor - User Manual Verification 'Phase 7: i18n Translations' (Protocol in workflow.md)

## Phase 8: Admin Template UI — minConsultations Field

- [ ] Task: Update template creation dialog
  - [ ] Add number input for `minConsultations` (default 0) to each checkpoint row
  - [ ] Label: "Min. Consultations"
  - [ ] Submit updated schema with minConsultations values
- [ ] Task: Update template edit sheet
  - [ ] Pre-fill minConsultations value when editing existing template
  - [ ] Same number input per checkpoint row
- [ ] Task: Write tests for template UI minConsultations
  - [ ] Test that minConsultations input renders in create dialog
  - [ ] Test that minConsultations pre-fills in edit sheet
- [ ] Task: Conductor - User Manual Verification 'Phase 8: Admin Template UI — minConsultations Field' (Protocol in workflow.md)
