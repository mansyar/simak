<protect>
# Implementation Plan: Gradebook & Final Grade Computation (TRACK-025)

## Phase 1: Schema & Computation Engine [checkpoint: 0dbdc859]

- [x] Task: Read spec.md and workflow.md to re-establish context before implementation
    - [x] Read `conductor/tracks/gradebook-final-grade-computation_20260725/spec.md`
    - [x] Read `conductor/workflow.md` (TDD lifecycle, commit format, checkpoint protocol)

- [x] Task: Create gradebook database schema [15db09f]
    - [x] Create `src/db/schema/gradebook.ts` with `assignment_grade_config` table (assignmentId FK unique cascade, gradingScheme pgEnum `equal_weight`|`custom_weight`, customWeights jsonb nullable, letterGradeBounds jsonb, createdAt, updatedAt)
    - [x] Create `final_grades` table in same file (id serial PK, assignmentId FK cascade, studentId FK→users, numericScore numeric(5,2) nullable, letterGrade text nullable, status pgEnum `complete`|`incomplete`|`in_progress`, contributingCheckpoints jsonb, computedAt, updatedAt, unique `(assignmentId, studentId)`)
    - [x] Define relations: `assignmentGradeConfigRelations`, `finalGradesRelations`
    - [x] Register tables + relations in `src/db/schema/index.ts` re-exports
    - [x] Generate migration via `pnpm db:generate` (include backfill of default `assignment_grade_config` rows for existing assignments)
    - [x] Verify: migration applies cleanly to dev DB (`pnpm db:push`)

- [x] Task: Write failing tests for grade computation engine [a40ef8e]
    - [x] Create `tests/unit/lib/grade-computation.test.ts`
    - [x] Test equal_weight scheme: simple average of checkpoint scores
    - [x] Test custom_weight scheme: weighted by templateCheckpointId map
    - [x] Test pass/fail checkpoints (gradingType null): score = `state === 'passed'` ? 100 : 0
    - [x] Test rubric checkpoints (numeric/qualitative): aggregate review_scores weighted by criterion weight
    - [x] Test incomplete assignment → status `incomplete`
    - [x] Test mixed (some passed) → status `in_progress`
    - [x] Test all passed → status `complete`
    - [x] Test letter grade boundaries: score exactly 90 → "A", 89.99 → "B", below D bound → "F"
    - [x] Test stale custom weights (sum ≠ 100 or missing checkpoints) → falls back to equal_weight
    - [x] Test null config → uses defaults
    - [x] Run `pnpm test` and confirm all new tests fail

- [x] Task: Implement grade computation engine [a40ef8e]
    - [x] Create `src/lib/grade-computation.ts` with types: `GradingScheme`, `CheckpointGradeInput`, `FinalGradeResult`, `ContributingCheckpoint`, `AssignmentGradeConfig`
    - [x] Implement `computeFinalGrade(checkpoints, config): FinalGradeResult` pure function
    - [x] Implement per-checkpoint scoring (pass/fail vs rubric)
    - [x] Implement equal_weight and custom_weight schemes
    - [x] Implement letter grade derivation from `letterGradeBounds` with "F" fallback
    - [x] Implement status derivation (complete/in_progress/incomplete)
    - [x] Implement stale weights detection → fallback to equal_weight + warning flag in result
    - [x] Run `pnpm test` and confirm all tests pass

- [x] Task: Conductor - User Manual Verification 'Phase 1: Schema & Computation Engine' (Protocol in workflow.md)

## Phase 2: Server Functions & Grade Recomputation [checkpoint: fe58d65e]

- [x] Task: Read spec.md and workflow.md to re-establish context before implementation
    - [x] Read `conductor/tracks/gradebook-final-grade-computation_20260725/spec.md`
    - [x] Read `conductor/workflow.md` (TDD lifecycle, commit format, checkpoint protocol)

- [x] Task: Write failing tests for gradebook server handlers
    - [x] Create `tests/unit/server/gradebook.test.ts` with `@vitest-environment node` + mock `@tanstack/react-start` builder chain + mock `@/server/auth`, `@/db/index`
    - [x] Test `getStudentFinalGradeHandler`: returns computed grade, returns null when no config, ownership verified (student can't access another student's grade), does NOT auto-create config on read
    - [x] Test `getAssignmentGradebookHandler`: returns all students with per-checkpoint scores, sorted by name, instructor ownership verified
    - [x] Test `saveGradeConfigHandler`: admin-only (rejects instructor/student), validates custom weights sum to 100 via `superRefine` when `custom_weight`, upserts config, audit logs
    - [x] Test `recomputeAllGradesHandler`: admin-only, recomputes all students' `final_grades`
    - [x] Run `pnpm test` and confirm all new tests fail

- [x] Task: Implement gradebook server functions
    - [x] Create `src/server/gradebook.ts` with Zod schemas (`GetStudentFinalGradeSchema`, `GetAssignmentGradebookSchema`, `SaveGradeConfigSchema` with `superRefine`, `RecomputeAllGradesSchema`) + `createServerFn` stubs with `.inputValidator(Schema).handler(...)`
    - [x] Create `src/server/gradebook.server.ts` with handlers: `getStudentFinalGradeHandler` (ownership-verified, reads from cache or computes on-demand if stale), `getAssignmentGradebookHandler` (instructor ownership-verified, batch query), `saveGradeConfigHandler` (admin-only via `isAdmin`, validates, upserts, audit logs), `recomputeAllGradesHandler` (admin-only, recomputes all students)
    - [x] Run `pnpm test` and confirm all tests pass

- [x] Task: Write failing tests for grade recomputation + default config helpers
    - [x] Test `recomputeStudentGrade`: fetches student checkpoint data, calls `computeFinalGrade`, upserts `final_grades` row
    - [x] Test `createDefaultGradeConfig`: inserts default config inside transaction
    - [x] Run `pnpm test` and confirm tests fail

- [x] Task: Implement grade recomputation + default config helpers [0979d473]
    - [x] Add `recomputeStudentGrade(db, assignmentId, studentId)` to `src/server/reviews-extras.server.ts`
    - [x] Add `createDefaultGradeConfig(tx, assignmentId)` to `src/server/assignments-extras.server.ts`
    - [x] Run `pnpm test` and confirm tests pass

- [x] Task: Wire triggers into existing handlers [c1d20a4a]
    - [x] Extend `submitReviewHandler` in `reviews.server.ts` post-commit advisory: call `advisoryRecomputeGrade` (wrapper in reviews-extras.server.ts, only when `decision === 'pass'`)
    - [x] Extend `createAssignmentHandler` in `assignments.server.ts` inside transaction: call `createDefaultGradeConfig(tx, assignmentId)`
    - [x] No test mock updates needed — advisory calls are naturally no-ops with empty mock DB results
    - [x] Run `pnpm test` and confirm all tests pass

- [x] Task: Write failing tests for CSV export handler [ed796294]
    - [x] Test `exportGradebookCsvHandler`: CSV format correct (headers, student rows), formula injection mitigated via `escapeCsvValue`, admin ownership verified
    - [x] Run `pnpm test` and confirm tests fail

- [x] Task: Implement CSV export handler [ed796294]
    - [x] Add `exportGradebookCsvHandler` to `src/server/analytics-export.server.ts` (admin-only, per-assignment, uses existing private `escapeCsvValue` + `buildCsv`, dynamic checkpoint columns)
    - [x] Run `pnpm test` and confirm tests pass

- [ ] Task: Conductor - User Manual Verification 'Phase 2: Server Functions & Grade Recomputation' (Protocol in workflow.md)

## Phase 3: UI, Export & i18n

- [x] Task: Read spec.md and workflow.md to re-establish context before implementation
    - [x] Read `conductor/tracks/gradebook-final-grade-computation_20260725/spec.md`
    - [x] Read `conductor/workflow.md` (TDD lifecycle, commit format, checkpoint protocol)

- [x] Task: Add i18n keys
    - [x] Add `gradebook.*` keys to `locales/en.json` (title, finalGrade, letterGrade.A/B/C/D/F, status.complete/in_progress/incomplete, settings.scheme/equalWeight/customWeight/letterBounds/customWeights, exportCsv/exportExcel, empty/noGrades, configSummary, recomputeAll, staleWeightsWarning, analytics.gradeDistribution)
    - [x] Add same keys to `locales/id.json` with Indonesian translations
    - [x] Run `pnpm generate:i18n`
    - [x] Verify: `pnpm check:i18n` passes (parity EN↔ID — 48 keys added to both, parity confirmed; unused keys expected until UI is implemented in subsequent tasks)

- [x] Task: Write failing tests for instructor gradebook route
    - [x] Create `tests/unit/routes/instructor-gradebook.test.tsx`
    - [x] Test gradebook table renders with student rows, checkpoint columns, final grade column
    - [x] Test pass/fail Badge for non-rubric checkpoints, numeric score for rubric checkpoints
    - [x] Test read-only grade config summary at top (scheme, weights, bounds)
    - [x] Test export CSV + Excel buttons present
    - [x] Test admin-only "Recompute All Grades" button visible only to admins
    - [x] Test stale weights warning badge
    - [x] Run `pnpm test` and confirm tests fail

- [x] Task: Implement instructor gradebook route + components [0eb6f46d]
    - [x] Create route `src/routes/_authenticated/instructor/assignments/$id.gradebook.tsx`
    - [x] Create `src/components/gradebook/GradebookTable.tsx` (students × checkpoints table)
    - [x] Create `src/components/gradebook/GradeConfigSummary.tsx` (read-only config summary)
    - [x] Create `src/components/gradebook/RecomputeGradesButton.tsx` (admin-only, with confirmation + toast)
    - [x] Create `src/components/gradebook/GradebookExportButtons.tsx` (CSV + Excel export)
    - [x] Wire export CSV (via `useCsvDownload` + `exportGradebookCsv`) and Excel (via `exportGradebookToExcel`) buttons
    - [x] Add "Gradebook" link on instructor assignment detail page
    - [x] Modified `getAssignmentGradebookHandler` to allow admins + return `isAdmin`
    - [x] Added `exportGradebookCsv` server function stub in `analytics.ts`
    - [x] Changed instructor layout `requireRole` to include admin/superadmin
    - [x] Run `pnpm test` and confirm tests pass

- [x] Task: Write failing tests for admin grade settings dialog
    - [x] Create `tests/unit/components/gradebook-settings-dialog.test.tsx`
    - [x] Test scheme Select (equal_weight / custom_weight)
    - [x] Test custom weight Inputs appear only when `custom_weight` selected
    - [x] Test letter bound Inputs
    - [x] Test validation: custom weights must sum to 100 (error shown if not)
    - [x] Test save calls `saveGradeConfig` server function
    - [x] Run `pnpm test` and confirm tests fail

- [x] Task: Implement admin grade settings dialog
    - [x] Create `src/components/gradebook/GradeSettingsDialog.tsx` (Select for scheme, conditional Inputs for custom weights, Inputs for letter bounds)
    - [x] Use react-hook-form + Zod resolver (matching existing form patterns)
    - [x] Wire to `saveGradeConfig` server function
    - [x] Add "Grade Settings" button to admin template editor or admin analytics page
    - [x] Run `pnpm test` and confirm tests pass

- [x] Task: Write failing tests for student final grade card
    - [x] Create `tests/unit/components/student-final-grade-card.test.tsx`
    - [x] Test complete assignment: shows numeric score + letter badge
    - [x] Test in_progress assignment: shows current progress score + "in progress" status
    - [x] Test incomplete assignment: shows "incomplete" status
    - [x] Test collapsible per-checkpoint breakdown
    - [x] Test read-only (no edit controls)
    - [x] Run `pnpm test` and confirm tests fail

- [x] Task: Implement student final grade card
    - [x] Create `src/components/gradebook/StudentFinalGradeCard.tsx` (Card with score + letter Badge, collapsible breakdown)
    - [x] Wire to `getStudentFinalGrade` server function
    - [x] Mount on `/student/assignments/$id` page
    - [x] Run `pnpm test` and confirm tests pass

- [x] Task: Write failing tests for admin grade distribution analytics
    - [x] Create `tests/unit/server/analytics-grade-distribution.test.ts` (3 handler tests)
    - [x] Update `tests/unit/routes/admin-analytics.test.tsx` (2 route tests + mock data)
    - [x] Test "Grade Distribution" section renders with A/B/C/D/F progress bars
    - [x] Run `pnpm test` and confirm tests fail

- [x] Task: Implement admin grade distribution analytics
    - [x] Extend `getAdminAnalyticsDataHandler` with `gradeDistribution: { A, B, C, D, F }` aggregate query (9th query in Promise.all)
    - [x] Add "Grade Distribution" section to admin analytics page (`/admin/analytics`) with Progress bars
    - [x] Add `gradebook.analytics.gradeDistribution` i18n key to both locales
    - [x] Run `pnpm test` and confirm tests pass

- [x] Task: Implement Excel export helper
    - [x] Add `exportGradebookToExcel` to `src/lib/excel-export.ts` (client-side `.xlsx`, human-readable column headers, uses `sanitizeCell`)
    - [x] Wire to Excel export button on gradebook page (already wired in Task 4)
    - [x] Run `pnpm test` and confirm tests pass

- [x] Task: Final quality gate verification
    - [x] Run `pnpm test:coverage` — confirm ≥80% on all thresholds (stmts 87.95%, branches 81.89%, funcs 83.54%, lines 88.56%)
    - [x] Run `pnpm typecheck` — confirm clean
    - [x] Run `pnpm lint` — confirm clean (0 errors, 2 pre-existing warnings)
    - [x] Run `pnpm check:i18n` — confirm parity (927=927, 0 unused keys)
    - [x] Verify all files ≤500 lines (`check-modularity.js`)

- [ ] Task: Conductor - User Manual Verification 'Phase 3: UI, Export & i18n' (Protocol in workflow.md)
</protect>
