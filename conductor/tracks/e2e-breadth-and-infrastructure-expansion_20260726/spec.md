<protect>
# TRACK-028: E2E Breadth & Infrastructure Expansion

## Overview

This track expands the end-to-end (E2E) test coverage from 10/30 to 28+/30 page routes, adds multi-browser (Firefox) and mobile-viewport test projects, automated axe accessibility scans, a cross-role assignment lifecycle integration test, and Playwright config improvements. It addresses the P1/P2 coverage gaps identified in the comprehensive E2E test audit conducted after Milestone 4 (E2E-FEAT-001). It builds on the Playwright infrastructure from E2E-FEAT-001 and the expanded seed data + decoupled test patterns established in TRACK-027.

- **Track Type:** Chore (proactive testing gap remediation / infrastructure expansion)
- **Status:** Pending
- **Dependencies:** E2E-FEAT-001 (E2E Testing with Playwright — provides infrastructure). Recommended AFTER TRACK-027 (builds on expanded seed data and decoupled test patterns).
- **Estimated Effort:** 5 Days / 3 Sprint Loops
- **Audit IDs:** None (proactive testing gap remediation — identified in E2E audit)

## Context Anchors (Traceability)

- **PRD Reference:** `docs/PRD.md` — Role-based dashboards (student/instructor/admin widgets), assignment templates (admin CRUD), settings hub (profile, password, 2FA, appearance, accessibility, notification preferences), user management (edit, delete with reassignment), analytics & reporting (admin/instructor dashboards, CSV/Excel export), two-factor authentication (TOTP, backup codes), bulk operations (user/template import), checkpoint discussions (Q&A threads), rubric-based grading (numeric/qualitative scoring)
- **TDD Reference:** All 30 page routes of 37 total route files under `src/routes/` (5 layout files + 1 API catch-all + 1 root + 30 page routes). 10 currently e2e-tested, 20 untested. Key untested routes: `src/routes/index.tsx` (landing page), `src/routes/_authenticated/admin/dashboard.tsx`, `src/routes/_authenticated/admin/audit-log.tsx`, `src/routes/_authenticated/admin/analytics.tsx`, `src/routes/_authenticated/admin/email-queue.tsx`, `src/routes/_authenticated/admin/templates/index.tsx`, `src/routes/_authenticated/admin/templates/$templateId.tsx`, `src/routes/_authenticated/admin/templates/import.tsx`, `src/routes/_authenticated/admin/users/import.tsx`, `src/routes/_authenticated/instructor/dashboard.tsx`, `src/routes/_authenticated/instructor/analytics.tsx`, `src/routes/_authenticated/student/dashboard.tsx`, `src/routes/_authenticated/*/settings.tsx` (3 settings routes), `src/routes/_unauthenticated/auth/forgot-password.tsx`, `src/routes/_unauthenticated/auth/reset-password.tsx`, `src/routes/_unauthenticated/auth/verify-2fa.tsx`, `src/routes/_unauthenticated/auth/verify-backup-code.tsx`. Server files: `src/server/templates.ts` + `templates.server.ts`, `src/server/settings.ts` + `settings.server.ts`, `src/server/users.ts` + `users.server.ts`, `src/server/two-factor.ts` + `two-factor.server.ts`, `src/server/discussions.ts` + `discussions.server.ts`, `src/server/rubrics.ts` + `rubrics.server.ts`, `src/server/analytics.ts` + `analytics-admin.server.ts` + `analytics-instructor.server.ts`. Config: `playwright.config.ts` (projects array, webServer, retries).
- **Product Spec Reference:** `conductor/product.md` — Track 7.2 Role-Based Dashboards, Track 2.2 Assignment Templates, Track 1.3 Two-Factor Authentication, Track 13 (user delete with `ReassignmentDialog`), TRACK-019 Analytics & Reporting, TRACK-020 Rubric-Based Grading, TRACK-026 Checkpoint Discussion / Q&A Threads, Track 9 Action Feedback, TRACK-022 User Notification Preferences

## Track Tech Stack

- **Playwright v1.61.1** — New spec files under `tests/e2e/`, extending the existing pattern.
- **`@axe-core/playwright`** — Accessibility testing plugin for automated WCAG 2.1 AA assertions on key pages. Added as devDependency.
- **Playwright projects configuration** — New `firefox` project and `mobile-chrome` project added to `playwright.config.ts` `projects` array. Mobile project uses `devices['Pixel 7']` or equivalent viewport.
- **Existing helper infrastructure** — Reuses `auth.ts`, `db-reset.ts`, and the expanded seed data from TRACK-027 (second student, consultation seed). New dedicated `tests/e2e/helpers/rubric-setup.ts` for rubric criteria + `gradingType` DB setup.

## Functional Requirements

### FR-1: Role Dashboards Smoke Tests (`dashboards.spec.ts`)
- Smoke test all 3 role dashboards:
  - Student (`/student/dashboard`): verify 4 widgets render — active assignments, upcoming deadlines, pending reviews, consultation reminders.
  - Instructor (`/instructor/dashboard`): verify 4 widgets — pending review queue with SLA badges, recent submissions, assignment overview, at-risk students.
  - Admin (`/admin/dashboard`): verify widgets — system metrics, activity feed, deadline escalation alerts, email queue stats.
- Assert no console errors on any dashboard.
- Assert key data from seed is visible (e.g., "E2E Test Assignment" on student dashboard).

### FR-2: Admin Template CRUD Tests (`admin-templates.spec.ts`)
- Admin creates a template (name, type, 3 checkpoints with add/remove/reorder) → verify it appears in the template list.
- Admin edits the template at `/admin/templates/$templateId` → verify changes persist after reload.
- Admin duplicates the template → verify "(Copy)" suffix appears.
- Admin attempts to delete a template in use by an assignment → verify deletion is blocked with usage count.
- Admin deletes an unused template (type "DELETE" confirmation) → verify it disappears from the list.

### FR-3: Settings Hub Tests (`settings.spec.ts`)
- **Profile:** Edit name → verify it persists after reload and appears in sidebar.
- **Password:** Change password → verify old password no longer works, new password works.
- **Language:** Toggle from EN to ID → verify a known UI string changes (e.g., sidebar label or page heading).
- **Theme:** Toggle from light to dark → verify `dark` class is applied to `<html>`.
- **Notification preferences:** Toggle off an event type email → verify the checkbox state persists after reload.

### FR-4: Expand Admin Users Tests (`admin-users.spec.ts`)
- Add edit user test: open edit sheet, change name, submit, verify change in table.
- Add delete user test: delete an instructor with active assignments → verify `ReassignmentDialog` appears → select replacement instructor → confirm → verify assignment is reassigned (instructor changed in DB).
- Add delete user without active assignments → verify direct deletion without dialog.

### FR-5: Cross-Role Lifecycle Integration Test (`cross-role-lifecycle.spec.ts`)
- Single serial test exercising the full assignment lifecycle across roles: admin creates template → instructor creates assignment from template → student logs consultation → instructor verifies → student submits (via DB helper) → instructor reviews with Pass → verify next checkpoint unlocks → student submits → instructor reviews with Revise → student resubmits → instructor reviews with Pass → verify assignment completion state.
- Longer timeout (120s), runs last.
- Browser context management: single context, clear cookies + storageState between role switches, then login as the new role via the Better Auth API (matching the `loginAsRole` pattern).

### FR-6: Remaining Route Smoke Tests
- Add lightweight smoke tests for untested routes:
  - Landing page (`/`): verify hero section and feature cards render.
  - Admin audit log (`/admin/audit-log`): verify table loads, filters render.
  - Admin email queue (`/admin/email-queue`): verify table loads, status filter renders.
  - Admin analytics (`/admin/analytics`): verify metric cards render, date range selector present.
  - Instructor analytics (`/instructor/analytics`): verify metrics render.
  - Forgot password (`/auth/forgot-password`): fill email, submit, verify success message (email sending will fail since `RESEND_API_KEY` is a test key, but the UI should still show success since enqueue succeeds).
  - Reset password (`/auth/reset-password`): verify form renders with token.
  - 2FA verify page (`/auth/verify-2fa`): verify TOTP input renders.
  - Bulk user import (`/admin/users/import`): verify upload zone and template download button render.
  - Bulk template import (`/admin/templates/import`): verify upload zone renders.
  - **Discussions** (`discussions.spec.ts`): student posts a message on checkpoint page → verify it appears → instructor sees it in Discussions tab → instructor replies → verify reply appears with indentation → student deletes within 15-min window → verify soft-delete.
  - **Rubric grading** (`rubric-grading.spec.ts`): set up rubric criteria + `gradingType: 'numeric'` on the Proposal template checkpoint via a dedicated DB helper (`tests/e2e/helpers/rubric-setup.ts`) at test start → instructor reviews with rubric scoring — add numeric scores per criterion → verify weighted total auto-computes → submit → verify `review_scores` persisted in DB.

### FR-7: Multi-Browser (Firefox)
- Add a `firefox` project to `playwright.config.ts` using `devices['Desktop Firefox']`.
- Run the full suite on both Chromium and Firefox.
- **Firefox-specific failures must be fixed within this track** (not deferred or skipped).

### FR-8: Mobile Viewport
- Add a `mobile-chrome` project using `devices['Pixel 7']` (or `devices['iPhone 14']`).
- Run dashboard and assignment detail tests on mobile viewport to verify responsive layouts (card-based `ProgressTable`, stacked `CheckpointListEditor`, mobile step indicator in wizard).

### FR-9: Accessibility E2E (`@axe-core/playwright`)
- Add `@axe-core/playwright` devDependency.
- Run axe accessibility scans on key pages after they load: login page, student dashboard, student assignment detail, instructor review detail, admin users, admin templates.
- Assert zero critical and serious violations.
- **Moderate/minor violations must be tracked in a docs file** (`docs/a11y-violations.md` or similar), documenting each finding for future reference. Do NOT fail the suite on moderate/minor issues.

### FR-10: Config Improvements
- Set `retries: 1` in `playwright.config.ts` (reduces flaky-test noise without masking real failures).
- Consider `retries: 2` for CI-only via a `CI` env check.

## Non-Functional Requirements

- **Suite runtime:** Full suite (Chromium + Firefox + mobile) must complete in ≤ 5 minutes.
- **Test count:** ~50+ tests (up from 14).
- **Route coverage:** 28+/30 page routes tested (up from 10/30).
- **File limits:** All new test files under 500 lines. `playwright.config.ts` stays under 500 lines.
- **No new infrastructure files:** Reuses existing helpers (`auth.ts`, `db-reset.ts`). Exception: new `tests/e2e/helpers/rubric-setup.ts` for rubric grading setup.
- **Backward compatibility:** Seed data changes from TRACK-027 remain backward-compatible. The `r2-mock.ts` file remains unchanged (limitation documented — not fixed in this track).

## Acceptance Criteria

1. `pnpm test:e2e` — all tests pass on both Chromium and Firefox.
2. Dashboards render all widgets without console errors.
3. Admin template CRUD works end-to-end (create, edit, duplicate, delete-blocked, delete).
4. Settings hub tests verify profile/password/language/theme/notification preferences persist.
5. User edit and delete (with reassignment dialog) work.
6. Cross-role lifecycle test walks the full assignment flow across all roles.
7. Remaining routes have smoke test coverage (landing, audit log, email queue, analytics, 2FA, imports, discussions, rubric grading, forgot/reset password).
8. Mobile viewport tests pass for dashboard and assignment detail.
9. Axe accessibility scans report zero critical/serious violations on 6 key pages.
10. Moderate/minor axe violations documented in `docs/a11y-violations.md`.
11. Route coverage is 28+/30 (up from 10/30).
12. Test count is ~50+ (up from 14).
13. Full suite runtime ≤ 5 minutes (with Firefox + mobile added).
14. `retries: 1` does not mask real failures (verified: removing a deliberate assertion still fails).
15. `pnpm test:unit` — all existing unit tests still pass.
16. `pnpm typecheck` clean.
17. `pnpm check:i18n` parity maintained.
18. `@axe-core/playwright` scans pass (zero critical/serious).

## Out of Scope

- Full R2 upload end-to-end (same limitation as TRACK-027 — TanStack Start server-fn RPC mock).
- Visual regression / screenshot comparison testing (no infrastructure for baseline management — separate track if needed).
- Performance/load testing (separate concern).
- Email delivery verification (Resend API mocking).
- Cross-browser testing beyond Chromium + Firefox (no WebKit/Safari project — can be added later if needed).
- Full keyboard navigation e2e (axe covers some a11y; comprehensive keyboard nav testing deferred).
- Fixing moderate/minor axe violations (documented only, not fixed in this track).
</protect>
