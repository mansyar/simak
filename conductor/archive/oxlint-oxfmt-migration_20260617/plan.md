<protect>
# Implementation Plan: Migrate to oxlint + oxfmt

## Phase 1: Install New Tools & Remove Old Dependencies [~]

- [x] Task: Read spec.md — Review requirements before starting implementation
- [x] Task: Install oxlint and oxfmt as devDependencies
  - [x] Run `pnpm add -D oxlint oxfmt`
- [x] Task: Remove ESLint and Prettier packages
  - [x] Run `pnpm remove eslint prettier @eslint/js typescript-eslint eslint-plugin-react eslint-plugin-react-hooks`
- [x] Task: Verify packages installed correctly
  - [x] Run `npx oxlint --version` → 1.70.0
  - [x] Run `npx oxfmt --version` → 0.55.0
- [x] Task: Conductor - User Manual Verification 'Phase 1: Install New Tools & Remove Old Dependencies' (Protocol in workflow.md)

## Phase 2: Create Configuration Files [~]

- [x] Task: Read spec.md — Review FR-2, FR-3, FR-6 before configuring
- [x] Task: Create oxlint config (`oxlintrc.json`)
  - [x] Map existing ESLint rules to oxlint equivalents
  - [x] Configure recommended + typescript + react strict rules
  - [x] Set ignore patterns (node_modules, .output, dist, build, generated files, tests, scripts)
- [x] Task: Create oxfmt config (`oxfmt.json`)
  - [x] Match Prettier settings: semi=true, singleQuote=true, trailingComma=all, printWidth=100, tabWidth=2
  - [x] Set ignore patterns from `.prettierignore`
- [x] Task: Remove old config files
  - [x] Delete `eslint.config.js`
  - [x] Delete `.prettierrc`
  - [x] Delete `.prettierignore`
- [x] Task: Conductor - User Manual Verification 'Phase 2: Create Configuration Files' (Protocol in workflow.md)

## Phase 3: Update Scripts & Hooks [~]

- [x] Task: Read spec.md — Review FR-4, FR-5 before updating
- [x] Task: Update `package.json` scripts
  - [x] Change `lint` script to `oxlint .`
  - [x] Change `format` script to `oxfmt --write "src/**/*.{ts,tsx,css}"`
- [x] Task: Update `lint-staged` config in `package.json`
  - [x] `*.{ts,tsx}`: `oxlint --fix` + `oxfmt --write`
  - [x] `*.{json,md,css}`: `oxfmt --write`
- [x] Task: Conductor - User Manual Verification 'Phase 3: Update Scripts & Hooks' (Protocol in workflow.md)

## Phase 4: Format, Lint & Fix [~]

- [x] Task: Read spec.md — Review FR-7, NFR-2, NFR-3 before running tools
- [x] Task: Run oxfmt to reformat all source files
  - [x] Run `pnpm format` → 195 files formatted, config picked up from `.oxfmtrc.json`
  - [x] Verify no formatting errors
- [x] Task: Run oxlint and fix all lint errors
  - [x] Run `pnpm lint` to identify issues → 47 warnings, 0 errors, exit 0
  - [x] Auto-fix what can be auto-fixed: `npx oxfmt --write` + `npx oxlint --fix`
  - [x] Manually fix remaining lint errors
  - [x] Iterate until `pnpm lint` exits 0
- [x] Task: Conductor - User Manual Verification 'Phase 4: Format, Lint & Fix' (Protocol in workflow.md)

## Phase 5: Verify Everything Works [~]

- [x] Task: Read spec.md — Review Acceptance Criteria before final verification
- [x] Task: Run full verification suite
  - [x] `pnpm lint` passes (exit 0)
  - [x] `pnpm format` runs without errors
  - [x] `pnpm typecheck` passes
  - [x] `pnpm test` passes (all existing tests — 184 files, 1753 tests)
- [x] Task: Verify lint-staged works on staged files
  - [x] Stage a test file and verify hooks run oxlint + oxfmt
- [x] Task: Update `tech-stack.md` to reflect oxlint + oxfmt
  - [x] Change "ESLint + Prettier" to "oxlint + oxfmt" in Testing & Quality table
- [x] Task: Conductor - User Manual Verification 'Phase 5: Verify Everything Works' (Protocol in workflow.md)
      </protect>
