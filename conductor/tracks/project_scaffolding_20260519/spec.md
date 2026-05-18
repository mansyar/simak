# Track: Project Scaffolding

## Description

Initialize the TanStack Start project with all tooling, configure Tailwind CSS v4 with shadcn/ui, define the folder structure, set up environment validation, create the Docker build pipeline, configure local dev environment via Docker Compose, and set up git hooks for code quality.

## Dependencies

None (first track of the project).

## Package Manager

`pnpm` (used for all dependency management and scripts).

## Files to Create

### Project Configuration
| File | Purpose |
|---|---|
| `package.json` | Package manager: `pnpm`. Scripts for dev, build, test, lint, typecheck. Dependencies: TanStack Start, Router, Query, Tailwind v4, shadcn/ui, Zod, Drizzle, Better-Auth, typesafe-i18n, Vitest, Playwright. Dev deps: Husky, lint-staged, prettier, ESLint |
| `tsconfig.json` | TypeScript configuration with path aliases (`@/` → `src/`). Includes path for `vitest` types |
| `app.config.ts` | TanStack Start app configuration (routes dir, SSR settings) |
| `vite.config.ts` | Vite config with React plugin, path aliases, test config |
| `eslint.config.js` | ESLint flat config: TypeScript rules, React rules, import ordering |
| `.prettierrc` | Prettier config: single quotes, trailing commas, 100 print width |
| `components.json` | shadcn/ui configuration |

### Application Source
| File | Purpose |
|---|---|
| `src/app/global.css` | Tailwind v4 entry point with CSS custom properties for light/dark theme |
| `src/config/env.ts` | Zod-validated environment variables schema |
| `src/app/__root.tsx` | Root layout with providers (Query, Theme, i18n) |
| `src/app/index.tsx` | Root route — redirect based on auth state |
| `src/i18n/index.ts` | typesafe-i18n initialization and locale detection |
| `src/components/layout/language-switcher.tsx` | Language toggle component |

### Localization
| File | Purpose |
|---|---|
| `locales/en.json` | Starter English translations |
| `locales/id.json` | Starter Indonesian translations |

### Infrastructure
| File | Purpose |
|---|---|
| `docker-compose.yml` | Local dev services: PostgreSQL, PgAdmin |
| `docker/Dockerfile` | Multi-stage build (builder + slim runner) |
| `.env.example` | All required env vars with placeholder values |
| `.gitignore` | Ignore patterns for node_modules, env, build output, etc. |

### Quality Tooling
| File | Purpose |
|---|---|
| `.husky/pre-commit` | Run `pnpm lint-staged` on every commit |
| `.husky/pre-push` | Run typecheck, vitest coverage, and Playwright tests on push |
| `lint-staged.config.js` | Run ESLint, Prettier, TypeScript checks on staged files |
| `scripts/check-modularity.ts` | Enforce max 500 lines per source file |

### Testing
| File | Purpose |
|---|---|
| `playwright.config.ts` | Playwright config with browser targets |
| `tests/unit/i18n/locale-resolution.test.ts` | Locale detection chain test |
| `tests/unit/i18n/translation-coverage.test.ts` | Translation key parity test |

## Definition of Done

- `pnpm run dev` starts the dev server without errors
- `pnpm run build` produces a production build
- A placeholder page renders at `localhost:3000` with Tailwind v4 styles (both light and dark mode)
- `docker compose up` starts PostgreSQL on port 5432
- `docker build` succeeds with the multi-stage Dockerfile
- Environment variables validated via Zod
- `git commit` triggers lint-staged (eslint, prettier, typecheck)
- `git push` triggers full typecheck, vitest coverage, and Playwright tests
- `shadcn add button` works correctly
- i18n types generate on `pnpm run dev` — `t('key')` is type-safe
