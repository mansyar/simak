<protect>
# Implementation Plan: Migrate to oxlint + oxfmt

## Phase 1: Install New Tools & Remove Old Dependencies

- [ ] Task: Read spec.md — Review requirements before starting implementation
- [ ] Task: Install oxlint and oxfmt as devDependencies
  - [ ] Run `pnpm add -D oxlint oxfmt`
- [ ] Task: Remove ESLint and Prettier packages
  - [ ] Run `pnpm remove eslint prettier @eslint/js typescript-eslint eslint-plugin-react eslint-plugin-react-hooks`
- [ ] Task: Verify packages installed correctly
  - [ ] Run `npx oxlint --version`
  - [ ] Run `npx oxfmt --version`
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Install New Tools & Remove Old Dependencies' (Protocol in workflow.md)

## Phase 2: Create Configuration Files

- [ ] Task: Read spec.md — Review FR-2, FR-3, FR-6 before configuring
- [ ] Task: Create oxlint config (`oxlintrc.json`)
  - [ ] Map existing ESLint rules to oxlint equivalents
  - [ ] Configure recommended + typescript + react strict rules
  - [ ] Set ignore patterns (node_modules, .output, dist, build, generated files, tests, scripts)
- [ ] Task: Create oxfmt config (`oxfmt.json`)
  - [ ] Match Prettier settings: semi=true, singleQuote=true, trailingComma=all, printWidth=100, tabWidth=2
  - [ ] Set ignore patterns from `.prettierignore`
- [ ] Task: Remove old config files
  - [ ] Delete `eslint.config.js`
  - [ ] Delete `.prettierrc`
  - [ ] Delete `.prettierignore`
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Create Configuration Files' (Protocol in workflow.md)

## Phase 3: Update Scripts & Hooks

- [ ] Task: Read spec.md — Review FR-4, FR-5 before updating
- [ ] Task: Update `package.json` scripts
  - [ ] Change `lint` script to `oxlint .`
  - [ ] Change `format` script to `oxfmt --write "src/**/*.{ts,tsx,css}"`
- [ ] Task: Update `lint-staged` config in `package.json`
  - [ ] `*.{ts,tsx}`: `oxlint --fix` + `oxfmt --write`
  - [ ] `*.{json,md,css}`: `oxfmt --write`
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Update Scripts & Hooks' (Protocol in workflow.md)

## Phase 4: Format, Lint & Fix

- [ ] Task: Read spec.md — Review FR-7, NFR-2, NFR-3 before running tools
- [ ] Task: Run oxfmt to reformat all source files
  - [ ] Run `pnpm format`
  - [ ] Verify no formatting errors
- [ ] Task: Run oxlint and fix all lint errors
  - [ ] Run `pnpm lint` to identify issues
  - [ ] Auto-fix what can be auto-fixed: `npx oxfmt --write` + `npx oxlint --fix`
  - [ ] Manually fix remaining lint errors
  - [ ] Iterate until `pnpm lint` exits 0
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Format, Lint & Fix' (Protocol in workflow.md)

## Phase 5: Verify Everything Works

- [ ] Task: Read spec.md — Review Acceptance Criteria before final verification
- [ ] Task: Run full verification suite
  - [ ] `pnpm lint` passes (exit 0)
  - [ ] `pnpm format` runs without errors
  - [ ] `pnpm typecheck` passes
  - [ ] `pnpm test` passes (all existing tests)
- [ ] Task: Verify lint-staged works on staged files
  - [ ] Stage a test file and verify hooks run oxlint + oxfmt
- [ ] Task: Update `tech-stack.md` to reflect oxlint + oxfmt
  - [ ] Change "ESLint + Prettier" to "oxlint + oxfmt" in Testing & Quality table
- [ ] Task: Conductor - User Manual Verification 'Phase 5: Verify Everything Works' (Protocol in workflow.md)
      </protect>
