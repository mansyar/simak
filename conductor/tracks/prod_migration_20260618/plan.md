# Implementation Plan: Production Database Migration Infrastructure

## Phase 1: Environment Config — `MIGRATE_DATABASE_URL`

- [ ] Task: Write failing env tests (Red Phase)
  - [ ] Add `MIGRATE_DATABASE_URL` to the valid-env test cases in `tests/unit/config/env.test.ts` (set to a valid URL string)
  - [ ] Add a test case asserting `MIGRATE_DATABASE_URL` is optional (config valid when the var is absent)
  - [ ] Add a test case asserting an invalid URL string for `MIGRATE_DATABASE_URL` is rejected by the Zod schema
  - [ ] Run `CI=true pnpm test -- tests/unit/config/env.test.ts` and confirm the new tests fail (env schema does not yet recognize the key)
- [ ] Task: Implement env schema + `.env.example` (Green Phase)
  - [ ] Add `MIGRATE_DATABASE_URL: z.string().url().optional()` to the Zod schema in `src/config/env.ts`
  - [ ] Add `# MIGRATE_DATABASE_URL=postgresql://user:pass@pg-host:5432/simak` (commented) to `.env.example`
  - [ ] Run `CI=true pnpm test -- tests/unit/config/env.test.ts` and confirm all tests pass
- [ ] Task: Update `docs/TDD.md` env table
  - [ ] Add `MIGRATE_DATABASE_URL` row to the environment variables table (section ~line 825)
  - [ ] Update the "Database Migrations [v1]" section (~line 834) to document: bundled `migrate.mjs` via Coolify pre-deploy, `MIGRATE_DATABASE_URL` bypasses PgBouncer, `pg_advisory_lock` serializes concurrent runs, `seed.mjs` chained after migrate
- [ ] Task: Conductor - User Manual Verification 'Environment Config — MIGRATE_DATABASE_URL' (Protocol in workflow.md)

## Phase 2: Migration Runner — Advisory Lock + Connection Fallback

- [ ] Task: Write failing unit tests for `src/db/migrate.ts` (Red Phase)
  - [ ] Create `tests/unit/db/migrate.test.ts`
  - [ ] Mock `postgres` and `drizzle-orm/postgres-js` + `drizzle-orm/postgres-js/migrator` (follow the canonical mock pattern from `tests/unit/server/submissions.test.ts`)
  - [ ] Test: the advisory lock id constant equals the project-unique value `789123`
  - [ ] Test: `pg_advisory_lock` is executed before `migrate()` is called
  - [ ] Test: `pg_advisory_unlock` is executed in the `finally` block even when `migrate()` throws
  - [ ] Test: when `MIGRATE_DATABASE_URL` is set, the postgres client is constructed with that URL (not `DATABASE_URL`)
  - [ ] Test: when `MIGRATE_DATABASE_URL` is unset and `DATABASE_URL` is set, the client uses `DATABASE_URL` (fallback)
  - [ ] Test: when neither env var is set, the runner throws/logs a clear error and the process exits non-zero
  - [ ] Run `CI=true pnpm test -- tests/unit/db/migrate.test.ts` and confirm the tests fail (current `migrate.ts` has no advisory lock and no `MIGRATE_DATABASE_URL` handling)
- [ ] Task: Implement advisory lock + connection fallback in `src/db/migrate.ts` (Green Phase)
  - [ ] Import `sql` from `drizzle-orm` and define `const ADVISORY_LOCK_ID = 789123`
  - [ ] Resolve connection string as `process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL`; throw a clear error and `process.exit(1)` if both are absent
  - [ ] Acquire `pg_advisory_lock` via `db.execute(sql`SELECT pg_advisory_lock(${sql.raw(String(ADVISORY_LOCK_ID))})`)` before `migrate()`
  - [ ] Wrap `migrate()` in try/finally; release `pg_advisory_unlock` with the same id in `finally`
  - [ ] Keep `postgres(connectionString, { max: 1, onnotice: () => {} })` and the existing `sql.end()` + exit behavior
  - [ ] Run `CI=true pnpm test -- tests/unit/db/migrate.test.ts` and confirm all tests pass
- [ ] Task: Conductor - User Manual Verification 'Migration Runner — Advisory Lock + Connection Fallback' (Protocol in workflow.md)

## Phase 3: Bundle Scripts & Dockerfile

- [ ] Task: Add `build:migrate` and `build:seed` esbuild scripts
  - [ ] Add `"build:migrate": "esbuild src/db/migrate.ts --bundle --format=esm --platform=node --outfile=.output/server/migrate.mjs"` to `package.json` scripts
  - [ ] Add `"build:seed": "esbuild src/db/seed.ts --bundle --format=esm --platform=node --outfile=.output/server/seed.mjs"` to `package.json` scripts
  - [ ] Update `"build"` to chain: `"pnpm generate:i18n && vite build && pnpm build:migrate && pnpm build:seed"`
  - [ ] Verify `esbuild` resolves (transitive via `vite`); if not resolvable as a direct binary, use `pnpm exec esbuild` or add `esbuild` to `devDependencies` (document the decision in the commit message)
  - [ ] Run `pnpm build` and confirm `.output/server/migrate.mjs` and `.output/server/seed.mjs` are produced
- [ ] Task: Update `docker/Dockerfile` to ship migration artifacts
  - [ ] Add `COPY --from=builder --chown=simak:nodejs /app/drizzle/migrations /app/drizzle/migrations` to the runner stage (after the existing `.output` and `package.json` COPY lines)
  - [ ] Confirm no other runner-stage changes are needed (no `node_modules`, `tsx`, or `drizzle-kit`)
- [ ] Task: Verify Docker build & runner image contents (AC-1)
  - [ ] Run `docker build -t simak:dev -f docker/Dockerfile .`
  - [ ] Run `docker run --rm simak:dev ls -la .output/server drizzle/migrations` and confirm `migrate.mjs`, `seed.mjs`, and the 10 migration SQL files + `meta/` are present
- [ ] Task: Conductor - User Manual Verification 'Bundle Scripts & Dockerfile' (Protocol in workflow.md)

## Phase 4: SQL Style Guide — Rollback Convention & Expand-Contract Pattern

- [ ] Task: Append **Rollback Convention** section to `conductor/code_styleguides/sql.md`
  - [ ] Add section after the existing §5 Migrations, covering: forward-only migrations; companion rollback file at `drizzle/migrations/rollback/<NNNN>_<tag>.rollback.sql`; never auto-applied by `migrate.mjs`; not registered in `meta/_journal.json`; dev test procedure (forward → `psql < rollback.sql` → verify reverted → re-migrate); irreversible data-loss note convention `-- ROLLBACK NOT POSSIBLE: data loss irreversible`; soft-delete (`deleted_at`) preferred over hard `DROP COLUMN`
- [ ] Task: Append **Expand-Contract Pattern** section to `conductor/code_styleguides/sql.md`
  - [ ] Add section covering: destructive changes MUST split across deploys; prohibited-in-single-deploy list (`DROP COLUMN`+code reading it, `RENAME COLUMN`+old-name code, `ALTER COLUMN TYPE`+old-type code, `SET NOT NULL` without backfill); 4-step column-rename canonical example; dangerous-operations table (op, lock type, safe approach); `CREATE INDEX CONCURRENTLY` caveat (fails inside Drizzle's tx-wrapped migrations — split into separate file); safe `SET NOT NULL` pattern (`CHECK ... NOT VALID` → `VALIDATE CONSTRAINT` → `SET NOT NULL` → drop CHECK); maintenance-window guidance
- [ ] Task: Conductor - User Manual Verification 'SQL Style Guide — Rollback Convention & Expand-Contract Pattern' (Protocol in workflow.md)

## Phase 5: Integration Test & Final Verification

- [ ] Task: Write integration test for `migrate.mjs` against local PostgreSQL (acceptance gate)
  - [ ] Create `tests/integration/db/migrate.test.ts`
  - [ ] Use the `docker-compose.yml` local PostgreSQL (port 5432); ensure a fresh schema (drop `__drizzle_migrations` + all tables, or use a throwaway DB) in `beforeEach`
  - [ ] Test AC-2: spawn `node .output/server/migrate.mjs` with `MIGRATE_DATABASE_URL` pointed at local PG; assert exit code 0 and that `__drizzle_migrations` has 10 rows
  - [ ] Test AC-3: spawn a second `migrate.mjs` against the same DB; assert exit code 0 and no new `__drizzle_migrations` rows (idempotency)
  - [ ] Test AC-6: spawn `node .output/server/seed.mjs` twice; assert SuperAdmin created once, second run logs "already exists", both exit 0
- [ ] Task: Run integration suite green (AC-8)
  - [ ] Run `pnpm test:integration` and confirm the new integration tests pass
  - [ ] Confirm `pnpm test` (unit) still green — new code did not break the default suite
- [ ] Task: Manual verification of remaining acceptance criteria
  - [ ] AC-4: run two concurrent `docker run --rm --env-file=.env simak:dev node .output/server/migrate.mjs` invocations against local PG; confirm the second blocks on `pg_advisory_lock` until the first releases and no corruption occurs; record outcome
  - [ ] AC-5: document the Coolify pre-deploy abort procedure (inject a broken migration SQL file, run `migrate.mjs`, confirm exit 1) — full Coolify-side verification is a post-deploy manual step; record the procedure in the commit note
  - [ ] Confirm the Coolify service pre-deployment command is documented for the operator: `node .output/server/migrate.mjs && node .output/server/seed.mjs` (not committed to the repo — recorded in the task summary / git note)
- [ ] Task: Conductor - User Manual Verification 'Integration Test & Final Verification' (Protocol in workflow.md)
