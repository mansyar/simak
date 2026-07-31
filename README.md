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
| Logging | pino (structured JSON logging, server-side only; `pino-pretty` in dev) |
| i18n | typesafe-i18n (English + Indonesian) |
| Testing | Vitest (unit + integration), Playwright (E2E: chromium + firefox + mobile), @axe-core/playwright (a11y) |
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
| `pnpm test` | Run unit tests (excludes integration; xlsx tests run via `projects` config) |
| `pnpm test:watch` | Watch mode (unit only, xlsx included via `projects`) |
| `pnpm test:integration` | Run integration tests only (via standalone config) |
| `pnpm test:coverage` | Unit tests + coverage (excludes integration) |
| `pnpm test:e2e` | Run Playwright E2E tests (requires Docker for test DB) |
| `pnpm test:e2e:ui` | Run E2E tests in interactive UI mode |
| `pnpm typecheck` | TypeScript type checking (`tsc --noEmit --incremental --checkers 4`) |
| `pnpm lint` | Lint all dirs with oxlint (`oxlint .`) |
| `pnpm format` | Format all dirs with oxfmt (`*.{js,jsx,ts,tsx,css}`) |
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
│   ├── lib/              → Shared utilities (email, storage, errors, logging, etc.)
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

- **Server function split:** Every feature has two files — `*.ts` (client-safe stub with Zod schema + `typedServerFn`) and `*.server.ts` (handler with DB code). This keeps server-only code out of the client bundle. The `auth.ts`/`auth.server.ts` split was verified with bundle analysis — zero `pg`/`drizzle-orm` imports leak into client chunks. Stubs use `typedServerFn` (from `src/lib/server-fn.ts`) instead of `createServerFn` — a wrapper that restores return-type inference through the `.inputValidator(Schema).handler(fn)` builder chain, eliminating `as unknown as` casts at all 23 server function call sites. Four structural patterns are used based on complexity (documented in `AGENTS.md`): (1) Standard pair (default), (2) Extras variant (`*-extras.server.ts` when a single `.server.ts` would exceed 500 lines), (3) Multi-handler (multiple role-specific `*.server.ts` files for features like dashboards/analytics), (4) Handler-only (internal helpers, no stub file). Type-only circular dependencies between stub and handler files (`import type` in handler, dynamic import in stub) are acceptable — neither edge exists at runtime.
- **Shared session guards:** A client-safe `src/lib/session-guards.ts` module exports 4 type-guard functions (`isAdmin`, `isInstructor`, `isStudent`, `isAuthenticated`) used across all 20 `*.server.ts` handler files and `requireRole` in `auth.ts` — eliminating 28 duplicate inline guard definitions. All guards accept `NonNullableSession | null` and return `session is NonNullableSession`.
- **Type-safe server functions:** The `typedServerFn` wrapper (`src/lib/server-fn.ts`) fixes a known type-inference gap in TanStack Start's `createServerFn` — the `ServerFnReturnType` conditional type prevents TypeScript from inferring the handler's return type, defaulting to `unknown` at call sites. The wrapper uses a single `as unknown as TypedBuilder` solution cast to restore inference through the `.inputValidator(Schema).handler(fn)` builder chain. All 23 server stubs use `typedServerFn`, eliminating 66 `as unknown as` casts across hooks, components, routes, and server files. Only 10 documented TanStack Router typed-routes limitation casts remain (sidebar paths, auth/route redirects) plus the 1 solution cast. Zero `@ts-expect-error` directives, zero `as any` casts.
- **Session cache:** A 5s-TTL in-memory cache in `auth.server.ts` reduces per-page-load user lookup queries from 4–6 to 1 per 5s window. Tradeoff: role changes and soft-delete checks may take up to 5s to propagate for in-flight requests.
- **File uploads direct to R2:** Files go directly to Cloudflare R2 via presigned URLs — the server never sees file bytes. An `upload_intents` table enforces ownership, purpose, expiry, and single-use semantics. R2 HEAD size verification runs before the DB transaction opens (no row lock held during I/O).
- **Concurrency safety:** All state-transition handlers (checkpoint submissions, reviews, consultations, extensions) use `db.transaction` + `SELECT ... FOR UPDATE` + post-lock state re-validation to prevent TOCTOU race conditions.
- **Query optimization:** N+1 patterns eliminated via set-based queries (`GROUP BY`, bulk `UPDATE`). Independent queries parallelized with `Promise.all`. Latest-submission lookups use LATERAL joins. All list handlers have offset-based pagination (page/limit Zod params + parallel count query). Post-commit advisory work (audit logging, notifications) is batched and wrapped in try/catch per SQL styleguide §6.4.
- **Bilingual i18n:** All user-visible strings use `t('key')` with translations in both `en.json` and `id.json`. A custom oxlint rule (`simak-i18n/no-hardcoded`) enforces this at lint time. Dates render locale-aware via shared helpers in `src/lib/format-date.ts` (`formatDate`) and `src/lib/format.ts` (`formatDateShort` / `formatRelativeTime`); deadline surfaces append relative-time context (e.g., "Mar 5, 2026 (in 3 days)") and SLA badges expose a relative-time `title` tooltip.
- **Accessibility (WCAG 2.1 AA):** Notification center uses the shadcn `Sheet` primitive (focus trapping, Escape, backdrop close); notification items render as TanStack Router `<Link>` elements when navigable (falling back to `<button>` when no route exists); progress bars expose `role="progressbar"` + ARIA values; collapsibles expose `aria-expanded`/`aria-controls`; decorative elements are `aria-hidden`; icon buttons have `aria-label`; the notification badge announces count changes via `aria-live="polite"`. Every page has exactly one `<main id="main-content" tabIndex={-1}>` landmark — the skip-to-content link targets this element for keyboard focus management. All interactive content is contained within landmarks (`KeyboardCheatSheet` inside `<header>`, `Toaster` with `aria-label`). Heading hierarchy follows h1 → h2 → h3 with no level skips. All axe-core violations (critical, serious, AND moderate) are gated to zero — the 4 moderate violations (`landmark-one-main`, `skip-link`, `region`, `heading-order`) were remediated in TRACK-037.
- **Responsive mobile layouts:** User-facing data tables degrade to card layouts on small screens via the `flex sm:hidden` / `hidden sm:block` dual-render pattern (e.g., instructor `ProgressTable` shows per-student cards below the `sm` breakpoint; `CheckpointListEditor` rows stack with `flex-col sm:flex-row`; the `AssignmentWizard` surfaces the current step name on mobile). Admin-only tables keep horizontal scroll.
- **Action feedback & loading states:** All user-initiated mutations display a success toast via the `showSuccessToast` helper (`src/lib/toast.ts`), rendered by the global `<Toaster>` in `__root.tsx`. Route-level loading uses `pendingComponent` with reusable skeleton components (`DashboardSkeleton`, `TableSkeleton`, `AssignmentDetailSkeleton`); inline loading uses `Loader2` spinners. Error handling shows actual server error messages with inline retry banners for side-data fetches, and differentiates file upload errors (network vs server). File uploads to R2 use `XMLHttpRequest` with real-time progress tracking via `xhr.upload.onprogress` — the `FileUploader` displays a determinate progress bar when available, falling back to a spinner.
- **Search debounce & form validation:** Server-side search inputs use a custom `useDebouncedCallback` hook (300ms) to batch keystrokes into a single server request, with conditional X clear buttons. All user-facing forms (`ConsultationForm`, `ExtensionRequestForm`, `PasswordSection`) use `react-hook-form` + Zod with `onBlur` validation and per-field inline errors.
- **Optimistic UI updates:** 9 mutation sites (mark-as-read, consultation verify/reject, extension approve/reject, checkpoint unlock/extend, user delete) use TanStack Query's `onMutate`/`onError`/`onSettled` pattern to reflect predicted state changes instantly — before the server responds. A typed query-key factory (`src/lib/query-keys.ts`) centralizes cache invalidation keys for 9 domains: notifications, consultations, extensions, assignments, users, templates, discussions, settings, and gradebook. Zero inline string-array query keys remain in `src/**/*.tsx`. Rollback is guaranteed via snapshot capture/restore. Mutations with unpredictable server responses (e.g., `submitReview`) keep the standard refetch-on-success flow.
- **Invitation-only auth:** No self-registration. Admins create users; password setup happens via token-based invitation flow.
- **Email queue with retention & delivery tracking:** The background email processor sends emails in concurrent batches of 5 via `Promise.allSettled` (reducing cycle latency). Each successfully sent email stores a `resendMessageId` (visible in the admin queue inspector) for correlation with Resend's delivery dashboard. Automatic retention cleanup prunes `sent` rows older than 90 days and `failed` rows older than 180 days on a 24-hour tick-embedded cycle — `pending`/`processing` rows are never deleted.
- **Event email notifications:** 11 event types (submission received, review completed, revision requested, consultation verified/rejected, extension approved/rejected, extension requested, deadline reminder, student at risk, discussion reply) dispatch localized email notifications alongside existing in-app notifications. Emails are sent as **post-commit advisory work** — the primary operation always succeeds even if email enqueue fails. HTML templates are built by domain-specific helpers in `src/lib/email-templates.ts` with all user input HTML-escaped. Recipients with no verified email or soft-deleted accounts are silently skipped. Event email subjects are localized via i18n keys (prefixed `[SIMAK]`) with parameter interpolation support (e.g., `{assignmentTitle}` in deadline reminder subjects). Auth-related email subjects (invitations, password reset, 2FA enable/disable) are also localized via `resolveEmailSubject()` using the recipient's `locale` — no hardcoded English email subjects remain (TRACK-034).
- **Proactive deadline reminders:** A background scanner (`processDeadlineReminders()`) runs hourly alongside the email queue processor and sends tiered reminders (7-day, 3-day, 1-day lead times) to students whose checkpoint due dates are approaching. Non-overlapping tier bands prevent multiple reminders from firing simultaneously. A `deadline_reminders` dedup table with a unique constraint on `(checkpointId, tier)` ensures at-most-once delivery per tier per checkpoint, even across multiple server instances. The dedup insert and notification creation are wrapped in a single database transaction (atomicity); email dispatch runs post-commit via `Promise.allSettled` (advisory). Scanner failure is isolated via `try/catch` and does not affect email processing.
- **Notification UX:** Notifications are clickable links that navigate to relevant pages based on type + stored metadata. The notification center supports read/unread filtering and incremental "Load More" pagination (20 items per page) via TanStack Query's `useInfiniteQuery` — pages accumulate natively without manual `useState`/`useEffect` accumulation, and optimistic `markRead`/`markAllRead` mutations operate on the `{ pages, pageParams }` data shape. Polling runs at 30-second intervals with `refetchIntervalInBackground: false` (stops when tab is hidden) and a 30-second `staleTime` to minimize unnecessary refetches. `NotificationItem` is wrapped in `React.memo` and `NotificationCenter` uses `useMemo` for grouped notifications and unread count.
- **Notification preferences:** Users can opt out of specific notification types per channel (Email / In-app) in the Settings Hub. 13 notification types are organized into 4 groups (Reviews, Consultations, Submissions, System) with independent Email + In-app toggles (default all ON). Preferences are stored in the existing `users.settings` JSONB column (no separate table). The `updateUserSettingsHandler` uses a read-modify-write merge pattern to prevent `notificationPrefs` from overwriting `reducedMotion`. Security-critical emails (password reset, invitations, 2FA) are exempt from preference gating — always sent. SLA breach email alerts to admins are also always sent (bypasses the preference gate).
- **DOCX inline preview:** `.docx` submission files are previewed inline on the instructor review detail page via `mammoth.js` (lazy-loaded via dynamic import, rendered in a sandboxed iframe with `sandbox=""` — no script execution). A 10MB size guard prevents browser freezes on large files; conversion errors fall back to a "Preview not available" card with a download button.
- **Keyboard shortcuts:** A two-layer shortcut architecture: global shortcuts (`R` = refresh data, `?` = cheat-sheet popover) active on all authenticated pages, and review-specific shortcuts (`J`/`K` = navigate pending review queue) active only on the review detail page. Shortcuts are disabled when typing in inputs. The pending review list is preloaded on mount for instant J/K navigation.
- **Route prefetch:** Sidebar navigation links use `preload="intent"` so hovering a link prefetches the route's data/loader. The router's `defaultPreload` is `false` to avoid over-prefetching on the public landing page.
- **Analytics & reporting:** Role-based analytics dashboards at `/admin/analytics` and `/instructor/analytics` with URL-driven date ranges (`?range=7d|30d|90d|all`). All metrics are NEW (historical trends, verification/breach rates, response times) — they don't duplicate the real-time operational dashboards. No new DB tables; aggregate queries (`GROUP BY`, `date_trunc`) over existing data. CSV export via server function → client `Blob` download (with CSV formula-injection sanitization); Excel export via client-side SheetJS (reuses the existing `xlsx` dependency).
- **Rubric-based grading:** Template checkpoints can optionally have a grading type (`numeric` = direct 0–100 per criterion, `qualitative` = level-based scoring with configurable numeric mapping). Admins build rubrics (criteria with weights summing to 100%, qualitative levels with score mappings). Instructors score criteria during review; the system auto-computes a weighted total. Rubric scores are stored as a full denormalized snapshot (`criterionTitle`, `levelLabel`, `score`, `weight`) so completed reviews are unaffected by later rubric edits. The `updateTemplateHandler` uses upsert/diff to preserve checkpoint IDs across template edits (rubric FKs survive). Rubric analytics (avg per criterion, cross-instructor comparison) extend the existing dashboards, with CSV/Excel export of per-student criterion scores (formula-injection sanitized on both paths).
- **Gradebook & final grade computation:** A pure grade computation engine (`src/lib/grade-computation.ts`) aggregates rubric-based review scores and pass/fail checkpoint states into weighted final grades with configurable letter grade mapping. Per-assignment grade config (`assignment_grade_config` — scheme, custom weights, letter bounds) is auto-created on assignment creation and backfilled for pre-existing assignments. Computed grades are cached in a `final_grades` table and recomputed automatically on `pass` review decisions (post-commit advisory, never affects the review transaction) or manually via admin "Recompute All Grades" (wrapped in `db.transaction` for atomicity). Stale custom weights (sum≠100, missing/extra checkpoint entries) fall back to equal-weight averaging with a warning badge. Instructor gradebook view at `/instructor/assignments/$id/gradebook` with CSV/Excel export (formula-injection sanitized). Student final grade card with collapsible per-checkpoint breakdown. Admin grade distribution analytics (A/B/C/D/F progress bars).
- **At-risk student identification:** A pure function (`computeStudentRisk` in `src/lib/risk-scoring.ts`) evaluates 5 risk signals per student-checkpoint (overdue checkpoint=High, approaching deadline with no submission=Medium, insufficient consultations=Medium, repeated revise≥2=Medium, stalled review>3d=Low) and returns an overall risk level with contributing factors. Risk scores are ephemeral — computed on-demand from existing data, never persisted. The instructor dashboard displays an at-risk student widget (sorted by severity, i18n-localized factor descriptions, colored Badges, EmptyState when none). Event-driven alerts fire post-commit (advisory, try/catch) when an instructor submits a `revise` decision or an SLA breach occurs — dispatching in-app `student_at_risk` notifications + localized emails to the instructor via `Promise.allSettled` with 7-day dedup. The deadline reminder scanner also calls the risk alert function. Admin analytics shows aggregate at-risk counts (high/medium/low) with colored Badge UI. No new DB tables or migrations — all risk computation is derived from existing data.
- **Checkpoint discussions (Q&A):** Students and instructors can exchange lightweight async Q&A messages on a per-checkpoint basis via a `DiscussionPanel` component. Messages are threaded via `parentMessageId` (self-referencing FK). Users can delete their own messages within a 15-minute window (soft-delete — deleted messages render as "[deleted]" placeholders with replies preserved). A `discussion_reply` notification and localized email are dispatched to the other party as post-commit advisory work. The panel uses optimistic mutations (TanStack Query `onMutate`/`onError`/`onSettled`) and 30-second polling (`refetchInterval`) for near-real-time updates. Mounted on the student checkpoint detail page, instructor assignment detail (Discussions tab), and instructor review detail page. Ownership-gated: students can only view/post in their own checkpoints; instructors can view/post in any checkpoint within their assignments.
- **Orphaned R2 object cleanup:** A periodic cleanup scanner (`processOrphanedR2Objects()` in `src/lib/r2-cleanup.ts`) runs every 6 hours as part of the email queue tick loop, deleting R2 objects whose upload intents have expired without being consumed (`consumedAt IS NULL AND expiresAt < now()`). Deletes are parallelized via `Promise.allSettled` with per-object error isolation, and a `cleanedUpAt` timestamp marks intents after successful deletion (preserving the audit trail). Audit logs use `safeAuditLog` with `actorId: 'system'` for background runs. If R2 is not configured, the scanner is a no-op. Admins can manually trigger cleanup (bypassing the throttle) via a "Trigger R2 Cleanup" button on the `/admin/email-queue` page, which logs the action with the admin's userId as actor.
- **Health check endpoint:** A public, unauthenticated `GET /api/health` endpoint provides container orchestration health probes. It runs 3 parallel checks (each with a 2-second timeout): DB connectivity (`SELECT 1`), R2 reachability (`HeadBucketCommand` — returns `not_configured` if R2 env vars are absent, which is healthy), and email queue depth (`COUNT` of pending/processing rows — informational only). Returns HTTP 200 (healthy) or 503 (unhealthy). Error messages are generic to prevent information leakage on the public endpoint. The Dockerfile includes a `HEALTHCHECK` directive (`wget --spider` against `/api/health`) for Docker/Coolify liveness probes.
- **Structured logging:** All server-side logging uses `pino` (server-side only — not bundled with client code). JSON output to stdout in production (Docker/Coolify captures), pretty-printed in dev via `pino-pretty`. Every `typedServerFn` runs `requestIdMiddleware` before optional rate limiting; it propagates the client-provided `x-request-id` (or a generated UUID) through `AsyncLocalStorage`, and the pino `mixin` automatically includes it in server-function log entries without handler changes. The `logError()` helper in `src/lib/errors.ts` routes through `logger.error(entry)` with structured fields (`timestamp`, `code`, `message`, `cause`, `userId`, `handler`, `stack`, `input`) and `sanitizeInput()` redaction. Background jobs (email queue, deadline scanner, R2 cleanup) use `logger.child({ requestId: crypto.randomUUID() })` for trace correlation. Server handler advisory blocks use `logger.error({ event: 'advisory_failed', handler: '<fn>', error: '...' })`. Log level configurable via optional `LOG_LEVEL` env var (default `info`). Zero `console.*` calls remain in `src/lib/` and `src/server/` (excluding deployment scripts).
- **HTTP security headers:** A nonce-based Content-Security-Policy defends against XSS — the primary browser-level defense given the app's user-generated content. A per-request cryptographic nonce (`crypto.randomBytes(16)` → base64) is auto-attached to all inline `<script>`/`<style>` tags during SSR (theme script, hydration scripts) via TanStack Start's `ssr: { nonce }` router option — no manual nonce injection needed. CSP runs in Report-Only mode in dev (violations logged) and is enforced in prod. The `connect-src` directive dynamically includes the Cloudflare R2 domain (extracted from `R2_ENDPOINT`). Additional headers on all responses: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (disables geolocation/microphone/camera), and HSTS (prod-only, defense-in-depth behind Traefik TLS). CSRF middleware is explicitly wired via a `createStart` instance (`src/start.ts`) scoped to server-function requests.
- **Application-level rate limiting:** All 85 authenticated server functions are rate-limited via `typedServerFn`'s optional `rateLimit` config (Better Auth's built-in rate limiting only covers `/api/auth/*`). A 4-tier preset system (`RATE_LIMITS` in `src/lib/rate-limiter.ts`) applies limits per function class: `presignedUrl` (20/min — R2 cost abuse prevention), `heavyMutation` (10/min — submissions/reviews), `destructive` (5/min — admin CRUD, 2FA, session revocation), `standardRead` (60/min — dashboards, lists, detail views). The in-memory sliding window (`Map` keyed by `userId:fnId`) provides per-user + per-function isolation — unauthenticated requests pass through, and exceeding the limit returns a `RATE_LIMITED` error (mapped to `error.rateLimited` i18n key → user-facing toast). Exempt: `_getSession` (internal), `getUnreadCount`/`markRead`/`markAllRead` (high-frequency UX), `completePasswordSetup` (token-based). No handler changes — rate limiting is enforced at the middleware layer in stub files. Single-instance in-memory `Map` sufficient for current deployment (Redis deferred to multi-instance work).
- **Graceful shutdown & background processor drain:** `SIGTERM`/`SIGINT` handlers (`src/lib/shutdown.ts`, guarded by `import.meta.env.SSR`) ensure the 4 background jobs (email queue, deadline reminders, R2 cleanup, email retention) shut down cleanly on deploy/restart. The handler clears the `setInterval`, awaits the in-flight `tick()` to complete (drain), closes the DB pool via `closeDb()`, then exits 0. A second signal forces immediate exit(1) (standard container force-kill pattern). A configurable timeout (`SHUTDOWN_TIMEOUT_MS`, default 10s) forces exit(1) if the drain doesn't complete. On startup, `reclaimAllProcessingRows()` immediately resets ALL `processing` email queue rows to `pending` — since a fresh process start means no instance could be processing them, stuck rows from a crashed previous instance are reclaimed without waiting for the 5-minute in-tick threshold.

## Testing

- **Unit tests** (`tests/unit/`) — Mirror `src/` structure. Default environment is `happy-dom`; server handler tests use `/** @vitest-environment node */`. The 4 xlsx/Excel test files (incompatible with the `vmThreads` pool) run in a separate `threads` pool via Vitest's `projects` array in `vitest.config.ts` — no script-level flags needed.
- **Integration tests** (`tests/integration/`) — Excluded from the default test run via `vitest.config.ts` (not script flags). Run explicitly with `pnpm test:integration` (uses standalone `vitest.config.integration.ts`).
- **E2E tests** (`tests/e2e/`) — Playwright E2E tests (~73 tests across 14 spec files) covering critical user flows: auth route guards + invalid login, admin user management + edit/delete with reassignment, admin template CRUD, instructor assignment creation, student file submission + upload UI validation + cross-student access denial, instructor review workflow (decoupled tests) + notification assertions, consultation lifecycle (log → verify → gating UI), extension workflow (request → approve/reject → deadline adjustment), password setup lifecycle (token → setup → login → token reuse/expiry), role dashboard smoke tests, settings hub, smoke tests for 13 routes, rubric grading, checkpoint discussions Q&A, cross-role lifecycle integration, mobile viewport, and axe accessibility scans on 6 key pages. Runs on 3 browser projects: chromium (desktop), firefox (desktop), and mobile-chrome (Pixel 7). Uses a dedicated test database (`postgres-test` Docker service, port 5433). Run with `pnpm test:e2e` (headless) or `pnpm test:e2e:ui` (interactive). The global setup migrates, truncates, and seeds the test DB (7 users incl. Instructor2/Student2/Student3, pending consultation) before each run; each spec file resets the DB for isolation.
- **Coverage thresholds:** lines, functions, branches, and statements all >= 80%.

## Deployment

The app is deployed via Docker on a VPS using Coolify. The multi-stage Dockerfile builds the app and bundles migration + seed runners. See the [Coolify private-pilot deployment runbook](docs/deployment-runbook.md) for the environment inventory, deployment, health, backup/restore, and rollback procedures.

The current private-pilot deployment uses a direct private PostgreSQL connection without PgBouncer, so `MIGRATE_DATABASE_URL` points directly to PostgreSQL and `DB_PREPARED_STATEMENTS_DISABLED` remains unset. If a future deployment adds transaction-mode PgBouncer, set `DB_PREPARED_STATEMENTS_DISABLED=true` so the postgres.js client uses `prepare: false`, and keep `MIGRATE_DATABASE_URL` pointed at a direct database connection for migrations. The application pool (`src/db/index.ts`) is configured with explicit lifecycle options (`DB_POOL_MAX` default 10, 30s idle timeout, 10s connect timeout, 30-min max lifetime), reads `DATABASE_URL` via Zod-validated `getEnv()`, and routes PostgreSQL notices through the structured `pino` logger.

```bash
docker build -f docker/Dockerfile -t simak .
```

## License

Private project.
