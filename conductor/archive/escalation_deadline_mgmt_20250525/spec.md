# Track 5.2 — Escalation & Deadline Management

## Overview

Building on Track 5.1 (Review Queue & Decision), this track implements the escalation and deadline management layer. When an instructor exceeds the 3-day SLA for reviewing a submission, the system automatically (1) sends an `sla_breach` notification (in-app + email) to all Admins, and (2) extends the student's subsequent checkpoint deadlines by the breach duration. Instructors additionally gain manual controls to unlock overdue checkpoints and extend individual checkpoint due dates from the assignment detail page.

## Dependencies

- Track 5.1 (Review Queue & Decision) — review system with SLA badges must be operational
- Database tables: `checkpoints` (with `state`, `dueDate`), `reviews` (with `reviewedAt`), `notifications` (with `type`, `channel`, `metadata`)

## Functional Requirements

### FR-1: SLA Breach Detection & Notification

- **When:** A submission transitions to `under_review` state. The system checks if the review is completed (`reviewedAt` is set) within 3 calendar days (72 hours). If not, an `sla_breach` event is triggered.
- **How:** The SLA breach check occurs **as part of the `submitReview` handler** — after a review is submitted, the system calculates the breach duration (time since the checkpoint transitioned to `under_review` minus 3 days) ONLY if the review was late.
- **In-app notification:** One `notifications` row per Admin user with `type: 'sla_breach'`, `channel: 'in_app'`, containing assignment title, student name, checkpoint name, and breach duration in metadata.
- **Email notification:** A `notifications` row per Admin with `channel: 'email'`, and an email sent via Resend with a SIMAK-branded template to each Admin.

### FR-2: Automatic Deadline Adjustment

- **When:** A review is completed late (after the 3-day SLA has passed).
- **What extends:** The breach duration (actual review time minus 3 days) is added to:
  1. The affected checkpoint's `dueDate`
  2. All subsequent checkpoints' `dueDate` values for that specific student (ordered by `checkpoints.order`)
  3. The assignment's `finalDeadline`
- **Scope:** Adjustments are per-student — only the student whose submission was delayed gets the extension. Other students' deadlines remain unchanged.
- **Implementation:** Deadline adjustment runs inside the `submitReview` transaction (same as FR-1).

### FR-3: Manual Checkpoint Unlock (Instructor)

- **Who:** Instructors can unlock checkpoints only for assignments they created.
- **What it does:** Transitions a checkpoint from `locked` to `unlocked`, regardless of its blocking reasons (previous checkpoint not passed, insufficient consultations).
- **Where:** Via the Deadline Manager section on the assignment detail page (`/instructor/assignments/$id`).
- **Safety:** The instructor must confirm the unlock action (dialog with warning).
- **Audit:** The `updatedAt` timestamp on the checkpoint is updated.

### FR-4: Deadline Extension (Instructor)

- **Who:** Instructors can extend due dates for checkpoints in assignments they created.
- **What they can extend:** Any checkpoint's `dueDate` for any student assigned to the assignment.
- **Where:** Via the Deadline Manager section on the assignment detail page.
- **Validation:** New deadline must be later than the current date.
- **Reflection:** Changes reflect immediately — the student sees the updated due date when viewing the assignment detail page.

## Non-Functional Requirements

- **SLA calculation:** Uses calendar days (not business days). 3 days = 72 hours from the `updatedAt` timestamp when the checkpoint transitioned to `under_review`.
- **Breach precision:** Breach duration is calculated in milliseconds and converted to whole days (rounded down) for deadline adjustment.
- **Notifications are advisory:** SLA breach notifications inform the Admin but do not automatically block or change any system behavior beyond the deadline adjustment.
- **Authorization:** All manual unlock and extend operations check assignment ownership before applying changes.

## Acceptance Criteria

- [ ] When a review is completed after 3+ days in `under_review`, an `sla_breach` in-app notification appears in each Admin's notification center
- [ ] An SLA breach email is sent to all Admins via Resend with relevant details
- [ ] The student's checkpoint `dueDate` values (affected + all subsequent) are extended by the breach duration
- [ ] The assignment's `finalDeadline` is extended by the breach duration
- [ ] Instructor can unlock an overdue (locked) checkpoint from the assignment detail page with confirmation
- [ ] Instructor can extend a specific checkpoint's due date for any student in their assignment
- [ ] Unauthenticated or unauthorized users cannot access unlock/extend operations
- [ ] Instructors can only modify checkpoints in their own assignments
- [ ] Deadline extension changes reflect immediately in the student's view
- [ ] Manual unlock transitions checkpoint from `locked` to `unlocked` regardless of blocking reasons

## Out of Scope

- Configurable SLA duration (hardcoded to 3 days for v1)
- Business-day SLA calculation (uses calendar days)
- Bulk unlock/extend operations (per-checkpoint, per-student only)
- Email delivery for notifications other than sla_breach (email notification queue is v2)
