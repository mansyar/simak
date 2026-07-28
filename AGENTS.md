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
| `pnpm typecheck`                                  | `tsc --noEmit --incremental --checkers 4`                |
| `pnpm lint`                                       | **oxlint** on everything (`oxlint .`)                    |
| `pnpm format`                                     | **oxfmt** on all dirs (`*.{js,jsx,ts,tsx,css}`)         |
| `pnpm db:generate`                                | Generate Drizzle migration from schema                   |
| `pnpm db:push`                                    | Push schema to dev DB (`drizzle-kit push`)              |
| `pnpm db:migrate`                                 | Run pending migrations                                   |
| `pnpm db:seed`                                    | Seed SuperAdmin user (reads `.env` via `--env-file`)     |
| `pnpm generate:i18n`                              | Regenerate i18n TypeScript types                         |
| `pnpm check:i18n` / `pnpm check:i18n:unused`      | Validate i18n key parity / show unused keys              |

**Pre-commit gate** (Lefthook, sequential): `oxlint --fix {staged_files}` (all dirs, `*.{js,jsx,ts,tsx}`) → `oxfmt --write {staged_files}` (all dirs, `*.{js,jsx,ts,tsx,css}`) → `node scripts/check-modularity.js {staged_files}`  
**Pre-push gate** (Lefthook): `pnpm typecheck` && `pnpm test:coverage` (coverage run **also excludes integration** via `vitest.config.ts`).

> Integration tests never run unless you invoke `pnpm test:integration` explicitly.

## Architecture Must-Knows

### Server function split (critical)

Server functions follow a two-file split: the client-safe stub file (`*.ts`) and the server-only handler file (`*.server.ts`). The client is **never** bundled with handler code. All stubs use `typedServerFn` from `src/lib/server-fn.ts` — never call `createServerFn` directly.

#### Structural patterns (choose based on complexity)

1. **Standard pair** (default) — `*.ts` (Zod schemas + `typedServerFn` stubs with dynamic import of handler) + `*.server.ts` (handler implementations). Use when a feature's handlers fit within the 500-line file limit in a single `.server.ts` file. Canonical example: `src/server/assignments.ts` + `assignments.server.ts`.

2. **Extras variant** — Standard pair + `*-extras.server.ts`. Use when adding more handlers to a `.server.ts` file would exceed the 500-line limit. The extras file imports schemas via `import type` from the `*.ts` stub and is handler-only (no corresponding extras stub file). Canonical examples: `assignments-extras.server.ts`, `reviews-extras.server.ts`, `consultations-extras.server.ts`, `extensions-extras.server.ts`.

3. **Multi-handler** — `*.ts` (shared schemas + stubs) + multiple role-specific `*.server.ts` files. Use when a feature serves multiple roles with distinct query logic, making file separation clearer than a single handler file. Canonical examples: `dashboard.ts` + `dashboard-instructor.server.ts` + `dashboard-student.server.ts` + `dashboard-admin.server.ts`; also `analytics.ts` + `analytics-admin.server.ts` + `analytics-instructor.server.ts` + `analytics-export.server.ts`.

4. **Handler-only** — No `*.ts` stub file; the `.server.ts` file is an internal helper imported only by other server files, never called directly from client code. Canonical example: the `*-extras.server.ts` helper functions.

#### Stub calling conventions

Two `typedServerFn` stub patterns coexist — match the surrounding file:
- Typed builder (preferred): `typedServerFn({ method }).inputValidator(Schema).handler(fn)` — Zod validation at the TanStack layer. See `assignments.ts`.
- Inline parse: `typedServerFn({ method }).handler(async (args) => { Schema.parse(args.data); ... })` — manual Zod parse inside the handler. See `submissions.ts`.

#### Acceptable type-only circular dependencies

Static analyzers report cycles like `feature.ts → feature.server.ts → feature.ts`. These are **safe and expected**:
- The `*.ts` stub uses `await import('./feature.server')` — a **dynamic import** resolved lazily at call time, not at module evaluation.
- The `*.server.ts` handler uses `import type { Schema } from './feature'` — a **type-only import** erased at compile time.

Neither edge exists at runtime, so there is no circular dependency at execution. This pattern is the standard two-file split and should not be "fixed" by extracting types to a separate file.

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

- **Formatting via oxfmt** (`.oxfmtrc.json`): `semi: true`, `singleQuote: true`, `trailingComma: 'all'`, `printWidth: 100`, `tabWidth: 2`. `pnpm format` covers all dirs (`*.{js,jsx,ts,tsx,css}`).
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
