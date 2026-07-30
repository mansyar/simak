<protect>
# Specification: TRACK-043 — Application-Level Rate Limiting on Server Functions

## Overview

Proactive security hardening: add application-level rate limiting to authenticated TanStack Start server functions via the `typedServerFn` wrapper. Better Auth's built-in rate limiting (`window: 60, max: 10`) only covers `/api/auth/*` endpoints — every application server function (`submitCheckpoint`, `createAssignment`, `deleteUser`, `getPresignedUploadUrl`, `enqueueEmail`, etc.) is unprotected. A compromised authenticated user or buggy client loop could spam R2 presigned URL generation (Cloudflare cost abuse), flood the email queue (DoS + Resend cost), create thousands of assignments/submissions (data pollution), or exhaust DB connections with rapid-fire queries.

This track extends the `typedServerFn` wrapper (introduced in TRACK-032) with an optional `rateLimit` config that internally chains a `rateLimitMiddleware` before the `.inputValidator()` / `.handler()` calls. The middleware obtains the userId via `getSessionFromHeaders()`, checks an in-memory sliding window counter keyed by `userId + fnId`, and short-circuits with `serverError(ErrorCode.RATE_LIMITED, ...)` when the limit is exceeded.

**Track Type:** Chore (infrastructure / security hardening)
**Milestone:** 12 — Security, Reliability & Real-Time Infrastructure
**Dependencies:** TRACK-032 (Type-Safety Restoration — provides the `typedServerFn` wrapper chokepoint)
**Coordinate with:** TRACK-044 (Request ID Middleware Wiring — both extend `typedServerFn` with `.middleware()` chaining; if parallelized, TRACK-044 should precede TRACK-043)
**Audit IDs:** None (proactive)

## Problem Statement

All 100+ handler call sites fetch the session via `getSessionFromHeaders()` **inside** the handler — there is no pre-handler middleware to enforce rate limits. The attack vectors are:

1. **R2 cost abuse:** `getPresignedUploadUrl` generates presigned URLs with no limit. A compromised client loop could generate thousands of URLs per minute, inflating Cloudflare R2 costs.
2. **Email queue flooding:** `enqueueEmail` is called post-commit from multiple handlers (consultation creation, extension approval, review submission, discussion posts). Rapid-fire mutations flood the email queue and inflate Resend API costs.
3. **Data pollution:** `createAssignment`, `submitCheckpoint`, `createUser` — no limit on creation rate. A buggy client loop or malicious user could create thousands of records.
4. **DB connection exhaustion:** Rapid-fire read queries (`listUsers`, `getAdminAnalyticsData`, export endpoints) could exhaust the connection pool (default 10 connections, TRACK-042).

Better Auth's rate limiting does not cover these — it only protects `/api/auth/*` endpoints (login, 2FA, password reset).

## Functional Requirements

### FR-1: Add `RATE_LIMITED` to `ErrorCode` enum

Add `RATE_LIMITED: 'RATE_LIMITED'` to the `ErrorCode` const object in `src/lib/errors.ts`. The `ErrorCode` type and `ServerError` type automatically include the new value via the existing `typeof` inference.

> **Note:** TanStack Start server functions return JSON (HTTP 200) with `{ error: { code, message } }`. The client checks `isServerError(result)`. There is no HTTP status code mapping — the "429" is a semantic concept, not an actual HTTP status. The `RATE_LIMITED` code is handled identically to other error codes (`UNAUTHORIZED`, `FORBIDDEN`, etc.).

### FR-2: Create in-memory sliding window rate limiter module

New file `src/lib/rate-limiter.ts` containing:

1. **`RateLimitConfig` type:** `{ window: number; max: number }` — `window` in seconds, `max` is the maximum requests per window.

2. **`RATE_LIMITS` presets constant** — centralized, named presets for easy tuning:

   | Preset | `window` | `max` | Rationale |
   |--------|----------|-------|-----------|
   | `presignedUrl` | 60 | 20 | R2 cost abuse prevention — generous for legitimate uploads |
   | `heavyMutation` | 60 | 10 | Data pollution prevention — submissions, reviews |
   | `destructive` | 60 | 5 | Destructive / bulk / email-triggering — tightest limits |
   | `standardRead` | 60 | 60 | List/dashboard/export reads — 1 req/sec is generous for UI navigation |

3. **`checkRateLimit(store, key, config): boolean`** — pure function that checks/updates a sliding window counter:
   - If `Date.now() - entry.windowStart > config.window * 1000`: window expired → reset (`count = 1`, `windowStart = now`), return `true` (allowed).
   - If `entry.count < config.max`: increment `count`, return `true` (allowed).
   - Otherwise: return `false` (rate limited — do NOT increment).

4. **Module-level `Map<string, { count: number; windowStart: number }>`** — the in-memory store. Keyed by `userId + ':' + fnId`.

### FR-3: Create `createRateLimitMiddleware` factory

Function in `src/lib/rate-limiter.ts` that:

1. Accepts a `RateLimitConfig`.
2. Generates a unique `fnId` (auto-incrementing counter) for each call — ensures per-function isolation (one function's limit doesn't affect another).
3. Returns a TanStack Start middleware via `createMiddleware({ type: 'request' }).server(async ({ next }) => { ... })`.
4. Inside the middleware:
   - Call `getSessionFromHeaders()` to obtain the session.
   - If no session (unauthenticated): call `next()` — **pass-through** (unauthenticated functions are exempt; auth-based rate limiting requires a userId).
   - If session exists: construct key `session.user.id + ':' + fnId`, call `checkRateLimit(store, key, config)`.
   - If allowed: call `next()` — proceed to the handler.
   - If exceeded: return `serverError(ErrorCode.RATE_LIMITED, 'Rate limit exceeded')` **without calling `next()`** — short-circuit.

> **Performance note:** `getSessionFromHeaders()` is called in the middleware AND in the handler. The 5s TTL in-memory session cache (TRACK-007) means the handler's call is a cache hit for the DB role/locale lookup. `auth.api.getSession()` is always called (security-critical — validates the session token), but Better Auth's internal session verification is lightweight (cookie parse + DB session lookup, cached by the 5s TTL on the DB side). The overhead is one extra `getSessionFromHeaders()` call per rate-limited request — acceptable for the security benefit.

### FR-4: Extend `TypedBuilder` interface with `.middleware()` method

Add a `.middleware(middlewares: unknown[]): TypedBuilder` method to the `TypedBuilder` interface in `src/lib/server-fn.ts`. This enables the `.middleware([...]).inputValidator(schema).handler(fn)` builder chain. The method is typed to return `TypedBuilder` (which has `.inputValidator()` and `.handler()`) — consistent with TanStack Start's actual builder chain where `.middleware()` precedes `.inputValidator()`.

This method is also used by TRACK-044 (Request ID Middleware Wiring) to chain `requestIdMiddleware` — the interface extension is shared infrastructure.

### FR-5: Extend `typedServerFn` to accept optional `rateLimit` config

Update the `typedServerFn` function signature in `src/lib/server-fn.ts`:

```ts
export function typedServerFn(opts: {
  method: 'GET' | 'POST';
  rateLimit?: RateLimitConfig;
}): TypedBuilder {
  const fn = createServerFn(opts) as unknown as TypedBuilder;
  if (opts.rateLimit) {
    return fn.middleware([createRateLimitMiddleware(opts.rateLimit)]) as unknown as TypedBuilder;
  }
  return fn;
}
```

When `rateLimit` is provided, the wrapper internally chains the `rateLimitMiddleware` before returning. When omitted, the wrapper is a pure pass-through (existing behavior — no middleware). The `as unknown as TypedBuilder` cast preserves the existing type-inference solution from TRACK-032.

### FR-6: Annotate expensive server functions with rate limit config

Apply `rateLimit` config to server function stubs across all 23 stub files using the `RATE_LIMITS` presets. The annotation is a one-line change per stub: `typedServerFn({ method: 'POST', rateLimit: RATE_LIMITS.destructive })`.

See **Rate Limit Catalog** below for the full function-to-tier mapping.

### FR-7: Export `RATE_LIMITS` for use in stub files

The `RATE_LIMITS` constant must be exported from `src/lib/rate-limiter.ts` and imported in each stub file that uses rate limiting. Stubs reference presets by name (`RATE_LIMITS.presignedUrl`, not raw `{ window, max }` objects) — centralizes tuning in one file.

## Rate Limit Catalog

### Tier 1 — Presigned URLs (20/min) — `RATE_LIMITS.presignedUrl`

R2 presigned URL generation — cost abuse prevention.

| Stub File | Function |
|-----------|----------|
| `files.ts` | `getPresignedUploadUrl` |
| `files.ts` | `getPresignedDownloadUrl` |
| `files.ts` | `getPresignedReviewFeedbackUploadUrl` |
| `settings.ts` | `getPresignedAvatarUploadUrl` |

### Tier 2 — Heavy Mutations (10/min) — `RATE_LIMITS.heavyMutation`

Write operations that create/update core academic records.

| Stub File | Function |
|-----------|----------|
| `submissions.ts` | `submitCheckpoint` |
| `reviews.ts` | `submitReview` |
| `reviews.ts` | `openForReview` |

### Tier 3 — Destructive / Bulk / Email-Triggering (5/min) — `RATE_LIMITS.destructive`

Destructive operations, bulk imports, and mutations that trigger email notifications.

| Stub File | Function |
|-----------|----------|
| `assignments.ts` | `createAssignment`, `reassignAssignment`, `extendDeadline`, `unlockCheckpoint` |
| `templates.ts` | `createTemplate`, `updateTemplate`, `deleteTemplate`, `duplicateTemplate` |
| `users.ts` | `createUser`, `updateUser`, `deleteUser`, `generateSetupLink` |
| `bulk-import.ts` | `bulkCreateUsers`, `bulkCreateTemplates` |
| `gradebook.ts` | `saveGradeConfig`, `recomputeAllGrades` |
| `rubrics.ts` | `saveRubric`, `softDeleteCriterion`, `softDeleteLevel` |
| `consultations.ts` | `logConsultation`, `verifyConsultation`, `rejectConsultation` |
| `extensions.ts` | `requestExtension`, `approveExtension`, `rejectExtension`, `bulkExtend` |
| `discussions.ts` | `postDiscussionMessage`, `deleteOwnMessage` |
| `email-queue.ts` | `retryEmail` |
| `r2-cleanup.ts` | `triggerR2Cleanup` |
| `two-factor.ts` | `generateTwoFactorSetup`, `enableTwoFactor`, `disableTwoFactor`, `regenerateBackupCodes` |
| `settings.ts` | `updateProfile`, `updateUserSettings` |
| `sessions.ts` | `revokeSession`, `revokeAllOtherSessions` |
| `notifications.ts` | `createNotification` |

### Tier 4 — Standard Reads (60/min) — `RATE_LIMITS.standardRead`

List, dashboard, detail, and export queries.

| Stub File | Function |
|-----------|----------|
| `assignments.ts` | `listInstructorAssignments`, `getAssignmentDetail`, `listStudentAssignments`, `getStudentAssignmentDetail` |
| `dashboard.ts` | `getStudentDashboardData`, `getInstructorDashboardData`, `getAdminDashboardData` |
| `analytics.ts` | `getAdminAnalyticsData`, `getInstructorAnalyticsData`, `getInstructorRubricAnalytics`, `getAdminRubricAnalytics` |
| `analytics.ts` | `exportUsersCsv`, `exportAuditLogCsv`, `exportAssignmentProgressCsv`, `exportStudentProgressCsv`, `exportReviewHistoryCsv`, `exportRubricScoresCsv`, `exportGradebookCsv` |
| `reviews.ts` | `listPendingReviews`, `getReviewDetail`, `getLatestReview` |
| `consultations.ts` | `listConsultations`, `listPendingConsultations`, `getConsultationDetail`, `listVerifiedCounts` |
| `extensions.ts` | `listExtensionRequests`, `listMyExtensionRequests` |
| `submissions.ts` | `listSubmissions`, `getSubmissionDetail` |
| `discussions.ts` | `listDiscussionMessages` |
| `templates.ts` | `listTemplates`, `getTemplate`, `listTemplateAssignments` |
| `users.ts` | `listUsers`, `getUser`, `listInstructorActiveAssignments` |
| `audit-log.ts` | `listAuditLogs`, `getAuditLogDetail` |
| `email-queue.ts` | `listEmailQueue` |
| `gradebook.ts` | `getStudentFinalGrade`, `getAssignmentGradebook` |
| `rubrics.ts` | `getRubric`, `countPendingReviews` |
| `sessions.ts` | `listActiveSessions` |
| `instructor-assignments-filter.ts` | `listInstructorAssignmentsForFilter` |
| `settings.ts` | `getCurrentUser` |
| `two-factor.ts` | `getTwoFactorStatus` |

### Exempt — No rateLimit config (pass-through)

| Stub File | Function | Reason |
|-----------|----------|--------|
| `auth.ts` | `_getSession` | Internal — called on every request via `getSessionFromHeaders()`. Rate limiting here would cascade to ALL functions (including the rate limit middleware itself, causing infinite loops). |
| `notifications.ts` | `getUnreadCount` | 30s polling UX — rate limiting would break the polling pattern. Low-cost (cached count query). |
| `notifications.ts` | `markRead`, `markAllRead` | High-frequency notification UX — marking as read is not an abuse vector. Low-cost (single UPDATE). |
| `setup-password.ts` | `completePasswordSetup` | Token-based — protected by atomic `DELETE ... RETURNING` (concurrent attempts race on the token row). No session → pass-through anyway. |

## Non-Functional Requirements

### NFR-1: No behavioral change to existing handlers

Rate limiting is enforced at the middleware level (pre-handler). No handler code changes are required. When the rate limit is not exceeded, the request proceeds identically to current behavior. The only new behavior is short-circuiting when the limit is exceeded.

### NFR-2: Zero handler changes for annotation

Adding `rateLimit` config to a stub is a one-line change in the `typedServerFn(...)` call — the handler file (`*.server.ts`) is not touched. This keeps the diff minimal and reviewable.

### NFR-3: Per-user, per-function isolation

The rate limit counter is keyed by `userId + ':' + fnId`. One user's rate limit does not affect another user's. One function's rate limit does not affect another function's (even if they share the same preset — each `typedServerFn` call generates a unique `fnId`).

### NFR-4: Unauthenticated pass-through

Server functions called without a session (unauthenticated) pass through the rate limit middleware without enforcement. This is by design — rate limiting requires a userId for per-user isolation. Unauthenticated functions are either token-protected (`completePasswordSetup`) or public (`/api/health`, which is not a server function).

### NFR-5: Single-instance sufficiency (v1)

The in-memory `Map` store is sufficient for the single-instance Coolify deployment. Multi-instance deployments (horizontal scaling) would require a Redis-backed implementation — explicitly out of scope for v1.

### NFR-6: File limit compliance

- `src/lib/rate-limiter.ts` — new file, estimated ~60-80 lines (well under 500).
- `src/lib/server-fn.ts` — current 58 lines, estimated +15 lines for `.middleware()` interface + `rateLimit` config logic (~73 lines, well under 500).
- `src/lib/errors.ts` — current 127 lines, +1 line for `RATE_LIMITED` (~128 lines, well under 500).

### NFR-7: Test coverage

All new code must meet >=80% coverage on lines, statements, branches, and functions. The rate limiter module must have comprehensive unit tests (window expiry, per-user isolation, per-function isolation, short-circuit, unauthenticated pass-through).

## Acceptance Criteria

1. **AC-1:** `RATE_LIMITED` is added to the `ErrorCode` enum in `src/lib/errors.ts`.
2. **AC-2:** `src/lib/rate-limiter.ts` exists with `RateLimitConfig` type, `RATE_LIMITS` presets, `checkRateLimit` function, and `createRateLimitMiddleware` factory.
3. **AC-3:** `checkRateLimit` correctly implements sliding window logic: allows up to `max` requests per `window` seconds, resets after window expiry, does not increment when denied.
4. **AC-4:** `createRateLimitMiddleware` calls `getSessionFromHeaders()`, passes through when no session, checks rate limit when session exists, short-circuits with `serverError(ErrorCode.RATE_LIMITED, 'Rate limit exceeded')` when exceeded.
5. **AC-5:** Each `createRateLimitMiddleware` call generates a unique `fnId` (per-function isolation).
6. **AC-6:** `TypedBuilder` interface in `src/lib/server-fn.ts` includes a `.middleware()` method.
7. **AC-7:** `typedServerFn` accepts optional `rateLimit` config and chains `createRateLimitMiddleware(opts.rateLimit)` when provided.
8. **AC-8:** All functions in the Rate Limit Catalog are annotated with the correct `RATE_LIMITS` preset.
9. **AC-9:** Exempt functions have no `rateLimit` config (pass-through).
10. **AC-10:** Unit tests in `tests/unit/lib/rate-limiter.test.ts` cover: window expiry, per-user isolation, per-function isolation, short-circuit returns `ServerError` with `RATE_LIMITED` code, unauthenticated pass-through.
11. **AC-11:** `tests/unit/lib/server-fn.test.ts` updated for `.middleware()` chain + `rateLimit` config.
12. **AC-12:** `pnpm typecheck` passes.
13. **AC-13:** `pnpm lint` passes.
14. **AC-14:** `pnpm test` passes (all existing tests + new tests).
15. **AC-15:** `pnpm test:coverage` meets >=80% thresholds on all four metrics.
16. **AC-16:** Rate limit catalog documented in `conductor/tech-stack.md`.

## Out of Scope

- **Redis-backed rate limiting:** Multi-instance deployments require a shared store. In-memory `Map` is sufficient for single-instance Coolify. Redis implementation deferred to a future track.
- **Client-side rate limit feedback (UI):** No toast/banner showing "rate limited" — the existing `isServerError(result)` check + `showErrorToast` pattern handles this generically. No dedicated UI for rate limit errors.
- **Rate limit bypass for admins/superadmins:** All authenticated users are subject to the same limits. Admin-specific bypass is not implemented (admins are trusted but still subject to accidental loops).
- **Dynamic rate limit configuration (env vars):** Limits are hardcoded in `RATE_LIMITS` presets. No `RATE_LIMIT_PRESETS_*` env vars. Tuning requires a code change — acceptable for v1.
- **HTTP 429 status code:** TanStack Start server functions return HTTP 200 with JSON `{ error: { code, message } }`. There is no mechanism to return a raw HTTP 429. The `RATE_LIMITED` error code is the semantic equivalent.
- **Rate limiting on `/api/health`:** The health endpoint is a `createFileRoute` handler, not a `typedServerFn` — it's public and simple (`SELECT 1`). Not in scope.
- **TRACK-044 (Request ID Middleware Wiring):** Both tracks extend `typedServerFn` with `.middleware()` chaining. TRACK-043 adds the `.middleware()` method to `TypedBuilder` (shared infrastructure). TRACK-044 wires `requestIdMiddleware` via the same mechanism. If parallelized, TRACK-044 should precede TRACK-043.
</protect>
