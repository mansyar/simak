# Track: TRACK-027 — Critical Business Flow E2E Coverage

## Metadata
- **Track ID:** `critical-business-flow-e2e-coverage_20260726`
- **Type:** feature
- **Status:** Pending
- **Dependencies:** E2E-FEAT-001 (E2E Testing with Playwright — provides infrastructure). Can be implemented independently of TRACK-028.
- **Estimated Effort:** 4 Days / 2 Sprint Loops
- **Audit IDs:** None (proactive testing gap remediation — identified in E2E audit)

## Overview

A comprehensive E2E test audit (conducted after Milestone 4 / E2E-FEAT-001 and all subsequent feature tracks) found that the existing 5-spec, 14-test Playwright suite covers only 10 of 30 page routes (33%). Several core business flows have **zero** E2E coverage: consultation lifecycle, deadline extension requests, password setup flow, and notification delivery.

This track closes the P0 gaps in untested core flows. It is paired with TRACK-028 (breadth & infrastructure), which handles P1/P2 breadth, multi-browser, mobile viewport, and a11y scans. Both tracks build on the Playwright infrastructure established in E2E-FEAT-001.

**Goal:** Raise E2E test count from 14 to ~28, covering consultation, extension, and password-setup lifecycles; add notification delivery assertions; exercise the upload UI validation; add negative test cases; and decouple the instructor-review tests so each runs independently.

## Context Anchors (Traceability)

**PRD Reference:** `docs/PRD.md` — Consultation tracking (student log → instructor verify → gating), deadline extension workflow (request → approve/reject → deadline adjustment), invitation-only registration (admin creates user → password setup token → login), in-app notification delivery, file submission (upload form, validation, version history)

**TDD Reference:**
- `src/server/consultations.ts` + `consultations.server.ts` + `consultations-extras.server.ts` (7 server functions: `logConsultation`, `listConsultations`, `listPendingConsultations`, `verifyConsultation`, `rejectConsultation`, `getConsultationDetail`, `listVerifiedCounts`)
- `src/server/extensions.ts` + `extensions.server.ts` + `extensions-extras.server.ts` (`requestExtension`, `listMyExtensionRequests`, `approveExtension`, `rejectExtension`, `bulkExtend`)
- `src/server/setup-password.ts` (single file — both `completePasswordSetupHandler` and `createServerFn` stub; exception to the two-file split pattern; atomic `DELETE ... RETURNING` token consumption)
- `src/server/notifications.ts` + `notifications.server.ts` (`markRead`, `markAllRead`, `getUnreadCount`, `listNotifications`)
- `src/server/submissions.server.ts` (`submitCheckpointHandler` — consultation gating check at lines 108–128: counts verified consultations, returns `BAD_REQUEST` if `count < minConsults`)
- `src/server/reviews.server.ts` (`submitReviewHandler` — unconditionally unlocks next checkpoint on Pass at line 371–399; minConsultations does NOT gate unlock per code comment at line 378–380)
- `tests/e2e/helpers/auth.ts` (`loginAsRole`, `ensureAuthFile`, `ROLE_CREDENTIALS`)
- `tests/e2e/helpers/db-reset.ts` (`resetDatabase`, `TABLES_TO_TRUNCATE`, `getDatabaseUrl`)
- `tests/e2e/helpers/r2-mock.ts` (`setupR2Mocks` — documented non-functional due to TanStack Start server-fn RPC limitation)
- `scripts/seed-e2e.ts` (seed data: 4 users, 1 template with `minConsultations: 1`, 1 assignment, 3 per-student checkpoints)
- `playwright.config.ts` (Chromium-only, `workers: 1`, `retries: 0`)

**Product Spec Reference:** `conductor/product.md` — Track 6.1 (Consultation Logging & Verification), Track 1.3 Deadline Extension Workflow, Track 1.3 Authentication & Authorization (password setup flow at `/auth/setup-password?token=xxx`), Track 7.1 In-App Notification System, Track 4.1 File Upload & Submission, Track E2E-FEAT-001 (existing 5 spec files, 14 tests)

## Track Tech Stack

- **Playwright v1.61.1** — New spec files under `tests/e2e/`, following the existing pattern (`beforeAll` → `resetDatabase()` → `ensureAuthFile()` → `test.use({ storageState })`).
- **`postgres` npm package** — Direct DB helpers for test setup (create consultation, set checkpoint state, extract verification tokens), following the `createSubmissionForCheckpoint` pattern in `student-submission.spec.ts`.
- **Existing helper infrastructure** — `tests/e2e/helpers/auth.ts`, `tests/e2e/helpers/db-reset.ts`, `scripts/seed-e2e.ts`. No new infrastructure dependencies.
- **`@axe-core/playwright`** — NOT included (deferred to TRACK-028).

## Functional Requirements

**FR1 — `consultation.spec.ts` (Consultation lifecycle):** Student logs a consultation (form: checkpoint selector, session type internal/external, notes) → verify it appears in the student's ConsultationList with "pending" badge → instructor sees it in the verification queue on `/instructor/assignments/$id` → instructor verifies via VerificationDialog → consultation state transitions to "verified" in DB → verify consultation count increments in ConsultationProgress. Then instructor rejects a second consultation with a reason → verify "rejected" badge. Then verify the consultation gating is reflected in the UI: navigate to the student assignment detail page and verify the locked checkpoint (e.g., Chapter 1) shows "insufficient verified consultations (0/1)" as a blocking reason alongside "previous checkpoint not passed"; after the instructor verifies a consultation, reload and verify the count updates to (1/1).

*Documented limitation:* `minConsultations` gates SUBMISSION via `submitCheckpointHandler`, NOT checkpoint unlock — the review handler unconditionally unlocks the next checkpoint on Pass per `reviews.server.ts:378-380`. The full submission gating can't be tested via UI because it runs after the R2 upload step, which is bypassed in e2e. The UI blocking-reason display is the testable surface.

**FR2 — `extension.spec.ts` (Extension workflow):** Student submits an extension request (category: personal/research/health/other, reason ≥10 chars, duration 1–7 days) → verify it appears in the student's extension history table with "pending" badge → instructor sees it in the extension queue on `/instructor/assignments/$id` → instructor approves with optional comment → verify checkpoint `dueDate` is extended in DB by the requested duration → verify status badge changes to "approved". Then student submits a second request → instructor rejects with required reason (≥20 chars) → verify status badge changes to "rejected" and deadline is NOT extended. Then instructor initiates a bulk extension → verify all unfinished checkpoints' `dueDate` values are extended.

**FR3 — `password-setup.spec.ts` (Invitation onboarding):** Admin creates a new user via the create-user dialog (reuse existing pattern from `admin-users.spec.ts`) → extract the verification token from the DB (`SELECT value FROM verification WHERE ...`) → navigate to `/auth/setup-password?token=<token>` → fill password fields → submit → verify redirect to login → login with the new user's credentials via `loginAsRole` pattern → verify redirect to role-specific dashboard. Then attempt to reuse the same token → verify "Invalid or expired token" error. Then insert an expired token in the DB → navigate to setup-password → verify same error.

**FR4 — Notification delivery assertions:** Add post-action assertions to existing specs:
- After `student-submission.spec.ts` creates a submission, log in as instructor and verify the notification badge count incremented and a `submission_received` notification item appears in the NotificationCenter.
- After `instructor-review.spec.ts` submits a Pass review, log in as student and verify `review_completed` notification appears.
- After `consultation.spec.ts` verifies a consultation, log in as student and verify `consultation_verified` notification appears.
- Verify mark-as-read and mark-all-read functionality.

**FR5 — Upload UI exercise:** In `student-submission.spec.ts`, expand the existing test: click Submit → verify `[data-testid="drop-zone"]` and `[data-testid="file-input"]` are visible → attempt to upload a `.txt` file via `setInputFiles` → verify validation error (wrong file type) → attempt to upload a file >25MB → verify size validation error. (Actual R2 upload remains bypassed via DB insertion — documented limitation.)

**FR6 — Negative test cases:**
- `auth.spec.ts`: invalid login credentials (wrong password) → verify inline error on login page.
- `student-submission.spec.ts`: navigate directly to a locked checkpoint's submission URL → verify the Submit button is not present or is disabled.
- Cross-student access denial: log in as `student3@e2e.test` (not enrolled, per seed expansion) → attempt to navigate to the seeded assignment URL → verify not-found or access-denied state.
- `admin-users.spec.ts`: superadmin creates an Admin account (Admins cannot do this — verify the Admin role option is available for superadmin but not for regular admin).

**FR7 — Decouple `instructor-review.spec.ts`:** Refactor the 4 tests so each sets up its own submission state via the `createSubmissionForCheckpoint` DB helper, removing the implicit order dependency where the Revise test relies on the Pass test having unlocked Chapter 1. Each test must be independently runnable.

**FR8 — Expand seed data:** Update `scripts/seed-e2e.ts` to add:
- `student2@e2e.test` enrolled in the same assignment (for multi-student review queue scenarios).
- `student3@e2e.test` NOT enrolled in any assignment (for cross-student access denial tests).
- One pending consultation on the Proposal checkpoint for the instructor verification queue.

## Non-Functional Requirements

- Test count increases from 14 to ~28.
- Full `pnpm test:e2e` runtime ≤ 3 minutes.
- No flaky tests on 3 consecutive runs (verified manually).
- No new dependencies added (all tests use existing `@playwright/test`, `postgres`, and helper infrastructure).
- `scripts/seed-e2e.ts` changes are backward-compatible (existing specs that don't use the second/third student still pass).
- `playwright.config.ts` unchanged (Chromium-only, single worker).
- All new test files ≤ 500 lines (enforced by `scripts/check-modularity.js`).
- `pnpm test:unit` still passes (seed script changes may require updating unit test mocks).
- `pnpm typecheck` clean. `pnpm check:i18n` parity maintained.

## Acceptance Criteria

1. **Manual Checkpoint:** `pnpm test:e2e` — all tests pass.
   - `consultation.spec.ts` verifies the full consultation lifecycle (log → verify → gating UI display — blocking reason shows "insufficient verified consultations (0/1)" and updates to (1/1) after verification). Note: minConsultations gates submission, not unlock — only the UI blocking reason is tested.
   - `extension.spec.ts` verifies request → approve/reject → deadline adjustment.
   - `password-setup.spec.ts` verifies the invitation onboarding flow (create user → set password → login).
   - Notification assertions confirm badge count and notification items appear after key actions.
   - Upload UI test exercises file type and size validation.
   - Negative tests confirm invalid login, locked checkpoint, and cross-student access are properly rejected.
   - Superadmin test confirms role-creation rule (superadmin can create Admin accounts, regular admin cannot).
   - `instructor-review.spec.ts` tests are independently runnable (verified via `--grep`).
   - Test count is ~28+ (up from 14).
2. **Automated Tests:** `pnpm test:e2e` — all pass; full suite runtime ≤ 3 minutes; no flaky tests on 3 consecutive runs. `pnpm test:unit` — all existing unit tests still pass. `pnpm typecheck` clean. `pnpm check:i18n` parity maintained.
3. **Conductor Review:** New spec files follow the existing pattern (`beforeAll` → `resetDatabase()` → `ensureAuthFile()` → `test.use({ storageState })`). DB helper functions follow the `createSubmissionForCheckpoint` pattern (open connection, query, close connection). No new dependencies. `scripts/seed-e2e.ts` changes backward-compatible. `instructor-review.spec.ts` tests fully decoupled. Consultation gating test verifies the UI blocking-reason display (documented limitation due to R2 bypass). Superadmin role-creation rule test added to `admin-users.spec.ts`. `playwright.config.ts` unchanged. All new test files under 500 lines.

## Out of Scope

- Full R2 upload end-to-end (presigned URL generation → direct-to-R2 PUT → `submitCheckpoint` call) — blocked by the TanStack Start server-fn RPC mock limitation documented in `tests/e2e/helpers/r2-mock.ts`. Tests continue to use direct DB insertion as the workaround.
- Dashboard smoke tests (deferred to TRACK-028).
- Admin template management, settings hub, analytics coverage (deferred to TRACK-028).
- Multi-browser, mobile viewport, accessibility e2e (deferred to TRACK-028).
- 2FA login flow e2e (deferred to TRACK-028 — requires TOTP secret seeding).
- Email delivery verification (Resend API mocking — separate concern if needed).
- Performance/load testing (separate concern).
