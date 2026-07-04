<protect>
# Specification: Per-Student Deadline Isolation

## Overview

This track fixes a data-integrity bug where granting a per-student extension or SLA-breach adjustment incorrectly mutates the course-wide `assignments.finalDeadline` column, contaminating the deadline visible to every other student in the same assignment. The fix removes the three non-scoped `finalDeadline` writes and updates reader views to derive each student's effective deadline from their own last checkpoint's `dueDate`, preserving `finalDeadline` as the instructor's original course-wide commitment.

## Background

`assignments.finalDeadline` is a course-wide column set once at assignment creation (`createAssignmentHandler`). It represents the instructor's original commitment to all students. Per-student deadlines live on `checkpoints.dueDate` (one row per student per checkpoint).

Three server paths incorrectly extend the shared `finalDeadline` when operating on a single student:

1. **`calculateExtensionAdjustment`** (`src/server/extensions-extras.server.ts:81-95`) — called by `approveExtensionHandler` when an instructor approves a student's extension request. Extends the target + subsequent checkpoints for that student (correctly scoped), then also extends `assignments.finalDeadline` (NOT scoped — the bug).
2. **`bulkExtendHandler`** (`src/server/extensions-extras.server.ts:364-380`) — instructor bulk-extends one student's unfinished checkpoints, then also extends `assignments.finalDeadline` (NOT scoped — the bug).
3. **`adjustDeadlinesForBreach`** (`src/lib/review-sla.ts:72-82`) — called by `submitReviewHandler` when an instructor's review breaches the 3-day SLA. Extends the affected + subsequent checkpoints for that student (correctly scoped), then also extends `assignments.finalDeadline` (NOT scoped — the bug).

The correct precedent already exists: **`extendDeadlineHandler`** (`src/server/assignments-extras.server.ts:128-131`) mutates only the target checkpoint's `dueDate` and never touches `finalDeadline`.

Because reader views currently display `finalDeadline` as the student's deadline, a per-student extension leaks into every student's displayed deadline.

## Functional Requirements

### FR-1: Remove non-scoped finalDeadline writes
- FR-1.1: `calculateExtensionAdjustment` must NOT update `assignments.finalDeadline`. It continues to extend the target checkpoint + all subsequent checkpoints for the target student only.
- FR-1.2: `bulkExtendHandler` must NOT update `assignments.finalDeadline`. It continues to extend the target student's unfinished checkpoints only.
- FR-1.3: `adjustDeadlinesForBreach` must NOT update `assignments.finalDeadline`. It continues to extend the affected checkpoint + subsequent checkpoints for the target student only.
- FR-1.4: `assignments.finalDeadline` is immutable after assignment creation. No per-student operation may modify it.

### FR-2: Per-student effective deadline in student reader views
The "effective deadline" for a student is the `dueDate` of that student's highest-`order` checkpoint in the assignment (the last checkpoint in sequence).
- FR-2.1: `listStudentAssignmentsHandler` must return each assignment's effective deadline (derived from the student's last checkpoint `dueDate`).
- FR-2.2: `getStudentAssignmentDetailHandler` must return the student's effective deadline derived from the last checkpoint `dueDate`.
- FR-2.3: `getStudentDashboardDataHandler` must use the effective deadline (last checkpoint `dueDate`) as the displayed/sorted deadline for each active assignment, replacing the contaminated `finalDeadline`-as-personal-deadline usage. The "upcoming deadlines" widget already uses per-checkpoint `dueDate` and remains correct.

### FR-3: Instructor view shows both deadlines
- FR-3.1: `getAssignmentDetailHandler` (instructor assignment detail) must continue to return the assignment-level `finalDeadline` (course-wide, original commitment) AND add a per-student effective deadline derived from each student's last checkpoint `dueDate`.
- FR-3.2: `listInstructorAssignmentsHandler` and `getInstructorDashboardDataHandler` continue to return the course-wide `finalDeadline` at the assignment level (no per-student dimension at list/dashboard aggregate level; `finalDeadline` is now correct because it is no longer contaminated).

### FR-4: Frontend display
- FR-4.1: Student-facing components (`StudentAssignmentCard`, `AssignmentDetailHeader`, `StudentDashboard`) must display the per-student effective deadline.
- FR-4.2: Instructor assignment detail (`AssignmentOverviewTab`) must display both the course-wide `finalDeadline` and each student's per-student effective deadline.

## Non-Functional Requirements

- NFR-1: No database schema migration (forward-only; `checkpoints.dueDate` already holds correct per-student data). Historical contaminated `finalDeadline` values are left as-is.
- NFR-2: All changes follow TDD: a failing test asserting `finalDeadline` is unchanged after a per-student extension (and that only the target student's checkpoints move) is written first, then made green.
- NFR-3: Unit-test coverage >= 80% for changed code; existing tests encoding the old buggy behavior are updated to assert the new behavior.
- NFR-4: Any new user-visible label (e.g., "Effective Deadline", "Original Deadline") must use i18n keys in both `locales/en.json` and `locales/id.json` (custom `simak-i18n/no-hardcoded` lint rule).
- NFR-5: Files remain under the 500-line modularity limit.

## Acceptance Criteria

- AC-1: After approving a per-student extension, `assignments.finalDeadline` is unchanged; only the target student's checkpoints' `dueDate` values move (target + subsequent). Other students' checkpoints and the course-wide `finalDeadline` are untouched.
- AC-2: After an instructor bulk-extends one student, `assignments.finalDeadline` is unchanged; only that student's unfinished checkpoints move.
- AC-3: After an SLA-breach adjustment on one student's review, `assignments.finalDeadline` is unchanged; only that student's affected + subsequent checkpoints move.
- AC-4: A student viewing their assignment list/detail/dashboard sees their effective deadline (reflecting their own extensions), not the course-wide `finalDeadline`.
- AC-5: An instructor viewing the assignment detail sees both the course-wide `finalDeadline` and each student's per-student effective deadline.
- AC-6: All unit tests pass; `pnpm typecheck`, `pnpm lint`, and coverage thresholds (>=80%) are green.

## Out of Scope

- A course-wide "extend all students" feature that legitimately updates `finalDeadline` for everyone (separate track if needed).
- Data migration to repair historically contaminated `finalDeadline` values (forward-only fix).
- Changes to `extendDeadlineHandler` (already correct).
- Changes to the instructor dashboard/list handlers beyond verifying they read the now-correct course-wide `finalDeadline`.
</protect>
