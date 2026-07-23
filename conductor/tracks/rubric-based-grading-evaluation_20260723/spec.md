# Track Specification: Rubric-Based Grading & Evaluation (TRACK-020)

## Overview

SIMAK's current review workflow supports only pass/revise decisions with free-text comments. This track introduces **structured rubric-based grading** — admins define grading criteria (with optional qualitative levels) on template checkpoints, instructors score each criterion during review, and students see per-criterion breakdowns. Rubrics are optional per checkpoint: checkpoints without a rubric retain the current pass/fail flow unchanged.

Three grading modes per checkpoint:
- **`null` (no rubric)** — Current pass/fail behavior, no rubric UI (backward compatible)
- **`'numeric'`** — Direct 0–100 scoring per criterion
- **`'qualitative'`** — Level-based scoring with configurable numeric mapping per checkpoint

### Design Decisions (Confirmed)

1. **Weight snapshot in review_scores** — `review_scores` stores a denormalized snapshot of `weight` at review time, freezing historical weighted totals. If an admin later changes a criterion's weight, completed reviews retain their original weighted total.
2. **Strict validation on every save** — Every rubric save must pass full validation (weights must sum to 100%). No draft/partial-save mode.
3. **Dedicated analytics section** — Rubric analytics is a dedicated section/view, not inline cards on existing analytics dashboards.
4. **Live lookup + edit warning** — Rubric is looked up live from the template at review time (admin edits propagate to pending reviews). Completed reviews are frozen via the `review_scores` snapshot. Admin UI shows an affected-pending-review count warning before saving rubric edits.

## Context Anchors (Traceability)

- **PRD Reference:** `docs/PRD.md#assignment-templates` (template + checkpoint definition — admin-owned), `docs/PRD.md#checkpoints--submissions` (review workflow — currently pass/revise with comments, no structured evaluation), `docs/PRD.md#analytics--reporting` (rubric analytics extension point)
- **TDD Reference:** `docs/TDD.md` line 432 `template_checkpoints` table (extend with `grading_type`), line 503 `reviews` table (extend with criterion scores via `review_scores` join), line 316 §3 Data Model (new tables: `rubric_criteria`, `rubric_levels`, `review_scores`); `src/db/schema/assignments.ts` `checkpoints` table (add `templateCheckpointId` FK); `src/server/templates.server.ts:267` `updateTemplateHandler` (refactor from delete+reinsert to upsert)

## Functional Requirements

### FR-1: Schema — `grading_type` Column
- Add `grading_type` pgEnum column to `template_checkpoints` (nullable, defaults to `null`)
- Values: `null` = no rubric (pass/fail only), `'numeric'` = direct 0–100 scoring per criterion, `'qualitative'` = level-based scoring with configurable numeric mapping per checkpoint

### FR-2: Schema — `checkpoints.templateCheckpointId` FK
- Add `templateCheckpointId` FK column to `checkpoints` table (nullable for backward compat)
- Backfill existing rows at migration time via `assignments.templateId + order` matching
- Enables direct FK lookup of rubric data from per-student checkpoints

### FR-3: Schema — `rubric_criteria` Table
- FK to `template_checkpoints.id`
- Columns: `title` (string), `description` (string), `weight` (0–100, individual CHECK constraint), `order` (integer), `deletedAt` (nullable — soft-delete, never hard-delete, consistent with `assignments`/`assignmentTemplates` pattern)

### FR-4: Schema — `rubric_levels` Table
- FK to `template_checkpoints.id` (qualitative only)
- Columns: `label` (string), `description` (string), `score` (0–100, individual CHECK constraint), `order` (integer), `deletedAt` (nullable — soft-delete)
- Shared across all criteria in that checkpoint (v1 — per-criterion levels deferred to v2)

### FR-5: Schema — `review_scores` Table
- FK to `reviews.id`
- Columns: `criterionId` (FK to `rubric_criteria.id`), `criterionTitle` (denormalized string snapshot), `score` (0–100, denormalized), `weight` (denormalized integer snapshot — freezes historical weighted total), `rubricLevelId` (nullable FK to `rubric_levels.id` — qualitative only), `levelLabel` (denormalized string snapshot, nullable), `comment` (nullable string)
- Full denormalized snapshot so historical reviews are unaffected by later rubric edits — deleted criteria/levels remain visible via snapshot fields, and weight changes don't alter historical totals

### FR-6: Refactor — `updateTemplateHandler` Upsert
- Refactor `src/server/templates.server.ts:267` `updateTemplateHandler` from delete+reinsert (`db.delete(templateCheckpoints)` + `db.insert`) to upsert/diff approach
- Preserve existing checkpoint IDs when only metadata changes (name, minConsultations, estimatedDuration)
- Only create new IDs for genuinely new checkpoints, soft-delete removed checkpoints
- Required so rubric FKs (`rubric_criteria.templateCheckpointId`, `rubric_levels.templateCheckpointId`) survive template edits

### FR-7: Rubric Lookup Model
- Rubric is always looked up live from the template at review time via `checkpoints.templateCheckpointId → template_checkpoints → rubric_criteria/rubric_levels`
- Admin edits to rubric propagate to all pending reviews (submitted/under_review state)
- `review_scores` stores a full denormalized snapshot (score + criterion title + level label + weight) so completed reviews are preserved and frozen

### FR-8: Admin UI — Rubric Builder
- Integrated into `src/components/admin/templates/CheckpointListEditor.tsx` (used by `CreateTemplateDialog.tsx` and `TemplateCheckpointSection.tsx`)
- Per-checkpoint grading type selector (null/numeric/qualitative)
- Criteria editor: title, description, weight (0–100), order (add/remove/reorder)
- Qualitative level configurator: label, score (0–100), description (shown only when `grading_type` is `qualitative`)
- Weight sum validation (must = 100%, enforced at Zod application layer — not a DB CHECK constraint since it spans multiple rows)
- **Strict validation:** every save must pass full validation — no partial/draft saves allowed
- **Edit warning:** when editing rubric criteria/levels on a template with pending reviews (checkpoints in `submitted`/`under_review` state), show a confirmation dialog with the count of affected pending reviews before saving

### FR-9: Rubric CRUD Server Functions
- Create `rubrics.ts` (Zod schemas + `createServerFn` stubs) + `rubrics.server.ts` (handlers)
- CRUD: create/update/soft-delete criteria + levels per template checkpoint
- Admin-only (local `isAdmin` type guard, matching pattern in `templates.server.ts:24`)
- Zod validation: weights sum to 100% (application-layer), scores 0–100, grading type consistency (levels only when `qualitative`)

### FR-10: Instructor UI — Rubric Scoring
- Integrated into `src/components/reviews/ReviewForm.tsx` (rendered on `src/routes/_authenticated/instructor/reviews/$submissionId.tsx`)
- Render criteria alongside `ReviewFilePreview`
- Score each criterion: numeric `Slider`/`Input` (0–100) or qualitative `Select` (level → score) based on `grading_type`
- Auto-compute weighted checkpoint total
- All criteria must be scored before review submission
- Skip rubric UI entirely when `grading_type` is `null` (current pass/fail behavior unchanged)
- Re-validate all current criteria are scored at submit time (handles live-rubric-changes-mid-review edge case)

### FR-11: Instructor Data Fetch
- Extend `getReviewDetailHandler` (`src/server/reviews.server.ts:137`) to also return rubric criteria + levels for the checkpoint being reviewed
- Lookup via `checkpoints.templateCheckpointId → template_checkpoints → rubric_criteria/rubric_levels`

### FR-12: Instructor Submit
- Extend `SubmitReviewSchema` in `src/server/reviews.ts` with optional `scores` array: `z.array(z.object({ criterionId, score (0–100), rubricLevelId?, comment? })).optional()`
- Required when `grading_type` is not `null`, rejected when `null`
- Extend `submitReviewHandler` (`reviews.server.ts:220`) to persist scores via `review_scores` (with denormalized snapshot fields including `weight`)

### FR-13: Student UI — Rubric Result View
- Rubric result view on `src/routes/_authenticated/student/assignments/$id.checkpoints.$checkpointId.tsx`
- Per-criterion score, level label (if qualitative), instructor comment, weighted total
- Read-only, rendered alongside existing `SubmissionStatus` component
- Shows soft-deleted criteria via snapshot fields (criterionTitle, levelLabel, weight preserved)

### FR-14: Student Data Fetch
- Extend `getLatestReviewHandler` (`src/server/reviews-extras.server.ts:89`) to also return `review_scores` for the latest review
- Include denormalized `criterionTitle`, `levelLabel`, and `weight` snapshot fields

### FR-15: Rubric Analytics — Dedicated Section
- Dedicated rubric analytics section/view (not inline cards on existing dashboards)
- **Instructor:** avg score per criterion, criterion-level pass/fail rates
- **Admin:** cross-instructor criterion performance, class-wide weakness identification
- Extend `analytics-instructor.server.ts` and `analytics-admin.server.ts` with rubric metrics

### FR-16: CSV/Excel Export
- Extend `analytics-export.server.ts` + `src/lib/excel-export.ts` (from TRACK-019) for per-student criterion scores

### FR-17: i18n
- All new user-visible labels added to both `locales/en.json` and `locales/id.json` (`rubrics.*` namespace)
- Run `pnpm generate:i18n` after adding keys

## Non-Functional Requirements

### NFR-1: Backward Compatibility
- All schema additions are nullable/optional — existing checkpoints with no rubric (`grading_type: null`) work exactly as before
- `templateCheckpointId` FK backfill is non-destructive (nullable, backfilled via matching)

### NFR-2: Data Integrity
- Soft-delete (`deletedAt`) on `rubric_criteria` and `rubric_levels` — never hard-delete (consistent with existing pattern)
- Full denormalized snapshot in `review_scores` — historical reviews unaffected by later rubric edits, weight changes, or criteria deletion
- Weight-sum validation at Zod application layer (not DB CHECK — spans multiple rows)
- Individual CHECK constraints on `weight` (0–100) and `score` (0–100) at DB level

### NFR-3: Server Function Architecture
- Two-file split: `rubrics.ts` (Zod schemas + `createServerFn` stubs) + `rubrics.server.ts` (handlers, never client-bundled)
- Existing handlers extended in-place (`reviews.ts`, `reviews.server.ts`, `reviews-extras.server.ts`)
- Admin-only rubric CRUD via local `isAdmin` type guard
- Ownership guards on all instructor/student server functions

### NFR-4: Performance
- `templateCheckpointId` FK enables direct lookup (no JOIN through assignments needed for rubric data)
- Migration includes backfill — no runtime computation needed for existing rows

### NFR-5: File Size Limits
- All files under 500 lines (enforced by `scripts/check-modularity.js`)
- If `CheckpointListEditor.tsx` or `ReviewForm.tsx` would exceed 500 lines, extract sub-components

## Acceptance Criteria

### AC-1: Schema & Migration
- [ ] `grading_type` pgEnum column on `template_checkpoints` (nullable, defaults to `null`)
- [ ] `templateCheckpointId` FK on `checkpoints` (nullable, backfilled for existing rows)
- [ ] `rubric_criteria` table with `deletedAt` soft-delete, individual CHECK on `weight` 0–100
- [ ] `rubric_levels` table with `deletedAt` soft-delete, individual CHECK on `score` 0–100
- [ ] `review_scores` table with full denormalized snapshot (`criterionTitle`, `levelLabel`, `weight`)
- [ ] Migration applies cleanly, backfill populates `templateCheckpointId` correctly
- [ ] Rollback file created and verified

### AC-2: Template Handler Refactor
- [ ] `updateTemplateHandler` uses upsert/diff — checkpoint IDs preserved on metadata-only edits
- [ ] New checkpoint IDs created only for genuinely new checkpoints
- [ ] Removed checkpoints soft-deleted
- [ ] Rubric FKs survive template edits

### AC-3: Admin Rubric Builder
- [ ] Admin can set grading type per checkpoint (null/numeric/qualitative)
- [ ] Admin can create/edit/soft-delete criteria (title, description, weight, order)
- [ ] Admin can configure qualitative levels (label, score, description)
- [ ] Weight sum validation enforced (must = 100%) on every save — no partial saves
- [ ] Non-admins rejected from rubric CRUD
- [ ] Edit warning shows affected pending review count before saving rubric edits

### AC-4: Instructor Review
- [ ] Instructor sees rubric criteria when reviewing a checkpoint with `grading_type` set
- [ ] Numeric scoring: `Input`/`Slider` per criterion (0–100)
- [ ] Qualitative scoring: `Select` per criterion (level → score mapping)
- [ ] Weighted total auto-computed and displayed
- [ ] Unscored criteria block submission
- [ ] Checkpoints without rubric (`grading_type: null`) use current pass/fail flow unchanged
- [ ] `review_scores` persisted with denormalized snapshot (including `weight`)

### AC-5: Student View
- [ ] Student sees per-criterion scores, level labels (if qualitative), instructor comments, weighted total
- [ ] Soft-deleted criteria visible via snapshot fields
- [ ] Weighted total reflects the weight at review time (frozen, not live)

### AC-6: Analytics
- [ ] Dedicated rubric analytics section shows criterion-level performance (instructor + admin)
- [ ] Admin sees cross-instructor comparison and class-wide weakness identification
- [ ] CSV/Excel export includes per-student criterion scores

### AC-7: Quality Gates
- [ ] `pnpm test:coverage` >= 80% on all thresholds
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes (including `simak-i18n/no-hardcoded`)
- [ ] `pnpm check:i18n` parity (EN ↔ ID)
- [ ] All files under 500 lines

## Out of Scope

- Instructor-owned rubric library (rubrics are template-bound, admin-owned — centralized control per design decision)
- Per-criterion qualitative levels (v1 levels are per-checkpoint, shared across all criteria — per-criterion levels deferred to v2)
- Instructor weight adjustment (v2 — instructor can re-weight criteria per assignment but cannot add/remove criteria)
- Rubric revision proposal workflow (v2 — instructor suggests criteria changes, admin approves)
- Grade transcripts / final grade aggregation across checkpoints (separate future track)
- Reusable rubric fragments across templates (v2)
- Snapshot-at-review-open rubric model (live lookup chosen instead — simpler and more correct for pending reviews)
