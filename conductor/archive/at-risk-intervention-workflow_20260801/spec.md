# TRACK-050: At-Risk Intervention Workflow

## Overview

SIMAK currently identifies at-risk students using live risk signals but does not
record instructor responses. This feature adds a private, instructor-managed
intervention workflow so support actions, follow-up dates, and outcomes can be
tracked without changing the existing risk-scoring system.

This track depends on **TRACK-023: At-Risk Student Identification & Early
Warning System**.

## Goals

- Give instructors a structured record for responding to eligible at-risk
  students.
- Preserve live risk-factor context without persisting or altering risk
  assessments.
- Track support action, private notes, status, follow-up dates, and resolution
  reasons.
- Preserve privacy and authorization through assignment ownership and
  reassignment.
- Avoid duplicating existing consultation, extension, and discussion workflows.

## Functional Requirements

### FR-1: Intervention eligibility

1. An intervention may be created only for a student assigned to the current
   instructor.
2. The live risk assessment must contain at least one `student_inaction` factor:
   overdue work, an approaching deadline without a submission, insufficient
   consultations, or repeated revisions.
3. A `pending_review`-only assessment cannot create an intervention.
4. Risk factors are displayed as read-only context when viewing or creating an
   intervention.
5. An intervention does not automatically resolve when risk factors disappear.

### FR-2: Intervention record

Each intervention supports:

- student and assignment association;
- one action type: `consultation`, `extension`, `discussion`, or `other`;
- a private instructor note;
- status: `open`, `monitoring`, `resolved`, or `dismissed`;
- an optional follow-up date;
- a resolution or dismissal reason when closing the intervention; and
- immutable audit history retaining the original acting instructor.

Only one active intervention (`open` or `monitoring`) may exist for a
student-assignment pair. Resolved and dismissed records remain as history and
may be followed by a later intervention.

### FR-3: Status lifecycle

- `open` may transition to `monitoring`, `resolved`, or `dismissed`.
- `monitoring` may transition to `open`, `resolved`, or `dismissed`.
- `resolved` and `dismissed` are terminal.
- Resolving or dismissing requires a non-empty reason.
- Status changes and closure reasons are recorded in the immutable audit trail.

### FR-4: Instructor UI

1. Add a dedicated instructor intervention-management page.
2. Provide filters for intervention status and overdue follow-ups.
3. Show open and overdue follow-ups in instructor-facing dashboard and context
   views.
4. Provide contextual create/manage entry points from the at-risk dashboard
   widget and assignment/student context.
5. Display current risk factors, action type, note, status, follow-up date, and
   available status actions.
6. Link to existing consultation, extension, and discussion workflows rather
   than duplicating their actions.
7. Students and admins must not see intervention records, notes, reasons, or
   individual intervention details.

### FR-5: Reassignment-aware authorization

1. Authorization is based on the assignment's current instructor.
2. Reassigning an assignment transfers intervention access to the replacement
   instructor.
3. The former instructor loses access immediately after reassignment.
4. Reassignment does not rewrite historical audit actors.

### FR-6: Notifications and audit

- Follow-up dates do not generate new in-app or email notifications.
- Creation and lifecycle changes produce immutable audit events.
- Audit metadata retains the original actor while intervention private content
  remains unavailable through intervention access APIs to students and admins.

### FR-7: Technical and quality requirements

- Follow the client-safe stub/server-only handler split.
- Use server-side session, role, ownership, eligibility, and transition
  validation.
- Protect the active-record uniqueness invariant at the database level.
- Add bilingual English/Indonesian UI text and accessible keyboard and
  screen-reader behavior.
- Add unit and E2E coverage for eligibility, privacy, duplicates, transitions,
  reassignment, and overdue display.
- Pass typecheck, lint, formatting, i18n, accessibility, and coverage gates.

## Acceptance Criteria

- An eligible current instructor can create and manage an intervention for an
  assigned student.
- A pending-review-only risk is rejected.
- Cross-instructor, student, and admin access is denied.
- A second active intervention for the same student-assignment pair is rejected.
- Risk context is visible and remains live and read-only.
- Resolution and dismissal require reasons and create audit events.
- Closed interventions remain historical; active interventions do not
  auto-resolve.
- Reassignment transfers access and removes former-instructor access.
- Open and overdue follow-ups are visible to the current instructor without
  notifications.
- Existing consultation, extension, discussion, and risk-scoring behavior
  remains unchanged.

## Out of Scope

- Student-visible risk labels or intervention plans.
- Admin case-management access.
- Automated follow-up notifications.
- Cross-assignment student case files.
- Escalation chains or institutional counseling integrations.
- Automatic intervention resolution.
- Reimplementation of consultation, extension, or discussion actions.
