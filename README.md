# SIMAK

**Sistem Informasi dan Manajemen Akademik** — A web-based academic assignment management system for universities and schools. Instructors create assignments with sequential checkpoints, students submit work for review, and structured feedback cycles drive progress through defined stages.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | TanStack Start (Vite + SSR) |
| Routing | TanStack Router (file-based, type-safe) |
| UI | shadcn/ui (Radix UI) + Tailwind CSS v4 |
| Auth | Better-Auth (email/password, TOTP 2FA, sessions) |
| Database | PostgreSQL 16 |
| ORM | Drizzle ORM |
| File Storage | Cloudflare R2 (presigned URL uploads) |
| Email | Resend (transactional, via background queue) |
| i18n | typesafe-i18n (English + Indonesian) |
| Testing | Vitest (unit + integration), Playwright (E2E) |
| Deployment | Docker + Coolify |

## Prerequisites

- Node.js 20+
- pnpm
- Docker (for local PostgreSQL)

## Quick Start

1. **Clone and install:**
   ```bash
   pnpm install
   ```

2. **Start PostgreSQL** (local dev database):
   ```bash
   docker compose up -d
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   ```
   Fill in the required values. At minimum, set `BETTER_AUTH_SECRET` (32+ chars), `RESEND_API_KEY`, `EMAIL_FROM`, `SUPERADMIN_EMAIL`, and `SUPERADMIN_PASSWORD`. R2 variables are optional for local dev (needed for file uploads).

4. **Run database migrations and seed:**
   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```

5. **Start the dev server** (auto-runs i18n codegen first):
   ```bash
   pnpm dev
   ```
   The app runs at `http://localhost:3000`.

## Common Commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start dev server (auto-runs i18n codegen) |
| `pnpm build` | Production build (codegen + vite build + migrate/seed bundles) |
| `pnpm start` | Start production server |
| `pnpm test` | Run unit tests (excludes integration) |
| `pnpm test:integration` | Run integration tests only |
| `pnpm test:coverage` | Unit tests + coverage report |
| `pnpm typecheck` | TypeScript type checking (`tsc --noEmit`) |
| `pnpm lint` | Lint with oxlint |
| `pnpm format` | Format with oxfmt |
| `pnpm db:generate` | Generate Drizzle migration from schema |
| `pnpm db:migrate` | Run pending migrations |
| `pnpm db:seed` | Seed SuperAdmin user |
| `pnpm generate:i18n` | Regenerate i18n TypeScript types |

## Project Structure

```
simak/
├── src/
│   ├── routes/           → TanStack Router files (file-based routing)
│   ├── components/       → React components (ui/, layout/, dashboard/, etc.)
│   ├── server/           → Server functions (*.ts = stubs, *.server.ts = handlers)
│   ├── db/schema/        → Drizzle schema (split by domain)
│   ├── auth/             → Better-Auth configuration
│   ├── i18n/             → Translation init + locale detection
│   ├── lib/              → Shared utilities (email, storage, errors, etc.)
│   └── config/           → Validated environment variables
├── locales/              → Translation JSON (en.json, id.json)
├── tests/                → Unit, integration, and E2E tests
├── drizzle/migrations/   → SQL migrations + rollback files
├── docs/                 → PRD, TDD, Roadmap
├── conductor/            → Conductor methodology (plans, specs, archive)
└── docker/               → Dockerfile
```

## Documentation

- **[docs/PRD.md](docs/PRD.md)** — Product Requirements Document (features, user flows, roles)
- **[docs/TDD.md](docs/TDD.md)** — Technical Design Document (architecture, data model, schemas)
- **[docs/roadmap.md](docs/roadmap.md)** — Remediation roadmap (audit findings, tracks, milestones)
- **[AGENTS.md](AGENTS.md)** — Developer guide (commands, architecture, testing patterns, formatting)

## Architecture Highlights

- **Server function split:** Every feature has two files — `*.ts` (client-safe stub with Zod schema + `createServerFn`) and `*.server.ts` (handler with DB code). This keeps server-only code out of the client bundle.
- **File uploads direct to R2:** Files go directly to Cloudflare R2 via presigned URLs — the server never sees file bytes. An `upload_intents` table enforces ownership, purpose, expiry, and single-use semantics.
- **Concurrency safety:** All state-transition handlers (checkpoint submissions, reviews, consultations, extensions) use `db.transaction` + `SELECT ... FOR UPDATE` + post-lock state re-validation to prevent TOCTOU race conditions.
- **Bilingual i18n:** All user-visible strings use `t('key')` with translations in both `en.json` and `id.json`. A custom oxlint rule (`simak-i18n/no-hardcoded`) enforces this at lint time.
- **Invitation-only auth:** No self-registration. Admins create users; password setup happens via token-based invitation flow.

## Testing

- **Unit tests** (`tests/unit/`) — Mirror `src/` structure. Default environment is `happy-dom`; server handler tests use `/** @vitest-environment node */`.
- **Integration tests** (`tests/integration/`) — Excluded from the default test run. Run explicitly with `pnpm test:integration`.
- **Coverage thresholds:** lines, functions, branches, and statements all >= 80%.

## Deployment

The app is deployed via Docker on a VPS using Coolify. The multi-stage Dockerfile builds the app and bundles migration + seed runners. In production, PgBouncer handles connection pooling, and `MIGRATE_DATABASE_URL` bypasses it for migrations.

```bash
docker build -f docker/Dockerfile -t simak .
```

## License

Private project.
