<protect>
# Specification: Production Database Migration Infrastructure

## Overview

SIMAK currently relies on a manual operator step to run Drizzle migrations against the production database (`conductor/workflow.md` deployment step 4). The built Docker image cannot self-migrate: `docker/Dockerfile` does not copy the `drizzle/migrations/` folder, and `src/db/migrate.ts` is not bundled into `.output`. The documented intent in `docs/TDD.md` ("Migration runs as part of the Docker entrypoint or a separate init container") is unimplemented. Additionally, `migrate.ts` has no concurrency guard, no way to bypass a planned PgBouncer sidecar (which breaks Drizzle's prepared-statement-based migrator), and there is no rollback convention or zero-downtime migration guidance in the SQL style guide.

This track closes those gaps by wiring a bundled, Coolify pre-deploy-triggered migration runner with an advisory lock and direct-to-PostgreSQL connection, plus documentation of rollback and expand-contract conventions for future migrations.

## Track Type

Chore / Infrastructure (no new user-facing product functionality).

## Functional Requirements

### FR-1: Bundled Migration & Seed Runners

- `package.json` gains `build:migrate` and `build:seed` scripts using `esbuild` (transitive via vite, no new dependency) to bundle `src/db/migrate.ts` → `.output/server/migrate.mjs` and `src/db/seed.ts` → `.output/server/seed.mjs` as self-contained ESM bundles (zero runtime `node_modules` dependency).
- The `build` script chains: `pnpm generate:i18n && vite build && pnpm build:migrate && pnpm build:seed`.
- Bundles resolve the migrations folder via the current working directory (`./drizzle/migrations`), matching the container's CWD of `/app`.

### FR-2: Advisory Lock in Migration Runner

- `src/db/migrate.ts` wraps the `migrate()` call in a PostgreSQL advisory lock using a project-unique integer id (`789123`).
- `pg_advisory_lock` is acquired before `migrate()` and `pg_advisory_unlock` is released in a `finally` block, guaranteeing release even when `migrate()` throws.
- This prevents concurrent-run corruption when multiple replicas (or a manual run + pre-deploy) execute migrations simultaneously.

### FR-3: Direct-to-PostgreSQL Connection (Bypass PgBouncer)

- `src/db/migrate.ts` reads `MIGRATE_DATABASE_URL` first, falling back to `DATABASE_URL` if unset.
- `MIGRATE_DATABASE_URL` is intended to point directly at PostgreSQL (port 5432), bypassing the planned PgBouncer sidecar (port 6432) whose transaction-mode pooling breaks Drizzle's prepared statements.
- `src/config/env.ts` Zod schema gains `MIGRATE_DATABASE_URL: z.string().url().optional()`.
- `.env.example` documents the variable (commented, optional).

### FR-4: Dockerfile Ships Migration Artifacts

- `docker/Dockerfile` runner stage adds: `COPY --from=builder --chown=simak:nodejs /app/drizzle/migrations /app/drizzle/migrations`.
- Runner image contents: `.output` (app + `migrate.mjs` + `seed.mjs`), `drizzle/migrations/`, `package.json`. No `node_modules`, no `tsx`, no `drizzle-kit` in the runner image.

### FR-5: Coolify Pre-Deployment Hook

- The Coolify service is configured (outside the repo) with a pre-deployment command: `node .output/server/migrate.mjs && node .output/server/seed.mjs`.
- Migrate runs once, isolated, before new replicas receive traffic. Old replicas keep serving during migration.
- Exit 0 → deploy proceeds. Exit 1 → Coolify aborts the deploy; old replicas continue serving.
- `seed.mjs` is idempotent (existing SuperAdmin/test-user creation is skipped), so chaining it after every migrate is safe.

### FR-6: Rollback Convention Documented

- `conductor/code_styleguides/sql.md` gains a **Rollback Convention** section specifying:
  - Forward-only migrations; Drizzle has no built-in rollback.
  - Every migration MUST have a companion rollback SQL file at `drizzle/migrations/rollback/<NNNN>_<tag>.rollback.sql` (NNNN + tag matching the forward migration).
  - Rollback SQL is never auto-applied by `migrate.mjs` and is not registered in `meta/_journal.json`.
  - Purpose: documented, dev-tested, ready for manual execution via `psql` or `docker exec` in emergencies.
  - Test procedure on dev: forward `pnpm db:migrate` → verify → `psql < rollback.sql` → verify reverted → `pnpm db:migrate` re-applies.
  - Data-loss migrations note irreversible cases explicitly: `-- ROLLBACK NOT POSSIBLE: data loss irreversible`.
  - Soft-delete (`deleted_at` column) preferred over hard `DROP COLUMN`.

### FR-7: Expand-Contract Pattern Documented

- `conductor/code_styleguides/sql.md` gains an **Expand-Contract Pattern** section specifying:
  - Destructive schema changes MUST be split across multiple deploys so old app code + new schema coexist during rollout.
  - Prohibited in a single deploy: `DROP COLUMN` + code reading it; `RENAME COLUMN` + code using old name; `ALTER COLUMN TYPE` + code expecting old type; `SET NOT NULL` without prior backfill.
  - The 4-step column-rename sequence (expand → migrate/backfill → flip code → contract) as the canonical example.
  - Table of dangerous operations, their lock type, and the safe approach (`SET NOT NULL` via CHECK + VALIDATE; `ALTER TYPE` via add-new/backfill/flip/drop-old; `CREATE INDEX CONCURRENTLY` outside a transaction).
  - `CREATE INDEX CONCURRENTLY` caveat: fails inside Drizzle's default transaction-wrapped migrations; split into a separate migration file when first needed.
  - Safe `SET NOT NULL` pattern (add `CHECK ... NOT VALID` → `VALIDATE CONSTRAINT` → `SET NOT NULL` → drop CHECK).
  - When to use a maintenance window instead (drop heavily-used column, `ALTER TYPE` on millions of rows).

### FR-8: Tests

- **Unit tests** (default suite, blocks pre-push gate) for `src/db/migrate.ts`:
  - Advisory lock id is the project-unique constant; `pg_advisory_lock` is called before `migrate()`; `pg_advisory_unlock` is called in `finally` even when `migrate()` throws.
  - `MIGRATE_DATABASE_URL` takes precedence over `DATABASE_URL`; missing both throws with a clear error and exits non-zero.
- **Integration test** (`tests/integration/`, excluded from default `pnpm test` per `package.json:10`, run via `pnpm test:integration`) against the `docker-compose.yml` local PostgreSQL:
  - Run `migrate.mjs` against a fresh schema → assert all 10 migrations applied (rows in `__drizzle_migrations`).
  - Run `migrate.mjs` a second time → assert no new rows (idempotency), exit 0.
- No concurrent-serialization test (serialization is a PostgreSQL guarantee; timing-dependent CI tests are flaky-prone and prove PG behavior rather than our code).

## Non-Functional Requirements

### NFR-1: Image Size

- Runner image must not grow significantly. Bundled `migrate.mjs` + `seed.mjs` are single ESM files (~tens of KB); the `drizzle/migrations/` folder is ~tens of KB of SQL. No `node_modules`, `tsx`, or `drizzle-kit` added to the runner stage.

### NFR-2: Zero New Runtime Dependencies

- `esbuild` is already a transitive dependency via `vite`. No additions to `dependencies` or `devDependencies` in `package.json`.

### NFR-3: No Boot-Time Migration

- The application server (`src/db/index.ts` `getDb()`) must NOT call `migrate()` on startup. Migrations run only via the pre-deploy hook. This avoids boot latency on every restart and multi-replica races.

### NFR-4: Backward Compatibility

- `MIGRATE_DATABASE_URL` is optional with fallback to `DATABASE_URL`, so existing local-dev and current single-DB setups keep working unchanged until PgBouncer is introduced.

## Acceptance Criteria

1. **AC-1 Docker build succeeds** and the runner image contains `.output/server/migrate.mjs`, `.output/server/seed.mjs`, and the `drizzle/migrations/` folder (verified via `docker run --rm simak:dev ls -la .output/server drizzle/migrations`).
2. **AC-2 In-container migrate works**: `docker run --rm --env-file=.env simak:dev node .output/server/migrate.mjs` against local PG applies all 10 migrations and exits 0.
3. **AC-3 Idempotent re-run**: a second consecutive `migrate.mjs` invocation creates no new `__drizzle_migrations` rows and exits 0.
4. **AC-4 Advisory lock serializes**: two concurrent `migrate.mjs` runs against the same DB — the second blocks on `pg_advisory_lock` until the first releases; no corruption.
5. **AC-5 Pre-deploy aborts on failure**: injecting an intentionally broken migration causes `migrate.mjs` to exit 1; Coolify aborts the deploy (manually verified post-deploy, documented in plan).
6. **AC-6 Seed idempotent**: `seed.mjs` run twice creates the SuperAdmin once; the second run logs "already exists" and exits 0.
7. **AC-7 SQL style guide updated**: `conductor/code_styleguides/sql.md` contains the **Rollback Convention** and **Expand-Contract Pattern** sections with the content specified in FR-6 and FR-7.
8. **AC-8 Unit + integration tests pass**: `pnpm test` (unit) green and `pnpm test:integration` (integration against local PG) green.

## Out of Scope

- **CI/CD migration gate** (ephemeral-PG workflow on every PR) — deferred to a separate track; this track has no `.github/workflows/` foundation to build on.
- **Reconciling `drizzle/migrations/meta/` snapshots** (only `0000_snapshot.json` and `0001_snapshot.json` exist despite 10 journal entries) — risk only materializes on the next `drizzle-kit generate`; deferred.
- **`strict: true` / `verbose: true` in `drizzle.config.ts`** — cosmetic hardening, no functional impact; deferred.
- **Custom hash-based migration runner** (replacing Drizzle's watermark approach) — SIMAK uses consistent sequential `0000_`–`0009_` prefixes; the watermark bug only affects mixed-prefix projects. Revisit only if the prefix scheme changes.
- **`disableTransactionsDDL` config** — no `CREATE INDEX CONCURRENTLY` migrations exist yet; add when the first one is needed (per FR-7 guidance).
- **Updating `conductor/workflow.md`** deployment step 4 — explicitly excluded per user decision; the manual step description stays as-is.
- **PgBouncer deployment itself** — this track only prepares the `MIGRATE_DATABASE_URL` bypass; the PgBouncer sidecar is a separate infrastructure concern.
- **Startup-hook migration in app boot** — explicitly excluded (pre-deploy hook covers it; adding both causes races and boot latency).
  </protect>
