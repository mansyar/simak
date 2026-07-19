<protect>
# Implementation Plan: Session Caching & Bundle Safety

**Track ID:** session-caching-bundle-safety_20260719
**Spec:** [./spec.md](./spec.md)
**Workflow:** `conductor/workflow.md` (TDD: Red → Green → Refactor → Verify → Commit → Git Note)

Each task below follows the Standard Task Workflow (workflow.md §"Standard Task Workflow"): mark `[~]`, write failing tests (Red), implement (Green), verify quality gates, commit, attach git note, mark `[x]` with commit SHA.

---

## Phase 1: auth.ts Two-File Split (PERF-34) [checkpoint: 4c8345a]

**Goal:** Move the session-resolution handler into `auth.server.ts` and rewrite `auth.ts` as a client-safe stub. No cache yet — pure structural split preserving current behavior.

- [x] Task: Read spec.md and workflow.md to re-establish context
    - [x] Read `./spec.md` (track specification — requirements, acceptance criteria, decisions)
    - [x] Read `../../workflow.md` (TDD lifecycle, commit format, phase checkpoint protocol)
- [x] Task: Write failing tests for the auth split (Red)
    - [x] Update `tests/unit/server/auth.test.ts` (create if absent) to test `getSessionHandler` directly: returns correct `Session` shape, handles null session, soft-deleted user returns null, role/locale fallback from DB
    - [x] Add a test asserting `src/server/auth.ts` does not import forbidden modules (`drizzle-orm`, `../db/index`, `../db/schema/*`, `../auth/config`, `getRequestHeaders`) — file-content assertion
    - [x] Add a test asserting `auth.ts` `_getSession` stub delegates to `auth.server.ts` via dynamic import (mock `./auth.server` and assert `getSessionHandler` is called)
    - [x] Run `pnpm test` and confirm the new tests fail (Red)
- [x] Task: Create `src/server/auth.server.ts` with `getSessionHandler` (Green)
    - [x] Move the handler logic from `auth.ts` `_getSession` into `getSessionHandler` in `auth.server.ts` — verbatim: `getRequestHeaders`, `auth.api.getSession`, `getDb`, `users` schema query, soft-delete check (`deletedAt IS NULL`), role/locale fallback
    - [x] No cache yet — pure move, behavior identical
    - [x] Run `pnpm test` — handler tests pass (Green)
- [x] Task: Rewrite `src/server/auth.ts` as client-safe stub [ef2e6b4]
    - [x] Keep `Session` type, `getSessionFromHeaders`, `requireRole` exports (unchanged signatures)
    - [x] Rewrite `_getSession` as `createServerFn({ method: 'GET' }).handler(async () => { const { getSessionHandler } = await import('./auth.server'); return getSessionHandler(); })`
    - [x] Remove all DB/schema/Better-Auth imports from `auth.ts` (`drizzle-orm`, `getDb`, `users`, `auth config`, `getRequestHeaders`)
    - [x] Run `pnpm typecheck` — all 6 route layouts compile unchanged (no route file edits)
    - [x] Run `pnpm test` — all tests pass
- [x] Task: Conductor - User Manual Verification 'Phase 1: auth.ts Two-File Split' (Protocol in workflow.md) [checkpoint: 4c8345a]

---

## Phase 2: Session Cache (PERF-22)

**Goal:** Add a 5s-TTL in-memory cache for `{ role, locale }` lookups in `getSessionHandler`, eliminating the redundant DB query across server-function calls within a page load.

- [x] Task: Read spec.md and workflow.md to re-establish context
    - [x] Read `./spec.md` (track specification — requirements, acceptance criteria, decisions)
    - [x] Read `../../workflow.md` (TDD lifecycle, commit format, phase checkpoint protocol)
- [x] Task: Write failing tests for the session cache (Red)
    - [x] Test: cache miss — first call for a user invokes `getDb` and caches the result
    - [x] Test: cache hit — second call within the 5s TTL does NOT invoke `getDb` (assert mock not called)
    - [x] Test: TTL expiry — after advancing time 5001ms via `vi.useFakeTimers()`, a subsequent call re-queries the DB
    - [x] Test: concurrent — two near-simultaneous calls for the same user within the TTL: first misses (queries DB), second hits cache
    - [x] Test: lazy eviction — after TTL expiry, a cache miss for user B evicts the expired entry for user A
    - [x] Run `pnpm test` and confirm cache tests fail (Red)
- [x] Task: Implement the session cache in `auth.server.ts` (Green) [30ccff5]
    - [x] Add module-level `Map<string, { role: UserRole; locale: string; expiresAt: number }>` (TTL = 5000ms)
    - [x] In `getSessionHandler`, after `auth.api.getSession()` returns a valid user ID, check the cache BEFORE the DB query
    - [x] On hit (`Date.now() < expiresAt`): skip DB query, use cached `role`/`locale`
    - [x] On miss: run existing DB query, store result with `expiresAt = Date.now() + 5000`, evict any expired entries encountered during lookup (lazy eviction)
    - [x] Preserve the Better Auth call on every request (cache sits between `auth.api.getSession()` and the DB query — never cache session-token validation)
    - [x] Run `pnpm test` — cache tests pass (Green)
    - [x] Run `pnpm test:coverage` — verify `auth.server.ts` ≥80% on all four metrics (100% achieved)
- [~] Task: Conductor - User Manual Verification 'Phase 2: Session Cache' (Protocol in workflow.md)

---

## Phase 3: Bundle Verification & Final Quality Gates

**Goal:** Prove the split prevents server-only modules from leaking into the client bundle, and confirm all quality gates pass before archive.

- [ ] Task: Read spec.md and workflow.md to re-establish context
    - [ ] Read `./spec.md` (track specification — requirements, acceptance criteria, decisions)
    - [ ] Read `../../workflow.md` (TDD lifecycle, commit format, phase checkpoint protocol)
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
</protect>
