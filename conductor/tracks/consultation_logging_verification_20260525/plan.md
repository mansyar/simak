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

## Phase 2: Server Functions — Templates Update [checkpoint: cd331f6]

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
- [x] Task: Conductor - User Manual Verification 'Phase 2: Server Functions — Templates Update' (Protocol in workflow.md)

## Phase 3: Server Functions — Consultation CRUD [checkpoint: 19ec848]

- [x] Task: Create Zod schemas and server function stubs (`src/server/consultations.ts`) (014e2ec)
  - [x] Define `LogConsultationSchema` (checkpointId, sessionType, externalConsultantName optional, notes)
  - [x] Define `ListConsultationsSchema` (assignmentId, checkpointId optional)
  - [x] Define `ListPendingConsultationsSchema` (assignmentId)
  - [x] Define `VerifyConsultationSchema` (consultationId)
  - [x] Define `RejectConsultationSchema` (consultationId, reason)
  - [x] Define `GetConsultationDetailSchema` (consultationId)
  - [x] Define `ListVerifiedCountsSchema` (assignmentId)
  - [x] Create server function stubs with dynamic imports (`logConsultation`, `listConsultations`, `listPendingConsultations`, `verifyConsultation`, `rejectConsultation`, `getConsultationDetail`, `listVerifiedCounts`)
- [x] Task: Implement server-only handlers (`src/server/consultations.server.ts`) (014e2ec)
  - [x] `logConsultationHandler` — Validate student ownership via assignmentStudents, insert consultation with status `pending`, create notification for instructor
  - [x] `listConsultationsHandler` — Fetch consultations for student's assignment, newest first, role-aware (student sees own, instructor sees all)
  - [x] `listPendingConsultationsHandler` — Fetch pending consultations across all students for an instructor's assignment, oldest first (FIFO)
  - [x] `getConsultationDetailHandler` — Full consultation details with student name, checkpoint info
  - [x] `verifyConsultationHandler` — Update status to `verified`, set `verifiedById`, `verifiedAt`, create notification for student
  - [x] `rejectConsultationHandler` — Update status to `rejected`, set rejection reason, create notification for student
  - [x] `listVerifiedCountsHandler` — Aggregate query returning `{ checkpointId, verifiedCount, minConsultations }` per checkpoint
- [x] Task: Write tests for consultation server functions (014e2ec)
  - [x] Unit tests for `logConsultation` — success, unauthorized, wrong role, invalid checkpoint
  - [x] Unit tests for `listConsultations` — student view, instructor view, empty
  - [x] Unit tests for `listPendingConsultations` — FIFO ordering, empty, ownership guard
  - [x] Unit tests for `verifyConsultation` — success, already verified, not found
  - [x] Unit tests for `rejectConsultation` — success, requires reason
  - [x] Unit tests for `listVerifiedCounts` — correct aggregation
- [x] Task: Conductor - User Manual Verification 'Phase 3: Server Functions — Consultation CRUD' (Protocol in workflow.md)

## Phase 4: Server Functions — Gating Integration [checkpoint: 0d5250c]

- [x] Task: Integrate gating check into submission flow (0d5250c)
  - [ ] Update `submitCheckpointHandler` in `submissions.server.ts` — before allowing submission, query verified consultation count for the checkpoint and compare against `minConsultations`
  - [ ] Return descriptive error: "Checkpoint requires X verified consultations before submission (currently Y)"
- [x] Task: Integrate gating into checkpoint unlock logic (0d5250c)
  - [x] The existing unlock logic (triggered when previous checkpoint is passed) already runs in `submitReviewHandler`. Add check: if `verifiedConsultations < minConsultations`, keep checkpoint state as `locked` with the unlock reason showing consultation requirement
  - [x] The student assignment detail page already displays blocking reasons; ensure "insufficient consultations" reason is displayed for locked checkpoints
- [x] Task: Write tests for gating logic (0d5250c)
  - [x] Unit test: submission blocked when insufficient verified consultations
  - [x] Unit test: submission allowed when sufficient verified consultations
  - [x] Unit test: unlock blocked when insufficient verified consultations
  - [x] Unit test: unlock proceeds when sufficient verified consultations and previous checkpoint passed
- [x] Task: Conductor - User Manual Verification 'Phase 4: Server Functions — Gating Integration' (Protocol in workflow.md)

## Phase 5: Student UI — Consultation Tab

- [x] Task: Create ConsultationForm component (1b960aa)
- [x] Task: Create ConsultationList component (1b960aa)
- [x] Task: Create ConsultationProgress component (1b960aa)
- [x] Task: Integrate consultation tab into student assignment detail page (1b960aa)
- [x] Task: Write tests for student consultation UI (1b960aa)
- [x] Task: Conductor - User Manual Verification 'Phase 5: Student UI — Consultation Tab' (Protocol in workflow.md)

## Phase 6: Instructor UI — Verification Tab

- [x] Task: Create VerificationQueueItem component (6124545)
- [x] Task: Create VerificationDialog component (6124545)
- [x] Task: Integrate verification tab into instructor assignment detail page (6124545)
- [x] Task: Write tests for instructor verification UI (6124545)
- [x] Task: Conductor - User Manual Verification 'Phase 6: Instructor UI — Verification Tab' (Protocol in workflow.md)

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

- [x] Task: Update template creation dialog (4ac6c82)
- [x] Task: Update template edit sheet (4ac6c82)
- [x] Task: Write tests for template UI minConsultations (4ac6c82)
- [x] Task: Conductor - User Manual Verification 'Phase 8: Admin Template UI — minConsultations Field' (Protocol in workflow.md)

## Phase: Review Fixes
- [x] Task: Apply review suggestions (e8e4c6e)
