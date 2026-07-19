<protect>
# Implementation Plan: Database Indexes & Schema Optimization

**Track ID:** `database-indexes-schema-optimization_20260719`
**Spec:** [./spec.md](./spec.md)

## Phase 1: Schema Changes with TDD

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

- [ ] Task: Read spec.md and workflow.md to prepare for Phase 2 implementation
    - [ ] Read `./spec.md` — review TR-2 (Migration Generation & Review), TR-3 (Migration Application), TR-4 (Integration test), TR-5 (Manual EXPLAIN ANALYZE), AC-2, AC-3, AC-5, AC-11
    - [ ] Read `conductor/workflow.md` — review TDD lifecycle, commit format, Phase Completion Verification Protocol

- [ ] Task: Write failing integration test for migration-applied indexes (Red Phase)
    - [ ] Create `tests/integration/db/migration-applied.test.ts`
    - [ ] Add `/** @vitest-environment node */` at the top of the file
    - [ ] Add test cases that query `pg_indexes` view for each of the 9 expected index names:
        - `assignment_students_assignment_id_student_id_idx`
        - `assignment_students_student_id_idx`
        - `notifications_created_at_idx`
        - `template_checkpoints_template_id_order_idx`
        - `users_role_deleted_at_idx`
        - `consultations_assignment_id_status_idx`
        - `extension_requests_assignment_id_student_id_idx`
        - `audit_log_actor_id_idx`
        - `reviews_submission_id_created_at_idx`
    - [ ] Add setup/teardown to ensure docker-compose DB is available and migration is applied
    - [ ] Run `pnpm test:integration` and confirm tests FAIL (migration not yet generated/applied)

- [ ] Task: Generate migration via `pnpm db:generate` and review SQL (TR-2)
    - [ ] Run `pnpm db:generate` to generate the migration SQL
    - [ ] Open the generated `.sql` file in the drizzle output directory
    - [ ] Verify exactly 7 `CREATE INDEX` statements
    - [ ] Verify exactly 2 `DROP INDEX` statements (for PERF-11 consultations + PERF-14 reviews replacements)
    - [ ] Verify total: 9 DDL statements
    - [ ] Verify index names follow Drizzle's auto-naming convention: `<table>_<col1>_<col2>_idx`
    - [ ] If count is wrong, halt and investigate schema definition issue
    - [ ] Commit: `chore(db): Generate migration for index additions and replacements`

- [ ] Task: Apply migration to dev DB (TR-3)
    - [ ] Ensure `docker compose up -d` is running (PostgreSQL container on port 5432)
    - [ ] Run `pnpm db:migrate` to apply the migration
    - [ ] Verify migration applied cleanly (no errors)
    - [ ] Run `pnpm test:integration tests/integration/db/migration-applied.test.ts` and confirm all 9 test cases now PASS (Green Phase)

- [ ] Task: Run full quality gate suite
    - [ ] Run `pnpm test` — all existing 2,377+ tests pass (no regressions)
    - [ ] Run `pnpm typecheck` — passes
    - [ ] Run `pnpm lint` — passes (including `simak-i18n/no-hardcoded` rule, though no UI changes)
    - [ ] Run `pnpm check:i18n` — passes (no new i18n keys needed)
    - [ ] Run `pnpm test:coverage` — meets thresholds (≥80% on lines, statements, branches, functions)
    - [ ] Attach git note with task summary
    - [ ] Record commit SHA in plan.md

- [ ] Task: Manual EXPLAIN ANALYZE verification (TR-5)
    - [ ] Run `EXPLAIN ANALYZE` on admin dashboard `recentActivity` query — confirm Index Scan on `notifications_created_at_idx` (not Seq Scan)
    - [ ] Run `EXPLAIN ANALYZE` on ownership check query (`assignmentStudents` join) — confirm Index Scan on `assignment_students_assignment_id_student_id_idx`
    - [ ] Run `EXPLAIN ANALYZE` on `listPendingConsultationsHandler` query — confirm Index Scan on `consultations_assignment_id_status_idx`
    - [ ] Run `EXPLAIN ANALYZE` on review history query — confirm Index Scan on `reviews_submission_id_created_at_idx`
    - [ ] Document results in the Phase 2 checkpoint verification report

- [ ] Task: Conductor - User Manual Verification 'Phase 2: Migration & Integration Verification' (Protocol in workflow.md)
</protect>
