<protect>
# Implementation Plan: TRACK-035 — Test Infrastructure Consolidation

> **Spec:** `./spec.md` (approved)  
> **Workflow:** `../../workflow.md` — Standard Task Workflow + Phase Completion Verification & Checkpointing Protocol  
> **TDD note for config:** Deliverables are configuration files (`vitest.config.ts`, `vitest.config.integration.ts`, `package.json`) and documentation (`AGENTS.md`, `conductor/workflow.md`). Per the workflow's Phase Completion Protocol, non-code/config files are excluded from the unit-test requirement. `vitest.config.ts` is a configuration object with no application logic (analogous to `package.json`); verification is **behavioral** (run the vitest commands and observe outcomes), not unit-test-based. This is a deliberate simplicity decision — no artificial tests for config object literals, and these files are outside the coverage `include: ['src/**/*.{ts,tsx}']` scope anyway.

## Phase 1: Vitest Config & Script Consolidation [checkpoint: 3a1e360]

- [x] Task: Read `./spec.md` and `../../workflow.md` to re-establish context for this phase

- [x] Task: Restructure `vitest.config.ts` to use a `projects` array [e6a1085]
    - [x] Hoist shared config (resolve.alias `@`, extensions, globals, environment `happy-dom`, env loading, onConsoleLog, reporters, coverage block with ≥80% thresholds) so both projects inherit it
    - [x] Add **unit project**: `pool: 'vmThreads'` (inherited), `include: ['tests/**/*.test.{ts,tsx}']`, `exclude: ['node_modules', 'dist', 'tests/integration/**', 'tests/unit/lib/parse-templates-xlsx.test.ts', 'tests/unit/lib/parse-users-xlsx.test.ts', 'tests/unit/lib/sample-generators.test.ts', 'tests/unit/lib/excel-export.test.ts']`
    - [x] Add **xlsx project**: `pool: 'threads'`, `include: ['tests/unit/lib/parse-templates-xlsx.test.ts', 'tests/unit/lib/parse-users-xlsx.test.ts', 'tests/unit/lib/sample-generators.test.ts', 'tests/unit/lib/excel-export.test.ts']`, `exclude: ['node_modules', 'dist']`
    - [x] Smoke-verify config parses & both projects are discovered: `pnpm exec vitest run --no-coverage` (expect unit tests run on vmThreads, xlsx on threads)

- [x] Task: Create `vitest.config.integration.ts` [e6a1085]
    - [x] Minimal config sharing base settings (alias `@`, env loading, globals, environment `happy-dom`) with the main config — extract a shared base module if it avoids drift, otherwise standalone ~15-line config
    - [x] `include: ['tests/integration/**/*.test.{ts,tsx}']`, `exclude: ['node_modules', 'dist']`, pool inherited (`vmThreads`, matching current behavior)
    - [x] Smoke-verify it loads: `pnpm exec vitest run --config vitest.config.integration.ts --no-coverage` (confirm config parses; full run needs DB)

- [x] Task: Simplify `package.json` test scripts [e6a1085]
    - [x] Set `test` to `vitest run`
    - [x] Set `test:unit` to `pnpm test` (thin alias)
    - [x] Set `test:watch` to `vitest`
    - [x] Set `test:coverage` to `vitest run --coverage` (remove `--pool=threads` global override and all `--exclude` flags)
    - [x] Set `test:integration` to `vitest run --config vitest.config.integration.ts tests/integration`
    - [x] Leave `test:e2e`, `test:e2e:ui` unchanged (Playwright — out of scope)

- [x] Task: Behavioral verification of consolidated config + scripts
    - [x] **AC-1:** Run bare `pnpm exec vitest run` (not `pnpm test`) → confirm integration tests excluded (no `tests/integration/**` executes)
    - [x] **AC-2:** Run `pnpm test` → all unit tests pass including the 4 xlsx files (xlsx on `threads`, rest on `vmThreads`)
    - [x] **AC-4:** Run `pnpm test:watch` briefly → confirm the 4 xlsx tests run (no silent gap); exit watch
    - [x] Confirm no `--exclude tests/integration/**` or global `--pool=threads` flags remain in `test`/`test:unit`/`test:watch`/`test:coverage` scripts

- [x] Task: Conductor - User Manual Verification 'Phase 1: Vitest Config & Script Consolidation' (Protocol in workflow.md)

## Phase 2: Documentation Alignment & Final DoD

- [x] Task: Read `./spec.md` and `../../workflow.md` to re-establish context for this phase

- [x] Task: Update `AGENTS.md` [d2fe77cb]
    - [x] "Developer Commands" table: `pnpm test` → `vitest run` (unit tests; excludes integration; xlsx tests run via `projects`); `pnpm test:unit` → alias of `pnpm test`; `pnpm test:watch` → `vitest`; `pnpm test:coverage` → `vitest run --coverage` (vmThreads default for unit; excludes integration); `pnpm test:integration` → `vitest run --config vitest.config.integration.ts tests/integration`
    - [x] "Testing Patterns" note: replace "A small set of xlsx-parsing tests run in a separate `--pool=threads` invocation (see the test script in package.json) — this is handled automatically" with: xlsx tests run via the `projects` array in `vitest.config.ts` (xlsx project uses `threads` pool) — still automatic, mechanism changed to config
    - [x] Pre-push gate note: correct `pnpm vitest run --coverage` → `pnpm test:coverage` (matches `lefthook.yml` exactly); the "also excludes integration via `vitest.config.ts`" claim becomes TRUE after this change (currently it's via script flag)

- [x] Task: Update `conductor/workflow.md` [d2fe77cb]
    - [x] "Daily Development" block: fix `pnpm test` comment — "excludes integration + xlsx-threaded tests" is now inaccurate (xlsx tests ARE included via `projects`); correct to "excludes integration; xlsx tests run via `projects` config"
    - [x] "Testing Requirements → Test Layout": update the xlsx note from "separate `--pool=threads` invocation (see the test script in package.json)" to "xlsx project in `vitest.config.ts` `projects` array (pool: `threads`)"
    - [x] Pre-push gate block: align `pnpm typecheck && pnpm vitest run --coverage` → `pnpm typecheck && pnpm test:coverage` (match `lefthook.yml`)

- [x] Task: Final Definition of Done verification
    - [x] **AC-3:** Run `pnpm test:coverage` → passes ≥80% on all four thresholds, uses `vmThreads` for unit (no global `--pool=threads`), excludes integration; confirm xlsx tests counted in coverage
    - [x] **AC-5:** Run `pnpm test:integration` → runs integration tests via `vitest.config.integration.ts` (requires `docker compose up -d`)
    - [x] **AC-8:** Run `pnpm typecheck` → clean; `pnpm lint` → clean; run `node scripts/check-modularity.js` on changed files → all under 500 lines; `pnpm check:i18n` sanity (no i18n changes expected)
    - [x] Final review of `package.json` scripts against FR-4 (exact script strings) and confirm `lefthook.yml` unchanged (TRACK-036 territory)

- [ ] Task: Conductor - User Manual Verification 'Phase 2: Documentation Alignment & Final DoD' (Protocol in workflow.md)
</protect>
