# TRACK-051: Grade Release Workflow — Specification

## Overview

SIMAK currently computes final grades for working gradebooks, but students cannot distinguish provisional computed values from official released results. TRACK-051 adds an instructor-controlled release boundary without changing grade computation, rubric scoring, or checkpoint review logic.

Each assignment receives a draft or published release state. Publishing captures immutable per-student snapshots for eligible enrolled students. Students can see a grade only from the active published snapshot; instructors and authorized staff retain their existing working-grade access and exports.

### Goals

- Make grade publication explicit and instructor-controlled.
- Preserve the exact grade and checkpoint breakdown shown to a student at release time.
- Prevent later recomputation from changing an already released student result.
- Give instructors a clear preflight summary before release.
- Provide a controlled, auditable withdrawal and republish path.
- Keep student-facing behavior bilingual, accessible, responsive, and unambiguous.

### Dependencies and Existing Boundaries

- Depends on TRACK-025 gradebook computation and final-grade persistence.
- Uses the existing one-to-one assignment grade configuration as the release-state owner.
- Uses persisted `final_grades` as the authoritative source for release eligibility.
- Does not alter grade formulas, weighting, rubric scoring, checkpoint sequencing, or recomputation behavior.

## Functional Requirements

### FR-1: Release State

1. Every assignment grade configuration has a release state of `draft` or `published`.
2. Existing grade configurations are initialized to `draft` during migration.
3. Existing assignments do not receive fabricated historical snapshots.
4. A published assignment records the active release version and publication metadata.

### FR-2: Preflight Summary

1. The owning instructor can request a release preflight for an assignment.
2. The preflight categorizes currently enrolled students as:
   - eligible: a complete authoritative final grade exists;
   - incomplete/in progress: grading is not complete; or
   - missing grade: an enrolled student has no complete persisted final grade.
3. The summary includes counts and enough student context for the instructor to understand who will and will not receive a snapshot.
4. The UI warns when incomplete or missing students exist and requires explicit confirmation before publishing.
5. Incomplete or missing students do not block publication of eligible students.

### FR-3: Publication

1. Only the current owner of the assignment may publish it.
2. Publication is atomic: release version assignment, eligible snapshot creation, release-state transition, and release metadata are committed together or not at all.
3. Publication creates exactly one immutable snapshot for each eligible enrolled student in the new release version.
4. A snapshot stores the assignment, student, release version, numeric score, letter grade, final-grade status, contributing checkpoint breakdown, and publication timestamp.
5. Publication of an already published assignment is rejected; the instructor must withdraw first.
6. Releasing a mixed cohort publishes complete students while leaving incomplete and missing students unavailable.

### FR-4: Immutable Versioned Snapshots

1. Previously published snapshots are retained when a release is withdrawn or superseded.
2. A later publication creates a new release version rather than modifying prior snapshots.
3. Recomputing live `final_grades` never changes any snapshot.
4. Snapshot access is limited to the relevant student-facing active release and authorized server-side workflows; withdrawn and superseded history is not exposed as student release history.

### FR-5: Withdrawal

1. Only the current assignment owner may withdraw a published release.
2. Withdrawal requires a non-empty reason.
3. Withdrawal returns the active assignment release state to `draft` and removes student visibility of the withdrawn release.
4. Withdrawal retains all prior snapshots for auditability.
5. A subsequent publication creates a new release version.

### FR-6: Student Visibility

1. While an assignment is draft, students cannot see its computed numeric grade, letter grade, status, or checkpoint breakdown.
2. While an assignment is published, a student sees only their active snapshot.
3. A student without an eligible snapshot sees an explicit unavailable/not-yet-released state.
4. Students who become complete after publication remain unavailable until a later release.
5. The existing published grade card remains the presentation surface, with snapshot data substituted for live provisional data.

### FR-7: Staff Access and Exports

1. The owning instructor and currently authorized admin/superadmin staff retain existing working-gradebook access.
2. Existing staff exports remain working-data exports and are not converted into transcripts or release-history exports.
3. Admins and superadmins do not receive release mutation controls merely because they can view the gradebook.

### FR-8: Authorization, Validation, and Auditing

1. Every release server function validates the session, role, assignment ownership, and input on the server.
2. Publish and withdraw operations use the existing typed server-function split, Zod validation, and rate-limiting conventions.
3. Successful publication records an audit event with the actor, assignment, release version, eligible/ineligible counts, and timestamp.
4. Successful withdrawal records an audit event with the actor, assignment, active release version, reason, and timestamp.
5. Audit logging follows the existing advisory error-handling convention without compromising release transaction integrity.

### FR-9: User Experience and Localization

1. Instructor controls clearly show draft/published state and the active release version where applicable.
2. Preflight, confirmation, withdrawal, validation, success, error, and unavailable states have English and Indonesian translations.
3. Dialogs and controls support keyboard navigation, visible focus, screen-reader labels, loading states, inline errors, and accessible semantic status colors.
4. The workflow remains usable from 320px through desktop layouts with touch targets of at least 44px.

## Non-Functional Requirements

- **Data integrity:** Snapshot creation and release-state changes are transactional and protected against duplicate release versions or partial publication.
- **Security:** No client-provided role, ownership, release state, or eligibility decision is trusted without server validation.
- **Performance:** Preflight and publication queries use the existing assignment/student indexes and avoid N+1 snapshot work.
- **Compatibility:** Existing grade computation, recomputation, instructor gradebook, student assignment, staff export, analytics, and audit behavior remain compatible.
- **Accessibility:** New UI meets the project’s WCAG 2.1 AA and accessible-primitive standards.
- **Quality:** New server, schema, UI, integration, and E2E behavior is covered by tests and the project maintains at least 80% coverage thresholds.

## Acceptance Criteria

1. Only the owning instructor can publish or withdraw an assignment grade release.
2. Draft grades and checkpoint breakdowns are inaccessible to students.
3. Publishing creates snapshots only for currently enrolled students with complete authoritative final grades.
4. A preflight warning identifies incomplete and missing-grade students, and explicit confirmation is required.
5. Recomputing live grades after publication does not alter the active student snapshot.
6. Students who become complete after publication remain unavailable until a later release.
7. Withdrawal fails without a non-empty reason, returns the assignment to draft, hides the withdrawn release, and records an audit event.
8. Prior snapshots remain retained and republishing creates a distinct release version.
9. Authorized staff can still view the working gradebook and use unchanged working-data exports.
10. English and Indonesian UI, unit tests, E2E coverage, accessibility checks, type checking, linting, i18n validation, and coverage gates pass.

## Out of Scope

- Admin approval workflows or release queues.
- Student acknowledgments, appeals, or disputes.
- Official transcripts, GPA calculations, or registrar integrations.
- Scheduled or automatic releases.
- Release notifications or messaging.
- Student-facing withdrawn-release history.
- Changes to grade computation, weighting, rubric scoring, checkpoint sequencing, or review rules.
