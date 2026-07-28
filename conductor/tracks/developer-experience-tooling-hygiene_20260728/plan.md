<protect>
# Implementation Plan: Developer Experience & Tooling Hygiene

## Phase 1: Configuration Alignment [checkpoint: pending]

- [x] Task: Read `spec.md` and `workflow.md` to establish context
    - [x] Read `./spec.md` for track requirements and acceptance criteria
    - [x] Read `../../workflow.md` for TDD lifecycle and phase completion protocol
- [x] Task: Align format, lint, and typecheck configuration in `lefthook.yml` and `package.json`
    - [x] Update `package.json` `format` script: `oxfmt --write "src/**/*.{ts,tsx,css}"` → `oxfmt --write "*.{js,jsx,ts,tsx,css}"`
    - [x] Update `lefthook.yml` `format` glob: `"*.{js,jsx,ts,tsx}"` → `"*.{js,jsx,ts,tsx,css}"`
    - [x] Update `lefthook.yml` `lint` glob: `"src/**/*.{js,jsx,ts,tsx}"` → `"*.{js,jsx,ts,tsx}"`
    - [x] Update `package.json` `typecheck` script: `tsc --noEmit --incremental` → `tsc --noEmit --incremental --checkers 4`
- [x] Task: Update `AGENTS.md` documentation
    - [x] Update Developer Commands table: `format` row to reflect all-dirs scope with `.css`; `typecheck` row to note `--checkers 4`
    - [x] Update Formatting Quirks section: `pnpm format` description from `src/**/*.{ts,tsx,css}` (not `tests/`) to `*.{js,jsx,ts,tsx,css}` (all dirs)
    - [x] Update Pre-commit gate description: reflect expanded lint and format glob scopes
- [x] Task: Verify quality gates
    - [ ] Run `pnpm format` — verify it covers all dirs (src, tests, scripts) with `.css`; fix any formatting issues surfaced by expanded scope
    - [ ] Run `pnpm typecheck` — verify `--checkers 4` works, no type errors
    - [ ] Run `pnpm lint` — verify expanded scope, fix any new lint issues in `tests/`/`scripts/`
    - [ ] Run `pnpm test` — all existing tests pass
    - [ ] Run `pnpm check:i18n` — i18n parity maintained
- [x] Task: Commit configuration alignment changes [7b833c1]
    - [ ] Stage `lefthook.yml`, `package.json`, `AGENTS.md` + any formatting fixes in `tests/`/`scripts/`
    - [ ] Commit with message `chore(tooling): Align lefthook/package.json format, lint, typecheck configs`
    - [ ] Attach git note with task summary
- [x] Task: Conductor - User Manual Verification 'Configuration Alignment' (Protocol in workflow.md)

## Phase 2: SocratiCode Context Artifacts

- [ ] Task: Read `spec.md` and `workflow.md` to establish context
    - [ ] Read `./spec.md` for track requirements and acceptance criteria
    - [ ] Read `../../workflow.md` for TDD lifecycle and phase completion protocol
- [ ] Task: Create `.socraticodecontextartifacts.json`
    - [ ] Create `.socraticodecontextartifacts.json` at project root with 7 artifact entries (`conductor/product.md`, `conductor/tech-stack.md`, `conductor/workflow.md`, `conductor/product-guidelines.md`, `drizzle/migrations/`, `docs/PRD.md`, `docs/TDD.md`)
- [ ] Task: Index artifacts and verify semantic search
    - [ ] Run `codebase_context_index` to index artifacts into the vector database
    - [ ] Run `codebase_context_search` with test queries (e.g., "authentication setup", "database schema") and verify relevant results are returned from indexed artifacts
- [ ] Task: Verify quality gates
    - [ ] Run `pnpm test` — all existing tests pass
    - [ ] Run `pnpm typecheck` — clean
    - [ ] Run `pnpm lint` — clean
- [ ] Task: Commit SocratiCode artifacts configuration
    - [ ] Stage `.socraticodecontextartifacts.json`
    - [ ] Commit with message `chore(tooling): Configure SocratiCode context artifacts`
    - [ ] Attach git note with task summary
- [ ] Task: Conductor - User Manual Verification 'SocratiCode Context Artifacts' (Protocol in workflow.md)
</protect>
