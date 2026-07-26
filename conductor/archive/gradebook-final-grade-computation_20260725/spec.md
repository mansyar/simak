<protect>
# Track: Gradebook & Final Grade Computation (TRACK-025)

## Overview

Aggregates rubric-based review scores (from TRACK-020) and pass/fail checkpoint states into weighted final grades with configurable letter grade mapping. Introduces a grade computation engine, grade configuration table, cached final grades table, instructor gradebook view, admin grade settings, student final grade card, admin grade distribution analytics, and CSV/Excel export.

**Dependencies:** TRACK-020 (Rubric-Based Grading — provides `review_scores` with denormalized weight/score snapshots). Can be implemented independently of TRACK-023.

**Estimated Effort:** 5 Days / 3 Sprint Loops

---

## Context Anchors

### PRD Reference
- `docs/PRD.md#checkpoints--submissions` — review workflow with rubric scoring (data source for grade computation)
- `docs/PRD.md#analytics--reporting` — CSV/Excel export infrastructure (extension point for gradebook exports)
- `docs/PRD.md#data-model-summary` — `ReviewScore` entity (denormalized snapshot of criterion score/weight at review time)

### TDD Reference
- `assignments` table (`src/db/schema/assignments.ts:24` — `finalDeadline`, `instructorId`)
- `checkpoints` table (`src/db/schema/assignments.ts:77` — `state`, `order`, `studentId`, `templateCheckpointId`)
- `reviews` table (`src/db/schema/submissions.ts:41` — `decision`, `reviewedAt`)
- `review_scores` table (`src/db/schema/rubrics.ts:46` — `score`, `weight`, `criterionTitle`, `levelLabel` — denormalized snapshot frozen at review time)
- `template_checkpoints` table (`src/db/schema/templates.ts:16` — `gradingType`, `order`, `minConsultations`)

### Existing Code Extension Points
- `src/server/analytics-export.server.ts` (355 lines) — existing CSV export + private `escapeCsvValue`/`buildCsv` helpers
- `src/lib/excel-export.ts` (64 lines) — existing `.xlsx` export + `exportRubricScoresToExcel` pattern
- `src/server/dashboard-student.server.ts` — student dashboard handler (extension for final grade display)
- `src/server/dashboard-instructor.server.ts:53-255` — `getInstructorDashboardDataHandler`
- `src/server/reviews.server.ts:220` — `submitReviewHandler` (file at 495/500 lines — extension goes in `reviews-extras.server.ts`)
- `src/server/assignments.server.ts:79` — `createAssignmentHandler` (file at 498/500 lines — extension goes in `assignments-extras.server.ts`)
- `src/server/reviews-extras.server.ts` — extension for `recomputeStudentGrade`
- `src/server/assignments-extras.server.ts` — extension for `createDefaultGradeConfig`

### Product Spec Reference
- `conductor/product.md` TRACK-020 — explicitly deferred "Grade transcripts / final grade aggregation across checkpoints (separate future track)" in Out of Scope

---

## Track Tech Stack

- **Drizzle ORM** — New `assignment_grade_config` + `final_grades` tables. New schema file `src/db/schema/gradebook.ts`, registered in `src/db/schema/index.ts`. Migration via `pnpm db:generate`. Neither table uses `deletedAt` (cascade-deleted via FK / cache upserted).
- **New shared module:** `src/lib/grade-computation.ts` — pure functions, no DB access. Exports `computeFinalGrade(checkpoints, config): FinalGradeResult` and types.
- **New server function split:** `src/server/gradebook.ts` (Zod schemas + `createServerFn` stubs with `.inputValidator(Schema).handler(...)`) + `src/server/gradebook.server.ts` (handlers).
- **Existing file extensions:** `analytics-export.server.ts` (`exportGradebookCsvHandler`), `excel-export.ts` (`exportGradebookToExcel`), `reviews-extras.server.ts` (`recomputeStudentGrade`), `assignments-extras.server.ts` (`createDefaultGradeConfig`).
- **shadcn/ui** — `Table`, `Badge`, `Card`, `Input`, `Select`.
- **i18n** — new `gradebook.*` namespace keys in both EN and ID locales.

---

## Functional Requirements

### FR-1: Grade Configuration Schema
- New `assignment_grade_config` table: `assignmentId` (FK → assignments, unique, `onDelete: cascade`), `gradingScheme` (pgEnum: `equal_weight` | `custom_weight`), `customWeights` (jsonb, nullable — `{ templateCheckpointId: weight }` map, values 0–100), `letterGradeBounds` (jsonb — `{ "A": 90, "B": 80, "C": 70, "D": 60 }`), `createdAt`, `updatedAt`.
- Default config auto-created inside `createAssignmentHandler` transaction via `createDefaultGradeConfig(tx, assignmentId)` (scheme = `equal_weight`, `customWeights` = null, standard letter bounds).
- Pre-existing assignments backfilled by migration script (NOT lazy creation on read).
- All grade config changes audit-logged via `logAuditEvent` (action: `gradebook.config_updated`, entity type: `assignment_grade_config`, details include previous + new values).

### FR-2: Final Grades Cache Table
- New `final_grades` table: `id` (serial PK), `assignmentId` (FK → assignments, `onDelete: cascade`), `studentId` (text, FK → users), `numericScore` (numeric(5,2), nullable), `letterGrade` (text, nullable), `status` (pgEnum: `complete` | `incomplete` | `in_progress`), `contributingCheckpoints` (jsonb — array of `{ checkpointId, checkpointName, templateCheckpointId, order, state, score, isRubric, weight }`), `computedAt`, `updatedAt`.
- Unique constraint on `(assignmentId, studentId)`.
- Recomputed on-demand or when a review is submitted (triggered from `submitReviewHandler` post-commit).

### FR-3: Grade Computation Engine
- New `src/lib/grade-computation.ts` — pure function `computeFinalGrade(checkpoints, config): FinalGradeResult`.
- Per-checkpoint scoring: if `gradingType === null` (pass/fail) → score = `state === 'passed'` ? 100 : 0; if `numeric`/`qualitative` → aggregate `review_scores` weighted by criterion `weight` (sum of `score * weight / 100` per criterion, using denormalized snapshot).
- Overall score by scheme: `equal_weight` = simple average (sum / count); `custom_weight` = weighted by `customWeights` map (keyed by `templateCheckpointId`).
- Letter grade from `letterGradeBounds` (score >= bound → letter; below lowest bound → "F").
- Status: `complete` if all passed, `in_progress` if some passed, `incomplete` if none passed.
- **Stale weights handling:** If `customWeights` don't sum to 100 or are missing checkpoint entries, fall back to `equal_weight` averaging, log a warning, and show a warning badge on the grade config in the UI.

### FR-4: Instructor Gradebook View
- New route `/instructor/assignments/$id/gradebook` — table view (students × checkpoints → final grade column).
- Each cell: numeric score (rubric checkpoints) or pass/fail `Badge` (non-rubric).
- Final grade column: numeric score + letter `Badge`.
- Export CSV and Excel buttons.
- Linked from instructor assignment detail page.
- **Grade config read-only summary:** Instructors see a read-only summary of the current grade configuration (scheme, custom weights, letter bounds) at the top of the gradebook page. Not editable by instructors.

### FR-5: Admin Grade Settings Dialog
- "Grade Settings" dialog accessible from admin template editor or admin analytics.
- `Select` for scheme, `Input` fields for custom weights (visible only when `custom_weight` selected, keyed by `templateCheckpointId`), `Input` fields for letter bounds.
- Admin-only via `isAdmin` guard.
- Zod validation: custom weights must sum to 100 when scheme is `custom_weight` (via `superRefine`).
- Audit-logs changes via `logAuditEvent`.

### FR-6: Student Final Grade Card
- New component on `/student/assignments/$id` — shows final grade (numeric + letter badge) when assignment is complete, or current progress score with "in progress" status.
- Per-checkpoint score breakdown in a collapsible section.
- Read-only for students.

### FR-7: Admin Grade Distribution Analytics
- Extend admin analytics (`/admin/analytics`) with "Grade Distribution" section.
- Aggregate letter grade distribution across all assignments (A/B/C/D/F counts as progress bars).
- No drill-down to individual students (v2).

### FR-8: CSV/Excel Export
- `exportGradebookCsvHandler` in `analytics-export.server.ts` (admin-only, per-assignment, ownership-verified) returns CSV string with student name, per-checkpoint scores, final numeric score, letter grade.
- Uses existing private `escapeCsvValue` and `buildCsv`.
- Client-side `exportGradebookToExcel` helper in `excel-export.ts` for `.xlsx` export, using existing `sanitizeCell`.
- **Export scope:** Data only — one row per student, columns per checkpoint + final grade. No summary rows.

### FR-9: Grade Recomputation Trigger
- Extend `submitReviewHandler` post-commit advisory section with `recomputeStudentGrade(db, assignmentId, studentId)` (defined in `reviews-extras.server.ts`, try/catch, never affects review transaction).
- Only triggers on `pass` decision (revise doesn't change pass state).
- NOT triggered on `submitCheckpointHandler`.

### FR-10: Manual Recompute
- Admin-only "Recompute All Grades" button on the gradebook page.
- Recomputes `final_grades` for all students in the assignment.
- Useful for recovery after data migrations or manual DB fixes.

### FR-11: Default Grade Config on Assignment Creation
- `createDefaultGradeConfig(tx, assignmentId)` called inside `createAssignmentHandler` transaction.
- Inserts default `assignment_grade_config` row (scheme = `equal_weight`, `customWeights` = null, standard letter bounds).

---

## Non-Functional Requirements

- **Performance:** Gradebook query batch-joins checkpoints + reviews + review_scores per student. `final_grades` cache prevents re-computation on every page load.
- **Security:** All server functions use `getSessionFromHeaders` + role guards. Student handlers verify ownership. Admin-only handlers use `isAdmin` guard.
- **Type Safety:** Explicit return types on client-crossing server handlers.
- **File Limits:** All new files ≤500 lines. Extensions to existing files at/near 500-line limit go in `*-extras.server.ts` files.
- **i18n:** All user-visible strings in `gradebook.*` namespace, added to both EN and ID locales.
- **Testing:** TDD. Unit tests for computation engine (pure function), handlers, export, recomputation trigger. Coverage ≥80% on all thresholds.
- **Audit Trail:** All grade config changes logged to `audit_log`.

---

## Acceptance Criteria

1. Instructor opens `/instructor/assignments/$id/gradebook` → sees a table of all assigned students with per-checkpoint scores and a final grade column. A read-only summary of the grade config (scheme, weights, bounds) is visible at the top.
2. A student with all checkpoints passed shows a numeric score (e.g., 87.50) and letter badge (e.g., "B"). A student with incomplete checkpoints shows "In Progress" status.
3. Admin opens Grade Settings dialog → changes scheme from "Equal Weight" to "Custom Weight" → enters custom weights per checkpoint (must sum to 100%) → saves → gradebook recalculates. Audit log records the change.
4. Admin clicks "Export CSV" → downloads a `.csv` file with student names, checkpoint scores, and final grades (data only, no summary rows). Excel export works similarly.
5. Student opens `/student/assignments/$id` → sees a final grade card with their score and letter badge (when complete) or "In Progress" (when incomplete). Student clicks breakdown → sees per-checkpoint scores.
6. Admin opens `/admin/analytics` → sees a "Grade Distribution" section with A/B/C/D/F progress bars.
7. Instructor reviews a submission with `pass` decision → the student's final grade in the gradebook updates. A `revise` review does NOT trigger recomputation.
8. Admin clicks "Recompute All Grades" → all students' final grades are recomputed and cached.
9. If custom weights are stale (template changed after config), computation falls back to equal_weight, a warning is logged, and a warning badge shows on the grade config.
10. Backward compatibility: pre-existing assignments have default `assignment_grade_config` rows backfilled by migration. A new assignment gets a default config row automatically.
11. `pnpm typecheck`, `pnpm lint`, `pnpm check:i18n` all clean. All files ≤500 lines. Coverage ≥80%.

---

## Out of Scope

- Grade appeals workflow (v2)
- Cross-assignment grade aggregation / transcript generation (v2 — requires course/semester grouping)
- GPA computation (v2 — requires institution-specific GPA scales)
- Student-facing grade editing or grade negotiation (grades are computed, read-only for students)
- Weighted checkpoint categories, e.g., "homework = 30%, exams = 70%" (v2; v1 weights are per-checkpoint)
- Grade history/audit trail for score changes (`final_grades` is upserted, not append-only; v2 could add `final_grade_history` table)
- Automated grade import from external systems / LMS integration (v2)
- Student notification on grade update (v2 — students see their grade when they open the assignment page)
- `passThreshold` / numeric pass override (instructor's pass/revise decision already determines checkpoint completion)
</protect>
