# Technical Design Document (TDD)

## 1. Technology Stack

| Layer              | Technology                      | Rationale                                                                                           |
| ------------------ | ------------------------------- | --------------------------------------------------------------------------------------------------- |
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
| **i18n**           | typesafe-i18n                   | Type-safe translations with compile-time checks. Works in both client and server functions.         |
| **Testing**        | Vitest + Playwright             | Vitest for unit and integration tests; Playwright for E2E.                                          |
| **Deployment**     | Docker + Coolify                | Self-hosted on a VPS.                                                                               |

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
│   ├── /student/settings                 → Settings hub (profile, password, appearance, accessibility) [v1]
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
│   ├── /instructor/reviews               → Review queue [v1]
│   ├── /instructor/analytics             → Instructor performance analytics [v1]
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
│   ├── routes/               → TanStack Router route files (file-based routing in `src/routes/`)
│   ├── app/                  → Application root files (global.css, legacy __root.tsx location)
│   ├── components/           → React components
│   │   ├── ui/               → shadcn/ui primitives
│   │   ├── layout/           → Sidebar (student, instructor, admin — dark navy variants), header (sticky, backdrop blur), language switcher, theme toggle
│   │   ├── dashboard/        → Role-specific dashboard components (StudentDashboard, InstructorDashboard, AdminDashboard with metric cards)
│   │   ├── student/
│   │   │   └── assignments/  → Student assignment card, filters, checkpoint timeline, checkpoint card, detail header, empty state, loading skeleton
│   │   ├── instructor/
│   │   │   └── assignments/  → Assignment wizard, template picker, student picker, progress table, card, filters, empty state, loading skeleton
│   │   ├── reviews/          → Review dialog, review queue, feedback upload, DeadlineManager, ReviewFilePreview (PDF + DOCX inline preview via mammoth.js)
│   │   ├── consultations/    → Log form, consultation list, progress bar, verification queue item, verification dialog
│   │   ├── files/            → File upload, preview, file list
│   │   ├── notifications/    → Notification center, badge, notification-routes (type→route map)
│   │   ├── analytics/        → Charts, metric cards, export
│   │   ├── settings/         → SettingsPage, ProfileSection, PasswordSection, AppearanceSection, AccessibilitySection
│   │   ├── skeletons/        → Reusable loading skeletons (DashboardSkeleton, TableSkeleton, AssignmentDetailSkeleton)
│   │   ├── admin/            → User table, template builder, template cards, pagination, filters, empty state, loading skeleton, email queue inspector subcomponents (summary cards, filters, table, retry dialog)
│   │   └── keyboard-cheat-sheet.tsx → Popover showing all keyboard shortcuts (greys out review-specific J/K when not on review page)
│   ├── server/               → Server functions (split: .ts = client-safe stubs + Zod, .server.ts = handlers)
│   │   ├── auth.ts           → Client-safe stub: Session type, getSessionFromHeaders, requireRole, _getSession (dynamic import)
│   │   ├── auth.server.ts    → Session handler: Better Auth validation, DB query, 5s-TTL in-memory cache
│   │   ├── users.ts          → User CRUD, invitations
│   │   ├── assignments.ts    → Assignment CRUD (instructor + student queries)
│   │   ├── assignments.server.ts → Server-only assignment handlers
│   │   ├── submissions.ts    → Upload, versioning
│   │   ├── reviews.ts        → Review, pass/revise
│   │   ├── consultations.ts  → Log, list, verify, reject, detail, counts (split: .ts stubs + .server.ts handlers)
│   │   ├── notifications.ts  → Create, fetch, mark read
│   │   ├── notifications.server.ts → Server-only notification handlers
│   │   ├── templates.ts      → Template CRUD
│   │   ├── templates.server.ts → Server-only template handlers
    │   │   ├── audit-logs.ts      → Audit log query stubs + Zod schemas
    │   │   ├── audit-logs.server.ts → Server-only audit log handlers
    │   │   ├── email-queue.ts      → Email queue inspector stubs (listEmailQueue, retryEmail) + Zod schemas + shared types
    │   │   ├── email-queue.server.ts → Server-only email queue handlers (list, retry with FOR UPDATE)
    │   │   ├── setup-password.ts → Custom password setup handler
│   │   ├── files.ts          → Presigned URL generation
│   │   ├── settings.ts       → Settings hub stubs (UpdateProfileSchema, UpdateUserSettingsSchema, GetPresignedAvatarUploadUrlSchema)
│   │   ├── settings.server.ts → Settings hub handlers (updateProfile, getPresignedAvatarUploadUrl, updateUserSettings)
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
│   ├── db/
│   │   ├── schema/           → Drizzle schema (split by domain)
│   │   ├── index.ts          → Database client
│   │   └── migrate.ts        → Migration runner
│   ├── auth/
│   │   └── config.ts         → Better-Auth setup
│   ├── i18n/                 → Translation init + locale detection
│   ├── lib/
│   │   ├── email.ts          → Resend client
│   │   ├── storage.ts        → R2 client
│   │   ├── toast.ts          → Toast helpers (showSuccessToast, showErrorToast) — wraps sonner
│   │   ├── route-utils.ts    → Role-based dashboard routing utility
    │   │   ├── role-permissions.ts → Canonical CREATION_ALLOWED_ROLES (shared by user creation + bulk import)
    │   │   ├── bulk-import/      → Client-side xlsx parsing (parse-users, parse-templates, samples)
    │   │   ├── query-keys.ts      → Typed query-key factories (notificationKeys, consultationKeys, extensionKeys, assignmentKeys, userKeys, templateKeys)
    │   │   └── utils.ts          → Shared utilities
│   ├── hooks/               → Custom React hooks
│   │   ├── use-debounced-callback.ts → Generic debounce hook (setTimeout/clearTimeout, 300ms for search inputs)
│   │   ├── use-keyboard-shortcuts.ts → Global keyboard shortcuts (R=refresh, ?=cheat-sheet) — mounted in _authenticated.tsx
│   │   ├── use-review-nav.ts → Review-specific shortcuts (J/K queue navigation) — preloads pending list on mount
│   │   ├── use-notifications.ts → Notification hooks (useMarkRead, useMarkAllRead with optimistic updates, useUnreadCount, useNotificationsList)
│   │   └── use-assignment-tabs.ts → Assignment tab hooks (approveExtension, rejectExtension with optimistic updates; consultations/extensions via useQuery)
│   └── config/
│       └── env.ts            → Validated environment variables
├── locales/                  → typesafe-i18n translation files
│   ├── en.json               → English translations
│   └── id.json               → Indonesian translations
├── tests/
│   ├── unit/                 → Vitest unit tests
│   ├── integration/          → Vitest integration tests
│   └── e2e/                  → Playwright E2E tests
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
| **Student**    | `/student/dashboard`    | Active Assignments (card grid with progress bars), Upcoming Deadlines (next 5, color-coded urgency, overdue badges), Pending Reviews (submissions under review, wait times), Consultation Reminders (pending verifications)                                                                |
| **Instructor** | `/instructor/dashboard` | Pending Review Queue (count + FIFO list with SLA badges: On Time/Approaching/Breached), Recent Submissions (last 5 with status badges), Assignment Overview (cards with student count, pending count, progress), Quick Actions (Go to Review Queue, Manage Assignments)                    |
| **Admin**      | `/admin/dashboard`      | System Metrics (6 cards: Total Users, Instructors, Students, Active Assignments, Pending Reviews, Active Consultations), Recent Activity Feed (last 10 events, 7 days), Deadline Escalation Alerts (SLA breaches >3 days with red styling), Quick Actions (Manage Users, Manage Templates) |

Widget data is fetched via a single **aggregated server function** per role. Each handler verifies session + role, executes multiple Drizzle queries, and returns a pre-shaped payload. All widgets show appropriate empty states when no data is available.

Query key: `['dashboard']` with role differentiation handled server-side.

### Analytics & Reporting [v1] (Track: Analytics & Reporting)

Role-based analytics dashboards complement (do not duplicate) the real-time operational dashboards. Dashboards show current snapshots; analytics show historical trends and NEW metrics over selectable date ranges.

- **Routes:** `/admin/analytics` (admin/superadmin via `requireRole(['admin'])`) and `/instructor/analytics` (instructor via `requireRole(['instructor'])`). Both are linked from their role-specific sidebars (BarChart3 icon).
- **Date range:** URL search params drive the range (`?range=7d|30d|90d|all`) with optional custom start/end. Routes use `validateSearch` + `loaderDeps` so URLs are shareable and back/forward navigation works. A shared `resolveDateRange` helper converts the range token into `{ dateFrom, dateTo }`, and a `dateCondition` helper builds the `WHERE created_at >= ?` SQL fragment.
- **Server function split:** `src/server/analytics.ts` exports Zod schemas + `createServerFn` stubs (with `.inputValidator(Schema).handler(...)` builder pattern + dynamic imports). Three handler files:
  - `analytics-admin.server.ts` — 8 parallel aggregate queries via `Promise.all` (consultation verification rate, deadline breach rate, assignment status distribution by checkpoint state, submission/review volume trends via `date_trunc`, reviews completed, DAU/WAU).
  - `analytics-instructor.server.ts` — instructor-scoped queries (reviews completed, avg response time via `EXTRACT(EPOCH FROM reviewedAt - uploadedAt)`, SLA breach count where `EXTRACT(EPOCH FROM reviewedAt - uploadedAt) > 259200` (3 days), students supervised, assignments active).
  - `analytics-export.server.ts` — 5 CSV export handlers (admin: users, audit log with date filtering, assignment progress; instructor: student progress, review history — both with ownership checks returning `NOT_FOUND` if the assignment is not owned).
- **No new DB tables:** All metrics derive from aggregate queries (`GROUP BY`, `date_trunc`) over existing tables. No migrations required.
- **CSV export:** Server function returns a CSV string; the client creates a `Blob` + `URL.createObjectURL` download (via `src/lib/download.ts` + `src/hooks/use-csv-download.ts` with loading/error state). CSV cell values are sanitized against formula injection (CWE-1236) — cells starting with `=`, `+`, `-`, `@`, TAB, or CR are prefixed with `'` (via `escapeCsvValue`).
- **Excel export:** Client-side SheetJS (`src/lib/excel-export.ts`) generates `.xlsx` files via `xlsx.utils.book_new()` + `json_to_sheet()` + `write()`. Reuses the existing `xlsx` dependency (already used for bulk-import) — no new dependency. "Export Excel" buttons on both analytics pages.
- **Export buttons on existing pages:** "Export CSV" buttons added to `/admin/users`, `/admin/audit-log`, and `/instructor/assignments/$id` (assignment progress / student progress / review history respectively).
- **UI:** MetricCard grid + trend data tables + progress bars. No charting library — tables and progress bars only (defer Recharts unless visual charts are requested).
- **i18n:** All labels/headers in both `locales/en.json` and `locales/id.json` (`analytics.*` + `analyticsInstructor.*` namespaces).

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
- **Dashboard safety caps:** Inline dashboard widgets (`activeAssignments` on student dashboard, `assignmentOverview` on instructor dashboard) use a hardcoded `.limit(20)` safety cap since they cannot be independently paginated.
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

**Query-key factory:** `src/lib/query-keys.ts` provides typed key factories for 6 domains (`notificationKeys`, `consultationKeys`, `extensionKeys`, `assignmentKeys`, `userKeys`, `templateKeys`). All migrated queries reference factory keys instead of inline arrays — ensuring reliable cache invalidation across features. `templateKeys` was added in TRACK-015 when the template/student pickers were migrated from `useEffect`+`useState` to `useQuery`. Consumed by later tracks (TRACK-018 Email Notifications, TRACK-019 Analytics).

**Scope guard:** Optimistic updates are applied ONLY where the predicted state is deterministic. Mutations whose server response carries computed/derived data the client can't predict (e.g., `submitReview` which unlocks the next checkpoint and adjusts deadlines server-side) keep the standard refetch-on-success flow.

**DeadlineManager invalidation fix:** Prior to this track, `unlockMutation` and `extendMutation` in `DeadlineManager.tsx` had `onSuccess` that only showed a toast — they never called `queryClient.invalidateQueries`, leaving the deadline list stale until manual refresh. This was fixed as a prerequisite before optimistic logic could work.

---

## 3. Data Model [v1]

### Entity-Relationship Overview

**User** (SuperAdmin, Admin, Instructor, Student) — core identity with role.
**AssignmentTemplate** — defines a type (e.g. Thesis) with ordered checkpoint names.
**TemplateCheckpoint** — checkpoint definition within a template (name, order).
**Assignment** — links a template to students with a title, description, and final deadline.
**AssignmentStudent** — maps a student to an assignment (individual progress, not group work). [v1]
**Checkpoint** — one per assignment stage; copied from template at creation time.
**Submission** — files uploaded by a student for a checkpoint.
**Review** — instructor decision (pass/revise) with comments and optional feedback file.
**Consultation** — student-instructor meeting log, tied to a specific checkpoint.
**Notification** — in-app event log.
**NotificationPreference** — per-user, per-event, per-channel toggle. [v2]
**ExtensionRequest** — student-initiated deadline extension with reason category, proposed duration (1–30 days), instructor approval/rejection, and configurable caps (`maxExtensionDays`, `maxTotalExtensions`). On approval, the affected student's subsequent checkpoint `dueDate` values auto-extend. The assignment-wide `finalDeadline` is immutable after creation and never mutated by extensions.
**AuditLog** — immutable record of all meaningful system actions: user CRUD, template CRUD, assignment creation, review decisions, deadline changes, unlocks, and consultation verifications/rejections. Stores actor, action type, entity reference, and JSON details. [v1] — admin viewer at `/admin/audit-log`.
**EmailQueue** — background delivery queue for transactional emails. [v1] — infrastructure used for invitations, password reset, and 2FA emails; extended to event notifications in [v2]. Hardened with a `processing` status, transactional claim via `FOR UPDATE SKIP LOCKED` (send occurs outside the transaction), an in-process `isRunning` guard, and stale-row reclaim (rows stuck in `processing` > 5 min reset to `pending`) to prevent concurrent-worker duplicate delivery and lockup. All user-derived interpolations in email bodies are HTML-escaped to prevent stored XSS. Admin queue inspector at `/admin/email-queue` provides observability — paginated list (20/page) with status filter, search (recipient email/subject), summary stats (pending/sent/failed), and manual retry of failed emails (idempotent: only `status='failed'` can be retried, resets to `pending` inside a `FOR UPDATE` transaction). Each row exposes a `resendMessageId` (populated from the Resend API `result.data.id` on successful send) displayed as a monospace truncated cell, enabling correlation with Resend's delivery dashboard. Processor sends emails in concurrent batches of 5 via `Promise.allSettled` (chunks run sequentially; partial failures don't abort the batch — cycle latency reduced from ~10× to ~2× single-send latency). Automatic retention cleanup prunes `sent` rows older than 90 days and `failed` rows older than 180 days on a tick-embedded 24-hour cycle (`lastPruneAt` timestamp in `email-queue-init.ts`); `pending`/`processing` rows are never deleted. Processor emits structured logs (`email_queue.cycle_start`, `email_queue.cycle_end`, `email_queue.reclaimed`, `email_queue.send_failed`, `email_queue.retention_pruned` — no PII). `EMAIL_FROM` is read from `getEnv().EMAIL_FROM` (Zod-validated in `src/config/env.ts` with default `'SIMAK <noreply@simak.app>'`).
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
| settings         | jsonb                  | NULLABLE — `{ reducedMotion: boolean }`. Profile, theme, and accessibility prefs.   |
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
| createdAt         | timestamp                           |                                       |

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

#### notification_preferences [v2]

| Column            | Type                         | Notes                                  |
| ----------------- | ---------------------------- | -------------------------------------- |
| id                | serial (PK)                  |                                        |
| userId            | text (FK → users)            |                                        |
| eventType         | text, not null               | e.g. review_completed, deadline_missed |
| channel           | text, not null               | in_app \| email                        |
| enabled           | boolean, default true        |                                        |
| Unique constraint | (userId, eventType, channel) | One preference per combination         |

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
| entityType | text, not null    | `user` \| `template` \| `assignment` \| `checkpoint` \| `submission` \| `review` \| `consultation` |
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
| templateType   | text, not null     | `password_reset` \| `invitation` \| `sla_alert` \| `two_factor` |
| status         | text, not null     | `pending` \| `processing` \| `sent` \| `failed`                 |
| attempts       | integer, default 0 |                                                                 |
| lastAttemptAt  | timestamp          | NULLABLE                                                        |
| errorMessage   | text               | NULLABLE — last failure reason                                  |
| resendMessageId | text             | NULLABLE — Resend API message ID for delivery correlation (TRACK-016) |
| createdAt      | timestamp          | DEFAULT NOW()                                                   |

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
| createdAt     | timestamp                     | DEFAULT NOW()                                                                                  |

> **Trust boundary (Track: Audit HIGH-Remediation H1):** Presigned upload URLs are never issued without a corresponding `upload_intents` row. At submit time, the handler verifies the intent exists, belongs to the requesting user, matches the expected purpose and checkpoint, has not expired, and has not already been consumed. The server then issues an R2 `HeadObjectCommand` to read the actual `ContentLength` — the client-reported `fileSize` is never trusted. This prevents cross-user file hijacking, fabricated file keys, and size spoofing.

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
| `notifications`      | `userId`, `read`         | composite b-tree | Notification center filtering                |
| `notifications`      | `createdAt`              | b-tree           | Admin dashboard recentActivity query (TRACK-005) |
| `template_checkpoints`| `templateId`, `order`   | composite b-tree | Template checkpoint ordering (TRACK-005)     |
| `users`              | `role`, `deletedAt`      | composite b-tree | Admin user list filtering by role + active (TRACK-005) |
| `verification`       | `value`                  | b-tree           | Token lookup on password setup/reset         |
| `audit_log`          | `createdAt`              | b-tree           | Time-ordered queries                         |
| `audit_log`          | `action`                 | b-tree           | Type filtering                               |
| `audit_log`          | `entityType`, `entityId` | composite b-tree | Entity-specific history                      |
| `audit_log`          | `actorId`                | b-tree           | JOIN in listAuditLogsHandler (TRACK-005)     |
| `extension_requests` | `assignmentId`, `status` | composite b-tree | Instructor queue queries                     |
| `extension_requests` | `assignmentId`, `studentId` | composite b-tree | Per-student extension lookup (TRACK-005)  |
| `email_queue`        | `status`                 | b-tree           | Pick pending emails for delivery             |
| `upload_intents`     | `fileKey`                | b-tree (unique)  | Intent lookup at submit time                 |
| `upload_intents`     | `userId`                 | b-tree           | User's pending upload intents                 |

All indexes use Drizzle's `index()` or `uniqueIndex()` API. Migrations generated with `drizzle-kit generate`. Migration `0008_deep_santa_claus.sql` (TRACK-005) added 7 new indexes and replaced 2 low-cardinality single-column indexes with composites. Migration `0009_familiar_hydra.sql` (TRACK-016) added the `resend_message_id` column to `email_queue`. Each migration has a companion rollback file at `drizzle/migrations/rollback/<NNNN>_<tag>.rollback.sql`.

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
- **Two-file split (Track: Session Caching & Bundle Safety):** `src/server/auth.ts` is a client-safe stub (43 lines) exporting the `Session` type, `getSessionFromHeaders`, `requireRole`, and `_getSession` (a `createServerFn` that dynamically imports the handler). It contains no DB, schema, or Better-Auth config imports — ensuring `pg`/`drizzle-orm` do not leak into the client bundle. The actual handler logic lives in `src/server/auth.server.ts` (~100 lines): Better Auth session validation, DB query for user role/locale, and the session cache. All 6 route layout files import from `auth.ts` and receive only client-safe code.
- **Session cache (Track: Session Caching & Bundle Safety):** A 5s-TTL in-memory `Map<string, { role, locale, expiresAt }>` cache sits inside `getSessionHandler` in `auth.server.ts`. After `auth.api.getSession()` returns a valid user ID, the cache is checked. On a hit (not expired), the cached role/locale is returned and the DB query is skipped. On a miss, the DB query runs and the result is cached with a 5s TTL. Expired entries are evicted lazily on cache miss. **Tradeoff:** soft-deleted users and role changes take up to 5s to take effect — acceptable for a university system. The Better Auth `getSession()` call runs on every request (the cache only skips the DB query, not session validation). A `clearSessionCacheForTests` helper is exported for test isolation.
- Route-level guard via TanStack Router `beforeLoad`:
  - `_unauthenticated` layout redirects authenticated users to their role-specific dashboard via `getRoleDashboard()`.
  - `_authenticated` layout redirects unauthenticated users to `/auth/login`.
- Role-based access via `requireRole(roles)` helper — wraps session check with role validation. Unauthorized users are redirected to their own dashboard.
- Password hashing uses Better-Auth's built-in scrypt via `better-auth/crypto`.
- File downloads check ownership and role before generating a presigned URL.

### Two-Factor Authentication & Session Management

- TOTP via authenticator app using Better Auth's built-in `twoFactor` plugin.
- Backup codes (8 single-use) generated on enable; user must confirm they've saved them.
- Login prompts for 6-digit TOTP code when 2FA is enabled; backup code works as fallback.
- Per-user enable/disable with current password confirmation.
- Active sessions dashboard showing device, IP, and timestamp per session. Users can revoke specific sessions or all other sessions.
- Email notification sent on 2FA enable/disable via the email queue.
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

| Event                 | Trigger                      | In-app [v1]    | Email [v2]          |
| --------------------- | ---------------------------- | -------------- | ------------------- |
| invitation_sent       | Admin creates user           | —              | ✓                   |
| password_setup        | Password set by user         | —              | ✓                   |
| submission_received   | Student uploads file         | ✓ (instructor) | ✓ (instructor)      |
| review_completed      | Instructor marks pass/revise | ✓ (student)    | ✓ (student)         |
| revision_requested    | Instructor marks revise      | ✓ (student)    | ✓ (student)         |
| deadline_approaching  | 24h / 1h before due date     | ✓              | ✓                   |
| deadline_missed       | Checkpoint overdue           | ✓              | ✓                   |
| consultation_verified | Instructor approves log      | ✓ (student)    | —                   |
| extension_requested   | Student requests extension   | ✓ (instructor) | ✓ (instructor) [v2] |
| sla_breach            | Instructor misses review SLA | ✓ (admin)      | —                   |

### In-App Delivery [v1]

- Notifications stored in the `notifications` table with i18n keys (`titleKey`, `messageKey`) and interpolation `params` (jsonb) instead of literal text. The `listNotifications` handler resolves the display strings at read time using the requesting user's `locale` (read directly from `session.user.locale` — no separate DB query), so Indonesian users see Indonesian notifications and English users see English. The handler selects `id, type, titleKey, messageKey, params, read, createdAt, metadata` — `metadata` was added back (Track: Notifications & File Management UX) to support client-side notification navigation. Response objects are constructed explicitly to avoid leaking raw columns.
- TanStack Query polls for new unread notifications at a 30-second interval (`refetchInterval: 30000`) with `refetchIntervalInBackground: false` (stops polling when the tab is not visible, reducing server load by ~75%). The notification list uses `staleTime: 30_000` to prevent unnecessary refetches on window focus/mount when data is fresh. The notification bell in the shared header reflects the unread count.
- **Notification navigation (Track: Notifications & File Management UX):** Notifications are clickable links that navigate to the relevant page based on their `type` and stored `metadata` (assignmentId, checkpointId, submissionId). A `getNotificationRoute(type, metadata)` helper in `src/components/notifications/notification-routes.ts` derives the route client-side (e.g., `review_completed` → `/student/assignments/{assignmentId}/checkpoints/{checkpointId}`). `NotificationItem` renders as a TanStack Router `<Link>` when a route exists, falling back to a `<button>` when no route can be derived. Clicking a notification calls `markAsRead` before navigating.
- **Read/Unread filter & Load More (Track: Notifications & File Management UX):** The notification center has "All" and "Unread" tabs (shadcn/ui `Tabs`). The "Unread" tab filters server-side via `.where(eq(notifications.read, false))` when `unreadOnly` is true. The list loads 20 items at a time with a "Load More" button that appends the next page (incremental loading with ID deduplication).
- **Client-side performance (Track: Notifications & File Management UX):** `NotificationItem` is wrapped in `React.memo` with `useCallback` for `handleClick`. `NotificationCenter` uses `useMemo` for `groupedNotifications` and `unreadCount`, eliminating redundant `items.filter()` calls and double unread count computation on every render.
- **Optimistic mark-as-read (Track: Optimistic UI Updates for Mutations):** `useMarkRead` and `useMarkAllRead` use TanStack Query's `onMutate` to flip the `read` flag and decrement the unread count in the cache instantly — before the server responds. On error, the previous cache snapshot is restored (`onError` rollback). The unread badge drops to zero immediately when "Mark all as read" is clicked. Cache invalidation runs in `onSettled` to reconcile. Query keys use the `notificationKeys` factory from `src/lib/query-keys.ts`.
- **Notification center UI (Track: Accessibility & i18n Compliance):** The slide-over panel is built on the shadcn `Sheet` primitive (`@base-ui/react/dialog`), which provides built-in focus trapping, Escape-key dismissal, and backdrop-click close — replacing a former custom backdrop div + panel div that lacked focus management. Navigable `NotificationItem`s render as TanStack Router `<Link>` elements; non-navigable items fall back to native `<button type="button">` for keyboard access (Tab focus, Enter/Space activation). The `NotificationBadge` button exposes a dynamic `aria-label` that includes the unread count (e.g. "5 unread notifications") and an `aria-live="polite"` region so screen readers announce count changes without stealing focus. The count `<span>` no longer carries `role="status"` — the button's dynamic `aria-label` conveys the count.
- Badge indicator on the sidebar.

### Email Delivery

- Sent via Resend API. [v1] for auth-related emails (invitations, password reset, 2FA enable/disable); [v2] for event notification emails (submission, review, deadline alerts).
- **Localized email subjects:** Password reset, invitation, and SLA alert subjects are resolved from i18n keys (`emails.subjects.*`) using the recipient's `locale` preference via a shared server-side resolver (`resolveEmailSubject`).
- Email queue (`email_queue` table) with retry logic: 3 attempts with exponential backoff (30s, 5min, 30min).
- Dead letter after 3 failed attempts (logged, not retried).
- **Concurrent batch sends:** The processor sends emails in chunks of 5 via `Promise.allSettled` (chunks run sequentially). Each email's success/failure is handled individually in the settled callback (same UPDATE logic). Partial failures don't abort the batch. Cycle latency reduced from ~10× to ~2× single-send latency for a full batch of 10 (TRACK-016, PERF-32/33).
- **Retention cleanup:** `sent` rows older than 90 days and `failed` rows older than 180 days are automatically pruned on a tick-embedded 24-hour cycle (`lastPruneAt` timestamp in `email-queue-init.ts`). `pending`/`processing` rows are never deleted. Logged as `email_queue.retention_pruned` with deleted count (no PII) (TRACK-016, ENH-OPS-1/BUG-20).
- **Delivery tracking:** A `resendMessageId` column (populated from the Resend API `result.data.id` on successful send) enables correlation with Resend's delivery dashboard. Exposed in the admin email queue inspector as a monospace truncated cell with tooltip (TRACK-016, BUG-4).
- **Concurrency hardening:** rows are claimed inside a transaction using `FOR UPDATE SKIP LOCKED` and marked `processing`; the Resend send occurs **outside** the transaction so no long-lived lock is held. An in-process `isRunning` guard prevents overlapping ticks. Rows stuck in `processing` for > 5 minutes are reclaimed to `pending` at the start of each tick, preventing lockup on worker crash.
- **XSS hardening:** all user-derived interpolations in email bodies are passed through an `escapeHtml` helper before rendering, preventing stored-XSS via user-controlled fields (name, email, subject context).

### Preferences [v2]

- Users control notification delivery per event type and per channel via the `notification_preferences` table.
- Default: all enabled. Users can opt out of specific event types or channels.

---

## 9. Error Handling [v1]

### Strategy

| Layer                 | Approach                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Server functions**  | Validate inputs with Zod before processing. Return typed error responses. Never expose stack traces to the client. |
| **File upload**       | Server-side MIME validation. R2 failures surface as upload errors with retry guidance to the user.                 |
| **Email delivery**    | Queue-based with retry. Transient failures are retried; permanent failures are logged. Rows claimed transactionally (`FOR UPDATE SKIP LOCKED`); stale `processing` rows (> 5 min) are reclaimed to prevent lockup. |
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
| `src/lib/errors.ts` | `ErrorCode` union (`UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION`, `BAD_REQUEST`, `CONFLICT`, `INTERNAL`), `ServerError` shape `{ error: { code, message } }`, `serverError(code, message, context?)` factory, `logError()` structured logger (readable text in dev, single-line JSON in prod), `sanitizeInput()` (redacts `password`/`token`/`secret`/etc.), `isServerError()` guard. Responses expose only `code` + `message` — never stack traces, SQL, or raw errors. |
| `src/lib/toast.ts` | `showErrorToast(code, t)` renders a sonner `toast.error` with the translated message (falls back to `error.default`); `parseServerError(res)` extracts `{ code, message }`, tolerant of both the typed shape and the legacy `{ error: string }` shape. |
| `src/components/ui/sonner.tsx` | `<Toaster>` wrapper — theme-aware (light/dark via `MutationObserver`), design-token CSS vars, `position="top-right"`, `richColors`. Mounted once in `src/routes/__root.tsx`. |
| `src/components/error-boundary.tsx` | `RootErrorComponent` — bilingual fallback (`error.somethingWentWrong`), Reload button + home link, `role="alert"` + `aria-live="assertive"`, logs via `logError('INTERNAL', ...)`. Wired as `errorComponent` in `src/routes/__root.tsx`. |
| Server handlers (`src/server/*.server.ts`) | All migrated from `{ error: '<string>' }` to `serverError(code, message, context?)`. DB operations wrapped in `try/catch` → `serverError('INTERNAL', ..., { cause, handler })`. Client mutation hooks (`src/hooks/*.ts`) call `showErrorToast()` on error. |
| i18n (`locales/{en,id}.json`) | `error` namespace (camelCase) holds user-facing messages per code; `simak-i18n/no-hardcoded` lint rule enforces `t('key')` usage. |

---

## 10. Testing Strategy

### Unit Tests (Vitest) [v1]

| Focus                 | Examples                                                                              |
| --------------------- | ------------------------------------------------------------------------------------- |
| **Gating logic**      | Checkpoint unlock conditions, consultation counting, sequential order enforcement.    |
| **State transitions** | Valid and invalid checkpoint state transitions (e.g. can't go from LOCKED to PASSED). Stale-state rejection: handler returns error when locked re-read shows state changed (FOR UPDATE re-validation). |
| **Validation**        | Zod schema tests for all input types (assignment creation, submission upload, etc.).  |
| **Permission checks** | Role-based access logic unit tests.                                                   |
| **Bulk import**       | Xlsx parsing, role-permission validation, email uniqueness (excluding soft-deleted), transaction rollback, audit logging. |                                                   |

### Integration Tests (Vitest) [v2]

| Focus                | Examples                                                                   |
| -------------------- | -------------------------------------------------------------------------- |
| **Server functions** | Call server functions with test database, verify DB state changes.         |
| **Auth flow**        | Login, session validation, role enforcement end-to-end within test server. |
| **File upload flow** | Presigned URL generation → mock upload → metadata persistence.             |
| **Concurrency**      | Concurrent review/submission race conditions — exactly one succeeds, stale-state rejection for the loser. |

### E2E Tests (Playwright) [v1]

E2E tests run against a dedicated test database (`simak_test` on a separate `postgres-test` Docker service, port 5433) to avoid polluting the dev database. The global setup (`tests/e2e/global-setup.ts`) migrates the test DB, truncates all tables, and seeds test users (SuperAdmin, Admin, Instructor, Student — all with `emailVerified: true`) plus an assignment template (3 checkpoints, Thesis, `minConsultations: 1`) and an assignment with the first checkpoint unlocked. Each spec file resets the database (truncate + re-seed) via `resetDatabase()` before execution to ensure isolation.

**Configuration** (`playwright.config.ts`):

- Chromium-only, `workers: 1` (serial execution for DB isolation).
- `reuseExistingServer: !process.env.CI` — reuses `pnpm dev` server in local dev, starts a fresh server in CI.
- `globalSetup` runs migrations + truncate + seed + creates placeholder `storageState` files.
- `webServer` starts `pnpm dev` on port 3000.

**Auth helper** (`tests/e2e/helpers/auth.ts`):

- `loginAsRole(page, role)` fills the login form (`#email`, `#password` inputs) then submits via Better Auth's `/api/auth/sign-in/email` API endpoint. The Base UI Button component renders `type="button"` (not `type="submit"`), so form submission via the button doesn't work — the API call is a workaround while still exercising the form inputs.
- `storageState` is cached per role to avoid re-authenticating between tests within a spec file.

**DB reset** (`tests/e2e/helpers/db-reset.ts`):

- `resetDatabase()` truncates 18 tables (CASCADE) and re-seeds before each spec file.
- `getDatabaseUrl()` is exported as a shared helper (no non-null assertions on `process.env`).

**R2 mock** (`tests/e2e/helpers/r2-mock.ts`):

- Known limitation: TanStack Start's server-fn fetcher returns `undefined` for mocked responses, making R2 upload E2E testing infeasible. File submission tests use direct DB insertion as a workaround. Full R2 upload flow (file selection, upload progress bar, success state) is not E2E-tested.

**Spec files** (14 tests across 5 files):

| Spec File                    | Tests | What it validates                                                                               |
| ---------------------------- | ----- | ----------------------------------------------------------------------------------------------- |
| `auth.spec.ts`               | 3     | Route guards (student→admin blocked, admin→student blocked, unauthenticated→login redirect) + valid login |
| `admin-users.spec.ts`        | 3     | Create instructor, create student, filter users by role                                         |
| `instructor-assignments.spec.ts` | 2 | Create assignment from template, checkpoint state transitions (locked → unlocked → submitted) |
| `student-submission.spec.ts` | 2     | Upload form visible + version history, resubmit with "Latest" badge                            |
| `instructor-review.spec.ts`  | 4     | Review queue, Pass unlocks next checkpoint, Revise sets deadline, review history                |

Run with `pnpm test:e2e` (headless) or `pnpm test:e2e:ui` (interactive UI mode). All 14 tests pass in ~59 seconds.

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
- **Typed query-key factory (Track: Optimistic UI Updates for Mutations):** `src/lib/query-keys.ts` centralizes all query cache keys into typed factory functions for 6 domains (`notificationKeys`, `consultationKeys`, `extensionKeys`, `assignmentKeys`, `userKeys`, `templateKeys`). This replaces scattered inline key arrays (`['notifications', 'unreadCount']`) and ensures reliable cache invalidation across features — especially for optimistic mutations that need to read and write the correct cache entry by key. `templateKeys` was added in TRACK-015 when the template/student pickers were migrated from `useEffect`+`useState` to `useQuery`.
- **Optimistic UI updates (Track: Optimistic UI Updates for Mutations):** 9 mutation sites use the `onMutate`/`onError`/`onSettled` pattern to reflect predicted state changes before the server responds, eliminating perceived latency on deterministic operations (mark-as-read, verify/reject consultation, approve/reject extension, unlock/extend deadline, delete user). Rollback is guaranteed via snapshot capture/restore. Mutations with unpredictable server responses (e.g., `submitReview`) keep the standard refetch-on-success flow (scope guard).

### Server-Side Caching [v2]

- **Redis** as a shared cache layer for:
  - Better-Auth session storage (reduces PostgreSQL session lookups).
  - Dashboard aggregated query results (30s TTL — avoids re-joining 5 tables on every visit).
  - Rate limiting counters for server functions.
- Redis runs as a dedicated Coolify service alongside PostgreSQL. No changes to application logic — only a cache adapter swap in Better-Auth and a query result wrapper in the dashboard server function.

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
| `MIGRATE_DATABASE_URL` | Direct PostgreSQL connection string for migrations (bypasses PgBouncer) |
| `R2_ENDPOINT`          | Cloudflare R2 endpoint URL                                              |
| `R2_ACCESS_KEY_ID`     | R2 API access key                                                       |
| `R2_SECRET_ACCESS_KEY` | R2 API secret key                                                       |
| `R2_BUCKET_NAME`       | R2 bucket for uploads                                                   |
| `R2_PUBLIC_URL`        | R2 public base URL for file access                                      |
| `RESEND_API_KEY`       | Resend API key for email delivery                                       |
| `EMAIL_FROM`           | From-address for outgoing emails (default: `SIMAK <noreply@simak.app>`)  |
| `BETTER_AUTH_SECRET`   | Signing secret for auth tokens                                          |
| `BETTER_AUTH_URL`      | Public URL of the app                                                   |
| `SUPERADMIN_EMAIL`     | Email for the seeded SuperAdmin                                         |
| `SUPERADMIN_PASSWORD`  | Password for the seeded SuperAdmin                                      |

### Database Migrations [v1]

- Drizzle Kit for migration generation and execution.
- `drizzle-kit push` for development; `drizzle-kit migrate` for local CLI use.
- **Production migration runner**: Bundled `migrate.mjs` executed via Dockerfile CMD before app start.
- **PgBouncer bypass**: Use `MIGRATE_DATABASE_URL` to connect directly to PostgreSQL (port 5432) during migrations, bypassing PgBouncer's transaction-mode pooling which breaks Drizzle's prepared statements.
- **Concurrency guard**: `pg_advisory_lock` (ID: 789123) serializes concurrent migration runs to prevent corruption.
- **Seed runner**: `seed.mjs` chained after migrations; idempotent (skips existing SuperAdmin).
- **Rollback convention**: Companion rollback SQL files at `drizzle/migrations/rollback/<NNNN>_<tag>.rollback.sql` for emergency manual execution.

### Connection Pooling

- **Development**: Direct connections (Drizzle uses a single pool internally).
- **Production**: PgBouncer deployed as a sidecar container in Coolify. The app connects to PgBouncer, which multiplexes connections to PostgreSQL. Prevents connection exhaustion under concurrent load.
- Connection string format: `postgresql://user:pass@pgbouncer:6432/simak` (PgBouncer on port 6432).

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
- Focus management: focus trapping in dialogs and sheets on open, focus return on close, skip-to-content link as first focusable element.
- `focus-visible:` ring classes on all interactive elements (only visible on keyboard navigation, not mouse clicks).
- Touch targets minimum 44×44px (`min-h-11 min-w-11`) on all buttons, links, and interactive elements for mobile accessibility.
- `aria-hidden="true"` on all decorative icons (sidebar nav icons, notification bell icons) to hide them from screen readers. Also applied to purely-visual connector lines and dots in the `CheckpointTimeline` (Track: Accessibility & i18n Compliance).
- `aria-label` on all icon-only buttons (theme toggle, language switcher, sidebar close, notification bell, pagination controls, FileList download button).
- `aria-live="polite"` regions for dynamic content: form validation errors (`FormMessage`), submission status messages, dashboard error states, consultation errors, and notification unread-count changes (NotificationBadge).
- `role="progressbar"` with `aria-valuenow`/`aria-valuemin`/`aria-valuemax`/`aria-label` on all progress bars: `ProgressTable` (per-student completion), `ConsultationProgress` (summary + per-checkpoint verified/required bars) (Track: Accessibility & i18n Compliance).
- `aria-expanded` + `aria-controls` on the `DeadlineManager` collapsible toggle buttons, with matching `id` on the expandable content div (Track: Accessibility & i18n Compliance).
- `aria-describedby` on form inputs pointing to error message elements for screen reader association.
- Heading hierarchy: every page has exactly one `h1`, heading levels don't skip (h1 → h2 → h3).
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
| **Date formatting** | Shared `formatDate(date, locale, style)` helper (`src/lib/format-date.ts`) renders dates in the user's locale (`id-ID` or `en-US`); replaces all `toLocaleDateString('en-US')` and bare `toLocaleDateString()` calls (Track: Accessibility & i18n Compliance). A companion module `src/lib/format.ts` exports locale-aware formatters — `formatDateShort` / `formatDateLong` / `formatDateTimeShort` (absolute) and `formatRelativeTime` (relative, via `date-fns` `formatDistanceToNow` + `localeMap`) — used where relative context aids comprehension: checkpoint due dates and student-dashboard upcoming deadlines append parenthesized relative time (e.g., "Mar 5, 2026 (in 3 days)"), and SLA badges expose relative time as a `title` tooltip across all variants (Track: Empty States, Date Display & Mobile Polish). | `formatDate(item.createdAt, locale, 'short')`, `formatDateShort(checkpoint.dueDate, locale)`, `formatRelativeTime(date, locale)` |
| **Email templates** | Render at send time based on recipient's locale.                                 | Resend email body in `en` or `id`                          |

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
| Email notifications (event alerts: submission, review, deadline)       |          | ✓             |
| Push notifications (Web Push)                                          |          | ✓             |
| Notification preferences                                               |          | ✓             |
| Analytics dashboards (admin + instructor)                              | ✓        |               |
| Report export (CSV + Excel)                                            | ✓        |               |
| Scheduled/PDF report delivery                                          |          | ✓             |
| Deadline extension workflow                                            | ✓        |               |
| Audit logging                                                          | ✓        |               |
| Integration tests                                                      |          | ✓             |
| Playwright E2E tests                                                   | ✓        |               |
