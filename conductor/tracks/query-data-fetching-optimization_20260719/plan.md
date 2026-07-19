<protect>
# Implementation Plan: Query & Data-Fetching Optimization

**Track ID:** `query-data-fetching-optimization_20260719`
**Spec:** [./spec.md](./spec.md)

## Phase 1: N+1 Query Elimination (FR-1) [checkpoint: f3df6e2]

- [x] Task: Read spec.md and workflow.md to prepare for Phase 1 implementation
    - [ ] Read `./spec.md` — review FR-1 (PERF-1 through PERF-6) and Acceptance Criteria #1–#4
    - [ ] Read `conductor/workflow.md` — review TDD lifecycle, commit format, and quality gates
    - [ ] Explore current implementations via codegraph: `listVerifiedCountsHandler`, `calculateExtensionAdjustment`, `bulkExtendHandler`, `adjustDeadlinesForBreach`, `dispatchSLABreachNotifications`, `bulk-import.server.ts` post-commit loop

- [x] Task: Rewrite listVerifiedCountsHandler with single GROUP BY query (PERF-1) [16c543c]
    - [ ] Write failing tests in `tests/unit/server/consultations.test.ts` (Node env): assert `listVerifiedCountsHandler` returns identical counts as before for a set of checkpoints, but issues a single `GROUP BY` query (not N per-checkpoint COUNTs) — mock `@/db/index` and `@/server/auth` — run `pnpm test` and confirm failures
    - [ ] Rewrite `listVerifiedCountsHandler` in `src/server/consultations.server.ts` to use a single `GROUP BY checkpointId` query returning counts for all checkpoints at once (use `inArray` + `groupBy`)
    - [ ] Run `pnpm test` — confirm all tests pass
    - [ ] Run quality gates: `pnpm typecheck && pnpm lint && pnpm check:i18n` — all pass
    - [ ] Commit: `refactor(consultations): Replace per-checkpoint COUNT loop with single GROUP BY query`
    - [ ] Attach git note with task summary
    - [ ] Record commit SHA in plan.md

- [x] Task: Replace sequential UPDATE loops with bulk UPDATE (PERF-2, PERF-3, PERF-4) [a1c1ece]
    - [ ] Write failing tests in `tests/unit/server/extensions-extras.test.ts` and `tests/unit/server/due-dates.test.ts` (Node env): assert `calculateExtensionAdjustment`, `bulkExtendHandler`, and `adjustDeadlinesForBreach` produce identical checkpoint dueDate updates as before, but issue a single bulk `UPDATE ... WHERE order > targetCheckpoint.order` instead of N per-checkpoint UPDATEs — run `pnpm test` and confirm failures
    - [ ] Rewrite `calculateExtensionAdjustment` in `src/server/extensions-extras.server.ts` to use bulk `UPDATE ... WHERE order > ?`
    - [ ] Rewrite `bulkExtendHandler` in `src/server/extensions-extras.server.ts` to use bulk `UPDATE ... WHERE order > ?`
    - [ ] Rewrite `adjustDeadlinesForBreach` (in `src/server/due-dates.server.ts` or `extensions-extras.server.ts`) to use bulk `UPDATE ... WHERE order > ?`
    - [ ] Run `pnpm test` — confirm all tests pass
    - [ ] Run quality gates: `pnpm typecheck && pnpm lint && pnpm check:i18n` — all pass
    - [ ] Commit: `refactor(extensions): Replace sequential checkpoint UPDATE loops with bulk UPDATE`
    - [ ] Attach git note with task summary
    - [ ] Record commit SHA in plan.md

- [x] Task: Refactor dispatchSLABreachNotifications (PERF-5) [de69169]
    - [ ] Write failing tests in `tests/unit/server/sla.test.ts` or `reviews.test.ts` (Node env): assert (1) no `channel: 'email'` notification rows are inserted (dead rows removed); (2) in-app notifications are inserted as a single batch `db.insert(notifications).values([...])` for all admins; (3) SLA alert emails are sent concurrently via `Promise.allSettled` (not sequentially) — run `pnpm test` and confirm failures
    - [ ] Refactor `dispatchSLABreachNotifications` in `src/server/sla.server.ts` (or `src/lib/sla.ts`): remove dead `channel: 'email'` INSERT rows, batch in-app INSERT into single `db.insert(notifications).values([...])`, send emails via `Promise.allSettled`
    - [ ] Run `pnpm test` — confirm all tests pass
    - [ ] Run quality gates: `pnpm typecheck && pnpm lint && pnpm check:i18n` — all pass
    - [ ] Commit: `refactor(sla): Batch SLA notification inserts and parallelize alert emails`
    - [ ] Attach git note with task summary
    - [ ] Record commit SHA in plan.md

- [x] Task: Refactor bulk-import post-commit (PERF-6) [23943d3]
    - [ ] Write failing tests in `tests/unit/server/bulk-import.test.ts` (Node env): assert (1) invitation emails are sent concurrently via `Promise.allSettled` (not sequentially); (2) audit log inserts are batched into a single `db.insert(auditLog).values([...])` — run `pnpm test` and confirm failures
    - [ ] Refactor `src/server/bulk-import.server.ts` post-commit: `Promise.allSettled` for invitation emails (each does locale lookup + enqueue), batch audit INSERT into single `db.insert(auditLog).values([...])`
    - [ ] Run `pnpm test` — confirm all tests pass
    - [ ] Run quality gates: `pnpm typecheck && pnpm lint && pnpm check:i18n` — all pass
    - [ ] Commit: `refactor(bulk-import): Parallelize invitation emails and batch audit inserts`
    - [ ] Attach git note with task summary
    - [ ] Record commit SHA in plan.md

- [x] Task: Conductor - User Manual Verification 'Phase 1: N+1 Query Elimination' (Protocol in workflow.md)

## Phase 2: Missing Pagination (FR-2)

- [x] Task: Read spec.md and workflow.md to prepare for Phase 2 implementation
    - [ ] Read `./spec.md` — review FR-2 (PERF-15 through PERF-21) and Acceptance Criteria #5, #6
    - [ ] Explore existing pagination pattern via codegraph: `listInstructorAssignmentsHandler` (page/limit Zod params, `Promise.all` for data + count, client-side `<Pagination>` component) — this is the pattern to replicate
    - [ ] Explore shared `<Pagination>` primitive location and props

- [x] Task: Add pagination to listConsultationsHandler (PERF-15) [d4d4655]
    - [ ] Write failing tests in `tests/unit/server/consultations.test.ts`: assert (1) handler accepts `page`/`limit` params; (2) returns `{ data, total, page, limit }`; (3) pagination edge cases (page beyond range returns empty, limit capped) — run `pnpm test` and confirm failures
    - [ ] Add `page`/`limit` Zod params to `listConsultations` stub in `src/server/consultations.ts`; add total count query via `Promise.all` in `listConsultationsHandler` in `src/server/consultations.server.ts`
    - [ ] Wire shared `<Pagination>` component on the client page that renders consultations
    - [ ] Run `pnpm test` — confirm all tests pass
    - [ ] Run quality gates: `pnpm typecheck && pnpm lint && pnpm check:i18n` — all pass
    - [ ] Commit: `feat(consultations): Add pagination to list handler`
    - [ ] Attach git note with task summary
    - [ ] Record commit SHA in plan.md

- [x] Task: Add pagination to listPendingConsultationsHandler (PERF-16) [17e70fe]
    - [x] Write failing tests: assert pagination params, total count, and edge cases — run `pnpm test` and confirm failures
    - [x] Add `page`/`limit` Zod params + total count query via `Promise.all` in `listPendingConsultationsHandler`
    - [x] Wire shared `<Pagination>` component on the instructor verification queue page
    - [x] Run `pnpm test` — confirm all tests pass
    - [x] Run quality gates: `pnpm typecheck && pnpm lint && pnpm check:i18n` — all pass
    - [x] Commit: `feat(consultations): Add pagination to pending consultations list`
    - [x] Attach git note with task summary
    - [x] Record commit SHA in plan.md

- [x] Task: Add pagination to listSubmissionsHandler (PERF-17) [2bc80d9]
    - [x] Write failing tests: assert pagination params, total count, and edge cases — run `pnpm test` and confirm failures
    - [x] Add `page`/`limit` Zod params + total count query via `Promise.all` in `listSubmissionsHandler` in `src/server/submissions.server.ts`
    - [x] Wire shared `<Pagination>` component on the submission history page
    - [x] Run `pnpm test` — confirm all tests pass
    - [x] Run quality gates: `pnpm typecheck && pnpm lint && pnpm check:i18n` — all pass
    - [x] Commit: `feat(submissions): Add pagination to list handler`
    - [x] Attach git note with task summary
    - [x] Record commit SHA in plan.md

- [x] Task: Add pagination to listTemplateAssignmentsHandler (PERF-18) [718c756]
    - [x] Write failing tests: assert pagination params, total count, and edge cases — run `pnpm test` and confirm failures
    - [x] Add `page`/`limit` Zod params + total count query via `Promise.all` in `listTemplateAssignmentsHandler`
    - [x] Wire shared `<Pagination>` component on the template assignments page
    - [x] Run `pnpm test` — confirm all tests pass
    - [x] Run quality gates: `pnpm typecheck && pnpm lint && pnpm check:i18n` — all pass
    - [x] Commit: `feat(templates): Add pagination to template assignments list`
    - [x] Attach git note with task summary
    - [x] Record commit SHA in plan.md

- [x] Task: Add pagination to listMyExtensionRequestsHandler (PERF-19) [540e518]
    - [x] Write failing tests: assert pagination params, total count, and edge cases — run `pnpm test` and confirm failures
    - [x] Add `page`/`limit` Zod params + total count query via `Promise.all` in `listMyExtensionRequestsHandler` in `src/server/extensions.server.ts`
    - [x] Wire shared `<Pagination>` component on the student extension history page
    - [x] Run `pnpm test` — confirm all tests pass
    - [x] Run quality gates: `pnpm typecheck && pnpm lint && pnpm check:i18n` — all pass
    - [x] Commit: `feat(extensions): Add pagination to extension requests list`
    - [x] Attach git note with task summary
    - [x] Record commit SHA in plan.md

- [x] Task: Add .limit(20) safety caps to dashboard queries (PERF-20, PERF-21) [ea386e1]
    - [x] Write failing tests: assert student dashboard `activeAssignments` and instructor dashboard `assignmentOverview` return at most 20 rows — run `pnpm test` and confirm failures
    - [x] Add `.limit(20)` to `activeAssignments` query in `getStudentDashboardDataHandler` and `assignmentOverview` query in `getInstructorDashboardDataHandler`
    - [x] Run `pnpm test` — confirm all tests pass
    - [x] Run quality gates: `pnpm typecheck && pnpm lint && pnpm check:i18n` — all pass
    - [x] Commit: `perf(dashboard): Add .limit(20) safety caps to dashboard queries`
    - [x] Attach git note with task summary
    - [x] Record commit SHA in plan.md

- [x] Task: Conductor - User Manual Verification 'Phase 2: Missing Pagination' (Protocol in workflow.md)

## Phase 3: Over-fetch, Parallel & Query Rewrite (FR-3, FR-4, FR-5, FR-6)

- [ ] Task: Read spec.md and workflow.md to prepare for Phase 3 implementation
    - [ ] Read `./spec.md` — review FR-3 (PERF-23, PERF-24), FR-4 (PERF-25, PERF-26), FR-5 (PERF-35), FR-6 (BUG-14) and Acceptance Criteria #7–#11
    - [ ] Explore current implementations via codegraph: `listNotificationsHandler`, `listTemplatesHandler`, `listInstructorAssignmentsHandler`, `listPendingReviewsHandler`, `submitCheckpointHandler`, `submitReviewHandler`, `getObjectContentLength`

- [ ] Task: Narrow listNotificationsHandler SELECT + explicit response construction (PERF-23)
    - [ ] Write failing tests in `tests/unit/server/notifications.test.ts`: assert (1) handler selects only `id, type, titleKey, messageKey, params, read, createdAt` (no `metadata`); (2) response objects are constructed explicitly (no `...item` spread leaking raw columns) — run `pnpm test` and confirm failures
    - [ ] Narrow the SELECT in `listNotificationsHandler` (`src/server/notifications.server.ts`) to specific columns; construct response objects explicitly after i18n resolution
    - [ ] Run `pnpm test` — confirm all tests pass
    - [ ] Run quality gates: `pnpm typecheck && pnpm lint && pnpm check:i18n` — all pass
    - [ ] Commit: `refactor(notifications): Narrow SELECT and construct response explicitly`
    - [ ] Attach git note with task summary
    - [ ] Record commit SHA in plan.md

- [ ] Task: Remove redundant locale query (PERF-24)
    - [ ] Write failing tests: assert `listNotificationsHandler` uses `session.user.locale` directly and does NOT issue a separate `SELECT locale FROM users` query — run `pnpm test` and confirm failures
    - [ ] Remove the `SELECT locale FROM users` query in `listNotificationsHandler`; use `session.user.locale` directly (already enriched in `auth.ts` via `_getSession`)
    - [ ] Run `pnpm test` — confirm all tests pass
    - [ ] Run quality gates: `pnpm typecheck && pnpm lint && pnpm check:i18n` — all pass
    - [ ] Commit: `refactor(notifications): Use session.user.locale instead of redundant locale query`
    - [ ] Attach git note with task summary
    - [ ] Record commit SHA in plan.md

- [ ] Task: Parallelize listTemplatesHandler independent queries (PERF-25)
    - [ ] Write failing tests: assert total count query and distinct types query run in parallel with the data query via `Promise.all` — run `pnpm test` and confirm failures
    - [ ] Refactor `listTemplatesHandler` (`src/server/templates.server.ts`) to run total count + distinct types in parallel with data query via `Promise.all`; checkpoint counts + names remain dependent on data query (run after)
    - [ ] Run `pnpm test` — confirm all tests pass
    - [ ] Run quality gates: `pnpm typecheck && pnpm lint && pnpm check:i18n` — all pass
    - [ ] Commit: `perf(templates): Parallelize independent count queries with Promise.all`
    - [ ] Attach git note with task summary
    - [ ] Record commit SHA in plan.md

- [ ] Task: Parallelize listInstructorAssignmentsHandler count query (PERF-26)
    - [ ] Write failing tests: assert total count query runs in parallel with the data query via `Promise.all` — run `pnpm test` and confirm failures
    - [ ] Refactor `listInstructorAssignmentsHandler` to run total count in parallel with data query via `Promise.all`; student counts remain dependent on data query (run after)
    - [ ] Run `pnpm test` — confirm all tests pass
    - [ ] Run quality gates: `pnpm typecheck && pnpm lint && pnpm check:i18n` — all pass
    - [ ] Commit: `perf(assignments): Parallelize count query with data query via Promise.all`
    - [ ] Attach git note with task summary
    - [ ] Record commit SHA in plan.md

- [ ] Task: Rewrite listPendingReviewsHandler with LATERAL join (PERF-35)
    - [ ] Write failing tests in `tests/unit/server/reviews.test.ts`: assert `listPendingReviewsHandler` returns identical results as before (same checkpoints, same latest submission per checkpoint) but uses a LATERAL join instead of a correlated subquery — run `pnpm test` and confirm failures
    - [ ] Rewrite the query in `listPendingReviewsHandler` (`src/server/reviews.server.ts` ~lines 109-114) to start from checkpoints and LATERAL join the latest submission per checkpoint (`ORDER BY version DESC LIMIT 1`) using Drizzle's `sql` template or `leftJoin` with a lateral subquery
    - [ ] Run `pnpm test` — confirm all tests pass
    - [ ] Run quality gates: `pnpm typecheck && pnpm lint && pnpm check:i18n` — all pass
    - [ ] Commit: `refactor(reviews): Replace correlated subquery with LATERAL join`
    - [ ] Attach git note with task summary
    - [ ] Record commit SHA in plan.md

- [ ] Task: Move R2 HEAD check before transaction (BUG-14)
    - [ ] Write failing tests in `tests/unit/server/submissions.test.ts` and `tests/unit/server/reviews.test.ts`: assert `getObjectContentLength` is called BEFORE `db.transaction()` opens in both `submitCheckpointHandler` and `submitReviewHandler` (verify call order via mock invocation order) — run `pnpm test` and confirm failures
    - [ ] Move `getObjectContentLength` call before `db.transaction()` in `submitCheckpointHandler` (`src/server/submissions.server.ts`) — handle the discriminated return type `{ ok: true, size } | { ok: false, reason }` before entering the transaction
    - [ ] Move `getObjectContentLength` call before `db.transaction()` in `submitReviewHandler` (`src/server/reviews.server.ts`) — same pattern
    - [ ] Run `pnpm test` — confirm all tests pass
    - [ ] Run quality gates: `pnpm typecheck && pnpm lint && pnpm check:i18n` — all pass
    - [ ] Commit: `fix(submissions): Move R2 HEAD check before transaction to avoid lock during I/O`
    - [ ] Attach git note with task summary
    - [ ] Record commit SHA in plan.md

- [ ] Task: Conductor - User Manual Verification 'Phase 3: Over-fetch, Parallel & Query Rewrite' (Protocol in workflow.md)

## Phase 4: Verification & Definition of Done

- [ ] Task: Read spec.md and workflow.md to prepare for Phase 4 implementation
    - [ ] Read `./spec.md` — review all Acceptance Criteria #1–#15 and Verification Strategy
    - [ ] Read `conductor/workflow.md` — review Phase Completion Verification and Checkpointing Protocol

- [ ] Task: Run EXPLAIN ANALYZE on rewritten queries (manual)
    - [ ] Start dev DB (`docker compose up -d`) and run `pnpm db:migrate` if needed
    - [ ] Run `EXPLAIN ANALYZE` on the LATERAL join query in `listPendingReviewsHandler` — confirm index scan on `submissions(checkpoint_id, version)`
    - [ ] Run `EXPLAIN ANALYZE` on the bulk UPDATEs in `calculateExtensionAdjustment`/`bulkExtendHandler`/`adjustDeadlinesForBreach`
    - [ ] Run `EXPLAIN ANALYZE` on key paginated queries (consultations, submissions, reviews) — confirm index scans post-TRACK-005
    - [ ] Document findings in the git note for the checkpoint commit

- [ ] Task: Structural grep verification
    - [ ] Grep for `for (const` in `.server.ts` files — confirm no N+1 patterns remain (sequential per-row queries)
    - [ ] Confirm all 5 list handlers have `page`/`limit` Zod params + total count queries
    - [ ] Confirm both dashboard queries have `.limit(20)`
    - [ ] Confirm `listNotificationsHandler` does not spread `...item` into the response
    - [ ] Confirm `getObjectContentLength` is called before `db.transaction()` in both handlers
    - [ ] Confirm PERF-36 (audit-log LIKE) is documented as deferred in `spec.md` Out of Scope

- [ ] Task: Run full quality gate suite
    - [ ] Run `pnpm test:coverage` — confirm ≥80% on lines, statements, branches, and functions
    - [ ] Run `pnpm typecheck` — passes
    - [ ] Run `pnpm lint` — passes (including `simak-i18n/no-hardcoded`)
    - [ ] Run `pnpm check:i18n` — parity passes (EN↔ID)
    - [ ] Verify no file in `src/`/`tests/`/`scripts/` exceeds 500 lines (`node scripts/check-modularity.js`)

- [ ] Task: Conductor - User Manual Verification 'Phase 4: Verification & Definition of Done' (Protocol in workflow.md)
</protect>
