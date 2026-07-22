<protect>
# Implementation Plan: TRACK-019 — Analytics & Reporting

## Phase 1: Admin Analytics Dashboard [checkpoint: 7925e4d]

- [x] Task: Read spec.md and workflow.md to refresh context
    - [x] Read `conductor/tracks/analytics-reporting_20260722/spec.md`
    - [x] Read `conductor/workflow.md`

- [x] Task: Create analytics server stubs and Zod schemas [8941d71]
    - [x] Create `src/server/analytics.ts` with Zod input schemas (date range: predefined `7d|30d|90d|all` + custom `start`/`end` ISO dates) and `createServerFn` stub for `getAdminAnalyticsData` (dynamic import to `analytics-admin.server.ts`)
    - [x] Write tests in `tests/unit/server/analytics.test.ts` for Zod schemas (valid/invalid date ranges, predefined + custom) and stub existence

- [x] Task: Implement admin analytics handler (TDD) [a255241]
    - [x] Write failing tests in `tests/unit/server/analytics-admin.test.ts` for `getAdminAnalyticsDataHandler` — mock `@/db/index`, `@/server/auth`; test all 6 metrics (consultation verification rate, deadline breach rate, assignment status distribution, submission/review volume, reviews completed, DAU/WAU); test date range filtering (7d/30d/90d/all + custom); test role guard (non-admin rejected)
    - [x] Implement `src/server/analytics-admin.server.ts` — aggregate queries: consultation verification rate, deadline breach rate, assignment status distribution (`GROUP BY state`), submission/review volume (`date_trunc` + `GROUP BY`), reviews completed count, DAU/WAU (`COUNT(DISTINCT actorId) GROUP BY date_trunc` from `audit_log`)
    - [x] Run `pnpm test` and confirm all tests pass

- [x] Task: Create admin analytics route and UI [7b3e414]
    - [x] Write failing tests in `tests/unit/routes/admin-analytics.test.tsx` for route component — test MetricCard rendering, data table rendering, date range filter UI, sidebar entry
    - [x] Implement `src/routes/_authenticated/admin/analytics.tsx` — URL search params (`?range=30d` or `?start=...&end=...`), `validateSearch`/`loaderDeps`/`loader`, MetricCard grid (6 metrics), data tables for trends, progress bars for distribution, date range selector (predefined buttons + custom date picker)
    - [x] Add admin sidebar entry with BarChart3 icon linking to `/admin/analytics`
    - [x] Add i18n keys to `locales/en.json` and `locales/id.json` for all admin analytics labels, metric names, date range labels, table headers
    - [x] Run `pnpm generate:i18n` and `pnpm check:i18n`
    - [x] Run `pnpm test` and confirm all tests pass

- [x] Task: Conductor - User Manual Verification 'Phase 1: Admin Analytics Dashboard' (Protocol in workflow.md)

## Phase 2: Instructor Analytics Dashboard [checkpoint: d1fec37]

- [x] Task: Read spec.md and workflow.md to refresh context
    - [x] Read `conductor/tracks/analytics-reporting_20260722/spec.md`
    - [x] Read `conductor/workflow.md`

- [x] Task: Add instructor analytics server stub [adfe9bf]
    - [ ] Add `getInstructorAnalyticsData` Zod schema (same date range input) and `createServerFn` stub to `src/server/analytics.ts` (dynamic import to `analytics-instructor.server.ts`)
    - [ ] Write tests in `tests/unit/server/analytics.test.ts` for the new stub and schema

- [x] Task: Implement instructor analytics handler (TDD) [7215c0d]
    - [ ] Write failing tests in `tests/unit/server/analytics-instructor.test.ts` for `getInstructorAnalyticsDataHandler` — test all 5 metrics (reviews completed, avg response time, SLA breach count, students supervised, assignments active); test date range filtering; test role guard (non-instructor rejected); test instructor scoping (only this instructor's data)
    - [ ] Implement `src/server/analytics-instructor.server.ts` — instructor-scoped queries: reviews completed, avg response time (`AVG(EXTRACT(EPOCH FROM reviewedAt - uploadedAt))`), SLA breach count, students supervised, assignments active
    - [ ] Run `pnpm test` and confirm all tests pass

- [x] Task: Create instructor analytics route and UI [9942b41]
    - [ ] Write failing tests in `tests/unit/routes/instructor-analytics.test.tsx` for route component — test MetricCard rendering, data table rendering, date range filter UI, sidebar entry
    - [ ] Implement `src/routes/_authenticated/instructor/analytics.tsx` — same URL search params pattern, MetricCard grid (5 metrics), data tables, date range selector
    - [ ] Add instructor sidebar entry with BarChart3 icon linking to `/instructor/analytics`
    - [ ] Add i18n keys to `locales/en.json` and `locales/id.json` for all instructor analytics labels
    - [ ] Run `pnpm generate:i18n` and `pnpm check:i18n`
    - [ ] Run `pnpm test` and confirm all tests pass

- [x] Task: Conductor - User Manual Verification 'Phase 2: Instructor Analytics Dashboard' (Protocol in workflow.md)

## Phase 3: CSV Export [checkpoint: f5cc59a]

- [x] Task: Read spec.md and workflow.md to refresh context
    - [x] Read `conductor/tracks/analytics-reporting_20260722/spec.md`
    - [x] Read `conductor/workflow.md`

- [x] Task: Add CSV export server stubs [52e3e02]
    - [x] Add 5 CSV export Zod schemas and `createServerFn` stubs to `src/server/analytics.ts`: `exportUsersCsv`, `exportAuditLogCsv`, `exportAssignmentProgressCsv` (admin); `exportStudentProgressCsv`, `exportReviewHistoryCsv` (instructor)
    - [x] Write tests in `tests/unit/server/analytics.test.ts` for new stubs and schemas

- [x] Task: Implement CSV export handlers (TDD) [7e04d48]
    - [x] Write failing tests in `tests/unit/server/analytics-export.test.ts` for all 5 CSV handlers — test CSV output format (headers, row count, delimiter, quoting); test role guards (admin-only for admin exports, instructor-only for instructor exports); test date range filtering; test empty data handling
    - [x] Implement `src/server/analytics-export.server.ts` — 5 CSV string builders: `exportUsersCsvHandler`, `exportAuditLogCsvHandler`, `exportAssignmentProgressCsvHandler`, `exportStudentProgressCsvHandler`, `exportReviewHistoryCsvHandler`
    - [x] Run `pnpm test` and confirm all tests pass

- [x] Task: Add CSV export buttons to UI [5da1449]
    - [ ] Write failing tests for export button components — test button rendering, click handler, Blob creation, download trigger
    - [ ] Create shared `useCsvDownload` hook or utility (server fn call → Blob → `URL.createObjectURL` → anchor click)
    - [ ] Add "Export CSV" button to admin users page (`/admin/users`)
    - [ ] Add "Export CSV" button to admin audit log page (`/admin/audit-log`)
    - [ ] Add "Export CSV" button to instructor assignment detail page (`/instructor/assignments/$id`)
    - [ ] Add "Export CSV" button to admin analytics page (`/admin/analytics`)
    - [ ] Add i18n keys to both locales for export button labels and download messages
    - [ ] Run `pnpm generate:i18n` and `pnpm check:i18n`
    - [ ] Run `pnpm test` and confirm all tests pass

- [x] Task: Conductor - User Manual Verification 'Phase 3: CSV Export' (Protocol in workflow.md)

## Phase 4: Excel Export [checkpoint: f9ca721]

- [x] Task: Read spec.md and workflow.md to refresh context
    - [x] Read `conductor/tracks/analytics-reporting_20260722/spec.md`
    - [x] Read `conductor/workflow.md`

- [x] Task: Implement client-side Excel export utility (TDD) [7be4326]
    - [x] Write failing tests in `tests/unit/lib/excel-export.test.ts` for Excel export utility — test workbook creation, sheet generation from JSON data, write output format
    - [x] Implement `src/lib/excel-export.ts` — reusable utility: `exportToExcel(data, sheetName, fileName)` using `xlsx.utils.book_new()` + `json_to_sheet()` + `write()` + client-side Blob download
    - [x] Run `pnpm test` and confirm all tests pass

- [x] Task: Add Excel export buttons to analytics pages [8e6286f]
    - [x] Write failing tests for Excel export button integration on analytics pages
    - [x] Add "Export Excel" button to admin analytics page (`/admin/analytics`) — exports current dashboard data
    - [x] Add "Export Excel" button to instructor analytics page (`/instructor/analytics`) — exports current dashboard data
    - [x] Add i18n keys to both locales for Excel export button labels
    - [x] Run `pnpm generate:i18n` and `pnpm check:i18n`
    - [x] Run `pnpm test` and confirm all tests pass

- [x] Task: Conductor - User Manual Verification 'Phase 4: Excel Export' (Protocol in workflow.md)

## Phase 5: i18n Finalization & Quality Verification

- [x] Task: Read spec.md and workflow.md to refresh context
    - [x] Read `conductor/tracks/analytics-reporting_20260722/spec.md`
    - [x] Read `conductor/workflow.md`

- [x] Task: Verify i18n parity and finalize
    - [x] Run `pnpm generate:i18n` to regenerate types
    - [x] Run `pnpm check:i18n` to verify EN/ID key parity
    - [x] Run `pnpm check:i18n:unused` to verify no unused keys introduced
    - [x] Fix any parity or unused key issues

- [x] Task: Final quality gates
    - [x] Run `pnpm test:coverage` and verify ≥80% on lines, statements, branches, and functions
    - [x] Run `pnpm typecheck` and verify clean
    - [x] Run `pnpm lint` and verify clean (including `simak-i18n/no-hardcoded`)
    - [x] Verify no file in `src/` or `tests/` exceeds 500 lines (`node scripts/check-modularity.js`)
    - [x] Verify all handler files follow two-file split pattern (grep for server-only imports in `analytics.ts`)

- [~] Task: Conductor - User Manual Verification 'Phase 5: i18n Finalization & Quality Verification' (Protocol in workflow.md)
</protect>
