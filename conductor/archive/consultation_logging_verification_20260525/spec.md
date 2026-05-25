# Track 6.1 — Consultation Logging & Verification

## Overview

Implement the consultation tracking system (Kartu Bimbingan) allowing students to log supervision sessions tied to specific checkpoints, and instructors to verify or reject them. Verified consultations count toward the `minConsultations` threshold that gates checkpoint unlock and submission.

## Dependencies

- Track 3.1/3.2 — Assignment creation and student viewing (checkpoint structure exists)
- Track 2.2 — Assignment Templates (needs `minConsultations` column added to template checkpoints)
- Track 4.1 — Submission flow (needs gating integration)
- Existing `consultations` table in DB schema (already created in Track 1.2)

## Database Changes

### New Migration: Add `minConsultations` to `template_checkpoints`

Add column `min_consultations` (integer, default 0) to the `template_checkpoints` table.

### Schema Update (`src/db/schema/templates.ts`)

Add `minConsultations: integer('min_consultations').default(0)` to `templateCheckpoints`.

## Functional Requirements

### FR1: Student Logs a Consultation

- Student can log a consultation from a tab/section on the existing assignment detail page (`/student/assignments/$id`)
- Form fields:
  - **Checkpoint selector** — dropdown of checkpoints in this assignment
  - **Session type** — `internal` (system instructor) or `external` (guest supervisor)
  - **External consultant name** — free-text field, shown only when session type is `external`
  - **Notes** — free-text field for session notes
- All fields required except external consultant name (conditionally required based on type)
- On submit: creates record in `consultations` table with status `pending`

### FR2: Consultation List (Student View)

- Tab/section on `/student/assignments/$id` showing all logged consultations
- Each item displays: checkpoint name, session type, external consultant name (if external), notes, status badge (pending/verified/rejected), timestamp
- Badge colors: pending = yellow, verified = green, rejected = red
- Ordered by newest first

### FR3: Consultation Progress Display

- Progress bar per checkpoint showing "X/Y verified" where Y = `minConsultations` value
- Visible on the checkpoint timeline cards on the student assignment detail page
- Assignment-level summary showing total verified vs required across all checkpoints
- Only `verified` consultations count toward the progress

### FR4: Instructor Verification Queue

- Tab on `/instructor/assignments/$id` showing all pending consultations across students for that assignment
- Each queue item shows: student name, checkpoint name, notes preview (truncated), session type, logged date
- Ordered by oldest first (FIFO)
- Clicking an item opens a verification dialog

### FR5: Instructor Verification Dialog

- Dialog/modal showing full consultation details:
  - Student name, checkpoint, session type, full notes
  - External consultant name (if applicable)
  - Timestamp
- Two action buttons:
  - **Verify** — sets status to `verified`, sets `verifiedById` to current instructor, sets `verifiedAt` timestamp
  - **Reject** — prompts for a reason (text input), sets status to `rejected`
- On verify/reject: re-fetches pending queue and updates progress displays

### FR6: Gating Integration — Submission Check

- `submitCheckpoint` handler in `src/server/submissions.server.ts` must check:
  - Before allowing submission, verify `count of verified consultations >= checkpoint.minConsultations`
  - If insufficient, return error: `"Checkpoint requires X verified consultations before submission (currently Y)"`

### FR7: Gating Integration — Checkpoint Unlock

- The checkpoint unlock logic (when previous checkpoint is passed) must also check `verified consultations >= minConsultations`
- If insufficient, checkpoint remains `locked` and displays reason: "Requires X/Y verified consultations"

### FR8: Template `minConsultations`

- Admin template creation/edit dialog: each checkpoint row gains a number input for `minConsultations` (default 0)
- When creating an assignment from a template, the `minConsultations` value is copied from `template_checkpoints` to each `checkpoint` row
- Update Zod schemas for template CRUD to include the new field

### FR9: In-App Notifications

- **Consultation logged** → notification to the assignment's instructor
- **Consultation verified** → notification to the student
- **Consultation rejected** → notification to the student (with reason)

## Server Functions

### `src/server/consultations.ts` (client stubs) + `src/server/consultations.server.ts` (handlers)

| Function                   | Method | Description                                                       |
| -------------------------- | ------ | ----------------------------------------------------------------- |
| `logConsultation`          | POST   | Student creates a consultation record                             |
| `listConsultations`        | GET    | List consultations for a checkpoint/assignment (student view)     |
| `getConsultationDetail`    | GET    | Full consultation details (for verification dialog)               |
| `listPendingConsultations` | GET    | Instructor's pending queue for an assignment                      |
| `verifyConsultation`       | POST   | Instructor marks as verified                                      |
| `rejectConsultation`       | POST   | Instructor rejects with reason                                    |
| `listVerifiedCounts`       | GET    | Return verified count per checkpoint (used for gating & progress) |

### Modified Server Functions

- `src/server/submissions.server.ts` — `submitCheckpointHandler` gains consultation gating check
- `src/server/templates.ts` + `templates.server.ts` — Zod schemas and handlers updated for `minConsultations`
- `src/server/assignments.server.ts` — `createAssignment` copies `minConsultations` from template

## Components to Create

| Component               | Path                                                       | Description                                            |
| ----------------------- | ---------------------------------------------------------- | ------------------------------------------------------ |
| `ConsultationForm`      | `src/components/consultations/consultation-form.tsx`       | Log form with checkpoint selector, session type, notes |
| `ConsultationList`      | `src/components/consultations/consultation-list.tsx`       | List with status badges for student view               |
| `ConsultationProgress`  | `src/components/consultations/consultation-progress.tsx`   | Progress bar showing X/Y verified                      |
| `VerificationQueueItem` | `src/components/consultations/verification-queue-item.tsx` | Pending item row for instructor queue                  |
| `VerificationDialog`    | `src/components/consultations/verification-dialog.tsx`     | Full details with verify/reject actions                |

## Route Changes (No New Routes)

- `src/routes/_authenticated/student/assignments/$id.tsx` — Add consultation tab section (alongside checkpoint timeline)
- `src/routes/_authenticated/instructor/assignments/$id.tsx` — Add consultation verification tab (alongside DeadlineManager)

## i18n Translations

Add consultation section to `locales/en.json` and `locales/id.json` covering:

- Tab labels, form fields, status badges, progress display, verify/reject actions, error messages, notification titles

## Non-Functional Requirements

- All server functions must verify role-based access (student for logging, instructor for verification)
- Ownership validation: students can only log consultations for their own assignments
- Gating logic must use verified count only (pending/rejected do not count)
- Progress bars update reactively on verify/reject actions

## Acceptance Criteria

- [ ] Student can log a consultation tied to a specific checkpoint with session type and notes
- [ ] Logged consultation shows "pending" badge
- [ ] Student's progress bar shows "0/Y verified" after logging
- [ ] Instructor sees pending consultations in the assignment detail tab
- [ ] Clicking a pending item opens verification dialog with full details
- [ ] Verifying a consultation changes status to "verified" and increments the progress bar
- [ ] Rejecting a consultation shows a reason input and sets status to "rejected"
- [ ] Verified consultations >= minConsultations allows checkpoint submission
- [ ] Insufficient verified consultations blocks submission with clear error message
- [ ] Admin can set minConsultations when creating/editing a template checkpoint
- [ ] Creating an assignment copies minConsultations from template to each checkpoint
- [ ] In-app notifications created for log/verify/reject events

## Out of Scope (v2)

- Email notifications for consultation events
- File attachments on consultation logs
- Recurring/scheduled consultation sessions
- Bulk verify/reject operations
