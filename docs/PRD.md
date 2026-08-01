# Product Requirements Document (PRD)

## Project Overview

**Project Name:** SIMAK (Sistem Informasi dan Manajemen Akademik)
**Purpose:** Help students and instructors track assignment progress through defined checkpoints with structured feedback cycles.
**Audience:** University or school instructors and students.
**Platform:** Web application, containerized with Docker and deployed through Coolify on a VPS.

**Testing performance decision (August 2026):** A controlled Vitest coverage
benchmark established a 113.35-second median for `pnpm test:coverage`. No safe
configuration or package-script change met the 20% improvement target while
preserving the existing test projects, V8 coverage reports, source scope, and
80% thresholds, so the current test configuration remains unchanged. Detailed
measurements and rejected candidates are recorded in
[`docs/vitest-coverage-performance.md`](vitest-coverage-performance.md).

**Private-pilot deployment decision (TRACK-047):** The completed pilot runs one SIMAK
instance in Coolify with a Coolify-managed PostgreSQL 16 service on a private network,
direct PostgreSQL connections without PgBouncer, private Cloudflare R2 storage, and
Resend transactional email. The custom domain is HTTPS-only, with daily PostgreSQL
backups retaining seven copies in both Coolify server storage and remote S3-compatible
storage. Multi-instance scaling, Redis, and CI/CD outside Coolify remain out of scope.
The completed TRACK-048 readiness review confirms that the seven-copy setting is a
pilot baseline rather than an approved broader retention policy. Restore remains an
operator-only, isolated-first procedure; independent scheduling, job-level failure
visibility, separate backup credentials, and expanded R2 durability are follow-up
recommendations, not current product or deployment behavior.

---

## Goals

### Primary Goals (MVP & Post-MVP Scope)

_(Note: Features marked with `[v2]` are deferred to a post-MVP phase.)_

- Instructors can assign assignments with structured checkpoints to students.
- Students can submit work for each checkpoint.
- Instructors can review, approve, or request revisions on submissions.
- Instructors can maintain private reusable plain-text feedback snippets and explicitly append them to editable review comments without changing review decisions or submission state.
- In-app notifications keep both parties informed of submissions, reviews, revision requests, and missed deadlines. Email notifications are now sent for 11 event types (submission received, review completed, revision requested, consultation verified/rejected, extension approved/rejected, extension requested, deadline reminder, student at risk, discussion reply) alongside in-app notifications. Auth-related emails (invitations, password reset, 2FA enable/disable) continue as before. Proactive deadline reminders (7-day, 3-day, 1-day lead times) are dispatched by a background scanner that runs hourly alongside the email queue processor. Notification **preferences** (per-user, per-type, per-channel opt-out) are configurable in the Settings Hub — 13 notification types across 4 groups (Reviews, Consultations, Submissions, System) with independent Email and In-app toggles. All preferences default to enabled (opt-out). Security-critical emails (password reset, invitations, 2FA) are exempt from preference gating.
- Checkpoints must be completed in sequential order.
- Admins can manage users and assignment templates.
- Admins can bulk import users and assignment templates via Excel (.xlsx) files with client-side preview and server-side re-validation.
- Both students and instructors can view and download previously submitted checkpoint files.
- Consultation sessions (Kartu Bimbingan) are tracked as a requirement for assignment completion.
- Admins can view audit logs via the viewer at `/admin/audit-log` and system-wide analytics dashboards at `/admin/analytics`.
- Students and instructors can request and manage deadline extensions via a configurable approval workflow.
- Users can enable two-factor authentication (TOTP) for enhanced account security.
- Assignment templates include estimated duration per checkpoint, allowing auto-calculation of checkpoint dueDates during assignment creation.
- Users have a unified **Settings Hub** (role-specific routes at `/student/settings`, `/instructor/settings`, `/admin/settings`) where they can edit their profile name and avatar, change password, manage 2FA and sessions, switch language and theme, and configure accessibility preferences (reduced motion).

---

## Roles & Permissions

| Role           | Description                                                                                                                              |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **SuperAdmin** | Seeds the system. Can create Admin users only. Not involved in day-to-day operations.                                                    |
| **Admin**      | Manages users (Instructor, Student) and assignment templates. Sends invitation emails. No involvement in review or submission workflows. |
| **Instructor** | Creates assignments, reviews submissions, manages deadlines, and maintains private feedback snippets. Can assign multiple assignments per student. |
| **Student**    | Views assignments, uploads checkpoint submissions, tracks progress. Can collaborate on group assignments `[v2]`.                         |

---

## User Registration & Onboarding

- **Self-registration is not allowed.** No sign-up page exists.
- A **SuperAdmin account is seeded** into the database during initial deployment.
- SuperAdmin can create Admin accounts via the admin panel.
- Admin can create Instructor and Student accounts.
- Authentication is powered by **Better-Auth** with email/password, database-backed sessions, and HTTP-only cookies. Auth endpoints (login, password setup, password reset) are **rate-limited** (10 requests per 60-second window per IP) to prevent brute-force attacks. The `BETTER_AUTH_SECRET` environment variable must be at least 32 characters long (validated at startup).
- When an account is created, the system sends an email (via Resend) with a **password setup link** via a custom invitation email handler (`sendInvitationEmail`).
- The link directs the user to a dedicated password setup page (`/auth/setup-password?token=xxx`) where they choose their password.
- **Atomic token consumption:** Password setup tokens are consumed atomically via `DELETE ... RETURNING` as the first statement inside a database transaction. This eliminates the check-then-act race condition where concurrent requests could reuse the same token before it was deleted. The token is filtered by `value = token AND expiresAt > now()` in the DELETE itself, so expired or invalid tokens return zero rows and are rejected. All downstream operations (user lookup, password upsert, email verification) occur inside the same transaction — if any step fails, the transaction rolls back and the token is restored. A generic error message ("Invalid or expired token") is returned for all failure cases to prevent information leakage.
- SuperAdmin and Admin can also generate a password setup link from the dashboard to share manually (e.g., in person).
- **Forgot Password:** Users can request a password reset from the login page (`/auth/forgot-password`), which sends a one-time reset link via Better-Auth's `requestPasswordReset` flow.
- Password reset emails use SIMAK-branded HTML templates sent through Resend.
- After setting a password, the user can log in at `/auth/login`.

---

## User Flows

### Student

1. Receives invitation email with password setup link or gets link from Admin.
2. Sets password, logs in, and is redirected to the student dashboard with active assignments overview, upcoming deadlines, pending reviews, and consultation reminders.
3. Opens an assignment to view its checkpoints, deadlines, and required consultations.
4. Submits files for the current checkpoint (`.docx`, `.pdf`).
5. If review is **Pass** → next checkpoint unlocks.
6. If review is **Revise** → receives instructor feedback, resubmits (creates new version), and deadline for resubmission. _(Note: If a checkpoint is revised more than 3 times, a non-blocking escalation notification is triggered to the instructor and admin. The escalation is advisory-only — there is no hard block on resubmissions beyond 3.)_
7. Logs consultation sessions with supervisor as needed (via assignment detail page).
8. Asks questions about a checkpoint via the discussion panel (async Q&A with the instructor).
9. Downloads previously submitted files from any checkpoint.
10. Manages profile, preferences, and notification settings.

### Instructor

1. Logs in and is redirected to the instructor dashboard with pending review queue (SLA badges), recent submissions, assignment overview, at-risk student identification widget, and quick actions.
2. Creates new assignments by selecting a template and assigning students.
3. Reviews submissions from the review queue, providing pass/revise decisions with comments and optional feedback files.
4. Manages deadlines — extends individual checkpoint due dates and unlocks overdue checkpoints via the collapsible Deadline Manager on the assignment detail page.
5. Monitors student progress across assignments.
6. Views and validates student consultation logs.
7. Replies to student questions in checkpoint discussion threads (Discussions tab on assignment detail, or quick access from review detail page).

### Admin

1. Logs in and is redirected to the admin dashboard with system-wide metrics (total users, active assignments, pending reviews, active consultations), recent activity feed, deadline escalation alerts, and quick actions.
2. Creates Instructor and Student accounts — system sends password setup email.
3. Generates password setup links for manual sharing when needed.
4. Manages assignment templates — creates templates with ordered checkpoints and types.
5. Views system-wide analytics and audit logs.
6. Monitors and manages the email delivery queue via `/admin/email-queue` — views paginated, filterable, searchable list of queued emails with summary stats (pending/sent/failed counts). Can manually retry failed emails (resets to `pending` for reprocessing by the background processor). The table includes a `resendMessageId` column (correlated with Resend's delivery dashboard) displayed as a monospace truncated cell. The background processor sends emails in concurrent batches of 5 via `Promise.allSettled` (reducing cycle latency), and automatically prunes `sent` rows older than 90 days and `failed` rows older than 180 days (never touches `pending`/`processing` rows). The page also includes a "Trigger R2 Cleanup" button that manually initiates orphaned R2 object cleanup (bypassing the 6-hour throttle) — deletes R2 objects whose upload intents expired without being consumed, returning a summary of deleted/failed counts.

### SuperAdmin

1. Logs in with seeded credentials.
2. Creates Admin accounts — system sends password setup email.
3. Has full read access to all data but no involvement in instruction or review workflows.

---

## Features

### Assignment Templates

- Admin defines templates with a fixed ordered list of checkpoints.
- Each template has a `type` label (e.g., Thesis, Research Paper).
- Templates can be duplicated, filtered, and reused when creating assignments.
- Each template checkpoint includes an `estimatedDuration` (days). During assignment creation, checkpoint dueDates are auto-calculated from the base date + cumulative durations. Instructors can override before finalizing.
- Each template checkpoint can optionally have a **grading type** (`null` = pass/fail only, `numeric` = direct 0–100 scoring per criterion, `qualitative` = level-based scoring with configurable numeric mapping). When a grading type is set, admins define a rubric: criteria (title, description, weight 0–100, order) and—for qualitative checkpoints—performance levels (label, description, score 0–100, order). Weights must sum to 100%. Rubric data is soft-deleted (never hard-deleted) and looked up live from the template at review time via `checkpoints.templateCheckpointId`.

### Assignment Management

- Instructors create assignments from templates, assign title + description, set a final deadline, and select one or more students.
- Each selected student gets their own independent progress, checkpoint states, and submissions tied to the same assignment.
- Group assignments (collaborative submissions by multiple students) are deferred to a post-MVP iteration. `[v2]`
- Deadlines can be extended via an approval workflow.
- Progress tracking shows completion status for each student.

### Checkpoints & Submissions

- Checkpoints are completed in sequential order — each unlocks only after the previous is passed.
- Students upload `.docx` or `.pdf` files per checkpoint. **Maximum file size is restricted to 25MB** to balance quality and storage limits.
- Each submission has an audit trail with file versioning. Resubmitting creates a new immutable record in the audit trail.
- Instructors review and mark as Pass or Revise with comments. For checkpoints with a rubric (`grading_type` is `numeric` or `qualitative`), instructors score each criterion (0–100 numeric input or qualitative level selection), and the system auto-computes a weighted checkpoint total. All criteria must be scored before submission. Rubric scores are stored as a full denormalized snapshot (`criterionTitle`, `levelLabel`, `score`, `weight`) so completed reviews are unaffected by later rubric edits. Checkpoints without a rubric (`grading_type: null`) use the current pass/fail flow unchanged.
- Instructors can attach feedback files to reviews.
- **Instructor feedback snippets (TRACK-049):** Instructors manage a private, searchable library of validated plain-text snippets at `/instructor/feedback-snippets`. Snippets have bounded title/category/body fields, can be archived and restored instead of deleted, and are scoped to the owning instructor. The review form offers active snippets through an explicit picker action that appends editable text with one blank-line separator when needed; insertion never changes the decision, rubric scores, checkpoint state, or submission status. Archived snippets and other instructors' snippets are not exposed.
- Late submissions are controlled: overdue checkpoints lock automatically; instructors can unlock them.
- **SLA & Escalation (Addressing the Instructor Bottleneck):** To ensure students aren't unfairly blocked, if an instructor does not review a submission within a defined SLA (e.g., 3 days), an automated escalation alert is sent to the Admin, and the student's subsequent deadlines are **automatically extended by the number of days the review was delayed** (breach duration is added to affected deadlines). The SLA timer is anchored at `submissions.uploadedAt` (when the student uploaded), ensuring the breach duration reflects the actual delay the student experienced.
- **Atomic Checkpoint State Transitions:** When a student submits a checkpoint, an instructor opens it for review, or an instructor submits a review decision, the checkpoint's state is read and mutated atomically — the state read uses `SELECT ... FOR UPDATE` inside a database transaction, and the state is re-validated after acquiring the row lock. This prevents race conditions where two concurrent operations (e.g., a student submitting while an instructor opens for review) could both read the same state and both proceed, leading to inconsistent state. If the locked re-read shows the state has changed, the operation is rejected with a stale-state error. The same pattern (transaction + `FOR UPDATE` + post-lock status re-check) is applied to consultation verify/reject handlers and extension approve/reject handlers — the consultation or extension request row is locked inside a transaction and its `status` is re-validated after the lock is acquired, rejecting stale-state transitions with a descriptive "already processed" error.
- **Deadline Extension Workflow**
  - **Student-Initiated:** Students can request deadline extensions via an approval workflow with reason categories (Personal, Research, Health, Other) and a proposed duration (1–30 days). Instructors approve or reject with optional comment.
  - **Instructor-Initiated:** Instructors can directly extend deadlines for one or all checkpoints without student request. Bulk extension applies +N days to all remaining checkpoints for a student.
  - **Auto-Adjustment:** When an extension is approved or directly applied, the affected student's subsequent checkpoint `dueDate` values auto-extend. The assignment-wide `finalDeadline` (set once at creation) is **immutable** and never mutated by extensions or SLA-breach adjustments — each student's effective deadline is derived at read time from their first non-passed checkpoint's `dueDate` (via the shared `computeEffectiveDeadline` helper).
  - **Configurable Caps:** Admin-configurable extension limits per assignment: `maxExtensionDays` (1–30, default 7) and `maxTotalExtensions` (1–10, default 3).
  - **Audit Trail:** All deadline changes — approved requests, direct extensions, and manual unlocks — are recorded in the shared `audit_log` table with actor, previous/next values, reason, and timestamp.
  - **Atomic Write Guarantee:** When a student requests an extension, the `extension_requests` insert and the instructor's in-app `notifications` insert are wrapped in a single database transaction. If the notification insert fails, the entire operation rolls back — ensuring no extension request is ever left without its corresponding instructor alert. The extension count cap (`maxTotalExtensions`) is enforced **inside** the transaction with a `FOR UPDATE` lock on the `assignment_students` row, preventing a TOCTOU race where two concurrent extension requests could both pass the count check and exceed the cap. When an extension is approved, the affected checkpoint rows are locked with `FOR UPDATE` inside the transaction before their `dueDate` values are read and adjusted, preventing concurrent deadline modifications from producing inconsistent results.

### Consultation Tracking (Kartu Bimbingan)

- Students log consultation sessions via the assignment detail page.
- Each consultation is associated with a specific checkpoint stage.
- Instructors verify logs ("Trust but Verify" model).
- The minimum number of consultations required per checkpoint (`minConsultations`) is defined by the **Admin in the assignment template**. Only **verified** consultations count toward the minimum.
- Supports logging sessions with external consultants (guest supervisors, clinicians).
- Progress bars show completed vs. required consultations at assignment and checkpoint levels.

### Checkpoint Discussions (Q&A)

- Students and instructors can exchange lightweight async Q&A messages on a per-checkpoint basis via a `DiscussionPanel` component.
- Messages are threaded via `parentMessageId` (self-referencing FK) — replies are indented under their parent.
- **Soft-delete with preservation:** Deleted messages render as a muted "[deleted]" placeholder with no author or content. Replies to deleted messages are preserved (the thread structure is maintained).
- **15-minute deletion window:** Users can delete their own messages within 15 minutes of posting. After the window expires, the delete button is hidden.
- **Ownership-gated access:** Students can only view/post in discussions on their own checkpoints. Instructors can view/post in discussions on any checkpoint within their assignments.
- **Role-based message alignment:** Student messages and instructor messages are visually distinguished (different alignment/Avatar).
- **Near-real-time updates:** The discussion panel polls every 30 seconds via TanStack Query `refetchInterval` for new messages. Optimistic mutations (post/delete) reflect changes instantly before the server responds, with rollback on error.
- **Notification + email integration:** When a message is posted, a `discussion_reply` in-app notification and localized email are dispatched to the other party (student → instructor, instructor → student) as post-commit advisory work (try/catch, never blocks the primary operation). Notifications respect user notification preferences (TRACK-022). The notification route is derived from `metadata.target` (`'student'` → checkpoint page, `'instructor'` → assignment page).
- **Mounted on 3 surfaces:** Student checkpoint detail page (below submission section), instructor assignment detail page (Discussions tab), and instructor review detail page (quick access while reviewing).
- Discussions are distinct from consultations: consultations are formal advising sessions with verification gating; discussions are informal, instant, and ungated Q&A.

### Notifications

- In-app notification center with read/unread tracking and type-based grouping.
- In-app notifications are **localized at read time** — the database stores i18n keys (`titleKey`, `messageKey`) and interpolation `params` (jsonb) instead of literal text; the recipient's locale resolves the display strings, so Indonesian users see Indonesian notifications and English users see English.
- Email delivery via Resend for account invitations, password setup, 2FA enable/disable, SLA alerts, and **11 event types** (submission received, review completed, revision requested, consultation verified, consultation rejected, extension approved, extension rejected, extension requested, deadline reminder, student at risk, discussion reply). Event emails are dispatched as **post-commit advisory work** alongside existing in-app notifications — the primary operation always succeeds even if email enqueue fails. Email subjects are **localized** using the recipient's `locale` preference (email HTML bodies remain English-only by design — body localization deferred). All user-derived content in email bodies is HTML-escaped to prevent stored XSS. Recipients with no verified email or soft-deleted accounts are silently skipped. Email subjects support parameter interpolation (e.g., `{assignmentTitle}` in the deadline reminder subject).
- **Email queue inspector:** Admins can monitor the email delivery queue at `/admin/email-queue` — a paginated (20/page), filterable (by status: pending/processing/sent/failed), and searchable (by recipient email or subject) list view with summary statistics. Admins can manually retry failed emails, which resets the email to `pending` status for reprocessing by the background processor. The retry is idempotent — only emails with `status='failed'` can be retried; attempting to retry a non-failed email returns a conflict error. Each row displays a `resendMessageId` (populated from the Resend API response on successful send) as a monospace truncated cell with a tooltip, enabling admins to correlate deliveries with Resend's dashboard. The background processor sends emails in concurrent batches of 5 via `Promise.allSettled` (partial failures don't abort the batch), and automatically prunes `sent` rows older than 90 days and `failed` rows older than 180 days on a 24-hour tick-embedded cycle — `pending` and `processing` rows are never deleted.
- Users receive in-app alerts for submissions, reviews, revision requests, consultation verifications, discussion replies, and at-risk student identification (instructor-only).
- SLA breach alerts are sent to Admins via in-app and email notifications.
- **Proactive deadline reminders:** A background scanner (`processDeadlineReminders()`) runs hourly alongside the email queue processor and sends tiered reminders (7-day, 3-day, 1-day lead times) to students whose checkpoint due dates are approaching. The scanner uses non-overlapping tier bands (7d: 4–7 days, 3d: 2–3 days, 1d: 0–1 day before due date) to prevent multiple reminders firing simultaneously. Reminders are sent only for checkpoints in `unlocked` or `revise` state (where student action is needed) and skip soft-deleted assignments/users. A `deadline_reminders` dedup table with a unique constraint on `(checkpointId, tier)` ensures at-most-once delivery per tier per checkpoint, even across multiple server instances (`INSERT ... ON CONFLICT DO NOTHING`). The dedup insert and notification creation are wrapped in a single database transaction — if either fails, both roll back, allowing the tier to retry on the next hourly scan. Email dispatch runs post-commit via `Promise.allSettled` (advisory, never throws). Scanner failure is isolated via `try/catch` in the email queue tick loop and does not affect email processing.
- Notification bell in the shared header shows the unread count with 30-second polling (`refetchIntervalInBackground: false` stops polling when the tab is not visible, reducing server load by ~75%). The notification list uses a 30-second `staleTime` to prevent unnecessary refetches on window focus.
- **Notification navigation:** Notifications are clickable links that navigate to the relevant page based on their type and stored `metadata` (assignmentId, checkpointId, submissionId). A `NOTIFICATION_ROUTES` map derives the route client-side (e.g., `review_completed` → `/student/assignments/{assignmentId}/checkpoints/{checkpointId}`, `submission_received` → `/instructor/reviews/{submissionId}`, `student_at_risk` → `/instructor/assignments/{assignmentId}`). Clicking a notification calls `markAsRead` before navigating. If metadata is missing, the item still marks as read but does not navigate.
- **Read/Unread filter:** The notification center has "All" and "Unread" tabs (shadcn/ui `Tabs`). The "Unread" tab filters server-side via `.where(eq(notifications.read, false))`.
- **Load More pagination:** The notification list loads 20 items at a time with a "Load More" button that appends the next page. The button is hidden when all items are loaded.
- Clicking the bell opens a slide-over panel built on the shadcn `Sheet` primitive (provides focus trapping, Escape-key dismissal, and backdrop-click close). Navigable notifications render as TanStack Router `<Link>` elements; non-navigable items fall back to native `<button>` elements. The bell's `aria-label` dynamically includes the unread count and announces changes via an `aria-live="polite"` region.
- Users can mark individual notifications as read or mark all as read.
- **Optimistic UI updates (Track: Optimistic UI Updates for Mutations):** Marking notifications as read (individual or all) updates the UI instantly via TanStack Query's `onMutate` optimistic cache mutation — the unread badge snaps to zero before the server responds. If the server rejects the mutation, the previous state is restored via snapshot rollback (`onError`). Cache invalidation runs in `onSettled` to reconcile with the authoritative server state. The notification list uses TanStack Query's native `useInfiniteQuery` for pagination (TRACK-030), and optimistic mutations operate on the `{ pages, pageParams }` infinite query data shape — the `onMutate` callbacks map over `old.pages` to update items within each page.
- Users can configure per-type, per-channel notification preferences (Email / In-app) in the Settings Hub. 13 notification types are organized into 4 groups (Reviews, Consultations, Submissions, System). All preferences default to enabled (opt-out model). Security-critical emails (password reset, invitations, 2FA) are exempt from preference gating — they are always sent. SLA breach email alerts to admins are also always sent (exempt), but in-app SLA breach notifications can be disabled. Preferences are stored in the existing `users.settings` JSONB column — no separate table needed.

### Two-Factor Authentication & Session Management

- Users can enable TOTP-based two-factor authentication via an authenticator app using Better Auth's built-in `twoFactor` plugin.
- 8 single-use backup codes are generated on enable (shown during setup only — codes are stored encrypted).
- Login prompts for a 6-digit TOTP code when 2FA is enabled.
- Backup codes work as a fallback when the authenticator device is unavailable.
- Users can enable/disable 2FA with current password confirmation.
- Active sessions panel shows device type, IP address, and last activity per session.
- Users can revoke individual sessions or all other sessions at once.
- Email notification sent on 2FA enable/disable. Email subjects are localized via i18n keys using the recipient's `locale` preference (TRACK-034).
- All 2FA and session management actions are logged to the audit log.
- Active sessions are **automatically revoked** when a user is soft-deleted, when their password is reset, or when 2FA is disabled — ensuring security changes take effect immediately across all devices. Session revocation is performed **post-commit** (after the DB transaction succeeds) and wrapped in a try/catch so that a session-revocation failure does not roll back the primary operation — the security state change (e.g. `twoFactorEnabled = false`, `deletedAt` set) is already durable in the database.
- **Session cache tradeoff:** A 5-second TTL in-memory cache (`Map<userId, { role, locale, expiresAt }>`) sits between Better Auth session validation and the DB query in `getSessionHandler` (`src/server/auth.server.ts`). On a cache hit, the DB query for role/locale is skipped, reducing per-page-load query count from 4–6 to 1 per 5s window. **Tradeoff:** role changes and soft-delete checks may take up to 5 seconds to fully propagate for in-flight requests — acceptable for a university system. Session revocation (soft-delete, password reset, 2FA disable) still occurs immediately post-commit; the cache only affects the role/locale DB lookup, not session validity.
- **2FA Disable Transaction Safety:** When a user disables 2FA, the DB operations (set `users.twoFactorEnabled = false` and delete the `two_factor` row) are wrapped in a single `db.transaction`. The Better Auth API call (`auth.api.disableTwoFactor`) is invoked **after** the transaction commits as post-commit advisory work in a try/catch — if the API call fails, the DB state is already durable and the system reconciles on the user's next login by checking the DB flag. This follows the SQL styleguide §6.4 pattern for post-commit advisory work.
- The active sessions list filters out expired sessions automatically.

### HTTP Security Headers (XSS & Clickjacking Defense)

- A **nonce-based Content-Security-Policy (CSP)** defends against XSS — the primary browser-level defense given the app's rich user-generated content (assignment descriptions, review feedback, discussion Q&A). A cryptographic nonce (`crypto.randomBytes(16)` → base64) is generated per request and auto-attached to all inline `<script>` and `<style>` tags during SSR (including the theme-init script for FOUC prevention and TanStack Router's hydration scripts) — no manual nonce injection needed.
- **Report-Only in dev, enforced in prod:** CSP violations are logged (not blocked) in development via `Content-Security-Policy-Report-Only`, then enforced via `Content-Security-Policy` in production. This allows safe rollout without breaking dev workflows.
- **CSP directives:** `default-src 'self'; script-src 'nonce-{nonce}' 'strict-dynamic'; style-src 'self' 'nonce-{nonce}' <Sonner hash>; img-src 'self' data: https:; connect-src 'self' <R2 endpoint> <R2 bucket subdomains>; frame-src 'self' <R2 endpoint> <R2 bucket subdomains>; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src <R2 endpoint> <R2 bucket subdomains>` (or `object-src 'none'` without R2); `upgrade-insecure-requests` (prod only). R2 sources are restricted to the configured endpoint and bucket subdomains for presigned uploads/downloads and PDF previews, and are omitted when R2 is unconfigured.
- **Additional security headers** on all responses: `X-Frame-Options: DENY` (clickjacking), `X-Content-Type-Options: nosniff` (MIME sniffing), `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: geolocation=(), microphone=(), camera=()`. `Strict-Transport-Security: max-age=31536000; includeSubDomains` (HSTS) is set in production only (defense-in-depth behind Traefik TLS termination).
- **CSRF middleware** is explicitly wired (a custom `createStart` entry point disables TanStack Start's auto-installed CSRF middleware), scoped to server-function requests via a `handlerType === 'serverFn'` filter.
- Implemented via a `createStart` instance with a global request middleware (`src/start.ts`) that generates the nonce, sets all headers, and propagates the nonce to the router context; the router reads the nonce via `ssr: { nonce }` so TanStack Start handles auto-attachment.

### Application-Level Rate Limiting on Server Functions

- All 85 authenticated TanStack Start server functions are rate-limited through explicit `serverFnMiddlewares` composition. Better Auth's built-in rate limiting only covers `/api/auth/*` endpoints — application server functions were previously unprotected against abuse (R2 cost exploitation, email queue flooding, data pollution, DB connection exhaustion).
- **4-tier rate limit presets** (`RATE_LIMITS` in `src/lib/rate-limiter.ts`): `presignedUrl` (20/min — R2 cost abuse prevention), `heavyMutation` (10/min — submissions/reviews), `destructive` (5/min — admin-level operations: user CRUD, template CRUD, 2FA, session revocation), `standardRead` (60/min — dashboards, list views, detail views).
- **In-memory sliding window** — Module-level `Map` store keyed by `userId:fnId`; per-user + per-function isolation. The window resets after the configured time elapses. When at max, requests are denied without incrementing the counter (prevents permanent lockout — the user can retry after the window expires).
- **`typedServerFn` extension** — `src/lib/server-fn.ts` exports a type-preserving alias for `createServerFn` and `serverFnMiddlewares(rateLimit?)`, which returns request-ID middleware followed by optional rate limiting. Stubs attach this array explicitly via `.middleware(...)`.
- **Unauthenticated pass-through** — The middleware calls `getSessionFromHeaders()`; if no session exists, the request passes through to `next()` without rate limiting (route guards handle unauthenticated access). This avoids rate-limiting token-based flows like password setup.
- **`RATE_LIMITED` error code** — Added to the `ErrorCode` enum in `src/lib/errors.ts`; mapped to `error.rateLimited` i18n key in `src/lib/toast.ts` ("Too many requests. Please wait a moment and try again." / "Terlalu banyak permintaan. Mohon tunggu sebentar dan coba lagi."). The client renders this as a toast notification via the standard `showErrorToast` pattern.
- **Exempt functions** (no rate limit): `_getSession` (internal session fetch — cascading/infinite-loop concern), `getUnreadCount` / `markRead` / `markAllRead` (high-frequency UX — 30s polling, instant interactions), `completePasswordSetup` (token-based, no session).
- **Single-instance scope** — The in-memory `Map` is sufficient for the current single-instance Coolify deployment. A Redis-backed store is deferred to multi-instance work (TRACK-044+ coordination).
- **No handler changes** — Rate limiting is enforced at the middleware layer before the handler runs. Zero `.server.ts` handler files were modified — all changes are in stub files (`.ts`) and library code.

### Analytics & Reporting

- **Role-based analytics dashboards** (admin + instructor) showing historical trends and metrics that are NOT duplicated on the real-time operational dashboards. URL search params drive the date range (`?range=7d|30d|90d|all`) with optional custom start/end support. Shareable, back/forward-navigable URLs.
  - **Admin analytics** (`/admin/analytics?range=30d`, admin/superadmin only): consultation verification rate (verified/total), deadline breach rate (checkpoints past due and not passed), assignment status distribution by checkpoint state, submission/review volume trends over time, reviews completed count, daily/weekly active users (DAU/WAU), and at-risk student summary (aggregate high/medium/low counts across all active assignments).
  - **Instructor analytics** (`/instructor/analytics?range=30d`, instructor only): reviews completed, average response time (`EXTRACT(EPOCH FROM reviewedAt - uploadedAt)`), SLA breach count (reviews exceeding the 3-day SLA), students supervised, assignments active.
- **Report export:** On-demand CSV export (server function returns a CSV string → client `Blob` download) for the admin user list, audit log (with date filtering), and assignment progress; instructor student-progress and review-history CSVs (with ownership checks). Client-side Excel (`.xlsx`) export via SheetJS on the analytics pages — reuses the existing `xlsx` dependency (no new dependency). CSV cell values are sanitized against formula injection (cells starting with `=`, `+`, `-`, `@`, TAB, or CR are prefixed with `'`).
- **Rubric analytics:** Instructor and admin analytics dashboards include rubric-level metrics — average score per criterion, criterion-level pass/fail rates, cross-instructor criterion performance comparisons, and class-wide weakness identification. CSV/Excel exports include per-student criterion scores (with formula-injection sanitization on both CSV and Excel paths).
- No new database tables — all metrics derive from aggregate queries (`GROUP BY`, `date_trunc`) over existing tables.
- **Grade distribution:** Admin analytics includes a "Grade Distribution" section aggregating letter grade counts (A/B/C/D/F) across all assignments as progress bars. No drill-down to individual students `[v2]`.
- `[v2]` (deferred): PDF export (requires a rendering library), scheduled/recurring report delivery (requires cron infrastructure).

### Gradebook & Final Grade Computation

- **Grade computation engine:** Aggregates rubric-based review scores (from TRACK-020) and pass/fail checkpoint states into weighted final grades with configurable letter grade mapping. A pure function (`computeFinalGrade` in `src/lib/grade-computation.ts`) computes per-checkpoint scores (pass/fail → 100/0; rubric → weighted average of `review_scores` by criterion weight), then derives an overall score via the configured scheme (`equal_weight` = simple average, `custom_weight` = weighted by per-checkpoint custom weights). Letter grades are derived from configurable bounds (default A≥90, B≥80, C≥70, D≥60, F<60). Status: `complete` (all passed), `in_progress` (some passed), `incomplete` (none passed).
- **Grade configuration:** Each assignment has an `assignment_grade_config` row (auto-created on assignment creation, backfilled for pre-existing assignments via migration). Admins configure the grading scheme (`equal_weight`/`custom_weight`), custom per-checkpoint weights (must sum to 100), and letter grade bounds via a "Grade Settings" dialog on the gradebook page. All config changes are audit-logged.
- **Stale weights detection:** If custom weights are stale (don't sum to 100, missing checkpoint entries, or have extra entries for removed checkpoints), computation falls back to `equal_weight` averaging and a warning badge is shown on the grade config summary.
- **Instructor gradebook view:** New route `/instructor/assignments/$id/gradebook` — table view (students × checkpoints → final grade column). Each cell shows numeric score (rubric checkpoints) or pass/fail Badge (non-rubric). Final grade column shows numeric score + letter Badge. Instructors see a read-only config summary at the top. CSV and Excel export buttons. Admins see additional "Grade Settings" and "Recompute All Grades" buttons.
- **Student final grade card:** New component on `/student/assignments/$id` showing the student's final grade (numeric + letter badge) when complete, or current progress score with "in progress" status. Per-checkpoint score breakdown in a collapsible section. Read-only.
- **Cached final grades:** A `final_grades` table caches computed grades per student per assignment. Grades are recomputed automatically when a review is submitted with `pass` decision (post-commit advisory, never affects the review transaction) or manually via the admin "Recompute All Grades" button (wraps all student upserts in a single `db.transaction` for atomicity).
- **CSV/Excel export:** Admin-only gradebook CSV export (student names, per-checkpoint scores, final score, letter grade, status) with CSV formula-injection mitigation. Client-side Excel export via SheetJS with `sanitizeCell`.
- **Grade recomputation trigger:** `submitReviewHandler` post-commit advisory section calls `recomputeStudentGrade` when `decision === 'pass'` (revise doesn't change pass state). Wrapped in try/catch — grade computation failure never surfaces an error for a successful review.

### At-Risk Student Identification & Early Warning

- **Risk scoring engine:** A pure function (`computeStudentRisk` in `src/lib/risk-scoring.ts`) evaluates 5 risk signals per student-checkpoint pair and returns an overall risk level (high/medium/low) with a list of contributing factors. Risk scores are ephemeral — computed on-demand from existing data (checkpoint states, due dates, consultation counts, review decisions, submission timestamps) and never persisted to the database.
- **5 risk signals:**
  1. **Overdue checkpoint** (High, student_inaction): Checkpoint past its due date in `unlocked` or `revise` state.
  2. **Approaching deadline, no submission** (Medium, student_inaction): `unlocked` checkpoint with ≤3 days to deadline and no submissions.
  3. **Insufficient consultations** (Medium, student_inaction): Verified consultations below `minConsultations` with ≤7 days to deadline.
  4. **Repeated revise** (Medium, student_inaction): Checkpoint revised ≥2 times — student is struggling.
  5. **Stalled review** (Low, pending_review): Submission awaiting review beyond 3 days — instructor-side cause.
- **Instructor dashboard widget:** The instructor dashboard displays an at-risk student list sorted by severity (high → medium → low). Each entry shows the student name, assignment title, risk-level Badge (red/orange/yellow), and contributing factor descriptions (i18n-localized via `getRiskFactorText`). An `EmptyState` is shown when no students are at risk.
- **Event-driven alerts:** When an instructor submits a `revise` decision or an SLA breach occurs, the system checks the student's risk level post-commit (advisory — try/catch, never affects the review transaction). If the risk is medium or high, an in-app notification (`student_at_risk` type) and a localized email are dispatched to the instructor via `Promise.allSettled`. A 7-day dedup window via the `notifications` table prevents duplicate alerts for the same student+assignment pair. The deadline reminder scanner also calls the risk alert function for each approaching-deadline reminder.
- **Admin analytics summary:** The admin analytics page displays aggregate at-risk counts (high/medium/low) across all active assignments, with colored Badges and an EmptyState when all counts are zero.
- **Notification routing:** `student_at_risk` notifications are clickable and navigate the instructor to `/instructor/assignments/${assignmentId}`. Added to the `system` group in `GROUP_CONFIGS`.
- **No new database tables or migrations** — all risk computation is derived from existing data. The `student_at_risk` value was added to the `email_queue.templateType` Drizzle text enum (code-only, no `ALTER TYPE`).
- **Limitations:** Risk history/trend tracking, student-facing risk view, automated interventions, and inline at-risk widget actions are deferred to `[v2]`. Factor descriptions in notification params and emails use the risk-scoring module's internal descriptions; full i18n of notification params would require resolving recipient locale server-side.

### File Management

- Files are accessible within assignment and submission context.
- Previously submitted files can be downloaded at any time.
- **File preview:** PDF files show an inline preview in the review detail page. `.docx` files show an inline HTML preview via `mammoth.js` (lazy-loaded via dynamic import, rendered in a sandboxed iframe with `sandbox=""` — no script execution). Files exceeding 10MB show a "file too large for inline preview" message with a download button. Conversion failures fall back to a "Preview not available" card with a `FileText` icon and download button. Other non-PDF/non-DOCX files show the same fallback card.
- **Version history:** The `FileList` component shows all submission versions with a "Latest" badge on the row with the highest version number, making it easy to identify the most recent submission.
- Role-based access control with audit trails.
- **Upload-intent trust boundary:** When a client requests a presigned upload URL, the server creates an `upload_intents` record binding the generated file key to the requesting user, the target checkpoint, the upload purpose (`submission` or `review_feedback`), and an expiry. At submit time, the server verifies the intent (ownership, purpose, expiry, single-use) and performs an R2 `HEAD` request to confirm the actual file size — the client-reported size is never trusted. This prevents cross-user file hijacking, fabricated file keys, and size spoofing.
- **Orphaned R2 object cleanup:** A periodic cleanup scanner (`processOrphanedR2Objects()` in `src/lib/r2-cleanup.ts`) runs every 6 hours as part of the email queue tick loop. It queries `upload_intents` where `consumedAt IS NULL AND expiresAt < now() AND cleanedUpAt IS NULL` (orphaned uploads — the user requested a presigned URL but never submitted), deletes the corresponding R2 objects via `DeleteObjectCommand` in parallel (`Promise.allSettled`), and marks each intent with `cleanedUpAt = now()` on success. Per-object failures leave `cleanedUpAt` null for retry on the next tick. Audit logging via `safeAuditLog` with `actorId: 'system'` for background runs. If R2 is not configured, the scanner is a no-op. Admins can manually trigger cleanup via the "Trigger R2 Cleanup" button on `/admin/email-queue` (bypasses throttle, logs with admin's userId).

### User Management (Admin / SuperAdmin)

- User CRUD with filtering and bulk operations.
- **Optimistic row removal (Track: Optimistic UI Updates for Mutations):** Deleting a user removes the row from the admin user list instantly (before the server confirms). If the server rejects the deletion (e.g., instructor with active assignments), the row reappears with an error toast. The user list is cached via `useQuery` with `initialData` from the route loader, and mutations use the typed `userKeys` factory for reliable cache invalidation.
- Role assignment: SuperAdmin creates Admin; Admin creates Instructor and Student.
- Email-based password setup on account creation.
- **Restore-on-soft-deleted:** When an admin creates or bulk-imports a user whose email matches a soft-deleted account, the existing account is restored (`deletedAt` cleared, name/role updated) and a new invitation email is sent — rather than rejecting the duplicate. This ensures soft-deleted users can be re-invited without manual database intervention.
- **Email Uniqueness Transaction Safety:** When an admin creates or updates a user, the email uniqueness check is performed **inside** a `db.transaction` with a `FOR UPDATE` lock on the matching `users` row, preventing a TOCTOU race where two concurrent create/update requests could both pass the uniqueness check and insert conflicting emails. As a defense-in-depth, PostgreSQL's unique constraint violation (error code `23505`) is also caught and mapped to a clean "Email already in use" error message.
- **Soft-Delete Cleanup (Student):** When an admin soft-deletes a student, all pending consultations and extension requests are automatically rejected with reason "User deleted", and all open upload intents are revoked. These cleanup operations run **inside** the same transaction as the soft-delete, ensuring atomicity — the user is either fully cleaned up and soft-deleted, or nothing changes.
- **Soft-Delete Cleanup (Instructor):** When an admin soft-deletes an instructor, the system **blocks** the deletion if the instructor has any active (non-deleted) assignments. The active-assignments check is performed **inside** the transaction with a `FOR UPDATE` lock on the matching `assignments` rows, preventing a TOCTOU race where a new assignment could be created between the check and the soft-delete. When active assignments exist, the admin is presented with a **Reassignment Dialog** — they must select a replacement instructor for **each** active assignment before the soft-delete proceeds. Reassignment transitions any `under_review` checkpoints back to `submitted` (so the new instructor sees them in their review queue); already-`submitted` checkpoints stay as-is. After all assignments are reassigned (or if none existed), the soft-delete completes and the instructor's active sessions are revoked post-commit.
- **Bulk Import**: Admins can upload `.xlsx` files to create multiple users (columns: `name`, `email`, `role`) or assignment templates (columns: `templateName`, `type`, `checkpointName`, `minConsultations`, `estimatedDuration`). Client-side parsing via SheetJS provides a preview table with validation badges. Server re-validates all rows (role permissions, email uniqueness with restore-on-soft-deleted, row/size limits). Partial success is supported — invalid rows are skipped with per-row error reasons. User rows are inserted via nested savepoints (`SAVEPOINT` per row) within a single outer transaction: duplicate-email conflicts (PostgreSQL `23505`) are caught per-row and skipped without aborting the batch; non-duplicate errors roll back the entire batch. Invitation emails and audit events are dispatched **after** the transaction commits (post-commit advisory work). Template groups are inserted atomically per group via `db.transaction()`. All actions are audit-logged. Bilingual (EN/ID) throughout. Limits: 500 rows / 5 MB per file.

---

### Landing Page

- Public-facing landing page at `/` with 4 sections: Hero (headline, subtitle, CTA → `/auth/login`), Features Grid (2×3 responsive with lucide-react icons), How It Works (3-step flow), and Footer (login link + "About" anchor scrolling to `#how-it-works`, and a dynamic copyright rendered via the `landing.footer.copyright` i18n key with `{year}` interpolation).
- CSS-only decorative elements (gradient blobs, no images).
- All text bilingual via `t()` translation keys (`landing.*` namespace). The footer copyright uses `t('landing.footer.copyright', { year: String(new Date().getFullYear()) })` — no hardcoded year or English text.
- No new dependencies — uses existing Tailwind + lucide-react.
- Responsive: mobile-first with `sm`/`lg` breakpoints.

## UI Requirements

- **Design System**: "Warm Academic" design system with warm neutrals, serif display fonts (Fraunces for headings, DM Sans for body), and semantic color coding. Defined in `docs/UI_REDESIGN.md`.
- **Responsive Design**: Usable on desktop and mobile devices with touch-friendly interactions (320px–1920px viewports). User-facing data-heavy surfaces degrade to card-based layouts on mobile: the instructor `ProgressTable` renders per-student cards below the `sm` breakpoint (`flex sm:hidden` / `hidden sm:block` dual-render), `CheckpointListEditor` checkpoint rows stack with `flex-col sm:flex-row`, and the `AssignmentWizard` surfaces the current step name above the form on mobile. Admin-only tables (users, audit log, bulk-import preview) keep horizontal scroll.
- **Bilingual**: Full English and Indonesian language support. Users can switch via settings or browser preference detection.
- **Role-based Dashboards**: Each role has a dedicated dashboard page (`/student/dashboard`, `/instructor/dashboard`, `/admin/dashboard`) with metric cards (color-coded top borders, tinted icon backgrounds), summary widgets, and quick actions. Users are redirected to their role's dashboard after login.
- **Dedicated Pages**: Complex workflows have full-featured dedicated pages linked from the dashboard.
- **Dark Mode**: Light and dark theme support. System preference detection (`prefers-color-scheme`) with manual toggle. Persisted via `localStorage`. Class strategy: `.dark` on `<html>`.
- **Accessibility**: Keyboard navigation, screen reader support. WCAG 2.1 AA compliance (contrast, focus, ARIA). Touch targets minimum 44×44px. Progress bars expose `role="progressbar"` + value attributes; collapsible sections expose `aria-expanded`/`aria-controls`; decorative timeline elements are `aria-hidden`; icon-only buttons (e.g. file download) have `aria-label`; dates render locale-aware via a shared `formatDate` helper. Every page has exactly one `<main>` landmark with `id="main-content"` and `tabIndex={-1}` — the skip-to-content link targets this element for keyboard focus management (TRACK-037). All interactive content is contained within landmarks — `KeyboardCheatSheet` is rendered inside the `<header>` landmark, and the sonner `<Toaster>` exposes an `aria-label` for screen reader accessibility (TRACK-037). Heading hierarchy follows a logical order with no level skips (h1 → h2 → h3) across all pages (TRACK-037). Automated accessibility scanning is integrated into the E2E test suite via `@axe-core/playwright` — 6 key pages (login, student dashboard, student assignment detail, instructor review detail, admin users, admin templates) are scanned for WCAG 2.1 AA violations. Critical, serious, and moderate violations are gated to zero; the 4 moderate violations (`landmark-one-main`, `skip-link`, `region`, `heading-order`) were remediated in TRACK-037. Minor violations are documented in `docs/a11y-violations.md`.
- **Sidebar Navigation**: Dark navy sidebar (`#1C2333`) with role-specific navigation, active state indicators (blue left border), and user card with logout.
- **Typography**: Fraunces (serif) for display/headings, DM Sans (sans-serif) for body text. Self-hosted font files in `public/fonts/`.
- **Empty States**: Meaningful empty states with 64px icons, dashed borders, headline/description text, and CTA buttons. A `compact` variant is used inside dashboard cards to avoid dominating card height. No list or progress widget renders `null` or bare text when empty — consultation lists, review history, and consultation progress all render the `EmptyState` component.
- **Date Display**: Absolute dates render locale-aware via the shared `formatDate(date, locale, style)` helper (`src/lib/format-date.ts`). Deadline surfaces additionally append a locale-aware relative-time context via `formatRelativeTime` from `src/lib/format.ts` (e.g., "Mar 5, 2026 (in 3 days)" / "5 Mar 2026 (dalam 3 hari)") on checkpoint due dates and student-dashboard upcoming deadlines. SLA badges expose relative time as a `title` tooltip across all variants (On Time / Approaching / Breached). Relative time is applied only where it aids comprehension — not on consultation log or review-history dates.
- **Progress Display**: A shared `Progress` component is used wherever a 0–100% progress bar is rendered (student assignment cards, student dashboard widgets). The label and value display are configurable; the percentage always renders a numeric value followed by `%` (never a bare `%`).
- **Action Feedback**: All user-initiated mutations (create, update, delete, approve, reject, verify, unlock, extend, log consultation, profile/password changes) display a success toast on completion. A `showSuccessToast(message)` helper in `src/lib/toast.ts` mirrors `showErrorToast` for consistency. The global `<Toaster richColors position="top-right" />` in `__root.tsx` renders all toasts — no per-call duration or position overrides. All toast messages are localized via `t('key')` with keys in both `locales/en.json` and `locales/id.json`. No action completes silently.
- **Optimistic UI Updates (Track: Optimistic UI Updates for Mutations):** 9 mutation sites across the app use TanStack Query's `onMutate`/`onError`/`onSettled` pattern to reflect predicted state changes instantly — before the server round-trip completes. This eliminates perceived latency on actions where the predicted state is deterministic (mark-as-read, consultation verify/reject, extension approve/reject, checkpoint unlock/extend, user delete). Mutations whose server response carries computed/derived data the client can't predict (e.g., `submitReview` which unlocks the next checkpoint) keep the standard refetch-on-success flow. A typed query-key factory (`src/lib/query-keys.ts`) provides centralized cache invalidation keys for 10 domains: notifications, consultations, extensions, assignments, users, templates, discussions, settings, gradebook, and feedback snippets. Zero inline string-array query keys remain in `src/**/*.tsx` — the factory pattern is now complete across all client-side data domains. Every optimistic mutation captures a snapshot in `onMutate` and restores it verbatim in `onError` (rollback contract). Feedback-snippet mutations intentionally use explicit pending/success feedback and invalidation rather than optimistic updates because server-returned archive state is authoritative.
- **Loading States**: Route-level loading uses TanStack Router's `pendingComponent` with reusable skeleton components (`DashboardSkeleton`, `TableSkeleton`, `AssignmentDetailSkeleton` in `src/components/skeletons/`) — no blank screens during route transitions. Inline loading states (form submits, profile fetches, verification actions) use the `Loader2` spinner icon from `lucide-react` with `animate-spin`. Side-data loading within pages (e.g. consultations/extensions tabs on the student assignment detail page) uses `Skeleton` placeholders with dedicated loading state flags (`loadingConsultations`, `loadingExtensions`).
- **Error Handling**: Dashboard and page-level data fetches display the actual server error message (`data.error`) rather than a generic localized fallback, matching the `InstructorDashboard` pattern. Side-data `useEffect` fetches are wrapped in try/catch with an inline error banner and retry button (using the `errors.fetchFailed` and `common.refresh` i18n keys). Auto-actions like `openForReview` on the review detail page are wrapped in try/catch — on failure, a `toast.error()` is shown and self-navigation loops are prevented. File upload errors are differentiated: network failures (`TypeError`) show `files.networkError` ("Network error, check your connection"), while server-side non-2xx responses show `files.serverError` ("Server error, try again") — replacing the former generic `files.uploadError` message.
- **Search Debounce & Clear**: All server-side search inputs (user list, student assignments, instructor assignments, audit log) use a custom `useDebouncedCallback` hook (300ms delay) to batch rapid keystrokes into a single server request — typing 9 characters fires 1 query, not 9. Each search input has a conditional X clear button (`lucide-react` `X` icon, `aria-label={t('common.clearSearch')}`) that clears the search immediately (not debounced). Client-side filters (StudentPicker, TemplatePicker) are not debounced — they filter in-memory data with no server fetch.
- **Form Validation**: All user-facing forms (`ConsultationForm`, `ExtensionRequestForm`, `PasswordSection`, `EditUserSheet`) use `react-hook-form` + `zodResolver` with `mode: 'onBlur'` validation and per-field inline errors via `FormMessage`. Zod schemas enforce field-level constraints (required fields, min lengths, password match) and conditional logic (e.g., external consultant name required only when `sessionType === 'external'` via `superRefine`).
- **Upload Progress**: File uploads to R2 use `XMLHttpRequest` (not `fetch`) to enable real-time upload progress tracking via `xhr.upload.onprogress`. The `FileUploader` component displays a determinate `Progress` bar with percentage value when `uploadProgress` is available, falling back to a `Loader2` spinner for browsers that don't support progress events.
- **UI Consistency**: All status indicators, badges, and state colors must use the project's semantic color tokens (`text-success`, `text-warning`, `text-error`, `text-info`, `text-primary`, `text-muted`) and the shared `Badge` component. Literal Tailwind palette classes (e.g. `green-500`, `red-600`, `violet-500`) are not permitted for state styling. Card titles use the sans-serif font; page headings (`h1`–`h2`) use Fraunces. Sidebar active items use a full-width accent background (no left-border indent). Logout hover uses the `destructive` semantic token.
- **Keyboard Shortcuts**: A two-layer shortcut architecture improves instructor productivity: (1) Global shortcuts active on all authenticated pages — `R` refreshes data (`queryClient.invalidateQueries`), `?` toggles a cheat-sheet popover showing all available shortcuts; (2) Review-specific shortcuts active only on the review detail page — `J`/`K` navigate the pending review queue (preloaded on mount, instant navigation without server calls). Shortcuts are disabled when focus is in an input/textarea/contenteditable. The cheat-sheet popover greys out J/K when not on a review page.
- **Route Prefetch**: Sidebar navigation links use `preload="intent"` so hovering a link prefetches the route's data/loader, reducing perceived navigation latency. The router's `defaultPreload` is `false` (opt-in per-link) to avoid over-prefetching on the public landing page.

---

## Data Model (Summary)

Core entities:

- **User** — with role (SuperAdmin, Admin, Instructor, Student) and optional `settings` jsonb column for storing profile, theme, accessibility preferences (e.g., reduced motion), and notification preferences (per-type, per-channel opt-out).
- **AssignmentTemplate** — defines type + ordered checkpoint names.
- **Assignment** — ties template to one or more students + final deadline + title + description.
- **AssignmentGroupMember** `[v2]` — maps students to group assignments.
- **Checkpoint** — one per assignment stage; tracks state, due date, description, and required consultations.
- **Submission** — files uploaded by student per checkpoint (`.docx` or `.pdf`). Append-only log: each resubmission creates a new row with an auto-incremented version number.
- **Review** — instructor decision (pass/revise) + comments + deadline + optional feedback file. For rubric-graded checkpoints, associated `review_scores` store a full denormalized snapshot (criterion title, level label, score, weight, comment).
- **RubricCriterion** — rubric criterion definition (title, description, weight 0–100, order) per template checkpoint. Soft-deleted (`deletedAt`), never hard-deleted.
- **RubricLevel** — qualitative performance level (label, description, score 0–100, order) shared across all criteria in a checkpoint. Soft-deleted (`deletedAt`).
- **ReviewScore** — denormalized snapshot of a criterion score within a review (criterionId, criterionTitle, score, rubricLevelId, levelLabel, weight, comment). Full snapshot so historical reviews are unaffected by later rubric edits.
- **Consultation** — log entry for a student-instructor session tied to a specific checkpoint.
- **CheckpointDiscussion** — lightweight async Q&A message tied to a specific checkpoint. Threaded via `parentMessageId` (self-referencing). Soft-deleted via `deletedAt` (deleted messages render as "[deleted]" placeholder, replies preserved). Denormalized `assignmentId` for efficient instructor queries.
- **Notification** — in-app and/or email event logs.
- **AuditLog** — immutable record of all meaningful system actions (user created/deleted, template CRUD, assignment creation, review decisions, deadline changes, unlock actions, consultation verifications/rejections). Includes actor, action type, entity reference, and JSON details. Implemented with an admin viewer at `/admin/audit-log`.
- **ExtensionRequest** — student-initiated deadline extension request with reason category, proposed duration, and approval/rejection by instructor. Subject to admin-configurable caps (`maxExtensionDays`, `maxTotalExtensions`).
- **DeadlineReminder** — dedup tracking table for proactive deadline reminders. Records `checkpointId`, `studentId`, `tier` (`'7d'`/`'3d'`/`'1d'`), and `sentAt`. Unique constraint on `(checkpointId, tier)` ensures at-most-once delivery per tier per checkpoint across multiple server instances.
- **AssignmentGradeConfig** — per-assignment grade configuration (1:1 with assignments, cascade-deleted). Stores grading scheme (`equal_weight`/`custom_weight`), custom per-checkpoint weights (jsonb, nullable), and letter grade bounds (jsonb, default A≥90/B≥80/C≥70/D≥60). Auto-created on assignment creation; pre-existing assignments backfilled by migration.
- **FinalGrade** — cached computed grade per student per assignment (upserted on recomputation). Stores numeric score (numeric(5,2), nullable), letter grade (text, nullable), status (`complete`/`incomplete`/`in_progress`), and contributing checkpoints breakdown (jsonb). Unique constraint on `(assignmentId, studentId)`. Neither gradebook table uses soft-delete — config is cascade-deleted via FK, final_grades is a cache (upserted, never individually deleted).
