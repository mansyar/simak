<protect>
# Implementation Plan: E2E Testing with Playwright

## Phase 1: Playwright Infrastructure & Test Database

- [x] Task: Read spec.md and workflow.md to align with current requirements and TDD protocol
- [x] Task: Install Playwright dependencies
    - [x] Install `@playwright/test` as devDependency via `pnpm add -D @playwright/test`
    - [x] Install Chromium browser binary via `npx playwright install chromium`
- [x] Task: Create Playwright configuration
    - [x] Create `playwright.config.ts` at project root with: Chromium-only project, `webServer` config (auto-start `pnpm dev` on port 3000, `reuseExistingServer: false`), `globalSetup` hook for DB migration + seed, single worker (`workers: 1`), failure artifacts (screenshots `only-on-failure`, traces `retain-on-failure`), base URL `http://localhost:3000`
    - [x] Configure `webServer.env` with test env vars (DATABASE_URL → port 5433, dummy RESEND_API_KEY, test BETTER_AUTH_SECRET, BETTER_AUTH_URL, SUPERADMIN_EMAIL/PASSWORD)
- [x] Task: Add test database to docker-compose
    - [x] Add `postgres-test` service to `docker-compose.yml` (postgres:16-alpine, port 5433, database `simak_test`, same credentials as dev)
- [x] Task: Update .gitignore and package.json scripts
    - [x] Add `tests/e2e/.auth/`, `test-results/`, `playwright-report/` to `.gitignore`
    - [x] Add `"test:e2e": "playwright test"` and `"test:e2e:ui": "playwright test --ui"` scripts to `package.json`
- [x] Task: Conductor - User Manual Verification 'Phase 1: Playwright Infrastructure & Test Database' (Protocol in workflow.md)

## Phase 2: Test Data, Auth & Mock Helpers

- [x] Task: Read spec.md and workflow.md to align with current requirements and TDD protocol
- [x] Task: Create E2E seed script
    - [x] Create `scripts/seed-e2e.ts` that connects to the test DB and creates: Admin user (`admin@e2e.test`), Instructor user (`instructor@e2e.test`), Student user (`student@e2e.test`), all with password `TestPass123!`
    - [x] Seed assignment template (3 checkpoints, type "Thesis", minConsultations: 1 per checkpoint, estimatedDuration per checkpoint)
    - [x] Seed assignment from template assigned to student (first checkpoint unlocked, rest locked)
    - [x] Use Better Auth's `hashPassword` for password hashing (same as production)
- [x] Task: Create DB reset utility
    - [x] Create `tests/e2e/helpers/db-reset.ts` that truncates all tables (except schema_migrations) and re-runs the seed script
    - [x] Wire it to run before each spec file via a shared `beforeAll` hook or Playwright fixture
- [x] Task: Create auth setup with storageState
    - [x] Create `tests/e2e/helpers/auth.ts` with a `loginAsRole(page, role)` function that navigates to `/auth/login`, fills credentials, submits, and waits for dashboard redirect
    - [x] Implement storageState caching — save authenticated session to `tests/e2e/.auth/{role}.json`
    - [x] Create `tests/e2e/setup/auth-setup.ts` that authenticates each role once and saves storageState files
- [x] Task: Create R2 mock helpers
    - [x] Create `tests/e2e/helpers/r2-mock.ts` with `setupR2Mocks(page)` function
    - [x] Intercept `getPresignedUploadUrl` server function → return mock `{ uploadUrl: 'http://localhost:9999/upload', fileKey: 'test-file-key' }`
    - [x] Intercept PUT to mock upload URL → return 200
    - [x] Intercept `getPresignedDownloadUrl` → return mock download URL
    - [x] Intercept R2 HEAD check (`getObjectContentLength`) → return mock file size
- [x] Task: Conductor - User Manual Verification 'Phase 2: Test Data, Auth & Mock Helpers' (Protocol in workflow.md)

## Phase 3: E2E Test Specs

- [x] Task: Read spec.md and workflow.md to align with current requirements and TDD protocol
- [x] Task: Write `tests/e2e/auth.spec.ts` (route guards)
    - [x] Test: Unauthenticated user navigates to `/student/assignments` → redirected to `/auth/login`
    - [x] Test: Student navigates to `/admin/users` → redirected to `/student/dashboard`
    - [x] Test: Valid login with correct credentials → redirected to role-specific dashboard
- [x] Task: Write `tests/e2e/admin-users.spec.ts` (user management)
    - [x] Test: Admin creates an instructor account → user appears in the user list
    - [x] Test: Admin creates a student account → user appears in the user list
    - [x] Test: Admin filters users by role → only matching users shown
- [x] Task: Write `tests/e2e/instructor-assignments.spec.ts` (assignment creation)
    - [x] Test: Instructor creates assignment from template → assignment appears in list
    - [x] Test: Verify checkpoint states: first checkpoint is `unlocked`, subsequent checkpoints are `locked`
- [x] Task: Write `tests/e2e/student-submission.spec.ts` (file submission)
    - [x] Test: Student uploads a file for the first checkpoint → submission appears in version history with version 1
    - [x] Test: Student resubmits → new version (version 2) appears in history with "Latest" badge
- [x] Task: Write `tests/e2e/instructor-review.spec.ts` (review decision)
    - [x] Test: Instructor opens review queue → pending submission appears
    - [x] Test: Instructor reviews with Pass → next checkpoint unlocks for student
    - [x] Test: Instructor reviews with Revise → revision deadline is set, student sees revise state
    - [x] Test: Review history shows both decisions
- [x] Task: Conductor - User Manual Verification 'Phase 3: E2E Test Specs' (Protocol in workflow.md)

## Phase 4: Verification & Documentation

- [ ] Task: Read spec.md and workflow.md to align with current requirements and TDD protocol
- [ ] Task: Run full E2E suite and verify all tests pass
    - [ ] Run `pnpm test:e2e` and confirm all 12-15 tests pass
    - [ ] Verify test execution completes in under 2 minutes
- [ ] Task: Verify failure artifacts and DB reset isolation
    - [ ] Intentionally fail a test and verify screenshot, trace, and console log are captured in `test-results/`
    - [ ] Verify DB is reset (truncate + re-seed) before each spec file by checking data isolation between specs
- [ ] Task: Verify no application code regressions
    - [ ] Run `pnpm test` (unit tests) and confirm all existing tests still pass
    - [ ] Run `pnpm typecheck` and confirm clean
    - [ ] Run `pnpm lint` and confirm clean
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Verification & Documentation' (Protocol in workflow.md)
</protect>
