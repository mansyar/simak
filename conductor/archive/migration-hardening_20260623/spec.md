<protect>
# Track: Production Migration Hardening

## Overview

The production Docker image runs migrations via the raw `drizzle-kit migrate` CLI, bypassing the tested, advisory-locked `runMigrations()` function in `src/db/migrate.ts`. This track rewires the production migration path so the Dockerfile executes the bundled `migrate.mjs` (which contains `runMigrations()` with its `pg_advisory_lock`), replaces the `execSync('npx drizzle-kit migrate')` shell-out with Drizzle's programmatic `migrate()` API so the bundle is fully self-contained, and removes `drizzle-kit` from the production image entirely.

**Deployment context:** Coolify with GitHub App — auto-deploys on every push to master. No CI/CD pipeline. The advisory lock is the sole concurrency guard during rolling deploys.

## Background

Current state (problems being fixed):
1. **Dockerfile CMD bypasses the lock:** `CMD ["sh", "-c", "drizzle-kit migrate && node .output/server/index.mjs"]` runs the raw CLI, not `migrate.mjs`. The advisory lock, `MIGRATE_DATABASE_URL` support, and tested code path are all inactive in production.
2. **`runMigrations()` shells out to `npx`:** `execSync('npx drizzle-kit migrate')` requires `drizzle-kit` at runtime. If removed from the image, `npx` would attempt to download it from npm — a security and reliability risk.
3. **`drizzle-kit` bloating the image:** The runner stage globally installs `drizzle-kit@0.31.10` solely because of the shell-out. The `migrate.mjs` artifact is built but never executed — dead code.
4. **`MIGRATE_DATABASE_URL` not wired:** `drizzle.config.ts` reads only `process.env.DATABASE_URL!`, ignoring `MIGRATE_DATABASE_URL` that `migrate.ts` supports.
5. **`db:migrate:prod` is a misleading alias:** identical to `db:migrate` — neither uses the advisory lock.
6. **Test/command string drift:** Tests assert `execSync` is called with `'npx drizzle-kit migrate'`; production runs `'drizzle-kit migrate'` (no `npx`). Neither matches after the fix.

## Functional Requirements

### FR1: Programmatic Migration Runner
- `runMigrations()` in `src/db/migrate.ts` must use the programmatic `migrate()` function from `drizzle-orm/postgres-js/migrator` instead of `execSync('npx drizzle-kit migrate')`.
- The migrator must read SQL files from `./drizzle/migrations` at runtime.
- The advisory lock (`pg_advisory_lock(789123)`) and `pg_advisory_unlock` in the `finally` block must be preserved.
- `MIGRATE_DATABASE_URL ?? DATABASE_URL` env resolution must be preserved.
- The `import.meta.main` direct-execution block must be preserved.

### FR2: Dockerfile CMD Uses migrate.mjs
- The Dockerfile CMD must execute `node .output/server/migrate.mjs` before starting the app.
- CMD format: `["sh", "-c", "node .output/server/migrate.mjs && node .output/server/index.mjs"]`
- The `drizzle/migrations` directory must still be copied into the runner stage (needed by the programmatic migrator).

### FR3: Remove drizzle-kit from Production Image
- Remove `npm install -g drizzle-kit@0.31.10` from the runner stage.
- Remove `COPY drizzle.config.ts` from the runner stage (only needed by the CLI, not the programmatic migrator).

### FR4: Wire MIGRATE_DATABASE_URL in drizzle.config.ts
- `drizzle.config.ts` must read `process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL!` so dev tools (`db:generate`, `db:push`) use the same env resolution as `migrate.ts`.

### FR5: Delete db:migrate:prod Script
- Remove the `db:migrate:prod` script from `package.json`. `db:migrate` (drizzle-kit for dev) is sufficient.

### FR6: Update Unit Tests
- Update `tests/unit/db/migrate.test.ts` to mock `drizzle-orm/postgres-js/migrator`'s `migrate()` function instead of `node:child_process`'s `execSync`.
- Tests must verify:
  - Advisory lock is acquired before `migrate()` is called.
  - Advisory lock is released in the `finally` block (even on failure).
  - `MIGRATE_DATABASE_URL` takes precedence over `DATABASE_URL`.
  - Falls back to `DATABASE_URL` when `MIGRATE_DATABASE_URL` is unset.
  - Exits with error when neither env var is set.
  - `migrate()` is called with `{ migrationsFolder: './drizzle/migrations' }`.

## Non-Functional Requirements

### NFR1: Image Size
- The production Docker image must not contain `drizzle-kit` or its dependencies. This reduces image size and attack surface.

### NFR2: No Runtime Downloads
- The migration runner must not shell out to `npx` or fetch any packages from npm at runtime. All code must be bundled by esbuild into `migrate.mjs`.

### NFR3: Advisory Lock Safety
- The advisory lock must be the sole concurrency guard during Coolify rolling deploys. No additional locking mechanism is required for this track.

## Acceptance Criteria

1. `docker build` produces an image where `drizzle-kit` is not installed.
2. The Dockerfile CMD runs `node .output/server/migrate.mjs && node .output/server/index.mjs`.
3. `migrate.mjs` uses the programmatic `migrate()` API — no `execSync`, no `npx`, no shell-out.
4. The advisory lock is acquired before and released after migration, including on failure.
5. `MIGRATE_DATABASE_URL` is respected by both `migrate.ts` and `drizzle.config.ts`.
6. `db:migrate:prod` script no longer exists in `package.json`.
7. All unit tests in `tests/unit/db/migrate.test.ts` pass and mock `migrate()` instead of `execSync`.
8. `pnpm typecheck` passes.
9. `pnpm vitest run` passes with coverage thresholds met.
10. `pnpm build` produces `.output/server/migrate.mjs` successfully.

## Out of Scope

- **Rollback / down-migrations:** Drizzle's migrator is forward-only. Rollback strategy is a separate operational concern.
- **CI/CD pipeline:** No GitHub Actions workflows. Coolify handles auto-deploy on push to master.
- **Coolify pre-deployment command:** The Dockerfile CMD approach is sufficient. Separating migration into a Coolify pre-deploy step is a future optimization.
- **Schema drift / backward-compatible migration patterns:** Expand-then-contract migration strategy is a separate concern.
- **Integration tests against a real PostgreSQL:** Only unit tests are updated in this track.
</protect>
