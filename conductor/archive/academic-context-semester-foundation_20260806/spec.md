# Track Specification: TRACK-057 — Academic Context & Semester Foundation

## Overview

SIMAK currently models assignments as template-based workflows owned by one instructor and assigned directly to students. It lacks reusable academic terms, courses, sections, enrollment boundaries, and an explicit assignment lifecycle. This track establishes the academic-context foundation needed for semester rollover, future group assignments, transcripts/GPA, reporting, and risk history.

**Type:** Feature
**Dependencies:** None
**Downstream consumers:** TRACK-059, TRACK-060, TRACK-061, TRACK-062

## Confirmed Decisions

- Use normalized **academic terms + reusable courses + term-specific sections**. A separate cohort subsystem is out of scope; section metadata may represent cohort information.
- An assignment belongs to exactly one section.
- New assignments explicitly use `individual` or `group` mode; `individual` remains the default. Group behavior is deferred.
- Assignment lifecycle is `draft → active → archived`. Archive is not equivalent to `deletedAt`; archived work is history-safe and read-only.
- Clone and semester rollover create a new, configuration-only assignment. They do not copy students, submissions, reviews, checkpoints’ historical state, or released grades.
- Admins manage terms, courses, sections, and enrollments. Instructors may operate only within sections where they are authorized. Students have read-only access to their own academic context.
- No production assignment data exists. Prelaunch/non-production rows may be reset and fixtures recreated during migration. A production rollout with unexpected existing assignment rows must stop rather than fabricate academic facts.

## Context Anchors

- `docs/PRD.md` — Assignment Management and Data Model Summary
- `docs/TDD.md` — `assignments`, `assignment_students`, and per-student `checkpoints`
- `src/db/schema/assignments.ts`
- `src/server/assignments.ts`
- `src/server/assignments.server.ts`
- `docs/roadmap.md` — TRACK-057

## Functional Requirements

### FR-1: Academic Terms

1. Admins can create, edit, activate/close, and archive academic terms.
2. A term has a stable identifier/code, display name, start date, and end date.
3. Term dates must be valid and term codes must be unique.
4. Closed or archived terms remain available for historical views but cannot receive new active assignments unless explicitly permitted by the finalized transition rules.
5. Term mutations are authenticated, role-checked, validated, and audited.

### FR-2: Courses and Sections

1. Admins can manage reusable course records independently of terms.
2. Admins can create term-specific sections linked to exactly one course and one term.
3. Section identity is unique within its course and term.
4. Sections support active/inactive or archived lifecycle state without deleting historical associations.
5. Sections expose explicit instructor and student enrollment relationships.
6. Only active, non-deleted users with the matching role can be enrolled.
7. Duplicate memberships and invalid cross-role enrollments are rejected.
8. Enrollment changes are audited and cannot expose data across sections.

### FR-3: Assignment Academic Context

1. Every newly created assignment is associated with exactly one section.
2. The section supplies the assignment’s course and term context.
3. An assignment stores an explicit mode: `individual` or `group`; new and existing behavior defaults to `individual`.
4. An instructor may create or manage an assignment only when:
   - the instructor is authorized for the selected section; and
   - the instructor owns the assignment operation.
5. Selected students must be active members of the assignment’s section.
6. Existing `assignment_students` remains the participation boundary for individual assignments; enrollment validation supplements it and does not remove explicit per-assignment selection.
7. Existing checkpoint, submission, review, consultation, deadline, grade-release, notification, and calendar behavior remains unchanged for individual assignments.
8. Assignment list, detail, dashboard, and relevant student surfaces expose context such as course, term, and section and filter results by server-side authorization.

### FR-4: Assignment Lifecycle

1. New assignments begin as `draft` unless explicitly activated during creation.
2. Draft assignments are not student-visible and do not participate in active-work dashboards.
3. Active assignments retain the existing submission/review/deadline workflow.
4. Authorized instructors or admins can archive assignments.
5. Archived assignments remain queryable for authorized history/reporting views but cannot accept new submissions, reviews, enrollment changes, or ordinary deadline mutations.
6. Lifecycle transitions are validated server-side and are distinct from destructive soft deletion.
7. Lifecycle writes use a transaction, row locking, and a post-lock status re-check.

### FR-5: Clone and Semester Rollover

1. An authorized instructor or admin can clone an assignment into a selected target section.
2. Semester rollover is the same history-safe creation model with a target section in another term.
3. The operation creates a new assignment and fresh per-student checkpoint records only for students explicitly selected afterward.
4. The new assignment may copy configuration such as title/description, template reference, checkpoint structure, mode, and approved deadline settings.
5. Absolute historical deadlines, submissions, reviews, audit history, release snapshots, and checkpoint state are never copied as historical records.
6. Students are not automatically copied from the source assignment or source section.
7. The source assignment is never mutated.
8. Clone and rollover execute atomically and create auditable events containing source and target context without duplicating sensitive academic content.

### FR-6: Migration and Fixture Strategy

1. The migration must add the academic-context schema and constraints in an idempotent, reviewable manner.
2. Because production contains no assignment data, deployment must treat existing production assignment rows as an invalid precondition rather than inventing course, term, or section facts.
3. Development/test assignment rows may be reset during migration and recreated through updated fixtures.
4. The migration and fixture documentation must explicitly state this prelaunch assumption and the safe path for any future legacy-data import.
5. No submission, review, audit, or released-grade history may be silently rewritten by the schema change.

### FR-7: User Experience and Localization

1. Admin context-management surfaces, instructor context selectors, lifecycle controls, and clone/rollover flows are bilingual in English and Indonesian.
2. Forms provide inline validation, confirmation for archival/destructive actions, loading states, error states, and helpful empty states.
3. Context filters and tables are responsive from 320px upward and meet WCAG 2.1 AA expectations.
4. All user-visible strings use i18n keys present in both locale files.

## Non-Functional Requirements

- Follow the client-safe `*.ts` / server-only `*.server.ts` split and `typedServerFn`.
- Enforce authorization and enrollment checks on the server; client filtering is supplementary.
- Use transaction + `FOR UPDATE` + post-lock re-check for lifecycle, enrollment, clone, and rollover state changes.
- Preserve explicit response projections and existing ownership guards.
- Add indexes only for measured access patterns and document their purpose.
- Keep all source and test files at or below 500 lines.
- Add unit, database integration, route/component, E2E, accessibility, and regression coverage as applicable.
- Maintain coverage thresholds of at least 80% for statements, branches, functions, and lines.
- Preserve existing individual-assignment behavior and quality gates.

## Acceptance Criteria

1. Admins can create and manage valid terms, courses, sections, and instructor/student enrollments.
2. Database constraints prevent duplicate context records, invalid dates, duplicate memberships, and role-incompatible enrollment.
3. An instructor cannot create, list, or mutate assignments outside authorized sections.
4. New assignments have one section and explicit mode, with individual behavior unchanged.
5. Students see only assignments and context for which they are authorized.
6. Draft, active, and archived lifecycle behavior is enforced server-side and reflected in UI.
7. Archived assignments are history-safe and cannot receive ordinary new workflow mutations.
8. Clone and rollover create independent configuration-only assignments without copying historical work, grades, or students.
9. Source assignments remain unchanged after clone or rollover, including all submissions, reviews, audit records, and released snapshots.
10. The prelaunch migration/fixture policy is documented and verified without fabricated legacy academic facts.
11. Audit events exist for context administration, enrollment changes, lifecycle transitions, clone, and rollover.
12. Existing individual assignment authorization, deadlines, submissions, reviews, grade release, notifications, and calendar feeds remain compatible.
13. Unit, integration, E2E, accessibility, i18n, typecheck, lint, modularity, coverage, and build gates pass.

## Out of Scope

- Collaborative group membership or group submissions (TRACK-059)
- Transcript, GPA, credit, repeat, or institutional grading policy (TRACK-060)
- SIS/LMS/OAuth integrations
- Attendance, fees, room scheduling, degree audits, and a complete course-catalog replacement
- Consultation booking
- Group advising sessions
- Changes to the sequential checkpoint state machine
- Automatic student copying during rollover
- Historical production-data fabrication or speculative legacy mapping

## Dependencies and Coordination

This track has no implementation dependency. It establishes the academic-context and enrollment boundary consumed by TRACK-059–062 and should coordinate with those tracks before finalizing shared schema names or authorization contracts.
