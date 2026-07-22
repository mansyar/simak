# Implementation Plan: TypeScript 7 Upgrade

## Phase 1: Pre-Upgrade Preparation

- [ ] Task: Update `conductor/tech-stack.md` with TypeScript 7 changelog entry
    - [ ] Add a dated changelog entry (2026-07-23) noting the upgrade from TS 5.8 → TS 7.0, the removal of `baseUrl`, and the addition of `--checkers` to the typecheck gate
    - [ ] Commit: `docs(tech-stack): Document TypeScript 7 upgrade`
    - [ ] Attach git note with task summary
    - [ ] Record commit SHA in plan.md and mark task complete

- [ ] Task: Measure and record baseline typecheck performance
    - [ ] Run `pnpm typecheck` under TS 5.8 and record wall-clock time (run 3 times, take median)
    - [ ] Record the baseline time in a temporary file or commit message for later comparison
    - [ ] Commit: `chore(bench): Record pre-upgrade typecheck baseline`
    - [ ] Attach git note with baseline measurement
    - [ ] Record commit SHA in plan.md and mark task complete

- [ ] Task: Conductor - User Manual Verification 'Phase 1: Pre-Upgrade Preparation' (Protocol in workflow.md)

## Phase 2: Configuration & Package Upgrade

- [ ] Task: Write configuration verification tests (Red Phase)
    - [ ] Create `tests/unit/config/typescript-7-upgrade.test.ts` with `/** @vitest-environment node */` header
    - [ ] Write test: `tsconfig.json` does not contain `baseUrl` property
    - [ ] Write test: `package.json` specifies `typescript` dependency with version `^7.0.0` or higher
    - [ ] Write test: `lefthook.yml` pre-push typecheck command includes `--checkers` flag
    - [ ] Run `pnpm test` and confirm the new tests fail as expected (Red Phase)

- [ ] Task: Remove `baseUrl` from `tsconfig.json`
    - [ ] Delete the `"baseUrl": "."` line from `tsconfig.json`
    - [ ] Verify the `paths` mapping (`"@/*": ["./src/*"]`) remains intact and still resolves correctly
    - [ ] Run `pnpm typecheck` — confirm no new path resolution errors (may fail until TS 7 is installed)

- [ ] Task: Upgrade TypeScript package and clean stale cache
    - [ ] Update `typescript` from `^5.8.0` to `^7.0.0` in `package.json` (devDependencies)
    - [ ] Delete `tsconfig.tsbuildinfo` (incompatible incremental cache format between major versions)
    - [ ] Run `pnpm install` to update the lockfile and install TS 7
    - [ ] Run `pnpm typecheck` — confirm it succeeds under TS 7
    - [ ] Commit: `chore(deps): Upgrade TypeScript 5.8 → 7.0 and remove baseUrl`
    - [ ] Attach git note with task summary
    - [ ] Record commit SHA in plan.md and mark task complete

- [ ] Task: Add `--checkers` flag to `lefthook.yml` pre-push typecheck gate
    - [ ] Update the pre-push typecheck command in `lefthook.yml` from `tsc --noEmit --incremental` to `tsc --noEmit --incremental --checkers`
    - [ ] Run `pnpm typecheck` with the new flag — confirm it succeeds
    - [ ] Commit: `chore(ci): Add --checkers flag to typecheck gate for TS 7 multithreading`
    - [ ] Attach git note with task summary
    - [ ] Record commit SHA in plan.md and mark task complete

- [ ] Task: Verify configuration tests pass (Green Phase)
    - [ ] Run `pnpm test` — confirm the configuration verification tests from the Red Phase task now pass
    - [ ] Commit: `test(config): Add TS 7 upgrade configuration verification tests`
    - [ ] Attach git note with task summary
    - [ ] Record commit SHA in plan.md and mark task complete

- [ ] Task: Conductor - User Manual Verification 'Phase 2: Configuration & Package Upgrade' (Protocol in workflow.md)

## Phase 3: Quality Gate Verification & Benchmarking

- [ ] Task: Run full quality gate suite under TS 7
    - [ ] Run `pnpm typecheck` — confirm passes
    - [ ] Run `pnpm test:coverage` — confirm all tests pass and coverage ≥80% on all four metrics (lines, statements, branches, functions)
    - [ ] Run `pnpm lint` — confirm passes (including `simak-i18n/no-hardcoded`)
    - [ ] Run `pnpm check:i18n` — confirm EN↔ID key parity
    - [ ] If any gate fails, debug and fix (maximum 2 attempts per the workflow protocol)
    - [ ] Commit: `chore(verify): Quality gates pass under TypeScript 7`
    - [ ] Attach git note with quality gate results
    - [ ] Record commit SHA in plan.md and mark task complete

- [ ] Task: Measure post-upgrade typecheck performance and document speedup
    - [ ] Run `pnpm typecheck` under TS 7 three times, take median wall-clock time
    - [ ] Compare against the Phase 1 baseline measurement
    - [ ] Document the speedup ratio in the commit message and git note
    - [ ] Commit: `chore(bench): Document TS 7 typecheck speedup`
    - [ ] Attach git note with before/after measurements
    - [ ] Record commit SHA in plan.md and mark task complete

- [ ] Task: Smoke test `pnpm dev` and `pnpm build`
    - [ ] Run `pnpm dev` — confirm i18n codegen runs and Vite dev server boots without errors
    - [ ] Run `pnpm build` — confirm full production build succeeds (i18n codegen + vite build + migrate/seed bundles)
    - [ ] Commit: `chore(verify): Smoke test dev and build under TS 7`
    - [ ] Attach git note with smoke test results
    - [ ] Record commit SHA in plan.md and mark task complete

- [ ] Task: Conductor - User Manual Verification 'Phase 3: Quality Gate Verification & Benchmarking' (Protocol in workflow.md)
