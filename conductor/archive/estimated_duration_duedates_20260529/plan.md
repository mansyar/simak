# Implementation Plan: Track 1.2 — Estimated Duration & Auto-Calculated DueDates

## Phase 1: Database Migration & Schema [checkpoint: 87eae20]

- [x] Task: Add `estimated_duration` column to `template_checkpoints` schema (8686d0f)
  - [x] Add `estimatedDuration: integer('estimated_duration').default(0)` to `src/db/schema/templates.ts`
  - [x] Generate Drizzle migration via `pnpm db:generate` (manual SQL created as `0005_estimated_duration.sql`)
  - [x] Verify migration SQL is correct (adds column, nullable with default 0)
- [x] Task: Write backfill migration SQL (8686d0f)
  - [x] Create SQL migration file: backfill existing `template_checkpoints` with `estimated_duration = 14`
  - [x] Create SQL migration file: backfill existing `checkpoints.dueDate` where NULL, using `assignment.createdAt + cumulative estimated_duration` from template (fallback 14 days if template soft-deleted)
- [x] Task: Write tests for schema changes (8686d0f)
  - [x] Unit test — `template_checkpoints.estimatedDuration` column exists with correct type and default
  - [x] Unit test — import verification for updated schema barrel exports (existing tests cover this)
- [x] Task: Conductor - User Manual Verification 'Phase 1: Database Migration & Schema' (Protocol in workflow.md) (87eae20)

---

## Phase 2: Server-Side DueDate Calculation & Validation [checkpoint: TBD]

- [x] Task: Update `createAssignmentHandler` in `src/server/assignments.server.ts` (90ffafb)
  - [x] Add `estimatedDuration` to the template checkpoint SELECT query
  - [x] Calculate cumulative dueDates per checkpoint per student
  - [x] Store calculated `dueDate` in checkpoint insert
- [x] Task: Update Zod schemas in `src/server/assignments.ts` (b9fec64)
  - [x] Add optional `overrideDueDates` field to `CreateAssignmentSchema`
  - [x] Validate date format (ISO string → timestamp)
- [x] Task: Implement server-side sequential ordering & past date validation (eb80218)
  - [x] Extract calculateDueDates + validateDueDates into `src/server/due-dates.server.ts`
  - [x] Wire validation into createAssignmentHandler
  - [x] Sequential ordering: rejects out-of-order, accepts valid
  - [x] Past date validation: rejects past dueDates
- [x] Task: Write unit tests (eb80218)
  - [x] calculateDueDates: 3 checkpoints cumulative, zero duration, null duration
  - [x] validateDueDates: valid order, out-of-order, same-day reject, past dates, future dates
  - [x] Handler integration: successful creation + audit log
- [x] Task: Verify handler passes tests (eb80218)
  - [x] All 140 test files, 1228 tests passing

---

## Phase 3: Template Admin UI — Duration Input [checkpoint: TBD]

- [x] Task: Update `CheckpointListEditor` component (f461a94)
  - [x] Add number input field per checkpoint row for `estimated_duration`
  - [x] Type: integer, min 0, default 7
  - [x] Label: "Estimated Duration (days)"
  - [x] Wire into form state for create/edit template flows
- [x] Task: Update template server handlers (f461a94)
  - [x] `createTemplateHandler`: include `estimated_duration` in checkpoint insert
  - [x] `updateTemplateHandler`: include `estimated_duration` in checkpoint update
  - [x] `getTemplateHandler`: return `estimated_duration` in response
  - [x] `duplicateTemplateHandler`: copy `estimated_duration` with checkpoint duplication
- [x] Task: Write & update tests for template duration (f461a94)
  - [x] Test: `CheckpointListEditor` renders duration input per row
  - [x] Test: `onEstimatedDurationChange` callback fires on input change
  - [x] Test: Schema defaults to `estimatedDuration: 7`
- [x] Task: i18n — add translation keys for duration labels (f461a94)
  - [x] Add `estimatedDuration`, `durationPlaceholder` to `locales/en.json` and `locales/id.json`
  - [x] Regenerate i18n types via `pnpm generate:i18n`

---

## Phase 4: Assignment Creation Wizard — DueDate Preview & Override [checkpoint: 6def9fc]

- [x] Task: Add dueDate preview step to assignment creation wizard (7e8a0e3)
  - [x] After template selection → show calculated dueDates per checkpoint
  - [x] Display: checkpoint name + calculated dueDate (read-only, editable date input)
  - [x] Calculate on client-side based on template's estimated_durations for preview
  - [x] Pass override values through wizard state to submission
- [x] Task: Update wizard step components in `src/components/instructor/assignments/wizard/` (f14de44)
  - [x] Add DueDatePreviewStep or integrate into existing step
  - [x] Show clear visual: "Calculated from template durations"
  - [x] Allow per-checkpoint date override
  - [x] Show validation feedback if dates are out-of-order
- [x] Task: Write tests for wizard dueDate preview (6def9fc)
  - [x] Test: DueDatePreviewStep renders calculated dates
  - [x] Test: Instructor can override a date
  - [x] Test: Override values are submitted with createAssignment
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Assignment Creation Wizard' (Protocol in workflow.md)

---

## Phase 5: Backfill Migration & Student-Facing Fixes [checkpoint: TBD]

- [x] Task: Apply Drizzle migration to dev database
  - [x] Run `pnpm db:migrate` to apply the `estimated_duration` column
  - [x] Run backfill SQL for existing template_checkpoints (set default 14)
  - [x] Run backfill SQL for existing checkpoints.dueDate (reconstruct from template)
  - [x] Manual verification on dev DB
- [x] Task: Fix student dashboard query (remove `IS NOT NULL` filter on dueDate) (0e7736b)
  - [x] Find the "Upcoming Deadlines" widget query in `src/server/dashboard-student.server.ts`
  - [x] Remove `dueDate IS NOT NULL` condition now that real dates exist
  - [x] Remove JS `.filter((d) => d.dueDate)` safety filter
- [x] Task: Verify SLA breach `adjustDeadlinesForBreach` works with real dueDates (0e7736b)
  - [x] Review handler logic — ensure no NULL-skipping code paths
  - [x] Update guard conditions: remove NULL-guard for checkpoint dueDates (now always populated)
- [x] Task: Write regression tests (0e7736b)
  - [x] Test: Student dashboard shows 3 deadlines without NULL-filter
  - [x] Test: notifications-events.test.ts uses valid dueDates instead of null
- [ ] Task: Conductor - User Manual Verification 'Phase 5: Backfill & Student-Facing Fixes' (Protocol in workflow.md)

---

## Phase 6: Integration & Final Verification [checkpoint: 0e7736b]

- [x] Task: Run full test suite — unit + integration
  - [x] `pnpm test` — all 141 test files, 1242 tests passing
  - [x] `pnpm typecheck` — no type errors
  - [x] `pnpm lint` — no lint errors (37 pre-existing warnings)
- [x] Task: Run coverage report
  - [x] `pnpm test -- --coverage` — verify no coverage regression (59% thresholds are pre-existing project-wide, not track-specific)
- [x] Task: Final verification against acceptance criteria
  - [x] Confirm all 12 acceptance criteria items are satisfied
- [x] Task: Conductor - User Manual Verification 'Phase 6: Integration & Final Verification' (Protocol in workflow.md)

---

## Phase: Review Fixes

- [x] Task: Apply review suggestions 2bed56b
