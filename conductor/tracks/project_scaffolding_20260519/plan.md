# Implementation Plan: Project Scaffolding

## Phase 1: Project Initialization & Configuration [checkpoint: ef56cae]

- [x] Task: Scaffold TanStack Start project using `pnpm create @tanstack/start` [commit: d0f3398] [note: CLI template registry unavailable; manually scaffolded from scratch per build-from-scratch guide]
  - [x] Manually scaffolded project from scratch (CLI template registry unavailable)
  - [x] Project root has clean structure (no nested project directory, no boilerplate)
  - [x] Create `package.json` with correct dependencies
  - [x] Create `tsconfig.json` with path aliases (`@/` → `src/`), vitest types included
  - [x] Install all dependencies via `pnpm install`
  - [x] Create `app.config.ts` with TanStack Start configuration
  - [x] Create `vite.config.ts` with React plugin, path aliases, Tailwind v4, vitest config
  - [x] Verify `pnpm run dev` starts without errors on port 3000
- [x] Task: Configure TypeScript, ESLint, and Prettier [commit: d0f3398]
  - [x] Create `eslint.config.js` with TypeScript + React rules, `@/` alias resolution, import ordering
  - [x] Create `.prettierrc` (single quotes, trailing commas, 100 print width, compatible with ESLint)
  - [x] Verify TypeScript typecheck passes (`pnpm typecheck` - no errors)
  - [x] Verify tests pass with coverage (`pnpm test:coverage` - 22 tests, 100% coverage)
- [x] Task: Conductor - User Manual Verification 'Phase 1: Project Initialization & Configuration' [commit: bb08fc2]

## Phase 2: Docker & Environment Setup

- [x] Task: Set up Docker Compose for local development [commit: f47ac81]
  - [x] Create `docker-compose.yml` with PostgreSQL (port 5432) and optional PgAdmin
  - [x] Add volumes for data persistence
  - [x] Create `docker/Dockerfile` with multi-stage build (builder + slim runner, expose port 3000)
  - [x] Note added: Copy `.env.example` to `.env` before running Docker Compose
- [x] Task: Create environment configuration with Zod validation [commit: f47ac81]
  - [x] Create `src/config/env.ts` with Zod-validated env schema
  - [x] Create `.env.example` with all required variables and placeholder values
  - [x] Create `.gitignore`
  - [x] Verify env validation throws descriptive error when `DATABASE_URL` is missing (tested)
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Docker & Environment Setup'

## Phase 3: Styling & UI Primitives

- [x] Task: Configure Tailwind CSS v4 and global styles [commit: f47ac81]
  - [x] Create `src/app/global.css` with Tailwind v4 entry point: `@import "tailwindcss"`
  - [x] Define CSS custom properties for light/dark theme (22 oklch() tokens)
  - [x] Register Tailwind v4 dark mode variant (class-based: `.dark` selector)
- [x] Task: Initialize shadcn/ui and install base primitives [commit: f47ac81]
  - [x] Run `npx shadcn@latest init` — completed successfully (TanStack Start detected)
  - [x] `components.json` created (style: default, baseColor: zinc, alias: @/ → src/)
  - [x] Installed base primitives: button, input, card
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Styling & UI Primitives'

## Phase 4: i18n & Localization

- [x] Task: Set up typesafe-i18n infrastructure [commit: f47ac81]
  - [x] Create `src/i18n/index.ts` with locale detection chain
  - [x] Create `scripts/generate-i18n-types.ts`
  - [x] Integrated i18n type generation into dev and build scripts
  - [x] Added `generate:i18n` script
  - [x] Create `locales/en.json` with starter English translations
  - [x] Create `locales/id.json` with starter Indonesian translations
- [ ] Task: Conductor - User Manual Verification 'Phase 4: i18n & Localization'

## Phase 5: Root Layout & Core Components

- [x] Task: Create theme system [commit: f47ac81]
  - [x] Create `src/hooks/use-theme.ts`: manages light/dark state, localStorage, system preference
  - [x] Create `src/components/layout/theme-toggle.tsx`: sun/moon icon button
- [x] Task: Create root layout with all providers [commit: f47ac81]
  - [x] Create `src/app/__root.tsx` with Outlet, QueryClientProvider, I18nContext provider, ThemeScript
  - [x] Dark class applied to `<html>` via ThemeScript (prevents flash)
  - [x] Skip-to-content link as first focusable element (WCAG)
- [x] Task: Create root route and language switcher [commit: f47ac81]
  - [x] Create `src/app/index.tsx`: placeholder page with SIMAK branding
  - [x] Create `src/components/layout/language-switcher.tsx`: EN/ID toggle
- [x] Task: Verify core UI integration
  - [x] Theme toggle function tested (22 unit tests pass)
  - [x] Language switching function tested (component tests pass)
  - [x] TypeScript typecheck passes
- [ ] Task: Conductor - User Manual Verification 'Phase 5: Root Layout & Core Components'

## Phase 6: Git Hooks & Quality Tooling

- [x] Task: Set up Husky and lint-staged [commit: f47ac81]
  - [x] Husky initialized via `pnpm prepare`
  - [x] `.husky/pre-commit` created: runs `pnpm lint-staged`
  - [x] `.husky/pre-push` created: runs `pnpm typecheck && pnpm vitest run --coverage`
  - [x] lint-staged config in package.json: eslint --fix, prettier --write
  - [x] Verified `git commit` triggers lint-staged (confirmed on two commits)
- [x] Task: Create modularity check script [commit: f47ac81]
  - [x] Create `scripts/check-modularity.ts` enforcing max 500 lines per source file
  - [x] Integrated into lint-staged config
- [ ] Task: Conductor - User Manual Verification 'Phase 6: Git Hooks & Quality Tooling'

## Phase 7: Testing Infrastructure

- [x] Task: Finalize Vitest configuration and write unit tests [commit: f47ac81]
  - [x] Vitest config finalized (globals, jsdom, coverage v8, 80% thresholds)
  - [x] 6 test files created: locale-resolution, translation-coverage, env validation, use-theme, ThemeToggle, LanguageSwitcher
  - [x] 22 tests pass via `pnpm vitest run`
  - [x] Coverage reporting works (100% on tracked files)
- [ ] Task: Conductor - User Manual Verification 'Phase 7: Testing Infrastructure'

## Final Deliverables

- [ ] Verify `pnpm run dev` starts without errors and hot-reloads on file changes
- [ ] Verify `pnpm run build` produces a production build end-to-end
- [ ] Verify full git hook chain: commit triggers lint-staged, push triggers typecheck + vitest
- [ ] Verify all quality gates pass (>80% coverage, no lint errors, typecheck passes)
- [ ] Verify dark mode toggle, language switcher, and i18n type-safety all work together
