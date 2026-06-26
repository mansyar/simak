<protect>

# Track 8.4 — Performance Refinements

## Overview

Performance and reliability refinements addressing three audit findings from the Phase 8 security & correctness audit. This is a **refactor** track — no new product features, no database schema changes, no business-logic changes. All three findings are in scope.

The track improves three areas:
1. **Dashboard query parallelization** — All three role dashboards (instructor, student, admin) issue independent queries strictly sequentially. Independent queries are parallelized with `Promise.all`.
2. **Bulk import batching** — `bulkCreateUsersHandler` processes up to 500 rows with per-row DB inserts and per-row awaited email sends. Refactored to batch DB writes in a single transaction and decouple email sends from the request cycle.
3. **Post-commit advisory isolation** — `submitReviewHandler` (and sibling handlers found during scan) perform post-commit advisory work (audit logging, SLA notifications) without try/catch. A failure in advisory work surfaces a misleading "Internal Server Error" for a transaction that committed successfully.

**Track Type:** Refactor (performance + reliability)

---

## Audit Findings Addressed

| Severity | Finding | Location |
| -------- | ------- | -------- |
| MEDIUM | Dashboard Sequential Query Fan-out | `src/server/dashboard-instructor.server.ts`, `dashboard-student.server.ts`, `dashboard-admin.server.ts` |
| MEDIUM | Bulk Import Sequential Processing | `src/server/bulk-import.server.ts` `bulkCreateUsersHandler` |
| LOW | Audit-Log Failure Returns Misleading "Internal Server Error" | `src/server/reviews.server.ts` `submitReviewHandler` (lines 393–408) |

---

## Functional Requirements

### FR-1: Dashboard Query Parallelization (Instructor)

`getInstructorDashboardDataHandler` currently issues 6+ queries strictly sequentially. The queries have dependency groups:
- **Group A (independent):** `instructorAssignments` query, `recentSubmissions` query, `assignmentOverview` query — none depend on each other.
- **Group B (depends on Group A `assignmentIds`):** pending review `count` + `pendingReviewItems` list — can run in parallel with each other.
- **Group C (depends on Group A `overviewIds`):** `studentCount`, `pendingReviewCount`, `progressData` — three independent queries that can run in parallel.

**Requirement:** Restructure so independent queries within each group run via `Promise.all`. Preserve the existing data shape and all post-processing logic (deduplication, progress calculation, sorting).

### FR-2: Dashboard Query Parallelization (Student)

`getStudentDashboardDataHandler` issues 5 queries sequentially. Dependency analysis:
- **Group A (independent):** `activeAssignments`, `upcomingDeadlines`, `pendingReviews`, `consultationReminders` — the last three only need `studentId`, not the `assignmentIds` from the first.
- **Group B (depends on Group A `assignmentIds`):** checkpoints-by-assignment query.

**Requirement:** Run `upcomingDeadlines`, `pendingReviews`, and `consultationReminders` concurrently with `activeAssignments` via `Promise.all`. The checkpoints query remains dependent on `assignmentIds`.

### FR-3: Dashboard Query Parallelization (Admin)

`getAdminDashboardDataHandler` issues 7 queries, **all of which are independent** of each other (each only needs constant thresholds / table scans).

**Requirement:** Run all 7 queries concurrently via a single `Promise.all`.

### FR-4: Bulk Import Batched DB Writes

`bulkCreateUsersHandler` currently loops over up to 500 rows, performing per-row: (a) email uniqueness check, (b) user insert, (c) verification insert. This is up to 1500 sequential DB round-trips.

**Requirement:** Refactor to:
1. Batch the email uniqueness check — fetch all existing emails for the submitted rows in a single `inArray` query.
2. Insert all valid users + verification tokens in a single `db.transaction` using `.values([...])` batch inserts.
3. Preserve existing per-row validation logic (role-permission check, existing-email skip) — these become pre-filter passes before the batch insert.
4. Preserve the existing return shape (`{ created, skipped, errors }`).
5. If the batch transaction fails, no partial users persist (transaction rollback).

### FR-5: Bulk Import Email Decoupling

`bulkCreateUsersHandler` currently calls `await sendInvitationEmail(...)` per row inside the loop (line 107). Although `sendInvitationEmail` now enqueues to the email queue (Track 4.1), it is still awaited sequentially per row.

**Requirement:** Collect all invitation email payloads during the loop, then enqueue them after the DB transaction commits. No per-row `await sendInvitationEmail` inside the loop. Email failures remain non-fatal (existing behavior preserved).

### FR-6: Post-Commit Advisory Isolation in `submitReviewHandler`

`submitReviewHandler` performs post-commit advisory work after the `db.transaction` block (lines 393–408):
- `logAuditEvent(...)` — audit logging
- `dispatchSLABreachNotifications(...)` — SLA breach notifications (only if `breachDays > 0`)

Neither is wrapped in try/catch. If either throws, the outer `catch` (line 411) returns `serverError(INTERNAL)` even though the transaction committed successfully — misleading the client.

**Requirement:** Wrap both post-commit calls in try/catch. A failure in advisory work must NOT change the success response. Log the advisory failure to `console.error` for observability but do not surface it to the client.

### FR-7: Sibling Handler Scan

Scan other review/submission handlers for the same unguarded post-commit advisory pattern (audit log / notification calls outside a transaction without try/catch). Wrap any found instances in the same try/catch pattern.

**Scope of scan:** `src/server/reviews.server.ts`, `src/server/reviews-extras.server.ts`, `src/server/submissions.server.ts`. Note: Track 8.3 already wrapped post-commit advisory work in `submitCheckpointHandler`, `createUserHandler`, `verifyConsultationHandler`, and `rejectConsultationHandler` — do not double-wrap those.

---

## Non-Functional Requirements

- **NFR-1 (Correctness):** No regression in dashboard data correctness — the parallelized queries must return identical data to the sequential versions.
- **NFR-2 (Performance):** Instructor dashboard load time is reduced (measurable: sequential round-trips → parallel). The number of DB round-trips per dashboard load should drop to the depth of the dependency chain (2–3 levels) instead of the total query count (6–7).
- **NFR-3 (Reliability):** A failure in post-commit advisory work (audit log, notifications) never surfaces a misleading error response for a successful transaction.
- **NFR-4 (Atomicity):** Bulk import remains atomic per the existing spec — if the batch insert fails, no partial users persist.
- **NFR-5 (i18n):** Not affected — no new UI strings.

---

## Acceptance Criteria

- [ ] `getInstructorDashboardDataHandler` uses `Promise.all` for independent query groups; data returned is identical to the sequential version
- [ ] `getStudentDashboardDataHandler` runs `upcomingDeadlines`, `pendingReviews`, and `consultationReminders` concurrently with `activeAssignments`
- [ ] `getAdminDashboardDataHandler` runs all 7 independent queries via a single `Promise.all`
- [ ] Instructor dashboard DB round-trips reduced from 6+ sequential to the dependency-chain depth (2–3 levels)
- [ ] `bulkCreateUsersHandler` batches user + verification inserts in a single `db.transaction` with `.values([...])`
- [ ] `bulkCreateUsersHandler` batches the email uniqueness check into a single `inArray` query
- [ ] `bulkCreateUsersHandler` enqueues all invitation emails after the DB transaction commits — no per-row `await sendInvitationEmail` in the loop
- [ ] If the batch transaction fails, no partial users persist (transaction rollback)
- [ ] `submitReviewHandler` wraps post-commit `logAuditEvent` and `dispatchSLABreachNotifications` in try/catch — a failure does not change the success response
- [ ] Sibling handlers scanned; any unguarded post-commit advisory calls wrapped in try/catch
- [ ] No regression in dashboard data correctness or bulk import behavior
- [ ] `pnpm typecheck`, `pnpm lint`, and `pnpm vitest run --coverage` all pass; coverage thresholds met

---

## Out of Scope

- Redis caching layer or PgBouncer connection pooling (deferred to v3 per roadmap Appendix A)
- Dashboard query rewrite / optimization (SQL-level tuning) — only execution order is changed, not query content
- `bulkCreateTemplatesHandler` (already uses per-group transactions with batch checkpoint inserts)
- File preview optimization (Track 6.3 — separate track)
- New product features or UI changes
- Database schema changes (none required)

</protect>
