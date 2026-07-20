<protect>
# Track: Session Caching & Bundle Safety

- **Track ID:** session-caching-bundle-safety_20260719
- **Type:** refactor (performance optimization + file split)
- **Status:** INIT
- **Audit IDs:** PERF-22, PERF-34 (PERF-37 explicitly deferred)
- **Roadmap Reference:** `docs/roadmap.md` → TRACK-007
- **Estimated Effort:** 2 Days / 1 Sprint Loop
- **Dependencies:** None

## Overview / Problem Statement

Two performance and bundle-safety issues exist in the current authentication/session resolution path:

1. **PERF-22 (Redundant DB query per request):** `src/server/auth.ts` `_getSession` calls `auth.api.getSession()` (Better Auth) to validate the session cookie, then **also** runs a DB query (`SELECT role, locale FROM users WHERE id = ? AND deletedAt IS NULL`) on every server-function invocation. A single page load triggers 4-6 server function calls, each re-querying the same user's `role`/`locale`. This is the cross-request redundancy problem (not a within-request problem — AsyncLocalStorage would not help here).

2. **PERF-34 (Bundle leak risk):** `src/server/auth.ts` is a single 88-line file that imports `drizzle-orm`, `getDb`, the `users` schema, and Better Auth's `auth` config. Six route layout files import `getSessionFromHeaders` / `requireRole` from it. Because the handler code lives in the same file as the client-safe stubs, server-only modules (`pg`, `drizzle-orm`, the DB schema) can leak into the client bundle. The project's mandated two-file split pattern (see `AGENTS.md` → "Server function split") is not followed for `auth.ts`.

## Context Anchors (Traceability)

- **PRD Reference:** `docs/PRD.md` (session management, authentication, server function architecture)
- **TDD Reference:** `docs/TDD.md` (server function architecture, bundle splitting)
- **Current implementation:** `src/server/auth.ts` (88 lines — single file, handler + stubs co-located)
- **Gold-standard stub pattern:** `src/server/submissions.ts` (canonical `createServerFn({ method }).handler(async (args) => { const { fn } = await import('./feature.server'); ... })`)
- **Consumers (6 route layouts, import paths unchanged):**
  - `src/routes/_authenticated.tsx` → `getSessionFromHeaders`
  - `src/routes/_unauthenticated.tsx` → `getSessionFromHeaders`
  - `src/routes/_authenticated/admin.tsx` → `requireRole`
  - `src/routes/_authenticated/student.tsx` → `requireRole`
  - `src/routes/_authenticated/instructor.tsx` → `requireRole`
  - `src/routes/_authenticated/admin/users/import.tsx` → `getSessionFromHeaders`

## Functional Requirements (FR)

### FR-1: Split `auth.ts` into the two-file pattern (PERF-34)

1. **`src/server/auth.ts`** (client-safe stub — no DB/schema/Better-Auth imports):
   - Exports the `Session` type.
   - Exports `getSessionFromHeaders()` and `requireRole(roles)` (unchanged signatures).
   - Exports `_getSession` as a `createServerFn({ method: 'GET' })` stub whose handler dynamically imports the handler from `auth.server.ts`: `const { getSessionHandler } = await import('./auth.server'); return getSessionHandler();`.
   - **Forbidden imports** (verified by grep in DoD): `drizzle-orm`, `../db/index`, `../db/schema/*`, `../auth/config`, `getRequestHeaders` from `@tanstack/react-start/server`.
2. **`src/server/auth.server.ts`** (handler — server-only, never client-bundled):
   - Exports `getSessionHandler()` containing: `getRequestHeaders`, `auth.api.getSession`, `getDb`, `users` schema, the DB query, and the session cache (FR-2).
   - The current soft-delete validation (`deletedAt IS NULL`) and role/locale fallback logic are preserved verbatim.
3. **Import paths unchanged:** All 6 route layout files continue to import from `@/server/auth` or `../../server/auth`. No route file edits required.

### FR-2: Session cache (PERF-22)

1. Add a **module-level** `Map<string, { role: UserRole; locale: string; expiresAt: number }>` inside `auth.server.ts`.
2. **Cache key:** `u.user.id` (the user ID returned by Better Auth's `auth.api.getSession()`).
3. **TTL:** 5000 ms (5 seconds), stored as `expiresAt = Date.now() + 5000`.
4. **Lookup flow** (inside `getSessionHandler`, after `auth.api.getSession()` returns a valid user):
   - If a cache entry exists AND `Date.now() < expiresAt` → **cache hit**: skip the DB query, use cached `role`/`locale`.
   - Else → **cache miss**: run the existing DB query (`SELECT role, locale FROM users WHERE id = ? AND deletedAt IS NULL`), store the result in the cache with a fresh `expiresAt`, and evict any expired entries encountered during the lookup (lazy eviction).
5. **No AsyncLocalStorage** — each server-function call is a separate HTTP request; ALS only helps within a single request (rare here).
6. **No Redis or external cache** — in-process `Map` only (SIMAK is a long-running Node server on a VPS, not serverless).
7. **Soft-delete check** is skipped on cache hit by design (the accepted tradeoff — see Decisions).

### FR-3: Bundle verification

1. Run `npx vite-bundle-visualizer` ad-hoc before and after the split to produce a visual bundle report. (No `package.json` change — `rollup-plugin-visualizer@7.0.1` is already present as a transitive dependency in `pnpm-lock.yaml`.)
2. Hard automated check: after `pnpm build`, grep the built client chunks in `.output/` for `from 'pg'`, `from 'drizzle-orm'`, and `postgres` — must return zero matches.
3. The before/after visual reports and the grep result are documented in the phase-3 checkpoint git note (not committed as repo artifacts).

## Non-Functional Requirements (NFR)

- **Performance:** A page load triggering N server-function calls for the same user issues **at most 1** DB query per 5s window (was N queries).
- **Bundle safety:** `auth.ts` must not transitively import `pg`, `drizzle-orm`, `postgres`, `better-auth`, or any `src/db/*` module. Verified by grep + bundle visualizer.
- **Backward compatibility:** `Session` type, `getSessionFromHeaders`, and `requireRole` signatures are unchanged. All 6 route layouts compile without modification.
- **File size:** Both `auth.ts` and `auth.server.ts` stay under 500 lines (`scripts/check-modularity.js`).
- **Test coverage:** ≥80% on lines, statements, branches, and functions.
- **TDD:** Failing tests written first for cache behavior (hit/miss/expiry/concurrent), then implementation.

## Decisions (Documented Tradeoffs)

1. **TTL-only invalidation (5s):** No proactive cache invalidation in `deleteUserHandler` or role-change handlers. Rationale: keeps the cache self-contained in `auth.server.ts` (surgical — no coupling to user-management code); 5s soft-delete propagation delay is explicitly acceptable for a university system per the roadmap. If security requirements tighten, proactive invalidation is a ~5-line follow-up.
2. **Accepted consistency regression:** Within the 5s TTL window, a soft-deleted user retains active-session access, and a role-changed user retains their old role. This is a deliberate, documented tradeoff for the performance gain.
3. **Unbounded Map (no LRU cap):** Entries auto-expire in 5s; steady-state size is bounded by "distinct users active in the last 5s" (itself bounded by total user count, university scale). Lazy eviction on cache miss is sufficient. An LRU cap would be speculative defense for a scale SIMAK won't hit — over-engineering per "Simplicity First."
4. **Better Auth call still runs every request:** The cache sits *between* `auth.api.getSession()` and the DB query. Session-cookie/token validation must always run (security-critical). Only the redundant DB role/locale lookup is cached.
5. **PERF-37 (template caching) — deferred:** Templates are small tables (dozens of rows), indexed after TRACK-005, queried infrequently. Defer until profiling shows a problem. Role permissions are already in-memory (`role-permissions.ts`) — no action.

## Acceptance Criteria

- [ ] **AC-1 (split):** `src/server/auth.ts` contains no imports of `drizzle-orm`, `../db/index`, `../db/schema/*`, `../auth/config`, or `getRequestHeaders`. Grep returns zero matches.
- [ ] **AC-2 (split):** `src/server/auth.server.ts` contains `getSessionHandler` with the Better Auth call, DB query, soft-delete check, and session cache.
- [ ] **AC-3 (consumers):** All 6 route layout files compile unchanged (`pnpm typecheck` passes with no edits to route files).
- [ ] **AC-4 (cache hit):** On cache hit, `getDb` is not called — verified by a unit test that mocks `getDb` and asserts it is not invoked on the second call within the TTL window.
- [ ] **AC-5 (cache miss):** On first call (or after TTL expiry), the DB query runs and the result is cached — verified by a unit test.
- [ ] **AC-6 (expiry):** After 5s (advanced via fake timers), a subsequent call re-queries the DB — verified by a unit test using `vi.useFakeTimers()`.
- [ ] **AC-7 (concurrent):** Two near-simultaneous calls for the same user within the TTL share the cache entry (second call hits cache) — verified by a unit test.
- [ ] **AC-8 (bundle):** `pnpm build` succeeds; grep of client chunks for `pg`/`drizzle-orm`/`postgres` returns zero matches.
- [ ] **AC-9 (quality gates):** `pnpm test:coverage` ≥80% all four metrics; `pnpm typecheck`, `pnpm lint`, `pnpm check:i18n` pass.
- [ ] **AC-10 (manual):** Soft-deleting a user invalidates their access within 5s; changing a user's role takes effect within 5s. Server logs show 1 DB lookup per 5s window per user during a dashboard page load (was 4-6).

## Out of Scope

- AsyncLocalStorage request-scoped context (doesn't address the cross-request redundancy use case).
- Template caching (PERF-37 — deferred until profiling shows a need).
- Redis or any external cache infrastructure.
- Proactive cache invalidation in `deleteUserHandler` / role-change handlers (TTL-only is sufficient — see Decisions).
- Client-side TanStack Query refetch tuning (deferred to a future UX track).
- Changes to the `Session` type shape or any route layout file.
- Query optimization / N+1 elimination (TRACK-006).
- Pagination of list handlers (TRACK-006).
</protect>
