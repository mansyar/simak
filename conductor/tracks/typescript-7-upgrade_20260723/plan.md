# Implementation Plan: TypeScript 7 Upgrade

## Phase 1: Pre-Upgrade Preparation [checkpoint: 2fa7fc1]

- [x] Task: Update `conductor/tech-stack.md` with TypeScript 7 changelog entry `ffe5aa8`
    - [x] Add a dated changelog entry (2026-07-23) noting the upgrade from TS 5.8 → TS 7.0, the removal of `baseUrl`, and the addition of `--checkers` to the typecheck gate
    - [x] Commit: `docs(tech-stack): Document TypeScript 7 upgrade`
    - [x] Attach git note with task summary
    - [x] Record commit SHA in plan.md and mark task complete

- [x] Task: Measure and record baseline typecheck performance `172535c`
    - [x] Run `pnpm typecheck` under TS 5.8 and record wall-clock time (run 3 times, take median)
    - [x] Record the baseline time in a temporary file or commit message for later comparison
    - [x] Commit: `chore(bench): Record pre-upgrade typecheck baseline`
    - [x] Attach git note with baseline measurement
    - [x] Record commit SHA in plan.md and mark task complete

- [x] Task: Conductor - User Manual Verification 'Phase 1: Pre-Upgrade Preparation' (Protocol in workflow.md)

## Phase 2: Configuration & Package Upgrade [checkpoint: 69aa9b0]

- [x] Task: Write configuration verification tests (Red Phase)
    - [x] Create `tests/unit/config/typescript-7-upgrade.test.ts` with `/** @vitest-environment node */` header
    - [x] Write test: `tsconfig.json` does not contain `baseUrl` property
    - [x] Write test: `package.json` specifies `typescript` dependency with version `^7.0.0` or higher
    - [x] Write test: `lefthook.yml` pre-push typecheck command includes `--checkers` flag
    - [x] Run `pnpm test` and confirm the new tests fail as expected (Red Phase)

- [x] Task: Remove `baseUrl` from `tsconfig.json`
    - [x] Delete the `"baseUrl": "."` line from `tsconfig.json`
    - [x] Verify the `paths` mapping (`"@/*": ["./src/*"]`) remains intact and still resolves correctly
    - [x] Run `pnpm typecheck` — confirm no new path resolution errors (may fail until TS 7 is installed)

- [x] Task: Upgrade TypeScript package and clean stale cache `1827970`
    - [x] Update `typescript` from `^5.8.0` to `^7.0.0` in `package.json` (devDependencies)
    - [x] Delete `tsconfig.tsbuildinfo` (incompatible incremental cache format between major versions)
    - [x] Run `pnpm install` to update the lockfile and install TS 7
    - [x] Run `pnpm typecheck` — confirm it succeeds under TS 7
    - [x] Commit: `chore(deps): Upgrade TypeScript 5.8 → 7.0 and remove baseUrl`
    - [x] Attach git note with task summary
    - [x] Record commit SHA in plan.md and mark task complete

- [x] Task: Add `--checkers` flag to `lefthook.yml` pre-push typecheck gate `3d31fb4`
    - [x] Update the pre-push typecheck command in `lefthook.yml` from `tsc --noEmit --incremental` to `tsc --noEmit --incremental --checkers`
    - [x] Run `pnpm typecheck` with the new flag — confirm it succeeds
    - [x] Commit: `chore(ci): Add --checkers flag to typecheck gate for TS 7 multithreading`
    - [x] Attach git note with task summary
    - [x] Record commit SHA in plan.md and mark task complete

- [x] Task: Verify configuration tests pass (Green Phase) `1fa5742`
    - [x] Run `pnpm test` — confirm the configuration verification tests from the Red Phase task now pass
    - [x] Commit: `test(config): Add TS 7 upgrade configuration verification tests`
    - [x] Attach git note with task summary
    - [x] Record commit SHA in plan.md and mark task complete

- [x] Task: Conductor - User Manual Verification 'Phase 2: Configuration & Package Upgrade' (Protocol in workflow.md)

## Phase 3: Quality Gate Verification & Benchmarking

- [x] Task: Run full quality gate suite under TS 7 `ecca154`
    - [x] Run `pnpm typecheck` — confirm passes
    - [x] Run `pnpm test:coverage` — confirm all tests pass and coverage ≥80% on all four metrics (lines, statements, branches, functions)
    - [x] Run `pnpm lint` — confirm passes (including `simak-i18n/no-hardcoded`)
    - [x] Run `pnpm check:i18n` — confirm EN↔ID key parity
    - [x] If any gate fails, debug and fix (maximum 2 attempts per the workflow protocol)
    - [x] Commit: `chore(verify): Quality gates pass under TypeScript 7`
    - [x] Attach git note with quality gate results
    - [x] Record commit SHA in plan.md and mark task complete

- [x] Task: Measure post-upgrade typecheck performance and document speedup `7fbf0b1`
    - [ ] Run `pnpm typecheck` under TS 7 three times, take median wall-clock time
    - [ ] Compare against the Phase 1 baseline measurement
    - [ ] Document the speedup ratio in the commit message and git note
    - [ ] Commit: `chore(bench): Document TS 7 typecheck speedup`
    - [ ] Attach git note with before/after measurements
    - [ ] Record commit SHA in plan.md and mark task complete

- [x] Task: Smoke test `pnpm dev` and `pnpm build` `ee7fe5c`
    - [ ] Run `pnpm dev` — confirm i18n codegen runs and Vite dev server boots without errors
    - [ ] Run `pnpm build` — confirm full production build succeeds (i18n codegen + vite build + migrate/seed bundles)
    - [ ] Commit: `chore(verify): Smoke test dev and build under TS 7`
    - [ ] Attach git note with smoke test results
    - [ ] Record commit SHA in plan.md and mark task complete

- [~] Task: Conductor - User Manual Verification 'Phase 3: Quality Gate Verification & Benchmarking' (Protocol in workflow.md)
