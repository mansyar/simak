# Implementation Plan: Project Scaffolding

## Phase 1: Project Initialization & Configuration

- [ ] Task: Initialize TanStack Start project with pnpm
    - [ ] Run `pnpm create @tanstack/start` or scaffold manually
    - [ ] Set up `pnpm-workspace.yaml`
    - [ ] Create `package.json` with all required dependencies and scripts
    - [ ] Create `tsconfig.json` with path aliases (`@/` → `src/`)
    - [ ] Install all dependencies via `pnpm install`
    - [ ] Create `app.config.ts` with TanStack Start configuration
    - [ ] Create `vite.config.ts` with React plugin and path aliases
    - [ ] Verify `pnpm run dev` starts without errors
- [ ] Task: Configure TypeScript, ESLint, and Prettier
    - [ ] Create `eslint.config.js` with TypeScript + React rules
    - [ ] Create `.prettierrc` (single quotes, trailing commas, 100 width)
    - [ ] Verify ESLint and Prettier work on a minimal file
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Project Initialization & Configuration' (Protocol in workflow.md)

## Phase 2: Docker & Environment Setup

- [ ] Task: Set up Docker Compose for local development
    - [ ] Create `docker-compose.yml` with PostgreSQL (port 5432) and optional PgAdmin
    - [ ] Create `docker/Dockerfile` with multi-stage build
    - [ ] Verify `docker compose up -d` starts PostgreSQL
    - [ ] Verify `docker build -t simak .` completes
- [ ] Task: Create environment configuration with Zod validation
    - [ ] Create `src/config/env.ts` with Zod-validated env schema
    - [ ] Create `.env.example` with all required variables and placeholders
    - [ ] Create `.gitignore` with appropriate ignore patterns
    - [ ] Verify env validation throws descriptive error when vars are missing
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Docker & Environment Setup' (Protocol in workflow.md)

## Phase 3: UI Foundation

- [ ] Task: Configure Tailwind CSS v4 and global styles
    - [ ] Create `src/app/global.css` with Tailwind v4 entry point
    - [ ] Define CSS custom properties for light/dark theme (colors, backgrounds, borders)
    - [ ] Create `components.json` for shadcn/ui configuration
    - [ ] Install base shadcn/ui primitives (Button, Input, Card)
    - [ ] Verify shadcn/ui components render with Tailwind styles
- [ ] Task: Create root layout with theme provider
    - [ ] Create `src/app/__root.tsx` with `<Outlet />`, Query provider, ThemeProvider
    - [ ] Create `src/app/index.tsx` with placeholder redirect
    - [ ] Verify light/dark mode toggle works on placeholder page
- [ ] Task: Conductor - User Manual Verification 'Phase 3: UI Foundation' (Protocol in workflow.md)

## Phase 4: i18n & Localization

- [ ] Task: Set up typesafe-i18n infrastructure
    - [ ] Create `src/i18n/index.ts` with locale detection (browser → user preference → fallback)
    - [ ] Create `scripts/generate-i18n-types.ts` for type generation
    - [ ] Create `locales/en.json` with starter English translations
    - [ ] Create `locales/id.json` with starter Indonesian translations
    - [ ] Integrate i18n type generation into dev/build scripts
- [ ] Task: Create language switcher component
    - [ ] Create `src/components/layout/language-switcher.tsx` with dropdown/toggle
    - [ ] Verify language switching works on the placeholder page
    - [ ] Verify `t('key')` is type-safe from the first component
- [ ] Task: Conductor - User Manual Verification 'Phase 4: i18n & Localization' (Protocol in workflow.md)

## Phase 5: Git Hooks & Quality Tooling

- [ ] Task: Set up Husky and lint-staged
    - [ ] Configure Husky with `pnpm prepare` script
    - [ ] Create `.husky/pre-commit` to run `pnpm lint-staged`
    - [ ] Create `.husky/pre-push` to run typecheck + tests
    - [ ] Create `lint-staged.config.js` (eslint --fix, prettier --write, tsc --noEmit)
- [ ] Task: Create modularity check script
    - [ ] Create `scripts/check-modularity.ts` enforcing max 500 lines per file
    - [ ] Integrate into lint-staged config
    - [ ] Verify commit is blocked if a source file exceeds 500 lines
- [ ] Task: Conductor - User Manual Verification 'Phase 5: Git Hooks & Quality Tooling' (Protocol in workflow.md)

## Phase 6: Testing Infrastructure

- [ ] Task: Set up Vitest for unit and integration tests
    - [ ] Configure vitest in `vite.config.ts` (globals: true, jsdom environment, setup files, coverage)
    - [ ] Create test for locale detection chain (browser → preference → fallback)
    - [ ] Create test for translation key parity (en.json === id.json)
    - [ ] Verify tests run and pass via `pnpm vitest run`
    - [ ] Verify coverage reporting works
- [ ] Task: Set up Playwright for E2E tests
    - [ ] Create `playwright.config.ts` with chromium + firefox targets
    - [ ] Configure webServer to auto-start dev server
    - [ ] Verify `pnpm exec playwright install` installs browser binaries
    - [ ] Verify `pnpm exec playwright test --list` shows available projects
- [ ] Task: Conductor - User Manual Verification 'Phase 6: Testing Infrastructure' (Protocol in workflow.md)

## Final Deliverables

- [ ] Verify `pnpm run dev` starts without errors and hot-reloads on changes
- [ ] Verify `pnpm run build` produces a production build end-to-end
- [ ] Verify full git hook chain: commit triggers lint-staged, push triggers full checks
- [ ] Verify all quality gates pass (>80% coverage, no lint errors, typecheck passes)
