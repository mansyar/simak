# TRACK-060: Academic Records — Transcript & GPA

## Overview

SIMAK has academic terms, reusable courses, course sections, section enrollments, and immutable per-student grade-release snapshots, but it does not yet provide an official transcript or GPA view.

This track adds release-derived academic records for students and authorized academic staff. Official records are based only on published grade releases, never mutable working grades or provisional `final_grades`.

**Type:** Feature
**Dependencies:** TRACK-057, TRACK-025, TRACK-051
**Downstream consumer:** TRACK-061 Institutional Reporting & Scheduled Delivery

## Context Anchors

- `conductor/product.md` — academic assignment and grading product definition
- `conductor/product-guidelines.md` — bilingual, accessible, role-scoped UX and data-integrity rules
- `conductor/tech-stack.md` — approved TanStack Start, Drizzle, PostgreSQL, and testing stack
- `conductor/workflow.md` — TDD, coverage, verification, commit, and git-notes requirements
- `docs/roadmap.md` — TRACK-060 scope and dependency graph
- `src/db/schema/academic-context.ts` — terms, courses, sections, and enrollments
- `src/db/schema/gradebook.ts` — working grades and immutable release snapshots
- `conductor/archive/grade-release-workflow_20260802/spec.md` — published-grade boundary

## Goals

- Provide an official, auditable transcript derived from released academic results.
- Calculate term and cumulative GPA using an explicit, versioned grading policy.
- Preserve repeat attempts and historical release/policy context without mutating prior records.
- Give students, administrators, and authorized instructors role-appropriate views.
- Establish a stable academic-record contract for future institutional reporting.

## Confirmed Decisions

1. A course result is sourced from one explicitly designated released assignment for the course section. Weighted aggregation across multiple assignments is out of scope.
2. Grading policy uses configurable, versioned defaults for course credits, grade-to-point mapping, and rounding.
3. Official transcript results are immutable record rows tied to their source release version and grading-policy version.
4. All repeated attempts remain visible; the latest eligible attempt is used for cumulative GPA by default.
5. Incomplete and withdrawn outcomes remain visible but are excluded from GPA calculations.
6. Students see their own records, admins/superadmins may access authorized records, and instructors may access only students in their authorized sections.

## Policy Contract

- The initial grade-point defaults are `A = 4.0`, `B = 3.0`, `C = 2.0`, `D = 1.0`, and `F = 0.0`. Institutions may configure additional letter grades, such as plus/minus grades, but every letter that can appear in a released snapshot must have an explicit point value. An unmapped letter is invalid; it never silently falls back to zero.
- The released assignment snapshot remains the source of the numeric score and letter grade. Transcript policy maps that released letter to grade points; it does not recalculate the assignment score or grade boundaries.
- Course credits belong to the reusable `courses` catalog record and are positive values. Existing courses without an explicitly configured credit value remain valid catalog records but produce an `unavailable` transcript result until an administrator configures credits; the system must not fabricate a default credit value during migration.
- Grading policies are append-only, versioned records with an effective academic term. A record uses the latest active policy whose effective term is no later than the section term, and stores that policy version permanently. Activating a later policy never rewrites existing records.
- GPA values use decimal arithmetic and are rounded half-up to two decimal places. Term GPA is the weighted mean of eligible records in the selected term. Cumulative GPA selects the latest eligible attempt per course, ordered by term start date, term ID, publication timestamp, and record ID, all descending.
- `complete` is sourced from an eligible published complete snapshot. `incomplete` and `withdrawn` require an explicit authorized academic-record outcome and are visible but excluded from GPA. `unavailable` is a response-level state for missing, draft, unpublished, ambiguous, or unconfigured records and is never persisted as an academic result. `in_progress` is never an official transcript outcome.
- For a student/course pair, a newer source release creates a new immutable record version. The active version is selected by source release version, publication timestamp, and record ID, in descending order; historical versions remain auditable.

## Functional Requirements

### FR-1: Academic Record Creation

1. A course section can have at most one explicitly designated transcript-source assignment.
2. The system must prevent an official course record when the source assignment is missing, ambiguous, unpublished, or ineligible.
3. Create official course records only from published, eligible grade-release snapshots or an explicitly authorized incomplete or withdrawal outcome.
4. Associate every record with the student, academic term, course section, course identity, source assignment, source release version where applicable, applied policy version, credits, numeric score where applicable, letter grade where applicable, grade points where applicable, academic status, and publication timestamp.
5. Record creation and grade-release integration must be transactional.
6. Releasing a newer result creates a new immutable record version rather than mutating historical rows.
7. Draft grades, mutable working grades, unreleased assignments, missing grades, and unauthorized students must never produce official records.

### FR-2: Academic Policy

1. Authorized administrators can manage the course-credit and grading-policy values required for record calculation.
2. A policy version is retained with each record so later configuration changes cannot rewrite history.
3. Grade mapping and rounding are deterministic and validated server-side.
4. The initial policy includes documented defaults and rejects incomplete, contradictory, or invalid mappings.
5. A newly activated policy applies to newly created official records and is not retroactively applied to existing records.

### FR-3: Repeat-Course Handling

1. Every released attempt remains visible in transcript history.
2. The system identifies the attempt used for cumulative GPA according to the configured/default repeat rule.
3. The default rule uses the latest eligible attempt for a course in cumulative GPA and excludes earlier eligible attempts from the cumulative calculation without deleting them.
4. A repeated attempt does not erase the historical term record for the earlier attempt.

### FR-4: GPA Calculation

1. Calculate term GPA from eligible records in the selected academic term.
2. Calculate cumulative GPA from the latest eligible attempt for each course.
3. Exclude incomplete and withdrawn records from GPA credit and point totals.
4. Avoid divide-by-zero errors and provide a clear unavailable state when no eligible records exist.
5. Return or display a transparent calculation summary so users can understand the records, credits, and points used.

### FR-5: Role-Scoped Views

1. Students can view their transcript history, term GPA, cumulative GPA, course details, academic statuses, and applicable release dates.
2. Admins and superadmins can view authorized student records and policy/source metadata.
3. Instructors can view records only for students enrolled in their authorized sections.
4. Server-side authorization uses the existing academic-context and section-authorization boundaries; client-provided student or section IDs are not trusted.

### FR-6: User Experience and Localization

1. Provide responsive academic-record views with term filtering and clear empty, unavailable, loading, and error states.
2. Clearly distinguish published, incomplete, withdrawn, and GPA-excluded records.
3. All new user-visible text has English and Indonesian translations.
4. UI meets the project’s WCAG 2.1 AA, keyboard, focus, touch-target, responsive, and dark-mode requirements.

### FR-7: Auditability and Compatibility

1. Record creation, replacement, withdrawal, and policy changes are traceable through existing audit conventions where applicable.
2. Existing grade computation, grade-release, assignment, enrollment, analytics, and consultation behavior remains compatible.
3. Transcript and GPA calculations never mutate existing published grade snapshots.

## Non-Functional Requirements

- **Integrity:** Immutable records and source-release/policy references are enforced at the database and server layers.
- **Security:** Every server function validates session, role, and academic-context authorization.
- **Performance:** Transcript queries avoid N+1 reads and use indexes appropriate for student, term, section, and active-record lookups.
- **Testing:** New policy functions, persistence, authorization, server handlers, UI states, and representative end-to-end flows receive coverage. New code targets at least 80% coverage.
- **Compatibility:** No PDF generation, scheduled delivery, or reporting scheduler is introduced by this track.

## Acceptance Criteria

1. A draft or unpublished grade never appears in an official transcript.
2. Publishing the designated assignment creates immutable course records for eligible enrolled students.
3. Releasing a later version preserves the previous record and identifies the active official version.
4. Recomputing `final_grades` does not alter any transcript record.
5. Grade points and GPA values follow the stored grading-policy version and configured rounding rules.
6. All repeat attempts remain visible, while the latest eligible attempt is used for cumulative GPA by default.
7. Incomplete and withdrawn records are visible and excluded from GPA.
8. Students cannot view another student’s records.
9. Instructors cannot view records outside their authorized sections.
10. Admin views provide the policy/source context needed to audit a result.
11. Term GPA, cumulative GPA, and no-eligible-record states are calculated correctly.
12. English/Indonesian, responsive, dark-mode, keyboard, and accessible states are covered.
13. Existing grade-release and gradebook tests continue to pass.

## Out of Scope

- Weighted aggregation of multiple assignments into a course grade
- Group-assignment grading
- Degree audit, prerequisites, honors/rankings, or graduation eligibility
- PDF transcript generation
- Scheduled report delivery
- Student-facing risk history
- Changes to checkpoint grading or grade-release formulas
- Multi-institution tenancy or a separate SIS integration

## Planning Assumption

The existing data model does not yet expose a course-grade-source designation. The implementation plan must define the smallest explicit, history-safe association needed to identify the single official graded assignment for each section and how ambiguous sections are surfaced to administrators.
