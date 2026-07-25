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

## Phase 2: Server Functions & Grade Recomputation

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

- [ ] Task: Write failing tests for grade recomputation + default config helpers
    - [ ] Test `recomputeStudentGrade`: fetches student checkpoint data, calls `computeFinalGrade`, upserts `final_grades` row
    - [ ] Test `createDefaultGradeConfig`: inserts default config inside transaction
    - [ ] Run `pnpm test` and confirm tests fail

- [ ] Task: Implement grade recomputation + default config helpers
    - [ ] Add `recomputeStudentGrade(db, assignmentId, studentId)` to `src/server/reviews-extras.server.ts`
    - [ ] Add `createDefaultGradeConfig(tx, assignmentId)` to `src/server/assignments-extras.server.ts`
    - [ ] Run `pnpm test` and confirm tests pass

- [ ] Task: Wire triggers into existing handlers
    - [ ] Extend `submitReviewHandler` in `reviews.server.ts` post-commit advisory: call `recomputeStudentGrade` wrapped in try/catch, only when `decision === 'pass'` (~5 lines)
    - [ ] Extend `createAssignmentHandler` in `assignments.server.ts` inside transaction: call `createDefaultGradeConfig(tx, assignmentId)` (1-line call)
    - [ ] Update existing tests for both handlers to mock the new advisory calls
    - [ ] Run `pnpm test` and confirm all tests pass

- [ ] Task: Write failing tests for CSV export handler
    - [ ] Test `exportGradebookCsvHandler`: CSV format correct (headers, student rows), formula injection mitigated via `escapeCsvValue`, admin ownership verified
    - [ ] Run `pnpm test` and confirm tests fail

- [ ] Task: Implement CSV export handler
    - [ ] Add `exportGradebookCsvHandler` to `src/server/analytics-export.server.ts` (admin-only, per-assignment, uses existing private `escapeCsvValue` + `buildCsv`)
    - [ ] Run `pnpm test` and confirm tests pass

- [ ] Task: Conductor - User Manual Verification 'Phase 2: Server Functions & Grade Recomputation' (Protocol in workflow.md)

## Phase 3: UI, Export & i18n

- [ ] Task: Read spec.md and workflow.md to re-establish context before implementation
    - [ ] Read `conductor/tracks/gradebook-final-grade-computation_20260725/spec.md`
    - [ ] Read `conductor/workflow.md` (TDD lifecycle, commit format, checkpoint protocol)

- [ ] Task: Add i18n keys
    - [ ] Add `gradebook.*` keys to `locales/en.json` (title, finalGrade, letterGrade.A/B/C/D/F, status.complete/in_progress/incomplete, settings.scheme/equalWeight/customWeight/letterBounds/customWeights, exportCsv/exportExcel, empty/noGrades, configSummary, recomputeAll, staleWeightsWarning, analytics.gradeDistribution)
    - [ ] Add same keys to `locales/id.json` with Indonesian translations
    - [ ] Run `pnpm generate:i18n`
    - [ ] Verify: `pnpm check:i18n` passes (parity EN↔ID)

- [ ] Task: Write failing tests for instructor gradebook route
    - [ ] Create `tests/unit/routes/instructor-gradebook.test.tsx`
    - [ ] Test gradebook table renders with student rows, checkpoint columns, final grade column
    - [ ] Test pass/fail Badge for non-rubric checkpoints, numeric score for rubric checkpoints
    - [ ] Test read-only grade config summary at top (scheme, weights, bounds)
    - [ ] Test export CSV + Excel buttons present
    - [ ] Test admin-only "Recompute All Grades" button visible only to admins
    - [ ] Test stale weights warning badge
    - [ ] Run `pnpm test` and confirm tests fail

- [ ] Task: Implement instructor gradebook route + components
    - [ ] Create route `src/routes/_authenticated/instructor/assignments/$id/gradebook.tsx`
    - [ ] Create `src/components/gradebook/GradebookTable.tsx` (students × checkpoints table)
    - [ ] Create `src/components/gradebook/GradeConfigSummary.tsx` (read-only config summary)
    - [ ] Create `src/components/gradebook/RecomputeGradesButton.tsx` (admin-only, with confirmation)
    - [ ] Wire export CSV (via `useCsvDownload` + `exportGradebookCsv`) and Excel (via `exportGradebookToExcel`) buttons
    - [ ] Add "Gradebook" link on instructor assignment detail page
    - [ ] Run `pnpm test` and confirm tests pass

- [ ] Task: Write failing tests for admin grade settings dialog
    - [ ] Create `tests/unit/components/gradebook-settings-dialog.test.tsx`
    - [ ] Test scheme Select (equal_weight / custom_weight)
    - [ ] Test custom weight Inputs appear only when `custom_weight` selected
    - [ ] Test letter bound Inputs
    - [ ] Test validation: custom weights must sum to 100 (error shown if not)
    - [ ] Test save calls `saveGradeConfig` server function
    - [ ] Run `pnpm test` and confirm tests fail

- [ ] Task: Implement admin grade settings dialog
    - [ ] Create `src/components/gradebook/GradeSettingsDialog.tsx` (Select for scheme, conditional Inputs for custom weights, Inputs for letter bounds)
    - [ ] Use react-hook-form + Zod resolver (matching existing form patterns)
    - [ ] Wire to `saveGradeConfig` server function
    - [ ] Add "Grade Settings" button to admin template editor or admin analytics page
    - [ ] Run `pnpm test` and confirm tests pass

- [ ] Task: Write failing tests for student final grade card
    - [ ] Create `tests/unit/components/student-final-grade-card.test.tsx`
    - [ ] Test complete assignment: shows numeric score + letter badge
    - [ ] Test in_progress assignment: shows current progress score + "in progress" status
    - [ ] Test incomplete assignment: shows "incomplete" status
    - [ ] Test collapsible per-checkpoint breakdown
    - [ ] Test read-only (no edit controls)
    - [ ] Run `pnpm test` and confirm tests fail

- [ ] Task: Implement student final grade card
    - [ ] Create `src/components/gradebook/StudentFinalGradeCard.tsx` (Card with score + letter Badge, collapsible breakdown)
    - [ ] Wire to `getStudentFinalGrade` server function
    - [ ] Mount on `/student/assignments/$id` page
    - [ ] Run `pnpm test` and confirm tests pass

- [ ] Task: Write failing tests for admin grade distribution analytics
    - [ ] Create/update `tests/unit/routes/admin-analytics.test.tsx`
    - [ ] Test "Grade Distribution" section renders with A/B/C/D/F progress bars
    - [ ] Run `pnpm test` and confirm tests fail

- [ ] Task: Implement admin grade distribution analytics
    - [ ] Extend `getAdminAnalyticsDataHandler` with `gradeDistribution: { A, B, C, D, F }` aggregate query
    - [ ] Add "Grade Distribution" section to admin analytics page (`/admin/analytics`)
    - [ ] Run `pnpm test` and confirm tests pass

- [ ] Task: Implement Excel export helper
    - [ ] Add `exportGradebookToExcel` to `src/lib/excel-export.ts` (client-side `.xlsx`, human-readable column headers, uses `sanitizeCell`)
    - [ ] Wire to Excel export button on gradebook page
    - [ ] Run `pnpm test` and confirm tests pass

- [ ] Task: Final quality gate verification
    - [ ] Run `pnpm test:coverage` — confirm ≥80% on all thresholds
    - [ ] Run `pnpm typecheck` — confirm clean
    - [ ] Run `pnpm lint` — confirm clean (including `simak-i18n/no-hardcoded`)
    - [ ] Run `pnpm check:i18n` — confirm parity
    - [ ] Verify all files ≤500 lines (`check-modularity.js`)

- [ ] Task: Conductor - User Manual Verification 'Phase 3: UI, Export & i18n' (Protocol in workflow.md)
</protect>
