<protect>
# Track: Query & Data-Fetching Optimization (TRACK-006)

## Overview

Performance optimization track addressing 18 audit findings (PERF-1–6, PERF-15–21, PERF-23–26, PERF-35, BUG-14) across the SIMAK server layer. The track eliminates N+1 query patterns, adds missing pagination to unbounded list endpoints, reduces over-fetching, parallelizes independent queries, rewrites a correlated subquery as a LATERAL join, and moves R2 HEAD checks outside DB transactions to avoid holding row locks during slow I/O.

**Track Type:** `refactor` (performance optimization of existing code; no new user-facing features except pagination which is perf-driven)
**Dependencies:** TRACK-005 (Database Indexes & Schema Optimization) — **RESOLVED** (merged into branch; 9 indexes in place)
**Estimated Effort:** 4 Days / 2 Sprint Loops

## Context Anchors

- **PRD Reference:** `docs/PRD.md` (consultation counts, extension adjustments, dashboard data, template list, instructor assignments)
- **TDD Reference:** `docs/TDD.md` (query patterns, pagination strategy, data-fetching layer)
- **Audit Source:** `docs/roadmap.md` TRACK-006 section (cross-references all audit IDs)
- **Gold Standard:** `src/server/submissions.server.ts` (`submitCheckpointHandler` — transaction + lock pattern, R2 check to be moved outside tx)

## Functional Requirements

### FR-1: N+1 Query Elimination (PERF-1 – PERF-6)

- **FR-1.1 (PERF-1):** Rewrite `listVerifiedCountsHandler` to replace the per-checkpoint COUNT loop with a single `GROUP BY` query returning counts for all checkpoints at once.
- **FR-1.2 (PERF-2, PERF-3, PERF-4):** Replace sequential per-checkpoint UPDATE loops in `calculateExtensionAdjustment`, `bulkExtendHandler`, and `adjustDeadlinesForBreach` with bulk `UPDATE ... WHERE order > targetCheckpoint.order` statements.
- **FR-1.3 (PERF-5):** Refactor `dispatchSLABreachNotifications` — remove dead `channel: 'email'` notification rows (coordination with TRACK-002 BUG-21, already complete), batch the in-app notification INSERT into a single `db.insert(notifications).values([...])` for all admins, and send SLA alert emails concurrently via `Promise.allSettled`.
- **FR-1.4 (PERF-6):** Refactor `bulk-import.server.ts` post-commit — send invitation emails concurrently with `Promise.allSettled` (each does locale lookup + enqueue), and batch audit log inserts into a single `db.insert(auditLog).values([...])`.

### FR-2: Missing Pagination (PERF-15 – PERF-21)

- **FR-2.1 (PERF-15–19):** Add full pagination (page/limit Zod params + total count query + client-side `<Pagination>` component) to 5 list handlers:
  - `listConsultationsHandler` (PERF-15)
  - `listPendingConsultationsHandler` (PERF-16)
  - `listSubmissionsHandler` (PERF-17)
  - `listTemplateAssignmentsHandler` (PERF-18)
  - `listMyExtensionRequestsHandler` (PERF-19)
  - **Pagination UI:** Reuse the existing shared `<Pagination>` primitive (extracted in Track 6.4) for all 5 handlers — consistent UX, no new component.
  - **Pattern:** Match the existing `listInstructorAssignmentsHandler` pagination pattern (page/limit Zod params, `Promise.all` for data + count, client-side Pagination component).
- **FR-2.2 (PERF-20, PERF-21):** Add hardcoded `.limit(20)` safety cap to 2 dashboard queries that are inline widgets within a multi-data dashboard response and cannot be independently paginated:
  - Student dashboard `activeAssignments` (PERF-20)
  - Instructor dashboard `assignmentOverview` (PERF-21)

### FR-3: Over-fetching Reduction (PERF-23, PERF-24)

- **FR-3.1 (PERF-23):** Narrow `listNotificationsHandler` SELECT to only needed columns (`id, type, titleKey, messageKey, params, read, createdAt`) — keep `params` for resolution, drop `metadata`. After resolution, construct response objects explicitly (no `...item` spread) to avoid leaking raw columns into the response.
- **FR-3.2 (PERF-24):** Remove the redundant `SELECT locale FROM users` query — use `session.user.locale` directly (already enriched in `auth.ts` via `_getSession`).

### FR-4: Parallelization of Independent Queries (PERF-25, PERF-26)

- **FR-4.1 (PERF-25):** Parallelize `listTemplatesHandler` — run the total count query and distinct types query in parallel with the data query via `Promise.all`. Checkpoint counts + names remain dependent on the data query (run after).
- **FR-4.2 (PERF-26):** Parallelize `listInstructorAssignmentsHandler` — run the total count query in parallel with the data query via `Promise.all`. Student counts remain dependent on the data query (run after).

### FR-5: Query Rewrite — LATERAL Join (PERF-35)

- **FR-5.1 (PERF-35):** Replace the correlated subquery in `listPendingReviewsHandler` (`reviews.server.ts:109-114`) with a LATERAL join. Restructure the query to start from checkpoints and LATERAL join the latest submission per checkpoint (`ORDER BY version DESC LIMIT 1`). PostgreSQL optimizes this well, typically as an index scan on `submissions(checkpoint_id, version)`.

### FR-6: R2 HEAD Outside Transaction (BUG-14)

- **FR-6.1 (BUG-14):** Move the `getObjectContentLength` call before `db.transaction()` in both `submitCheckpointHandler` (`src/server/submissions.server.ts`) and `submitReviewHandler` (`src/server/reviews.server.ts`) to avoid holding `FOR UPDATE` row locks during slow R2 I/O. Coordinates with TRACK-003 BUG-10 (discriminated return type `{ ok: true, size } | { ok: false, reason }` from `getObjectContentLength`).

## Non-Functional Requirements

- **NFR-1 (Performance):** No sequential per-row queries remain in server handlers (grep for `for (const` in `.server.ts` files should find no N+1 patterns).
- **NFR-2 (Correctness):** All query rewrites produce identical results to the originals for known inputs (verified by result-parity unit tests).
- **NFR-3 (Lock duration):** R2 HEAD checks occur before `db.transaction()` opens — no row locks held during I/O.
- **NFR-4 (Payload size):** Notification list response payload is smaller (no `metadata` column, no leaked raw columns via `...item` spread).
- **NFR-5 (Test coverage):** ≥80% on lines, statements, branches, and functions (enforced by `vitest.config.ts` thresholds).
- **NFR-6 (Code quality):** All files ≤500 lines. Two-file server function split maintained. `pnpm typecheck`, `pnpm lint`, `pnpm check:i18n` all pass.
- **NFR-7 (i18n):** Any new user-visible strings (e.g., pagination labels) use existing i18n keys where possible; new keys added to both `locales/en.json` and `locales/id.json`.

## Acceptance Criteria

- [ ] **AC-1:** `listVerifiedCountsHandler` makes 1 query instead of N (single `GROUP BY`).
- [ ] **AC-2:** `calculateExtensionAdjustment`, `bulkExtendHandler`, and `adjustDeadlinesForBreach` use bulk `UPDATE ... WHERE` instead of per-checkpoint loops.
- [ ] **AC-3:** `dispatchSLABreachNotifications` has no dead `channel: 'email'` rows, batches in-app INSERT, and uses `Promise.allSettled` for emails.
- [ ] **AC-4:** `bulk-import.server.ts` post-commit sends emails via `Promise.allSettled` and batches audit INSERT.
- [ ] **AC-5:** All 5 list handlers (consultations, pending consultations, submissions, template assignments, extension requests) accept `page`/`limit` Zod params, return total count, and render the shared `<Pagination>` component on the client.
- [ ] **AC-6:** Student dashboard `activeAssignments` and instructor dashboard `assignmentOverview` queries have `.limit(20)`.
- [ ] **AC-7:** `listNotificationsHandler` selects only `id, type, titleKey, messageKey, params, read, createdAt` and constructs response objects explicitly (no `...item` spread).
- [ ] **AC-8:** Redundant `SELECT locale FROM users` is removed; `session.user.locale` is used directly.
- [ ] **AC-9:** `listTemplatesHandler` and `listInstructorAssignmentsHandler` run independent count queries in parallel with data queries via `Promise.all`.
- [ ] **AC-10:** `listPendingReviewsHandler` uses a LATERAL join instead of a correlated subquery.
- [ ] **AC-11:** `getObjectContentLength` is called before `db.transaction()` in both `submitCheckpointHandler` and `submitReviewHandler`.
- [ ] **AC-12:** `pnpm test:unit` passes with new result-parity tests for all rewritten queries.
- [ ] **AC-13:** `pnpm typecheck`, `pnpm lint`, `pnpm check:i18n` all pass.
- [ ] **AC-14:** `pnpm test:coverage` ≥80% on all four metrics.
- [ ] **AC-15:** No file in `src/`, `tests/`, or `scripts/` exceeds 500 lines.

## Out of Scope

- **Session caching** (TRACK-007) — short-TTL in-memory cache for `_getSession`.
- **Bundle splitting** (TRACK-007) — splitting `auth.ts` into the two-file pattern.
- **Client-side query refetch tuning** (TRACK-007).
- **PERF-36** (audit-log LIKE on jsonb) — left as-is. Admin-only, paginated (20/page), modest table volume. Deferred until EXPLAIN ANALYZE shows a problem.
- **Schema changes beyond index additions** — TRACK-005 handled indexes; this track only rewrites queries.
- **New features unrelated to the 18 audit IDs.**

## Verification Strategy

- **Result-parity unit tests** for all N+1 rewrites and the LATERAL join rewrite — assert rewritten queries return the same data shape/values as before for known inputs.
- **Pagination tests** — verify page/limit params, total counts, and edge cases (page beyond range, limit caps).
- **EXPLAIN ANALYZE** — manual verification only, documented in DoD (not automated). Run on: LATERAL join query, bulk UPDATEs, key paginated queries to confirm index usage post-TRACK-005.
- **Structural grep** — confirm no `for (const` N+1 patterns remain in `.server.ts` files; all 5 list handlers have page/limit Zod params; both dashboard queries have `.limit(20)`; `listNotificationsHandler` does not spread `...item`; `getObjectContentLength` called before `db.transaction()`.
</protect>
