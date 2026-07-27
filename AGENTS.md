# SIMAK — Agent Instructions

**SIMAK** (Sistem Informasi dan Manajemen Akademik) — Academic assignment management.  
**Stack:** TanStack Start + PostgreSQL + Drizzle ORM + Better Auth + shadcn/ui + Tailwind v4.

---

## Developer Commands

| Command                                           | Purpose                                                  |
| ------------------------------------------------- | -------------------------------------------------------- |
| `pnpm dev`                                        | Start dev server (auto-runs i18n codegen first)          |
| `pnpm build`                                      | Prod build (codegen + `vite build` + migrate/seed bundles) |
| `pnpm start`                                      | Start prod server (`vinxi start`)                        |
| `pnpm test`                                       | Run unit tests (`vitest run`; excludes integration; xlsx tests run via `projects`) |
| `pnpm test:unit`                                  | Alias of `pnpm test`                                     |
| `pnpm test:integration`                            | Run **only** integration tests via `vitest.config.integration.ts` (opt-in, not in pre-push) |
| `pnpm test:watch`                                 | Watch mode (`vitest`; unit only, xlsx included via `projects`) |
| `pnpm test:coverage`                              | Unit tests + coverage (`vitest run --coverage`; vmThreads for unit, excludes integration) |
| `pnpm vitest run tests/unit/path/to/file.test.ts` | Single test file                                         |
| `pnpm typecheck`                                  | `tsc --noEmit --incremental`                             |
| `pnpm lint`                                       | **oxlint** on everything (`oxlint .`)                    |
| `pnpm format`                                     | **oxfmt** on `src/**/*.{ts,tsx,css}` (not `tests/`)       |
| `pnpm db:generate`                                | Generate Drizzle migration from schema                   |
| `pnpm db:push`                                    | Push schema to dev DB (`drizzle-kit push`)              |
| `pnpm db:migrate`                                 | Run pending migrations                                   |
| `pnpm db:seed`                                    | Seed SuperAdmin user (reads `.env` via `--env-file`)     |
| `pnpm generate:i18n`                              | Regenerate i18n TypeScript types                         |
| `pnpm check:i18n` / `pnpm check:i18n:unused`      | Validate i18n key parity / show unused keys              |

**Pre-commit gate** (Lefthook, sequential): `oxlint --fix {staged_files}` → `oxfmt --write {staged_files}` → `node scripts/check-modularity.js {staged_files}`  
**Pre-push gate** (Lefthook): `pnpm typecheck` && `pnpm test:coverage` (coverage run **also excludes integration** via `vitest.config.ts`).

> Integration tests never run unless you invoke `pnpm test:integration` explicitly.

## Architecture Must-Knows

### Server function split (critical)

Every feature has **two files** — the client is **never** bundled with handler code:

- `src/server/<feature>.ts` — Exports Zod schemas + `createServerFn` stubs that dynamically import the handler
- `src/server/<feature>.server.ts` — Exports handler functions only (server code, never client-bundled)

Two stub patterns coexist — match the surrounding file:
- Typed builder: `createServerFn({ method }).inputValidator(Schema).handler(fn)` (preferred; see `assignments.ts`)
- Inline parse: `createServerFn({ method }).handler(async (args) => { Schema.parse(args.data) })` (see `submissions.ts`)

### File limits

- Max **500 lines** per file in `src/`, `tests/`, `scripts/`. Enforced by `scripts/check-modularity.js` on commit.
- Exempt: `.gen.ts` files, `src/i18n/types.ts`, `src/i18n/detect-locale.ts`, `scripts/generate-i18n-types.ts`.

### i18n codegen

- `pnpm generate:i18n` runs **before every dev/build**.
- Generated files: `src/i18n/types.ts`, `src/i18n/detect-locale.ts` — do not edit by hand.
- `locales/en.json` is the source of truth; types are derived from it. To add keys: edit `locales/en.json` (and `locales/id.json`) → run `pnpm generate:i18n` → validate with `pnpm check:i18n`.

### Custom lint rule — no hardcoded UI strings

- `lint-plugin.js` (loaded via `.oxlintrc.json` `jsPlugins`) defines `simak-i18n/no-hardcoded` (warn).
- It flags hardcoded English UI text (JSX children + `placeholder`/`aria-label`/`title`/`alt` attributes) — you must use `t('key')` instead. Only the literal `DELETE` is allowlisted.
- So any new user-visible string needs an i18n key in both `en.json` and `id.json`.

### No self-registration

- No `/auth/register` page. Users are created by admins via invitation.
- Password setup flow: Admin creates user → email sent with token → user sets password at `/auth/setup-password?token=xxx`.

### Route guards (role-based layouts)

Pathless layouts under `src/routes/`; auth helpers (`getSessionFromHeaders`, `requireRole`) live in `src/server/auth.ts`:

- `_unauthenticated.tsx` → redirects authenticated users away from auth pages
- `_authenticated.tsx` → `getSessionFromHeaders()` → redirects unauthenticated to `/auth/login`
- `_authenticated/admin.tsx` → `requireRole(['superadmin', 'admin'])`
- `_authenticated/instructor.tsx` → `requireRole(['instructor'])`
- `_authenticated/student.tsx` → `requireRole(['student'])`

### File upload pattern

Files go **directly to Cloudflare R2** via presigned URLs — the server never sees file bytes:

1. Client calls `getPresignedUploadUrl` → server returns `{ uploadUrl, fileKey }`
2. Client PUTs file directly to `uploadUrl`
3. Client calls `submitCheckpoint` to record metadata in DB

## Testing Patterns

- Tests live in `tests/unit/` and `tests/integration/` — mirror `src/` structure.
- Vitest config: `globals: true`, default environment **`happy-dom`**, discovery from `tests/**/*.test.{ts,tsx}`; `tests/integration/**` is **excluded** from the default run.
- xlsx tests run via the `projects` array in `vitest.config.ts` (xlsx project uses `threads` pool, rest uses `vmThreads`) — handled automatically, no script flags needed.
- Server-handler tests add `/** @vitest-environment node */` at the top of the file (overrides happy-dom).
- Tests import handlers directly via `@/server/*.server` and mock `@/server/auth`, `@/db/index`, plus external clients (`@/lib/storage`, Resend).
- When a server function uses `.inputValidator(Schema).handler(...)`, the test **must mock `@tanstack/react-start`** with the builder chain or import fails. Canonical pattern in `tests/unit/server/submissions.test.ts`:
  ```ts
  vi.mock('@/server/auth', () => ({ getSessionFromHeaders: vi.fn() }));
  vi.mock('@/db/index', () => ({ getDb: vi.fn() }));
  vi.mock('@tanstack/react-start', () => ({
    createServerFn: vi.fn().mockReturnValue({
      inputValidator: vi.fn().mockReturnThis(),
      handler: vi.fn().mockImplementation((fn) => fn),
    }),
  }));
  ```
- Coverage thresholds: lines 80%, functions 80%, branches 80%, statements 80%.

## Formatting Quirks

- **Formatting via oxfmt** (`.oxfmtrc.json`): `semi: true`, `singleQuote: true`, `trailingComma: 'all'`, `printWidth: 100`, `tabWidth: 2`.
- **Linting via oxlint** (`.oxlintrc.json`): TypeScript + React plugins, `correctness: error`, plus the custom `simak-i18n/no-hardcoded` rule (see above).
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

- **6 required** env vars (validated by Zod in `src/config/env.ts`): `DATABASE_URL`, `RESEND_API_KEY`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`. `R2_*` and `MIGRATE_DATABASE_URL` are optional (R2 is needed for file uploads).
- Local PostgreSQL via `docker-compose.yml` (postgres:16-alpine, port 5432, `restart: no` — won't auto-restart, defaults: user/db `simak`, password `simak_password`).
- Docker build: multi-stage (`docker/Dockerfile`), output in `.output/server/index.mjs`.
- To add a new env var: add it to `src/config/env.ts` and `.env.example`.
