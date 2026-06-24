# Implementation Plan — Track 8.1: Session Lifecycle & Auth Hardening

## Phase 1: Foundation — revokeUserSessions Helper & Secret Validation [checkpoint: 815bc59]

- [x] Task: Create `revokeUserSessions` helper in `src/lib/auth-session.ts` `7b421c7`
    - [x] Write tests: `tests/unit/lib/auth-session.test.ts` — helper deletes all sessions for a user; leaves other users' sessions intact; handles user with no sessions gracefully
    - [x] Implement: `export async function revokeUserSessions(userId: string): Promise<void>` — deletes all rows from `session` table for given userId
    - [x] Verify: tests pass, coverage >80% for new file
    - [x] Commit: `feat(auth): Add revokeUserSessions helper for centralized session revocation`

- [x] Task: Strengthen `BETTER_AUTH_SECRET` validation in `src/config/env.ts` `c631496`
    - [x] Write tests: `tests/unit/config/env.test.ts` — env config rejects `BETTER_AUTH_SECRET` shorter than 32 chars; accepts 32+ chars
    - [x] Implement: Change `.min(1)` to `.min(32)` on `BETTER_AUTH_SECRET` Zod schema
    - [x] Verify: tests pass, no existing env validation breaks
    - [x] Commit: `fix(auth): Enforce minimum 32-char length on BETTER_AUTH_SECRET`

- [ ] Task: Conductor - User Manual Verification 'Phase 1: Foundation' (Protocol in workflow.md)

## Phase 2: CRITICAL — Deleted-User Session Bypass & Session Revocation Wiring

- [ ] Task: Filter `deletedAt IS NULL` in `_getSession` (`src/server/auth.ts`)
    - [ ] Write tests: `tests/unit/server/auth.test.ts` — user with `deletedAt` set returns `null` from `_getSession`; active user (deletedAt null) returns valid session
    - [ ] Implement: Add `deletedAt IS NULL` condition to user lookup query in `_getSession`
    - [ ] Verify: tests pass, existing auth tests still pass
    - [ ] Commit: `fix(auth): Reject sessions for soft-deleted users in _getSession`

- [ ] Task: Wire `revokeUserSessions` + audit log into `deleteUserHandler` (`src/server/users.server.ts`)
    - [ ] Write tests: `tests/unit/server/users.test.ts` — `deleteUserHandler` calls `revokeUserSessions` before setting `deletedAt`; `session.revoked` audit log entry created; all user sessions empty after delete
    - [ ] Implement: Import `revokeUserSessions`; call it before soft-delete; call `logAuditEvent` with `session.revoked` action
    - [ ] Verify: tests pass, existing delete-user tests still pass
    - [ ] Commit: `fix(auth): Revoke sessions on user deletion and log to audit`

- [ ] Task: Wire `revokeUserSessions` + audit log into password-reset flow
    - [ ] Write tests: `tests/unit/server/auth.test.ts` — password-reset handler calls `revokeUserSessions`; `session.revoked` audit entry created
    - [ ] Implement: Import `revokeUserSessions`; call after password reset; call `logAuditEvent` with `session.revoked`
    - [ ] Verify: tests pass, existing password-reset tests still pass
    - [ ] Commit: `fix(auth): Revoke sessions on password reset and log to audit`

- [ ] Task: Wire `revokeUserSessions` + audit log into 2FA-disable flow
    - [ ] Write tests: `tests/unit/server/two-factor.test.ts` — 2FA-disable handler calls `revokeUserSessions`; `session.revoked` audit entry created
    - [ ] Implement: Import `revokeUserSessions`; call after 2FA disable; call `logAuditEvent` with `session.revoked`
    - [ ] Verify: tests pass, existing 2FA tests still pass
    - [ ] Commit: `fix(auth): Revoke sessions on 2FA disable and log to audit`

- [ ] Task: Conductor - User Manual Verification 'Phase 2: Deleted-User Session Bypass' (Protocol in workflow.md)

## Phase 3: HIGH — Rate Limiting & trustedOrigins

- [ ] Task: Add Better Auth `rateLimit` plugin to `src/auth/config.ts`
    - [ ] Write tests: `tests/unit/auth/config.test.ts` — config includes `rateLimit` plugin with `{ window: 60, max: 10 }`; 11th request within window is rejected with 429 (mock Better Auth rate limit behavior)
    - [ ] Implement: Import `rateLimit` from `better-auth/plugins`; add to `plugins` array with `{ window: 60, max: 10 }`
    - [ ] Verify: tests pass, auth config loads without error
    - [ ] Commit: `feat(auth): Add global rate limiting (60s window, max 10 requests)`

- [ ] Task: Set `trustedOrigins` in Better Auth config
    - [ ] Write tests: `tests/unit/auth/config.test.ts` — config includes `trustedOrigins: [BETTER_AUTH_URL]` from env
    - [ ] Implement: Add `trustedOrigins: [getEnv().BETTER_AUTH_URL]` to betterAuth config
    - [ ] Verify: tests pass, config loads with valid env
    - [ ] Commit: `feat(auth): Set trustedOrigins from BETTER_AUTH_URL env var`

- [ ] Task: Conductor - User Manual Verification 'Phase 3: Rate Limiting' (Protocol in workflow.md)

## Phase 4: MEDIUM — Session Enrichment

- [ ] Task: Wire `role`/`locale` into Better Auth `additionalFields` session payload (`src/auth/config.ts`)
    - [ ] Write tests: `tests/unit/auth/config.test.ts` — `additionalFields` config maps `role` and `locale` to session; `auth.api.getSession` returns `role` and `locale` for new sessions
    - [ ] Implement: Update `additionalFields` config to include `role` and `locale` in session payload mapping
    - [ ] Verify: tests pass, new sessions include role/locale in payload
    - [ ] Commit: `feat(auth): Enrich session payload with role and locale via additionalFields`

- [ ] Task: Update `getSessionFromHeaders` with fallback logic (`src/server/auth.ts`)
    - [ ] Write tests: `tests/unit/server/auth.test.ts` — uses session payload `role`/`locale` when present (no DB query); falls back to DB query when `role`/`locale` missing from session (stale session)
    - [ ] Implement: Check session payload for `role`/`locale`; if present, use directly; if missing, fall back to existing DB query
    - [ ] Verify: tests pass, existing auth tests still pass (fallback path)
    - [ ] Commit: `perf(auth): Use enriched session payload with DB fallback for role/locale`

- [ ] Task: Conductor - User Manual Verification 'Phase 4: Session Enrichment' (Protocol in workflow.md)

## Phase 5: LOW — Token Cleanup & Expired Session Filtering

- [ ] Task: Add setup-token cleanup in `generateSetupLinkHandler` (`src/server/users.server.ts`)
    - [ ] Write tests: `tests/unit/server/users.test.ts` — `generateSetupLinkHandler` deletes existing verification tokens for email before insert; only one valid token exists after
    - [ ] Implement: Add `DELETE FROM verification WHERE identifier = email` before inserting new token
    - [ ] Verify: tests pass, existing setup-link tests still pass
    - [ ] Commit: `fix(auth): Invalidate prior setup tokens before generating new one`

- [ ] Task: Add expired session filtering in `listActiveSessionsHandler` (`src/server/sessions.server.ts`)
    - [ ] Write tests: `tests/unit/server/sessions.test.ts` — `listActiveSessionsHandler` excludes sessions with `expiresAt < now()`; includes sessions with `expiresAt > now()`
    - [ ] Implement: Add `.where(gt(session.expiresAt, new Date()))` to query
    - [ ] Verify: tests pass, existing sessions tests still pass
    - [ ] Commit: `fix(auth): Filter out expired sessions from active sessions list`

- [ ] Task: Conductor - User Manual Verification 'Phase 5: Low-Priority Fixes' (Protocol in workflow.md)

## Phase 6: i18n & Final Regression

- [ ] Task: Add i18n translations for rate-limit error messages
    - [ ] Write tests: `tests/unit/i18n/i18n.test.ts` — new keys exist in both `locales/en.json` and `locales/id.json`; run `pnpm check:i18n`
    - [ ] Implement: Add rate-limit error message keys to `locales/en.json` and `locales/id.json`; run `pnpm generate:i18n`
    - [ ] Verify: `pnpm check:i18n` passes, `pnpm generate:i18n` succeeds
    - [ ] Commit: `feat(i18n): Add translations for rate-limit error messages`

- [ ] Task: Full regression test suite + coverage verification
    - [ ] Run: `pnpm typecheck && pnpm lint && pnpm vitest run --coverage`
    - [ ] Verify: All tests pass, coverage thresholds met (80% lines/functions/branches/statements), no type errors, no lint errors
    - [ ] Fix: Address any regressions or coverage gaps
    - [ ] Commit: `test(auth): Verify full regression suite for auth hardening track`

- [ ] Task: Conductor - User Manual Verification 'Phase 6: i18n & Final Regression' (Protocol in workflow.md)
