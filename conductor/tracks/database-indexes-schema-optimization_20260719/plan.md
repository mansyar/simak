<protect>
# Implementation Plan: Database Indexes & Schema Optimization

**Track ID:** `database-indexes-schema-optimization_20260719`
**Spec:** [./spec.md](./spec.md)

## Phase 1: Schema Changes with TDD [checkpoint: 50444d1]

- [x] Task: Read spec.md and workflow.md to prepare for Phase 1 implementation
    - [ ] Read `./spec.md` — review TR-1 (Schema Changes), TR-4 (Index Verification Tests - Unit), AC-1, AC-4, AC-6 through AC-10
    - [ ] Read `conductor/workflow.md` — review TDD lifecycle, commit format, quality gate requirements, and Phase Completion Verification Protocol

- [x] Task: Write failing unit test for Drizzle schema index declarations (Red Phase)
    - [ ] Create `tests/unit/db/schema/indexes.test.ts`
    - [ ] Add `/** @vitest-environment node */` at the top of the file (Drizzle schema imports pull in `pg` types)
    - [ ] Add test cases for each of the 9 expected indexes:
        - `assignment_students_assignment_id_student_id_idx` on `(assignmentId, studentId)` (PERF-7)
        - `assignment_students_student_id_idx` on `(studentId)` (PERF-7)
        - `notifications_created_at_idx` on `(createdAt)` (PERF-8)
        - `template_checkpoints_template_id_order_idx` on `(templateId, order)` (PERF-9)
        - `users_role_deleted_at_idx` on `(role, deletedAt)` (PERF-10)
        - `consultations_assignment_id_status_idx` on `(assignmentId, status)` (PERF-11)
        - `extension_requests_assignment_id_student_id_idx` on `(assignmentId, studentId)` (PERF-12)
        - `audit_log_actor_id_idx` on `(actorId)` (PERF-13)
        - `reviews_submission_id_created_at_idx` on `(submissionId, createdAt)` (PERF-14)
    - [ ] Run `pnpm vitest run tests/unit/db/schema/indexes.test.ts` and confirm all test cases FAIL (no indexes declared yet)

- [x] Task: Add indexes to tables currently with ZERO indexes (PERF-7, PERF-9, PERF-10)
    - [ ] `src/db/schema/assignments.ts` — Convert `assignmentStudents` from plain object to table-callback function; add 2 indexes: `(assignmentId, studentId)` and `(studentId)` (PERF-7)
    - [ ] `src/db/schema/templates.ts` — Convert `templateCheckpoints` from plain object to table-callback function; add 1 index: `(templateId, order)` (PERF-9)
    - [ ] `src/db/schema/users.ts` — Convert `users` from plain object to table-callback function; add 1 index: `(role, deletedAt)` (PERF-10)
    - [ ] Run `pnpm vitest run tests/unit/db/schema/indexes.test.ts` and confirm the 4 new-index test cases now PASS

- [x] Task: Replace low-cardinality indexes with composites (PERF-11, PERF-14)
    - [ ] `src/db/schema/consultations.ts` — Replace `(status)` index definition with `(assignmentId, status)` composite in existing callback; keep `consultations_checkpoint_id_idx` (PERF-11)
    - [ ] `src/db/schema/submissions.ts` — Replace `(submissionId)` index definition with `(submissionId, createdAt)` composite in `reviews` table callback (PERF-14)
    - [ ] Run `pnpm vitest run tests/unit/db/schema/indexes.test.ts` and confirm the 2 replacement test cases now PASS

- [x] Task: Add new indexes to existing callbacks (PERF-8, PERF-12, PERF-13)
    - [ ] `src/db/schema/notifications.ts` — Add `(createdAt)` index to existing callback; keep existing `(userId, read)` index (PERF-8)
    - [ ] `src/db/schema/extensions.ts` — Add `(assignmentId, studentId)` index to existing callback; keep existing `extension_requests_assignment_id_status_idx` (PERF-12)
    - [ ] `src/db/schema/audit-log.ts` — Add `(actorId)` index to existing callback; keep existing `(createdAt)`, `(action)`, `(entityType, entityId)` indexes (PERF-13)
    - [ ] Run `pnpm vitest run tests/unit/db/schema/indexes.test.ts` and confirm all 9 test cases now PASS (Green Phase)

- [x] Task: Verify unit tests pass + run quality gates (96f056c)
    - [ ] Run `pnpm test` — all existing 2,377+ tests pass (no regressions from schema changes)
    - [ ] Run `pnpm typecheck` — passes (no TypeScript errors introduced)
    - [ ] Run `pnpm lint` — passes (no lint errors introduced)
    - [ ] Commit: `feat(db): Add and replace database indexes for PERF-7 through PERF-14`
    - [ ] Attach git note with task summary (list of changed files, core why)
    - [ ] Record commit SHA in plan.md

- [x] Task: Conductor - User Manual Verification 'Phase 1: Schema Changes with TDD' (Protocol in workflow.md)

## Phase 2: Migration & Integration Verification

- [x] Task: Read spec.md and workflow.md to prepare for Phase 2 implementation
    - [x] Read `./spec.md` — review TR-2 (Migration Generation & Review), TR-3 (Migration Application), TR-4 (Integration test), TR-5 (Manual EXPLAIN ANALYZE), AC-2, AC-3, AC-5, AC-11
    - [x] Read `conductor/workflow.md` — review TDD lifecycle, commit format, Phase Completion Verification Protocol

- [x] Task: Write failing integration test for migration-applied indexes (Red Phase) (8cbed05)
    - [x] Create `tests/integration/db/migration-applied.test.ts`
    - [x] Add `/** @vitest-environment node */` at the top of the file
    - [x] Add test cases that query `pg_indexes` view for each of the 9 expected index names:
        - `assignment_students_assignment_id_student_id_idx`
        - `assignment_students_student_id_idx`
        - `notifications_created_at_idx`
        - `template_checkpoints_template_id_order_idx`
        - `users_role_deleted_at_idx`
        - `consultations_assignment_id_status_idx`
        - `extension_requests_assignment_id_student_id_idx`
        - `audit_log_actor_id_idx`
        - `reviews_submission_id_created_at_idx`
    - [x] Add setup/teardown to ensure docker-compose DB is available and migration is applied (header comment documents prerequisites; assertions inherently verify migration state — consistent with existing integration test patterns)
    - [x] Run `pnpm test:integration` and confirm tests FAIL (migration not yet generated/applied)

- [x] Task: Generate migration via `pnpm db:generate` and review SQL (TR-2) (c219fd6)
    - [x] Run `pnpm db:generate` to generate the migration SQL
    - [x] Open the generated `.sql` file in the drizzle output directory
    - [x] Verify exactly 9 `CREATE INDEX` statements (7 new + 2 replacements for PERF-11 and PERF-14)
    - [x] Verify exactly 2 `DROP INDEX` statements (for PERF-11 consultations + PERF-14 reviews replacements)
    - [x] Verify total: 11 DDL statements
    - [x] Verify index names follow Drizzle's auto-naming convention: `<table>_<col1>_<col2>_idx`
    - [x] If count is wrong, halt and investigate schema definition issue (investigated: spec estimation error — spec counted only 7 new indexes, not 2 replacement CREATE INDEX statements; implementation correct; user confirmed to proceed)
    - [ ] Commit: `chore(db): Generate migration for index additions and replacements`

- [x] Task: Apply migration to dev DB (TR-3)
    - [x] Ensure `docker compose up -d` is running (PostgreSQL container on port 5432)
    - [x] Run `pnpm db:migrate` to apply the migration (NOTE: drizzle-kit migrate did not apply migration 0008 due to pre-existing __drizzle_migrations table inconsistency — DB was set up via push, only 3/9 migrations recorded; applied SQL directly via `docker exec -i simak-postgres psql -U simak -d simak` piping the migration file)
    - [x] Verify migration applied cleanly (no errors) — all 11 DDL statements executed successfully (2 DROP + 9 CREATE)
    - [x] Run `pnpm test:integration tests/integration/db/migration-applied.test.ts` and confirm all 9 test cases now PASS (Green Phase) — 2 tests passed (all 9 indexes exist, 2 old indexes dropped)

- [x] Task: Run full quality gate suite
    - [x] Run `pnpm test` — all existing 2,377+ tests pass (no regressions) — 263 test files, 2459 tests passed (covered by pnpm test:coverage run)
    - [x] Run `pnpm typecheck` — passes (tsc --noEmit --incremental, no errors)
    - [x] Run `pnpm lint` — passes (0 warnings, 0 errors on 245 files with 91 rules, including simak-i18n/no-hardcoded)
    - [x] Run `pnpm check:i18n` — passes (563 keys used, 682 in en.json, 682 in id.json, all present)
    - [x] Run `pnpm test:coverage` — meets thresholds (87.62% stmts, 81.51% branches, 81.47% functions, 88.27% lines — all ≥80%)
    - [x] Attach git note with task summary — N/A for verification-only task; git note attached to plan update commit instead
    - [x] Record commit SHA in plan.md — N/A (no code changes; verification-only task, no code commit)

- [ ] Task: Manual EXPLAIN ANALYZE verification (TR-5)
    - [ ] Run `EXPLAIN ANALYZE` on admin dashboard `recentActivity` query — confirm Index Scan on `notifications_created_at_idx` (not Seq Scan)
    - [ ] Run `EXPLAIN ANALYZE` on ownership check query (`assignmentStudents` join) — confirm Index Scan on `assignment_students_assignment_id_student_id_idx`
    - [ ] Run `EXPLAIN ANALYZE` on `listPendingConsultationsHandler` query — confirm Index Scan on `consultations_assignment_id_status_idx`
    - [ ] Run `EXPLAIN ANALYZE` on review history query — confirm Index Scan on `reviews_submission_id_created_at_idx`
    - [ ] Document results in the Phase 2 checkpoint verification report

- [ ] Task: Conductor - User Manual Verification 'Phase 2: Migration & Integration Verification' (Protocol in workflow.md)
</protect>
