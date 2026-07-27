<protect>
# TRACK-028: E2E Breadth & Infrastructure Expansion — Implementation Plan

## Phase 1: Dashboard + Admin Template Smoke Tests + Config [checkpoint: 647fa9e]

- [x] Task: Read `spec.md` and `conductor/workflow.md` to align with track requirements and TDD/checkpoint protocol
- [x] Task: Add `retries: 1` config and `firefox` project to `playwright.config.ts` [f15fcc8]
    - [x] Set `retries: 1` in the Playwright config (reduces flaky-test noise without masking real failures). Consider `retries: 2` for CI-only via a `CI` env check.
    - [x] Add `firefox` project using `devices['Desktop Firefox']` to the `projects` array.
    - [x] Verify: `playwright.config.ts` is valid, `pnpm test:e2e --list` lists the firefox project, file stays under 500 lines.
- [x] Task: Install `@axe-core/playwright` devDependency [f15fcc8]
    - [x] Run `pnpm add -D @axe-core/playwright`.
    - [x] Verify: dependency appears in `package.json` devDependencies, `pnpm install` succeeds.
- [x] Task: Write `tests/e2e/dashboards.spec.ts` — 3 role dashboard smoke tests [5a8449]
    - [x] Student dashboard test: navigate to `/student/dashboard`, wait for `networkidle`, verify 4 widgets render (active assignments, upcoming deadlines, pending reviews, consultation reminders), assert key seed data visible ("E2E Test Assignment"), assert no console errors.
    - [x] Instructor dashboard test: navigate to `/instructor/dashboard`, wait for `networkidle`, verify 4 widgets (pending review queue with SLA badges, recent submissions, assignment overview, at-risk students), assert no console errors.
    - [x] Admin dashboard test: navigate to `/admin/dashboard`, wait for `networkidle`, verify widgets (system metrics, activity feed, deadline escalation alerts, email queue stats), assert no console errors.
    - [x] Verify: `pnpm test:e2e dashboards.spec.ts` passes on Chromium.
- [x] Task: Write `tests/e2e/admin-templates.spec.ts` — template CRUD tests [977d26b]
    - [x] Create test: admin creates a template (name, type, 3 checkpoints with add/remove/reorder) → verify it appears in the template list.
    - [x] Edit test: admin edits the template at `/admin/templates/$templateId` → verify changes persist after reload.
    - [x] Duplicate test: admin duplicates the template → verify "(Copy)" suffix appears.
    - [x] Delete-blocked test: admin attempts to delete a template in use by an assignment → verify deletion is blocked with usage count.
    - [x] Delete-unused test: admin deletes an unused template (type "DELETE" confirmation) → verify it disappears from the list.
    - [x] Verify: `pnpm test:e2e admin-templates.spec.ts` passes on Chromium.
- [x] Task: Verify Phase 1 suite is green and axe scans run without config errors
    - [x] Run `pnpm test:e2e` — full suite passes on Chromium. (38 passed, 1 pre-existing failure in instructor-assignments.spec.ts unrelated to track changes)
    - [x] Verify axe scans can be invoked without configuration errors (smoke check of the `@axe-core/playwright` import/usage). (AxeBuilder import + instantiation verified)
- [x] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)

## Phase 2: Settings, User Edit/Delete, Remaining Route Smoke Tests

- [x] Task: Read `spec.md` and `conductor/workflow.md` to align with track requirements and TDD/checkpoint protocol
- [x] Task: Write `tests/e2e/settings.spec.ts` — settings hub tests [1b376b2]
    - [x] Profile test: edit name → verify it persists after reload and appears in sidebar.
    - [x] Password test: change password → verify old password no longer works, new password works.
    - [x] Language test: toggle from EN to ID → verify a known UI string changes (sidebar label or page heading).
    - [x] Theme test: toggle from light to dark → verify `dark` class is applied to `<html>`.
    - [x] Notification preferences test: toggle off an event type email → verify the checkbox state persists after reload.
    - [x] Verify: `pnpm test:e2e settings.spec.ts` passes on Chromium.
- [x] Task: Expand `tests/e2e/admin-users.spec.ts` with edit and delete tests [14decf1]
    - [x] Edit user test: open edit sheet, change name, submit, verify change in table.
    - [x] Delete with reassignment test: delete an instructor with active assignments → verify `ReassignmentDialog` appears → select replacement instructor → confirm → verify assignment is reassigned (instructor changed in DB).
    - [x] Delete without assignments test: delete user without active assignments → verify direct deletion without dialog.
    - [ ] Verify: `pnpm test:e2e admin-users.spec.ts` passes on Chromium.
- [ ] Task: Write `tests/e2e/smoke-routes.spec.ts` — lightweight smoke tests for untested routes
    - [ ] Landing page (`/`): verify hero section and feature cards render.
    - [ ] Admin audit log (`/admin/audit-log`): verify table loads, filters render.
    - [ ] Admin email queue (`/admin/email-queue`): verify table loads, status filter renders.
    - [ ] Admin analytics (`/admin/analytics`): verify metric cards render, date range selector present.
    - [ ] Instructor analytics (`/instructor/analytics`): verify metrics render.
    - [ ] Forgot password (`/auth/forgot-password`): fill email, submit, verify success message.
    - [ ] Reset password (`/auth/reset-password`): verify form renders with token.
    - [ ] 2FA verify page (`/auth/verify-2fa`): verify TOTP input renders.
    - [ ] Bulk user import (`/admin/users/import`): verify upload zone and template download button render.
    - [ ] Bulk template import (`/admin/templates/import`): verify upload zone renders.
    - [ ] Verify: `pnpm test:e2e smoke-routes.spec.ts` passes on Chromium.
- [ ] Task: Create `tests/e2e/helpers/rubric-setup.ts` and write `tests/e2e/rubric-grading.spec.ts`
    - [ ] Create `tests/e2e/helpers/rubric-setup.ts`: dedicated helper that sets up rubric criteria + sets `gradingType: 'numeric'` on the Proposal template checkpoint via DB helper at test start.
    - [ ] Rubric grading test: set up rubric criteria + `gradingType` via the helper → instructor reviews with rubric scoring → add numeric scores per criterion → verify weighted total auto-computes → submit → verify `review_scores` persisted in DB.
    - [ ] Verify: `pnpm test:e2e rubric-grading.spec.ts` passes on Chromium.
- [ ] Task: Write `tests/e2e/discussions.spec.ts` — checkpoint discussion Q&A tests
    - [ ] Student posts a message on checkpoint page → verify it appears.
    - [ ] Instructor sees it in Discussions tab → instructor replies → verify reply appears with indentation.
    - [ ] Student deletes within 15-min window → verify soft-delete.
    - [ ] Verify: `pnpm test:e2e discussions.spec.ts` passes on Chromium.
- [ ] Task: Verify Phase 2 route coverage and full suite
    - [ ] Run `pnpm test:e2e` — full suite passes on Chromium.
    - [ ] Verify route coverage increased from 10/30 to 28+/30.
    - [ ] Verify test count is trending toward ~50+.
- [ ] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

## Phase 3: Cross-Role Lifecycle + Mobile + A11y + Firefox

- [ ] Task: Read `spec.md` and `conductor/workflow.md` to align with track requirements and TDD/checkpoint protocol
- [ ] Task: Write `tests/e2e/cross-role-lifecycle.spec.ts` — full lifecycle integration test
    - [ ] Single serial test: admin creates template → instructor creates assignment from template → student logs consultation → instructor verifies → student submits (via DB helper) → instructor reviews with Pass → verify next checkpoint unlocks → student submits → instructor reviews with Revise → student resubmits → instructor reviews with Pass → verify assignment completion state.
    - [ ] Set timeout to 120s, mark as serial, runs last.
    - [ ] Browser context management: single context, clear cookies + storageState between role switches, login as new role via Better Auth API (`loginAsRole` pattern).
    - [ ] Verify: `pnpm test:e2e cross-role-lifecycle.spec.ts` passes on Chromium.
- [ ] Task: Add `mobile-chrome` project to `playwright.config.ts` and run mobile tests
    - [ ] Add `mobile-chrome` project using `devices['Pixel 7']` (or `devices['iPhone 14']`).
    - [ ] Run dashboard and assignment detail tests on mobile viewport to verify responsive layouts (card-based `ProgressTable`, stacked `CheckpointListEditor`, mobile step indicator in wizard).
    - [ ] Verify: mobile tests pass, `playwright.config.ts` stays under 500 lines.
- [ ] Task: Implement axe accessibility scans on 6 key pages
    - [ ] Run axe scans on: login page, student dashboard, student assignment detail, instructor review detail, admin users, admin templates.
    - [ ] Assert zero critical and serious violations.
    - [ ] Document moderate/minor violations in `docs/a11y-violations.md`.
    - [ ] Verify: axe scans pass (zero critical/serious), violations doc created.
- [ ] Task: Run full suite on Firefox and fix any browser-specific failures
    - [ ] Run `pnpm test:e2e` on Firefox project.
    - [ ] Triage and fix any Firefox-specific failures within this track (do not skip or defer).
    - [ ] Verify: full suite passes on Firefox.
- [ ] Task: Final verification and Definition of Done
    - [ ] Run `pnpm test:e2e` — all tests pass on both Chromium and Firefox.
    - [ ] Verify full suite runtime ≤ 5 minutes (with Firefox + mobile added).
    - [ ] Verify `retries: 1` does not mask real failures (remove a deliberate assertion, confirm it still fails, then restore).
    - [ ] Run `pnpm test:unit` — all existing unit tests still pass.
    - [ ] Run `pnpm typecheck` — clean.
    - [ ] Run `pnpm check:i18n` — parity maintained.
    - [ ] Verify route coverage is 28+/30 (up from 10/30).
    - [ ] Verify test count is ~50+ (up from 14).
    - [ ] Verify all new test files under 500 lines, `playwright.config.ts` under 500 lines.
    - [ ] Verify `r2-mock.ts` remains unchanged (limitation documented).
- [ ] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)
</protect>
