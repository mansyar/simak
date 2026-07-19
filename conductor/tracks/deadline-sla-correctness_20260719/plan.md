<protect>
# Implementation Plan: Deadline & SLA Logic Correctness

**Track ID:** `deadline-sla-correctness_20260719`
**Spec:** [./spec.md](./spec.md)

## Phase 1: Documentation & Naming Fixes (BUG-3, BUG-16) [checkpoint: 6451fe2]

- [x] Task: Read spec.md and workflow.md to prepare for Phase 1 implementation
    - [x] Read `./spec.md` — review functional requirements, acceptance criteria, and out-of-scope items relevant to this phase
    - [x] Read `conductor/workflow.md` — review TDD lifecycle, commit format, and quality gate requirements

- [x] Task: Fix stale docstrings claiming finalDeadline mutation (BUG-3) [commit: 63d4eec]
    - [x] Write failing tests: assert that `calculateExtensionAdjustment`, `adjustDeadlinesForBreach`, and `bulkExtendHandler` do NOT modify `assignments.finalDeadline` (mock DB, call function, assert no UPDATE on assignments table) — NOTE: Behavior tests already exist and pass; behavior was already correct (Track 10). Only docstrings were stale.
    - [x] Update docstrings in `src/server/extensions-extras.server.ts` (`calculateExtensionAdjustment` lines 23-26, `bulkExtendHandler` lines 312-314) and `src/lib/review-sla.ts` (`adjustDeadlinesForBreach` lines 27-32) to remove claims of extending `finalDeadline`; document that they adjust per-student checkpoint `dueDate` values only
    - [x] Run `pnpm test` — confirm all tests pass (258 files, 2367 tests)
    - [x] Run quality gates: `pnpm typecheck && pnpm lint && pnpm check:i18n` — all pass
    - [x] Commit: `docs(deadlines): Update stale docstrings for finalDeadline immutability`
    - [x] Attach git note with task summary
    - [x] Record commit SHA in plan.md

- [x] Task: Fix SLA docstring and rename underReviewAt parameter (BUG-16) [commit: fdc72ab]
    - [x] Write failing tests: call `calculateBreachDuration` with new `anchorTime` parameter name; verify SLA duration is computed from submission upload time — created tests/unit/lib/sla.test.ts (12 tests)
    - [x] Update docstring in `src/lib/sla.ts` (lines 1-9) to state "SLA is 3 calendar days from submission upload time"
    - [x] Rename `underReviewAt` → `anchorTime` in `calculateBreachDuration` (`src/lib/sla.ts`)
    - [x] Rename local variable `underReviewAt` → `anchorTime` in `submitReviewHandler` (`src/server/reviews.server.ts` line 397)
    - [x] Run `pnpm test` — confirm all tests pass (259 files, 2379 tests)
    - [x] Run quality gates: `pnpm typecheck && pnpm lint && pnpm check:i18n` — all pass
    - [x] Commit: `fix(sla): Correct docstring and rename underReviewAt to anchorTime`
    - [x] Attach git note with task summary
    - [x] Record commit SHA in plan.md

- [x] Task: Conductor - User Manual Verification 'Phase 1: Documentation & Naming Fixes' (Protocol in workflow.md) — User approved checkpoint

## Phase 2: SQL & Dashboard Query Fixes (BUG-11, BUG-19) [checkpoint: c5437a8]

- [x] Task: Read spec.md and workflow.md to prepare for Phase 2 implementation
    - [x] Read `./spec.md` — review functional requirements, acceptance criteria, and out-of-scope items relevant to this phase
    - [x] Read `conductor/workflow.md` — review TDD lifecycle, commit format, and quality gate requirements (already in context from Phase 1)

- [x] Task: Fix daysOverdue SQL arithmetic in admin dashboard (BUG-11) [commit: 7c5e22c]
    - [x] Write failing tests: verify `daysOverdue` returns total elapsed days (not day-component) for a 45-day-old submission — mock the DB query result and assert the SQL template uses `EXTRACT(EPOCH FROM ...) / 86400`
    - [x] Replace `extract(day from now() - uploadedAt)` with `EXTRACT(EPOCH FROM now() - uploadedAt) / 86400` in SELECT (`src/server/dashboard-admin.server.ts` line 93)
    - [x] Apply same fix to ORDER BY (`src/server/dashboard-admin.server.ts` line 107)
    - [x] Run `pnpm test` — confirm all tests pass (259 files, 2381 tests)
    - [x] Run quality gates: `pnpm typecheck && pnpm lint && pnpm check:i18n` — all pass
    - [x] Commit: `fix(dashboard): Correct daysOverdue SQL to use total elapsed days`
    - [x] Attach git note with task summary
    - [x] Record commit SHA in plan.md

- [x] Task: Fix upcomingDeadlines query and null dueDate handling (BUG-19) [commit: f65c6c7]
    - [x] Write failing tests: (1) verify `passed` checkpoints are excluded from `upcomingDeadlines`; (2) verify null `dueDate` results in `isOverdue=false` and `daysRemaining=null`
    - [x] Add WHERE clause to filter out `passed` checkpoints in `upcomingDeadlines` query (`src/server/dashboard-student.server.ts` lines 47-59)
    - [x] Update null `dueDate` handling: set `isOverdue=false`, `daysRemaining=null` instead of `new Date()` fallback (`src/server/dashboard-student.server.ts` lines 174-181)
    - [x] Add i18n key for "No deadline" display text in `locales/en.json` and `locales/id.json`; run `pnpm generate:i18n`
    - [x] Update `StudentDashboard.tsx` to display the localized "No deadline" text when `daysRemaining` is null
    - [x] Run `pnpm test` — confirm all tests pass (260 files, 2385 tests)
    - [x] Run quality gates: `pnpm typecheck && pnpm lint && pnpm check:i18n` — all pass
    - [x] Commit: `fix(dashboard): Exclude passed checkpoints and handle null dueDate in student dashboard`
    - [x] Attach git note with task summary
    - [x] Record commit SHA in plan.md

- [x] Task: Conductor - User Manual Verification 'Phase 2: SQL & Dashboard Query Fixes' (Protocol in workflow.md) — User approved checkpoint

## Phase 3: Validation Logic (BUG-12, BUG-18)

- [ ] Task: Read spec.md and workflow.md to prepare for Phase 3 implementation
    - [ ] Read `./spec.md` — review functional requirements, acceptance criteria, and out-of-scope items relevant to this phase
    - [ ] Read `conductor/workflow.md` — review TDD lifecycle, commit format, and quality gate requirements

- [ ] Task: Add finalDeadline cap to validateDueDates (BUG-12)
    - [ ] Write failing tests: (1) verify `validateDueDates` rejects checkpoint `dueDate` exceeding `finalDeadline` when provided; (2) verify it does NOT enforce the cap when `finalDeadline` is omitted (backward compatible)
    - [ ] Add optional `finalDeadline?: Date` parameter to `validateDueDates` in `src/server/due-dates.server.ts`
    - [ ] Implement validation: reject any checkpoint `dueDate` > `finalDeadline` with descriptive error
    - [ ] Wire `finalDeadline` argument at all assignment-creation call sites (search for `validateDueDates` callers)
    - [ ] Run `pnpm test` — confirm all tests pass
    - [ ] Run quality gates: `pnpm typecheck && pnpm lint && pnpm check:i18n`
    - [ ] Commit: `fix(deadlines): Add finalDeadline cap to validateDueDates at creation time`
    - [ ] Attach git note with task summary
    - [ ] Record commit SHA in plan.md

- [ ] Task: Add validation to extendDeadlineHandler (BUG-18)
    - [ ] Write failing tests: (1) verify past `newDueDate` is rejected; (2) verify non-sequential dueDates are rejected; (3) verify `assignments.finalDeadline` is NOT modified
    - [ ] Add future-date validation to `extendDeadlineHandler` (`src/server/assignments-extras.server.ts` lines 99-148)
    - [ ] Add sequential-ordering validation relative to adjacent checkpoints
    - [ ] Return descriptive validation errors on failure
    - [ ] Confirm NO `finalDeadline` mutation (immutable per Track 10)
    - [ ] Run `pnpm test` — confirm all tests pass
    - [ ] Run quality gates: `pnpm typecheck && pnpm lint && pnpm check:i18n`
    - [ ] Commit: `fix(extensions): Add date validation to extendDeadlineHandler`
    - [ ] Attach git note with task summary
    - [ ] Record commit SHA in plan.md

- [ ] Task: Conductor - User Manual Verification 'Phase 3: Validation Logic' (Protocol in workflow.md)

## Phase 4: Notification Cleanup (BUG-21)

- [ ] Task: Read spec.md and workflow.md to prepare for Phase 4 implementation
    - [ ] Read `./spec.md` — review functional requirements, acceptance criteria, and out-of-scope items relevant to this phase
    - [ ] Read `conductor/workflow.md` — review TDD lifecycle, commit format, and quality gate requirements

- [ ] Task: Remove dead channel:'email' notification rows from dispatchSLABreachNotifications (BUG-21)
    - [ ] Write failing tests: verify `dispatchSLABreachNotifications` inserts only `channel: 'in_app'` rows (not `channel: 'email'`); verify `sendSLAAlertEmail` is still called
    - [ ] Remove the `channel: 'email'` INSERT block from `src/lib/review-sla.ts` (lines 117-130)
    - [ ] Keep in-app notification INSERT (lines 99-115) and `sendSLAAlertEmail` call (lines 132-140) intact
    - [ ] Run `pnpm test` — confirm all tests pass
    - [ ] Run quality gates: `pnpm typecheck && pnpm lint && pnpm check:i18n`
    - [ ] Commit: `fix(sla): Remove dead channel:email notification rows from dispatchSLABreachNotifications`
    - [ ] Attach git note with task summary
    - [ ] Record commit SHA in plan.md

- [ ] Task: Conductor - User Manual Verification 'Phase 4: Notification Cleanup' (Protocol in workflow.md)

## Phase 5: effectiveDeadline Derivation (BUG-28)

- [ ] Task: Read spec.md and workflow.md to prepare for Phase 5 implementation
    - [ ] Read `./spec.md` — review functional requirements, acceptance criteria, and out-of-scope items relevant to this phase
    - [ ] Read `conductor/workflow.md` — review TDD lifecycle, commit format, and quality gate requirements

- [ ] Task: Create computeEffectiveDeadline helper and update all call sites (BUG-28)
    - [ ] Write failing tests for `computeEffectiveDeadline(checkpoints)` helper: (1) returns first non-passed checkpoint's `dueDate` when checkpoints have mixed statuses; (2) returns last checkpoint's `dueDate` when all are `passed`; (3) handles empty checkpoints array gracefully (returns null or throws descriptive error)
    - [ ] Implement `computeEffectiveDeadline` helper function in `src/server/due-dates.server.ts` (co-located with `calculateDueDates` and `validateDueDates`)
    - [ ] Refactor `listStudentAssignmentsHandler` (`src/server/assignments-extras.server.ts` lines 220-224) to use the helper — remove the `highestOrderByAssignment` iteration pattern
    - [ ] Refactor `getStudentAssignmentDetailHandler` (`src/server/assignments-extras.server.ts` lines 331-335) to use the helper — remove the `reduce` that finds highest-order checkpoint
    - [ ] Refactor `getStudentDashboardDataHandler` (`src/server/dashboard-student.server.ts` lines 144-151) to use the helper
    - [ ] Run `pnpm test` — confirm all tests pass
    - [ ] Run quality gates: `pnpm typecheck && pnpm lint && pnpm check:i18n`
    - [ ] Commit: `fix(deadlines): Use first non-passed checkpoint for effectiveDeadline via shared helper`
    - [ ] Attach git note with task summary
    - [ ] Record commit SHA in plan.md

- [ ] Task: Conductor - User Manual Verification 'Phase 5: effectiveDeadline Derivation' (Protocol in workflow.md)
</protect>
