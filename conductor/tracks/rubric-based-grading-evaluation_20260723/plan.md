<protect>
# Implementation Plan: Rubric-Based Grading & Evaluation (TRACK-020)

## Phase 1: Schema, Migration & Template Handler Refactor [checkpoint: 74ec52e]

- [x] Task: Read `spec.md` and `conductor/workflow.md` to re-establish context before starting Phase 1
- [x] Task: Add `grading_type` pgEnum and `templateCheckpointId` FK to schema (d5ed75d)
    - [ ] Write failing tests: Schema tests for `grading_type` pgEnum column on `template_checkpoints` (nullable, defaults to null), `templateCheckpointId` FK on `checkpoints` (nullable)
    - [ ] Implement: Add `gradingType` pgEnum column to `template_checkpoints` schema in `src/db/schema/assignments.ts`. Add `templateCheckpointId` FK column to `checkpoints` table
    - [ ] Verify: `pnpm test` passes

- [x] Task: Create `rubric_criteria`, `rubric_levels`, and `review_scores` tables [3e873b9]
    - [x] Write failing tests: Schema tests for `rubric_criteria` (FK to `template_checkpoints.id`, `weight` 0–100 CHECK, `deletedAt` soft-delete), `rubric_levels` (FK to `template_checkpoints.id`, `score` 0–100 CHECK, `deletedAt` soft-delete), `review_scores` (FK to `reviews.id`, denormalized `criterionTitle`/`levelLabel`/`weight` snapshot fields, `criterionId` FK, `rubricLevelId` nullable FK)
    - [x] Implement: Create new schema files for the three tables with FKs, CHECK constraints, and soft-delete columns
    - [x] Verify: `pnpm test` passes

- [x] Task: Generate migration, backfill `templateCheckpointId`, and create rollback file [1c33638]
    - [x] Write failing tests: Migration backfill test — `templateCheckpointId` correctly populated for existing checkpoints via `assignments.templateId + order` matching
    - [x] Implement: Run `pnpm db:generate`. Add backfill SQL to migration (UPDATE checkpoints SET templateCheckpointId = ... FROM assignments WHERE ...). Create rollback file per SQL styleguide §5.1
    - [x] Verify: `pnpm db:migrate` applies cleanly, backfill populates correctly, rollback works

- [x] Task: Refactor `updateTemplateHandler` to upsert/diff `18f7641`
    - [ ] Write failing tests: Tests for `updateTemplateHandler` — checkpoint IDs preserved on metadata-only edit (name/minConsultations/estimatedDuration change), new IDs created only for new checkpoints, removed checkpoints soft-deleted
    - [ ] Implement: Refactor `src/server/templates.server.ts:267` from delete+reinsert to upsert/diff approach
    - [ ] Verify: `pnpm test` passes, rubric FKs survive template edits

- [x] Task: Conductor - User Manual Verification 'Phase 1: Schema, Migration & Template Handler Refactor' (Protocol in workflow.md)

## Phase 2: Rubric CRUD — Admin [checkpoint: 60e01ff]

- [x] Task: Read `spec.md` and `conductor/workflow.md` to re-establish context before starting Phase 2
- [x] Task: Create `rubrics.ts` server function stubs + Zod schemas (3d91cd3)
    - [ ] Write failing tests: Zod schema validation tests — weights sum to 100% (application-layer), scores 0–100, grading type consistency (levels only when `qualitative`), criteria title required
    - [ ] Implement: Create `src/server/rubrics.ts` with Zod schemas (`CreateCriterionSchema`, `UpdateCriterionSchema`, `CreateLevelSchema`, `UpdateLevelSchema`, `SaveRubricSchema`) + `createServerFn` stubs (dynamically importing handlers)
    - [ ] Verify: `pnpm test` passes

- [x] Task: Create `rubrics.server.ts` handlers for rubric CRUD [8530978]
    - [ ] Write failing tests: Handler tests — create/update/soft-delete criteria + levels, admin-only via local `isAdmin` guard (non-admin rejected), weight-sum validation enforced, grading type consistency enforced
    - [ ] Implement: Create `src/server/rubrics.server.ts` with handlers: `saveRubricHandler` (create/update criteria + levels per checkpoint), `softDeleteCriterionHandler`, `softDeleteLevelHandler`. Admin-only via local `isAdmin` type guard (matching `templates.server.ts:24`)
    - [ ] Verify: `pnpm test` passes

- [x] Task: Admin rubric builder UI — grading type selector [074fcdb]
    - [x] Write failing tests: Component tests for grading type selector (null/numeric/qualitative dropdown), renders only when checkpoint is selected
    - [x] Implement: Add grading type `Select` to `src/components/admin/templates/CheckpointListEditor.tsx`. Wire to `saveRubric` server function
    - [x] Verify: `pnpm test` passes

- [x] Task: Admin rubric builder UI — criteria editor [6020cc1]
    - [x] Write failing tests: Component tests for criteria editor — add/remove/reorder criteria, title/description/weight inputs, weight sum validation display (must = 100%), strict validation on save
    - [x] Implement: Add criteria editor section to `CheckpointListEditor.tsx` (or extract `RubricCriteriaEditor.tsx` sub-component if file exceeds 500 lines). Wire to `saveRubric` server function
    - [x] Verify: `pnpm test` passes

- [x] Task: Admin rubric builder UI — qualitative level configurator (6aa8801)
    - [ ] Write failing tests: Component tests for level configurator — add/remove/reorder levels, label/score/description inputs, shown only when `grading_type` is `qualitative`, score 0–100 validation
    - [ ] Implement: Add qualitative level configurator to `CheckpointListEditor.tsx` (or extract `RubricLevelsEditor.tsx` sub-component). Wire to `saveRubric` server function
    - [ ] Verify: `pnpm test` passes

- [x] Task: Edit warning for pending reviews (c08cbf4)
    - [ ] Write failing tests: Test for pending-review count query — returns count of checkpoints in `submitted`/`under_review` state for a given template. Test for confirmation dialog rendering when count > 0
    - [ ] Implement: Add `countPendingReviewsForTemplate` server function. Add confirmation dialog in rubric builder UI showing affected count before save
    - [ ] Verify: `pnpm test` passes

- [x] Task: Conductor - User Manual Verification 'Phase 2: Rubric CRUD — Admin' (Protocol in workflow.md)

## Phase 3: Rubric-Based Review — Instructor

- [x] Task: Read `spec.md` and `conductor/workflow.md` to re-establish context before starting Phase 3
- [x] Task: Extend `SubmitReviewSchema` with optional `scores` array (bcb7b48)
    - [ ] Write failing tests: Zod schema tests — `scores` is optional, required when `grading_type` is not null, rejected when null. Each score object has `criterionId`, `score` (0–100), optional `rubricLevelId`, optional `comment`
    - [ ] Implement: Extend `SubmitReviewSchema` in `src/server/reviews.ts` with `scores: z.array(z.object({ criterionId, score (0–100), rubricLevelId?, comment? })).optional()`
    - [ ] Verify: `pnpm test` passes

- [x] Task: Extend `getReviewDetailHandler` to return rubric data (47ea15e)
    - [ ] Write failing tests: Handler tests — `getReviewDetailHandler` returns rubric criteria + levels when checkpoint has `grading_type` set (via `checkpoints.templateCheckpointId → template_checkpoints → rubric_criteria/rubric_levels`), returns empty/null when `grading_type` is null
    - [ ] Implement: Extend `getReviewDetailHandler` (`src/server/reviews.server.ts:137`) to fetch and return rubric criteria + levels
    - [ ] Verify: `pnpm test` passes

- [x] Task: Extend `submitReviewHandler` to persist `review_scores` (3bc9012)
    - [ ] Write failing tests: Handler tests — scores persisted to `review_scores` with denormalized snapshot (`criterionTitle`, `levelLabel`, `weight`), all criteria must be scored (unscored blocks submission), scores optional when `grading_type` is null, re-validates all current criteria at submit time (handles live rubric changes mid-review)
    - [ ] Implement: Extend `submitReviewHandler` (`reviews.server.ts:220`) to accept `scores`, look up criteria + levels for snapshot fields, insert into `review_scores`
    - [ ] Verify: `pnpm test` passes

- [x] Task: Instructor rubric scoring UI — numeric scoring (7e068fc)
    - [x] Write failing tests: Component tests for numeric criterion scoring — `Input`/`Slider` (0–100) per criterion, weighted total auto-computed and displayed, all criteria must be scored before submit
    - [x] Implement: Add numeric scoring section to `src/components/reviews/ReviewForm.tsx` (or extract `RubricScoringSection.tsx` sub-component if file exceeds 500 lines). Auto-compute weighted total client-side
    - [x] Verify: `pnpm test` passes

- [x] Task: Instructor rubric scoring UI — qualitative scoring
    - [x] Write failing tests: Component tests for qualitative criterion scoring — `Select` per criterion (level → score mapping), weighted total auto-computed, all criteria must be scored before submit
    - [x] Implement: Add qualitative scoring to `RubricScoringSection.tsx` — `Select` component mapping levels to scores
    - [x] Verify: `pnpm test` passes

- [ ] Task: Skip rubric UI when `grading_type` is null
    - [ ] Write failing tests: Component test — `ReviewForm` renders no rubric UI when `grading_type` is null, current pass/fail flow unchanged
    - [ ] Implement: Conditionally render rubric scoring section only when `grading_type` is not null
    - [ ] Verify: `pnpm test` passes, backward compatibility confirmed

- [ ] Task: Conductor - User Manual Verification 'Phase 3: Rubric-Based Review — Instructor' (Protocol in workflow.md)

## Phase 4: Student View, Analytics & i18n

- [ ] Task: Read `spec.md` and `conductor/workflow.md` to re-establish context before starting Phase 4
- [ ] Task: Extend `getLatestReviewHandler` to return `review_scores`
    - [ ] Write failing tests: Handler tests — `getLatestReviewHandler` returns `review_scores` including denormalized `criterionTitle`, `levelLabel`, and `weight` snapshot fields. Returns scores for soft-deleted criteria via snapshot
    - [ ] Implement: Extend `getLatestReviewHandler` (`src/server/reviews-extras.server.ts:89`) to fetch and return `review_scores`
    - [ ] Verify: `pnpm test` passes

- [ ] Task: Student rubric result view UI
    - [ ] Write failing tests: Component tests for student rubric result — per-criterion score, level label (if qualitative), instructor comment, weighted total (frozen from review time). Soft-deleted criteria visible via snapshot. Rendered alongside existing `SubmissionStatus` component
    - [ ] Implement: Add `RubricResultView.tsx` component on `src/routes/_authenticated/student/assignments/$id.checkpoints.$checkpointId.tsx`. Read-only display
    - [ ] Verify: `pnpm test` passes

- [ ] Task: Rubric analytics — instructor metrics
    - [ ] Write failing tests: Handler tests for instructor rubric analytics — avg score per criterion, criterion-level pass/fail rates. Returns metrics for instructor's assignments only
    - [ ] Implement: Extend `analytics-instructor.server.ts` with rubric metrics. Create dedicated rubric analytics view/section
    - [ ] Verify: `pnpm test` passes

- [ ] Task: Rubric analytics — admin metrics
    - [ ] Write failing tests: Handler tests for admin rubric analytics — cross-instructor criterion performance, class-wide weakness identification (lowest avg criteria across all instructors)
    - [ ] Implement: Extend `analytics-admin.server.ts` with rubric metrics. Create dedicated rubric analytics view/section
    - [ ] Verify: `pnpm test` passes

- [ ] Task: CSV/Excel export for per-student criterion scores
    - [ ] Write failing tests: Export tests — CSV and Excel output includes per-student criterion scores, valid format, CSV injection mitigation
    - [ ] Implement: Extend `analytics-export.server.ts` + `src/lib/excel-export.ts` with rubric score columns
    - [ ] Verify: `pnpm test` passes

- [ ] Task: i18n keys for all rubric labels
    - [ ] Write failing tests: i18n parity test — all new `rubrics.*` keys present in both `locales/en.json` and `locales/id.json`
    - [ ] Implement: Add i18n keys to both locale files. Run `pnpm generate:i18n`. Wire `t('key')` calls in all new components
    - [ ] Verify: `pnpm check:i18n` passes, `pnpm lint` passes (no hardcoded strings)

- [ ] Task: Final quality gate verification
    - [ ] Run `pnpm test:coverage` — verify ≥80% on all thresholds (lines, statements, branches, functions)
    - [ ] Run `pnpm typecheck` — verify clean
    - [ ] Run `pnpm lint` — verify clean (including `simak-i18n/no-hardcoded`)
    - [ ] Run `pnpm check:i18n` — verify EN ↔ ID parity
    - [ ] Verify all files in `src/`, `tests/`, `scripts/` are under 500 lines

- [ ] Task: Conductor - User Manual Verification 'Phase 4: Student View, Analytics & i18n' (Protocol in workflow.md)
</protect>
