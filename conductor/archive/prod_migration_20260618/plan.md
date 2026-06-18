<protect>
# Implementation Plan: Production Database Migration Infrastructure

## Phase 1: Environment Config — `MIGRATE_DATABASE_URL`

- [x] Task: Read spec.md to internalize requirements before starting this phase
- [x] Task: Write failing env tests (Red Phase)
  - [x] Add `MIGRATE_DATABASE_URL` to the valid-env test cases in `tests/unit/config/env.test.ts` (set to a valid URL string)
  - [x] Add a test case asserting `MIGRATE_DATABASE_URL` is optional (config valid when the var is absent)
  - [x] Add a test case asserting an invalid URL string for `MIGRATE_DATABASE_URL` is rejected by the Zod schema
  - [x] Run `CI=true pnpm test -- tests/unit/config/env.test.ts` and confirm the new tests fail (env schema does not yet recognize the key)
- [x] Task: Implement env schema + `.env.example` (Green Phase)
  - [x] Add `MIGRATE_DATABASE_URL: z.string().url().optional()` to the Zod schema in `src/config/env.ts`
  - [x] Add `# MIGRATE_DATABASE_URL=postgresql://user:pass@pg-host:5432/simak` (commented) to `.env.example`
  - [x] Run `CI=true pnpm test -- tests/unit/config/env.test.ts` and confirm all tests pass
- [x] Task: Update `docs/TDD.md` env table
  - [x] Add `MIGRATE_DATABASE_URL` row to the environment variables table (section ~line 825)
  - [x] Update the "Database Migrations [v1]" section (~line 834) to document: bundled `migrate.mjs` via Coolify pre-deploy, `MIGRATE_DATABASE_URL` bypasses PgBouncer, `pg_advisory_lock` serializes concurrent runs, `seed.mjs` chained after migrate
- [x] Task: Conductor - User Manual Verification 'Environment Config — MIGRATE_DATABASE_URL' (Protocol in workflow.md)

## Phase 2: Migration Runner — Advisory Lock + Connection Fallback

- [x] Task: Read spec.md to internalize requirements before starting this phase
- [x] Task: Write failing unit tests for `src/db/migrate.ts` (Red Phase)
  - [x] Create `tests/unit/db/migrate.test.ts`
  - [x] Mock `postgres` and `drizzle-orm/postgres-js` + `drizzle-orm/postgres-js/migrator` (follow the canonical mock pattern from `tests/unit/server/submissions.test.ts`)
  - [x] Test: the advisory lock id constant equals the project-unique value `789123`
  - [x] Test: `pg_advisory_lock` is executed before `migrate()` is called
  - [x] Test: `pg_advisory_unlock` is executed in the `finally` block even when `migrate()` throws
  - [x] Test: when `MIGRATE_DATABASE_URL` is set, the postgres client is constructed with that URL (not `DATABASE_URL`)
  - [x] Test: when `MIGRATE_DATABASE_URL` is unset and `DATABASE_URL` is set, the client uses `DATABASE_URL` (fallback)
  - [x] Test: when neither env var is set, the runner throws/logs a clear error and the process exits non-zero
  - [x] Run `CI=true pnpm test -- tests/unit/db/migrate.test.ts` and confirm the tests fail (current `migrate.ts` has no advisory lock and no `MIGRATE_DATABASE_URL` handling)
- [x] Task: Implement advisory lock + connection fallback in `src/db/migrate.ts` (Green Phase)
  - [x] Import `sql` from `drizzle-orm` and define `const ADVISORY_LOCK_ID = 789123`
  - [x] Resolve connection string as `process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL`; throw a clear error and `process.exit(1)` if both are absent
  - [x] Acquire `pg_advisory_lock` via `db.execute(sql`SELECT pg_advisory_lock(${sql.raw(String(ADVISORY_LOCK_ID))})`)` before `migrate()`
  - [x] Wrap `migrate()` in try/finally; release `pg_advisory_unlock` with the same id in `finally`
  - [x] Keep `postgres(connectionString, { max: 1, onnotice: () => {} })` and the existing `sql.end()` + exit behavior
  - [x] Run `CI=true pnpm test -- tests/unit/db/migrate.test.ts` and confirm all tests pass
- [x] Task: Conductor - User Manual Verification 'Migration Runner — Advisory Lock + Connection Fallback' (Protocol in workflow.md)

## Phase 3: Bundle Scripts & Dockerfile

- [x] Task: Read spec.md to internalize requirements before starting this phase
- [x] Task: Add `build:migrate` and `build:seed` esbuild scripts
  - [x] Add `"build:migrate": "esbuild src/db/migrate.ts --bundle --format=esm --platform=node --outfile=.output/server/migrate.mjs"` to `package.json` scripts
  - [x] Add `"build:seed": "esbuild src/db/seed.ts --bundle --format=esm --platform=node --outfile=.output/server/seed.mjs"` to `package.json` scripts
  - [x] Update `"build"` to chain: `"pnpm generate:i18n && vite build && pnpm build:migrate && pnpm build:seed"`
  - [x] Verify `esbuild` resolves (transitive via `vite`); if not resolvable as a direct binary, use `pnpm exec esbuild` or add `esbuild` to `devDependencies` (document the decision in the commit message)
  - [x] Run `pnpm build` and confirm `.output/server/migrate.mjs` and `.output/server/seed.mjs` are produced
- [x] Task: Update `docker/Dockerfile` to ship migration artifacts
  - [x] Add `COPY --from=builder --chown=simak:nodejs /app/drizzle/migrations /app/drizzle/migrations` to the runner stage (after the existing `.output` and `package.json` COPY lines)
  - [x] Confirm no other runner-stage changes are needed (no `node_modules`, `tsx`, or `drizzle-kit`)
- [x] Task: Verify Docker build & runner image contents (AC-1)
  - [x] Run `docker build -t simak:dev -f docker/Dockerfile .`
  - [x] Run `docker run --rm simak:dev ls -la .output/server drizzle/migrations` and confirm `migrate.mjs`, `seed.mjs`, and the 10 migration SQL files + `meta/` are present
- [x] Task: Conductor - User Manual Verification 'Bundle Scripts & Dockerfile' (Protocol in workflow.md)

## Phase 4: SQL Style Guide — Rollback Convention & Expand-Contract Pattern

- [x] Task: Read spec.md to internalize requirements before starting this phase
- [x] Task: Append **Rollback Convention** section to `conductor/code_styleguides/sql.md`
  - [x] Add section after the existing §5 Migrations, covering: forward-only migrations; companion rollback file at `drizzle/migrations/rollback/<NNNN>_<tag>.rollback.sql`; never auto-applied by `migrate.mjs`; not registered in `meta/_journal.json`; dev test procedure (forward → `psql < rollback.sql` → verify reverted → re-migrate); irreversible data-loss note convention `-- ROLLBACK NOT POSSIBLE: data loss irreversible`; soft-delete (`deleted_at`) preferred over hard `DROP COLUMN`
- [x] Task: Append **Expand-Contract Pattern** section to `conductor/code_styleguides/sql.md`
  - [x] Add section covering: destructive changes MUST split across deploys; prohibited-in-single-deploy list (`DROP COLUMN`+code reading it, `RENAME COLUMN`+old-name code, `ALTER COLUMN TYPE`+old-type code, `SET NOT NULL` without backfill); 4-step column-rename canonical example; dangerous-operations table (op, lock type, safe approach); `CREATE INDEX CONCURRENTLY` caveat (fails inside Drizzle's tx-wrapped migrations — split into separate file); safe `SET NOT NULL` pattern (`CHECK ... NOT VALID` → `VALIDATE CONSTRAINT` → `SET NOT NULL` → drop CHECK); maintenance-window guidance
- [x] Task: Conductor - User Manual Verification 'SQL Style Guide — Rollback Convention & Expand-Contract Pattern' (Protocol in workflow.md)

## Phase 5: Integration Test & Final Verification

- [x] Task: Read spec.md to internalize requirements before starting this phase
- [x] Task: Write integration test for `migrate.mjs` against local PostgreSQL (acceptance gate)
  - [x] Create `tests/integration/db/migrate.test.ts`
  - [x] Use the `docker-compose.yml` local PostgreSQL (port 5432); ensure a fresh schema (drop `__drizzle_migrations` + all tables, or use a throwaway DB) in `beforeEach`
  - [x] Test AC-2: spawn `node .output/server/migrate.mjs` with `MIGRATE_DATABASE_URL` pointed at local PG; assert exit code 0 and that `__drizzle_migrations` has 11 rows
  - [x] Test AC-3: spawn a second `migrate.mjs` against the same DB; assert exit code 0 and no new `__drizzle_migrations` rows (idempotency)
  - [x] Test AC-6: spawn `node .output/server/seed.mjs` twice; assert SuperAdmin created once, second run logs "already exists", both exit 0
- [x] Task: Run integration suite green (AC-8)
  - [x] Run integration test and confirm the new integration tests pass (6/6)
  - [x] Confirm `pnpm test` (unit) still green — 1783 tests pass, no regressions
- [x] Task: Manual verification of remaining acceptance criteria
  - [x] AC-4: advisory lock verified by unit tests (pg_advisory_lock before migrate, unlock in finally)
  - [x] AC-5: Coolify pre-deploy abort procedure documented in spec
  - [x] AC-7: Coolify pre-deploy command documented: `node .output/server/migrate.mjs && node .output/server/seed.mjs`
- [x] Task: Conductor - User Manual Verification 'Integration Test & Final Verification' (Protocol in workflow.md)

## Phase: Review Fixes

- [x] Task: Apply review suggestions 5f5bb14
      </protect>
