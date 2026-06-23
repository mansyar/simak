<protect>
# Implementation Plan: Production Migration Hardening

## Phase 1: Rewrite Migration Runner (TDD)

- [x] Task: Read spec.md and workflow.md before starting this phase
    - [x] Review the spec's functional requirements (FR1, FR4, FR5, FR6)
    - [x] Review the workflow's TDD lifecycle and Phase Completion Verification protocol
    - commit: b98ea45

- [x] Task: Write failing tests for programmatic migrator (Red)
    - [x] Remove `vi.mock('node:child_process')` and `mockExecSync` from test setup
    - [x] Add `vi.mock('drizzle-orm/postgres-js/migrator')` with a mocked `migrate` function
    - [x] Write test: advisory lock (`pg_advisory_lock`) is acquired before `migrate()` is called
    - [x] Write test: advisory lock (`pg_advisory_unlock`) is released in `finally` on success
    - [x] Write test: advisory lock is released in `finally` even when `migrate()` throws
    - [x] Write test: `MIGRATE_DATABASE_URL` takes precedence over `DATABASE_URL`
    - [x] Write test: falls back to `DATABASE_URL` when `MIGRATE_DATABASE_URL` is unset
    - [x] Write test: exits with error when neither env var is set
    - [x] Write test: `migrate()` is called with `{ migrationsFolder: './drizzle/migrations' }`
    - [x] Run `CI=true pnpm vitest run tests/unit/db/migrate.test.ts` and confirm tests fail (Red)
    - commit: 85598e9

- [x] Task: Implement programmatic migrator (Green)
    - [x] Remove `import { execSync } from 'node:child_process'` from `src/db/migrate.ts`
    - [x] Add `import { migrate } from 'drizzle-orm/postgres-js/migrator'` to `src/db/migrate.ts`
    - [x] Replace `execSync('npx drizzle-kit migrate', { stdio: 'inherit' })` with `await migrate(db, { migrationsFolder: './drizzle/migrations' })`
    - [x] Run `CI=true pnpm vitest run tests/unit/db/migrate.test.ts` and confirm tests pass (Green)
    - commits: e393d8d (test mock fix), 516c1cf (implementation)

- [x] Task: Wire MIGRATE_DATABASE_URL in drizzle.config.ts
    - [x] Change `url: process.env.DATABASE_URL!` to `url: process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL!`
    - [x] Run `CI=true pnpm vitest run tests/unit/db/migrate.test.ts` and confirm still passing
    - commit: d327ba2

- [x] Task: Delete db:migrate:prod script from package.json
    - [x] Remove the `db:migrate:prod` entry from the `scripts` section in `package.json`
    - [x] Run `CI=true pnpm vitest run tests/unit/db/migrate.test.ts` and confirm still passing
    - commit: dcb6caa

- [x] Task: Conductor - User Manual Verification 'Rewrite Migration Runner' (Protocol in workflow.md)
    - checkpoint: d734b7b

## Phase 2: Update Dockerfile

- [x] Task: Read spec.md and workflow.md before starting this phase
    - [x] Review the spec's functional requirements (FR2, FR3) and NFR1, NFR2
    - [x] Review the workflow's Phase Completion Verification protocol
    commit: d385bee

- [x] Task: Update Dockerfile CMD to use migrate.mjs
    - [x] Change CMD from `["sh", "-c", "drizzle-kit migrate && node .output/server/index.mjs"]` to `["sh", "-c", "node .output/server/migrate.mjs && node .output/server/index.mjs"]`
    - [x] Verify `drizzle/migrations` COPY line is still present (programmatic migrator needs SQL files at runtime)
    commit: c5c3f5b

- [x] Task: Remove drizzle-kit from runner stage
    - [x] Remove `RUN npm install -g drizzle-kit@0.31.10` and the preceding `USER root` / `USER simak` lines
    - [x] Remove `COPY --from=builder ... drizzle.config.ts ...` line
    - [x] Verify `COPY --from=builder ... drizzle/migrations ...` line is still present

- [ ] Task: Conductor - User Manual Verification 'Update Dockerfile' (Protocol in workflow.md)

## Phase 3: Build & Full Verification

- [ ] Task: Read spec.md and workflow.md before starting this phase
    - [ ] Review the spec's acceptance criteria (items 8-10)
    - [ ] Review the workflow's Phase Completion Verification protocol

- [ ] Task: Verify production build produces migrate.mjs
    - [ ] Run `pnpm build` and confirm `.output/server/migrate.mjs` is produced
    - [ ] Confirm `migrate.mjs` does not contain `execSync` or `npx` references

- [ ] Task: Run typecheck
    - [ ] Run `pnpm typecheck` and confirm no errors

- [ ] Task: Run full test suite with coverage
    - [ ] Run `CI=true pnpm vitest run --coverage` and confirm all tests pass
    - [ ] Confirm coverage thresholds met (lines 80%, functions 80%, branches 72%, statements 79%)

- [ ] Task: Conductor - User Manual Verification 'Build & Full Verification' (Protocol in workflow.md)
</protect>
