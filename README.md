# SIMAK

**Sistem Informasi dan Manajemen Akademik** — A web-based academic assignment management system for universities and schools. Instructors create assignments with sequential checkpoints, students submit work for review, and structured feedback cycles drive progress through defined stages.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript 7.0 (native Go compiler, ~6x faster type-checking) |
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
| `pnpm test:e2e` | Run Playwright E2E tests (requires Docker for test DB) |
| `pnpm test:e2e:ui` | Run E2E tests in interactive UI mode |
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

- **Server function split:** Every feature has two files — `*.ts` (client-safe stub with Zod schema + `createServerFn`) and `*.server.ts` (handler with DB code). This keeps server-only code out of the client bundle. The `auth.ts`/`auth.server.ts` split was verified with bundle analysis — zero `pg`/`drizzle-orm` imports leak into client chunks.
- **Session cache:** A 5s-TTL in-memory cache in `auth.server.ts` reduces per-page-load user lookup queries from 4–6 to 1 per 5s window. Tradeoff: role changes and soft-delete checks may take up to 5s to propagate for in-flight requests.
- **File uploads direct to R2:** Files go directly to Cloudflare R2 via presigned URLs — the server never sees file bytes. An `upload_intents` table enforces ownership, purpose, expiry, and single-use semantics. R2 HEAD size verification runs before the DB transaction opens (no row lock held during I/O).
- **Concurrency safety:** All state-transition handlers (checkpoint submissions, reviews, consultations, extensions) use `db.transaction` + `SELECT ... FOR UPDATE` + post-lock state re-validation to prevent TOCTOU race conditions.
- **Query optimization:** N+1 patterns eliminated via set-based queries (`GROUP BY`, bulk `UPDATE`). Independent queries parallelized with `Promise.all`. Latest-submission lookups use LATERAL joins. All list handlers have offset-based pagination (page/limit Zod params + parallel count query). Post-commit advisory work (audit logging, notifications) is batched and wrapped in try/catch per SQL styleguide §6.4.
- **Bilingual i18n:** All user-visible strings use `t('key')` with translations in both `en.json` and `id.json`. A custom oxlint rule (`simak-i18n/no-hardcoded`) enforces this at lint time. Dates render locale-aware via shared helpers in `src/lib/format-date.ts` (`formatDate`) and `src/lib/format.ts` (`formatDateShort` / `formatRelativeTime`); deadline surfaces append relative-time context (e.g., "Mar 5, 2026 (in 3 days)") and SLA badges expose a relative-time `title` tooltip.
- **Accessibility (WCAG 2.1 AA):** Notification center uses the shadcn `Sheet` primitive (focus trapping, Escape, backdrop close); notification items render as TanStack Router `<Link>` elements when navigable (falling back to `<button>` when no route exists); progress bars expose `role="progressbar"` + ARIA values; collapsibles expose `aria-expanded`/`aria-controls`; decorative elements are `aria-hidden`; icon buttons have `aria-label`; the notification badge announces count changes via `aria-live="polite"`.
- **Responsive mobile layouts:** User-facing data tables degrade to card layouts on small screens via the `flex sm:hidden` / `hidden sm:block` dual-render pattern (e.g., instructor `ProgressTable` shows per-student cards below the `sm` breakpoint; `CheckpointListEditor` rows stack with `flex-col sm:flex-row`; the `AssignmentWizard` surfaces the current step name on mobile). Admin-only tables keep horizontal scroll.
- **Action feedback & loading states:** All user-initiated mutations display a success toast via the `showSuccessToast` helper (`src/lib/toast.ts`), rendered by the global `<Toaster>` in `__root.tsx`. Route-level loading uses `pendingComponent` with reusable skeleton components (`DashboardSkeleton`, `TableSkeleton`, `AssignmentDetailSkeleton`); inline loading uses `Loader2` spinners. Error handling shows actual server error messages with inline retry banners for side-data fetches, and differentiates file upload errors (network vs server). File uploads to R2 use `XMLHttpRequest` with real-time progress tracking via `xhr.upload.onprogress` — the `FileUploader` displays a determinate progress bar when available, falling back to a spinner.
- **Search debounce & form validation:** Server-side search inputs use a custom `useDebouncedCallback` hook (300ms) to batch keystrokes into a single server request, with conditional X clear buttons. All user-facing forms (`ConsultationForm`, `ExtensionRequestForm`, `PasswordSection`) use `react-hook-form` + Zod with `onBlur` validation and per-field inline errors.
- **Optimistic UI updates:** 9 mutation sites (mark-as-read, consultation verify/reject, extension approve/reject, checkpoint unlock/extend, user delete) use TanStack Query's `onMutate`/`onError`/`onSettled` pattern to reflect predicted state changes instantly — before the server responds. A typed query-key factory (`src/lib/query-keys.ts`) centralizes cache invalidation keys for notifications, consultations, extensions, assignments, users, and templates. Rollback is guaranteed via snapshot capture/restore. Mutations with unpredictable server responses (e.g., `submitReview`) keep the standard refetch-on-success flow.
- **Invitation-only auth:** No self-registration. Admins create users; password setup happens via token-based invitation flow.
- **Email queue with retention & delivery tracking:** The background email processor sends emails in concurrent batches of 5 via `Promise.allSettled` (reducing cycle latency). Each successfully sent email stores a `resendMessageId` (visible in the admin queue inspector) for correlation with Resend's delivery dashboard. Automatic retention cleanup prunes `sent` rows older than 90 days and `failed` rows older than 180 days on a 24-hour tick-embedded cycle — `pending`/`processing` rows are never deleted.
- **Event email notifications:** 8 event types (submission received, review completed, revision requested, consultation verified/rejected, extension approved/rejected, extension requested) dispatch localized email notifications alongside existing in-app notifications. Emails are sent as **post-commit advisory work** — the primary operation always succeeds even if email enqueue fails. HTML templates are built by domain-specific helpers in `src/lib/email-templates.ts` with all user input HTML-escaped. Recipients with no verified email or soft-deleted accounts are silently skipped. Subjects are localized via i18n keys prefixed `[SIMAK]`.
- **Notification UX:** Notifications are clickable links that navigate to relevant pages based on type + stored metadata. The notification center supports read/unread filtering and incremental "Load More" pagination (20 items per page). Polling runs at 30-second intervals with `refetchIntervalInBackground: false` (stops when tab is hidden) and a 30-second `staleTime` to minimize unnecessary refetches. `NotificationItem` is wrapped in `React.memo` and `NotificationCenter` uses `useMemo` for grouped notifications and unread count.
- **DOCX inline preview:** `.docx` submission files are previewed inline on the instructor review detail page via `mammoth.js` (lazy-loaded via dynamic import, rendered in a sandboxed iframe with `sandbox=""` — no script execution). A 10MB size guard prevents browser freezes on large files; conversion errors fall back to a "Preview not available" card with a download button.
- **Keyboard shortcuts:** A two-layer shortcut architecture: global shortcuts (`R` = refresh data, `?` = cheat-sheet popover) active on all authenticated pages, and review-specific shortcuts (`J`/`K` = navigate pending review queue) active only on the review detail page. Shortcuts are disabled when typing in inputs. The pending review list is preloaded on mount for instant J/K navigation.
- **Route prefetch:** Sidebar navigation links use `preload="intent"` so hovering a link prefetches the route's data/loader. The router's `defaultPreload` is `false` to avoid over-prefetching on the public landing page.

## Testing

- **Unit tests** (`tests/unit/`) — Mirror `src/` structure. Default environment is `happy-dom`; server handler tests use `/** @vitest-environment node */`.
- **Integration tests** (`tests/integration/`) — Excluded from the default test run. Run explicitly with `pnpm test:integration`.
- **E2E tests** (`tests/e2e/`) — Playwright E2E tests covering critical user flows: auth route guards, admin user management, instructor assignment creation, student file submission, and instructor review workflow. Uses a dedicated test database (`postgres-test` Docker service, port 5433). Run with `pnpm test:e2e` (headless) or `pnpm test:e2e:ui` (interactive). The global setup migrates, truncates, and seeds the test DB before each run; each spec file resets the DB for isolation.
- **Coverage thresholds:** lines, functions, branches, and statements all >= 80%.

## Deployment

The app is deployed via Docker on a VPS using Coolify. The multi-stage Dockerfile builds the app and bundles migration + seed runners. In production, PgBouncer handles connection pooling, and `MIGRATE_DATABASE_URL` bypasses it for migrations.

```bash
docker build -f docker/Dockerfile -t simak .
```

## License

Private project.
