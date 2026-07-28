<protect>
# Track: Developer Experience & Tooling Hygiene

## Overview

TRACK-036 resolves configuration mismatches between `lefthook.yml` (pre-commit/pre-push gates) and `package.json` (manual commands) identified as audit finding INFRA-10. Three tooling gates (lint, format, typecheck) have inconsistent glob scopes and flag sets, causing divergent behavior between the Lefthook automated gates and manual `pnpm` commands. Additionally, this track configures SocratiCode context artifacts to enable semantic search across project documentation and database migrations.

**Type:** Chore  
**Audit ID:** INFRA-10  
**Effort:** 1 Day / 0.5 Sprint Loops  
**Dependencies:** None (minor overlap with TRACK-035 on `package.json` — coordinate to avoid merge conflicts)

## Context Anchors

- **PRD Reference:** N/A
- **TDD Reference:** `lefthook.yml`, `package.json`, `AGENTS.md` → "Formatting Quirks"
- **Track Tech Stack:** `lefthook.yml`, `package.json`, `AGENTS.md`, `.socraticodecontextartifacts.json` (new)

## Functional Requirements

### FR-1: Format Glob Alignment

The format command (`oxfmt`) currently has two mismatches between lefthook and `package.json`:
- lefthook covers all dirs (`*.{js,jsx,ts,tsx}`) but misses `.css`
- `pnpm format` covers src only (`src/**/*.{ts,tsx,css}`) but includes `.css`

**Resolution:** Expand `pnpm format` to all dirs with the full extension set, and add `.css` to the lefthook format glob.

- **package.json `format` script:** Change from `oxfmt --write "src/**/*.{ts,tsx,css}"` to `oxfmt --write "*.{js,jsx,ts,tsx,css}"`
- **lefthook.yml `format` glob:** Change from `"*.{js,jsx,ts,tsx}"` to `"*.{js,jsx,ts,tsx,css}"`
- Both now cover all directories (`src/`, `tests/`, `scripts/`) with `.js`, `.jsx`, `.ts`, `.tsx`, and `.css` extensions

### FR-2: Lint Glob Alignment

The lint command (`oxlint`) has a scope mismatch:
- lefthook lints src only (`src/**/*.{js,jsx,ts,tsx}`)
- `pnpm lint` lints everything (`oxlint .`)

**Resolution:** Expand the lefthook lint glob to all dirs.

- **lefthook.yml `lint` glob:** Change from `"src/**/*.{js,jsx,ts,tsx}"` to `"*.{js,jsx,ts,tsx}"`
- `pnpm lint` stays as `oxlint .` (already covers all dirs)

### FR-3: Typecheck Flag Alignment

The typecheck command (`tsc`) has a flag mismatch:
- lefthook uses `--checkers 4` (TS 7 shared-memory multithreading)
- `pnpm typecheck` does not

**Resolution:** Add `--checkers 4` to the `pnpm typecheck` script.

- **package.json `typecheck` script:** Change from `tsc --noEmit --incremental` to `tsc --noEmit --incremental --checkers 4`

### FR-4: SocratiCode Context Artifacts Configuration

Create `.socraticodecontextartifacts.json` at the project root to enable semantic search across project documentation and database migrations. All 7 entries have been verified to exist on disk.

**Artifact entries:**
1. `conductor/product.md` — Product definition
2. `conductor/tech-stack.md` — Approved tech stack
3. `conductor/workflow.md` — TDD workflow, commit format, checkpoint protocol
4. `conductor/product-guidelines.md` — Product guidelines
5. `drizzle/migrations/` — Database migration SQL files (16 files)
6. `docs/PRD.md` — Product Requirements Document
7. `docs/TDD.md` — Technical Design Document

**Post-creation:** Run `codebase_context_index` to index artifacts into the vector database. Verify `codebase_context_search` returns relevant results.

### FR-5: AGENTS.md Documentation Update

Update `AGENTS.md` to reflect all configuration changes:
- **Developer Commands table:** Update `format` description to reflect all-dirs scope with `.css`. Update `typecheck` description to note `--checkers 4`.
- **Formatting Quirks section:** Update the `pnpm format` description from `src/**/*.{ts,tsx,css}` (not `tests/`) to the new all-dirs glob.
- **Pre-commit gate description:** Update to reflect expanded lint and format glob scopes.

## Non-Functional Requirements

- **No source code changes:** All changes are confined to configuration files (`lefthook.yml`, `package.json`, `AGENTS.md`, `.socraticodecontextartifacts.json`). No `src/` code changes.
- **Backward compatibility:** Expanding format/lint scope may surface new formatting/lint issues in `tests/` and `scripts/` files. If so, fix them in the same track (they are formatting-only changes, not logic changes).
- **No new dependencies:** This track adds no npm packages.
- **File limit:** All modified files must remain under 500 lines.

## Acceptance Criteria

- [ ] `lefthook.yml` format glob is `"*.{js,jsx,ts,tsx,css}"` (matches `pnpm format` scope)
- [ ] `package.json` `format` script is `oxfmt --write "*.{js,jsx,ts,tsx,css}"`
- [ ] `lefthook.yml` lint glob is `"*.{js,jsx,ts,tsx}"` (all dirs, matching `oxlint .` scope)
- [ ] `package.json` `typecheck` script includes `--checkers 4`
- [ ] `.socraticodecontextartifacts.json` exists at project root with 7 entries
- [ ] `codebase_context_index` successfully indexes all artifacts
- [ ] `codebase_context_search` returns relevant results for test queries
- [ ] `AGENTS.md` updated (Developer Commands table + Formatting Quirks + Pre-commit gate description)
- [ ] `pnpm test` passes (all existing tests)
- [ ] `pnpm typecheck` passes (with `--checkers 4`)
- [ ] `pnpm lint` passes
- [ ] `pnpm check:i18n` passes

## Out of Scope

- Test coverage thresholds (TRACK-035)
- Structured logging migration
- Pagination UI consolidation
- Any `src/` source code changes beyond formatting fixes surfaced by expanded glob scope
- Adding new lint rules or oxfmt configuration options
</protect>
