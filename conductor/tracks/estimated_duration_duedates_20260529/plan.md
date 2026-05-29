# Implementation Plan: Track 1.2 — Estimated Duration & Auto-Calculated DueDates

## Phase 1: Database Migration & Schema [checkpoint: TBD]

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
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Database Migration & Schema' (Protocol in workflow.md)

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

- [ ] Task: Update `CheckpointListEditor` component
  - [ ] Add number input field per checkpoint row for `estimated_duration`
  - [ ] Type: integer, min 0, default 7
  - [ ] Label: "Estimated Duration (days)"
  - [ ] Wire into form state for create/edit template flows
- [ ] Task: Update template server handlers
  - [ ] `createTemplateHandler`: include `estimated_duration` in checkpoint insert
  - [ ] `updateTemplateHandler`: include `estimated_duration` in checkpoint update
  - [ ] `getTemplateHandler`: return `estimated_duration` in response
  - [ ] `duplicateTemplateHandler`: copy `estimated_duration` with checkpoint duplication
- [ ] Task: Write tests for template duration UI changes
  - [ ] Test: `CheckpointListEditor` renders duration input per row
  - [ ] Test: Creating template persists estimated_duration per checkpoint
  - [ ] Test: Editing template updates estimated_duration
- [ ] Task: i18n — add translation keys for duration labels
  - [ ] Add keys to `locales/en.json` and `locales/id.json`
  - [ ] Regenerate i18n types via `pnpm generate:i18n`
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Template Admin UI' (Protocol in workflow.md)

---

## Phase 4: Assignment Creation Wizard — DueDate Preview & Override [checkpoint: TBD]

- [ ] Task: Add dueDate preview step to assignment creation wizard
  - [ ] After template selection → show calculated dueDates per checkpoint
  - [ ] Display: checkpoint name + calculated dueDate (read-only, editable date input)
  - [ ] Calculate on client-side based on template's estimated_durations for preview
  - [ ] Pass override values through wizard state to submission
- [ ] Task: Update wizard step components in `src/components/instructor/assignments/wizard/`
  - [ ] Add DueDatePreviewStep or integrate into existing step
  - [ ] Show clear visual: "Calculated from template durations"
  - [ ] Allow per-checkpoint date override
  - [ ] Show validation feedback if dates are out-of-order
- [ ] Task: Write tests for wizard dueDate preview
  - [ ] Test: DueDatePreviewStep renders calculated dates
  - [ ] Test: Instructor can override a date
  - [ ] Test: Override values are submitted with createAssignment
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Assignment Creation Wizard' (Protocol in workflow.md)

---

## Phase 5: Backfill Migration & Student-Facing Fixes [checkpoint: TBD]

- [ ] Task: Apply Drizzle migration to dev database
  - [ ] Run `pnpm db:migrate` to apply the `estimated_duration` column
  - [ ] Run backfill SQL for existing template_checkpoints (set default 14)
  - [ ] Run backfill SQL for existing checkpoints.dueDate (reconstruct from template)
  - [ ] Manual verification on dev DB
- [ ] Task: Fix student dashboard query (remove `IS NOT NULL` filter on dueDate)
  - [ ] Find the "Upcoming Deadlines" widget query in `src/server/dashboard-student.server.ts`
  - [ ] Remove `dueDate IS NOT NULL` condition now that real dates exist
- [ ] Task: Verify SLA breach `adjustDeadlinesForBreach` works with real dueDates
  - [ ] Review handler logic — ensure no NULL-skipping code paths
  - [ ] Update any guard conditions that filter out NULL dueDates
- [ ] Task: Write regression tests
  - [ ] Test: Student dashboard shows deadlines without NULL-filter
  - [ ] Test: SLA breach handler operates on non-NULL dueDates
- [ ] Task: Conductor - User Manual Verification 'Phase 5: Backfill & Student-Facing Fixes' (Protocol in workflow.md)

---

## Phase 6: Integration & Final Verification [checkpoint: TBD]

- [ ] Task: Run full test suite — unit + integration
  - [ ] `pnpm test -- --reporter=verbose` — confirm all tests pass
  - [ ] `pnpm typecheck` — no type errors
  - [ ] `pnpm lint` — no lint errors
- [ ] Task: Run coverage report
  - [ ] `pnpm test -- --coverage` — verify lines >= 80%, branches >= 72%
- [ ] Task: Final verification against acceptance criteria
  - [ ] Confirm all 12 acceptance criteria items are satisfied
- [ ] Task: Conductor - User Manual Verification 'Phase 6: Integration & Final Verification' (Protocol in workflow.md)
