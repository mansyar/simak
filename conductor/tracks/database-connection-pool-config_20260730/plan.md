<protect>
# Implementation Plan: TRACK-042 — Database Connection Pool Configuration

## Phase 1: Environment Variable Configuration

- [ ] Task: Read `spec.md` and `conductor/workflow.md` to refresh context before implementation
- [ ] Task: Write tests for new env vars (TDD Red Phase)
    - [ ] Add test in `tests/unit/config/env.test.ts`: `DB_POOL_MAX` defaults to `10` when unset
    - [ ] Add test: `DB_POOL_MAX='20'` coerces to number `20`
    - [ ] Add test: `DB_POOL_MAX='0'` is rejected (must be positive)
    - [ ] Add test: `DB_POOL_MAX='-5'` is rejected (must be positive)
    - [ ] Add test: `DB_POOL_MAX='abc'` is rejected (must be a number)
    - [ ] Add test: `DB_PREPARED_STATEMENTS_DISABLED` defaults to `false` when unset
    - [ ] Add test: `DB_PREPARED_STATEMENTS_DISABLED='true'` parses to boolean `true`
    - [ ] Add test: `DB_PREPARED_STATEMENTS_DISABLED='false'` parses to boolean `false` (CRITICAL — `z.coerce.boolean()` would incorrectly return `true` for the string `'false'`; must use a custom transform/preprocess that checks `val === 'true'`)
    - [ ] Run `pnpm test` and confirm all new tests fail (env vars not yet in schema)
- [ ] Task: Implement new env vars in `src/config/env.ts` (TDD Green Phase)
    - [ ] Add `DB_POOL_MAX: z.coerce.number().int().positive().default(10)` to `envSchema`
    - [ ] Add `DB_PREPARED_STATEMENTS_DISABLED` with custom string-to-boolean transform (NOT `z.coerce.boolean()` — use `z.preprocess` or `.transform` that maps `'true'`->`true`, everything else->`false`, default `false`)
    - [ ] Run `pnpm test` and confirm all new env tests pass
- [ ] Task: Update `.env.example` with new env vars
    - [ ] Add `DB_POOL_MAX=10` with comment explaining pool sizing + PgBouncer notes
    - [ ] Add `DB_PREPARED_STATEMENTS_DISABLED=false` with comment explaining PgBouncer transaction pooling compatibility
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Environment Variable Configuration' (Protocol in workflow.md)

## Phase 2: Database Pool Configuration

- [ ] Task: Read `spec.md` and `conductor/workflow.md` to refresh context before implementation
- [ ] Task: Write tests for `getDb()` pool configuration (TDD Red Phase)
    - [ ] Add tests in `tests/unit/db/client.test.ts` (or new `tests/unit/db/pool-config.test.ts`): mock `postgres` and `drizzle-orm/postgres-js` to capture constructor arguments
    - [ ] Test: `getDb()` calls `postgres()` with `max` equal to `env.DB_POOL_MAX` (default 10)
    - [ ] Test: `postgres()` called with `idle_timeout: 30`
    - [ ] Test: `postgres()` called with `connect_timeout: 10`
    - [ ] Test: `postgres()` called with `max_lifetime: 1800` (60 * 30)
    - [ ] Test: `postgres()` called with `prepare: true` when `DB_PREPARED_STATEMENTS_DISABLED` is unset/false
    - [ ] Test: `postgres()` called with `prepare: false` when `DB_PREPARED_STATEMENTS_DISABLED='true'` (PgBouncer compatibility)
    - [ ] Test: `drizzle()` called with matching `prepare` option (same value as postgres.js client)
    - [ ] Test: `postgres()` called with `onnotice` callback function
    - [ ] Test: `getDb()` singleton invariant preserved (returns cached instance on repeated calls)
    - [ ] Run `pnpm test` and confirm new tests fail (pool config not yet implemented)
- [ ] Task: Implement pool configuration in `src/db/index.ts` (TDD Green Phase)
    - [ ] Import `getEnv` from `@/config/env` and `logger` from `@/lib/logger`
    - [ ] Replace `process.env.DATABASE_URL` with `getEnv().DATABASE_URL` in `getDb()`
    - [ ] Remove manual `if (!databaseUrl) throw new Error(...)` guard (getEnv handles validation)
    - [ ] Add pool config options to `postgres()` call: `max`, `idle_timeout`, `connect_timeout`, `max_lifetime`, `prepare`, `onnotice`
    - [ ] Add `onnotice: (notice) => logger.debug({ event: 'pg_notice', ...notice })` callback
    - [ ] Add `prepare: !env.DB_PREPARED_STATEMENTS_DISABLED` to `drizzle()` call
    - [ ] Run `pnpm test` and confirm all pool config tests pass
- [ ] Task: Update existing `tests/unit/db/client.test.ts` for `getEnv()` migration
    - [ ] The test currently sets only `process.env.DATABASE_URL` (line 4) — after migration to `getEnv()`, ALL required env vars must be set (getEnv validates the full schema)
    - [ ] Add all required env vars (`RESEND_API_KEY`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`) to the test setup
    - [ ] Verify singleton and CRUD method tests still pass with the new env setup
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Database Pool Configuration' (Protocol in workflow.md)

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
