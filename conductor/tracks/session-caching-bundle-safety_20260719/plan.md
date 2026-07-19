# Implementation Plan: Session Caching & Bundle Safety

**Track ID:** session-caching-bundle-safety_20260719
**Spec:** [./spec.md](./spec.md)
**Workflow:** `conductor/workflow.md` (TDD: Red → Green → Refactor → Verify → Commit → Git Note)

Each task below follows the Standard Task Workflow (workflow.md §"Standard Task Workflow"): mark `[~]`, write failing tests (Red), implement (Green), verify quality gates, commit, attach git note, mark `[x]` with commit SHA.

---

## Phase 1: auth.ts Two-File Split (PERF-34)

**Goal:** Move the session-resolution handler into `auth.server.ts` and rewrite `auth.ts` as a client-safe stub. No cache yet — pure structural split preserving current behavior.

- [ ] Task: Write failing tests for the auth split (Red)
    - [ ] Update `tests/unit/server/auth.test.ts` (create if absent) to test `getSessionHandler` directly: returns correct `Session` shape, handles null session, soft-deleted user returns null, role/locale fallback from DB
    - [ ] Add a test asserting `src/server/auth.ts` does not import forbidden modules (`drizzle-orm`, `../db/index`, `../db/schema/*`, `../auth/config`, `getRequestHeaders`) — file-content assertion
    - [ ] Add a test asserting `auth.ts` `_getSession` stub delegates to `auth.server.ts` via dynamic import (mock `./auth.server` and assert `getSessionHandler` is called)
    - [ ] Run `pnpm test` and confirm the new tests fail (Red)
- [ ] Task: Create `src/server/auth.server.ts` with `getSessionHandler` (Green)
    - [ ] Move the handler logic from `auth.ts` `_getSession` into `getSessionHandler` in `auth.server.ts` — verbatim: `getRequestHeaders`, `auth.api.getSession`, `getDb`, `users` schema query, soft-delete check (`deletedAt IS NULL`), role/locale fallback
    - [ ] No cache yet — pure move, behavior identical
    - [ ] Run `pnpm test` — handler tests pass (Green)
- [ ] Task: Rewrite `src/server/auth.ts` as client-safe stub
    - [ ] Keep `Session` type, `getSessionFromHeaders`, `requireRole` exports (unchanged signatures)
    - [ ] Rewrite `_getSession` as `createServerFn({ method: 'GET' }).handler(async () => { const { getSessionHandler } = await import('./auth.server'); return getSessionHandler(); })`
    - [ ] Remove all DB/schema/Better-Auth imports from `auth.ts` (`drizzle-orm`, `getDb`, `users`, `auth config`, `getRequestHeaders`)
    - [ ] Run `pnpm typecheck` — all 6 route layouts compile unchanged (no route file edits)
    - [ ] Run `pnpm test` — all tests pass
- [ ] Task: Conductor - User Manual Verification 'Phase 1: auth.ts Two-File Split' (Protocol in workflow.md)

---

## Phase 2: Session Cache (PERF-22)

**Goal:** Add a 5s-TTL in-memory cache for `{ role, locale }` lookups in `getSessionHandler`, eliminating the redundant DB query across server-function calls within a page load.

- [ ] Task: Write failing tests for the session cache (Red)
    - [ ] Test: cache miss — first call for a user invokes `getDb` and caches the result
    - [ ] Test: cache hit — second call within the 5s TTL does NOT invoke `getDb` (assert mock not called)
    - [ ] Test: TTL expiry — after advancing time 5001ms via `vi.useFakeTimers()`, a subsequent call re-queries the DB
    - [ ] Test: concurrent — two near-simultaneous calls for the same user within the TTL: first misses (queries DB), second hits cache
    - [ ] Test: lazy eviction — after TTL expiry, a cache miss for user B evicts the expired entry for user A
    - [ ] Run `pnpm test` and confirm cache tests fail (Red)
- [ ] Task: Implement the session cache in `auth.server.ts` (Green)
    - [ ] Add module-level `Map<string, { role: UserRole; locale: string; expiresAt: number }>` (TTL = 5000ms)
    - [ ] In `getSessionHandler`, after `auth.api.getSession()` returns a valid user ID, check the cache BEFORE the DB query
    - [ ] On hit (`Date.now() < expiresAt`): skip DB query, use cached `role`/`locale`
    - [ ] On miss: run existing DB query, store result with `expiresAt = Date.now() + 5000`, evict any expired entries encountered during lookup (lazy eviction)
    - [ ] Preserve the Better Auth call on every request (cache sits between `auth.api.getSession()` and the DB query — never cache session-token validation)
    - [ ] Run `pnpm test` — cache tests pass (Green)
    - [ ] Run `pnpm test:coverage` — verify `auth.server.ts` ≥80% on all four metrics
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Session Cache' (Protocol in workflow.md)

---

## Phase 3: Bundle Verification & Final Quality Gates

**Goal:** Prove the split prevents server-only modules from leaking into the client bundle, and confirm all quality gates pass before archive.

- [ ] Task: Verify bundle safety (PERF-34)
    - [ ] Run `pnpm build` (i18n codegen → vite build → esbuild bundles)
    - [ ] Grep built client chunks in `.output/` for `from 'pg'`, `from 'drizzle-orm'`, and `postgres` — assert zero matches
    - [ ] (Ad-hoc, optional) Run `npx vite-bundle-visualizer` for visual before/after confirmation — document findings in the phase checkpoint git note (no `package.json` change; `rollup-plugin-visualizer@7.0.1` is already a transitive dep)
- [ ] Task: Run full quality gate suite
    - [ ] `pnpm typecheck` passes (`tsc --noEmit --incremental`)
    - [ ] `pnpm lint` passes (`oxlint .`, including `simak-i18n/no-hardcoded`)
    - [ ] `pnpm check:i18n` passes (EN↔ID parity; no new unused keys — this track adds no i18n keys)
    - [ ] `pnpm test:coverage` ≥80% on lines, statements, branches, and functions
    - [ ] Verify no file in `src/`/`tests/` exceeds 500 lines (`scripts/check-modularity.js` on `auth.ts` + `auth.server.ts`)
    - [ ] Grep `src/server/auth.ts` for forbidden imports (`drizzle-orm`, `getDb`, `users`, `getRequestHeaders`, `auth config`) — assert zero matches (AC-1)
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Bundle Verification & Final Quality Gates' (Protocol in workflow.md)
