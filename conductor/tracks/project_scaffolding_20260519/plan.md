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

- [ ] Task: Set up Docker Compose for local development
  - [ ] Create `docker-compose.yml` with PostgreSQL (port 5432) and optional PgAdmin
  - [ ] Add volumes for data persistence
  - [ ] Create `docker/Dockerfile` with multi-stage build (builder + slim runner, expose port 3000)
  - [ ] **Note:** Copy `.env.example` to `.env` before running Docker Compose (postgres credentials live in `.env`)
  - [ ] Verify `docker compose up -d` starts PostgreSQL
  - [ ] Verify `docker build -t simak .` completes
- [ ] Task: Create environment configuration with Zod validation
  - [ ] Create `src/config/env.ts` with Zod-validated env schema (`DATABASE_URL`, `R2_*`, `RESEND_API_KEY`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`)
  - [ ] Create `.env.example` with all required variables and placeholder values (DATABASE_URL points to `localhost:5432`)
  - [ ] Create `.gitignore` (ignore: `node_modules/`, `.env`, `.output/`, `dist/`, `build/`, `.husky/_/`, `coverage/`, `*.tsbuildinfo`, `.turbo/`)
  - [ ] Verify env validation throws descriptive error when `DATABASE_URL` is missing
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Docker & Environment Setup' (Protocol in workflow.md)

## Phase 3: Styling & UI Primitives

- [ ] Task: Configure Tailwind CSS v4 and global styles
  - [ ] Create `src/app/global.css` with Tailwind v4 entry point: `@import "tailwindcss"`
  - [ ] Define CSS custom properties for light/dark theme (see spec for full token table — background, foreground, primary, muted, border, ring, success, warning, error, info, etc. in `oklch()`)
  - [ ] Register Tailwind v4 dark mode variant (class-based: `.dark` selector + `@media (prefers-color-scheme: dark)` for initial load)
  - [ ] Verify Tailwind utility classes work on a test element (both light and dark mode)
- [ ] Task: Initialize shadcn/ui and install base primitives
  - [ ] Run `npx shadcn@latest init -d` with default options (generates `components.json`, `src/lib/utils.ts`, updates `global.css`)
  - [ ] Verify `components.json` matches spec (style: "default", baseColor: "zinc", alias: "@/" → "src/")
  - [ ] Install base primitives: `npx shadcn@latest add button input card`
  - [ ] Verify shadcn/ui components render correctly with Tailwind styles
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Styling & UI Primitives' (Protocol in workflow.md)

## Phase 4: i18n & Localization

- [ ] Task: Set up typesafe-i18n infrastructure
  - [ ] Create `src/i18n/index.ts` with locale detection chain: browser `navigator.language` → user preference → fallback to `en`
  - [ ] Create `scripts/generate-i18n-types.ts` to generate TypeScript types from locale JSON files
  - [ ] Integrate i18n type generation into dev script (`"dev": "pnpm generate:i18n && vinxi dev"`) and build script (`"build": "pnpm generate:i18n && vinxi build"`)
  - [ ] Add script: `"generate:i18n": "tsx scripts/generate-i18n-types.ts"`
  - [ ] Create `locales/en.json` with starter English translations (login, navigation, common actions, errors)
  - [ ] Create `locales/id.json` with starter Indonesian translations (same keys as en.json)
- [ ] Task: Conductor - User Manual Verification 'Phase 4: i18n & Localization' (Protocol in workflow.md)

## Phase 5: Root Layout & Core Components

- [ ] Task: Create theme system
  - [ ] Create `src/hooks/use-theme.ts`: manages light/dark state, persists to localStorage, detects system preference via `prefers-color-scheme`, exposes `theme` + `setTheme` + `toggleTheme`
  - [ ] Create `src/components/layout/theme-toggle.tsx`: icon button (sun/moon) that calls `toggleTheme()`
- [ ] Task: Create root layout with all providers
  - [ ] Create `src/app/__root.tsx` with: `<Outlet />`, TanStack Query provider, ThemeProvider (from use-theme hook), i18n provider
  - [ ] Apply dark class to `<html>` element based on theme state
  - [ ] Add skip-to-content link as first focusable element (WCAG)
- [ ] Task: Create root route and language switcher
  - [ ] Create `src/app/index.tsx`: redirect to `/dashboard` if authenticated, `/auth/login` otherwise
  - [ ] Create `src/components/layout/language-switcher.tsx`: dropdown/toggle to switch between EN and ID locales
- [ ] Task: Verify core UI integration
  - [ ] Verify light/dark mode toggle switches theme and persists across page reload
  - [ ] Verify language switching changes UI text on the placeholder page
  - [ ] Verify `t('key')` is type-safe from the first component
- [ ] Task: Conductor - User Manual Verification 'Phase 5: Root Layout & Core Components' (Protocol in workflow.md)

## Phase 6: Git Hooks & Quality Tooling

- [ ] Task: Set up Husky and lint-staged
  - [ ] Run `pnpm prepare` to initialize Husky (auto-activates git hooks on install via `"prepare": "husky"` in package.json)
  - [ ] Create `.husky/pre-commit` to run `pnpm lint-staged`
  - [ ] Create `.husky/pre-push` to run `pnpm typecheck && pnpm vitest run --coverage` (no Playwright — E2E deferred to v2)
  - [ ] Create `lint-staged.config.js` to run on staged files: `eslint --fix`, `prettier --write`, `tsc --noEmit` (incremental)
  - [ ] Verify `git commit` triggers lint-staged and fails if lint/typecheck/modularity checks fail
  - [ ] Verify `git push` triggers typecheck and vitest
- [ ] Task: Create modularity check script
  - [ ] Create `scripts/check-modularity.ts` enforcing max 500 lines per source file (uses `tsx` to run)
  - [ ] Integrate into lint-staged config
  - [ ] Verify commit is blocked if a source file exceeds 500 lines
- [ ] Task: Conductor - User Manual Verification 'Phase 6: Git Hooks & Quality Tooling' (Protocol in workflow.md)

## Phase 7: Testing Infrastructure

- [ ] Task: Finalize Vitest configuration and write unit tests
  - [ ] Finalize vitest config in `vite.config.ts` (globals: true, jsdom environment, setup files, coverage provider)
  - [ ] Create `tests/unit/i18n/locale-resolution.test.ts`: test locale detection chain (browser → user preference → fallback to `en`)
  - [ ] Create `tests/unit/i18n/translation-coverage.test.ts`: verify `id.json` has all keys from `en.json`
  - [ ] Verify tests run and pass via `pnpm vitest run`
  - [ ] Verify coverage reporting works (>80% threshold)
- [ ] Task: Conductor - User Manual Verification 'Phase 7: Testing Infrastructure' (Protocol in workflow.md)

## Final Deliverables

- [ ] Verify `pnpm run dev` starts without errors and hot-reloads on file changes
- [ ] Verify `pnpm run build` produces a production build end-to-end
- [ ] Verify full git hook chain: commit triggers lint-staged, push triggers typecheck + vitest
- [ ] Verify all quality gates pass (>80% coverage, no lint errors, typecheck passes)
- [ ] Verify dark mode toggle, language switcher, and i18n type-safety all work together
