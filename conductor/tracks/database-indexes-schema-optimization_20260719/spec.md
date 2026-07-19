<protect>
# Track: Database Indexes & Schema Optimization

**Track ID:** `database-indexes-schema-optimization_20260719`
**Roadmap Reference:** TRACK-005 (docs/roadmap.md lines 280-343)
**Type:** `chore`
**Status:** INIT
**Created:** 2026-07-19

## Overview

This track addresses 8 performance audit findings (PERF-7 through PERF-14) by adding missing database indexes and replacing 2 low-cardinality / suboptimal indexes with better composites. The result: faster list/dashboard queries, elimination of full-table scans on the admin dashboard's `recentActivity` query, and proper index coverage for the most-queried join table (`assignmentStudents`, which currently has ZERO indexes).

The track is purely additive in terms of behavior — no application code logic changes, no UI changes, no i18n changes. Only Drizzle schema definitions (7 files) and one generated migration.

### Why This Track Exists

A three-way audit (bugs, performance, UX) identified 30 performance issues. The 8 PERF issues in this track are the index-related subset: tables with ZERO indexes (`assignmentStudents`, `templateCheckpoints`, `users`), tables with low-cardinality standalone indexes that should be composites (`consultations.status`, `reviews.submissionId`), and tables missing a critical index (`notifications.createdAt`, `extensionRequests.assignmentId+studentId`, `auditLog.actorId`).

### Dependencies

- **None** — this track is a prerequisite for TRACK-006 (Query & Data-Fetching Optimization), not the other way around. Indexes must be in place before query plans can be optimized.

## Audit IDs Addressed

| Audit ID | Severity | Table | Change |
|----------|---------|-------|--------|
| PERF-7 | HIGH | `assignmentStudents` | Add `(assignmentId, studentId)` + `(studentId)` indexes (currently ZERO indexes) |
| PERF-8 | HIGH | `notifications` | Add `(createdAt)` index (fixes admin dashboard full-table scan) |
| PERF-9 | — | `templateCheckpoints` | Add `(templateId, order)` index (currently ZERO indexes) |
| PERF-10 | — | `users` | Add `(role, deletedAt)` index for admin user list filtering |
| PERF-11 | — | `consultations` | REPLACE `(status)` with `(assignmentId, status)` composite |
| PERF-12 | — | `extensionRequests` | Add `(assignmentId, studentId)` index |
| PERF-13 | — | `auditLog` | Add `(actorId)` index for JOIN in listAuditLogsHandler |
| PERF-14 | — | `reviews` | REPLACE `(submissionId)` with `(submissionId, createdAt)` composite |

**Total DDL changes:** 7 `CREATE INDEX` + 2 `DROP INDEX` = 9 statements in the generated migration.

## Technical Requirements

### TR-1: Schema Changes (7 files in `src/db/schema/`)

For each table below, either add a table-callback function (where the table is currently a plain object) or modify an existing callback:

| File | Table | Change | Notes |
|------|-------|--------|-------|
| `assignments.ts` | `assignmentStudents` | Add table-callback with 2 indexes: `(assignmentId, studentId)` and `(studentId)` | Currently a plain object — needs callback function added |
| `notifications.ts` | `notifications` | Add `(createdAt)` index to existing callback | Keep existing `(userId, read)` index as-is |
| `templates.ts` | `templateCheckpoints` | Add table-callback with 1 index: `(templateId, order)` | Currently a plain object — needs callback function added |
| `users.ts` | `users` | Add table-callback with 1 index: `(role, deletedAt)` | Currently a plain object — needs callback function added |
| `consultations.ts` | `consultations` | REPLACE `(status)` index with `(assignmentId, status)` composite | Keep existing `consultations_checkpoint_id_idx` |
| `extensions.ts` | `extensionRequests` | Add `(assignmentId, studentId)` to existing callback | Keep existing `extension_requests_assignment_id_status_idx` |
| `submissions.ts` | `reviews` | REPLACE `(submissionId)` index with `(submissionId, createdAt)` composite | Leftmost prefix satisfies FK enforcement |

### TR-2: Migration Generation & Review

1. Run `pnpm db:generate` to generate the migration SQL.
2. Open the generated `.sql` file in `drizzle/` and verify:
   - Exactly 7 `CREATE INDEX` statements
   - Exactly 2 `DROP INDEX` statements (for PERF-11 and PERF-14 replacements)
   - Total: 9 DDL statements
   - Index names follow Drizzle's auto-naming convention: `<table>_<col1>_<col2>_idx`
3. If the count is wrong, halt and investigate (likely a schema definition issue).
4. Use standard Drizzle migration (NOT `CONCURRENTLY`) — table locks are trivial for this academic app's data volume.

### TR-3: Migration Application

Run `pnpm db:migrate` on the dev database (`docker compose exec postgres psql -U simak -d simak`).

### TR-4: Index Verification Tests

**Unit test (default suite, `tests/unit/db/schema/`):**
- New test file: `tests/unit/db/schema/indexes.test.ts`
- Imports the Drizzle schema definitions
- For each of the 9 indexes, verifies the index is declared in the table's callback function
- Asserts the index name matches the expected Drizzle naming convention
- Does NOT query a real database (mock-free, pure schema introspection)
- Runs in `pnpm test` (default suite)

**Integration test (opt-in, `tests/integration/db/`):**
- New test file: `tests/integration/db/migration-applied.test.ts`
- Requires `docker compose up -d` and a fresh `pnpm db:migrate`
- Queries `pg_indexes` view to verify all 9 indexes exist by name in the actual database
- Runs only via `pnpm test:integration` (excluded from default suite and pre-push gate)

### TR-5: Manual EXPLAIN ANALYZE Verification

Document the following 4 manual checkpoints in `plan.md`'s checkpoint protocol (NO automated tests for query plans):

1. Admin dashboard `recentActivity` query — confirm Index Scan on `notifications_created_at_idx` (not Seq Scan)
2. Ownership check query (`assignmentStudents` join) — confirm Index Scan on `assignment_students_assignment_id_student_id_idx`
3. `listPendingConsultationsHandler` query — confirm Index Scan on `consultations_assignment_id_status_idx`
4. Review history query — confirm Index Scan on `reviews_submission_id_created_at_idx`

## Non-Functional Requirements

### NFR-1: Performance

- Admin dashboard `recentActivity` query transitions from Seq Scan to Index Scan on `notifications_created_at_idx`
- `assignmentStudents` join queries (used in ownership checks across student/instructor handlers) gain index coverage
- `listPendingConsultationsHandler` query gains composite index coverage
- Review history query (`ORDER BY createdAt DESC`) gains composite index coverage

### NFR-2: Non-Breaking

- All index additions are non-breaking
- The 2 replaced indexes (PERF-11 consultations, PERF-14 reviews) maintain query coverage via the new composite's leftmost prefix
- FK enforcement on `reviews.submissionId` continues to work via the `(submissionId, createdAt)` composite's leftmost prefix
- No queries regress (verified by running full unit test suite before and after)

### NFR-3: Code Quality Gates

- `pnpm test` passes (existing 2,377+ tests)
- `pnpm test:coverage` meets thresholds (≥80% on lines, statements, branches, functions)
- `pnpm typecheck` passes
- `pnpm lint` passes (no new lint errors; `simak-i18n/no-hardcoded` rule not applicable since no UI changes)
- `pnpm check:i18n` passes (no new i18n keys needed — no UI changes)
- No file exceeds 500 lines (schema files are well under this limit)

## Acceptance Criteria

- [ ] AC-1: All 7 schema files in `src/db/schema/` are updated per TR-1
- [ ] AC-2: `pnpm db:generate` produces a migration with exactly 9 DDL statements (7 CREATE + 2 DROP)
- [ ] AC-3: `pnpm db:migrate` applies cleanly to a fresh dev DB
- [ ] AC-4: Unit test `tests/unit/db/schema/indexes.test.ts` passes (verifies Drizzle schema declarations)
- [ ] AC-5: Integration test `tests/integration/db/migration-applied.test.ts` passes (verifies `pg_indexes` contains all 9 new/replaced indexes by name)
- [ ] AC-6: All existing unit tests pass (`pnpm test`)
- [ ] AC-7: `pnpm typecheck` passes
- [ ] AC-8: `pnpm lint` passes
- [ ] AC-9: `pnpm check:i18n` passes
- [ ] AC-10: `pnpm test:coverage` meets thresholds (≥80% on all 4 metrics)
- [ ] AC-11: 4 EXPLAIN ANALYZE manual checkpoints confirmed (documented in plan.md)

## Out of Scope

- Query rewriting / N+1 elimination (TRACK-006)
- Adding pagination to unbounded queries (TRACK-006)
- `(userId, type, createdAt)` composite for notifications (minimal approach chosen per PERF-8 decision)
- Schema changes beyond index additions/replacements (no column additions, no table renames, no type changes)
- Concurrent index creation (`CREATE INDEX CONCURRENTLY`) — not needed for academic app data volume
- Automated EXPLAIN ANALYZE / query plan tests (manual verification only)
- Migration of production database (handled at deployment time via bundled `migrate.mjs`)

## Context Anchors

- **PRD Reference:** `docs/PRD.md` (all list/dashboard features that query these tables)
- **TDD Reference:** `docs/TDD.md` (database schema definitions, index strategy)
- **Roadmap:** `docs/roadmap.md` lines 280-343 (TRACK-005 detailed scope)
- **Tech Stack:** `conductor/tech-stack.md` (Drizzle ORM, PostgreSQL, Vitest)
</protect>
