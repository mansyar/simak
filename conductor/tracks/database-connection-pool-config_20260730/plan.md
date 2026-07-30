<protect>
# Implementation Plan: TRACK-042 — Database Connection Pool Configuration

## Phase 1: Environment Variable Configuration

- [x] Task: Read `spec.md` and `conductor/workflow.md` to refresh context before implementation
- [x] Task: Write tests for new env vars (TDD Red Phase) `0a6879b`
    - [x] Add test in `tests/unit/config/env.test.ts`: `DB_POOL_MAX` defaults to `10` when unset
    - [x] Add test: `DB_POOL_MAX='20'` coerces to number `20`
    - [x] Add test: `DB_POOL_MAX='0'` is rejected (must be positive)
    - [x] Add test: `DB_POOL_MAX='-5'` is rejected (must be positive)
    - [x] Add test: `DB_POOL_MAX='abc'` is rejected (must be a number)
    - [x] Add test: `DB_PREPARED_STATEMENTS_DISABLED` defaults to `false` when unset
    - [x] Add test: `DB_PREPARED_STATEMENTS_DISABLED='true'` parses to boolean `true`
    - [x] Add test: `DB_PREPARED_STATEMENTS_DISABLED='false'` parses to boolean `false` (CRITICAL — `z.coerce.boolean()` would incorrectly return `true` for the string `'false'`; must use a custom transform/preprocess that checks `val === 'true'`)
    - [x] Run `pnpm test` and confirm all new tests fail (env vars not yet in schema)
    - [x] Also updated `tests/unit/lib/logger.test.ts` mockEnv to include new Env properties (DB_POOL_MAX, DB_PREPARED_STATEMENTS_DISABLED) — required by TypeScript after schema change
- [x] Task: Implement new env vars in `src/config/env.ts` (TDD Green Phase) `0a6879b`
    - [x] Add `DB_POOL_MAX: z.coerce.number().int().positive().default(10)` to `envSchema`
    - [x] Add `DB_PREPARED_STATEMENTS_DISABLED` with custom string-to-boolean transform (NOT `z.coerce.boolean()` — use `z.preprocess` or `.transform` that maps `'true'`->`true`, everything else->`false`, default `false`)
    - [x] Run `pnpm test` and confirm all new env tests pass
- [x] Task: Update `.env.example` with new env vars `0a6879b`
    - [x] Add `DB_POOL_MAX=10` with comment explaining pool sizing + PgBouncer notes
    - [x] Add `DB_PREPARED_STATEMENTS_DISABLED=false` with comment explaining PgBouncer transaction pooling compatibility
- [x] Task: Conductor - User Manual Verification 'Phase 1: Environment Variable Configuration' (Protocol in workflow.md) — Checkpoint: `4cc1ca1`

## Phase 2: Database Pool Configuration

- [x] Task: Read `spec.md` and `conductor/workflow.md` to refresh context before implementation
- [x] Task: Write tests for `getDb()` pool configuration (TDD Red Phase) `f21e0756`
    - [x] Add tests in new `tests/unit/db/pool-config.test.ts`: mock `postgres` and `drizzle-orm/postgres-js` to capture constructor arguments
    - [x] Test: `getDb()` calls `postgres()` with `max` equal to `env.DB_POOL_MAX` (default 10)
    - [x] Test: `postgres()` called with `idle_timeout: 30`
    - [x] Test: `postgres()` called with `connect_timeout: 10`
    - [x] Test: `postgres()` called with `max_lifetime: 1800` (60 * 30)
    - [x] Test: `postgres()` called with `prepare: true` when `DB_PREPARED_STATEMENTS_DISABLED` is unset/false
    - [x] Test: `postgres()` called with `prepare: false` when `DB_PREPARED_STATEMENTS_DISABLED='true'` (PgBouncer compatibility)
    - [x] ~~Test: `drizzle()` called with matching `prepare` option~~ — REMOVED: drizzle-orm 0.45.2 DrizzleConfig type does not support `prepare`
    - [x] Test: `postgres()` called with `onnotice` callback function
    - [x] Test: `getDb()` singleton invariant preserved (returns cached instance on repeated calls)
    - [x] Run `pnpm test` and confirm new tests fail (pool config not yet implemented) — 11 failed, 1 passed (singleton)
- [x] Task: Implement pool configuration in `src/db/index.ts` (TDD Green Phase) `f21e0756`
    - [x] Import `getEnv` from `@/config/env` and `logger` from `@/lib/logger`
    - [x] Replace `process.env.DATABASE_URL` with `getEnv().DATABASE_URL` in `getDb()`
    - [x] Remove manual `if (!databaseUrl) throw new Error(...)` guard (getEnv handles validation)
    - [x] Add pool config options to `postgres()` call: `max`, `idle_timeout`, `connect_timeout`, `max_lifetime`, `prepare`, `onnotice`
    - [x] Add `onnotice: (notice) => logger.debug({ event: 'pg_notice', ...notice })` callback
    - [x] ~~Add `prepare: !env.DB_PREPARED_STATEMENTS_DISABLED` to `drizzle()` call~~ — DEVIATION from FR-3: drizzle-orm 0.45.2 DrizzleConfig type does not include `prepare`. The `prepare` on postgres.js client (FR-2) is sufficient.
    - [x] Run `pnpm test` and confirm all pool config tests pass (10 tests pass)
- [x] Task: Update existing `tests/unit/db/client.test.ts` for `getEnv()` migration `f21e0756`
    - [x] The test currently sets only `process.env.DATABASE_URL` (line 4) — after migration to `getEnv()`, ALL required env vars must be set (getEnv validates the full schema)
    - [x] Add all required env vars (`RESEND_API_KEY`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`) to the test setup
    - [x] Verify singleton and CRUD method tests still pass with the new env setup
    - [x] Also fixed `tests/unit/db/seed.test.ts` — added `vi.mock('@/lib/logger', ...)` to prevent getEnv() call at module load
    - [x] Also fixed 3 email template test files (`email-templates.test.ts`, `email-templates-at-risk.test.ts`, `email-templates-discussion-reply.test.ts`) — added `LOG_LEVEL: 'info'` to mock getEnv()
- [~] Task: Conductor - User Manual Verification 'Phase 2: Database Pool Configuration' (Protocol in workflow.md)

## Phase 3: Documentation & Final Verification

- [ ] Task: Read `spec.md` and `conductor/workflow.md` to refresh context before implementation
- [ ] Task: Update `conductor/tech-stack.md` with DB pool configuration changelog entry
    - [ ] Add dated note (2026-07-30) documenting: explicit pool config on postgres.js (`max`, `idle_timeout`, `connect_timeout`, `max_lifetime`, `prepare`), matching `prepare` on Drizzle, `onnotice` routing through pino, new env vars `DB_POOL_MAX` + `DB_PREPARED_STATEMENTS_DISABLED`, pool sizing guidance (default 10 for single-instance Coolify), PgBouncer transaction pooling notes (`DB_PREPARED_STATEMENTS_DISABLED=true`)
- [ ] Task: Run full quality gate suite
    - [ ] Run `pnpm test:coverage` — verify >=80% on lines, statements, branches, functions
    - [ ] Run `pnpm typecheck` — verify clean
    - [ ] Run `pnpm lint` — verify clean (0 errors)
    - [ ] Run `pnpm check:i18n` — verify EN<->ID parity (no new i18n keys needed for this track, but verify no breakage)
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Documentation & Final Verification' (Protocol in workflow.md)
</protect>
