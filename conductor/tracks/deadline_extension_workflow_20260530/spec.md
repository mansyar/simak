# Track 1.3 — Deadline Extension Workflow

## Overview

Implement a two-path deadline extension system:

1. **Student-Initiated:** Students request extensions with reason categories (Personal, Research, Health, Other) and a proposed duration. Instructors approve/reject with optional comment.
2. **Instructor-Initiated:** Direct bulk extension of all unfinished checkpoints for a student +N days with reason capture.

Both paths write to the audit log. Auto-adjustment extends subsequent checkpoints and assignment finalDeadline on approval. Admin-configurable caps: `maxExtensionDays` (1–30, default 7) and `maxTotalExtensions` (1–10, default 3).

**Dependencies:** Track 1.1 (audit log), Track 1.2 (dueDates must exist before extension is meaningful).

---

## Database Changes

### New Table: `extension_requests`

| Column             | Type                                | Notes                                                                  |
| ------------------ | ----------------------------------- | ---------------------------------------------------------------------- |
| id                 | serial (PK)                         |                                                                        |
| assignment_id      | integer (FK → assignments, CASCADE) | NOT NULL                                                               |
| student_id         | text (FK → users)                   | NOT NULL                                                               |
| checkpoint_id      | integer (FK → checkpoints)          | NULLABLE — which checkpoint is affected                                |
| requested_deadline | timestamp, not null                 | Proposed new deadline                                                  |
| reason             | text, not null                      | Student's explanation                                                  |
| category           | text, not null                      | `personal` \| `research` \| `health` \| `other`                        |
| extension_days     | integer, not null                   | CHECK (1–30)                                                           |
| status             | text, not null                      | `pending` \| `approved` \| `rejected`                                  |
| resolved_by        | text (FK → users)                   | NULLABLE — instructor who acted                                        |
| resolution_reason  | text                                | NULLABLE — instructor's comment (required for rejection, min 20 chars) |
| created_at         | timestamp                           | DEFAULT NOW()                                                          |
| resolved_at        | timestamp                           | NULLABLE                                                               |

Index on `(assignment_id, status)` for instructor queue queries.

### Modified: `assignments` (add columns)

| Column               | Type               | Notes                               |
| -------------------- | ------------------ | ----------------------------------- |
| max_extension_days   | integer, default 7 | Admin cap per request, CHECK (1–30) |
| max_total_extensions | integer, default 3 | Cap per assignment, CHECK (1–10)    |

### Migration

- Drizzle migration for new `extension_requests` table + columns on `assignments`

---

## Server Functions

### New: `src/server/extensions.ts` (client-safe stubs + Zod schemas)

| Schema                        | Fields                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| `RequestExtensionSchema`      | assignmentId, checkpointId (nullable), category, reason (min 10), extensionDays (1–max_extension_days) |
| `ListExtensionRequestsSchema` | assignmentId, status (optional filter), page, limit                                                    |
| `ApproveExtensionSchema`      | requestId, resolutionReason (optional)                                                                 |
| `RejectExtensionSchema`       | requestId, resolutionReason (required, min 20)                                                         |
| `BulkExtendSchema`            | assignmentId, studentId, extraDays (positive int), reason                                              |

### New: `src/server/extensions.server.ts` (handlers)

| Handler                        | Behavior                                                                                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `requestExtensionHandler`      | Validates caps (max days, max total pending/approved), creates request, sends notification to instructor                                                     |
| `listPendingExtensionsHandler` | Lists pending requests for an assignment (instructor-only, ownership-guarded)                                                                                |
| `approveExtensionHandler`      | Sets status=approved, extends affected checkpoint + subsequent checkpoints + finalDeadline, logs `deadline.extension_approved` audit event, notifies student |
| `rejectExtensionHandler`       | Sets status=rejected with reason, logs `deadline.extension_rejected` audit event, notifies student                                                           |
| `bulkExtendHandler`            | Directly extends all unfinished checkpoints for a student by +N days (instructor-only), logs `deadline.extended` audit event per extension                   |

### Modified: Existing handlers

| Handler                                           | Change                                        |
| ------------------------------------------------- | --------------------------------------------- |
| `extendDeadlineHandler` (assignments.server.ts)   | Wire to audit log: logs `deadline.extended`   |
| `unlockCheckpointHandler` (assignments.server.ts) | Wire to audit log: logs `checkpoint.unlocked` |

---

## UI Components

### Student: Extension Request Tab (on `/student/assignments/$id`)

- New tab/page section in the assignment detail view
- **Extension Request Form:**
  - Category dropdown: Personal, Research, Health, Other
  - Reason textarea (min 10 characters)
  - Duration input (1–30, capped by `maxExtensionDays`)
  - Optional checkpoint selector (defaults to current active checkpoint)
- **Extension History List:**
  - Table showing past requests: date, category, duration, status badge (pending/approved/rejected), resolution
  - Status badges: pending=yellow, approved=green, rejected=red

### Instructor: Extension Queue (in DeadlineManager on `/instructor/assignments/$id`)

- **Pending Extensions Section** within the existing collapsible DeadlineManager:
  - Count badge on section header showing pending count
  - FIFO list of pending requests per student
  - Each item: student name, checkpoint, category, reason, duration, timestamp
  - Approve/Reject buttons → opens confirmation dialog
- **Approve Dialog:** Optional comment textarea
- **Reject Dialog:** Required reason textarea (min 20 chars), with character count
- **Bulk Extend Controls:** Per-student input: +N days input + reason textarea → Apply button

---

## Notification Events

| Event                 | Trigger                 | Recipient                |
| --------------------- | ----------------------- | ------------------------ |
| `extension_requested` | Student submits request | Assignment instructor(s) |
| `extension_approved`  | Instructor approves     | Requesting student       |
| `extension_rejected`  | Instructor rejects      | Requesting student       |

---

## Acceptance Criteria

- [ ] Admin can configure max extension days (1–30, default 7) and max total extensions (1–10, default 3) per assignment
- [ ] Student can submit extension request with reason category, custom reason, and duration (1–max_extension_days)
- [ ] Cap validation rejects requests exceeding max_extension_days or max_total_extensions
- [ ] Instructor sees pending extension requests queue (per assignment, FIFO)
- [ ] Instructor can approve request → auto-extends affected checkpoint + subsequent checkpoints + finalDeadline; `deadline.extension_approved` logged to audit log
- [ ] Instructor can reject request with required reason (min 20 chars); `deadline.extension_rejected` logged
- [ ] Student notified when request is approved or rejected (in-app notification)
- [ ] Instructor can directly extend all unfinished checkpoints for a student by N days (bulk, bypassing request); `deadline.extended` logged
- [ ] Existing `extendDeadlineHandler` writes `deadline.extended` to audit log
- [ ] Existing `unlockCheckpointHandler` writes `checkpoint.unlocked` to audit log
- [ ] Student can see extension history on their assignment detail page
- [ ] i18n translations for extension request form, queue, approval dialog, and notifications

---

## Out of Scope (v2 of this feature)

- Admin-level overrides of caps (caps are set per-assignment during creation)
- Email notifications for extension events (in-app only)
- Extension request editing/cancellation by student

---

## Test Plan

| Area                     | Approach                                                                                       |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| Extension request schema | Unit test — Zod validation for request input                                                   |
| Request handler          | Unit test — creates request, validates caps, sends notification                                |
| Approval handler         | Unit test — approves, extends checkpoints, writes audit log entry                              |
| Rejection handler        | Unit test — rejects with reason, writes audit log entry                                        |
| Bulk extension           | Unit test — extends all unfinished checkpoints, writes audit log entries                       |
| Audit log wiring         | Unit test — existing handlers (extendDeadline, unlockCheckpoint) produce correct audit entries |
| UI — request form        | Unit test — form renders, validation works, submission fires mutation                          |
| UI — instructor queue    | Unit test — pending list renders, approve/reject actions work                                  |
