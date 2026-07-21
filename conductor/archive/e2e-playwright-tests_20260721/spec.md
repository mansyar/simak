<protect>
# Track: E2E Testing with Playwright

## Overview

Add Playwright-based end-to-end testing infrastructure to SIMAK. The suite covers 5 critical-path user flows (~12-15 test cases) across admin, instructor, and student roles. Tests run against a dedicated test database with automatic seeding and reset before each spec file. Opt-in via `pnpm test:e2e` — not part of the pre-push gate.

Playwright is already listed in the project tech stack (`conductor/tech-stack.md` → Testing & Quality) but is not yet installed or configured.

## Functional Requirements

### FR-1: Playwright Installation & Configuration
- Install `@playwright/test` as a devDependency
- Create `playwright.config.ts` at project root with:
  - Chromium-only browser project
  - `webServer` config: auto-start `pnpm dev` on port 3000, `reuseExistingServer: true` in non-CI
  - `globalSetup`: run DB migrations + seed base test data against the test DB
  - Single worker (`workers: 1`) — tests are sequential since flows build on each other
  - Failure artifacts: screenshots, trace files, console logs (no video)
  - Base URL: `http://localhost:3000`

### FR-2: Test Database Infrastructure
- Add `postgres-test` service to `docker-compose.yml` (same `postgres:16-alpine` image, port 5433, database `simak_test`)
- Create E2E seed script (`scripts/seed-e2e.ts`) with deterministic test data:
  - SuperAdmin (from existing seed)
  - Admin user (`admin@e2e.test` / `TestPass123!`)
  - Instructor user (`instructor@e2e.test` / `TestPass123!`)
  - Student user (`student@e2e.test` / `TestPass123!`)
  - Assignment template (3 checkpoints, type "Thesis", minConsultations: 1 per checkpoint)
  - Assignment from template assigned to student
- Implement DB reset (truncate all tables + re-seed base data) before each spec file via a `globalSetup`-registered hook or per-file `beforeAll`
- Test env vars set via Playwright `webServer.env`:
  - `DATABASE_URL` → test DB connection string (port 5433)
  - `RESEND_API_KEY` → dummy value (emails enqueue but fail silently)
  - `BETTER_AUTH_SECRET` → test secret (32+ chars)
  - `BETTER_AUTH_URL` → `http://localhost:3000`
  - `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` → deterministic test credentials

### FR-3: Auth & Session Management
- UI-based login per role — each role logs in via the `/auth/login` form
- `storageState` caching — login once per role in a setup test, save session to `tests/e2e/.auth/{role}.json`, reuse across all tests in that role
- Session files gitignored
- If session expires, the setup test re-authenticates

### FR-4: R2 File Upload Mocking
- Playwright `page.route()` intercepts server function calls related to file uploads:
  - `getPresignedUploadUrl` → return mock `{ uploadUrl: 'http://localhost:9999/upload', fileKey: 'test-file-key' }`
  - PUT to mock upload URL → return 200
  - `getPresignedDownloadUrl` → return mock download URL
  - `getObjectContentLength` (R2 HEAD check) → return mock file size
- Tests the full UI flow: file selection, upload progress bar, success state, submission recording
- No real R2 credentials required

### FR-5: E2E Test Specs (5 files, ~12-15 test cases)

**`tests/e2e/auth.spec.ts` — Route Guards (3 tests)**
- Unauthenticated user navigates to `/student/assignments` → redirected to `/auth/login`
- Student navigates to `/admin/users` → redirected to `/student/dashboard`
- Valid login with correct credentials → redirected to role-specific dashboard

**`tests/e2e/admin-users.spec.ts` — Admin User Management (3 tests)**
- Admin creates an instructor account → user appears in the user list
- Admin creates a student account → user appears in the user list
- Admin filters users by role → only matching users shown

**`tests/e2e/instructor-assignments.spec.ts` — Assignment Creation (2-3 tests)**
- Instructor creates assignment from template → assignment appears in list
- Verify checkpoint states: first checkpoint is `unlocked`, subsequent checkpoints are `locked`

**`tests/e2e/student-submission.spec.ts` — File Submission (2-3 tests)**
- Student uploads a file for the first checkpoint → submission appears in version history with version 1
- Student resubmits → new version (version 2) appears in history with "Latest" badge

**`tests/e2e/instructor-review.spec.ts` — Review Decision (3-4 tests)**
- Instructor opens review queue → pending submission appears
- Instructor reviews with Pass → next checkpoint unlocks for student
- Instructor reviews with Revise → revision deadline is set, student sees revise state
- Review history shows both decisions

### FR-6: Package Scripts
- `pnpm test:e2e` — `playwright test`
- `pnpm test:e2e:ui` — `playwright test --ui` (interactive debug mode)

## Non-Functional Requirements

- **Determinism:** Tests must be deterministic — no flaky tests due to timing or shared state. DB reset before each spec file ensures isolation.
- **No external dependencies:** Tests must not send real emails (dummy `RESEND_API_KEY`), must not require real R2 credentials, must not depend on external services beyond the test PostgreSQL container.
- **Performance:** Full E2E suite should complete in under 2 minutes.
- **No application code changes:** Existing application code must not be modified (except `docker-compose.yml` extension and `package.json` script additions). The E2E infrastructure is purely additive.
- **Git hygiene:** `tests/e2e/.auth/` session files, `test-results/`, and `playwright-report/` directories must be gitignored.

## Acceptance Criteria

- AC-1: `pnpm test:e2e` runs all E2E tests against a dedicated test database (port 5433, `simak_test`)
- AC-2: All 5 spec files pass with 12-15 test cases total
- AC-3: Failure artifacts (screenshots, traces, console logs) are captured on test failure in `test-results/`
- AC-4: Test DB is reset (truncate + re-seed) before each spec file runs
- AC-5: R2 file uploads are mocked via `page.route()` — no real R2 credentials needed
- AC-6: Auth is via UI login with `storageState` caching per role
- AC-7: `pnpm test:e2e:ui` opens interactive Playwright UI mode
- AC-8: No changes to existing application code behavior
- AC-9: `@playwright/test` added to devDependencies; `playwright.config.ts` created at project root
- AC-10: `docker-compose.yml` extended with `postgres-test` service
- AC-11: `.gitignore` updated with E2E artifact directories
- AC-12: `conductor/tech-stack.md` remains accurate (Playwright already listed)

## Out of Scope

- Firefox/WebKit browser coverage (Chromium only — can be added later via Playwright projects config)
- Consultation logging/verification E2E (well-covered by unit tests)
- Deadline extension workflow E2E (well-covered by unit tests)
- Notification flow E2E (well-covered by unit tests)
- CI pipeline setup (GitHub Actions — can be added when CI is set up)
- Visual regression testing
- Video recording on failure
- Page Object Model pattern (flat spec files instead — can be refactored if suite grows)
- Pre-push gate integration (opt-in only, like integration tests)
- Changes to existing application code
</protect>
