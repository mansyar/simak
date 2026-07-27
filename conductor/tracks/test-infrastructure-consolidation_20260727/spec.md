# Track Specification: TRACK-035 — Test Infrastructure Consolidation

## Overview

**Track ID:** TRACK-035  
**Type:** Chore (test infrastructure / tooling consolidation)  
**Audit ID:** INFRA-8 (fragile test script configuration)  
**Dependencies:** None  
**Estimated Effort:** 1 Day / 0.5 Sprint Loops  
**Roadmap Reference:** `docs/roadmap.md` §TRACK-035

### Problem Statement

The project's test scripts in `package.json` are fragile and complex. The `test` and `test:unit` scripts are byte-identical long strings carrying four `--exclude` flags and a second `vitest run --pool=threads` invocation for 4 xlsx-parsing test files that are incompatible with the default `vmThreads` pool. This dual-run pattern has three concrete defects:

1. **Integration tests are excluded only via command-line flags** — bare `vitest run` (without `pnpm test`) includes integration tests, diverging from documented behavior. The exclusion lives in scripts, not config.
2. **`test:watch` silently skips the 4 xlsx tests** — it excludes them but never runs the second `--pool=threads` invocation, so xlsx test failures go unnoticed during watch-mode development.
3. **`test:coverage` forces `--pool=threads` on ALL tests** — the 4 xlsx files need `threads`, but applying it to every test forfeits the ~50% speed advantage of `vmThreads` across the entire suite.

Additionally, `test:unit` is a byte-identical duplicate of `test`, and the `AGENTS.md` / `workflow.md` documentation describes commands that no longer match reality.

### Goal

Consolidate test infrastructure so that pool selection and test exclusion are **config-driven** (in `vitest.config.ts`) rather than **script-driven** (in `package.json`), yielding flag-free default scripts, no silent test gaps, and no spurious pool downgrades.

## Architectural Decisions (Confirmed)

1. **Integration exclusion via separate config file.** Add `'tests/integration/**'` to the default test config's `exclude`. Create `vitest.config.integration.ts` (a small, focused file) that runs integration tests. `test:integration` uses `--config vitest.config.integration.ts`. This keeps the default test scripts flag-free — bare `vitest run` excludes integration automatically.

2. **xlsx pool isolation via Vitest `projects` array.** Restructure `vitest.config.ts` to use a `projects` array with two projects:
   - **unit project** — `pool: 'vmThreads'` (inherited default), `include: tests/**`, `exclude: [node_modules, dist, tests/integration/**, <4 xlsx files>]`.
   - **xlsx project** — `pool: 'threads'`, `include: [<4 xlsx files>]`.
   
   Bare `vitest run` executes both projects, so xlsx tests run automatically with the correct pool. This eliminates the dual-run script pattern, fixes the `test:watch` xlsx gap, and lets `test:coverage` use the default pool (vmThreads for unit, threads for xlsx) — no global `--pool=threads`.

3. **`test:unit` as thin alias.** Set `"test:unit": "pnpm test"`. Keeps the documented command working everywhere with zero duplication. No command-name churn in docs.

## Functional Requirements

### FR-1: Config-driven integration exclusion
- `vitest.config.ts` default project `exclude` array MUST contain `'tests/integration/**'`.
- Bare `vitest run` (invoked directly, not via `pnpm test`) MUST exclude integration tests.
- `pnpm test:integration` MUST still run integration tests via a separate config.

### FR-2: Integration config file
- A new `vitest.config.integration.ts` MUST exist at the repo root.
- It MUST run tests under `tests/integration/**`.
- `test:integration` script MUST invoke it via `--config vitest.config.integration.ts`.

### FR-3: xlsx pool isolation via projects
- `vitest.config.ts` MUST define a `projects` array.
- One project MUST run the 4 xlsx test files (`tests/unit/lib/parse-templates-xlsx.test.ts`, `parse-users-xlsx.test.ts`, `sample-generators.test.ts`, `excel-export.test.ts`) with `pool: 'threads'`.
- The other project(s) MUST run all remaining unit tests with `pool: 'vmThreads'` (inherited default) and MUST exclude both `tests/integration/**` and the 4 xlsx files.
- Bare `vitest run` MUST execute both projects — i.e., xlsx tests run automatically in the default `pnpm test`.

### FR-4: Simplified package.json scripts
- `test` script MUST be `vitest run` (no `--exclude` flags, no second invocation).
- `test:unit` script MUST be `pnpm test` (alias, no duplicated long command).
- `test:watch` script MUST be `vitest` (no `--exclude` flags; runs xlsx tests via projects automatically).
- `test:coverage` script MUST be `vitest run --coverage` (no `--pool=threads` global override; no `--exclude` flags).
- `test:integration` script MUST be `vitest run --config vitest.config.integration.ts tests/integration`.

### FR-5: Documentation alignment
- `AGENTS.md` "Developer Commands" table MUST match the final scripts exactly.
- `AGENTS.md` "Testing Patterns" section MUST reflect that xlsx tests now run via the `projects` config (not a "separate `--pool=threads` invocation" in the script).
- `conductor/workflow.md` "Daily Development" + "Testing Requirements → Test Layout" sections MUST be updated to match (command descriptions accurate; the xlsx "handled automatically" note remains accurate but the mechanism is now projects).

## Non-Functional Requirements

### NFR-1: Performance — no regression
- `test:coverage` MUST use the `vmThreads` pool for unit tests (~50% faster than the current global `--pool=threads`). Only the 4 xlsx files run on `threads`.
- `test` (default) MUST use `vmThreads` for unit tests.

### NFR-2: No behavior change to what runs
- The set of tests executed by `pnpm test` MUST be identical before and after: all unit tests (including the 4 xlsx files), excluding integration.
- `pnpm test:watch` MUST now include the 4 xlsx tests (fixing the silent gap) — an intentional, desirable behavior change, not a regression.
- `pnpm test:integration` MUST run exactly the integration tests (unchanged set).

### NFR-3: Config file limits
- `vitest.config.ts` and `vitest.config.integration.ts` MUST each remain under 500 lines (enforced by `check-modularity.js`). In practice both will be well under 100 lines.

## Acceptance Criteria

- [ ] **AC-1:** Running bare `vitest run` (not via `pnpm test`) excludes integration tests. Verified by config `exclude` inspection + confirming no integration tests execute.
- [ ] **AC-2:** `pnpm test` passes and runs all unit tests including the 4 xlsx files (xlsx on `threads` pool, rest on `vmThreads`).
- [ ] **AC-3:** `pnpm test:coverage` passes with ≥80% on all four thresholds (lines/functions/branches/statements), uses `vmThreads` for unit tests (no global `--pool=threads`), and excludes integration tests.
- [ ] **AC-4:** `pnpm test:watch` excludes integration tests AND runs the 4 xlsx tests (no silent gap).
- [ ] **AC-5:** `pnpm test:integration` runs integration tests via `vitest.config.integration.ts`.
- [ ] **AC-6:** `package.json` `test` script is exactly `vitest run`; `test:unit` is exactly `pnpm test`; `test:watch` is exactly `vitest`; `test:coverage` is exactly `vitest run --coverage`; no `--exclude tests/integration/**` or global `--pool=threads` flags remain in any unit-test script.
- [ ] **AC-7:** `AGENTS.md` and `conductor/workflow.md` command descriptions match the final scripts; no stale references to "separate `--pool=threads` invocation" as a script mechanism.
- [ ] **AC-8:** `pnpm typecheck` clean; `pnpm lint` clean; all files under 500 lines; pre-push gate passes.

## Out of Scope

- Changing the default test pool from `vmThreads` to `threads` (vmThreads is ~50% faster; the 4 incompatible files are fixed via projects, not by downgrading the default).
- Adding new tests or changing coverage thresholds (≥80% on all four metrics remains).
- Integration test improvements beyond config/exclusion (no new integration tests, no integration test refactors).
- E2E test config changes (Playwright config is separate; `test:e2e` / `test:e2e:ui` scripts unchanged).
- Removing `test:unit` entirely (kept as alias per decision — only AGENTS.md/workflow.md descriptions updated, command name preserved).
- Any changes to the 4 xlsx test files' source or test logic (only their pool assignment changes).
