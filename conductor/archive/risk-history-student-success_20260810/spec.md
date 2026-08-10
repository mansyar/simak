# Specification: TRACK-062 — Risk History & Student Success

## Overview

SIMAK currently calculates student risk from live academic workflow data and lets
the current assignment instructor manage private interventions. The calculation
is intentionally ephemeral, so authorized users cannot inspect a trustworthy
history of assessments or measure whether support actions correspond with
academic progress and engagement.

This track adds a privacy-preserving, explainable history of risk observations
and intervention outcomes. It records only deliberate lifecycle observations and
daily snapshots; it does not persist dashboard page-load calculations or change
the existing risk engine.

**Type:** Feature

**Dependencies:** TRACK-023 (At-Risk Student Identification & Early Warning
System), TRACK-050 (At-Risk Intervention Workflow)

**Coordinating tracks:** TRACK-057 (Academic Context & Semester Foundation),
TRACK-058 (Consultation Scheduling & Advising Calendar), TRACK-061
(Institutional Reporting & Secure Delivery)

## Confirmed Decisions

- Persist observations for meaningful lifecycle events and one daily snapshot of
  active student assignments; never for a dashboard/API page load.
- Retain identifiable observation detail for five academic years, then remove
  identifying and student-linked detail while retaining only non-identifying
  aggregate trend data.
- Students receive an actionable support status and next steps only. They never
  receive risk scores, internal factor details, private intervention notes, or
  other students' data.
- Admin aggregates are visible only for cohorts containing at least ten
  students. No aggregate drill-down may defeat this threshold.
- Outcomes cover academic progress (checkpoint, submission, and review
  progress) and engagement (consultation completion and intervention follow-up).
- Recording history creates no new notifications and never autonomously changes
  grades, enrollment, deadlines, checkpoints, or intervention state.

## Goals

1. Preserve deterministic, historically explainable risk assessments without
   duplicating or changing `computeStudentRisk`.
2. Let the authorized current instructor inspect a student's assignment-scoped
   history and intervention-linked outcomes, including after reassignment.
3. Give administrators only privacy-safe institutional trends and give students
   a constructive, non-stigmatizing support view.
4. Apply durable retention, audit, authorization, and cohort-suppression rules.

## Functional Requirements

### FR-1: Immutable risk observations

1. Each observation records its source (meaningful lifecycle event or daily
   snapshot), calculation timestamp, risk level, scoring algorithm version,
   factor codes, and explanation/context snapshot required to interpret it after
   the algorithm evolves.
2. An observation is tied to the applicable student, assignment, academic
   context, and relevant checkpoint/intervention when available.
3. Observations are append-only. Corrections create a new observation or
   auditable retention transformation; historical values are not overwritten.
4. Event capture is idempotent so a retry cannot create duplicate observations
   for the same source event and assessment scope.
5. Existing live scoring remains the sole scoring authority. Capture must not
   alter score semantics, risk alerts, or dashboard ordering.

### FR-2: Capture and scheduled snapshots

1. Record observations only after meaningful committed lifecycle changes that
   can affect risk context, including assignment/checkpoint state changes,
   submission/review outcomes, verified consultation activity, and intervention
   lifecycle changes.
2. Run a daily job for active student assignments to record scheduled snapshots.
3. Capture failure must be observable and retryable but must not roll back an
   already successful academic workflow mutation.
4. This track introduces no notification behavior; existing alert deduplication
   and notification semantics remain unchanged.

### FR-3: Outcomes and intervention linkage

1. Authorized instructors can view intervention-linked outcome summaries using
   existing intervention, checkpoint, submission, review, and consultation data.
2. Outcomes must distinguish recorded facts from interpretation and retain the
   observation/intervention basis for each summary.
3. Intervention private notes, closure reasons, and sensitive details remain
   restricted to authorized instructor intervention views and are never exposed
   to students or admin aggregates.

### FR-4: Role-scoped access

1. The current instructor of an assignment may view its assigned students'
   detailed observations and outcome summaries. Assignment reassignment removes
   former-instructor access and grants current-owner access under the existing
   authorization model.
2. Administrators may view only aggregate trends scoped to authorized academic
   contexts. Results with fewer than ten students are suppressed.
3. Students may view only their own support status and approved next steps. The
   response excludes score, factor codes, internal explanations, instructor
   notes, intervention details, and cohort data.
4. Every sensitive read, retention operation, and failed/denied mutation is
   covered by the existing audit conventions without logging private notes or
   credentials.

### FR-5: Retention and anonymization

1. Identifiable observation detail is retained for five academic years.
2. A scheduled retention process anonymizes expired observations by removing
   direct and student-linked detail, preserving only non-identifying aggregate
   trend data needed for institutional analysis.
3. Anonymized data cannot be used to reconstruct an individual history or
   bypass the minimum cohort threshold.
4. Retention processing is idempotent, auditable, and does not modify current
   live risk or academic workflow state.

### FR-6: User experience

1. Provide instructor history/outcome, admin aggregate, and student support
   surfaces with role-appropriate loading, empty, error, and authorization
   states.
2. Use bilingual English/Indonesian text, existing shadcn/Base UI primitives,
   responsive layouts, dark-mode support, keyboard access, visible focus, and
   WCAG 2.1 AA semantics.
3. Use progressive disclosure: student language emphasizes available support and
   next actions, never a punitive label or internal scoring mechanism.

## Non-Functional Requirements

- Use the client-safe `*.ts` / server-only `*.server.ts` split through
  `typedServerFn`; keep source, test, and script files within the 500-line
  project limit.
- Validate all inputs and authorize every read/mutation server-side.
- Use transactions/constraints for persistence invariants and indexes for
  observation lookup, scheduled work, retention, and aggregate queries.
- Follow TDD and maintain at least 80% coverage for new code.
- Pass relevant unit, integration, E2E, accessibility, i18n, typecheck, lint,
  formatting, modularity, coverage, and build checks.

## Acceptance Criteria

- Historical observations remain explainable after factor definitions or scoring
  code change.
- Lifecycle events and daily snapshots create one deterministic observation each;
  dashboard reads do not create observations.
- A retry does not duplicate an event observation, and capture failure does not
  undo its academic mutation.
- Current instructors see only students they currently own; former instructors,
  unrelated instructors, students, and unauthorized admins cannot access
  detailed history.
- Student views are actionable and contain no internal risk or private
  intervention information.
- Admin results suppress all cohorts below ten students.
- Identifiable detail is anonymized after five academic years without breaking
  non-identifying aggregate trends.
- No risk-history operation sends a new notification or changes academic or
  intervention state automatically.

## Out of Scope

- Replacing, recalibrating, or persisting every execution of the risk engine.
- Automated intervention creation/resolution, academic penalties, escalation,
  or changes to grades, enrollment, deadlines, or checkpoint state.
- Exposing private intervention notes, factor-level scoring, or risk labels to
  students.
- Admin case management or individual student drill-down from aggregates.
- New external counseling integrations, notification channels, or report types.
