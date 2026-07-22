# TRACK-019: Analytics & Reporting

## Overview

Build role-based analytics dashboards (admin + instructor) with historical trend data and on-demand report export (CSV/Excel). Analytics focuses on NEW metrics not already on existing dashboards — historical time-series with date ranges, derived aggregate metrics, and export capabilities. Existing dashboards remain real-time operational snapshots and are not duplicated.

All metrics derive from existing database tables (`assignments`, `checkpoints`, `submissions`, `reviews`, `consultations`, `users`, `audit_log`). No new schema required for Phase 1 — aggregate queries with `GROUP BY` / `date_trunc` / window functions.

## Functional Requirements

### FR-1: Admin Analytics Dashboard

**Route:** `/admin/analytics?range=30d` (admin-only via `requireRole(['admin'])`)

The admin analytics page displays the following NEW metrics (not on the existing admin dashboard):

1. **Consultation verification rate** — verified consultations / total consultations (as percentage)
2. **Deadline breach rate** — checkpoints where `dueDate < now()` AND `state != 'passed'` / total checkpoints (as percentage)
3. **Assignment status distribution** — count of checkpoints by state (`locked`, `unlocked`, `submitted`, `under_review`, `passed`, `revise`) displayed as a table with progress bars
4. **Submission/review volume over time** — daily and weekly counts via `date_trunc('day', createdAt)` / `date_trunc('week', createdAt)`, displayed as trend tables
5. **Reviews completed count** — total reviews in the selected date range
6. **Active-user trends (DAU/WAU)** — distinct `actorId` values from `audit_log` grouped by day/week, shown as a trend table

**Date range filtering:** URL search params with predefined ranges (`7d`, `30d`, `90d`, `all`) and custom date range selection (start/end date inputs). Route loader parses search params and passes to server function. Shareable URLs.

**Visualization:** Numeric `MetricCard` grid + data tables for trend data + progress bars for distribution. No charting library (defer Recharts to a future track if visual charts are requested).

### FR-2: Instructor Analytics Dashboard

**Route:** `/instructor/analytics?range=30d` (instructor-only via `requireRole(['instructor'])`)

The instructor analytics page displays personal performance metrics:

1. **Reviews completed** — count of reviews by this instructor in the selected date range
2. **Average response time** — `EXTRACT(EPOCH FROM reviews.reviewedAt - submissions.uploadedAt)` averaged across all reviews in range (displayed in human-readable format: hours/days)
3. **SLA breach count** — reviews where breach duration > 3 days (SLA threshold) in the selected date range
4. **Students supervised** — aggregate count of distinct students across the instructor's active assignments
5. **Assignments active** — count of non-deleted assignments created by this instructor

**Date range filtering:** Same URL search params + custom date range as FR-1.

### FR-3: CSV Export (Admin)

Server functions that return CSV strings; client creates `Blob` and triggers download via `URL.createObjectURL`. Export buttons on existing admin list pages and analytics page.

1. **User list CSV** — all users (id, name, email, role, status, created_at)
2. **Audit log CSV** — filtered audit log entries (timestamp, action, actor, entity_type, entity_id, details)
3. **Assignment progress CSV** — per-assignment student progress (assignment title, student name, checkpoint states, completion percentage)

### FR-4: CSV Export (Instructor)

1. **Student progress CSV** — per-assignment student checkpoint states and completion
2. **Review history CSV** — instructor's review history (submission, student, decision, comment, reviewed_at, response_time)

### FR-5: Excel Export (Analytics)

Client-side SheetJS export (reuse existing `xlsx` dependency) of analytics dashboard data. "Export Excel" button on both analytics pages uses `xlsx.utils.book_new()` + `json_to_sheet()` + `write()` to download a `.xlsx` of the current dashboard view.

### FR-6: Navigation & i18n

1. **Sidebar entries** — Analytics link in admin sidebar and instructor sidebar
2. **i18n keys** — All new labels, headers, metric names, date range labels, export button labels, and table headers added to both `locales/en.json` and `locales/id.json`. Run `pnpm generate:i18n` and verify `pnpm check:i18n`.

## Non-Functional Requirements

1. **No new database tables** — All Phase 1 metrics are aggregate queries on existing tables. If query performance becomes an issue at scale, materialized views or a pre-aggregation table can be added in a future track (out of scope).
2. **Server function two-file split** — `src/server/analytics.ts` (Zod schemas + `createServerFn` stubs) and handler files:
   - `src/server/analytics-admin.server.ts` — admin aggregate queries (~150-250 lines)
   - `src/server/analytics-instructor.server.ts` — instructor-scoped metrics (~150-250 lines)
   - `src/server/analytics-export.server.ts` — CSV string builders (~100-200 lines)
   Each file stays well under the 500-line limit.
3. **CSV export mechanism** — `createServerFn` returns a CSV string; client creates `Blob` and triggers `URL.createObjectURL` download. No new API route or `text/csv` streaming infrastructure. Adequate for datasets up to thousands of rows.
4. **Excel export** — Client-side SheetJS (already a dependency, used in `src/lib/bulk-import/`). No new dependency.
5. **Role guards** — Admin analytics + CSV exports are admin-only (`requireRole(['admin'])`). Instructor analytics + CSV exports are instructor-only (`requireRole(['instructor'])`).
6. **No duplicate metrics** — Analytics metrics must not duplicate existing dashboard metrics. Dashboards show real-time operational snapshots; analytics show historical trends and derived metrics.
7. **URL search params for date range** — `?range=30d` (predefined) and `?start=2026-01-01&end=2026-07-22` (custom). Route loader parses params. Back/forward navigation works.

## Acceptance Criteria

1. Admin opens `/admin/analytics?range=30d` — sees all 6 NEW metrics (consultation verification rate, deadline breach rate, assignment status distribution, submission/review volume trend, reviews completed, DAU/WAU trend)
2. Instructor opens `/instructor/analytics?range=30d` — sees all 5 personal metrics (reviews completed, avg response time, SLA breach count, students supervised, assignments active)
3. Changing date range to `90d` or `all` updates the URL and refreshes data
4. Custom date range (start/end) filters data correctly
5. Clicking "Export CSV" on the admin users page downloads a valid CSV file
6. Clicking "Export CSV" on the instructor assignment detail downloads a valid CSV file
7. Clicking "Export Excel" on the analytics page downloads a valid `.xlsx` file
8. Switching to Indonesian translates all labels, headers, and metric names
9. `pnpm test:unit` — all new tests pass; coverage ≥80%
10. `pnpm typecheck`, `pnpm lint`, `pnpm check:i18n` all pass clean

## Out of Scope

- **PDF export** — Requires a rendering library (defer to future track)
- **Scheduled/recurring report delivery** — Requires cron infrastructure (defer)
- **Student-facing analytics** — Students have the dashboard; no separate analytics page
- **Materialized views / pre-aggregation tables** — Only if Phase 1 queries are too slow (measure first)
- **Charting library (Recharts)** — Start with tables/progress bars; add only if visual charts are explicitly requested
- **Modifications to existing dashboards** — Existing admin/instructor dashboards remain as-is
