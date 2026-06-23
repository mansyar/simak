# Implementation Plan: Production Migration Hardening

## Phase 1: Rewrite Migration Runner (TDD)

- [ ] Task: Write failing tests for programmatic migrator (Red)
    - [ ] Remove `vi.mock('node:child_process')` and `mockExecSync` from test setup
    - [ ] Add `vi.mock('drizzle-orm/postgres-js/migrator')` with a mocked `migrate` function
    - [ ] Write test: advisory lock (`pg_advisory_lock`) is acquired before `migrate()` is called
    - [ ] Write test: advisory lock (`pg_advisory_unlock`) is released in `finally` on success
    - [ ] Write test: advisory lock is released in `finally` even when `migrate()` throws
    - [ ] Write test: `MIGRATE_DATABASE_URL` takes precedence over `DATABASE_URL`
    - [ ] Write test: falls back to `DATABASE_URL` when `MIGRATE_DATABASE_URL` is unset
    - [ ] Write test: exits with error when neither env var is set
    - [ ] Write test: `migrate()` is called with `{ migrationsFolder: './drizzle/migrations' }`
    - [ ] Run `CI=true pnpm vitest run tests/unit/db/migrate.test.ts` and confirm tests fail (Red)

- [ ] Task: Implement programmatic migrator (Green)
    - [ ] Remove `import { execSync } from 'node:child_process'` from `src/db/migrate.ts`
    - [ ] Add `import { migrate } from 'drizzle-orm/postgres-js/migrator'` to `src/db/migrate.ts`
    - [ ] Replace `execSync('npx drizzle-kit migrate', { stdio: 'inherit' })` with `await migrate(db, { migrationsFolder: './drizzle/migrations' })`
    - [ ] Run `CI=true pnpm vitest run tests/unit/db/migrate.test.ts` and confirm tests pass (Green)

- [ ] Task: Wire MIGRATE_DATABASE_URL in drizzle.config.ts
    - [ ] Change `url: process.env.DATABASE_URL!` to `url: process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL!`
    - [ ] Run `CI=true pnpm vitest run tests/unit/db/migrate.test.ts` and confirm still passing

- [ ] Task: Delete db:migrate:prod script from package.json
    - [ ] Remove the `db:migrate:prod` entry from the `scripts` section in `package.json`
    - [ ] Run `CI=true pnpm vitest run tests/unit/db/migrate.test.ts` and confirm still passing

- [ ] Task: Conductor - User Manual Verification 'Rewrite Migration Runner' (Protocol in workflow.md)

## Phase 2: Update Dockerfile

- [ ] Task: Update Dockerfile CMD to use migrate.mjs
    - [ ] Change CMD from `["sh", "-c", "drizzle-kit migrate && node .output/server/index.mjs"]` to `["sh", "-c", "node .output/server/migrate.mjs && node .output/server/index.mjs"]`
    - [ ] Verify `drizzle/migrations` COPY line is still present (programmatic migrator needs SQL files at runtime)

- [ ] Task: Remove drizzle-kit from runner stage
    - [ ] Remove `RUN npm install -g drizzle-kit@0.31.10` and the preceding `USER root` / `USER simak` lines
    - [ ] Remove `COPY --from=builder ... drizzle.config.ts ...` line
    - [ ] Verify `COPY --from=builder ... drizzle/migrations ...` line is still present

- [ ] Task: Conductor - User Manual Verification 'Update Dockerfile' (Protocol in workflow.md)

## Phase 3: Build & Full Verification

- [ ] Task: Verify production build produces migrate.mjs
    - [ ] Run `pnpm build` and confirm `.output/server/migrate.mjs` is produced
    - [ ] Confirm `migrate.mjs` does not contain `execSync` or `npx` references

- [ ] Task: Run typecheck
    - [ ] Run `pnpm typecheck` and confirm no errors

- [ ] Task: Run full test suite with coverage
    - [ ] Run `CI=true pnpm vitest run --coverage` and confirm all tests pass
    - [ ] Confirm coverage thresholds met (lines 80%, functions 80%, branches 72%, statements 79%)

- [ ] Task: Conductor - User Manual Verification 'Build & Full Verification' (Protocol in workflow.md)
