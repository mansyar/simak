# SIMAK — Agent Instructions

**SIMAK** (Sistem Informasi dan Manajemen Akademik) — Academic assignment management.  
**Stack:** TanStack Start + PostgreSQL + Drizzle ORM + Better Auth + shadcn/ui + Tailwind v4.

---

## Developer Commands

| Command                                        | Purpose                                         |
| ---------------------------------------------- | ----------------------------------------------- |
| `pnpm dev`                                     | Start dev server (auto-runs i18n codegen first) |
| `pnpm build`                                   | Production build (auto-runs i18n codegen first) |
| `pnpm test`                                    | Run all tests (Vitest)                          |
| `pnpm test --reporter=verbose`                 | Run tests with full names                       |
| `pnpm test tests/unit/path/to/file.test.ts`    | Single test file                                |
| `pnpm test --coverage`                         | Test + coverage report                          |
| `pnpm typecheck`                               | TypeScript check (`tsc --noEmit`)               |
| `pnpm lint`                                    | ESLint on everything                            |
| `pnpm format`                                  | Prettier on `src/` and `tests/` sources         |
| `pnpm db:generate`                             | Generate Drizzle migration from schema          |
| `pnpm db:push`                                 | Push schema to dev DB (drizzle-kit push)        |
| `pnpm db:migrate`                              | Run pending migrations                          |
| `pnpm db:seed`                                 | Seed SuperAdmin user                            |
| `pnpm generate:i18n`                           | Regenerate i18n TypeScript types                |

**Pre-push gate** (Husky): `pnpm typecheck && pnpm vitest run --coverage`  
**Pre-commit gate** (Husky): `oxlint --fix`, `oxfmt --write`, `node scripts/check-modularity.js` (runs on staged files directly)

## Architecture Must-Knows

### Server function split (critical)

Every feature has **two files** — the client is **never** bundled with handler code:

- `src/server/<feature>.ts` — Exports Zod schemas + `createServerFn` stubs that dynamically import the handler
- `src/server/<feature>.server.ts` — Exports handler functions only (server code, never client-bundled)

### File limits

- Max **500 lines** per file in `src/`, `tests/`, `scripts/`. Enforced by `scripts/check-modularity.js` on commit.
- Exempt: `.gen.ts` files, `src/i18n/types.ts`, `src/i18n/detect-locale.ts`

### i18n codegen

- `pnpm generate:i18n` runs **before every dev/build**.
- Generated files: `src/i18n/types.ts`, `src/i18n/detect-locale.ts` — do not edit by hand.
- To add new translation keys: edit `scripts/generate-i18n-types.ts` → run the generator → add values to `locales/en.json` and `locales/id.json`.

### No self-registration

- No `/auth/register` page. Users are created by admins via invitation.
- Password setup flow: Admin creates user → email sent with token → user sets password at `/auth/setup-password?token=xxx`.

### Route guards (role-based layouts)

- `_unauthenticated.tsx` → redirects authenticated users to `/dashboard`
- `_authenticated.tsx` → redirects unauthenticated to `/auth/login`
- `_admin.tsx` → `requireRole(['superadmin', 'admin'])`
- `_instructor.tsx` → `requireRole(['instructor'])`
- `_student.tsx` → `requireRole(['student'])`

### File upload pattern

Files go **directly to Cloudflare R2** via presigned URLs — the server never sees file bytes:

1. Client calls `getPresignedUploadUrl` → server returns `{ uploadUrl, fileKey }`
2. Client PUTs file directly to `uploadUrl`
3. Client calls `submitCheckpoint` to record metadata in DB

## Testing Patterns

- Tests live in `tests/unit/` and `tests/integration/` — mirror `src/` structure.
- Vitest config: `globals: true`, `environment: 'jsdom'`, test discovery from `tests/**/*.test.{ts,tsx}`.
- Tests import server handlers directly (via `@/server/*.server`) and mock `getSessionFromHeaders`, `getDb`, and any external clients (R2, Resend).
- See `tests/unit/server/submissions.test.ts` for the canonical mock pattern:
  ```ts
  vi.mock('@/server/auth', () => ({ getSessionFromHeaders: vi.fn() }));
  vi.mock('@/db/index', () => ({ getDb: vi.fn() }));
  ```
- Coverage thresholds: lines 80%, functions 80%, branches 72%, statements 79%.

## Formatting Quirks

- **Formatting via oxfmt** (`.oxfmtrc.json`): `semi: true`, `singleQuote: true`, `trailingComma: 'all'`, `printWidth: 100`, `tabWidth: 2`.
- **Linting via oxlint** (`.oxlintrc.json`): TypeScript + React plugins, recommended + strict rules.
- `.gitattributes` enforces **LF line endings** for all source files (`.ts`, `.tsx`, `.js`, etc.) — Windows checkout is fine, commits are always LF.
- `pnpm-lock.yaml` uses **pnpm** (not npm or yarn). Always use `pnpm` for dependency operations.
- Commit format: `<type>(<scope>): <description>` — types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.

## Conductor Workflow

This project uses the Conductor methodology. Key files:

| File                          | Purpose                                                      |
| ----------------------------- | ------------------------------------------------------------ |
| `conductor/product.md`        | Product definition, feature list by track                    |
| `conductor/tech-stack.md`     | Approved tech stack                                          |
| `conductor/workflow.md`       | TDD workflow, commit format, git notes protocol              |
| `conductor/tracks.md`         | Track registry (tracks are archived to `conductor/archive/`) |
| `conductor/code_styleguides/` | SQL and React style guides                                   |

## Environment

- 10 required env vars (`DATABASE_URL`, `R2_*`, `RESEND_API_KEY`, `BETTER_AUTH_*`, `SUPERADMIN_*`). Validated by `src/config/env.ts` via Zod at startup.
- Local PostgreSQL available via `docker-compose.yml` (port 5432, no auto-restart).
- Docker build: multi-stage (`docker/Dockerfile`), output in `.output/server/index.mjs`.
- To add a new env var, add it to `src/config/env.ts` and `docs/PRD.md` env table. Always add to `.env.example`.
