# Track 8.1 — Session Lifecycle & Auth Hardening

## Overview

This track closes the critical deleted-user session bypass where soft-deleted users retain full access because `_getSession` does not filter on `deletedAt` and `deleteUserHandler` never revokes active sessions. It encompasses broader auth hardening: Better Auth rate limiting (currently absent, exposing login and password-setup endpoints to brute-force attacks), setup-token cleanup (stale tokens accumulate without invalidation), expired-session filtering in the active-sessions list, session enrichment with `role`/`locale` via Better Auth `additionalFields` (eliminating the per-request extra DB query), and strengthening `BETTER_AUTH_SECRET` validation from `.min(1)` to `.min(32)`.

A central `revokeUserSessions(userId)` helper is introduced and called from `deleteUserHandler`, password-reset, and 2FA-disable flows — closing the bypass and hardening the auth lifecycle in one place.

**Track Type:** Security hardening (chore)

**Dependencies:**
- V1.3 (Better Auth base auth with Drizzle adapter)
- Track 3.1 (2FA & Session Management — `session` table and `twoFactorEnabled` column)
- Track 1.1 (audit log — session revocation events logged)

## Audit Findings Addressed

| # | Severity | Finding | Location |
|---|----------|---------|----------|
| 1 | CRITICAL | Deleted-User Session Bypass | `src/server/auth.ts` `_getSession` + `src/server/users.server.ts` `deleteUserHandler` |
| 2 | HIGH | No Rate Limiting on Authentication | `src/auth/config.ts` |
| 3 | MEDIUM | Every Authenticated Request Triggers Extra DB Query | `src/server/auth.ts` `_getSession` |
| 4 | LOW | `generateSetupLink` Doesn't Invalidate Prior Tokens | `src/server/users.server.ts` `generateSetupLinkHandler` |
| 5 | LOW | `listActiveSessions` Returns Expired Sessions | `src/server/sessions.server.ts` `listActiveSessionsHandler` |

## Functional Requirements

### FR-1: Deleted-User Session Bypass (CRITICAL)

**FR-1.1:** `_getSession` in `src/server/auth.ts` must filter users by `deletedAt IS NULL` on lookup. A soft-deleted user's session must return `null`, treating them as logged out.

**FR-1.2:** A new `revokeUserSessions(userId: string): Promise<void>` helper must be created in `src/lib/auth-session.ts`. It deletes all rows from the `session` table for the given user.

**FR-1.3:** `deleteUserHandler` in `src/server/users.server.ts` must call `revokeUserSessions(userId)` before setting `deletedAt`, invalidating all active sessions atomically.

**FR-1.4:** The `revokeUserSessions` helper must be reused by password-reset and 2FA-disable flows (replacing any inline session-revocation logic).

### FR-2: Rate Limiting (HIGH)

**FR-2.1:** Better Auth's `rateLimit` plugin must be registered in `src/auth/config.ts` with a 60-second window and max 10 requests per window per IP. This applies globally to all Better Auth endpoints.

**FR-2.2:** `trustedOrigins` must be set to `[BETTER_AUTH_URL]` from the env config in `src/auth/config.ts`.

### FR-3: Session Enrichment (MEDIUM)

**FR-3.1:** `role` and `locale` must be wired into the Better Auth session payload via `additionalFields` in `src/auth/config.ts` so `auth.api.getSession` returns them directly.

**FR-3.2:** `getSessionFromHeaders` must use the enriched session data when `role` and `locale` are present in the session payload, eliminating the separate `SELECT role, locale FROM users` query.

**FR-3.3:** For existing sessions created before this change (which lack `role`/`locale` in the payload), `getSessionFromHeaders` must fall back to the DB query. This graceful degradation ensures existing sessions work until natural expiry; new sessions get the enriched payload. No forced re-login is required.

### FR-4: Setup-Token Cleanup (LOW)

**FR-4.1:** `generateSetupLinkHandler` in `src/server/users.server.ts` must delete existing verification tokens for the user's email before inserting a new one. This prevents stale token accumulation.

### FR-5: Expired Session Filtering (LOW)

**FR-5.1:** `listActiveSessionsHandler` in `src/server/sessions.server.ts` must filter out expired sessions by adding `expiresAt > now()` to the query.

### FR-6: Secret Validation Strengthening (LOW)

**FR-6.1:** `BETTER_AUTH_SECRET` validation in `src/config/env.ts` must enforce `.min(32)` (currently `.min(1)`). This ensures cryptographically sufficient secret length.

### FR-7: Audit Log Integration

**FR-7.1:** Session revocation events triggered by `revokeUserSessions` must be logged to the audit log with action `session.revoked`, recording the actor and affected user.

## Non-Functional Requirements

### NFR-1: Security
- No regression in existing auth flows (login, password setup, 2FA, session management)
- Rate limiting must not block legitimate single-user workflows (10 requests / 60s is sufficient for normal usage)
- The `revokeUserSessions` helper must be atomic — all sessions for a user are revoked or none

### NFR-2: Performance
- Session enrichment eliminates one DB query per authenticated request for new sessions (net reduction in DB load)
- Rate limiting adds negligible overhead (in-memory window tracking via Better Auth plugin)

### NFR-3: Backward Compatibility
- Existing sessions (pre-deployment) continue to function via the fallback DB query path
- No database schema changes required — uses existing `session`, `users`, and `verification` tables
- No migration needed

## Acceptance Criteria

- [ ] AC-1: Soft-deleted users (`deletedAt IS NOT NULL`) are rejected by `_getSession` — their session returns `null`
- [ ] AC-2: `deleteUserHandler` calls `revokeUserSessions(userId)` before setting `deletedAt`
- [ ] AC-3: `revokeUserSessions` helper exists in `src/lib/auth-session.ts` and is used by delete-user, password-reset, and 2FA-disable flows
- [ ] AC-4: Better Auth `rateLimit` plugin registered with 60-second window, max 10 requests per IP
- [ ] AC-5: `trustedOrigins` set to `[BETTER_AUTH_URL]` from env config
- [ ] AC-6: `BETTER_AUTH_SECRET` validation enforces `.min(32)` in `src/config/env.ts`
- [ ] AC-7: `generateSetupLinkHandler` deletes existing verification tokens before inserting a new one
- [ ] AC-8: `listActiveSessionsHandler` filters out expired sessions (`expiresAt > now()`)
- [ ] AC-9: `role` and `locale` returned by `auth.api.getSession` via `additionalFields` for new sessions
- [ ] AC-10: `getSessionFromHeaders` uses session payload when `role`/`locale` present; falls back to DB query for stale sessions
- [ ] AC-11: Session revocation events logged to audit log (`session.revoked` action)
- [ ] AC-12: i18n translations added for any new UI strings (e.g., rate-limit error messages)
- [ ] AC-13: All existing tests pass; no regression in auth, 2FA, or session management flows

## Out of Scope

- Database schema changes (none required — existing `session`, `users`, `verification` tables suffice)
- New UI pages or routes (all changes are server-side except potential rate-limit error messages)
- Track 8.2 (Email Pipeline Hardening) — separate track
- Track 8.3 (Transactional Integrity) — separate track; will reuse `revokeUserSessions` from this track
- Track 8.4 (Performance Refinements) — separate track
- Forced session invalidation on deployment (lazy enrichment approach chosen)
- Per-endpoint rate limiting customization (global 60s/10 chosen)

## Test Plan

| Area | Approach |
|------|----------|
| Deleted-user session bypass | Unit test — user with `deletedAt` set returns `null` from `_getSession` |
| Session revocation on delete | Unit test — `deleteUserHandler` calls `revokeUserSessions`; session table empty after |
| `revokeUserSessions` helper | Unit test — deletes all sessions for a user; leaves other users' sessions intact |
| Rate limiting | Unit test — 11th request within window is rejected with 429 |
| Token cleanup | Unit test — `generateSetupLinkHandler` deletes prior tokens; only one valid token exists |
| Expired session filtering | Unit test — `listActiveSessionsHandler` excludes sessions with `expiresAt < now()` |
| Session enrichment (new) | Unit test — `auth.api.getSession` returns `role` and `locale` without extra DB query |
| Session enrichment (stale) | Unit test — session without `role`/`locale` falls back to DB query |
| Secret length validation | Unit test — env config rejects `BETTER_AUTH_SECRET` shorter than 32 chars |
| Audit log integration | Unit test — `session.revoked` entry created on revocation |
| No regression | Full test suite passes (auth, 2FA, session management, user management) |
