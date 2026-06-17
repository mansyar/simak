<protect>
# Specification: Migrate to oxlint + oxfmt

## Overview

Migrate the project's code quality tooling from ESLint + Prettier to oxlint + oxfmt (part of the Oxc toolchain). Full replacement — remove all ESLint and Prettier dependencies, configs, and scripts. Update husky/lint-staged hooks to use the new tools.

## Functional Requirements

### FR-1: Install oxlint and oxfmt

- Install `oxlint` and `oxfmt` as devDependencies
- Remove `eslint`, `prettier`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react`, `eslint-plugin-react-hooks` from devDependencies

### FR-2: Create oxlint configuration

- Create `oxlintrc.json` config file
- Enable recommended rules + typescript + react strict rules (no nursery)
- Map existing ESLint rules:
  - `react/react-in-jsx-scope: off` → already off by default in oxlint
  - `react/prop-types: off` → already off by default in oxlint
  - `react-hooks/rules-of-hooks: error` → enable in oxlint
  - `react-hooks/exhaustive-deps: warn` → enable in oxlint
  - `@typescript-eslint/no-unused-vars: warn` (ignore `^_` pattern) → enable with same pattern
  - `@typescript-eslint/no-explicit-any: warn` → enable in oxlint
- Carry over ignore patterns from ESLint config: `node_modules/`, `.output/`, `dist/`, `build/`, `src/routeTree.gen.ts`, `src/i18n/detect-locale.ts`, `src/i18n/types.ts`, `tests/**`, `scripts/**`

### FR-3: Create oxfmt configuration

- Create `oxfmt.json` config file
- Match existing Prettier settings:
  - `semi: true`
  - `singleQuote: true`
  - `trailingComma: all`
  - `printWidth: 100`
  - `tabWidth: 2`
- Carry over ignore patterns from `.prettierignore`

### FR-4: Update package.json scripts

- `lint`: `eslint .` → `oxlint .`
- `format`: `prettier --write "src/**/*.{ts,tsx,css}"` → `oxfmt --write "src/**/*.{ts,tsx,css}"`

### FR-5: Update lint-staged config

- `*.{ts,tsx}` stage: replace `eslint --fix` with `oxlint --fix`, replace `prettier --write` with `oxfmt --write`
- `*.{json,md,css}` stage: replace `prettier --write` with `oxfmt --write`

### FR-6: Remove old config files

- Delete `eslint.config.js`
- Delete `.prettierrc`
- Delete `.prettierignore`

### FR-7: Run formatter and fix lint issues

- Run `oxfmt --write` to reformat all source files
- Run `oxlint --fix` to auto-fix lint issues
- Manually fix remaining lint errors until `oxlint .` passes clean

## Non-Functional Requirements

- **NFR-1:** All existing tests must continue to pass after migration
- **NFR-2:** `pnpm lint` must exit 0 (no lint errors)
- **NFR-3:** `pnpm format` must exit 0
- **NFR-4:** `pnpm typecheck` must still pass

## Acceptance Criteria

- [ ] `oxlint .` passes with zero errors
- [ ] `oxfmt --check .` passes (all files formatted)
- [ ] `pnpm lint` uses oxlint and passes
- [ ] `pnpm format` uses oxfmt and works
- [ ] lint-staged runs oxlint + oxfmt on commit
- [ ] No ESLint or Prettier packages in `node_modules`
- [ ] No `eslint.config.js`, `.prettierrc`, or `.prettierignore` files exist
- [ ] All existing tests pass
- [ ] TypeScript type-check passes

## Out of Scope

- CI/CD pipeline changes (if any)
- Adding oxlint/oxfmt to Docker build
- Migrating IDE settings (VS Code extensions)
  </protect>
