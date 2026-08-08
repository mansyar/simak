# TRACK-058: Consultation Scheduling & Advising Calendar

## Overview

**Type:** Feature
**Dependencies:** TRACK-055 (student timezone/private iCalendar), TRACK-057 (academic context and section-aware authorization)

SIMAK currently records consultations only after they occur. Students submit checkpoint-linked consultation evidence, and instructors verify or reject it. There is no bounded way to publish appointment times, book a consultation, prevent overlapping bookings, cancel or reschedule appointments, or notify participants.

This track adds one-off instructor appointment slots and direct student booking while keeping scheduled appointments separate from the existing consultation evidence and checkpoint-gating workflow.

## Functional Requirements

### FR-1: Appointment domain

1. Add a separate appointment model; do not repurpose the existing `consultations` record lifecycle.
2. Each appointment/slot must have an instructor, assignment, optional checkpoint, optional student until booking, UTC start/end instants, lifecycle status, and created/updated timestamps.
3. Initial statuses are `available`, `booked`, `cancelled`, `completed`, and `no_show`.
4. Rescheduling changes the appointment time while retaining the appointment identity and audit history.
5. Enforce a bounded one-off duration of 15–120 minutes. Recurring slots are not supported.

### FR-2: Instructor slot management

1. An authorized instructor can publish individual future slots for an active assignment they own/manage.
2. The instructor can list slots with status, assignment, optional checkpoint, student, and local-time display.
3. The instructor can cancel an unbooked slot or a booked appointment.
4. The instructor can reschedule a future booked appointment when the new time passes all conflict checks.
5. Past appointments cannot be booked or rescheduled.
6. Slot creation, cancellation, and rescheduling must be auditable.

### FR-3: Student eligibility and booking

1. A student can see available slots only for assignments where they have active `assignment_students` membership and the assignment is active.
2. A student can book an available slot directly; a successful booking becomes `booked` immediately.
3. A student may optionally select a checkpoint from the same assignment.
4. A student may cancel or reschedule their own future appointment using another available slot for the same assignment.
5. A student cannot book appointments for another student, another assignment, an inactive assignment, or an unrelated checkpoint.
6. Instructor and student access must use server-side session, role, assignment ownership, and enrollment checks; client filtering is not an authorization boundary.

### FR-4: Conflict-safe booking and rescheduling

1. Booking must be transactional and lock/recheck the slot before changing it.
2. At most one student can successfully book a slot when concurrent requests race.
3. The system must reject overlapping future non-cancelled appointments for the instructor or student.
4. Rescheduling must lock the affected appointment and target slot before applying changes.
5. A rejected conflict must leave the original appointment unchanged.
6. Cancelled appointments must not reserve time or block future conflict checks.

### FR-5: Appointment lifecycle

1. A booked appointment can be cancelled before its start time by the student or instructor.
2. A booked appointment can be rescheduled before its start time by the student or instructor, subject to conflict checks.
3. After the scheduled end, the instructor can mark the appointment `completed` or `no_show`.
4. No formal attendance scoring, penalty, or attendance report is created.
5. Appointment state transitions must reject stale or invalid transitions and preserve an immutable audit trail.
6. Cancellation and rescheduling must notify affected participants without exposing private consultation notes.

### FR-6: Explicit consultation evidence linkage

1. Completing an appointment must not automatically create a consultation evidence record.
2. The UI may provide an explicit “Record consultation” action from a completed appointment.
3. That explicit action may prefill the existing consultation form and create a normal `pending` consultation record.
4. Existing instructor verification/rejection, verified-count calculation, checkpoint gating, and consultation audit behavior remain authoritative and unchanged.
5. Appointment cancellation, no-show, or deletion must never create, delete, or change a verified consultation.

### FR-7: Timezone-aware presentation

1. Store appointment instants in UTC.
2. Render appointment dates/times using the existing student IANA timezone preference and the appropriate instructor timezone/display convention.
3. Handle DST transitions without changing stored instants or producing ambiguous client/server hydration output.
4. Use bilingual, locale-aware date/time labels.
5. Show clear timezone context near appointment times when it prevents ambiguity.

### FR-8: Notifications and reminders

1. Send preference-aware in-app and email notifications for successful booking, cancellation, rescheduling, and completion/no-show where appropriate.
2. Send fixed reminders approximately 24 hours and 1 hour before a booked appointment.
3. Reminder delivery must be deduplicated and safe across repeated scanner runs.
4. Reminder scanning must reuse the existing background/email-queue processing boundary and isolate failures from the primary request.
5. Notifications must identify the assignment and appointment time but must not include consultation notes or sensitive tokens.

### FR-9: Private iCalendar integration

1. Extend the existing student private iCalendar feed to include the student’s future `booked` appointments.
2. Use a stable appointment-based UID so rescheduling updates the same event.
3. Cancelled appointments must no longer be emitted.
4. Feed output must use safe RFC 5545 serialization and UTC instants.
5. Existing deadline events, token lifecycle, ownership checks, rate limiting, cache headers, and token secrecy must remain unchanged.
6. No OAuth, calendar write-back, two-way sync, or external calendar provider integration is added.

### FR-10: User interface

1. Provide mobile-friendly appointment views for instructor assignment scheduling and student assignment booking/management.
2. Provide loading, empty, error, conflict, and unavailable-slot states.
3. Use existing shadcn/Base UI primitives, semantic status colors, confirmation for destructive actions, inline validation, and touch targets of at least 44px.
4. Add every user-visible string to both English and Indonesian locale sources and regenerate i18n types.
5. Preserve dark-mode behavior and WCAG 2.1 AA keyboard, focus, labeling, and contrast requirements.

## Non-Functional Requirements

- **NFR-1 — Security:** All mutations and reads are server-authorized; unauthorized requests return generic non-enumerating errors.
- **NFR-2 — Consistency:** Booking and rescheduling use database transactions and locking for race-safe conflict enforcement.
- **NFR-3 — Compatibility:** Existing post-hoc consultation logging, verification, verified counts, and checkpoint gating are behaviorally unchanged.
- **NFR-4 — Architecture:** Use client-safe `*.ts` stubs and server-only `*.server.ts` handlers through `typedServerFn`; keep each source/test file below 500 lines.
- **NFR-5 — Privacy and audit:** Preserve soft-delete/state-history conventions; audit actor, action, appointment, and relevant before/after values without recording tokens or consultation notes.
- **NFR-6 — Reliability:** Reminder and email failures are advisory, retryable, observable, and cannot fail booking/cancellation transactions after the appointment mutation succeeds.
- **NFR-7 — Performance:** Appointment list queries are paginated or bounded and indexed for participant, assignment, status, and time-range lookups.
- **NFR-8 — Quality:** New code follows TDD, maintains at least 80% coverage, and passes the repository’s typecheck, lint, formatting, i18n, accessibility, and relevant integration/E2E checks.

## Acceptance Criteria

- Instructors can create, list, cancel, and reschedule bounded one-off slots for authorized active assignments.
- Eligible students can see only their assignment’s available slots and can book one successfully.
- Concurrent booking attempts result in exactly one successful booking.
- Instructor and student overlapping appointments are rejected without mutating an existing appointment.
- Cancellation, rescheduling, completion, and no-show transitions enforce valid timing and status rules.
- All appointment times remain correct across UTC conversion, user timezone changes, and DST boundaries.
- Appointment completion does not increase verified consultation counts until the user explicitly records and an instructor verifies consultation evidence.
- Booking, cancellation, rescheduling, completion/no-show, and reminder behavior is covered by focused unit/integration tests.
- Repeated reminder scans do not duplicate reminders or emails, and user notification preferences are respected.
- The private student iCalendar feed includes booked appointments with stable UIDs and removes cancelled events without exposing credentials.
- Existing deadline feed events and consultation gating tests continue to pass.
- New UI is bilingual, accessible, responsive, dark-mode compatible, and free of hardcoded user-visible strings.
- Focused tests, full unit tests, typecheck, lint, formatting, i18n parity, and relevant E2E/accessibility checks pass at the phase checkpoints required by `workflow.md`.

## Out of Scope

- Recurring availability or recurring appointments.
- General institutional/resource/room calendars.
- Group advising or multi-student appointments.
- External counselors or external participant accounts.
- OAuth, Google/Microsoft calendar integration, calendar invitations, or two-way synchronization.
- Automatic creation, deletion, or verification of consultation evidence.
- Changes to consultation verification or checkpoint gating semantics.
- Formal attendance management, attendance scoring, or attendance reports.
- Transcript/GPA, institutional reporting, scheduled report delivery, or persisted risk history.
- Admin-wide appointment administration beyond existing server-side ownership/audit requirements.
- A replacement for the existing private calendar-token lifecycle or deadline reminder system.
