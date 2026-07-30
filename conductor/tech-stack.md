<protect>
# Technology Stack

## Core Framework

| Component        | Technology                  | Purpose                                                                                            |
| ---------------- | --------------------------- | -------------------------------------------------------------------------------------------------- |
| **Framework**    | TanStack Start (Vite + SSR) | Full-stack React meta-framework with type-safe routing, server functions, and fast Vite dev server |
| **Routing**      | TanStack Router             | File-based routing with type-safe params and search params; Zod integration for runtime validation |
| **Server State** | TanStack Query              | Caching, deduplication, background refetching, polling for notifications                           |
| **Rendering**    | SSR + Client hydration      | Dashboard SSR for initial data; interactive pages client-rendered                                  |

## Frontend

| Component      | Technology            | Purpose                                                         |
| -------------- | --------------------- | --------------------------------------------------------------- |
| **UI Library** | shadcn/ui (Radix UI)  | Accessible, composable components with built-in ARIA compliance |
| **Styling**    | Tailwind CSS v4       | Utility-first CSS with design system integration                |
| **Forms**      | React Hook Form + Zod | Performant forms with Zod validation resolver                   |
| **i18n**       | typesafe-i18n         | Type-safe translations with compile-time checks                 |
| **Client-Side XLSX** | SheetJS (`xlsx`) | Client-side .xlsx parsing, sample-file generation, and dashboard data export |
| **DOCX Preview**     | mammoth.js           | `.docx` → HTML conversion, ~30KB gzipped, lazy-loaded via dynamic `import()` |

## Backend & Data

| Component           | Technology             | Purpose                                                                       |
| ------------------- | ---------------------- | ----------------------------------------------------------------------------- |
| **Database**        | PostgreSQL             | Relational data model with strong integrity constraints                       |
| **Database Driver** | postgres (postgres.js) | Native ESM PostgreSQL driver, lightweight, recommended by Drizzle             |
| **ORM**             | Drizzle ORM            | Type-safe SQL-first ORM, lightweight, no code generation                      |
| **Validation**      | Zod                    | Runtime schema validation for forms and API inputs                            |
| **Authentication**  | Better-Auth            | Framework-agnostic auth with email/password, session management, role support |

## Infrastructure

| Component            | Technology     | Purpose                                                    |
| -------------------- | -------------- | ---------------------------------------------------------- |
| **File Storage**     | Cloudflare R2  | S3-compatible object storage with presigned URL uploads    |
| **Email**            | Resend         | Transactional email API for invitations and password setup |
| **Package Manager**  | pnpm           | Fast, disk-efficient package management                    |
| **Containerization** | Docker         | Multi-stage build for production deployment                |
| **Hosting**          | Coolify on VPS | Self-hosted deployment with auto-proxied SSL via Traefik   |

## Testing & Quality

| Component                  | Technology                           | Purpose                                                 |
| -------------------------- | ------------------------------------ | ------------------------------------------------------- |
| **Unit/Integration Tests** | Vitest                               | Fast unit and integration tests with coverage reporting |
| **E2E Tests**              | Playwright                           | End-to-end browser tests (chromium + firefox + mobile) |
| **Accessibility Scanning** | @axe-core/playwright                 | Automated WCAG 2.1 AA accessibility audits in E2E tests |
| **Code Quality**           | oxlint + oxfmt + Lefthook            | Pre-commit linting/formatting/modularity; pre-push typecheck & coverage |

## Version Requirements

- Node.js >= 20
- pnpm >= 9
- PostgreSQL >= 16
- Docker (for local dev and production build)

## Changelog

- **2026-07-22:** Added `mammoth.js` for client-side `.docx` → HTML conversion on the instructor review detail page. Lazy-loaded via dynamic `import('mammoth')` to keep it out of the main client bundle. Used in `ReviewFilePreview` component (TRACK-017).
- **2026-07-22:** **Deviation from plan** — The plan (Phase 0) specified `@radix-ui/react-popover` for the keyboard cheat-sheet Popover component. However, the entire codebase uses `@base-ui/react` for all UI primitives (Dialog, Sheet, etc.). `@base-ui/react/popover` is already installed and available. Replaced `@radix-ui/react-popover` with `@base-ui/react/popover` for consistency. Uninstalled `@radix-ui/react-popover` (was installed in Phase 0 commit `784fcd3`).
- **2026-07-23:** Upgraded TypeScript from 5.8 to 7.0 (native Go compiler port). Removed `baseUrl: "."` from `tsconfig.json` (option removed in TS 7; `paths` mapping is already relative). Added `--checkers` flag to the pre-push typecheck gate in `lefthook.yml` to leverage TS 7's shared-memory multithreading. No source code changes required (zero Compiler API consumers, no blocked frameworks).
- **2026-07-27:** Added `@axe-core/playwright` for automated accessibility scanning in E2E tests. Added Firefox and mobile-chrome (Pixel 7) projects to Playwright config. Fixed 8 critical/serious WCAG violations (color contrast, aria-labels, button names) across 10 source files (TRACK-028).
- **2026-07-28:** Aligned `lefthook.yml` and `package.json` tooling gates (TRACK-036, INFRA-10). `pnpm format` expanded from `src/**/*.{ts,tsx,css}` to `*.{js,jsx,ts,tsx,css}` (all dirs); lefthook format glob added `.css`; lefthook lint glob expanded from `src/**/*.{js,jsx,ts,tsx}` to `*.{js,jsx,ts,tsx}` (all dirs); `pnpm typecheck` added `--checkers 4` (was only in lefthook pre-push gate). Created `.socraticodecontextartifacts.json` with 7 entries for SocratiCode semantic search across project docs and DB migrations.
- **2026-07-29:** Added `pino` (production dependency) and `pino-pretty` (devDependency) for structured logging (TRACK-040). New `src/lib/logger.ts` — singleton pino instance with env-based config (`LOG_LEVEL` env var, default `info`). Production: JSON to stdout. Dev: `pino-pretty` (lazy-loaded via `createRequire` to avoid bundling in prod). New `src/lib/request-context.ts` — TanStack Start `createMiddleware({ type: 'request' })` for request ID propagation (`x-request-id` header → UUID → `logger.child({ requestId })`). `logError()` in `src/lib/errors.ts` refactored to route through `logger.error(entry)` instead of `console.error`. All 41 `console.*` calls in `src/lib/` and `src/server/` migrated to pino (zero `console.*` remaining, excluding `src/db/seed.ts` and `src/db/migrate.ts`).
- **2026-07-30:** Configured explicit connection pool settings on postgres.js client in `src/db/index.ts` (TRACK-042). Migrated `getDb()` to use `getEnv()` instead of `process.env.DATABASE_URL` (removes manual guard — Zod validation handles it). Pool config: `max`=`DB_POOL_MAX` (default 10, suitable for single-instance Coolify), `idle_timeout`=30s, `connect_timeout`=10s, `max_lifetime`=1800s (30 min). `prepare` flag controlled by `DB_PREPARED_STATEMENTS_DISABLED` env var (set to `true` for PgBouncer transaction pooling compatibility). `onnotice` callback routes PostgreSQL notices through pino at debug level. New env vars: `DB_POOL_MAX` (`z.coerce.number().int().positive().default(10)`), `DB_PREPARED_STATEMENTS_DISABLED` (custom string-to-boolean transform — `val === 'true'`, default `false`; NOT `z.coerce.boolean()` which returns `true` for the string `'false'`). **Deviation from spec (FR-3):** `prepare` was NOT added to the `drizzle()` call because drizzle-orm 0.45.2's `DrizzleConfig` type does not include a `prepare` property. The `prepare` option on the postgres.js client (FR-2) is sufficient — Drizzle uses the underlying client's settings.

</protect>
