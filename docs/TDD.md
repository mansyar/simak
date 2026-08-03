# Technical Design Document (TDD)

## 1. Technology Stack

| Layer              | Technology                      | Rationale                                                                                           |
| ------------------ | ------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Language**       | TypeScript 7.0                  | Native Go compiler port (~6x faster type-checking). Strict mode, path aliases, incremental builds. |
| **Framework**      | TanStack Start (Vite + SSR)     | Full-stack React meta-framework with type-safe routing, server functions, and fast Vite dev server. |
| **Routing**        | TanStack Router                 | File-based routing with type-safe params and search params. Zod integration for runtime validation. |
| **Server State**   | TanStack Query                  | Native TanStack Start integration. Caching, deduplication, background refetching.                   |
| **UI Library**     | shadcn/ui (Radix UI primitives) | Accessible, composable components with built-in ARIA compliance.                                    |
| **Styling**        | Tailwind CSS v4                 | Utility-first CSS with design system integration.                                                   |
| **Validation**     | Zod                             | Runtime schema validation for forms and API inputs.                                                 |
| **Forms**          | React Hook Form + Zod           | Performant forms with validation resolver.                                                          |
| **Authentication** | Better-Auth                     | Framework-agnostic auth with email/password, session management, role support.                      |
| **Database**       | PostgreSQL                      | Relational data model with strong integrity constraints.                                            |
| **ORM**            | Drizzle ORM                     | Type-safe SQL-first ORM. Lightweight, no code generation, runs natively in server functions.        |
| **File Storage**   | Cloudflare R2                   | S3-compatible object storage with presigned URL uploads.                                            |
| **Email**          | Resend                          | Transactional email API for invitations and password setup.                                         |
| **Logging**        | pino                             | Structured JSON logger (server-side only). `pino-pretty` in dev. `LOG_LEVEL` env var (default `info`). |
| **i18n**           | typesafe-i18n                   | Type-safe translations with compile-time checks. Works in both client and server functions.         |
| **Testing**        | Vitest + Playwright + @axe-core/playwright | Vitest for unit and integration tests; Playwright for E2E (chromium + firefox + mobile-chrome projects); @axe-core/playwright for automated WCAG 2.1 AA accessibility scanning in E2E tests. |
| **Deployment**     | Docker + Coolify                | Completed private-pilot deployment on Coolify with a single application instance and managed PostgreSQL. |

### Operational backup boundary

The completed TRACK-048 review documents the current private-pilot backup boundary
without adding application backup code: Coolify manages daily PostgreSQL backups with
seven retained copies in Coolify server storage and remote S3-compatible storage.
Restore is an operator-only, isolated-first procedure. Broader retention policy,
independent scheduling, job-level failure visibility, backup credential separation,
and R2 durability/versioning changes remain follow-up recommendations and are not
implemented by the application runtime. See [backup-restore-readiness.md](backup-restore-readiness.md)
and [deployment-runbook.md](deployment-runbook.md) for the operational evidence and
procedure.

### MVP Scope Legend

Throughout this document, features are tagged as:

- **[v1] MVP** — required for the initial release.
- **[v2] Post-MVP** — deferred to a later iteration.

---

## 2. Application Architecture

### Route Structure

```
/                                         → Landing page (Hero, Features Grid, How It Works, Footer) [v1]

/ (authenticated — shared routes)
│   No shared settings route — replaced by role-specific routes below

/ (authenticated — student)
├── /student                              → Student sidebar layout
│   ├── /student/dashboard                → Student dashboard with summary widgets [v1]
│   ├── /student/settings                 → Student settings hub plus timezone and private calendar-feed controls [v1]
│   ├── /student/assignments              → Assignment list [v1]
│   ├── /student/assignments/$id          → Assignment detail with checkpoints [v1]
│   │   └── /student/assignments/$id/
│   │       └── checkpoints/$checkpointId → Single checkpoint submission [v1]
│   ├── /student/progress                 → Progress tracking [v2]
│   └── /student/files                    → File manager [v2]

/ (authenticated — instructor)
├── /instructor                           → Instructor sidebar layout
│   ├── /instructor/dashboard             → Instructor dashboard with summary widgets [v1]
│   ├── /instructor/settings              → Settings hub (profile, password, appearance, accessibility) [v1]
│   ├── /instructor/assignments           → All assignments [v1]
│   ├── /instructor/assignments/new       → Assignment creation wizard [v1]
│   ├── /instructor/assignments/$id       → Assignment detail (instructor view) [v1]
│   │   └── /instructor/assignments/$id/gradebook → Gradebook view and owner-controlled grade release (students × checkpoints → final grade) [v1]
│   ├── /instructor/reviews               → Review queue [v1]
│   ├── /instructor/interventions         → Private at-risk intervention management [v1]
│   ├── /instructor/analytics             → Instructor performance analytics [v1]
│   ├── /instructor/feedback-snippets     → Private instructor feedback snippet library [v1]
│   └── /instructor/reports               → Report builder & history [v2]

/ (authenticated — admin)
├── /admin                                → Admin sidebar layout
│   ├── /admin/dashboard                  → Admin dashboard with system metrics [v1]
│   ├── /admin/settings                   → Settings hub (profile, password, appearance, accessibility) [v1]
│   ├── /admin/users                      → User management [v1]
│   ├── /admin/templates                  → Template list [v1]
│   ├── /admin/templates/$id              → Template editor [v1]
│   ├── /admin/audit-log                  → Audit log viewer
│   ├── /admin/email-queue                → Email queue inspector (paginated, filterable, retry failed) [v1]
│   ├── /admin/analytics                  → System analytics [v1]
│   └── /admin/settings                   → System configuration [v2]

/ (unauthenticated)
├── /auth/login                           → Login page [v1]
├── /auth/verify-2fa                   → 2FA TOTP code input [v1]
├── /auth/verify-backup-code           → Backup code fallback [v1]
└── /auth/setup-password                  → Password setup from invitation [v1]
```

### Route Layout Hierarchy

- **`__root.tsx`** — Top-level providers (theme, query client).
- **`_unauthenticated.tsx`** — Layout for public pages (login, password setup). Redirects to role-specific dashboard if already authenticated.
- **`_authenticated.tsx`** — Auth guard. Checks session, redirects to login if unauthenticated.
- **`_student.tsx`** — Student sidebar layout. `beforeLoad` guards that user role === student. All `/student/*` routes inherit this layout.
- **`_instructor.tsx`** — Instructor sidebar layout. `beforeLoad` guards role === instructor. All `/instructor/*` routes inherit this layout.
- **`_admin.tsx`** — Admin sidebar layout. `beforeLoad` guards role === admin. All `/admin/*` routes inherit this layout.

The role-specific layout guard means a student accessing `/instructor/reviews` is redirected automatically — no per-route checks needed. The `requireRole()` helper redirects unauthorized users to their own role-specific dashboard via `getRoleDashboard()`.

### Project Structure

```
simak/
├── src/
│   ├── start.ts              → TanStack Start `createStart` instance — `securityHeadersMiddleware` (nonce-based CSP) + `createCsrfMiddleware` (TRACK-041)
│   ├── routes/               → TanStack Router route files (file-based routing in `src/routes/`)
│   ├── app/                  → Application root files (global.css, legacy __root.tsx location)
│   ├── components/           → React components
│   │   ├── ui/               → shadcn/ui primitives
│   │   ├── layout/           → Sidebar (student, instructor, admin — dark navy variants), header (sticky, backdrop blur), language switcher, theme toggle
│   │   ├── dashboard/        → Role-specific dashboard components (StudentDashboard, StudentNextActions, InstructorDashboard, AdminDashboard with metric cards)
│   │   ├── student/
│   │   │   └── assignments/  → Student assignment card, filters, checkpoint timeline, checkpoint card, detail header, empty state, loading skeleton; RevisionActionPlan on checkpoint detail
│   │   ├── instructor/
│   │   │   ├── assignments/  → Assignment wizard, template picker, student picker, progress table, card, filters, empty state, loading skeleton
│   │   │   └── feedback-snippets/ → Private snippet management page, form, and cards (TRACK-049)
│   │   ├── reviews/          → Review dialog, review queue, feedback upload, DeadlineManager, ReviewFilePreview (PDF + DOCX inline preview via mammoth.js), RubricScoringSection (instructor scoring UI), RubricResultView (student view), RevisionActionPlanEditor, ReviewHistory action-plan display
│   │   ├── gradebook/        → GradebookTable, GradeConfigSummary, GradeSettingsDialog, GradeReleaseControls, StudentFinalGradeCard, GradebookExportButtons, RecomputeGradesButton
│   │   ├── consultations/    → Log form, consultation list, progress bar, verification queue item, verification dialog
│   │   ├── interventions/    → Intervention list, filters, live-risk context, form, and loading skeleton
│   │   ├── discussions/      → DiscussionPanel (ScrollArea, Avatar, message bubbles, optimistic mutations, 30s refetchInterval)
│   │   ├── files/            → File upload, preview, file list
│   │   ├── notifications/    → Notification center, badge, notification-routes (type→route map)
│   │   ├── analytics/        → Charts, metric cards, export
│   │   ├── settings/         → SettingsPage, ProfileSection, PasswordSection, AppearanceSection, AccessibilitySection, NotificationPreferencesSection, TimezoneSettingsSection, CalendarFeedSettingsSection
│   │   ├── skeletons/        → Reusable loading skeletons (DashboardSkeleton, TableSkeleton, AssignmentDetailSkeleton)
│   │   ├── admin/            → User table, template builder, template cards, pagination, filters, empty state, loading skeleton, email queue inspector subcomponents (summary cards, filters, table, retry dialog)
│   │   └── keyboard-cheat-sheet.tsx → Popover showing all keyboard shortcuts (greys out review-specific J/K when not on review page)
│   ├── server/               → Server functions (split: .ts = client-safe stubs + Zod using `typedServerFn` from `@/lib/server-fn`, .server.ts = handlers)
│   │   ├── auth.ts           → Client-safe stub: Session type, getSessionFromHeaders, requireRole, _getSession (dynamic import)
│   │   ├── auth.server.ts    → Session handler: Better Auth validation, DB query, 5s-TTL in-memory cache
│   │   ├── users.ts          → User CRUD, invitations
│   │   ├── assignments.ts    → Assignment CRUD (instructor + student queries)
│   │   ├── assignments.server.ts → Server-only assignment handlers (createAssignment, listInstructor, getDetail — re-exports handlers from extras + admin files)
│   │   ├── assignments-admin.server.ts → Admin-only assignment handler (`reassignAssignmentHandler` — extracted to stay under 500-line limit, multi-handler pattern) (TRACK-040)
│   │   ├── submissions.ts    → Upload, versioning
│   │   ├── reviews.ts        → Review, pass/revise, optional revision-action plan validation
│   │   ├── revision-action-items.ts → Revision-action item schemas and client-safe mutation stub
│   │   ├── revision-action-items.server.ts → Rubric snapshot insertion and student addressed-status handlers
│   │   ├── feedback-snippets.ts → Private snippet schemas/stubs (TRACK-049)
│   │   ├── feedback-snippets.server.ts → Instructor-owned snippet handlers (TRACK-049)
│   │   ├── consultations.ts  → Log, list, verify, reject, detail, counts (split: .ts stubs + .server.ts handlers)
│   │   ├── interventions.ts  → Intervention Zod schemas and typed server-function stubs
│   │   ├── interventions.server.ts → Instructor-only intervention creation, listing, context, and locked lifecycle handlers
│   │   ├── student-risk-context.server.ts → Shared live student-assignment risk aggregation for dashboard and interventions
│   │   ├── discussions.ts    → Discussion Q&A stubs + Zod schemas (list, post, delete) + typedServerFn (split: .ts stubs + .server.ts handlers)
│   │   ├── discussions.server.ts → Discussion handlers (list paginated, post with notification+email, delete with 15-min window) — ownership: student owns checkpoint OR instructor owns assignment
│   │   ├── notifications.ts  → Create, fetch, mark read
│   │   ├── notifications.server.ts → Server-only notification handlers
│   │   ├── templates.ts      → Template CRUD
│   │   ├── templates.server.ts → Server-only template handlers
│   │   ├── rubrics.ts         → Rubric CRUD stubs + Zod schemas (saveRubric, getRubric, soft-delete)
│   │   ├── rubrics.server.ts  → Server-only rubric handlers (criteria/levels CRUD, admin-only)
│   │   ├── review-scores.server.ts → Review score validation + insertion helpers (validateReviewScores, insertReviewScores)
    │   │   ├── audit-log.ts       → Audit log query stubs + Zod schemas
    │   │   ├── audit-log.server.ts  → Server-only audit log handlers
    │   │   ├── email-queue.ts      → Email queue inspector stubs (listEmailQueue, retryEmail) + Zod schemas + shared types
    │   │   ├── email-queue.server.ts → Server-only email queue handlers (list, retry with FOR UPDATE)
    │   │   ├── setup-password.ts → Password setup stub (Zod schema + typedServerFn stub with dynamic import) + setup-password.server.ts → Handler (token validation, password hashing, serverError pattern)
│   │   ├── files.ts          → Presigned URL generation
│   │   ├── r2-cleanup.ts     → R2 cleanup stub (triggerR2Cleanup admin-only server fn + Zod schema)
│   │   ├── r2-cleanup.server.ts → R2 cleanup handler (admin-only, calls processOrphanedR2Objects bypassing throttle, audit logs with admin userId)
│   │   ├── settings.ts       → Settings hub stubs (including validated IANA timezone settings)
│   │   ├── settings.server.ts → Settings hub handlers (including normalized timezone persistence)
│   │   ├── calendar-feed.ts  → Client-safe calendar feed lifecycle stubs
│   │   ├── calendar-feed.server.ts → Transactional token enable/status/regenerate/revoke handlers
│   │   ├── calendar-feed-selection.server.ts → Membership-aware authoritative event selection
│   │   ├── calendar-feed-route.server.ts → Bearer verification and private feed response handler
│   │   ├── two-factor.ts     → 2FA stubs + Zod schemas
│   │   ├── two-factor.server.ts → 2FA server handlers
│   │   ├── sessions.ts       → Session management stubs + Zod schemas
│   │   ├── sessions.server.ts → Server-only session handlers (list, revoke)
│   │   ├── dashboard.ts      → Dashboard data stubs (student, instructor, admin)
│   │   ├── dashboard.server.ts → Re-exports from per-role handler files
│   │   ├── dashboard-student.server.ts → Student dashboard handler
│   │   ├── dashboard-instructor.server.ts → Instructor dashboard handler
    │   │   ├── dashboard-admin.server.ts → Admin dashboard handler
    │   │   ├── analytics.ts          → Analytics stubs (admin/instructor data + CSV export) + Zod schemas
    │   │   ├── analytics-admin.server.ts → Admin aggregate queries (verification rate, breach rate, trends, DAU/WAU)
    │   │   ├── analytics-instructor.server.ts → Instructor-scoped metrics (response time, SLA breaches)
    │   │   ├── analytics-export.server.ts → CSV export handlers (users, audit log, progress, review history)
    │   │   ├── bulk-import.ts      → Bulk import server fn stubs + Zod schemas (users, templates)
    │   │   └── bulk-import.server.ts → Server-only bulk import handlers (parse, validate, insert)
│   │   ├── gradebook.ts         → Gradebook and release server-fn stubs (student grade, gradebook, config, recompute, preflight, publish, withdraw) + Zod schemas
│   │   ├── gradebook.server.ts  → Server-only gradebook handlers (student active-snapshot gating, gradebook view, config upsert, batch recompute)
│   │   ├── gradebook-extras.server.ts → Owner-locked release preflight, publication, withdrawal, versioning, and audit handlers
    │   │   └── health.server.ts    → Health check handler (runHealthChecks — DB, R2, email queue checks with 2s timeouts, generic error messages)
│   ├── db/
│   │   ├── schema/           → Drizzle schema (split by domain, including revision action items)
│   │   ├── index.ts          → Database client — postgres.js + Drizzle with explicit pool config (`max`/`idle_timeout`/`connect_timeout`/`max_lifetime`/`prepare`), `onnotice` routed through pino, `getDb()` uses `getEnv()`. `closeDb()` closes the pool via `client.end()` for graceful shutdown. (TRACK-042, TRACK-045)
│   │   └── migrate.ts        → Migration runner
│   ├── auth/
│   │   └── config.ts         → Better-Auth setup
│   ├── i18n/                 → Translation init + locale detection
│   ├── lib/
│   │   ├── email.ts          → Resend client + `resolveEmailRecipient()` (returns `{email, locale, settings}` or null for soft-deleted/unverified — `settings` included for notification preference gating)
│   │   ├── email-templates.ts → 11 localized HTML template builders for event emails (including `buildStudentAtRiskHtml`, `buildDiscussionReplyHtml`) + shared header/footer helpers
│   │   ├── event-email.ts    → `enqueueEventEmail()` generic post-commit advisory email dispatch (never throws; supports `subjectParams` for email subject interpolation; preference gate — skips enqueue when `recipient.settings.notificationPrefs[notifType].email === false`; security types exempt via `EMAIL_GATE_EXEMPT` set; optional `notificationType` param for type-mismatch resolution)
│   │   ├── submission-email.ts → `sendSubmissionReceivedEmail()` helper
│   │   ├── review-email.ts   → `sendReviewEmail()` helper (pass/revise)
│   │   ├── consultation-email.ts → `sendConsultationEmail()` helper (verified/rejected)
│   │   ├── extension-email.ts → `sendExtensionApprovedEmail()`, `sendExtensionRejectedEmail()`, `sendExtensionRequestedEmail()` helpers (with optional `notificationType` param for preference-gate type-mismatch resolution)
│   │   ├── discussion-email.ts → `sendDiscussionReplyEmail()` helper (wraps `enqueueEventEmail` with `buildDiscussionReplyHtml`, matching `review-email.ts` pattern)
│   │   ├── notification-prefs.ts → `shouldSendInAppNotification(settings, type)` pure helper + `maybeInsertNotification(db, userId, type, values)` helper (conditional in-app notification insert). Used at 13 notification creation sites to gate in-app delivery on user preferences.
│   │   ├── deadline-reminder-scanner.ts → `processDeadlineReminders()` — hourly background scanner for tiered deadline reminders (7d/3d/1d), dedup via `deadline_reminders` table
│   │   ├── deadline-reminder-email.ts → `sendDeadlineReminderEmail()` helper (wraps `enqueueEventEmail` with `buildDeadlineReminderHtml`)
│   │   ├── risk-scoring.ts   → Pure function `computeStudentRisk(data): RiskAssessment` — 5 risk signals (overdue, approaching deadline, insufficient consultations, repeated revise, stalled review); ephemeral, never persisted
│   │   ├── student-next-actions.ts → Pure deterministic resolver for checkpoint action eligibility, priority/deduplication, precise destinations, submitted/under-review waiting summaries, and unresolved current-plan context (TRACK-053, TRACK-054)
│   │   ├── risk-alerts.ts    → `checkAndFireRiskAlert(db, opts)` — advisory post-commit alert with 7-day dedup via notifications table; fires in-app notification + email via `Promise.allSettled`
│   │   ├── review-risk-alert.ts → `maybeFireReviewRiskAlert(db, decision, breachDays, slaFields, instructorId)` — wrapper called from `submitReviewHandler` when revise or SLA breach
│   │   ├── at-risk-email.ts  → `sendStudentAtRiskEmail(opts)` helper (wraps `enqueueEventEmail` with `buildStudentAtRiskHtml`)
    │   │   ├── storage.ts        → R2 client
    │   │   ├── r2-cleanup.ts    → `processOrphanedR2Objects(actorId)` — periodic scanner for orphaned R2 objects (runs in email-queue tick loop, 6h throttle, `Promise.allSettled` parallel deletes, no-op if R2 not configured)
│   │   ├── toast.ts          → Toast helpers (showSuccessToast, showErrorToast) — wraps sonner
│   │   ├── grade-computation.ts → Pure grade computation engine (computeFinalGrade, types: GradingScheme, CheckpointGradeInput, FinalGradeResult, ContributingCheckpoint, AssignmentGradeConfig). No DB access.
│   │   ├── route-utils.ts    → Role-based dashboard routing utility
    │   │   ├── role-permissions.ts → Canonical CREATION_ALLOWED_ROLES (shared by user creation + bulk import)
    │   │   ├── session-guards.ts → Shared client-safe type-guard functions (isAdmin, isInstructor, isStudent, isAuthenticated) — accept `NonNullableSession | null`, return `session is NonNullableSession` (TRACK-031)
     │   │   ├── server-fn.ts     → Type-preserving `typedServerFn` alias for `createServerFn`, plus explicit `serverFnMiddlewares()` composition for request IDs and optional rate limiting. Client-safe stubs dynamically import server-only handlers inside callbacks.
    │   │   ├── bulk-import/      → Client-side xlsx parsing (parse-users, parse-templates, samples)
      │   │   ├── query-keys.ts      → Typed query-key factories (notificationKeys, consultationKeys, extensionKeys, assignmentKeys, userKeys, templateKeys, discussionKeys, settingsKeys including currentUser/accessibility/calendarFeed, gradebookKeys, feedbackSnippetKeys)
    │   │   ├── logger.ts         → Singleton `pino` logger instance — JSON to stdout in prod, `pino-pretty` in dev (lazy-loaded via `createRequire`). `LOG_LEVEL` env var (default `info`). A pino `mixin` adds the current AsyncLocalStorage request ID to every log entry. `createLogger(options?)` factory. Server-side only. (TRACK-040, TRACK-044)
    │   │   ├── request-context.ts → `requestIdMiddleware` (TanStack Start `createMiddleware`) + `createRequestLogger(context)` — reads `x-request-id` header or generates UUID, then scopes it through AsyncLocalStorage for automatic logger propagation. Wired globally by `typedServerFn`. (TRACK-040, TRACK-044)
    │   │   ├── request-context-store.ts → `AsyncLocalStorage<RequestContext>` and `getRequestId()` helper for request-scoped logging context. (TRACK-044)
    │   │   ├── security-headers.ts → Pure functions `generateNonce()` (`crypto.randomBytes(16).toString('base64')`) + `buildSecurityHeaders(nonce, isProd, r2Domain?)` (returns header name→value map). CSP directive assembly + Report-Only/enforce switching. (TRACK-041)
     │   │   ├── rate-limiter.ts   → Bounded in-memory sliding-window limiter. Exports the four authenticated `RATE_LIMITS` tiers plus the public `calendarFeed` limit, session middleware, anonymous/student calendar keys, expiry cleanup, and `resetRateLimitStoreForTests()`. Public feed limiting does not trust forwarded client-IP headers. (TRACK-043, TRACK-055)
    │   │   ├── shutdown.ts       → `registerShutdownHandlers()` — SIGTERM/SIGINT handler (guarded by `import.meta.env.SSR`): clears `setInterval`, awaits in-flight `tick()` via `stopGracefully()` (drain), closes DB pool via `closeDb()`, then `process.exit(0)`. Second signal forces `process.exit(1)`. Configurable timeout via `SHUTDOWN_TIMEOUT_MS` (default 10000ms). (TRACK-045)
    │   │   └── utils.ts          → Shared utilities
│   ├── hooks/               → Custom React hooks
│   │   ├── use-debounced-callback.ts → Generic debounce hook (setTimeout/clearTimeout, 300ms for search inputs)
│   │   ├── use-keyboard-shortcuts.ts → Global keyboard shortcuts (R=refresh, ?=cheat-sheet) — mounted in _authenticated.tsx
│   │   ├── use-review-nav.ts → Review-specific shortcuts (J/K queue navigation) — preloads pending list on mount
│   │   ├── use-notifications.ts → Notification hooks (useMarkRead, useMarkAllRead with optimistic updates on useInfiniteQuery page shape, useUnreadCount, useNotificationsList via useInfiniteQuery)
│   │   └── use-assignment-tabs.ts → Assignment tab hooks (approveExtension, rejectExtension with optimistic updates; consultations/extensions via useQuery)
│   └── config/
│       └── env.ts            → Validated environment variables (Zod `envSchema`; `Env` type = `z.infer<typeof envSchema>` — single source of truth, TRACK-031). Includes `LOG_LEVEL` (optional, default `info` — TRACK-040), `DB_POOL_MAX` (optional, default `10`), `DB_PREPARED_STATEMENTS_DISABLED` (optional, default `false` — string → `val === 'true'` transform, deliberately avoids `z.coerce.boolean()` — TRACK-042), and `SHUTDOWN_TIMEOUT_MS` (optional, default `10000` — graceful shutdown drain timeout in ms, TRACK-045).
├── locales/                  → typesafe-i18n translation files
│   ├── en.json               → English translations
│   └── id.json               → Indonesian translations
├── tests/
│   ├── unit/                 → Vitest unit tests
│   ├── integration/          → Vitest integration tests
│   └── e2e/                  → Playwright E2E tests (chromium + firefox + mobile-chrome, 23 spec files including Student Next Actions, revision action plans, timezone/calendar, grade-release, feedback-snippet, and intervention workflow coverage, includes @axe-core/playwright a11y scans)
├── docker/
│   └── Dockerfile
├── drizzle.config.ts
├── package.json
├── tsconfig.json
└── .env.example
```

### Dashboard Widgets [v1]

Each role gets a dedicated dashboard page rendered within its role layout (`_student`, `_instructor`, `_admin`). After login, users are redirected to their role's dashboard based on their role:

- `student` → `/student/dashboard`
- `instructor` → `/instructor/dashboard`
- `superadmin` / `admin` → `/admin/dashboard`

| Role           | Dashboard Route         | Widgets                                                                                                                                                                                                                                                                                    |
| -------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Student**    | `/student/dashboard`    | Next Actions (prioritized submit/revise/required-consultation actions, maximum 5, plus up to 3 unresolved items from the current revision plan on revise actions and submitted/under-review waiting summaries with maximum 3 representative links), Active Assignments (card grid with progress bars), Upcoming Deadlines (next 5, color-coded urgency, overdue badges), Pending Reviews (submissions under review, wait times), Consultation Reminders (pending verifications) |
| **Instructor** | `/instructor/dashboard` | Pending Review Queue (count + FIFO list with SLA badges: On Time/Approaching/Breached), Recent Submissions (last 5 with status badges), Assignment Overview (cards with student count, pending count, progress), At-Risk Students (sorted by severity: high/medium/low with colored Badges, factor descriptions via i18n, link to assignment detail, EmptyState when none), Quick Actions (Go to Review Queue, Manage Assignments)                    |
| **Admin**      | `/admin/dashboard`      | System Metrics (6 cards: Total Users, Instructors, Students, Active Assignments, Pending Reviews, Active Consultations), Recent Activity Feed (last 10 events, 7 days), Deadline Escalation Alerts (SLA breaches >3 days with red styling), Quick Actions (Manage Users, Manage Templates) |

Widget data is fetched via a single **aggregated server function** per role. Each handler verifies session + role, executes multiple Drizzle queries, and returns a pre-shaped payload. The student handler resolves Next Actions from authoritative checkpoint, submission, review, consultation, and current revision-plan state in the same response; a student-scoped batch query loads only the newest action-item plan per checkpoint, filters addressed items, and applies the existing display caps without persisting a second task system. All widgets show appropriate empty states when no data is available.

Query key: `['dashboard']` with role differentiation handled server-side.

### Analytics & Reporting [v1] (Track: Analytics & Reporting)

Role-based analytics dashboards complement (do not duplicate) the real-time operational dashboards. Dashboards show current snapshots; analytics show historical trends and NEW metrics over selectable date ranges.

- **Routes:** `/admin/analytics` (admin/superadmin via `requireRole(['admin'])`) and `/instructor/analytics` (instructor via `requireRole(['instructor'])`). Both are linked from their role-specific sidebars (BarChart3 icon).
- **Date range:** URL search params drive the range (`?range=7d|30d|90d|all`) with optional custom start/end. Routes use `validateSearch` + `loaderDeps` so URLs are shareable and back/forward navigation works. A shared `resolveDateRange` helper converts the range token into `{ dateFrom, dateTo }`, and a `dateCondition` helper builds the `WHERE created_at >= ?` SQL fragment.
- **Server function split:** `src/server/analytics.ts` exports Zod schemas + `typedServerFn` stubs (with `.inputValidator(Schema).handler(...)` builder pattern + dynamic imports). Three handler files:
  - `analytics-admin.server.ts` — 9 parallel aggregate queries via `Promise.all` (consultation verification rate, deadline breach rate, assignment status distribution by checkpoint state, submission/review volume trends via `date_trunc`, reviews completed, DAU/WAU, at-risk student summary with high/medium/low counts).
  - `analytics-instructor.server.ts` — instructor-scoped queries (reviews completed, avg response time via `EXTRACT(EPOCH FROM reviewedAt - uploadedAt)`, SLA breach count where `EXTRACT(EPOCH FROM reviewedAt - uploadedAt) > 259200` (3 days), students supervised, assignments active).
  - `analytics-export.server.ts` — 5 CSV export handlers (admin: users, audit log with date filtering, assignment progress; instructor: student progress, review history — both with ownership checks returning `NOT_FOUND` if the assignment is not owned).
- **No new DB tables:** All metrics derive from aggregate queries (`GROUP BY`, `date_trunc`) over existing tables. No migrations required.
- **CSV export:** Server function returns a CSV string; the client creates a `Blob` + `URL.createObjectURL` download (via `src/lib/download.ts` + `src/hooks/use-csv-download.ts` with loading/error state). CSV cell values are sanitized against formula injection (CWE-1236) — cells starting with `=`, `+`, `-`, `@`, TAB, or CR are prefixed with `'` (via `escapeCsvValue`).
- **Excel export:** Client-side SheetJS (`src/lib/excel-export.ts`) generates `.xlsx` files via `xlsx.utils.book_new()` + `json_to_sheet()` + `write()`. Reuses the existing `xlsx` dependency (already used for bulk-import) — no new dependency. "Export Excel" buttons on both analytics pages.
- **Export buttons on existing pages:** "Export CSV" buttons added to `/admin/users`, `/admin/audit-log`, and `/instructor/assignments/$id` (assignment progress / student progress / review history respectively).
- **UI:** MetricCard grid + trend data tables + progress bars. No charting library — tables and progress bars only (defer Recharts unless visual charts are requested).
- **i18n:** All labels/headers in both `locales/en.json` and `locales/id.json` (`analytics.*` + `analyticsInstructor.*` namespaces).
- **Rubric analytics (Track: Rubric-Based Grading):** Instructor and admin analytics extended with rubric-level metrics — average score per criterion, criterion-level weakness analysis, and cross-instructor criterion performance comparison. CSV/Excel exports include per-student criterion scores. The Excel export path sanitizes string cells against formula injection (matching the CSV path's `escapeCsvValue` mitigation).

### Hybrid Navigation Pattern

- **Dashboard as hub**: Each role gets a dedicated dashboard (`/student/dashboard`, `/instructor/dashboard`, `/admin/dashboard`) with summary widgets and quick actions. [v1]
- **Role-based redirects**: After login, users are redirected to their role's dashboard. The `_unauthenticated` layout redirects authenticated users to their role-specific dashboard via `getRoleDashboard()`. [v1]
- **Dedicated pages**: Complex workflows have full-featured pages linked from the dashboard. [v1]
- **Context-aware navigation**: Breadcrumbs and back-links preserve workflow context. [v2]

### List Views & Pagination [v1]

All list views (assignments, reviews, users, notifications, consultations, submissions, templates, extension requests) implement offset-based pagination:

- **20 items per page** as default page size (max 100 via Zod `max(100)` cap).
- **Server-side pattern:** Each list handler accepts `page` (Zod `z.coerce.number().int().min(1).default(1)`) and `limit` (Zod `z.coerce.number().int().min(1).max(100).default(20)`) params. The data query and a `SELECT count(*)::int` query run in parallel via `Promise.all`. The response includes a `total` field for client-side page count calculation.
- **Client-side pattern:** Page state is persisted in TanStack Router search params (e.g. `?page=2`) so the URL is shareable. A shared `<Pagination>` component renders when `totalPages > 1`.
- **Dashboard safety caps:** Inline dashboard widgets (`activeAssignments` on student dashboard, `assignmentOverview` on instructor dashboard) use a hardcoded `.limit(20)` safety cap since they cannot be independently paginated. Next Actions loads all eligible candidates before applying its five-primary and three-waiting-representative display caps so ranking and waiting counts are complete.
- **Loading state**: skeleton rows while the next page loads. Prefetch next page on scroll near the bottom.
- **Empty list conditional**: Pagination controls are hidden when the list is empty (`{items.length > 0 && <Pagination .../>}`). Prevents confusing empty-page navigation. Applied in `admin/users/index.tsx` and `student/assignments/index.tsx`.
- **[v2]**: Migrate to cursor-based pagination for submission histories and audit logs (append-only data where offset pagination drifts).

### Action Feedback & Loading States [v1]

All user-initiated mutations and data-fetching surfaces provide consistent feedback via three patterns:

- **Success toasts:** A `showSuccessToast(message)` helper in `src/lib/toast.ts` (mirroring `showErrorToast`) wraps `sonner`'s `toast.success()`. Every action `onSuccess` handler across the app calls it with a localized message: consultation logging, user CRUD, deadline unlock/extend, consultation verify/reject, extension approve/reject, profile/password changes. The global `<Toaster richColors position="top-right" />` in `__root.tsx` renders all toasts — the helper applies no per-call duration or position overrides, so success and error toasts share sonner's default styling. All toast messages use `t('key')` with keys in both `locales/en.json` and `locales/id.json` (enforced by the `simak-i18n/no-hardcoded` lint rule). No action completes silently.

- **Loading skeletons & spinners:** Route-level loading uses TanStack Router's `pendingComponent` with three reusable skeleton components in `src/components/skeletons/`:
  - `DashboardSkeleton` — metric cards + grid layout for all three role dashboards (`/student/dashboard`, `/instructor/dashboard`, `/admin/dashboard`).
  - `TableSkeleton` — header + rows for tabular list pages (`/admin/users`, `/admin/audit-log`).
  - `AssignmentDetailSkeleton` — checkpoint timeline + side panels for `/instructor/assignments/$id`.

  The `/admin/users/import` route fetches only session data (very fast) and uses a simple spinner instead of a skeleton. Inline loading states (form submits, profile fetches, verification actions) use the `Loader2` icon from `lucide-react` with `animate-spin`, matching the `ReviewForm.tsx` and `TwoFactorSettings.tsx` patterns. Side-data loading within the student assignment detail page uses dedicated state flags (`loadingConsultations`, `loadingExtensions`) that show `Skeleton` placeholders in the consultations and extensions tabs while the `useEffect` fetch is in flight.

- **Error handling:** Dashboard and page-level data fetches display the actual server error message (`data.error`) rather than a generic localized fallback — the `StudentDashboard` matches the `InstructorDashboard` pattern. Side-data `useEffect` fetches (student assignment detail consultations/extensions) are wrapped in try/catch with a `sideDataError` state flag that renders an inline error banner with a retry button (using the pre-existing `errors.fetchFailed` and `common.refresh` i18n keys). Auto-actions like `openForReview` on the review detail page are wrapped in try/catch — on failure, a `toast.error()` is shown and the self-navigation loop (`navigate({ replace: true })`) is prevented, keeping the user on the page. File upload errors in `CheckpointSubmissionPage` are differentiated: network failures (caught as `TypeError`) show `files.networkError` ("Network error, check your connection"), while server-side non-2xx responses show `files.serverError` ("Server error, try again") — replacing the former generic `files.uploadError` message.
- **Upload progress (Track: Search Debounce & Form Validation):** File uploads to R2 in `CheckpointSubmissionPage` use `XMLHttpRequest` (not `fetch`) to enable real-time upload progress tracking via `xhr.upload.onprogress` (computing `Math.round((loaded / total) * 100)`). The `FileUploader` component accepts an optional `uploadProgress?: number` prop and displays a determinate `Progress` bar with `showValue` when `isUploading && uploadProgress !== undefined`, falling back to the `Loader2` spinner for browsers that don't support progress events. `xhr.onload` resolves on 2xx, rejects otherwise; `xhr.onerror` rejects with `TypeError('Network error')` — preserving the network-vs-server error differentiation.
- **Search debounce (Track: Search Debounce & Form Validation):** All 4 server-side search inputs (user list, student assignments, instructor assignments, audit log) use a custom `useDebouncedCallback` hook (`src/hooks/use-debounced-callback.ts`, 300ms delay) to batch rapid keystrokes into a single server request. Each filter component maintains a `localSearch` state synced with the prop via `useEffect` and wraps `onSearchChange` with `useDebouncedCallback(fn, 300)`. A conditional X clear button (`lucide-react` `X` icon, `aria-label={t('common.clearSearch')}`) clears the search immediately (not debounced). Client-side filters (StudentPicker, TemplatePicker) are not debounced — they filter in-memory data with no server fetch.
- **Form validation (Track: Search Debounce & Form Validation):** All user-facing forms (`ConsultationForm`, `ExtensionRequestForm`, `PasswordSection`) use `react-hook-form` + `zodResolver` with `mode: 'onBlur'` validation and per-field inline errors via `FormMessage`. Zod schemas enforce field-level constraints (required fields, min lengths, password match) and conditional logic (e.g., external consultant name required only when `sessionType === 'external'` via `superRefine`; duration max enforced via `.refine`). The `FormField`/`FormItem`/`FormLabel`/`FormControl`/`FormMessage` pattern matches the existing `EditUserSheet` convention.

### Keyboard Shortcuts [v1]

A two-layer keyboard shortcut architecture improves instructor productivity:

- **Global shortcuts** (`src/hooks/use-keyboard-shortcuts.ts`, mounted in `_authenticated.tsx`):
  - `R` — triggers `queryClient.invalidateQueries` to refresh all data.
  - `?` — toggles a cheat-sheet `Popover` (`src/components/keyboard-cheat-sheet.tsx`) showing all available shortcuts. Review-specific shortcuts (J/K) are greyed out when not on a review page.
- **Review-specific shortcuts** (`src/hooks/use-review-nav.ts`, mounted in `$submissionId.tsx`):
  - `J` — navigates to the next pending review in the queue.
  - `K` — navigates to the previous pending review in the queue.
  - The pending review list is preloaded on mount via `listPendingReviews({ page: 1, limit: 100 })`. The current submission's index is tracked in state, enabling instant navigation without server calls.
- **Suppression:** All shortcuts are disabled when focus is in an `<input>`, `<textarea>`, or `contenteditable` element (checked via a shared `isInputFocused` helper).
- **Cheat-sheet component:** `src/components/keyboard-cheat-sheet.tsx` uses `@base-ui/react/popover` (consistent with the codebase's UI primitives). Renders a grid of shortcut keys + descriptions. J/K entries show a disabled visual state when the `isReviewPage` prop is `false`.

### Route Prefetch [v1]

- Sidebar navigation `<Link>` components in all three role layouts (admin, instructor, student) use `preload="intent"` — hovering a link prefetches the route's data/loader via TanStack Router's built-in prefetch mechanism.
- The router's `defaultPreload` is set to `false` in `src/router.tsx` (opt-in per-link), preventing over-prefetching on the public landing page where sidebar links don't exist.

### Optimistic UI Updates [v1] (Track: Optimistic UI Updates for Mutations)

All 9 user-initiated mutation sites where the predicted state is deterministic use TanStack Query's `onMutate`/`onError`/`onSettled` optimistic update pattern to reflect changes instantly — before the server round-trip completes:

| Mutation | File | Optimistic Effect | Rollback |
|----------|------|-------------------|----------|
| `useMarkRead` | `src/hooks/use-notifications.ts` | Flip `read: true` on the targeted notification; decrement unread count | Restore previous cache snapshot |
| `useMarkAllRead` | `src/hooks/use-notifications.ts` | Flip `read: true` on all notifications; set unread count to 0 | Restore previous cache snapshot |
| `verifyConsultation` | `src/components/consultations/VerificationDialog.tsx` | Remove consultation from pending list; flip `status: 'verified'` | Restore previous cache snapshot |
| `rejectConsultation` | `src/components/consultations/VerificationDialog.tsx` | Remove consultation from pending list; flip `status: 'rejected'` | Restore previous cache snapshot |
| `approveExtension` | `src/hooks/use-assignment-tabs.ts` | Remove extension from pending queue | Restore previous cache snapshot |
| `rejectExtension` | `src/hooks/use-assignment-tabs.ts` | Remove extension from pending queue | Restore previous cache snapshot |
| `unlockCheckpoint` | `src/components/reviews/DeadlineManager.tsx` | Reflect state change in local UI | Restore previous `localStudents` snapshot |
| `extendDeadline` | `src/components/reviews/DeadlineManager.tsx` | Reflect dueDate change in local UI | Restore previous `localStudents` snapshot |
| `deleteUser` | `src/routes/_authenticated/admin/users/index.tsx` | Remove row from user list | Restore previous cache snapshot (re-add row) |

**Pattern:** `onMutate` captures the previous cache snapshot via `queryClient.getQueryData()`, mutates the cache optimistically, and returns `{ previousData }` as the mutation context. `onError` restores the snapshot via `queryClient.setQueryData()`. `onSettled` calls `queryClient.invalidateQueries()` to reconcile with the authoritative server state. All mutation functions that return `{ success: boolean; error: string | null }` must throw on `!result.success` — this ensures `onError` (rollback) fires on server-side errors, not just network exceptions.

**Query-key factory:** `src/lib/query-keys.ts` provides typed key factories for 10 domains (`notificationKeys`, `consultationKeys`, `extensionKeys`, `assignmentKeys`, `userKeys`, `templateKeys`, `discussionKeys`, `settingsKeys`, `gradebookKeys`, `feedbackSnippetKeys`). All migrated queries reference factory keys instead of inline arrays — ensuring reliable cache invalidation across features. `templateKeys` was added in TRACK-015 when the template/student pickers were migrated from `useEffect`+`useState` to `useQuery`. `discussionKeys` was added in TRACK-026 for the checkpoint discussions feature. `settingsKeys` (4 sub-keys: `currentUser`, `activeSessions`, `twoFactorStatus`, `accessibility`) and `gradebookKeys` (`studentFinalGrade`) were added in TRACK-029. `feedbackSnippetKeys` was added in TRACK-049 for active/archived/search-filtered snippet lists, completing the factory pattern across all client-side data domains — zero inline string-array query keys remain in `src/**/*.tsx`. TRACK-029 also migrated `StudentFinalGradeCard` from `useState`/`useEffect` to `useQuery` and `RecomputeGradesButton` from `useState`/`async` to `useMutation` with dual invalidation (`queryClient.invalidateQueries` + `router.invalidate()` for SSR loader data). TRACK-030 subsequently removed `page` from `notificationKeys.list`'s type signature — with `useInfiniteQuery`, page tracking is managed by `pageParam` and all pages of the same filter share one cache entry (the `page` parameter was no longer part of the cache key).

**Scope guard:** Optimistic updates are applied ONLY where the predicted state is deterministic. Mutations whose server response carries computed/derived data the client can't predict (e.g., `submitReview` which unlocks the next checkpoint and adjusts deadlines server-side) keep the standard refetch-on-success flow.

**DeadlineManager invalidation fix:** Prior to this track, `unlockMutation` and `extendMutation` in `DeadlineManager.tsx` had `onSuccess` that only showed a toast — they never called `queryClient.invalidateQueries`, leaving the deadline list stale until manual refresh. This was fixed as a prerequisite before optimistic logic could work.

**NotificationCenter infinite query migration (TRACK-030):** `useNotificationsList` was migrated from `useQuery` + manual `useState`/`useEffect` page accumulation to TanStack Query's native `useInfiniteQuery` (`initialPageParam: 1`, `getNextPageParam` derives next page from accumulated items count vs `total`). The `useMarkRead`/`useMarkAllRead` optimistic `onMutate` callbacks were rewritten to handle the `{ pages, pageParams }` infinite query data shape — checking `'pages' in old` instead of `'items' in old` and mapping over `old.pages` to update items within each page. This fixed a latent bug where the optimistic `'items' in old` check silently fell through to `return old` (no-op) against the infinite query data shape, breaking the optimistic update entirely. The `useUnreadCount` hook still uses `useQuery` (returns a number); its `typeof old === 'number'` check is preserved unchanged.

### Type-Safe Server Functions [v1] (Track: Type-Safety Restoration)

The `createServerFn` wrapper from `@tanstack/react-start` has a known type-inference gap: its `handler` method declares a generic `<TNewResponse>` but `ServerFnReturnType` applies `ValidateSerializableInput` (a recursive conditional type from `@tanstack/router-core`) that prevents TypeScript from inferring `TNewResponse` through the conditional. `TNewResponse` defaults to `unknown`, making the `Fetcher` return type `Promise<unknown>` at call sites — even when the handler's return type is explicitly annotated. The dynamic `await import('./feature.server')` pattern is NOT the cause; even direct handler returns suffer the same inference failure.

**Solution:** `src/lib/server-fn.ts` exports a type-preserving `typedServerFn` alias for `createServerFn` and typed builder interfaces that restore return-type inference. The module also exports `serverFnMiddlewares()` for explicit middleware composition. The implementation:

- Preserves both stub patterns: `.inputValidator(Schema).handler(fn)` (typed-builder) and `.handler(fn)` (inline-parse).
- Defines `TypedFetcher<TInput, TResponse>`, `OptionalFetcher<TResponse>`, `TypedBuilderWithValidator`, and `TypedBuilder` interfaces to model the builder chain. The `TypedBuilder` interface includes a `.middleware(middlewares: unknown[]): TypedBuilder` method (added in TRACK-043 for rate limit middleware chaining).
- Composes `requestIdMiddleware` first (TRACK-044). The middleware reads an incoming `x-request-id` or creates a UUID, then scopes it with `AsyncLocalStorage` so the pino logger's `mixin` includes `{ requestId }` in every server-function log without handler changes.
- Adds an optional `RateLimitConfig` middleware after request-ID middleware. When the per-user per-function sliding window is exceeded, the function middleware throws a `RATE_LIMITED` server error so TanStack Start terminates the invocation through its normal error path.

All server stub files (`src/server/*.ts`) import `typedServerFn` from `@/lib/server-fn` instead of `createServerFn` from `@tanstack/react-start`. This eliminated 66 `as unknown as` casts across hooks (7), components (38), routes (19), server files (5), lib (3), and Better Auth handlers (2) — replacing them with `isServerError()` type-guard checks and proper Drizzle/Better Auth typing.

**Documented remaining casts (TanStack Router typed-routes limitation, not fixable):**
- 6 sidebar casts (`to={link.to as unknown as '.'}`) in `admin-sidebar.tsx`, `instructor-sidebar.tsx`, `student-sidebar.tsx`.
- 2 auth redirect casts in `src/server/auth.ts` (`redirect({ to: '/auth/login' as unknown as '.' })`).
- 2 route redirect casts in `src/routes/_authenticated.tsx` and `src/routes/_unauthenticated.tsx`.
- 1 type boundary cast in `src/lib/server-fn.ts` (the `createServerFn` alias).

Zero `@ts-expect-error` directives. Zero `as any` casts (excluding generated `routeTree.gen.ts`). All type changes are inference-based — no behavioral changes, all 3,780 tests pass unchanged.

### Server-Function Architecture Patterns [v1] (Track: Server-Function Architecture Standardization)

Server functions follow a two-file split: `*.ts` (client-safe stub with Zod schemas + `typedServerFn` stubs) and `*.server.ts` (handler with DB code). The client is never bundled with handler code. Four structural patterns are used based on complexity:

1. **Standard pair** (default) — `*.ts` (Zod schemas + `typedServerFn` stubs with dynamic import of handler) + `*.server.ts` (handler implementations). Used when a feature's handlers fit within the 500-line file limit in a single `.server.ts` file. Canonical example: `src/server/assignments.ts` + `assignments.server.ts`.

2. **Extras variant** — Standard pair + `*-extras.server.ts`. Used when adding more handlers to a `.server.ts` file would exceed the 500-line limit. The extras file imports schemas via `import type` from the `*.ts` stub and is handler-only (no corresponding extras stub file). Canonical examples: `assignments-extras.server.ts`, `reviews-extras.server.ts`, `consultations-extras.server.ts`, `extensions-extras.server.ts`.

3. **Multi-handler** — `*.ts` (shared schemas + stubs) + multiple role-specific `*.server.ts` files. Used when a feature serves multiple roles with distinct query logic, making file separation clearer than a single handler file. Canonical examples: `dashboard.ts` + `dashboard-instructor.server.ts` + `dashboard-student.server.ts` + `dashboard-admin.server.ts`; also `analytics.ts` + `analytics-admin.server.ts` + `analytics-instructor.server.ts` + `analytics-export.server.ts`.

4. **Handler-only** — No `*.ts` stub file; the `.server.ts` file is an internal helper imported only by other server files, never called directly from client code. Canonical example: the `*-extras.server.ts` helper functions.

**Stub calling conventions:** Two `typedServerFn` stub patterns coexist — match the surrounding file:
- Typed builder (preferred): `typedServerFn({ method }).inputValidator(Schema).handler(fn)` — Zod validation at the TanStack layer.
- Inline parse: `typedServerFn({ method }).handler(async (args) => { Schema.parse(args.data); ... })` — manual Zod parse inside the handler.

**Acceptable type-only circular dependencies:** Static analyzers report cycles like `feature.ts → feature.server.ts → feature.ts`. These are safe and expected — the `*.ts` stub uses `await import('./feature.server')` (dynamic import, resolved lazily at call time) and the `*.server.ts` handler uses `import type { Schema } from './feature'` (type-only import, erased at compile time). Neither edge exists at runtime, so there is no circular dependency at execution. All 34 circular dependency chains in the codebase have been verified as type-only.

### HTTP Security Headers & Nonce-Based CSP [v1] (Track: HTTP Security Headers)

A nonce-based Content-Security-Policy defends against XSS — the primary browser-level defense given the app's rich user-generated content (assignment descriptions, review feedback, discussion Q&A). The implementation spans three files:

- **`src/lib/security-headers.ts`** — Two pure functions:
  - `generateNonce()` — `crypto.randomBytes(16).toString('base64')` → a 24-character base64 nonce, unique per request.
  - `buildSecurityHeaders(nonce, isProd, r2Domain?)` — Assembles the CSP directive string and returns a `Record<string, string>` of header name → value pairs. The CSP header name switches: `Content-Security-Policy` (prod, enforced) vs `Content-Security-Policy-Report-Only` (dev, violations logged only). The `upgrade-insecure-requests` directive and HSTS header are conditionally included only in production.
- **`src/start.ts`** — The TanStack Start entry point (`createStart` instance) with two request middlewares wired via `requestMiddleware: [csrfMiddleware, securityHeadersMiddleware]`:
  - `securityHeadersMiddleware` (via `createMiddleware().server()`) — generates the nonce, extracts the R2 domain from `process.env.R2_ENDPOINT` via `new URL(endpoint).hostname` (try/catch — omitted gracefully when unset/invalid), builds all headers via `buildSecurityHeaders()`, sets them via `setResponseHeader()` from `@tanstack/react-start/server`, and propagates the nonce to the router context via `next({ context: { nonce } })`.
  - `createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === 'serverFn' })` — explicitly added because a custom `createStart` entry point disables TanStack Start's auto-installed CSRF middleware. Scoped to server-function requests only.
- **`src/router.tsx`** — Reads the nonce from `getGlobalStartContext()` (justified type assertion — middleware context is not inferred through TanStack Start's `Register` type) and passes it to `ssr: { nonce }` on the router config. TanStack Start then auto-attaches the nonce to all inline `<script>` and `<style>` tags during SSR — including the theme-init script (`__root.tsx` `dangerouslySetInnerHTML`) and TanStack Router's hydration scripts. No manual nonce injection in `__root.tsx` is needed.

**CSP directives:** `default-src 'self'; script-src 'nonce-{nonce}' 'strict-dynamic'; style-src 'self' 'nonce-{nonce}' <Sonner hash>; img-src 'self' data: https:; connect-src 'self' <R2 endpoint> <R2 bucket subdomains>; frame-src 'self' <R2 endpoint> <R2 bucket subdomains>; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src <R2 endpoint> <R2 bucket subdomains>` (or `object-src 'none'` without R2); `upgrade-insecure-requests` (prod only). The R2 sources are restricted to the configured endpoint and bucket subdomains so presigned uploads/downloads and PDF previews work without wildcard origins.

**Additional headers** on all responses: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: geolocation=(), microphone=(), camera=()`. `Strict-Transport-Security: max-age=31536000; includeSubDomains` (HSTS) is production-only (defense-in-depth behind Traefik TLS termination).

**Testing:** Unit tests (32 assertions) cover nonce generation (uniqueness, length, base64 format), header values (exact string match), Report-Only vs enforce switching, `getR2Domain` edge cases, and router nonce propagation. An E2E test asserts all headers are present, nonce uniqueness across requests, and that nonces are auto-attached to `<script>` tags in the rendered HTML.

### Application-Level Rate Limiting [v1] (Track: Application-Level Rate Limiting on Server Functions)

All 86 authenticated TanStack Start server functions are rate-limited through explicit `serverFnMiddlewares` composition. Better Auth's built-in rate limiting only covers `/api/auth/*` endpoints — application server functions were previously unprotected against abuse (R2 cost exploitation, email queue flooding, data pollution, DB connection exhaustion).

- **`src/lib/rate-limiter.ts`** — In-memory sliding window rate limiter:
  - `RateLimitConfig` type: `{ window: number; max: number }` (window in seconds).
  - `RATE_LIMITS` presets (4 tiers): `presignedUrl` (60s/20 — R2 cost abuse), `heavyMutation` (60s/10 — submissions/reviews), `destructive` (60s/5 — admin CRUD, 2FA, session revocation), `standardRead` (60s/60 — dashboards, lists, detail views).
  - `checkRateLimit(store, key, config): boolean` — sliding window logic: if entry exists and window hasn't expired, increment count if under max (return `true`), deny without incrementing if at max (return `false` — prevents permanent lockout); if no entry or window expired, reset to count=1 (return `true`).
  - `createRateLimitMiddleware(config)` — factory using `createMiddleware({ type: 'request' }).server(async ({ next }) => {...})`. Auto-incrementing `fnIdCounter` assigns a unique `fnId` per middleware instance (per-function isolation). Calls `getSessionFromHeaders()` — unauthenticated requests pass through to `next()` without rate limiting. Authenticated requests are checked against the sliding window keyed by `${session.user.id}:${fnId}`. When exceeded, short-circuits with `serverError(ErrorCode.RATE_LIMITED, 'Rate limit exceeded')`.
  - Module-level `Map<string, { count: number; windowStart: number }>` store — sufficient for single-instance deployment (Redis deferred to multi-instance work).
  - `resetRateLimitStoreForTests()` — test-only utility to clear the store between tests.

- **`src/lib/server-fn.ts`** — Exports the type-preserving `typedServerFn` alias and `serverFnMiddlewares(rateLimit?)`, which returns request-ID middleware followed by optional rate limiting. Stubs attach this array explicitly with `.middleware(...)`.

- **`src/lib/errors.ts`** — `RATE_LIMITED` added to the `ErrorCode` enum.

- **`src/lib/toast.ts`** — `RATE_LIMITED` added to `VALID_ERROR_CODES` and mapped to `error.rateLimited` i18n key ("Too many requests. Please wait a moment and try again." / "Terlalu banyak permintaan. Mohon tunggu sebentar dan coba lagi.").

- **Server function annotations:** 86 functions across 23 stub files compose `serverFnMiddlewares(RATE_LIMITS.<tier>)` per the rate limit catalog. Tier 1 (presignedUrl): 4 functions (file presigned URLs, avatar upload). Tier 2 (heavyMutation): 4 functions (submitCheckpoint, submitReview, openForReview, updateRevisionActionItem). Tier 3 (destructive): 36 functions (assignment/template/user CRUD, 2FA, sessions, consultations, extensions, discussions, email retry, R2 cleanup, grade config). Tier 4 (standardRead): 42 functions (dashboards, analytics, list/detail views, audit log, gradebook, rubrics).

- **Exempt functions** (no rateLimit): `_getSession` (internal session fetch — cascading/infinite-loop concern), `getUnreadCount` / `markRead` / `markAllRead` (high-frequency UX — 30s polling, instant interactions), `completePasswordSetup` (token-based, no session).

- **No handler changes** — Rate limiting is enforced at the middleware layer before the handler runs. Zero `.server.ts` handler files were modified. All annotations are in stub files (`.ts`).

- **Testing:** The rate-limiter suites cover presets, sliding-window expiry, per-key isolation, middleware pass-through/deny/function isolation, calendar-feed anonymous/student keying, forwarded-header rejection, and bounded-store cleanup. The server-function suite covers middleware composition and regression behavior. `rate-limiter.ts` and `server-fn.ts` remain covered above the project threshold.

---

## 3. Data Model [v1]

### Entity-Relationship Overview

**User** (SuperAdmin, Admin, Instructor, Student) — core identity with role and optional settings JSONB timezone preference.
**AssignmentTemplate** — defines a type (e.g. Thesis) with ordered checkpoint names.
**TemplateCheckpoint** — checkpoint definition within a template (name, order).
**Assignment** — links a template to students with a title, description, and final deadline.
**AssignmentStudent** — maps a student to an assignment (individual progress, not group work). [v1]
**Checkpoint** — one per assignment stage; copied from template at creation time.
**Submission** — files uploaded by a student for a checkpoint.
**Review** — instructor decision (pass/revise) with comments and optional feedback file.
**RevisionActionItem** — optional ordered plain-text work item owned by a review, with an optional rubric criterion/title snapshot and reversible addressed timestamp for the current student-visible plan.
**Consultation** — student-instructor meeting log, tied to a specific checkpoint.
**CheckpointDiscussion** — lightweight async Q&A message tied to a specific checkpoint. Threaded via `parentMessageId` (self-referencing). Soft-deleted via `deletedAt` (deleted messages render as "[deleted]" placeholder, replies preserved). Denormalized `assignmentId` for efficient instructor queries.
**Notification** — in-app event log.
**NotificationPreference** — per-user, per-type, per-channel toggle stored in `users.settings` JSONB column (no separate table). Keyed by notification `type` string (e.g., `submission_received`), with `{ email?: boolean; inApp?: boolean }` values. Absent key or absent sub-field = default `true` (enabled). 12 types across 4 groups (Reviews, Consultations, Submissions, System). Security types (password_reset, invitation, two_factor, sla_alert) are exempt from email gating.
**ExtensionRequest** — student-initiated deadline extension with reason category, proposed duration (1–30 days), instructor approval/rejection, and configurable caps (`maxExtensionDays`, `maxTotalExtensions`). On approval, the affected student's subsequent checkpoint `dueDate` values auto-extend. The assignment-wide `finalDeadline` is immutable after creation and never mutated by extensions.
**DeadlineReminder** — dedup tracking table for proactive deadline reminders. Records `checkpointId` (FK, cascade delete), `studentId` (FK, cascade delete), `tier` (`'7d'`/`'3d'`/`'1d'`), and `sentAt`. Unique constraint on `(checkpointId, tier)` ensures at-most-once delivery per tier per checkpoint across multiple server instances. Used by the hourly background scanner (`processDeadlineReminders()`) to deduplicate via `INSERT ... ON CONFLICT DO NOTHING RETURNING *`.
**CalendarFeedToken** — per-student private-feed credential record introduced by migration 0020. Stores a SHA-256 token hash, ownership and created/revoked timestamps; a partial unique index enforces one active token per student. The opaque token is returned only on enable/regenerate and is never persisted or logged in plaintext. The route is `GET /api/calendar/ics` and returns UTC RFC 5545 events.
**AuditLog** — immutable record of all meaningful system actions: user CRUD, template CRUD, assignment creation, review decisions, revision-action plan creation/status changes, deadline changes, unlocks, and consultation verifications/rejections. Stores actor, action type, entity reference, and JSON details; revision-action entries omit full feedback text. [v1] — admin viewer at `/admin/audit-log`.
**EmailQueue** — background delivery queue for transactional emails. [v1] — infrastructure used for invitations, password reset, 2FA emails, SLA alerts, and **11 event notification types** (submission received, review completed, revision requested, consultation verified/rejected, extension approved/rejected, extension requested, deadline reminder, student at risk, discussion reply). Event emails are dispatched as post-commit advisory work via `enqueueEventEmail()` (`src/lib/event-email.ts`) alongside existing in-app notifications — the primary operation always succeeds even if enqueue fails. `enqueueEventEmail` supports optional `subjectParams` for interpolating dynamic values into email subjects (e.g., `{assignmentTitle}` in deadline reminder subjects). A proactive deadline reminder scanner (`processDeadlineReminders()` in `src/lib/deadline-reminder-scanner.ts`) runs hourly alongside the email queue processor — it queries checkpoints with upcoming due dates, dispatches tiered (7d/3d/1d) in-app notifications + emails, and uses a `deadline_reminders` dedup table with `ON CONFLICT DO NOTHING` for at-most-once delivery per tier per checkpoint. The dedup insert and notification creation are wrapped in a single `db.transaction` (atomicity); email dispatch runs post-commit via `Promise.allSettled` (advisory). Scanner failure is isolated via `try/catch` and does not affect email processing. The scanner also calls `checkAndFireRiskAlert` for each reminder to surface at-risk students (advisory, `Promise.allSettled`). An orphaned R2 object cleanup scanner (`processOrphanedR2Objects()` in `src/lib/r2-cleanup.ts`) also runs in the tick loop — throttled to every 6 hours via in-memory `lastR2CleanupAt`, it deletes R2 objects whose upload intents expired without being consumed, using `Promise.allSettled` for parallel deletes with per-object error isolation. The R2 cleanup scanner accepts an `actorId` parameter (default `'system'`) for audit logging via `safeAuditLog`. Scanner failure is isolated via `try/catch` and does not affect email processing. Admins can manually trigger R2 cleanup via the "Trigger R2 Cleanup" button on `/admin/email-queue` (bypasses throttle, logs with admin userId). Hardened with a `processing` status, transactional claim via `FOR UPDATE SKIP LOCKED` (send occurs outside the transaction), an in-process `isRunning` guard, and stale-row reclaim (rows stuck in `processing` > 5 min reset to `pending`) to prevent concurrent-worker duplicate delivery and lockup. All user-derived interpolations in email bodies are HTML-escaped to prevent stored XSS. Admin queue inspector at `/admin/email-queue` provides observability — paginated list (20/page) with status filter, search (recipient email/subject), summary stats (pending/sent/failed), and manual retry of failed emails (idempotent: only `status='failed'` can be retried, resets to `pending` inside a `FOR UPDATE` transaction). Each row exposes a `resendMessageId` (populated from the Resend API `result.data.id` on successful send) displayed as a monospace truncated cell, enabling correlation with Resend's delivery dashboard. Processor sends emails in concurrent batches of 5 via `Promise.allSettled` (chunks run sequentially; partial failures don't abort the batch — cycle latency reduced from ~10× to ~2× single-send latency). Automatic retention cleanup prunes `sent` rows older than 90 days and `failed` rows older than 180 days on a tick-embedded 24-hour cycle (`lastPruneAt` timestamp in `email-queue-init.ts`); `pending`/`processing` rows are never deleted. Processor emits structured logs (`email_queue.cycle_start`, `email_queue.cycle_end`, `email_queue.reclaimed`, `email_queue.send_failed`, `email_queue.retention_pruned` — no PII). `EMAIL_FROM` is read from `getEnv().EMAIL_FROM` (Zod-validated in `src/config/env.ts` with default `'SIMAK <noreply@simak.app>'`).
**TwoFactor** — TOTP configuration (secret, backup codes) managed by Better Auth's `twoFactor` plugin.
**Session** — Better-Auth session token, FK to users, expiresAt.
**Account** — Better-Auth credential provider entry (stores hashed password).
**Verification** — Better-Auth one-time token for password reset and email verification. Replaces the former `password_reset_tokens` table.

### Tables

#### users

| Column           | Type                   | Notes                                                                               |
| ---------------- | ---------------------- | ----------------------------------------------------------------------------------- |
| id               | text (PK)              | UUID                                                                                |
| name             | text, not null         | Full name                                                                           |
| email            | text, unique, not null | Login identifier                                                                    |
| role             | enum, not null         | superadmin \| admin \| instructor \| student                                        |
| locale           | text, default 'en'     | Language preference: 'en' \| 'id'. Used for UI, notifications, and email templates. |
| settings         | jsonb                  | NULLABLE — `{ reducedMotion: boolean; timezone?: string; notificationPrefs?: Record<string, { email?: boolean; inApp?: boolean }> }`. Profile, theme, accessibility, timezone, and notification preferences. Timezone is runtime-validated as an IANA identifier and is used only for defined student deadline presentation. |
| createdAt        | timestamp              |                                                                                     |
| updatedAt        | timestamp              |                                                                                     |
| deletedAt        | timestamp              | Soft delete                                                                         |
| twoFactorEnabled | boolean, default false | Whether the user has enabled TOTP 2FA                                               |

> **User email uniqueness transaction safety (Track: Concurrency & Transaction Safety):** The `createUserHandler` and `updateUserHandler` in `src/server/users.server.ts` perform the email uniqueness check **inside** a `db.transaction` with a `FOR UPDATE` lock on the matching `users` row, preventing a TOCTOU race where two concurrent create/update requests could both pass the uniqueness check and insert conflicting emails. As defense-in-depth, PostgreSQL's unique constraint violation (error code `23505`) is also caught and mapped to a clean "Email already in use" error message.

> **Soft-delete cleanup transaction safety (Track: Concurrency & Transaction Safety):** The `deleteUserHandler` in `src/server/users.server.ts` performs all cleanup inside a single `db.transaction`:
> - **Student soft-delete:** auto-rejects all pending consultations and extension requests with reason "User deleted", revokes open upload intents, and sets `deletedAt`. All cleanup runs inside the transaction — the user is either fully cleaned up and soft-deleted, or nothing changes.
> - **Instructor soft-delete:** checks for active (non-deleted) assignments **inside** the transaction with a `FOR UPDATE` lock on the matching `assignments` rows. If active assignments exist, the deletion is blocked with a `BAD_REQUEST` error and the admin is presented with a Reassignment Dialog. The admin must reassign **all** active assignments to replacement instructors (via `reassignAssignmentHandler`, which transitions `under_review` checkpoints back to `submitted`) before the soft-delete can proceed. After successful soft-delete, active sessions are revoked post-commit in a try/catch.

#### session (Better-Auth)

| Column    | Type                | Notes          |
| --------- | ------------------- | -------------- |
| id        | text (PK)           | UUID           |
| userId    | text (FK → users)   | Cascade delete |
| token     | text, unique        | Session token  |
| expiresAt | timestamp, not null | Session expiry |
| ipAddress | text                |                |
| userAgent | text                |                |
| createdAt | timestamp           |                |
| updatedAt | timestamp           |                |

#### account (Better-Auth)

| Column                | Type              | Notes                                  |
| --------------------- | ----------------- | -------------------------------------- |
| id                    | text (PK)         | UUID                                   |
| userId                | text (FK → users) | Cascade delete                         |
| accountId             | text, not null    | Same as userId for credential accounts |
| providerId            | text, not null    | e.g. "credential"                      |
| password              | text              | Hashed password (scrypt)               |
| accessToken           | text              |                                        |
| refreshToken          | text              |                                        |
| accessTokenExpiresAt  | timestamp         |                                        |
| refreshTokenExpiresAt | timestamp         |                                        |
| scope                 | text              |                                        |
| idToken               | text              |                                        |
| createdAt             | timestamp         |                                        |
| updatedAt             | timestamp         |                                        |

#### two_factor (Better-Auth plugin)

| Column      | Type                  | Notes                                             |
| ----------- | --------------------- | ------------------------------------------------- |
| id          | text (PK)             | UUID                                              |
| secret      | text, not null        | Encrypted TOTP secret                             |
| backupCodes | text, not null        | Encrypted JSON array of 8 single-use backup codes |
| verified    | boolean, default true | Whether 2FA setup has been verified               |
| userId      | text (FK → users)     | Cascade delete                                    |

> **2FA disable transaction safety (Track: Concurrency & Transaction Safety):** The `disableTwoFactorHandler` in `src/server/two-factor.server.ts` wraps the DB operations (set `users.twoFactorEnabled = false` and delete the `two_factor` row) in a single `db.transaction`. The Better Auth API call (`auth.api.disableTwoFactor`) is invoked **after** the transaction commits as post-commit advisory work in a try/catch — if the API call fails, the DB state is already durable and the system reconciles on the user's next login by checking the DB flag. Active session revocation is also performed post-commit in a try/catch. This follows SQL style guide §6.4 (post-commit advisory work).

#### verification (Better-Auth)

| Column     | Type                | Notes              |
| ---------- | ------------------- | ------------------ |
| id         | text (PK)           | UUID               |
| identifier | text, not null      | e.g. email address |
| value      | text, not null      | Token value        |
| expiresAt  | timestamp, not null | 1-hour expiry      |
| createdAt  | timestamp           |                    |
| updatedAt  | timestamp           |                    |

> **Atomic token consumption (Track: Secure password-setup token consumption):** Password setup tokens are consumed via `DELETE FROM verification WHERE value = ? AND expiresAt > now() RETURNING *` as the **first statement** inside `db.transaction()` in `completePasswordSetupHandler`. This replaces the former check-then-act pattern (SELECT outside transaction → DELETE at the end), which was vulnerable to concurrent token replay (TOCTOU race). The atomic DELETE serves as both validation and consumption in a single step — if zero rows are returned, the token was already used, expired, or never existed, and the handler returns a generic "Invalid or expired token" error (no information leakage). User lookup, password upsert, and `emailVerified` update all run inside the same transaction; a failure on any step rolls back the transaction and restores the token. Password hashing (scrypt, CPU-bound) is performed **outside** the transaction so that a hashing failure does not consume the token.

> **Setup link generation transaction safety (Track: Concurrency & Transaction Safety):** The `generateSetupLinkHandler` in `src/server/users.server.ts` wraps the `DELETE` (revoke any existing setup token for the user) and `INSERT` (create a new verification token) in a single `db.transaction`. If either operation fails, both are rolled back — preventing a state where an old token is deleted but the new one fails to insert, leaving the user unable to set up their password.

#### assignment_templates

| Column    | Type              | Notes                           |
| --------- | ----------------- | ------------------------------- |
| id        | serial (PK)       |                                 |
| type      | text, not null    | e.g. "Thesis", "Research Paper" |
| name      | text, not null    | Display name                    |
| createdBy | text (FK → users) | Admin who created it            |
| createdAt | timestamp         |                                 |
| updatedAt | timestamp         |                                 |
| deletedAt | timestamp         | Soft delete                     |

#### template_checkpoints

| Column            | Type                                | Notes                                 |
| ----------------- | ----------------------------------- | ------------------------------------- |
| id                | serial (PK)                         |                                       |
| templateId        | integer (FK → assignment_templates) |                                       |
| name              | text, not null                      | e.g. "Abstract", "Introduction"       |
| order             | integer, not null                   | Position in sequence                  |
| minConsultations  | integer, default 0                  | Required for checkpoint unlock/submit |
| estimatedDuration | integer, default 0                  | Days allotted for this checkpoint     |
| gradingType       | pgEnum (grading_type), nullable     | `null` = no rubric (pass/fail only), `numeric` = direct 0–100 scoring per criterion, `qualitative` = level-based scoring (Track: Rubric-Based Grading) |
| createdAt         | timestamp                           |                                       |
| deletedAt         | timestamp                           | Soft delete (Track: Rubric-Based Grading) |

#### assignments

| Column             | Type                                | Notes                                                                                                   |
| ------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------- |
| id                 | serial (PK)                         |                                                                                                         |
| templateId         | integer (FK → assignment_templates) | Template used                                                                                           |
| title              | text, not null                      |                                                                                                         |
| description        | text                                |                                                                                                         |
| finalDeadline      | timestamp, not null                 | Immutable after creation — course-wide soft target. Individual checkpoint `dueDate` values enforce locking; per-student effective deadline is derived at read time from the first non-passed checkpoint's `dueDate` (via `computeEffectiveDeadline` in `src/server/due-dates.server.ts`). |
| instructorId       | text (FK → users)                   |                                                                                                         |
| maxExtensionDays   | integer, default 7                  | Admin cap per request, CHECK (1–30)                                                                     |
| maxTotalExtensions | integer, default 3                  | Cap per assignment, CHECK (1–10)                                                                        |
| createdAt          | timestamp                           |                                                                                                         |
| updatedAt          | timestamp                           |                                                                                                         |
| deletedAt          | timestamp                           | Soft delete                                                                                             |

#### assignment_students [v1]

| Column       | Type                       | Notes |
| ------------ | -------------------------- | ----- |
| id           | serial (PK)                |       |
| assignmentId | integer (FK → assignments) |       |
| studentId    | text (FK → users)          |       |
| createdAt    | timestamp                  |       |

_Note: Each row represents one student's individual participation. Group assignments (collaborative submissions) will be added in v2._

#### checkpoints

| Column           | Type                       | Notes                                                                       |
| ---------------- | -------------------------- | --------------------------------------------------------------------------- |
| id               | serial (PK)                |                                                                             |
| assignmentId     | integer (FK → assignments) |                                                                             |
| studentId        | text (FK → users)          | Per-student checkpoint state (independent progress per student)             |
| templateCheckpointId | integer (FK → template_checkpoints), nullable | Links per-student checkpoint to its template checkpoint for rubric lookup. Backfilled via `assignments.templateId + order` matching at migration time (Track: Rubric-Based Grading) |
| name             | text, not null             | Copied from template                                                        |
| order            | integer, not null          |                                                                             |
| dueDate          | timestamp                  | Per-checkpoint deadline (auto-calculated from template `estimatedDuration`) |
| minConsultations | integer, default 0         | Required for submission unlock                                              |
| state            | enum, not null             | locked \| unlocked \| submitted \| under_review \| passed \| revise         |
| createdAt        | timestamp                  |                                                                             |
| updatedAt        | timestamp                  |                                                                             |

> **Atomic state transitions (Track: review-atomic_20260704):** The three handlers that mutate checkpoint state — `submitCheckpointHandler` (`src/server/submissions.server.ts`), `openForReviewHandler` (`src/server/reviews-extras.server.ts`), and `submitReviewHandler` (`src/server/reviews.server.ts`) — read the checkpoint row **inside** a database transaction using `SELECT ... FOR UPDATE OF checkpoints`. The row lock is acquired before state validation, so a concurrent transaction that changes the state between the read and the write is blocked until the first transaction commits. After acquiring the lock, each handler re-validates the checkpoint state (e.g. `SUBMITTABLE_STATES`, `REVIEWABLE_STATES`, `submitted`) and returns a stale-state error if the locked row is no longer in the expected state. This eliminates the check-then-act TOCTOU race where two concurrent requests could both read the same state and both proceed to mutate it. On multi-table JOINs, `FOR UPDATE OF checkpoints` locks only the checkpoint row, not the joined `submissions`/`assignments`/`users` rows.

#### submissions

| Column       | Type                       | Notes                                                                                          |
| ------------ | -------------------------- | ---------------------------------------------------------------------------------------------- |
| id           | serial (PK)                |                                                                                                |
| checkpointId | integer (FK → checkpoints) |                                                                                                |
| uploadedBy   | text (FK → users)          | User who uploaded (future-proof for group assignments)                                         |
| fileKey      | text, not null             | R2 object key (UUID-based)                                                                     |
| fileName     | text, not null             | Original filename                                                                              |
| fileSize     | integer, not null          | Size in bytes (Max 25MB)                                                                       |
| version      | integer, default 1         | Auto-calculated at insert. Each resubmission creates a new row with version = previous max + 1 |
| uploadedAt   | timestamp                  |                                                                                                |

> **Constraint (Track 8.3):** `UNIQUE (checkpoint_id, version)` — prevents duplicate submission versions under concurrent `submitCheckpointHandler` calls (TOCTOU race). Migration `0002` defensively deduplicates only exact `(checkpoint_id, version)` duplicates before adding the constraint, preserving the append-only version history.

#### reviews

| Column           | Type                               | Notes                                                      |
| ---------------- | ---------------------------------- | ---------------------------------------------------------- |
| id               | serial (PK)                        |                                                            |
| submissionId     | integer (FK → submissions)         |                                                            |
| instructorId     | text (FK → users)                  |                                                            |
| decision         | pgEnum (review_decision), not null | pass \| revise                                             |
| comment          | text                               |                                                            |
| feedbackFileKey  | text                               | R2 key for optional feedback file                          |
| revisionDeadline | timestamp                          | Deadline for resubmission (if revise)                      |
| createdAt        | timestamp                          |                                                            |
| reviewedAt       | timestamp                          | When instructor submitted the review (for SLA calculation) |

> **Atomic review submission (Track: review-atomic_20260704):** `submitReviewHandler` (`src/server/reviews.server.ts`) wraps the checkpoint state read, ownership validation, review insert, checkpoint state mutation, next-checkpoint unlock, SLA adjustment, and in-app notification inserts in a single `db.transaction(async (tx) => { ... })` block. The checkpoint row is locked with `FOR UPDATE OF checkpoints` and re-validated against `REVIEWABLE_STATES` post-lock. All error returns occur before any writes (safe empty-commit pattern). Post-commit advisory work (audit logging, SLA breach notifications) runs after the transaction commits, wrapped in try/catch. This follows SQL style guide §6.

#### revision_action_items

| Column        | Type                                  | Notes                                                                                         |
| ------------- | ------------------------------------- | --------------------------------------------------------------------------------------------- |
| id            | serial (PK)                           |                                                                                               |
| reviewId      | integer (FK → reviews, cascade)       | Owning review; a later Revise plan never mutates prior rows                                          |
| itemText      | varchar(500), not null                | Trimmed plain text; empty values and angle-bracket markup are rejected                        |
| order         | integer, not null                     | Stable instructor-defined display order                                                       |
| criterionId   | integer (FK → rubric_criteria)       | Nullable; must belong to the review checkpoint's active rubric when provided                  |
| criterionTitle| text                                  | Nullable criterion-title snapshot preserved for historical guidance                          |
| addressedAt   | timestamp                             | Nullable; only the owning student can set/unset it while the plan is current                 |
| createdAt     | timestamp                             |                                                                                               |
| updatedAt     | timestamp                             |                                                                                               |

Migration `0021_round_mysterio.sql` creates the table and rollback `0021_round_mysterio.rollback.sql` drops it with the repository's irreversible-data warning. Action items are validated before writes and inserted after the review ID inside the existing transaction; non-empty items on `pass` are rejected. A later Revise review containing items becomes current without copying/merging prior rows. A later comment-only or feedback-file-only Revise review does not supersede the existing plan. Latest/history reads order by `createdAt DESC, id DESC` and action items by `reviewId, order, id` for deterministic snapshots. [TRACK-054]

> **Rubric score and action-plan validation:** For checkpoints with a rubric (`grading_type` is not `null`), `validateReviewScores` and revision-action criterion validation run **before** the review INSERT (inside the transaction) — checking that all current criteria are scored, no duplicates exist, `rubricLevelId` values belong to the correct rubric, and linked action-item criteria belong to the checkpoint rubric. Only after validation passes does the review INSERT execute with `.returning({ id: reviews.id })` (capturing the generated ID directly — no separate SELECT-after-INSERT per SQL styleguide §6.3). `insertReviewScores` and `insertRevisionActionItems` then write denormalized score/criterion snapshots using the captured `review.id`. This prevents an orphaned review or partial action plan when validation or insertion fails.

#### rubric_criteria

| Column              | Type                                | Notes                                              |
| ------------------- | ----------------------------------- | -------------------------------------------------- |
| id                  | serial (PK)                         |                                                    |
| templateCheckpointId| integer (FK → template_checkpoints) | Which checkpoint this criterion belongs to         |
| title               | text, not null                      | Criterion title (e.g. "Content Quality")           |
| description         | text                                | What this criterion evaluates                      |
| weight              | integer, not null                   | 0–100 (CHECK constraint). Weights must sum to 100% (enforced at Zod application layer — spans multiple rows) |
| order               | integer, not null                   | Display order                                      |
| createdAt           | timestamp                           |                                                    |
| updatedAt           | timestamp                           |                                                    |
| deletedAt           | timestamp                           | Soft delete — never hard-deleted (preserves FK integrity for `review_scores` snapshots) |

#### rubric_levels

| Column              | Type                                | Notes                                              |
| ------------------- | ----------------------------------- | -------------------------------------------------- |
| id                  | serial (PK)                         |                                                    |
| templateCheckpointId| integer (FK → template_checkpoints) | Shared across all criteria in this checkpoint (v1)  |
| label               | text, not null                      | e.g. "Below Expectations", "Meets", "Exceeds"      |
| description         | text                                | What this level means                              |
| score               | integer, not null                   | 0–100 (CHECK constraint). Numeric mapping for qualitative grading |
| order               | integer, not null                   | Display order                                      |
| createdAt           | timestamp                           |                                                    |
| updatedAt           | timestamp                           |                                                    |
| deletedAt           | timestamp                           | Soft delete — never hard-deleted                   |

#### review_scores

| Column        | Type                                | Notes                                                                   |
| ------------- | ----------------------------------- | ----------------------------------------------------------------------- |
| id            | serial (PK)                         |                                                                         |
| reviewId      | integer (FK → reviews)              | The review this score belongs to                                       |
| criterionId   | integer (FK → rubric_criteria)     | NOT NULL — which criterion was scored                                   |
| criterionTitle| text, not null                      | Denormalized snapshot — preserved even if criterion is soft-deleted    |
| score         | integer, not null                   | 0–100 (CHECK constraint). Denormalized snapshot                         |
| weight        | integer, not null                   | 0–100. Denormalized snapshot of criterion weight at review time         |
| rubricLevelId | integer (FK → rubric_levels)        | NULLABLE — set only for qualitative grading                             |
| levelLabel    | text                                | NULLABLE — denormalized snapshot of level label                         |
| comment       | text                                | NULLABLE — per-criterion instructor comment                            |
| createdAt     | timestamp                           |                                                                         |

> **Denormalized snapshot (Track: Rubric-Based Grading):** `review_scores` stores a full denormalized snapshot (`criterionTitle`, `levelLabel`, `score`, `weight`) so completed reviews are unaffected by later rubric edits. If an admin soft-deletes a criterion or changes its title/weight, historical reviews retain their original snapshot values. The rubric is looked up live from the template at review time via `checkpoints.templateCheckpointId → template_checkpoints → rubric_criteria/rubric_levels`; only at persistence time is the snapshot captured.

#### consultations

| Column                 | Type                               | Notes                                        |
| ---------------------- | ---------------------------------- | -------------------------------------------- |
| id                     | serial (PK)                        |                                              |
| assignmentId           | integer (FK → assignments)         |                                              |
| checkpointId           | integer (FK → checkpoints)         | Which stage this consultation supports       |
| studentId              | text (FK → users)                  |                                              |
| verifiedById           | text (FK → users)                  | Internal instructor who verified the log     |
| status                 | enum, not null                     | pending \| verified \| rejected              |
| notes                  | text                               | Session notes from student                   |
| externalConsultantName | text                               | Name if session was with external supervisor |
| sessionType            | pgEnum (consultation_session_type) | internal \| external                         |
| verifiedAt             | timestamp                          | When instructor verified                     |
| createdAt              | timestamp                          |                                              |

> **Consultation verify/reject transaction safety (Track: Concurrency & Transaction Safety):** The `verifyConsultationHandler` and `rejectConsultationHandler` in `src/server/consultations.server.ts` read the `consultations` row **inside** a `db.transaction` with `FOR UPDATE` on the consultation row, then re-validate `status === 'pending'` after acquiring the lock. If the locked re-read shows the status has changed (e.g. another instructor already verified/rejected it), the operation is rejected with a stale-state error. This eliminates the check-then-act TOCTOU race where two concurrent verify/reject requests could both read `pending` and both proceed. Audit logging runs post-commit in a try/catch.

#### interventions

| Column           | Type                               | Notes                                                                                 |
| ---------------- | ---------------------------------- | ------------------------------------------------------------------------------------- |
| id               | serial (PK)                        |                                                                                       |
| assignmentId     | integer (FK → assignments)         | Assignment ownership determines the current instructor authorized to access records |
| studentId        | text (FK → users)                  | Student-assignment pair for the intervention                                          |
| actionType       | pgEnum (intervention_action_type)  | `consultation` \| `extension` \| `discussion` \| `other`                             |
| privateNote      | text                               | Instructor-only operational note                                                      |
| status           | pgEnum (intervention_status)       | `open` \| `monitoring` \| `resolved` \| `dismissed`; defaults to `open`             |
| followUpDate     | timestamp                          | Optional instructor-only follow-up date                                               |
| resolutionReason | text                               | Required when transitioning to `resolved` or `dismissed`                              |
| createdAt        | timestamp                          |                                                                                       |
| updatedAt        | timestamp                          |                                                                                       |

Indexes support assignment/status, assignment/student, and follow-up-date queries. A partial unique index on `(assignmentId, studentId)` where `status IN ('open', 'monitoring')` guarantees at most one active intervention per student-assignment pair while retaining resolved/dismissed history. The schema and rollback are versioned in migration `0017_faulty_anita_blake.sql` and `drizzle/migrations/rollback/0017_faulty_anita_blake.rollback.sql`.

> **Intervention privacy and transaction safety (TRACK-050):** Instructor server functions authorize through the current assignment owner, so reassignment transfers access to the replacement instructor and removes former-owner access. Creation locks the owned assignment and enrollment with `FOR UPDATE`; lifecycle updates lock the joined assignment and intervention together before validating ownership and status. Valid transitions are `open ↔ monitoring` and either active status → `resolved`/`dismissed`; terminal rows cannot be modified. Audit events are written after commit as advisory work, and follow-up dates do not create notifications.

#### checkpoint_discussions

| Column          | Type                                  | Notes                                                                   |
| --------------- | ------------------------------------- | ----------------------------------------------------------------------- |
| id              | serial (PK)                           |                                                                         |
| checkpointId    | integer (FK → checkpoints)            | `onDelete: cascade`                                                     |
| assignmentId    | integer (FK → assignments)            | `onDelete: cascade` — denormalized for efficient instructor queries     |
| userId          | text (FK → users)                     | Message author                                                          |
| message         | text, not null                        | 1–2000 chars (validated at Zod layer)                                  |
| parentMessageId | integer (FK → checkpoint_discussions) | NULLABLE — self-referencing for threaded replies                        |
| createdAt       | timestamp                             |                                                                         |
| updatedAt       | timestamp                             | Set equal to `createdAt` on insert (reserved for v2 edit support)      |
| deletedAt       | timestamp                             | NULLABLE — soft-delete (deleted messages render as "[deleted]" placeholder, replies preserved) |

Indexes: `(checkpointId, createdAt ASC)` for message list queries, `(assignmentId, createdAt DESC)` for instructor overview, `(parentMessageId)` for reply threading.

> **Post-commit advisory work (Track: Checkpoint Discussion / Q&A Threads):** The `postDiscussionMessageHandler` in `src/server/discussions.server.ts` dispatches a `discussion_reply` notification and email to the other party (student → instructor, instructor → student) as **post-commit advisory work** — the notification insert and email enqueue run after the transaction commits, wrapped in individual try/catch blocks per SQL styleguide §6.4. If the email enqueue fails, the notification and message are already durable — the user sees no error.

> **Soft-delete with thread preservation (Track: Checkpoint Discussion / Q&A Threads):** Deleted messages are soft-deleted via `deletedAt` (matching the codebase convention). The message list query includes soft-deleted messages as "[deleted]" placeholders when they have replies, preserving the thread structure. The delete handler enforces a 15-minute window — after 15 minutes, the delete button is hidden and the message cannot be deleted.

#### notifications

| Column    | Type                   | Notes                                   |
| --------- | ---------------------- | --------------------------------------- |
| id        | serial (PK)            |                                         |
| userId    | text (FK → users)      | Recipient                               |
| type      | text, not null         | Event type identifier                   |
| titleKey  | varchar(255), not null | i18n key for localized title            |
| messageKey| varchar(255), not null | i18n key for localized message          |
| params    | jsonb                  | Interpolation params (e.g. checkpointName) |
| read      | boolean, default false |                                         |
| channel   | text, not null         | in_app \| email                         |
| metadata  | jsonb                  | Event-specific data (e.g. assignmentId) |
| createdAt | timestamp              |                                         |

#### notification preferences (stored in `users.settings` JSONB)

No separate table. Notification preferences are stored as a `notificationPrefs` key inside the `users.settings` JSONB column:

```typescript
settings: {
  reducedMotion: boolean;
  notificationPrefs?: Record<string, {
    email?: boolean;  // default true when absent
    inApp?: boolean;  // default true when absent
  }>
}
```

The `notificationPrefs` key maps notification `type` strings (e.g., `submission_received`, `review_completed`, `sla_breach`) to per-channel booleans. Absent key or absent sub-field = enabled (opt-out model).

The `updateUserSettingsHandler` in `src/server/settings.server.ts` uses a read-modify-write merge pattern (SELECT existing settings → spread new values → UPDATE) to prevent `notificationPrefs` from overwriting `reducedMotion` and vice versa.

#### extension_requests

| Column            | Type                       | Notes                                          |
| ----------------- | -------------------------- | ---------------------------------------------- |
| id                | serial (PK)                |                                                |
| assignmentId      | integer (FK → assignments) |                                                |
| studentId         | text (FK → users)          |                                                |
| checkpointId      | integer (FK → checkpoints) | NULLABLE — which specific checkpoint is needed |
| requestedDeadline | timestamp, not null        | Proposed new deadline                          |
| reason            | text, not null             | Student's explanation                          |
| category          | text, not null             | personal \| research \| health \| other        |
| extensionDays     | integer, not null          | 1–30 (CHECK constraint)                        |
| status            | text, not null             | pending \| approved \| rejected                |
| resolvedBy        | text (FK → users)          | NULLABLE — instructor who acted                |
| resolutionReason  | text                       | NULLABLE — required for rejection              |
| createdAt         | timestamp                  |                                                |
| resolvedAt        | timestamp                  | NULLABLE                                       |

Index on `(assignmentId, status)` for instructor queue queries. Index on `(assignmentId, studentId)` for per-student extension lookup (added TRACK-005).

> **Transactional write boundary (Track: Concurrency & Transaction Safety):** The `requestExtensionHandler` in `src/server/extensions.server.ts` wraps the `extension_requests` insert, the instructor's in-app `notifications` insert, **and** the extension count cap check in a single `db.transaction(async (tx) => { ... })` block. Both inserts use the `tx` client — if the notification insert throws, the transaction rejects and the extension request is rolled back, preventing orphaned extension records without their alert. The extension count check (`maxTotalExtensions` enforcement) is performed **inside** the transaction with a `FOR UPDATE` lock on the matching `assignment_students` row, preventing a TOCTOU race where two concurrent extension requests could both pass the count check and exceed the cap. The `requestedDeadline` calculation is also performed inside the transaction callback. The remaining validation reads (session, role, assignment existence, student enrollment, checkpoint state) run outside the transaction. This pattern follows SQL style guide §6 (transaction wrapping) and is consistent with `submitReviewHandler` (`src/server/reviews.server.ts`), which also places in-app notification inserts inside the transaction boundary.

> **Extension approve/reject transaction safety (Track: Concurrency & Transaction Safety):** The `approveExtensionHandler` and `rejectExtensionHandler` in `src/server/extensions-extras.server.ts` read the `extension_requests` row **inside** a `db.transaction` with `FOR UPDATE` on the extension request row, then re-validate `status === 'pending'` after acquiring the lock. If the locked re-read shows the status has changed (e.g. another request already approved/rejected it), the operation is rejected with a stale-state error. On approval, `calculateExtensionAdjustment` locks the affected `checkpoints` rows with `FOR UPDATE` inside the same transaction before reading and adjusting their `dueDate` values, preventing concurrent deadline modifications from producing inconsistent results. Notification INSERTs run inside the transaction; audit logging runs post-commit in a try/catch.

#### audit_log

| Column     | Type              | Notes                                                                                              |
| ---------- | ----------------- | -------------------------------------------------------------------------------------------------- |
| id         | serial (PK)       |                                                                                                    |
| actorId    | text (FK → users) | NOT NULL — who performed the action                                                                |
| action     | text, not null    | `user.created`, `template.deleted`, `assignment.created`, `review.passed`, etc.                    |
| entityType | text, not null    | `user` \| `template` \| `assignment` \| `checkpoint` \| `submission` \| `review` \| `consultation` \| `intervention` |
| entityId   | text, not null    | Stringified ID of affected entity                                                                  |
| details    | jsonb             | NULLABLE — previous value, new value, reason, etc.                                                 |
| createdAt  | timestamp         | DEFAULT NOW()                                                                                      |

Index on `(created_at DESC)` for time-ordered queries. Index on `(action)` for type filtering. Index on `(entity_type, entity_id)` for entity-specific history. Index on `(actorId)` for JOIN in listAuditLogsHandler (added TRACK-005).

#### email_queue

| Column         | Type               | Notes                                                           |
| -------------- | ------------------ | --------------------------------------------------------------- |
| id             | serial (PK)        |                                                                 |
| recipientEmail | text, not null     |                                                                 |
| subject        | text, not null     |                                                                 |
| bodyHtml       | text, not null     |                                                                 |
| templateType   | text, not null     | `password_reset` \| `invitation` \| `sla_alert` \| `two_factor` \| `submission_received` \| `review_completed` \| `revision_requested` \| `consultation_verified` \| `consultation_rejected` \| `extension_approved` \| `extension_rejected` \| `extension_requested` \| `deadline_reminder` \| `student_at_risk` \| `discussion_reply` (15 values — 4 original + 11 event types; `deadline_reminder` added in TRACK-021, `student_at_risk` added in TRACK-023, `discussion_reply` added in TRACK-026) |
| status         | text, not null     | `pending` \| `processing` \| `sent` \| `failed`                 |
| attempts       | integer, default 0 |                                                                 |
| lastAttemptAt  | timestamp          | NULLABLE                                                        |
| errorMessage   | text               | NULLABLE — last failure reason                                  |
| resendMessageId | text             | NULLABLE — Resend API message ID for delivery correlation (TRACK-016) |
| createdAt      | timestamp          | DEFAULT NOW()                                                   |

#### deadline_reminders

| Column       | Type                       | Notes                                                             |
| ------------ | -------------------------- | ----------------------------------------------------------------- |
| id           | serial (PK)                |                                                                   |
| checkpointId | integer (FK → checkpoints) | `onDelete: cascade`                                               |
| studentId    | text (FK → users)          | `onDelete: cascade`                                               |
| tier         | text, not null             | `'7d'` \| `'3d'` \| `'1d'` — reminder lead time                   |
| sentAt       | timestamp                  | DEFAULT NOW()                                                      |

Unique constraint on `(checkpointId, tier)` — guarantees at-most-once delivery per tier per checkpoint across multiple server instances. The scanner uses `INSERT ... ON CONFLICT (checkpointId, tier) DO NOTHING RETURNING *` to atomically deduplicate — only winning inserts (where this instance won the race) proceed to notification creation and email dispatch.

Composite index `checkpoints_state_due_date_idx` on `checkpoints (state, dueDate)` — supports the scanner's WHERE `state IN ('unlocked', 'revise') AND dueDate BETWEEN ...` query (added in TRACK-021; no existing index covered `dueDate`).

> **Transactional write boundary (Track: Proactive Deadline Reminder System):** The `processDeadlineReminders()` scanner in `src/lib/deadline-reminder-scanner.ts` wraps the dedup INSERT (into `deadline_reminders`) and the batch notification INSERT (into `notifications`) in a single `db.transaction(async (tx) => { ... })`. If the notification insert fails, the dedup row is rolled back, allowing the tier to retry on the next hourly scan. Email dispatch runs **post-commit** via `Promise.allSettled` (advisory — never throws, following SQL styleguide §6.4). This follows the same transactional pattern as `requestExtensionHandler` (extension request + notification inserts in one transaction).

#### upload_intents

| Column        | Type                          | Notes                                                                                          |
| ------------- | ----------------------------- | ---------------------------------------------------------------------------------------------- |
| fileKey       | text, not null, unique        | R2 object key (UUID-based) — bound to this intent at presign time                               |
| userId        | text (FK → users)             | User who requested the presigned URL                                                           |
| purpose       | upload_purpose enum, not null | `submission` \| `review_feedback`                                                              |
| checkpointId  | integer (FK → checkpoints)    | NULLABLE — target checkpoint for submission uploads; null for review feedback                  |
| fileName      | text                          | NULLABLE — client-reported original filename (not trusted at submit)                           |
| fileSize      | integer                       | NULLABLE — client-reported size in bytes (not trusted at submit; verified via R2 HEAD request) |
| contentType   | text, not null                | MIME type validated at presign time                                                             |
| expiresAt     | timestamp, not null           | Intent validity window (presigned URL TTL)                                                     |
| consumedAt    | timestamp                     | NULLABLE — set when the intent is verified and consumed at submit time (single-use enforcement) |
| cleanedUpAt   | timestamp                     | NULLABLE — set when the orphaned R2 object is deleted by the cleanup scanner (Track: Orphaned R2 Object Cleanup) |
| createdAt     | timestamp                     | DEFAULT NOW()                                                                                  |

> **Trust boundary (Track: Audit HIGH-Remediation H1):** Presigned upload URLs are never issued without a corresponding `upload_intents` row. At submit time, the handler verifies the intent exists, belongs to the requesting user, matches the expected purpose and checkpoint, has not expired, and has not already been consumed. The server then issues an R2 `HeadObjectCommand` to read the actual `ContentLength` — the client-reported `fileSize` is never trusted. This prevents cross-user file hijacking, fabricated file keys, and size spoofing.

> **Orphaned object cleanup (Track: Orphaned R2 Object Cleanup):** When a user requests a presigned upload URL but never submits the file, the R2 object becomes orphaned. The `processOrphanedR2Objects()` scanner in `src/lib/r2-cleanup.ts` runs every 6 hours as part of the email queue tick loop (throttled by in-memory `lastR2CleanupAt`, same pattern as `lastReminderScanAt`). It queries intents where `consumedAt IS NULL AND expiresAt < now() AND cleanedUpAt IS NULL` (batch of 50), deletes the R2 objects via `DeleteObjectCommand` in parallel (`Promise.allSettled`), and sets `cleanedUpAt = now()` on success. Per-object failures leave `cleanedUpAt` null for retry on the next tick. The scanner is a no-op when R2 is not configured (`getR2Client()` returns null). Audit logging via `safeAuditLog` with `actorId: 'system'` for background runs. Admins can manually trigger cleanup via `triggerR2Cleanup()` (admin-only two-file split: `src/server/r2-cleanup.ts` stub + `src/server/r2-cleanup.server.ts` handler with `isAdmin` guard), which bypasses the throttle and logs with the admin's `userId` as `actorId`. The `processOrphanedR2Objects()` function accepts an `actorId` parameter (default `'system'`) to support this. Scanner failure is isolated via `try/catch` in the tick loop and does not affect email processing.

#### assignment_grade_config (Track: Gradebook & Final Grade Computation)

| Column           | Type                               | Notes                                                              |
| ---------------- | ---------------------------------- | ------------------------------------------------------------------ |
| assignmentId     | integer (FK → assignments), unique | 1:1 with assignments. `onDelete: cascade` — deleted with assignment |
| gradingScheme    | grading_scheme enum, not null      | `equal_weight` \| `custom_weight`. Default `equal_weight`          |
| customWeights    | jsonb, nullable                    | `{ [templateCheckpointId]: weight }` map, values 0–100. Used only when `custom_weight` |
| letterGradeBounds| jsonb, not null                    | `{ "A": 90, "B": 80, "C": 70, "D": 60 }` configurable lower bounds |
| createdAt        | timestamp                          | DEFAULT NOW()                                                      |
| updatedAt        | timestamp                          | DEFAULT NOW()                                                      |
| releaseStatus    | grade_release_status enum, not null | `draft` \| `published`. Default `draft`                              |
| activeReleaseVersion | integer, nullable              | Current student-visible snapshot version; retained when withdrawn |
| publishedAt      | timestamp, nullable                | Timestamp of the active publication                                 |

Auto-created inside `createAssignmentHandler` transaction via `createDefaultGradeConfig(tx, assignmentId)` helper. Pre-existing assignments backfilled by migration `0014_youthful_morg.sql`. Admin-only config changes audit-logged via `logAuditEvent` (action: `gradebook.config_updated`). The `logAuditEvent` call is awaited and wrapped in try/catch per SQL styleguide §6.4 (post-commit advisory pattern).

> **Stale weights detection (Track: Gradebook — Review Fix):** `areCustomWeightsValid` in `src/lib/grade-computation.ts` checks that (1) customWeights is not null, (2) the number of keys matches the number of checkpoints (no extra entries for removed checkpoints), (3) every checkpoint has a weight entry, and (4) weights sum to exactly 100. If any check fails, computation falls back to `equal_weight` averaging and sets `staleWeights: true` on the result.

#### final_grades (Track: Gradebook & Final Grade Computation)

| Column                | Type                       | Notes                                                                                    |
| --------------------- | -------------------------- | ---------------------------------------------------------------------------------------- |
| id                    | serial (PK)                |                                                                                          |
| assignmentId          | integer (FK → assignments) | `onDelete: cascade`                                                                       |
| studentId             | text (FK → users)          | No `onDelete` — users are soft-deleted, never hard-deleted                               |
| numericScore          | numeric(5,2), nullable     | Null if assignment is incomplete                                                          |
| letterGrade            | text, nullable             | A/B/C/D/F (or null if incomplete)                                                        |
| status                | final_grade_status enum, not null | `complete` \| `incomplete` \| `in_progress`                                      |
| contributingCheckpoints | jsonb, nullable           | Array of `{ checkpointId, checkpointName, templateCheckpointId, order, state, score, isRubric, weight }` |
| computedAt            | timestamp                  | DEFAULT NOW() — when the grade was last computed                                        |
| updatedAt             | timestamp                  | DEFAULT NOW()                                                                              |

Unique constraint on `(assignmentId, studentId)`. Indexes on `assignmentId` and `studentId`. Upserted (never individually deleted) — cache table for computed working grades. Recomputed on `pass` review decision via `recomputeStudentGrade` (post-commit advisory in `reviews-extras.server.ts`, try/catch, never affects review transaction). Admin "Recompute All Grades" wraps all student upserts in a single `db.transaction` for atomicity (SQL styleguide §6 — if one student's grade computation fails, all updates roll back). Student-facing release reads never use this table directly after publication; they use the active immutable snapshot.

#### grade_release_snapshots (TRACK-051: Grade Release Workflow)

| Column                | Type                                | Notes                                                                            |
| --------------------- | ----------------------------------- | -------------------------------------------------------------------------------- |
| id                    | serial (PK)                         |                                                                                    |
| assignmentId          | integer (FK → assignments)         | `onDelete: cascade`                                                              |
| studentId             | text (FK → users)                   | Enrolled student captured at publication                                         |
| releaseVersion        | integer, not null                   | Monotonically retained assignment release version                               |
| numericScore          | numeric(5,2), not null              | Authoritative complete score captured at publication                            |
| letterGrade           | text, not null                      | Letter grade captured at publication                                             |
| status                | final_grade_status enum, not null   | Complete release status                                                         |
| contributingCheckpoints | jsonb, not null                   | Immutable checkpoint breakdown shown with the released grade                    |
| publishedAt           | timestamp, not null                 | Publication timestamp for this snapshot                                          |

Unique constraint on `(assignmentId, releaseVersion, studentId)`. Indexes support assignment/version and student lookups. Publication inserts snapshots only for enrolled students with complete, non-null `final_grades`; recomputation cannot mutate existing rows. Withdrawal retains all snapshots, keeps the latest version for the next release, and clears only active publication visibility.

### Database Indexes

| Table                | Column(s)                | Type             | Purpose                                      |
| -------------------- | ------------------------ | ---------------- | -------------------------------------------- |
| `assignment_students`| `assignmentId`, `studentId` | composite b-tree | Ownership check + assignment-student lookup (TRACK-005) |
| `assignment_students`| `studentId`              | b-tree           | Student's assignment memberships (TRACK-005) |
| `checkpoints`        | `assignmentId`           | b-tree           | Fetch checkpoints when loading an assignment |
| `submissions`        | `checkpointId`           | b-tree           | Fetch submissions for a checkpoint           |
| `submissions`        | `uploadedBy`             | b-tree           | Student's submission history                 |
| `reviews`            | `submissionId`, `createdAt` | composite b-tree | Fetch review for a submission + ORDER BY createdAt DESC (TRACK-005 replaced single-column `submissionId`; leftmost prefix satisfies FK enforcement) |
| `consultations`      | `checkpointId`           | b-tree           | Count consultations for gating logic         |
| `consultations`      | `assignmentId`, `status` | composite b-tree | Filter pending verifications per assignment (TRACK-005 replaced low-cardinality single-column `status`) |
| `interventions`      | `assignmentId`, `status` | composite b-tree | Current-owner active intervention queries (TRACK-050) |
| `interventions`      | `assignmentId`, `studentId` | composite b-tree | Student-assignment history and context lookup (TRACK-050) |
| `interventions`      | `followUpDate`            | b-tree           | Overdue follow-up filtering (TRACK-050)       |
| `interventions`      | `assignmentId`, `studentId` (active only) | partial unique b-tree | One open/monitoring intervention per pair (TRACK-050) |
| `notifications`      | `userId`, `read`         | composite b-tree | Notification center filtering                |
| `notifications`      | `createdAt`              | b-tree           | Admin dashboard recentActivity query (TRACK-005) |
| `template_checkpoints`| `templateId`, `order`   | composite b-tree | Template checkpoint ordering (TRACK-005)     |
| `users`              | `role`, `deletedAt`      | composite b-tree | Admin user list filtering by role + active (TRACK-005) |
| `verification`       | `value`                  | b-tree           | Token lookup on password setup/reset         |
| `final_grades`       | `assignmentId`            | b-tree           | Gradebook query per assignment (TRACK-025)   |
| `final_grades`       | `studentId`              | b-tree           | Student grade lookup (TRACK-025)             |
| `grade_release_snapshots` | `assignmentId`, `releaseVersion` | composite b-tree | Active release snapshot lookup (TRACK-051) |
| `grade_release_snapshots` | `studentId`            | b-tree           | Student snapshot lookup (TRACK-051)         |
| `audit_log`          | `createdAt`              | b-tree           | Time-ordered queries                         |
| `audit_log`          | `action`                 | b-tree           | Type filtering                               |
| `audit_log`          | `entityType`, `entityId` | composite b-tree | Entity-specific history                      |
| `audit_log`          | `actorId`                | b-tree           | JOIN in listAuditLogsHandler (TRACK-005)     |
| `extension_requests` | `assignmentId`, `status` | composite b-tree | Instructor queue queries                     |
| `extension_requests` | `assignmentId`, `studentId` | composite b-tree | Per-student extension lookup (TRACK-005)  |
| `email_queue`        | `status`                 | b-tree           | Pick pending emails for delivery             |
| `upload_intents`     | `fileKey`                | b-tree (unique)  | Intent lookup at submit time                 |
| `upload_intents`     | `userId`                 | b-tree           | User's pending upload intents                 |
| `checkpoints`        | `templateCheckpointId`  | b-tree           | Rubric lookup via FK join (TRACK-020)         |
| `review_scores`      | `criterionId`           | b-tree           | Analytics queries joining on criterion (TRACK-020) |
| `revision_action_items` | `reviewId`, `order` | composite b-tree | Stable current/history action-plan reads (TRACK-054) |
| `revision_action_items` | `reviewId`, `addressedAt` | composite b-tree | Current-plan addressed-status updates and filtering (TRACK-054) |
| `checkpoint_discussions` | `checkpointId`, `createdAt` | composite b-tree | Message list queries ordered by createdAt ASC (TRACK-026) |
| `checkpoint_discussions` | `assignmentId`, `createdAt` | composite b-tree | Instructor overview across all checkpoints (TRACK-026) |
| `checkpoint_discussions` | `parentMessageId`       | b-tree           | Reply threading lookup (TRACK-026)            |

All indexes use Drizzle's `index()` or `uniqueIndex()` API. Migrations generated with `drizzle-kit generate`. Migration `0008_deep_santa_claus.sql` (TRACK-005) added 7 new indexes and replaced 2 low-cardinality single-column indexes with composites. Migration `0009_familiar_hydra.sql` (TRACK-016) added the `resend_message_id` column to `email_queue`. Migrations `0010`–`0012` (TRACK-020) added rubric tables (`rubric_criteria`, `rubric_levels`, `review_scores`), `grading_type` pgEnum, `checkpoints.templateCheckpointId` FK + backfill, `template_checkpoints.deletedAt`, and the two rubric-related indexes. Migration `0014_sour_nightshade.sql` (TRACK-026) added the `checkpoint_discussions` table with 3 indexes. Migration `0016` (TRACK-039) added the `cleanedUpAt` timestamp column to `upload_intents`. Migration `0019_daffy_bulldozer.sql` (TRACK-051) added release state, immutable snapshots, indexes, and foreign keys; migration `0020_white_spacker_dave.sql` (TRACK-055) added the calendar feed token; migration `0021_round_mysterio.sql` (TRACK-054) added revision action items and its two composite indexes. Companion rollbacks are kept in `drizzle/migrations/rollback/`. Each migration has a companion rollback file at `drizzle/migrations/rollback/<NNNN>_<tag>.rollback.sql`.

---

## 4. Authentication & Authorization

### Roles & Hierarchy

```
SuperAdmin  (seeded, creates Admins only)
    │
    ▼
Admin       (creates Instructors and Students)
    │
    ├──► Instructor  (creates assignments, reviews submissions)
    └──► Student     (submits work, logs consultations)
```

**Permission boundaries:**

| Action                              | SuperAdmin | Admin | Instructor | Student |
| ----------------------------------- | ---------- | ----- | ---------- | ------- |
| Create Admin                        | ✓          | —     | —          | —       |
| Create Instructor/Student           | —          | ✓     | —          | —       |
| Manage templates                    | —          | ✓     | —          | —       |
| Create assignments                  | —          | —     | ✓          | —       |
| Review submissions                  | —          | —     | ✓          | —       |
| Submit checkpoint work              | —          | —     | —          | ✓       |
| Log consultations                   | —          | —     | —          | ✓       |
| Verify consultations                | —          | —     | ✓          | —       |
| View own progress                   | —          | —     | —          | ✓       |
| View all progress                   | —          | —     | ✓          | —       |
| List students (assignment creation) | —          | —     | ✓          | —       |
| View system analytics               | ✓          | ✓     | —          | —       |
| Read audit logs                     | ✓          | ✓     | —          | —       |

### User Registration Flow [v1]

```
1. System is deployed → SuperAdmin account is seeded into the database
   (credentials delivered out-of-band, e.g. in deployment logs)

2. SuperAdmin logs in, navigates to /admin/users, creates an Admin account
   → System generates password_reset_token
   → System sends email via Resend with setup link: /auth/setup-password?token=xxx

3. Admin receives email, clicks link, sets password, logs in.

4. Admin creates Instructor and Student accounts
   → Same flow: email with password setup link sent to each new user.
   → Admin can also copy the setup link from the dashboard to share manually.

5. User sets password → logs in → sees role-appropriate dashboard.

**Forgot Password Flow:**
- User clicks "Forgot Password" on the login page and enters their email.
- System generates a `password_reset_token` and sends a reset link via email.
- User clicks link, enters new password, token is marked as `used`.
```

**Key rules:**

- No self-registration. No `/auth/register` page.
- Password setup links expire after 1 hour.
- Tokens are single-use. Password setup tokens are consumed **atomically** via `DELETE ... RETURNING` inside a database transaction — see the `verification` table note above for the full security rationale.
- Resend handles all transactional email delivery.
- **Restore-on-soft-deleted:** When creating a user whose email matches a soft-deleted account (Admin single-create via `createUserHandler` or bulk import via `bulkCreateUsersHandler`), the existing account is restored — `deletedAt` cleared, name/role updated — and a new invitation email is sent, rather than rejecting the duplicate.

### Session & Access Control [v1]

- Server-side sessions stored in the `session` table (managed by Better-Auth via Drizzle adapter).
- Session validation via `getSessionFromHeaders()` server function using `auth.api.getSession()` with SSR request headers.
- **Two-file split (Track: Session Caching & Bundle Safety):** `src/server/auth.ts` is a client-safe stub (43 lines) exporting the `Session` type, `getSessionFromHeaders`, `requireRole`, and `_getSession` (a `typedServerFn` stub that dynamically imports the handler). It contains no DB, schema, or Better-Auth config imports — ensuring `pg`/`drizzle-orm` do not leak into the client bundle. The actual handler logic lives in `src/server/auth.server.ts` (~100 lines): Better Auth session validation, DB query for user role/locale, and the session cache. All 6 route layout files import from `auth.ts` and receive only client-safe code.
- **Session cache (Track: Session Caching & Bundle Safety):** A 5s-TTL in-memory `Map<string, { role, locale, expiresAt }>` cache sits inside `getSessionHandler` in `auth.server.ts`. After `auth.api.getSession()` returns a valid user ID, the cache is checked. On a hit (not expired), the cached role/locale is returned and the DB query is skipped. On a miss, the DB query runs and the result is cached with a 5s TTL. Expired entries are evicted lazily on cache miss. **Tradeoff:** soft-deleted users and role changes take up to 5s to take effect — acceptable for a university system. The Better Auth `getSession()` call runs on every request (the cache only skips the DB query, not session validation). A `clearSessionCacheForTests` helper is exported for test isolation.
- Route-level guard via TanStack Router `beforeLoad`:
  - `_unauthenticated` layout redirects authenticated users to their role-specific dashboard via `getRoleDashboard()`.
  - `_authenticated` layout redirects unauthenticated users to `/auth/login`.
- Role-based access via `requireRole(roles)` helper — wraps session check with role validation. Unauthorized users are redirected to their own dashboard. `requireRole` uses `isAuthenticated` from the shared `src/lib/session-guards.ts` module (Track: Server-Side Guard Consolidation). All 20 `*.server.ts` handler files import `isAdmin`/`isInstructor`/`isStudent`/`isAuthenticated` type-guards from this shared module instead of defining inline duplicates — the guards accept `NonNullableSession | null` and return `session is NonNullableSession`, and the module is client-safe (no server-only imports).
- Password hashing uses Better-Auth's built-in scrypt via `better-auth/crypto`.
- File downloads check ownership and role before generating a presigned URL.

### Two-Factor Authentication & Session Management

- TOTP via authenticator app using Better Auth's built-in `twoFactor` plugin.
- Backup codes (8 single-use) generated on enable; user must confirm they've saved them.
- Login prompts for 6-digit TOTP code when 2FA is enabled; backup code works as fallback.
- Per-user enable/disable with current password confirmation.
- Active sessions dashboard showing device, IP, and timestamp per session. Users can revoke specific sessions or all other sessions.
- Email notification sent on 2FA enable/disable via the email queue. Subjects are localized via `resolveEmailSubject()` using the user's `locale` (TRACK-034).
- All 2FA and session actions logged to the audit log.

---

## 5. File Management [v1]

### Upload Flow (Cloudflare R2)

```
1. Client selects file
2. Client calls server function → creates upload_intents record (binds fileKey, userId, purpose, checkpointId, expiry), generates short-lived presigned PUT URL
3. Client uploads file directly to R2 via the presigned URL
4. Client calls server function → verifies intent (ownership, purpose, expiry, single-use), performs R2 HEAD for actual file size, records file metadata + consumes intent in PostgreSQL
5. UI confirms upload complete
```

### Rules

| Aspect               | Rule                                                                                                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Accepted formats** | `.docx` and `.pdf` only. Enforced client-side (accept attribute) and server-side (MIME check).                                                                                                                     |
| **File naming**      | UUID-based keys in R2 (e.g. `submissions/{uuid}.pdf`). Original name stored in DB.                                                                                                                                 |
| **Presigned URLs**   | 5 minutes for upload, 1 hour for download.                                                                                                                                                                         |
| **Size verification**| Server-side via R2 `HEAD` request at submit time. Client-reported size is never trusted (Track: Audit HIGH-Remediation H1). The HEAD check is performed **before** `db.transaction()` opens, so row locks are not held during I/O (BUG-14). |
| **Versioning**       | Version increments by 1 each time a student resubmits after a REVISE decision. Initial submission is version 1.                                                                                                    |
| **Preview**          | PDF: in-browser via blob URL. [v2: use range requests to fetch only the first few pages for thumbnail preview instead of downloading the full 25MB file.] DOCX: inline HTML preview via `mammoth.js` (lazy-loaded via dynamic `import('mammoth')`, converted client-side from the presigned download URL, rendered in a sandboxed `<iframe srcDoc={html} sandbox="">` — no `allow-scripts` or `allow-same-origin`). Size guard: only attempts conversion if `fileSize < 10MB`; above that, shows a "file too large for inline preview" message with download button. Conversion errors fall back to a "Preview not available" card. Other file types: metadata display only (name, size, date, version). |
| **Permissions**      | Students see own submissions; instructors see all for their assignments; admins see all.                                                                                                                           |

> **File-type validation (Track 8.3):** Instructor feedback uploads (`getPresignedReviewFeedbackUploadUrlHandler`) now enforce the same `.docx`/`.pdf`-only policy via `validateUploadType(extension, contentType)` before presigning — previously skipped, allowing arbitrary file types to be uploaded to R2.

---

## 6. Checkpoint Lifecycle [v1]

### State Machine

```
LOCKED → UNLOCKED → SUBMITTED → UNDER_REVIEW → PASSED
                                             → REVISE → UNLOCKED (loop)
```

| State        | Meaning                                           | User action                   |
| ------------ | ------------------------------------------------- | ----------------------------- |
| LOCKED       | Prerequisite not met; or overdue and not unlocked | None                          |
| UNLOCKED     | Eligible for submission                           | Student can upload            |
| SUBMITTED    | Files uploaded, awaiting review                   | Wait                          |
| UNDER_REVIEW | Instructor is reviewing                           | Wait                          |
| PASSED       | Approved                                          | Next checkpoint unlocks       |
| REVISE       | Changes requested                                 | Resubmit by revision deadline |

### Unlock Rules

A checkpoint unlocks when:

1. Previous checkpoint state === PASSED (or it is the first checkpoint).
2. Number of verified consultations for this checkpoint >= `minConsultations`.

### Overdue Behavior

- When a checkpoint's `dueDate` passes, it auto-locks (if not already submitted).
- Instructor can manually unlock an overdue checkpoint.
- The assignment's `finalDeadline` is a **soft target** and is **immutable after creation** — it is never mutated by extensions, SLA-breach adjustments, or direct extension. It does not auto-lock anything. Individual checkpoint `dueDate` values are what enforce deadlines. Each student's effective deadline is derived at read time from their first non-passed checkpoint's `dueDate` (via the shared `computeEffectiveDeadline` helper).
- On-time submissions awaiting review: if the instructor reviews late, the student is not penalized. Subsequent deadlines are **automatically extended by the number of days the review was delayed** (breach duration added to affected deadlines).

### Review SLA (3 days)

- Instructors have a 3-day SLA to review submissions from the time the student uploads (`submissions.uploadedAt`).
- If the SLA is breached, an `sla_breach` in-app notification is sent to the Admin.
- The SLA is advisory (non-blocking) — Admin can follow up with the instructor. No automatic action is taken beyond the alert and the automatic deadline adjustment for the student (see Overdue Behavior above).
- The SLA timer is anchored at `submissions.uploadedAt` (when the student uploaded the file), not `reviews.reviewedAt` — ensuring the breach duration reflects the actual delay the student experienced.

---

## 7. Consultation Module [v1]

### Data Model

- Each consultation is tied to a specific `checkpointId` so gating can be evaluated per-stage.
- `sessionType`: `internal` (system instructor) or `external` (guest supervisor/clinician).
- `externalConsultantName`: free-text name (not a User reference) for external sessions.
- The `minConsultations` threshold per checkpoint is defined by the **Admin in the assignment template** (`template_checkpoints`). When an assignment is created from a template, this value is copied to each `checkpoint` row.

### Verification Workflow

1. Student logs a consultation via the assignment detail page (tab or sub-route `/consultations`).
2. Instructor sees pending verifications on their dashboard.
3. Instructor approves or rejects with reason.
4. Verification updates progress bars at both assignment and checkpoint levels.
5. If the checkpoint `minConsultations` threshold is met, the unlock condition is satisfied.

---

## 8. Notification System

### Events & Channels

| Event                 | Trigger                      | In-app [v1]    | Email [v1]          |
| --------------------- | ---------------------------- | -------------- | ------------------- |
| invitation_sent       | Admin creates user           | —              | ✓                   |
| password_setup        | Password set by user         | —              | ✓                   |
| submission_received   | Student uploads file         | ✓ (instructor) | ✓ (instructor)      |
| review_completed      | Instructor marks pass/revise | ✓ (student)    | ✓ (student — pass)  |
| revision_requested    | Instructor marks revise      | ✓ (student)    | ✓ (student)         |
| deadline_approaching  | 24h / 1h before due date     | ✓              | ✓                   |
| deadline_missed       | Checkpoint overdue           | ✓              | ✓                   |
| consultation_verified | Instructor approves log      | ✓ (student)    | ✓ (student)         |
| consultation_rejected | Instructor rejects log       | ✓ (student)    | ✓ (student)         |
| extension_requested   | Student requests extension   | ✓ (instructor) | ✓ (instructor)      |
| extension_approved    | Instructor approves extension| ✓ (student)    | ✓ (student)         |
| extension_rejected    | Instructor rejects extension | ✓ (student)    | ✓ (student)         |
| sla_breach            | Instructor misses review SLA | ✓ (admin)      | ✓ (admin — via `sendSLAAlertEmail`) |
| student_at_risk       | Student risk ≥ medium after revise/SLA breach or scanner check | ✓ (instructor) | ✓ (instructor — via `sendStudentAtRiskEmail`) |

### In-App Delivery [v1]

- Notifications stored in the `notifications` table with i18n keys (`titleKey`, `messageKey`) and interpolation `params` (jsonb) instead of literal text. The `listNotifications` handler resolves the display strings at read time using the requesting user's `locale` (read directly from `session.user.locale` — no separate DB query), so Indonesian users see Indonesian notifications and English users see English. The handler selects `id, type, titleKey, messageKey, params, read, createdAt, metadata` — `metadata` was added back (Track: Notifications & File Management UX) to support client-side notification navigation. Response objects are constructed explicitly to avoid leaking raw columns.
- TanStack Query polls for new unread notifications at a 30-second interval (`refetchInterval: 30000`) with `refetchIntervalInBackground: false` (stops polling when the tab is not visible, reducing server load by ~75%). The notification list uses `staleTime: 30_000` to prevent unnecessary refetches on window focus/mount when data is fresh. The notification bell in the shared header reflects the unread count.
- **Notification navigation (Track: Notifications & File Management UX):** Notifications are clickable links that navigate to the relevant page based on their `type` and stored `metadata` (assignmentId, checkpointId, submissionId). A `getNotificationRoute(type, metadata)` helper in `src/components/notifications/notification-routes.ts` derives the route client-side (e.g., `review_completed` → `/student/assignments/{assignmentId}/checkpoints/{checkpointId}`, `student_at_risk` → `/instructor/assignments/{assignmentId}`). `NotificationItem` renders as a TanStack Router `<Link>` when a route exists, falling back to a `<button>` when no route can be derived. Clicking a notification calls `markAsRead` before navigating.
- **Read/Unread filter & Load More (Track: Notifications & File Management UX):** The notification center has "All" and "Unread" tabs (shadcn/ui `Tabs`). The "Unread" tab filters server-side via `.where(eq(notifications.read, false))` when `unreadOnly` is true. The list loads 20 items at a time with a "Load More" button that appends the next page (incremental loading with ID deduplication).
- **Client-side performance (Track: Notifications & File Management UX):** `NotificationItem` is wrapped in `React.memo` with `useCallback` for `handleClick`. `NotificationCenter` uses `useMemo` for `groupedNotifications` and `unreadCount`, eliminating redundant `items.filter()` calls and double unread count computation on every render.
- **Optimistic mark-as-read (Track: Optimistic UI Updates for Mutations):** `useMarkRead` and `useMarkAllRead` use TanStack Query's `onMutate` to flip the `read` flag and decrement the unread count in the cache instantly — before the server responds. On error, the previous cache snapshot is restored (`onError` rollback). The unread badge drops to zero immediately when "Mark all as read" is clicked. Cache invalidation runs in `onSettled` to reconcile. Query keys use the `notificationKeys` factory from `src/lib/query-keys.ts`.
- **Notification center UI (Track: Accessibility & i18n Compliance):** The slide-over panel is built on the shadcn `Sheet` primitive (`@base-ui/react/dialog`), which provides built-in focus trapping, Escape-key dismissal, and backdrop-click close — replacing a former custom backdrop div + panel div that lacked focus management. Navigable `NotificationItem`s render as TanStack Router `<Link>` elements; non-navigable items fall back to native `<button type="button">` for keyboard access (Tab focus, Enter/Space activation). The `NotificationBadge` button exposes a dynamic `aria-label` that includes the unread count (e.g. "5 unread notifications") and an `aria-live="polite"` region so screen readers announce count changes without stealing focus. The count `<span>` no longer carries `role="status"` — the button's dynamic `aria-label` conveys the count.
- Badge indicator on the sidebar.

### Email Delivery

- Sent via Resend API. [v1] for all email types — auth-related emails (invitations, password reset, 2FA enable/disable), SLA alerts, and **11 event notification types** (submission received, review completed, revision requested, consultation verified/rejected, extension approved/rejected, extension requested, deadline reminder, student at risk, discussion reply). Event emails are dispatched as **post-commit advisory work** alongside existing in-app notifications via `enqueueEventEmail()` (`src/lib/event-email.ts`) — the primary operation always succeeds even if email enqueue fails. HTML templates are built by domain-specific helper functions in `src/lib/email-templates.ts` (11 builders + shared header/footer). Recipients with no verified email or soft-deleted accounts are silently skipped via `resolveEmailRecipient()` in `src/lib/email.ts`.
- **Localized email subjects:** Password reset, invitation, 2FA enable/disable, SLA alert, and all 9 event notification subjects are resolved from i18n keys (`emails.subjects.*`) using the recipient's `locale` preference via `resolveEmailSubject()` in `src/lib/i18n-server.ts` (falls back to raw key if not found — non-crashing). Event email subjects are prefixed with `[SIMAK]` (e.g., `[SIMAK] New Submission Received`). Subjects support parameter interpolation (e.g., `{assignmentTitle}` in the deadline reminder subject) via optional `subjectParams` on `enqueueEventEmail`.
- Email queue (`email_queue` table) with retry logic: 3 attempts with exponential backoff (30s, 5min, 30min).
- Dead letter after 3 failed attempts (logged, not retried).
- **Concurrent batch sends:** The processor sends emails in chunks of 5 via `Promise.allSettled` (chunks run sequentially). Each email's success/failure is handled individually in the settled callback (same UPDATE logic). Partial failures don't abort the batch. Cycle latency reduced from ~10× to ~2× single-send latency for a full batch of 10 (TRACK-016, PERF-32/33).
- **Retention cleanup:** `sent` rows older than 90 days and `failed` rows older than 180 days are automatically pruned on a tick-embedded 24-hour cycle (`lastPruneAt` timestamp in `email-queue-init.ts`). `pending`/`processing` rows are never deleted. Logged as `email_queue.retention_pruned` with deleted count (no PII) (TRACK-016, ENH-OPS-1/BUG-20).
- **Delivery tracking:** A `resendMessageId` column (populated from the Resend API `result.data.id` on successful send) enables correlation with Resend's delivery dashboard. Exposed in the admin email queue inspector as a monospace truncated cell with tooltip (TRACK-016, BUG-4).
- **Concurrency hardening:** rows are claimed inside a transaction using `FOR UPDATE SKIP LOCKED` and marked `processing`; the Resend send occurs **outside** the transaction so no long-lived lock is held. An in-process `isRunning` guard prevents overlapping ticks. Rows stuck in `processing` for > 5 minutes are reclaimed to `pending` at the start of each tick, preventing lockup on worker crash.
- **Startup stale-row reclaim (TRACK-045):** `reclaimAllProcessingRows()` runs in `startEmailQueue()` before the first `tick()`, resetting ALL `status='processing'` rows to `pending` with no time threshold. Since a fresh process start means no instance could be processing them, all stuck rows from a crashed previous instance are reclaimed immediately — eliminating the up-to-5-minute delay from the in-tick threshold-based reclaim.
- **Graceful shutdown (TRACK-045):** `registerShutdownHandlers()` in `src/lib/shutdown.ts` registers `SIGTERM`/`SIGINT` handlers (guarded by `import.meta.env.SSR`) that: (1) clear the `setInterval`, (2) await the in-flight `tick()` via async `stopGracefully()` (drain), (3) close the DB pool via `closeDb()`, (4) `process.exit(0)`. A second signal during drain forces `process.exit(1)` (standard container force-kill pattern). A configurable timeout (`SHUTDOWN_TIMEOUT_MS`, default 10000ms) forces `process.exit(1)` if the drain doesn't complete. The former sync `stopEmailQueue()` (dead code — only called in tests) is replaced by async `stopGracefully()`. Wired in `src/router.tsx` alongside `startEmailQueue()`.
- **XSS hardening:** all user-derived interpolations in email bodies are passed through an `escapeHtml` helper before rendering, preventing stored-XSS via user-controlled fields (name, email, subject context).

### Preferences [v1] (Track: User Notification Preferences)

- Users control notification delivery per event type and per channel via the `notificationPrefs` key in `users.settings` JSONB column (no separate table).
- **13 notification types** organized into 4 groups: Reviews (review_completed, revision_requested), Consultations (consultation_logged, consultation_verified, consultation_rejected, discussion_reply), Submissions (submission_received, extension_requested, extension_approved, extension_rejected, deadline_extended), System (sla_breach, deadline_reminder).
- **Per-channel toggles:** Each type has independent Email and In-app toggle checkboxes (default all ON — opt-out model).
- **Email preference gate:** `enqueueEventEmail` (`src/lib/event-email.ts`) checks `recipient.settings?.notificationPrefs?.[notifType]?.email === false` before enqueuing. Security types (`password_reset`, `invitation`, `two_factor`, `sla_alert`) are exempt via `EMAIL_GATE_EXEMPT` set — always sent regardless of preferences.
- **In-app preference gate:** `shouldSendInAppNotification(settings, type)` helper (`src/lib/notification-prefs.ts`) returns `false` only when `settings.notificationPrefs[type].inApp === false`. Applied at all 13 notification creation sites (inline pattern for single-insert sites, batch filter for scanner/batch sites).
- **Type mismatch resolution:** `sla_breach` in-app type maps to `sla_alert` email templateType — `notificationType` param on `enqueueEventEmail` resolves the mismatch. `deadline_extended` in-app type sends email via `sendExtensionApprovedEmail` with `notificationType: 'deadline_extended'` override.
- **SLA breach exemption:** `sendSLAAlertEmail` calls `enqueueEmail` directly (not `enqueueEventEmail`), so `sla_breach` email alerts are always sent to admins regardless of preferences. The in-app `sla_breach` notification IS gated. The UI hides the Email toggle for `sla_breach` (since it cannot be disabled).
- **Settings handler merge:** `updateUserSettingsHandler` (`src/server/settings.server.ts`) was refactored from a replace pattern to a read-modify-write merge — SELECT existing settings → `{ ...existing, ...new }` → UPDATE. This prevents `notificationPrefs` from overwriting `reducedMotion` and vice versa.
- **UI:** `NotificationPreferencesSection` component (`src/components/settings/NotificationPreferencesSection.tsx`) follows the `AccessibilitySection.tsx` pattern — `useQuery(['currentUser'])` for data, `useMutation(updateUserSettings)` for saves, `queryClient.invalidateQueries(['currentUser'])` on success. Rendered as 7th section in `SettingsPage.tsx`. Grouped by 4 categories with Email + In-app checkboxes per type.

---

## 9. Error Handling [v1]

### Strategy

| Layer                 | Approach                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Server functions**  | Validate inputs with Zod before processing. Return typed error responses. Never expose stack traces to the client. |
| **File upload**       | Server-side MIME validation. R2 failures surface as upload errors with retry guidance to the user.                 |
| **Email delivery**    | Queue-based with retry. Transient failures are retried; permanent failures are logged. Rows claimed transactionally (`FOR UPDATE SKIP LOCKED`); stale `processing` rows (> 5 min) are reclaimed to prevent lockup. On startup, ALL `processing` rows are immediately reclaimed (no threshold). Graceful shutdown on `SIGTERM`/`SIGINT` drains in-flight ticks and closes the DB pool (TRACK-045). |
| **Database**          | Drizzle query errors caught and mapped to user-friendly messages (e.g. "Failed to load assignments").              |
| **Client**            | TanStack Query `onError` callbacks show toast notifications. Form errors displayed inline per field.               |
| **Unexpected errors** | A global error boundary catches render crashes and shows a fallback UI with a reload option.                       |
| **Auth failures**     | Expired sessions trigger automatic redirect to `/auth/login`.                                                      |

### Error Categories

| Category      | Example                                    | User Impact                |
| ------------- | ------------------------------------------ | -------------------------- |
| Validation    | Invalid file type, missing required field  | Inline form error          |
| Authorization | Non-instructor tries to create assignment  | Redirect + message         |
| Not found     | Deleted assignment accessed via stale link | 404 page                   |
| Transient     | R2 timeout, database connection drop       | Retry + toast notification |
| Permanent     | Server misconfiguration                    | Error boundary fallback    |

### Implementation

| Module | Responsibility |
| --- | --- |
| `src/lib/errors.ts` | `ErrorCode` union (`UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION`, `BAD_REQUEST`, `CONFLICT`, `INTERNAL`, `RATE_LIMITED`), `ServerError` shape `{ error: { code, message } }`, `serverError(code, message, context?)` factory, `logError()` structured logger (routes through `pino` `logger.error(entry)` — preserves `entry` object shape with `timestamp`, `code`, `message`, `cause`, `userId`, `handler`, `stack`, `input`; JSON in prod, pretty in dev via pino transport config), `sanitizeInput()` (redacts `password`/`token`/`secret`/etc.), `isServerError()` guard. Responses expose only `code` + `message` — never stack traces, SQL, or raw errors. `RATE_LIMITED` added in TRACK-043 for application-level rate limiting. (TRACK-040: migrated from `console.error` to `pino`) |
| `src/lib/toast.ts` | `showErrorToast(code, t)` renders a sonner `toast.error` with the translated message (falls back to `error.default`); `parseServerError(res)` extracts `{ code, message }`, tolerant of both the typed shape and the legacy `{ error: string }` shape. |
| `src/components/ui/sonner.tsx` | `<Toaster>` wrapper — theme-aware (light/dark via `MutationObserver`), design-token CSS vars, `position="top-right"`, `richColors`. Mounted once in `src/routes/__root.tsx`. |
| `src/components/error-boundary.tsx` | `RootErrorComponent` — bilingual fallback (`error.somethingWentWrong`), Reload button + home link, `role="alert"` + `aria-live="assertive"`, logs via `logError('INTERNAL', ...)`. Wired as `errorComponent` in `src/routes/__root.tsx`. |
| Server handlers (`src/server/*.server.ts`) | All migrated from `{ error: '<string>' }` to `serverError(code, message, context?)`. DB operations wrapped in `try/catch` → `serverError('INTERNAL', ..., { cause, handler })`. Client mutation hooks (`src/hooks/*.ts`) call `showErrorToast()` on error. |
| i18n (`locales/{en,id}.json`) | `error` namespace (camelCase) holds user-facing messages per code; `simak-i18n/no-hardcoded` lint rule enforces `t('key')` usage. |

### Structured Logging (Track: Structured Logging & Observability)

All server-side logging uses `pino` (server-side only — not bundled with client code). The singleton `logger` instance (`src/lib/logger.ts`) outputs JSON to stdout in production and pretty-printed output in dev (via `pino-pretty`, lazy-loaded via `createRequire`). Log level is configurable via the optional `LOG_LEVEL` env var (default `info`). PostgreSQL notices are also routed into pino via the postgres.js `onnotice` callback on the database client (`logger.debug({ event: 'pg_notice', ...notice })` — TRACK-042).

Two migration patterns were applied:

1. **Background jobs** (email queue, deadline scanner, R2 cleanup) — `logger.child({ requestId: crypto.randomUUID() })` at the start of each tick/scan, with structured `{ event, ...payload }` log calls preserving the existing shape.
2. **Server handler advisory blocks** — all post-commit advisory `try/catch` blocks that previously used `console.error('Failed to ...', err)` now use `logger.error({ event: 'advisory_failed', handler: '<fn_name>', error: err instanceof Error ? err.message : String(err) })` for consistent structured output.

`logError()` in `src/lib/errors.ts` routes through `logger.error(entry)` — the existing `entry` object shape (`timestamp`, `code`, `message`, `cause`, `userId`, `handler`, `stack`, `input`) and `sanitizeInput()` redaction are preserved.

Request ID propagation infrastructure is defined in `src/lib/request-context.ts` (`requestIdMiddleware` + `createRequestLogger`) and is wired to server functions through `serverFnMiddlewares(rateLimit?)`. The middleware chain attaches request IDs first and optional rate limiting second; client-safe stubs dynamically load server-only handlers. The application logger and shutdown flow preserve the request context for structured operational diagnostics.

---

## 10. Testing Strategy

### Unit Tests (Vitest) [v1]

| Focus                 | Examples                                                                              |
| --------------------- | ------------------------------------------------------------------------------------- |
| **Gating logic**      | Checkpoint unlock conditions, consultation counting, sequential order enforcement.    |
| **State transitions** | Valid and invalid checkpoint state transitions (e.g. can't go from LOCKED to PASSED). Stale-state rejection: handler returns error when locked re-read shows state changed (FOR UPDATE re-validation). |
| **Validation**        | Zod schema tests for all input types (assignment creation, submission upload, etc.).  |
| **Permission checks** | Role-based access logic unit tests.                                                   |
| **Intervention workflow** | Instructor-only privacy, live `student_inaction` eligibility, pending-review rejection, active-pair uniqueness, reassignment access, lifecycle transitions, audit details, and overdue follow-up display. |
| **Bulk import**       | Xlsx parsing, role-permission validation, email uniqueness (excluding soft-deleted), transaction rollback, audit logging. |                                                   |

### Vitest Execution and Coverage Contract

The default unit workflow remains the canonical `vitest.config.ts` project
configuration: unit tests use isolated fork workers, the four XLSX test files
run in their dedicated `threads` project, and `tests/integration/**` remains
opt-in through `pnpm test:integration`. Coverage uses the V8 provider with
text, JSON, and HTML reports, the existing `src` include/exclude scope, and
80% lines/functions/branches/statements thresholds.

An August 2026 controlled benchmark recorded a 113.35-second median for
`pnpm test:coverage`. Worker, pool, reporter, isolation, environment, and
coverage-processing experiments did not produce a safe 20% reduction, so no
configuration or package-script optimization was retained. The evidence and
operational trade-offs are documented in
[`docs/vitest-coverage-performance.md`](vitest-coverage-performance.md).

### Integration Tests (Vitest) [v2]

| Focus                | Examples                                                                   |
| -------------------- | -------------------------------------------------------------------------- |
| **Server functions** | Call server functions with test database, verify DB state changes.         |
| **Auth flow**        | Login, session validation, role enforcement end-to-end within test server. |
| **File upload flow** | Presigned URL generation → mock upload → metadata persistence.             |
| **Concurrency**      | Concurrent review/submission race conditions — exactly one succeeds, stale-state rejection for the loser. |

### E2E Tests (Playwright) [v1]

E2E tests run against a dedicated test database (`simak_test` on a separate `postgres-test` Docker service, port 5433) to avoid polluting the dev database. The global setup (`tests/e2e/global-setup.ts`) migrates the test DB, truncates all tables, and seeds test users (SuperAdmin, Admin, Instructor, Instructor2, Student, Student2, Student3 — all with `emailVerified: true`) plus an assignment template (3 checkpoints, Thesis, `minConsultations: 1`), an assignment with the first checkpoint unlocked (Student + Student2 enrolled; Student3 not enrolled — for cross-student access denial tests), a pending consultation on the Proposal checkpoint, and TRACK-049 active, archived, and second-instructor-private feedback snippets. TRACK-054 revision-action-plan specs add their own ordered Revise-plan and resubmission fixtures. Each spec file resets the database (truncate + re-seed) via `resetDatabase()` before execution to ensure isolation.

**Configuration** (`playwright.config.ts`):

- Chromium, Firefox, and mobile-chrome projects, `workers: 1` (serial execution for DB isolation).
- `reuseExistingServer: !process.env.CI` — reuses `pnpm dev` server in local dev, starts a fresh server in CI.
- `globalSetup` runs migrations + truncate + seed + creates placeholder `storageState` files.
- `webServer` starts `pnpm dev` on port 3000.

**Auth helper** (`tests/e2e/helpers/auth.ts`):

- `loginAsRole(page, role)` fills the login form (`#email`, `#password` inputs) then submits via Better Auth's `/api/auth/sign-in/email` API endpoint. The Base UI Button component renders `type="button"` (not `type="submit"`), so form submission via the button doesn't work — the API call is a workaround while still exercising the form inputs.
- `storageState` is cached per role to avoid re-authenticating between tests within a spec file.

**DB reset** (`tests/e2e/helpers/db-reset.ts`):

- `resetDatabase()` truncates 28 application tables (CASCADE), including `assignment_grade_config`, `final_grades`, and `grade_release_snapshots`, and re-seeds before each spec file.
- `getDatabaseUrl()` is exported as a shared helper (no non-null assertions on `process.env`).

**R2 mock** (`tests/e2e/helpers/r2-mock.ts`):

- Known limitation: TanStack Start's server-fn fetcher returns `undefined` for mocked responses, making R2 upload E2E testing infeasible. File submission tests use direct DB insertion as a workaround. Full R2 upload flow (file selection, upload progress bar, success state) is not E2E-tested.

**Notification helper** (`tests/e2e/helpers/notifications.ts`):

- Shared `createNotification()` and `cleanupNotifications()` helpers for notification assertion setup (extracted from duplicated code in consultation and instructor-review specs). Used by `student-submission.spec.ts` to insert `submission_received` notifications and by `consultation.spec.ts` to insert `consultation_verified` notifications for post-action assertion.

**Spec files** (including grade release and the instructor intervention workflow):

| Spec File                    | Tests | What it validates                                                                               |
| ---------------------------- | ----- | ----------------------------------------------------------------------------------------------- |
| `auth.spec.ts`               | 4     | Route guards (student→admin blocked, admin→student blocked, unauthenticated→login redirect) + valid login + invalid credentials inline error |
| `admin-users.spec.ts`        | 4     | Create instructor, create student, filter users by role, superadmin role-creation rule (Admin/Instructor/Student available, Super Admin not) |
| `instructor-assignments.spec.ts` | 2 | Create assignment from template, checkpoint state transitions (locked → unlocked → submitted) |
| `student-submission.spec.ts` | 5     | Upload form visible + version history, resubmit with "Latest" badge, notification assertion (`submission_received`), upload UI validation (file type + size), locked checkpoint + cross-student access denial |
| `instructor-review.spec.ts`  | 5     | Review queue, Pass unlocks next checkpoint, Revise sets deadline, review history (4 tests decoupled — each sets up own state via `createSubmissionForCheckpoint`) + notification assertion (`review_completed`) |
| `revision-action-plans.spec.ts` | 3 | Instructor ordered Revise-plan authoring, reused `revision_requested` notification, student current/history display, addressed toggle, Next Actions unresolved context, non-blocking resubmission, supersession, axe scans, and 320px mobile layout |
| `consultation.spec.ts`       | 3     | Consultation lifecycle (log → verify → gating UI: "insufficient verified consultations (0/1)" → (1/1)), consultation rejection, notification assertion (`consultation_verified`) |
| `instructor-interventions.spec.ts` | 2 | Pending-review-only students cannot create interventions; eligible instructors create an overdue discussion intervention, manage it to monitoring, see dashboard status, and student/admin access remains private |
| `extension.spec.ts`          | 3     | Extension request → approve (checkpoint `dueDate` extended in DB), reject (deadline NOT extended), instructor bulk extension (all unfinished checkpoints extended) |
| `password-setup.spec.ts`     | 2     | Password setup lifecycle (admin creates user → extract token from DB → setup password → login → redirect to dashboard), token reuse + expired token rejection |
| `grade-release.spec.ts`      | 2     | Instructor preflight/publication, complete-only student snapshot visibility, student control absence, withdrawal reason validation, retained draft state, and post-withdrawal unavailability |

Run with `pnpm test:e2e` (headless) or `pnpm test:e2e:ui` (interactive UI mode). All tests pass in ~2 minutes.

---

## 11. Performance

### Loading Strategy [v1]

- TanStack Router lazy loads route components.
- Suspense boundaries with skeleton screens for async data.
- TanStack Query stale times: user profile (5min), checkpoint list (30s), notifications (15s, flat).
- TanStack Query `gcTime`: dashboard data cached for 30 minutes in memory after the user navigates away, so returning to the dashboard is instant.

### Query Optimization [v1]

- **N+1 elimination:** Per-row query loops have been replaced with set-based operations. `listVerifiedCountsHandler` uses a single `GROUP BY checkpointId` query with `inArray` instead of N per-checkpoint `COUNT` queries. Sequential per-checkpoint `UPDATE` loops (`calculateExtensionAdjustment`, `bulkExtendHandler`, `adjustDeadlinesForBreach`) are replaced with bulk `UPDATE ... WHERE order > target`. Post-commit advisory work (audit logging, notifications) is batched into single `db.insert(...).values([...])` statements.
- **Parallel queries:** Independent queries within a handler run concurrently via `Promise.all` (e.g. `listTemplatesHandler` runs data + count + distinct types in parallel; `listInstructorAssignmentsHandler` runs data + count in parallel). Emails and fire-and-forget notifications use `Promise.allSettled` so one failure doesn't block others.
- **LATERAL join for latest-submission queries:** `listPendingReviewsHandler` uses a `LATERAL` join (`SELECT * FROM submissions WHERE checkpoint_id = checkpoints.id ORDER BY version DESC LIMIT 1`) instead of a correlated subquery, starting the query from `checkpoints` and joining the latest submission per checkpoint. PostgreSQL optimizes this as an index scan on `submissions(checkpoint_id, version)`.
- **Over-fetch prevention:** `listNotificationsHandler` selects only needed columns (`id, type, titleKey, messageKey, params, read, createdAt` — no `metadata`) and constructs response objects explicitly (no `...item` spread leaking raw columns). The redundant `SELECT locale FROM users` query was removed — `session.user.locale` (enriched in `auth.ts` via `_getSession`) is used directly.
- **R2 HEAD check before transaction:** `getObjectContentLength` (R2 `HeadObjectCommand`) is called **before** `db.transaction()` in both `submitCheckpointHandler` and `submitReviewHandler`, so row locks are not held during slow I/O. The discriminated return type `{ ok: true, size } | { ok: false, reason }` is handled before entering the transaction.
- **Post-commit advisory work:** All advisory work after a transaction commit (audit logging, notification inserts, email dispatch) is wrapped in try/catch per SQL styleguide §6.4, so a failure in advisory work does not surface a 500 error to the user after the primary mutation has already succeeded.
- **Typed query-key factory (Tracks: Optimistic UI Updates and Instructor Feedback Snippets):** `src/lib/query-keys.ts` centralizes all query cache keys into typed factory functions for 10 domains (`notificationKeys`, `consultationKeys`, `extensionKeys`, `assignmentKeys`, `userKeys`, `templateKeys`, `discussionKeys`, `settingsKeys`, `gradebookKeys`, `feedbackSnippetKeys`). This replaces scattered inline key arrays (`['notifications', 'unreadCount']`, `['currentUser']`, etc.) and ensures reliable cache invalidation across features — especially for optimistic mutations and active/archived snippet searches that need to read and write the correct cache entry by key. `templateKeys` was added in TRACK-015, `discussionKeys` in TRACK-026, `settingsKeys` + `gradebookKeys` in TRACK-029, and `feedbackSnippetKeys` in TRACK-049 — completing the factory pattern across all client-side data domains with zero remaining inline keys.
- **Optimistic UI updates (Track: Optimistic UI Updates for Mutations):** 9 mutation sites use the `onMutate`/`onError`/`onSettled` pattern to reflect predicted state changes before the server responds, eliminating perceived latency on deterministic operations (mark-as-read, verify/reject consultation, approve/reject extension, unlock/extend deadline, delete user). Rollback is guaranteed via snapshot capture/restore. Mutations with unpredictable server responses (e.g., `submitReview`) keep the standard refetch-on-success flow (scope guard).

### Server-Side Caching [v2]

- **Redis** as a shared cache layer for:
  - Better-Auth session storage (reduces PostgreSQL session lookups).
  - Dashboard aggregated query results (30s TTL — avoids re-joining 5 tables on every visit).
  - Rate limiting counters for server functions (v1 uses in-memory `Map` per instance — sufficient for single-instance Coolify deployment; Redis needed only when scaling to multiple instances for shared rate limit state).
- Redis is not provisioned in the completed TRACK-047 pilot. It remains a future requirement only for multi-instance scaling, when shared sessions, cache state, and rate-limit counters need an external store.

### Rendering Strategy

| Page type              | Strategy                                                         |
| ---------------------- | ---------------------------------------------------------------- |
| Login / Password setup | Static, no SSR needed.                                           |
| Dashboard              | SSR for initial data, client revalidation for real-time updates. |
| Assignment detail      | SSR for checkpoint list.                                         |
| File management        | Client-rendered (heavily interactive).                           |
| Analytics              | SSR for initial aggregate data (MetricCard grid + trend tables). |

### Vite Optimizations [v1]

- Automatic code splitting per route (TanStack Router + Vite).
- Dynamic imports for heavy libraries: `mammoth` (`.docx` → HTML conversion, ~30KB gzipped — lazy-loaded only on the review detail route via `import('mammoth')` so it's not in the main bundle), chart library, file preview.
- **Route prefetch:** Sidebar navigation links use `preload="intent"` so hovering a link prefetches the route's data/loader. The router's `defaultPreload` is `false` (opt-in per-link) to avoid over-prefetching on the public landing page.

---

## 12. Deployment

### Docker

- Multi-stage build: builder stage compiles the app; runner stage is a minimal Node image with only the production output.
- Exposes port 3000.
- Dockerfile lives in `/docker/Dockerfile`.

### Coolify Configuration

| Setting    | Value                                            |
| ---------- | ------------------------------------------------ |
| Build pack | Docker                                           |
| Port       | 3000                                             |
| Database   | PostgreSQL service (managed by Coolify)          |
| SSL        | Auto-proxied via Coolify's Traefik reverse proxy |

### Environment Variables

| Variable               | Purpose                                                                 |
| ---------------------- | ----------------------------------------------------------------------- |
| `DATABASE_URL`         | PostgreSQL connection string                                            |
| `MIGRATE_DATABASE_URL` | Optional direct PostgreSQL connection string for migrations; the pilot connects directly to PostgreSQL without PgBouncer |
| `R2_ENDPOINT`          | Cloudflare R2 endpoint URL                                              |
| `R2_ACCESS_KEY_ID`     | R2 API access key                                                       |
| `R2_SECRET_ACCESS_KEY` | R2 API secret key                                                       |
| `R2_BUCKET_NAME`       | R2 bucket for uploads                                                   |
| `R2_PUBLIC_URL`        | Optional public base URL for file access; leave unset for private pilot storage |
| `RESEND_API_KEY`       | Resend API key for email delivery                                       |
| `EMAIL_FROM`           | From-address for outgoing emails (default: `SIMAK <noreply@simak.app>`)  |
| `BETTER_AUTH_SECRET`   | Signing secret for auth tokens                                          |
| `BETTER_AUTH_URL`      | Public URL of the app                                                   |
| `SUPERADMIN_EMAIL`     | Email for the seeded SuperAdmin                                         |
| `SUPERADMIN_PASSWORD`  | Password for the seeded SuperAdmin                                      |
| `LOG_LEVEL`             | Optional. Pino log level (default: `info`). `debug`/`info`/`warn`/`error`. (TRACK-040) |
| `DB_POOL_MAX`           | Optional. Max postgres.js pool connections (default: `10`). Positive integer. (TRACK-042) |
| `DB_PREPARED_STATEMENTS_DISABLED` | Optional future PgBouncer compatibility switch (default: `false`; not used in the direct-PostgreSQL pilot). String parsed via `val === 'true'`. (TRACK-042) |

### Database Migrations [v1]

- Drizzle Kit for migration generation and execution.
- `drizzle-kit push` for development; `drizzle-kit migrate` for local CLI use.
- **Production migration runner**: Bundled `migrate.mjs` runs from `/app/start.sh` before the application is started; the wrapper then uses `exec` for correct signal delivery.
- **Connection target**: The pilot uses direct PostgreSQL networking. Set `MIGRATE_DATABASE_URL` only when migrations need a separate direct connection from the application URL.
- **Concurrency guard**: `pg_advisory_lock` (ID: 789123) serializes concurrent migration runs to prevent corruption.
- **Seed runner**: Bundled `seed.mjs` is a separate one-time/operator bootstrap command after migrations; it calls the production-safe SuperAdmin-only runner and is idempotent.
- **Rollback convention**: Companion rollback SQL files at `drizzle/migrations/rollback/<NNNN>_<tag>.rollback.sql` for emergency manual execution.

### Connection Pooling

- **Application pool**: `getDb()` (`src/db/index.ts`) configures the postgres.js client with explicit pool options: `max` (`DB_POOL_MAX`, default 10), `idle_timeout: 30s`, `connect_timeout: 10s`, `max_lifetime: 1800s`, and `prepare: !DB_PREPARED_STATEMENTS_DISABLED`. PostgreSQL notices are routed through pino via an `onnotice` callback (`logger.debug({ event: 'pg_notice', ...notice })`). `DATABASE_URL` is read via `getEnv()` (Zod-validated), not `process.env` directly. (TRACK-042)
- **Development**: Direct connections (no PgBouncer); `DB_PREPARED_STATEMENTS_DISABLED` left at default `false` (prepared statements enabled).
- **Production pilot**: Direct connections to the Coolify-managed PostgreSQL service; no PgBouncer sidecar is provisioned. The application pool is bounded by `DB_POOL_MAX` (default 10), and shared connection pooling remains a future scaling concern.
- Future PgBouncer deployments must set `DB_PREPARED_STATEMENTS_DISABLED=true` and use a separate direct migration URL; that topology is outside TRACK-047.

### Health Checks [v1]

The public, unauthenticated `GET /api/health` endpoint provides container orchestration health probes. Coolify can configure liveness and readiness probes against this endpoint.

- **HTTP 200 (healthy):** DB reachable AND (R2 not configured OR R2 reachable). Response body:
  ```json
  {
    "status": "healthy",
    "timestamp": "<ISO 8601>",
    "version": "<package.json version>",
    "checks": {
      "database": { "status": "ok" },
      "r2": { "status": "ok" | "not_configured" },
      "emailQueue": { "status": "ok", "depth": <number> }
    }
  }
  ```
- **HTTP 503 (unhealthy):** DB unreachable OR R2 configured-but-unreachable. Same response shape but `status: "unhealthy"` with failing check(s) carrying `{ status: "error", error: "..." }`. Error messages are generic (`'database unreachable'`, `'r2 unreachable'`) — raw error details are never exposed on the public endpoint to prevent information leakage (internal IPs, DB usernames, R2 bucket names).
- **Three checks** (each with a 2-second timeout, run in parallel via `Promise.allSettled`):
  1. **Database** — `SELECT 1` via `getDb()` (PgBouncer-safe — no session-specific queries).
  2. **R2** — `HeadBucketCommand` via `getR2Client()` (returns `null` if R2 env vars are absent → `not_configured`, which is healthy).
  3. **Email queue** — `COUNT(*)` where `status IN ('pending', 'processing')` — informational depth only, never causes unhealthy status.
- **Dockerfile HEALTHCHECK** — `HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget --spider -q http://127.0.0.1:3000/api/health || exit 1` (uses `wget` from busybox; `curl` is not available on `node:22-alpine`). The IPv4 loopback avoids Alpine `localhost` resolution ambiguity.

---

## 13. UI & Design System [v1]

### Component Library

All UI built on shadcn/ui primitives (Radix UI wrappers). Components used by category:

| Category         | Components                                                |
| ---------------- | --------------------------------------------------------- |
| **Form**         | Input, Textarea, Select, Checkbox, Radio, Form            |
| **Layout**       | Sidebar, Tabs, Card, Separator                            |
| **Navigation**   | Breadcrumb, Navigation Menu                               |
| **Data Display** | Table, Avatar, Badge, Card                                |
| **Feedback**     | Alert, Progress, Dialog, Popover, Toast, Sheet            |
| **Charts**       | Recharts-based components                                 |
| **Overlay**      | Dialog, Sheet, Dropdown Menu                              |
| **Custom**       | MetricCard, EmptyState, LanguageToggle, AlertBanner, QuickActionCard, EmailQueueStat, ListRow, PageHeader, BackLink, RefreshButton, Skeleton, Pagination, CountBadge, TemplateTypeBadge, StatusDot (project-specific) |

### Theme

- **Design System:** "Warm Academic" — warm neutrals, serif display fonts, semantic color coding. Defined in `docs/UI_REDESIGN.md`.
- Light and dark modes via Tailwind `dark:` variant + CSS custom properties.
- Theme state managed via `use-theme` hook with localStorage persistence and system preference detection (`prefers-color-scheme`).
- `ThemeScript` in root layout prevents flash of unstyled content (FOUC) on page load.
- Theme toggle button (`ThemeToggle` component) in the header of all authenticated layouts and the login page.
- CSS custom properties defined in `src/app/global.css` using oklch color space for both light and dark themes.
- **Light Mode:** Background `#FAF9F7` (warm white), Surface `#FFFFFF`, Border `#E7E5E0` (warm gray), Text `#1C1917` / Secondary `#57534E` / Muted `#A8A29E`.
- **Dark Mode:** Background `#0F1115`, Surface `#181B22`, Border `#2A2D35`, Text `#F5F5F4` / Secondary `#A8A29E` / Muted `#6B6560`.
- **Sidebar:** Background `#1C2333` (dark navy), Active Border `#3B82F6`, Text `#94A3B8` / Active `#FFFFFF`.
- Semantic color tokens: `--background`, `--foreground`, `--muted`, `--card`, `--border`, `--primary`, `--destructive`, etc.
- Additional semantic status colors: `--success` (#059669, green), `--warning` (#D97706, amber), `--error` (#DC2626, red), `--info` (#0891B2, cyan).
- All shadcn/ui primitives use theme-aware classes (`bg-card`, `text-foreground`, `border-border`) — no hardcoded colors.
- **Typography:** Fraunces (serif) for display/headings (self-hosted in `public/fonts/`), DM Sans (sans-serif) for body text. `font-display: swap` for performance.
- Type scale: Display 2rem/700, H2 1.5rem/600, H3 1.25rem/600, Body 0.875rem/400, Small 0.75rem/400.
- 4px base spacing unit. Border radius: sm(6px), md(10px), lg(14px), xl(20px), full(9999px).
- `transition-colors` on theme toggle for smooth visual transition between modes.

---

## 14. Accessibility [v1]

- Radix UI primitives provide built-in ARIA attributes for dialogs, selects, dropdowns, and other interactive components.
- Keyboard navigation for all interactive elements — Tab order is logical across all pages.
- Focus management: focus trapping in dialogs and sheets on open, focus return on close, skip-to-content link as first focusable element. The skip-to-content link targets `#main-content` — every page has a `<main id="main-content" tabIndex={-1}>` element that receives focus when the skip link is activated (TRACK-037).
- **Landmark structure (TRACK-037):** Every page has exactly one `<main>` landmark. Role layouts (`student.tsx`, `instructor.tsx`, `admin.tsx`) have `<main id="main-content" tabIndex={-1}>` wrapping page content. The `_unauthenticated.tsx` layout wraps `<Outlet />` in `<main id="main-content" tabIndex={-1}>`. The landing page (`index.tsx`) uses `<main id="main-content" tabIndex={-1}>` as its outer container.
- **Region content containment (TRACK-037):** All interactive content is contained within HTML landmarks. The `KeyboardCheatSheet` trigger button is rendered inside the `AppHeader` `<header>` landmark (moved from `_authenticated.tsx` where it was rendered outside any landmark). The sonner `<Toaster>` exposes an `aria-label` (via i18n key `notifications.toasterLabel`) so screen readers can identify the notification region.
- `focus-visible:` ring classes on all interactive elements (only visible on keyboard navigation, not mouse clicks).
- Touch targets minimum 44×44px (`min-h-11 min-w-11`) on all buttons, links, and interactive elements for mobile accessibility.
- `aria-hidden="true"` on all decorative icons (sidebar nav icons, notification bell icons) to hide them from screen readers. Also applied to purely-visual connector lines and dots in the `CheckpointTimeline` (Track: Accessibility & i18n Compliance).
- `aria-label` on all icon-only buttons (theme toggle, language switcher, sidebar close, notification bell, pagination controls, FileList download button).
- `aria-live="polite"` regions for dynamic content: form validation errors (`FormMessage`), submission status messages, dashboard error states, consultation errors, and notification unread-count changes (NotificationBadge).
- `role="progressbar"` with `aria-valuenow`/`aria-valuemin`/`aria-valuemax`/`aria-label` on all progress bars: `ProgressTable` (per-student completion), `ConsultationProgress` (summary + per-checkpoint verified/required bars) (Track: Accessibility & i18n Compliance).
- `aria-expanded` + `aria-controls` on the `DeadlineManager` collapsible toggle buttons, with matching `id` on the expandable content div (Track: Accessibility & i18n Compliance).
- `aria-describedby` on form inputs pointing to error message elements for screen reader association.
- Heading hierarchy: every page has exactly one `h1`, heading levels don't skip (h1 → h2 → h3). Enforced across all pages — 9 components/pages had heading level skips remediated in TRACK-037 (StudentDashboard, CheckpointTimeline, CheckpointCard, ExtensionHistoryList, DiscussionPanel, TemplateDangerZone, TemplateDetailPage, student assignment detail, instructor review detail).
- Color contrast meets WCAG 2.1 AA minimum (4.5:1 for normal text, 3:1 for large text).
- Semantic color system: success (green), warning (amber), error (red), info (blue) for status badges and indicators.

---

## 15. Internationalization (i18n) [v1]

### Strategy

- **Library**: typesafe-i18n. Generates TypeScript types from translation JSON files. Compile-time guarantee that every translation key exists.
- **Languages**: English (`en`) and Indonesian (`id`). English is the default.

### Locale Resolution

1. **First visit (unauthenticated)**: Detect from browser `navigator.language`. If Indonesian → use `id`, otherwise fall back to `en`. A **language switcher toggle** is available on the login and password setup pages so users can switch before authenticating.
2. **Logged-in user**: Use the `locale` column from the user's profile (can change in the settings hub at `/student/settings`, `/instructor/settings`, or `/admin/settings`).
3. **Server functions**: Resolve locale from the authenticated user's session. Used for email subjects, notification messages, and validation errors.

### Boundary Type Contracts

Server functions whose output crosses the network boundary to a route loader declare **explicit return types** (e.g. `InstructorDashboardSuccess | ServerError`, `AssignmentDetailSuccess | ServerError | null`). All `Date` fields are serialized to ISO strings at the boundary — the client never receives raw `Date` objects. This eliminates `@ts-expect-error` workarounds and TODO comments in route loaders that previously compensated for type inference gaps.

### Lint Enforcement

- **`simak-i18n/no-hardcoded`** custom lint rule (oxlint plugin) flags hardcoded English UI text in JSX children and `placeholder`/`aria-label`/`title`/`alt` attributes, plus literal strings in notification insert `titleKey`/`messageKey` fields. Enforces `t('key')` usage for all user-visible strings.
- **`pnpm check:i18n:unused`** runs in the pre-push gate (Lefthook) and exits non-zero on unused i18n keys, preventing dead keys from accumulating.

### Translation Scope

| Surface             | Strategy                                                                         | Example                                                    |
| ------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **UI labels**       | Static translation keys                                                          | `t('button.submit')`                                       |
| **Dynamic text**    | Interpolation with parameters                                                    | `t('checkpoint.passed', { name: checkpoint.name })`        |
| **Notifications**   | Store i18n `titleKey`/`messageKey` + `params` in DB. Resolve display strings at read time using recipient's locale. | `{ titleKey: 'notifications.events.review_completed.title', messageKey: '...', params: { checkpointName } }` |
| **Date formatting** | Shared `formatDate(date, locale, style, timeZone?)` helper (`src/lib/format-date.ts`) renders dates in the user's locale (`id-ID` or `en-US`) with an optional validated IANA timezone; invalid explicit zones use UTC, while omitted-zone behavior remains unchanged. A companion module `src/lib/format.ts` exports locale-aware formatters — `formatDateShort` / `formatDateLong` / `formatDateTimeShort` (absolute) and `formatRelativeTime` (relative, via `date-fns` `formatDistanceToNow` + `localeMap`) — used where relative context aids comprehension: checkpoint due dates and student-dashboard upcoming deadlines append parenthesized relative time (e.g., "Mar 5, 2026 (in 3 days)"), and SLA badges expose relative time as a `title` tooltip across all variants. | `formatDate(item.createdAt, locale, 'short', timeZone)`, `formatDateShort(checkpoint.dueDate, locale, timeZone)`, `formatRelativeTime(date, locale)` |
| **Email templates** | 8 localized HTML template builders in `src/lib/email-templates.ts` + shared header/footer helpers. All user input HTML-escaped. Subjects via i18n keys (`emails.subjects.*`) prefixed `[SIMAK]`. | Resend email body in `en` or `id` |

### Files

- `locales/en.json` — English source of truth.
- `locales/id.json` — Indonesian translations.
- Both files share the same key structure. Missing keys in `id.json` fall back to `en` at compile time (typesafe-i18n warning).

### User Preference

- Stored in `users.locale` (`'en' | 'id'`).
- Changeable via the settings hub (`/student/settings`, `/instructor/settings`, or `/admin/settings`).
- Default for new users: browser detection → fallback to `en`.

---

## Appendix: MVP vs Post-MVP Summary

| Feature                                                                | MVP [v1] | Post-MVP [v2] |
| ---------------------------------------------------------------------- | -------- | ------------- |
| Authentication (login, session, password reset)                        | ✓        |               |
| User registration (SuperAdmin seed, Admin creates users, email invite) | ✓        |               |
| Role-based access control                                              | ✓        |               |
| Assignment template CRUD                                               | ✓        |               |
| Assignment creation with student selection                             | ✓        |               |
| Checkpoint submission (sequential, pass/revise)                        | ✓        |               |
| Rubric-based grading & evaluation (criteria, levels, weighted scores)   | ✓        |               |
| File upload to R2 (single student)                                     | ✓        |               |
| File preview (PDF) and download                                        | ✓        |               |
| In-app notification center                                             | ✓        |               |
| Consultation logging + verification                                    | ✓        |               |
| Error handling (validation, auth, boundary)                            | ✓        |               |
| Responsive UI, dark mode, accessibility                                | ✓        |               |
| Bilingual i18n (English + Indonesian)                                  | ✓        |               |
| Vitest unit tests (gating logic, state transitions)                    | ✓        |               |
| Group assignments                                                      |          | ✓             |
| Two-factor authentication                                              | ✓        |               |
| Email notifications (event alerts: submission, review, deadline, consultation, extension) | ✓        |             |
| Push notifications (Web Push)                                          |          | ✓             |
| Notification preferences                                               |          | ✓             |
| Analytics dashboards (admin + instructor)                              | ✓        |               |
| Report export (CSV + Excel)                                            | ✓        |               |
| Scheduled/PDF report delivery                                          |          | ✓             |
| Deadline extension workflow                                            | ✓        |               |
| Audit logging                                                          | ✓        |               |
| Integration tests                                                      |          | ✓             |
| Playwright E2E tests                                                   | ✓        |               |
