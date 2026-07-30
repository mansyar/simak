<protect>
# Implementation Plan: TRACK-043 — Application-Level Rate Limiting on Server Functions

## Phase 1: Rate Limit Infrastructure (ErrorCode + rate-limiter module) [checkpoint: 11debcf]

- [x] Task: Read `spec.md` and `conductor/workflow.md` to refresh context before implementation
- [x] Task: Write tests for `RATE_LIMITED` error code (TDD Red Phase)
    - [x] Add test in `tests/unit/lib/errors.test.ts` (or existing error test file): `ErrorCode.RATE_LIMITED` equals `'RATE_LIMITED'`
    - [x] Add test: `serverError(ErrorCode.RATE_LIMITED, 'Rate limit exceeded')` returns `{ error: { code: 'RATE_LIMITED', message: 'Rate limit exceeded' } }`
    - [x] Add test: `isServerError` returns `true` for a `RATE_LIMITED` server error
    - [x] Run `pnpm test` and confirm new tests fail (`RATE_LIMITED` not yet in enum)
- [x] Task: Add `RATE_LIMITED` to `ErrorCode` enum in `src/lib/errors.ts` (TDD Green Phase)
    - [x] Add `RATE_LIMITED: 'RATE_LIMITED'` to the `ErrorCode` const object
    - [x] Run `pnpm test` and confirm all error code tests pass
- [x] Task: Write tests for `src/lib/rate-limiter.ts` (TDD Red Phase)
    - [x] Create `tests/unit/lib/rate-limiter.test.ts` with `/** @vitest-environment node */` header
    - [x] Mock `@tanstack/react-start` (for `createMiddleware`), `@/server/auth` (for `getSessionFromHeaders`), `@/lib/logger` (for logger used by errors.ts)
    - [x] Test `checkRateLimit`: allows requests up to `max` within the window (returns `true` for each)
    - [x] Test `checkRateLimit`: denies when `count >= max` (returns `false`, does NOT increment)
    - [x] Test `checkRateLimit`: resets after window expiry (`Date.now() - windowStart > window * 1000` → new window, count resets to 1, returns `true`)
    - [x] Test `checkRateLimit`: per-key isolation (different keys have independent counters)
    - [x] Test `RATE_LIMITS` presets: `presignedUrl` = `{ window: 60, max: 20 }`, `heavyMutation` = `{ window: 60, max: 10 }`, `destructive` = `{ window: 60, max: 5 }`, `standardRead` = `{ window: 60, max: 60 }`
    - [x] Test `createRateLimitMiddleware`: passes through (calls `next()`) when `getSessionFromHeaders()` returns null (unauthenticated)
    - [x] Test `createRateLimitMiddleware`: allows (calls `next()`) when under the limit
    - [x] Test `createRateLimitMiddleware`: short-circuits with `serverError(ErrorCode.RATE_LIMITED, 'Rate limit exceeded')` when limit exceeded (does NOT call `next()`)
    - [x] Test `createRateLimitMiddleware`: each call generates a unique `fnId` (per-function isolation — two middlewares with the same config have independent counters for the same userId)
    - [x] Export a `resetRateLimitStoreForTests()` function and call it in `beforeEach` to reset the module-level `Map` between tests
    - [x] Run `pnpm test` and confirm new tests fail (`rate-limiter.ts` not yet created)
- [x] Task: Implement `src/lib/rate-limiter.ts` (TDD Green Phase) `8a20ce6`
    - [x] Define `RateLimitConfig` type: `{ window: number; max: number }`
    - [x] Define `RATE_LIMITS` presets constant (4 presets: `presignedUrl`, `heavyMutation`, `destructive`, `standardRead`)
    - [x] Implement `checkRateLimit(store: Map<string, { count: number; windowStart: number }>, key: string, config: RateLimitConfig): boolean` — sliding window logic (window expiry → reset; under max → increment + allow; at/over max → deny without increment)
    - [x] Implement `createRateLimitMiddleware(config: RateLimitConfig)` — auto-incrementing `fnIdCounter`, returns `createMiddleware({ type: 'request' }).server(async ({ next }) => { ... })` that calls `getSessionFromHeaders()`, checks rate limit, short-circuits with `serverError(ErrorCode.RATE_LIMITED, ...)` or calls `next()`
    - [x] Export `resetRateLimitStoreForTests()` for test cleanup
    - [x] Run `pnpm test` and confirm all rate-limiter tests pass
- [x] Task: Conductor - User Manual Verification 'Phase 1: Rate Limit Infrastructure' (Protocol in workflow.md)

## Phase 2: Extend typedServerFn with .middleware() + rateLimit config [checkpoint: 67ca70a]

- [x] Task: Read `spec.md` and `conductor/workflow.md` to refresh context before implementation
- [x] Task: Update `tests/unit/lib/server-fn.test.ts` mock + write new tests (TDD Red Phase)
    - [x] Update the `@tanstack/react-start` mock to include `createMiddleware: vi.fn().mockReturnValue({ server: vi.fn().mockImplementation((fn) => fn) })` and `middleware: vi.fn().mockReturnThis()` on the `createServerFn` return value
    - [x] Test: `typedServerFn({ method: 'GET', rateLimit: { window: 60, max: 5 } })` calls `.middleware([...])` on the builder (verify `middleware` mock was called)
    - [x] Test: `typedServerFn({ method: 'GET' })` without `rateLimit` does NOT call `.middleware()` (pass-through — existing behavior preserved)
    - [x] Test: `typedServerFn({ method: 'POST', rateLimit: { window: 60, max: 10 } }).inputValidator(schema).handler(fn)` — builder chain still works with `rateLimit` (returns a callable function)
    - [x] Test: existing typed-builder and inline-parse patterns still work without `rateLimit` (regression check)
    - [x] Run `pnpm test` and confirm new tests fail (`.middleware()` not yet on `TypedBuilder`, `rateLimit` not yet accepted)
- [x] Task: Implement `.middleware()` + `rateLimit` config in `src/lib/server-fn.ts` (TDD Green Phase)
    - [x] Add `.middleware(middlewares: unknown[]): TypedBuilder` method to the `TypedBuilder` interface
    - [x] Update `typedServerFn` function signature to accept `rateLimit?: RateLimitConfig` in the options
    - [x] Import `RateLimitConfig` type and `createRateLimitMiddleware` from `@/lib/rate-limiter`
    - [x] When `opts.rateLimit` is provided: call `fn.middleware([createRateLimitMiddleware(opts.rateLimit)])` and cast back to `TypedBuilder`
    - [x] When `opts.rateLimit` is omitted: return `fn` directly (existing pass-through behavior)
    - [x] Run `pnpm test` and confirm all `server-fn.test.ts` tests pass
- [x] Task: Conductor - User Manual Verification 'Phase 2: Extend typedServerFn' (Protocol in workflow.md)

## Phase 3: Update Existing Test Mocks for Middleware Chain

- [ ] Task: Read `spec.md` and `conductor/workflow.md` to refresh context before implementation
- [ ] Task: Batch-update all test files that mock `@tanstack/react-start` to include `createMiddleware` + `middleware`
    - [ ] Find all test files with `createServerFn: vi.fn().mockReturnValue({` that lack `middleware:` in the return value (90 files identified via `rg "createServerFn: vi.fn" tests/`)
    - [ ] Add `middleware: vi.fn().mockReturnThis(),` as the first property in the `createServerFn` mock return value (before `inputValidator`)
    - [ ] Add `createMiddleware: vi.fn().mockReturnValue({ server: vi.fn().mockImplementation((fn) => fn) }),` to the `@tanstack/react-start` mock object (alongside `createServerFn`)
    - [ ] Some test files may already mock `createMiddleware` (e.g., `request-context.test.ts`) — skip those
    - [ ] Some test files may have a different mock shape — update those manually
- [ ] Task: Run `pnpm test` to verify all existing tests still pass with updated mocks
    - [ ] If any tests fail, investigate and fix (the mock update is additive — it should not break existing behavior)
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Update Existing Test Mocks' (Protocol in workflow.md)

## Phase 4: Annotate Server Functions with Rate Limit Config

- [ ] Task: Read `spec.md` and `conductor/workflow.md` to refresh context before implementation
- [ ] Task: Annotate Tier 1 functions — presigned URLs (`RATE_LIMITS.presignedUrl`, 20/min)
    - [ ] `src/server/files.ts`: `getPresignedUploadUrl`, `getPresignedDownloadUrl`, `getPresignedReviewFeedbackUploadUrl` — add `rateLimit: RATE_LIMITS.presignedUrl` to `typedServerFn()` calls + import `RATE_LIMITS` from `@/lib/rate-limiter`
    - [ ] `src/server/settings.ts`: `getPresignedAvatarUploadUrl` — same annotation + import
- [ ] Task: Annotate Tier 2 functions — heavy mutations (`RATE_LIMITS.heavyMutation`, 10/min)
    - [ ] `src/server/submissions.ts`: `submitCheckpoint` — add `rateLimit: RATE_LIMITS.heavyMutation` + import
    - [ ] `src/server/reviews.ts`: `submitReview`, `openForReview` — same annotation + import
- [ ] Task: Annotate Tier 3 functions — destructive/bulk/email-triggering (`RATE_LIMITS.destructive`, 5/min)
    - [ ] `src/server/assignments.ts`: `createAssignment`, `reassignAssignment`, `extendDeadline`, `unlockCheckpoint` — add `rateLimit: RATE_LIMITS.destructive` + import
    - [ ] `src/server/templates.ts`: `createTemplate`, `updateTemplate`, `deleteTemplate`, `duplicateTemplate` — same
    - [ ] `src/server/users.ts`: `createUser`, `updateUser`, `deleteUser`, `generateSetupLink` — same
    - [ ] `src/server/bulk-import.ts`: `bulkCreateUsers`, `bulkCreateTemplates` — same
    - [ ] `src/server/gradebook.ts`: `saveGradeConfig`, `recomputeAllGrades` — same
    - [ ] `src/server/rubrics.ts`: `saveRubric`, `softDeleteCriterion`, `softDeleteLevel` — same
    - [ ] `src/server/consultations.ts`: `logConsultation`, `verifyConsultation`, `rejectConsultation` — same
    - [ ] `src/server/extensions.ts`: `requestExtension`, `approveExtension`, `rejectExtension`, `bulkExtend` — same
    - [ ] `src/server/discussions.ts`: `postDiscussionMessage`, `deleteOwnMessage` — same
    - [ ] `src/server/email-queue.ts`: `retryEmail` — same
    - [ ] `src/server/r2-cleanup.ts`: `triggerR2Cleanup` — same
    - [ ] `src/server/two-factor.ts`: `generateTwoFactorSetup`, `enableTwoFactor`, `disableTwoFactor`, `regenerateBackupCodes` — same
    - [ ] `src/server/settings.ts`: `updateProfile`, `updateUserSettings` — same (file already imports `RATE_LIMITS` from Tier 1)
    - [ ] `src/server/sessions.ts`: `revokeSession`, `revokeAllOtherSessions` — same
    - [ ] `src/server/notifications.ts`: `createNotification` — same
- [ ] Task: Annotate Tier 4 functions — standard reads (`RATE_LIMITS.standardRead`, 60/min)
    - [ ] `src/server/assignments.ts`: `listInstructorAssignments`, `getAssignmentDetail`, `listStudentAssignments`, `getStudentAssignmentDetail` — add `rateLimit: RATE_LIMITS.standardRead` (file already imports `RATE_LIMITS` from Tier 3)
    - [ ] `src/server/dashboard.ts`: `getStudentDashboardData`, `getInstructorDashboardData`, `getAdminDashboardData` — add `rateLimit` + import
    - [ ] `src/server/analytics.ts`: all 11 functions (4 analytics + 7 exports) — add `rateLimit` + import
    - [ ] `src/server/reviews.ts`: `listPendingReviews`, `getReviewDetail`, `getLatestReview` — add `rateLimit` (file already imports `RATE_LIMITS` from Tier 2)
    - [ ] `src/server/consultations.ts`: `listConsultations`, `listPendingConsultations`, `getConsultationDetail`, `listVerifiedCounts` — add `rateLimit` (file already imports from Tier 3)
    - [ ] `src/server/extensions.ts`: `listExtensionRequests`, `listMyExtensionRequests` — add `rateLimit` (file already imports from Tier 3)
    - [ ] `src/server/submissions.ts`: `listSubmissions`, `getSubmissionDetail` — add `rateLimit` (file already imports from Tier 2)
    - [ ] `src/server/discussions.ts`: `listDiscussionMessages` — add `rateLimit` (file already imports from Tier 3)
    - [ ] `src/server/templates.ts`: `listTemplates`, `getTemplate`, `listTemplateAssignments` — add `rateLimit` (file already imports from Tier 3)
    - [ ] `src/server/users.ts`: `listUsers`, `getUser`, `listInstructorActiveAssignments` — add `rateLimit` (file already imports from Tier 3)
    - [ ] `src/server/audit-log.ts`: `listAuditLogs`, `getAuditLogDetail` — add `rateLimit` + import
    - [ ] `src/server/email-queue.ts`: `listEmailQueue` — add `rateLimit` (file already imports from Tier 3)
    - [ ] `src/server/gradebook.ts`: `getStudentFinalGrade`, `getAssignmentGradebook` — add `rateLimit` (file already imports from Tier 3)
    - [ ] `src/server/rubrics.ts`: `getRubric`, `countPendingReviews` — add `rateLimit` (file already imports from Tier 3)
    - [ ] `src/server/sessions.ts`: `listActiveSessions` — add `rateLimit` (file already imports from Tier 3)
    - [ ] `src/server/instructor-assignments-filter.ts`: `listInstructorAssignmentsForFilter` — add `rateLimit` + import
    - [ ] `src/server/settings.ts`: `getCurrentUser` — add `rateLimit` (file already imports from Tier 1)
    - [ ] `src/server/two-factor.ts`: `getTwoFactorStatus` — add `rateLimit` (file already imports from Tier 3)
- [ ] Task: Verify exempt functions have NO `rateLimit` config
    - [ ] `src/server/auth.ts`: `_getSession` — no `rateLimit` (internal, cascading concern)
    - [ ] `src/server/notifications.ts`: `getUnreadCount`, `markRead`, `markAllRead` — no `rateLimit` (high-frequency UX)
    - [ ] `src/server/setup-password.ts`: `completePasswordSetup` — no `rateLimit` (token-based, exempt)
- [ ] Task: Run `pnpm typecheck` — verify all annotations are type-correct (`rateLimit` must be `RateLimitConfig`)
- [ ] Task: Run `pnpm test` — verify all tests pass with annotated stubs
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Annotate Server Functions' (Protocol in workflow.md)

## Phase 5: Documentation & Final Verification

- [ ] Task: Read `spec.md` and `conductor/workflow.md` to refresh context before implementation
- [ ] Task: Document rate limit catalog in `conductor/tech-stack.md`
    - [ ] Add dated note (2026-07-30) documenting: application-level rate limiting via `typedServerFn` `rateLimit` config; in-memory sliding window (`src/lib/rate-limiter.ts`); 4-tier presets (`RATE_LIMITS.presignedUrl` 20/min, `heavyMutation` 10/min, `destructive` 5/min, `standardRead` 60/min); per-user + per-function isolation (`userId + ':' + fnId`); unauthenticated pass-through; `RATE_LIMITED` error code; single-instance (in-memory) — Redis deferred for multi-instance; `.middleware()` method added to `TypedBuilder` (shared with TRACK-044)
- [ ] Task: Run full quality gate suite
    - [ ] Run `pnpm test:coverage` — verify >=80% on lines, statements, branches, functions
    - [ ] Run `pnpm typecheck` — verify clean
    - [ ] Run `pnpm lint` — verify clean (0 errors)
    - [ ] Run `pnpm check:i18n` — verify EN<->ID parity (no new i18n keys needed for this track, but verify no breakage)
    - [ ] Verify no file in `src/`, `tests/`, `scripts/` exceeds 500 lines (`scripts/check-modularity.js`)
- [ ] Task: Conductor - User Manual Verification 'Phase 5: Documentation & Final Verification' (Protocol in workflow.md)
</protect>
