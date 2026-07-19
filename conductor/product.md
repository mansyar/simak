<protect>
# Initial Concept

SIMAK (Sistem Informasi dan Manajemen Akademik) — Help students and instructors track assignment progress through defined checkpoints with structured feedback cycles.

---

# Product Guide: SIMAK

## Project Overview

SIMAK (Sistem Informasi dan Manajemen Akademik) is a web-based academic information and management system designed for universities and schools. It enables instructors to assign structured assignments with sequential checkpoints, allows students to submit work for review, and facilitates structured feedback cycles.

**Landing Page** — Public-facing introductory page at `/` showcasing key features (Sequential Checkpoints, Structured Feedback, Consultation Tracking, Deadline Management, Bilingual Support, Role-Based Access) with How It Works flow and bilingual support. Always visible to both authenticated and unauthenticated users.

## Core Problem

Students and instructors lack a centralized system to:

- Track assignment progress through staged checkpoints
- Provide and receive structured feedback on submissions
- Manage consultation sessions (Kartu Bimbingan)
- Automate deadline enforcement and escalation workflows

## Target Audience

- **Students** — Submit checkpoint work, track progress, log consultations
- **Instructors** — Create assignments, review submissions, verify consultations
- **Admins** — Manage users and assignment templates
- **SuperAdmin** — Seed the system, create Admin accounts

## Core Features

### MVP (v1)

- **Role-based access** — SuperAdmin, Admin, Instructor, Student roles with permission boundaries
- **Invitation-only registration** — No self-signup; accounts are created by admins with email-based password setup
- **Assignment templates** — Admin-defined templates with ordered checkpoint lists
- **Assignment management** — Instructors create assignments from templates, assign to students
- **Sequential checkpoints** — Students complete checkpoints in order; each unlocks only after the previous is passed
- **File submissions** — Upload .docx/.pdf files (max 25MB) to Cloudflare R2 via presigned URLs
- **Review workflow** — Instructors review submissions with Pass/Revise decisions, comments, and optional feedback files
- **Consultation tracking** — Students log sessions; instructors verify; minimum consultation thresholds gate checkpoint unlocks
- **In-app notifications** — Real-time alerts for submissions, reviews, revision requests, and deadline reminders
- **Deadline management** — Auto-locking overdue checkpoints, instructor override, SLA breach escalation (3-day review SLA)
- **Bilingual i18n** — Full English and Indonesian language support
- **Dark mode & responsive UI** — Light/dark themes, mobile-friendly, accessible (WCAG 2.1 AA)
- **Settings Hub** — Unified settings page accessible from all role sidebars with Profile (name editing, avatar upload), Password (inline change form), Security (2FA + Session Management), Appearance (language EN/ID, theme light/dark), and Accessibility (reduced motion toggle); persisted via `users.settings` jsonb

## Success Metrics

- Instructors can complete the full assignment lifecycle: create → assign → review → provide feedback
- Students can navigate checkpoints sequentially with clear visibility of requirements and progress
- Consultation verification integrates seamlessly into the review gating logic
- Users can switch between English and Indonesian without friction

## Design Principles

- **Progressive disclosure** — Show students only the information they need at each stage
- **Trust but verify** — Students log consultations; instructors verify; gating respects verified counts only
- **Fair deadlines** — Late instructor reviews automatically extend student deadlines by the breach duration
- **Sequential by design** — Checkpoints enforce ordered completion; no skipping ahead

---

## Completed Tracks

### Track 1.1: Comprehensive Audit Log (May 2026)

- **audit_log database table** — Serial PK, actor_id FK→users, action, entity_type, entity_id, details (jsonb), created_at with indexes on (created_at DESC), (action), (entity_type, entity_id)
- **DB migration** — Generated with Drizzle Kit, applied to dev database
- **logAuditEvent helper** (`src/lib/audit.ts`) — Single-import helper used across all handlers to write to audit_log
- **Handler wiring** — All handlers log audit events: user.created/deleted, template.created/updated/deleted, assignment.created, review.passed/revised, consultation.verified/rejected
- **Server functions** — `listAuditLogs` (paginated with filters) and `getAuditLogDetail` in `src/server/audit-logs.ts` and `audit-logs.server.ts`
- **Admin audit log viewer** (`/admin/audit-log`) — Paginated table with Timestamp, Action badge, Actor, Entity Type, Entity ID, expandable Details JSON; filters by action type dropdown, date range pickers, free-text search
- **Sidebar link** — 'Audit Log' link with ScrollText icon in admin sidebar
- **i18n translations** — Full English and Indonesian translations for audit log UI including action type labels
- **Tests** — Server handler tests and route component tests

### Track 1.3: Authentication & Authorization (May 2026)

- **Better-Auth integration** with Drizzle ORM adapter and PostgreSQL-backed sessions
- **Email/password authentication** with session management via HTTP-only cookies
- **Route guard system** — `_authenticated` and `_unauthenticated` pathless layouts with SSR-based session validation
- **Login page** (`/auth/login`) — Email/password form with inline error handling
- **Dashboard stub** (`/dashboard`) — Role-aware greeting with navigation links and logout
- **Password reset flow** — Forgot password (`/auth/forgot-password`) and reset password (`/auth/reset-password?token=xxx`) pages
- **Password setup flow** (`/auth/setup-password`) — Token-based initial password setup for invitation flow
- **Email integration** — Resend-powered password reset emails with SIMAK-branded HTML templates
- **SuperAdmin seed** — Script creates user with hashed password in the `account` table
- **Translation keys** added for auth and dashboard strings in both EN and ID locales

### Track 2.1: User Management (Admin) (May 2026)

- **Admin sidebar layout** — Pathless `_admin` layout with role guard (`requireRole(['superadmin', 'admin'])`) and sidebar navigation
- **User list page** (`/admin/users`) — Paginated table with search by name/email, role filter, and delete confirmation
- **Create user dialog** — Dialog-based form with Name, Email, and Role fields (Admin/Instructor/Student); sends invitation email via Resend
- **Edit user sheet** — Slide-in panel for editing Name and Email (role is never editable)
- **Server-side CRUD** — `createServerFn`-based functions: `listUsers`, `createUser`, `updateUser`, `deleteUser`, `getUser`, `generateSetupLink`
- **Invitation email flow** — `sendInvitationEmail` with SIMAK-branded "Welcome" template (separate from password reset)
- **Custom password setup** — Token-based setup-password handler that validates UUID tokens against the `verification` table
- **Soft-delete** — Users are soft-deleted (`deletedAt`), excluded from list queries, and excluded from email uniqueness checks
- **Role-based creation rules** — SuperAdmin can create Admin accounts; Admin can only create Instructor/Student
- **i18n translations** — Full English and Indonesian translations for admin sidebar, user table, forms, and messages
- **Language switcher** — EN/ID toggle in the top-right of admin pages and dashboard
- **Test user seeding** — `seedTestUsers()` creates Instructor and Student accounts with configurable password

### Track 2.2: Assignment Templates (Admin) (May 2026)

- **Template management page** (`/admin/templates`) — Card-based list with search by name, type filter dropdown, pagination (20/page), and loading skeleton states
- **Create template dialog** — Dialog with Name (text), Type (free-text), and dynamic checkpoint list (add/remove/reorder via ▲/▼ buttons); defaults to 3 checkpoint rows
- **Edit template route** — Dedicated `/admin/templates/$templateId` page with full template editor (metadata, checkpoints, linked assignments, delete)
- **Server-side CRUD** — `createServerFn`-based functions: `createTemplate`, `listTemplates`, `getTemplate`, `updateTemplate`, `deleteTemplate`, `duplicateTemplate`
- **Checkpoint management** — Dynamic list with add, remove (min 1 enforced), and ▲/▼ reorder buttons; order persists via sequential `order` column
- **Soft-delete with usage check** — Templates are soft-deleted (`deletedAt`); deletion blocked with count if active assignments reference it (requires typing "DELETE")
- **Template duplication** — Duplicates template + all checkpoints with "(Copy)" suffix (supports smart naming for multiple copies)
- **In-use banner** — Edit sheet shows warning banner with assignment count if template is in use by active assignments
- **Zod validation** — Client + server validation: name required, type required, min 1 checkpoint, no empty checkpoint names
- **i18n translations** — Full English and Indonesian translations for template management UI, form labels, messages, and error states

### Track 3.1: Assignment Creation (Instructor) (May 2026)

- **Instructor Assignments listing page** (`/instructor/assignments`) — Paginated card-based or list view of assignments created by the instructor with title search, key metadata, and responsive skeleton states.
- **Assignment Creation Wizard** (`/instructor/assignments/new`) — Multi-step visual form (Select Template -> Fill Details -> Select Students -> Confirm) using `React Hook Form` and Zod resolver for input validations.
- **Template and Student selection** — Smart `TemplatePicker` with checkpoint previews and `StudentPicker` searchable multi-select combobox.
- **Sequential checkpoint copy/instantiation** — Server-side transaction in `createAssignment` that instantiates assignment-student mappings and copies checkpoints, initializing the first checkpoint as `unlocked` and subsequent ones as `locked`.
- **Assignment Detail & Progress dashboard** (`/instructor/assignments/$id`) — Interactive progress-table displaying student checkpoint statuses (Passed, Submitted, Under Review, Revise, Unlocked, Locked) and completion percentages.
- **i18n translations** — Full English and Indonesian translations for wizard steps, forms, progress badges, error validation alerts, and dashboard states.

### Track 3.2: Student Assignment Viewing (May 2026)

- **Student sidebar layout** — Pathless `_student` layout with `requireRole(['student'])` guard and sidebar navigation (Dashboard, Assignments)
- **Server functions** — `listStudentAssignments` (paginated, searchable) and `getStudentAssignmentDetail` (ownership-verified with consultation counts via LEFT JOIN)
- **Assignment list page** (`/student/assignments`) — Card-based list with search by title, pagination (20/page), animated skeleton loading, and empty state
- **Assignment detail page** (`/student/assignments/$id`) — SSR-rendered detail with instructor name, header metadata, and vertical checkpoint timeline
- **Checkpoint timeline** — Ordered checkpoint cards with 6 state badges (Passed/Submitted/Under Review/Revise/Unlocked/Locked) with semantic colors
- **Blocking reasons** — Locked checkpoints display reasons: previous checkpoint not passed, insufficient verified consultations (X/Y)
- **Overdue indicators** — Past-due checkpoints shown with red text and overdue badge
- **Consultation progress** — Verified consultation count displayed per checkpoint alongside required minimum
- **Ownership guard** — Students cannot view other students' assignments; invalid IDs show not-found state
- **i18n translations** — Full English and Indonesian translations for sidebar, assignments list, detail page, and status badges

### Track 4.1: File Upload & Submission (Student) (May 2026)

- **R2 Storage Client** — `src/lib/storage.ts` with singleton S3 client, UUID-based file key generation (`submissions/{uuid}.{ext}`), presigned PUT URLs (5min) and GET URLs (1hr), and dev fallback mock
- **R2 SDK** — `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` for Cloudflare R2 presigned URL generation
- **Submission server functions** — `submitCheckpoint` (validates unlocked/revise state, enforces ownership, auto-increments version, transitions to `submitted`), `listSubmissions` (version history, newest first), `getSubmissionDetail` (single record with download URL)
- **File server functions** — `getPresignedUploadUrl` (validates checkpoint state, generates UUID key, returns `{ uploadUrl, fileKey }`), `getPresignedDownloadUrl` (ownership-validated GET URL)
- **CheckpointCard wiring** — Submit/Resubmit buttons and View Submission link integrated into the checkpoint timeline with `useNavigate` navigation
- **Submission route page** (`/student/assignments/$id/checkpoints/$checkpointId`) — Full upload flow: presigned URL → direct-to-R2 upload → `submitCheckpoint` call, with FileUploader, FileList (version history table), and SubmissionStatus (review result display)
- **FileUploader component** — Drag-and-drop zone with click-to-browse fallback, .docx/.pdf validation, 25MB size limit, upload progress indicator, success/error states with retry
- **FileList component** — Version history table with file name, size, upload date, and download buttons
- **SubmissionStatus component** — Review result card showing pass/revise badge, reviewer info, comment, and revision deadline
- **Ownership guard** — All server functions verify student ownership via `assignmentStudents` join before allowing access
- **i18n translations** — Full English and Indonesian translations for file upload UI, validation messages, and submission history

### Track 5.1: Review Queue & Decision (May 2026)

- **Review queue page** (`/instructor/reviews`) — Paginated FIFO list of pending submissions across instructor's assignments with assignment filter, wait time display, and SLA badges (Not Reviewed / On Time / Approaching SLA / SLA Breached)
- **Review detail page** (`/instructor/reviews/$submissionId`) — File preview (PDF inline embed, DOCX metadata + download), review history timeline, and decision form
- **Review decision form** — Pass/Revise radio buttons, comment textarea, optional feedback file upload (`.pdf`/`.docx` via presigned URLs to R2 with `feedback/` key prefix), conditional revision deadline picker
- **`openForReview` POST action** — Explicitly transitions checkpoint from `submitted` to `under_review` on detail page load (keeps GET handlers pure)
- **`submitReview`** — Validates ownership and state, records review in DB, transitions checkpoint: `pass` → unlocks next checkpoint, `revise` → sets revision deadline
- **Server functions** — `listPendingReviews` (DISTINCT ON per-checkpoint), `getReviewDetail`, `openForReview`, `submitReview`, `getLatestReview` (student-side)
- **Database indexes** — `assignments_instructor_id_idx` and `checkpoints_state_assignment_id_idx` for review queue query performance
- **Student page wiring** — Student submission page fetches real review data via `getLatestReview`, replacing the `null` stub
- **i18n translations** — Full English and Indonesian translations for review queue, detail page, decision form, and SLA badges

### Track 6.1: Consultation Logging & Verification (May 2026)

- **Consultation CRUD server functions** — 7 server functions (`logConsultation`, `listConsultations`, `listPendingConsultations`, `verifyConsultation`, `rejectConsultation`, `getConsultationDetail`, `listVerifiedCounts`) with role-based access (student for logging, instructor for verification)
- **Student consultation UI** — Tab on `/student/assignments/$id` with ConsultationForm (checkpoint selector, session type internal/external, notes), ConsultationList (status badges: pending/verified/rejected), and ConsultationProgress (X/Y verified progress bars per checkpoint + summary)
- **Instructor verification UI** — Tab on `/instructor/assignments/$id` with VerificationQueueItem (pending queue, FIFO order, count badge) and VerificationDialog (full detail display, verify/reject actions with reason input)
- **Submission gating** — `submitCheckpointHandler` checks `verified consultations >= minConsultations` before allowing submission; returns descriptive error if insufficient
- **Unlock gating** — `submitReviewHandler` checks consultation requirements before unlocking next checkpoint; keeps locked if insufficient verified consultations
- **In-app notifications** — `consultation_logged` → instructor, `consultation_verified` → student, `consultation_rejected` → student with reason
- **Template minConsultations** — Added `min_consultations` (integer, default 0) to `template_checkpoints` table; CheckpointListEditor now includes number input per checkpoint row; `createAssignmentHandler` copies from template
- **i18n translations** — Full English and Indonesian translations for consultation UI (form, list, progress, verification dialog, status badges, gating error messages)
- **Database migration** — New column `min_consultations` on `template_checkpoints` with migration `0003_consultation_min_consultations.sql`

### Track 5.2: Escalation & Deadline Management (May 2026)

- **SLA breach detection** — `submitReview` handler calculates breach duration after the 3-day SLA; triggers notifications and deadline adjustments
- **Automatic deadline adjustment** — Late reviews extend affected + subsequent checkpoint `dueDate` values by breach duration (per-student only; `finalDeadline` is immutable per Track 10)
- **Admin notifications** — `sla_breach` in-app + email notifications (via Resend) sent to all Admins
- **Manual checkpoint unlock** — Server function transitions `locked` → `unlocked` regardless of blocking reasons; instructor-only, ownership-verified
- **Manual deadline extension** — Server function updates any checkpoint's `dueDate`; no state restriction; instructor-only, ownership-verified
- **DeadlineManager UI** — Collapsible per-student section on `/instructor/assignments/$id` with Unlock button (confirmation dialog) and Extend Deadline date picker
- **TanStack Query mutations** — `unlockCheckpoint` and `extendDeadline` via `useMutation` with loading and error states
- **i18n translations** — Full English and Indonesian translations for the Deadline Manager UI

### Track 7.1: In-App Notification System (May 2026)

- **Server functions** — `markRead`, `markAllRead`, `getUnreadCount` with Zod schemas, client-safe stubs, and server-only handlers
- **Event trigger integration** — `submitCheckpointHandler` creates `submission_received` notification for the instructor; `submitReviewHandler` creates `review_completed` (pass) and `revision_requested` (revise) notifications for the student
- **Consultation & SLA notifications** — `consultation_verified` and `sla_breach` notifications were already implemented in prior tracks; no changes needed
- **TanStack Query hooks** — `useUnreadCount` with 15-second polling interval, `useNotificationsList` with pagination and optional type filter, `useMarkRead` and `useMarkAllRead` mutations with query key invalidation
- **NotificationBadge component** — Bell/BellDot icon in the shared `_authenticated` layout header; red badge with unread count (auto-hides at zero); click-to-open panel trigger
- **NotificationItem component** — Type-based icon (lucide-react), title + message (truncated to 2 lines), relative timestamp via `date-fns`, read/unread visual distinction (bold vs normal text, blue dot)
- **NotificationCenter component** — Slide-over panel from the right with type-grouped sections, "Mark all read" action, empty state ("No notifications yet"), load-more pagination on scroll
- **i18n translations** — Full English and Indonesian translations for notification UI (20+ keys across labels, titles, messages, and empty states)
- **Polling behavior** — Single 15-second interval for unread count (simplified from original differentiated priority intervals); sufficient for expected notification volume

### Track 7.2: Role-Based Dashboards (May 2026)

- **Server functions** — `getStudentDashboardData`, `getInstructorDashboardData`, `getAdminDashboardData` with per-role handlers, Zod schemas, and session-based role verification
- **Student dashboard** (`/student/dashboard`) — 4 widgets: Active Assignments (progress bars), Upcoming Deadlines (color-coded urgency, overdue badges), Pending Reviews (wait times), Consultation Reminders (pending badges)
- **Instructor dashboard** (`/instructor/dashboard`) — 4 widgets: Pending Review Queue (SLA badges: On Time/Approaching/Breached), Recent Submissions (status badges), Assignment Overview (student count, progress), Quick Actions (CTA links)
- **Admin dashboard** (`/admin/dashboard`) — 4 widgets: System Metrics (6 metric cards), Recent Activity Feed (last 10 events, 7 day window), Deadline Escalation Alerts (red styling for >3 days overdue), Quick Actions (CTA links)
- **Route redirects** — Login and `_unauthenticated` redirect to role-specific dashboards; `requireRole` redirects unauthorized users to their own dashboard; old `/dashboard` route removed
- **Sidebar improvements** — Full viewport height (sticky, non-scrollable), logout button at bottom with hover-red styling, icons added to admin sidebar, all links updated to role-specific dashboard routes
- **i18n translations** — Full English and Indonesian translations (studentDashboard: 14 keys, instructorDashboard: 14 keys, adminDashboard: 18 keys)

### Track 4.1: Background Email Queue with Retry (May 2026)

- **`email_queue` database table** — Serial PK, 7 data columns (recipient_email, subject, body_html, template_type with CHECK constraint, status, attempts, error_message), timestamps (last_attempt_at, created_at); composite index on (status, created_at ASC)
- **DB Migration** — Manually written `0007_email_queue.sql` (drizzle-kit generate unavailable due to stale snapshot state)
- **Enqueue helpers** — New `enqueueEmail()` inserts into email_queue; all 3 send functions (`sendPasswordResetEmail`, `sendInvitationEmail`, `sendSLAAlertEmail`) refactored to enqueue instead of calling Resend directly; `getResend()` singleton removed
- **Background processor** — In-process setInterval every 30s that dequeues up to 10 pending emails per cycle and sends via Resend with exponential backoff (0s/30s/5min/30min); after 3 failures marks as `failed` with stored error message
- **Auto-start wiring** — Processor auto-started via `import.meta.env.SSR` guard in `src/router.tsx`; supports graceful `clearInterval` on shutdown
- **Admin dashboard widget** — Email Queue card with 3 stat boxes: Pending (blue/Mail), Sent (green/MailCheck), Failed (red/MailX); counts via FILTER query in existing dashboard handler
- **i18n translations** — `adminDashboard.emailQueue.{pending,sent,failed}` in EN and ID locales
- **Tests** — Schema tests, enqueue mock tests, processor tests (9 tests), admin handler + component rendering tests

### Track 3.1: Two-Factor Authentication & Session Management (May 2026)

- **TOTP-based 2FA** — Users enable 2FA via authenticator app (QR code scanning)
- **Backup codes** — 8 single-use cryptographically random codes
- **2FA login flow** — Dedicated 2FA page; TOTP input; backup code fallback
- **Disable 2FA** — Password confirmation required
- **Session management** — Active sessions list with device, IP, timestamp
- **Session revocation** — Revoke specific or all other sessions
- **Email notifications** — Sent on 2FA enable/disable
- **Settings page** (`/settings`) — 2FA and session management cards
- **Audit logging** — All 2FA and session actions logged
- **i18n** — Full EN and ID translations
- **Tests** — Server handler, component, i18n codegen tests

### Track 1.3: Deadline Extension Workflow (May 2026)

- **New `extension_requests` database table** — Tracks student-submitted extension requests with category (personal/research/health/other), reason, duration, status (pending/approved/rejected), and resolution metadata
- **DB migration** — Generated with Drizzle Kit, applied to dev database
- **Student-initiated extension flow** — Students submit requests with category, reason (min 10 chars), and duration (1–max_extension_days); capped by per-assignment `maxExtensionDays` (1–30, default 7) and `maxTotalExtensions` (1–10, default 3)
- **Instructor approval/rejection queue** — FIFO pending requests list per assignment with Approve (optional comment) and Reject (required reason, min 20 chars) actions
- **Auto-deadline adjustment on approval** — Extends affected checkpoint + subsequent checkpoints `dueDate` values (per-student only; `finalDeadline` is immutable per Track 10)
- **Instructor-initiated bulk extension** — Directly extends all unfinished checkpoints for a student by +N days with reason
- **Audit log integration** — `deadline.extension_approved`, `deadline.extension_rejected`, `deadline.extended`, and `checkpoint.unlocked` audit events
- **In-app notifications** — `extension_requested` → instructor, `extension_approved`/`extension_rejected` → student
- **Student extension history** — Table on assignment detail page showing past requests with status badges (pending/approved/rejected)
- **i18n translations** — Full English and Indonesian translations for extension request form, instructor queue, approval/rejection dialogs, and notification titles
- **Server handler tests** — Unit tests for request, list, approve, reject, bulk, and audit log wiring handlers
- **UI component tests** — Unit tests for student request form, history list, instructor queue section, and approval/rejection dialogs

### Track 6.4: UI Consistency for Instructor-Facing UI (June 2026)

- **6 new shared primitives** — `Textarea`, `PageHeader`, `BackLink`, `TemplateTypeBadge`, `CountBadge`, `formatDate` helpers; `EmptyState.description` made optional
- **4 functional bug fixes** — populated the review-queue assignment filter dropdown, unified the local `SLABadge` with the shared component, split the duplicated `instructorAssignments.details.studentsProgress` i18n key, removed dead colSpan branch and redundant guard
- **10 instructor-surface migrations to primitives** — 7 instructor pages now use `PageHeader`; back-links, template-type pills, textareas, skeletons, `Select`, `Card`, `MetricCard`, `EmptyState`, `formatDate*` helpers, and `CountBadge` all unified
- **Design tokens + i18n cleanup** — hardcoded Tailwind palette colors replaced with `text-success`/`text-warning`/Badge variants; 9 `AssignmentWizard` validation messages, 2 `ReviewForm` upload errors, pagination page-of-total label, and `ReviewHistory` labelled date all translated EN+ID
- **Split 446-line assignment detail page** into thin route + 5 subcomponents (`AssignmentDetailHeader`, `AssignmentOverviewTab`, `AssignmentConsultationsTab`, `AssignmentExtensionsTab`, `AssignmentDetailTabs`); route file is now 100 lines (spec required ≤120)
- **Deduplicated pagination** — extracted shared `<Pagination>` primitive; deleted `TemplatePagination` and `ReviewQueuePagination`; admin templates + instructor reviews + assignments all use the shared primitive
- **Extracted `<RefreshButton>` and `useRefreshSearch` hook** — adopted in 2 sites; removes fake `setTimeout` hack
- **Systemic type fix** — root cause identified: `createServerFn({ method }).handler(async (args: { data: unknown }) => ...)` drops the input type because `TInputValidator` defaults to `undefined`. Applied `.inputValidator(Schema)` builder pattern across 20 server functions in the instructor scope; all 4 `@ts-expect-error` directives removed from instructor route loaders
- **Created `useAssignmentTabs` hook** — extracted consultation + extension loading logic out of the assignment detail page to meet the ≤120 line constraint
- **i18n translations** — 18+ new translation keys added in EN and ID, including `instructorAssignments.details.totalStudents`, `extensions.queue.reason`, `instructorAssignments.wizard.errors.*`, and the `common.pagination.pageOf` interpolator
- **Test coverage** — new unit tests for every primitive, i18n regression test, and 44 test-file mock updates to support the new `.inputValidator()` server-fn pattern
- **All 1913 tests pass, typecheck and lint clean, coverage thresholds met** (84.94% lines, 84.28% statements, 80.86% branches, 80% functions)

### Track 8: Audit Remediation — i18n, Type Safety, and Hygiene (June 2026)

- **Notification i18n architecture** — Notifications table stores `titleKey`/`messageKey` (varchar) and `params` (jsonb); localized title and message are resolved at read-time using the recipient user's locale; schema migrated via an expand-contract pattern with legacy `title`/`message` columns backfilled and dropped.
- **Localized email subjects** — Password reset, invitation, and SLA alert email subjects are resolved from i18n keys using the recipient or admin locale via a shared server-side i18n helper.
- **Server boundary type contracts** — Explicit return types on client-crossing server handlers (`getInstructorDashboardData`, `listInstructorAssignments`, `getAssignmentDetail`, `listPendingConsultations`, `completePasswordSetup`) serialize `Date` fields to ISO strings; removed TODO/FIXME casts and a `@ts-expect-error` workaround in the password setup route.
- **Dead i18n key cleanup** — Removed 69 unused locale keys and added `pnpm check:i18n:unused` to the pre-push gate.
- **Client fetch error handling** — Replaced silent `console.error` catch blocks with `toast.error(t('errors.fetchFailed'))` for user-visible fetch-failure diagnostics.

### Track 9: Audit HIGH-Remediation (H1, H2, H3 + L1) (June 2026)

- **Upload-intent deduplication** — New `upload_intents` table records `(userId, checkpointId, fileType)` with `usedAt` to prevent duplicate presigned-URL abuse; schema migration with unique partial index excluding used rows; `getPresignedUploadUrlHandler` inserts/returns the existing unused intent or creates a new one; integration test verifies concurrent callers cannot obtain two active intents.
- **SLA anchoring fix** — `submitReview` `underReviewAt` is now anchored to `submissions.uploadedAt` so breach calculation is consistent across checkpoint state transitions and preserves deadline-extension semantics.
- **Review state error accuracy** — `openForReview` rejection now returns `instructorReviews.errors.notInSubmittedState` via server-side i18n translation instead of a stale hardcoded `'submittable state'` message.
- **Soft-delete restore on user creation** — Bulk import and single `createUser` now restore previously soft-deleted users by clearing `deletedAt` and overwriting `name`/`role`; active duplicates are skipped with per-row `results`; unique-violation races are caught per-row and do not abort the entire batch, while non-23505 errors roll back the whole batch.
- **Audit event fidelity** — Per-row `user.created`/`user.reactivated` events plus a single `user.bulk_created` batch audit event for bulk import.
- **i18n keys** — Added server-resolved keys for review state errors and bulk-import result statuses; regenerated types and updated whitelist.

### Track 10: Per-Student Deadline Isolation (July 2026)

- **Bug fixed:** `assignments.finalDeadline` is no longer mutated by per-student extension approvals, bulk extensions, or SLA-breach adjustments. These operations now only update the target student's checkpoint `dueDate` values.
- **Per-student effective deadline** — Reader views derive each student's personal deadline from the `dueDate` of their first non-passed checkpoint in the assignment (or the last checkpoint's dueDate if all are passed), via a shared `computeEffectiveDeadline` helper.
- **Server handlers updated** — `listStudentAssignments`, `getStudentAssignmentDetail`, `getStudentDashboardData`, and `getAssignmentDetail` (instructor) now return `effectiveDeadline` alongside the immutable course-wide `finalDeadline`.
- **Frontend components updated** — `StudentAssignmentCard`, `AssignmentDetailHeader`, `StudentDashboard`, and `AssignmentOverviewTab` display the per-student effective deadline; the instructor Overview tab shows both the course-wide final deadline and a per-student effective deadline column.
- **i18n translations** — New English and Indonesian keys for personal/effective deadline labels.
- **Tests** — Failing tests asserted the new behavior first; full unit suite passes (2,373 tests), coverage thresholds met.

### Track 11: Secure Password-Setup Token Consumption (July 2026)

- **Bug fixed (security):** Eliminated a non-atomic check-then-act race condition in `completePasswordSetupHandler` (`src/server/setup-password.ts`). The former flow performed a SELECT to validate the token, then later DELETEd it at the end of the transaction — a TOCTOU window where concurrent requests could replay the same token before deletion.
- **Atomic `DELETE ... RETURNING`** — The token is now consumed via `DELETE FROM verification WHERE value = ? AND expiresAt > now() RETURNING *` as the **first statement** inside `db.transaction()`. This makes validation and consumption a single atomic step: zero rows returned means the token was already used, expired, or invalid.
- **Transaction integrity** — User lookup, password upsert, and `emailVerified` update all run inside the same transaction. If any downstream step fails (e.g. user not found), the transaction rolls back and the token is restored. Password hashing (scrypt) is performed **outside** the transaction so a hashing failure does not consume the token.
- **No information leakage** — A generic "Invalid or expired token" error is returned for all failure cases (consumed, expired, invalid, or user-not-found). The former "User not found" error was changed to a thrown error that surfaces as "Internal Server Error".
- **Tests** — New integration test (`concurrent-token-replay.test.ts`) with 4 tests: concurrent replay protection, expired token rejection, user-lookup rollback, and sequential consumption. Updated 2 unit test files for the new transaction-scoped mock flow. Full suite: 2,374 tests pass, coverage ≥80% on all thresholds.

### Track 12: Atomic Checkpoint State Transitions in Review Handlers (July 2026)

- **Bug fixed (data integrity):** Eliminated non-atomic check-then-act race conditions in `submitCheckpointHandler`, `openForReviewHandler`, and `submitReviewHandler` where the checkpoint state was read outside (or without a row lock inside) the mutation transaction.
- **SELECT ... FOR UPDATE** — All checkpoint reads that guard state transitions now happen inside their respective transactions using `.for('update')`, with state re-validated after the lock is acquired.
- **Handlers updated** — `src/server/submissions.server.ts` (`submitCheckpoint`), `src/server/reviews-extras.server.ts` (`openForReview`), and `src/server/reviews.server.ts` (`submitReview`).
- **Consistent concurrency behavior** — Concurrent submissions/reviews on the same checkpoint now serialize safely: one succeeds, the others receive descriptive stale-state errors and make no mutations.
- **No new i18n keys** — Reused existing `notInSubmittedState`, `'Checkpoint is not in a submittable state'`, and `'Checkpoint is not in a reviewable state'` messages.
- **Tests** — Updated unit-test mocks for the new in-transaction locked-read flow, added stale-state assertions, and added integration tests (`tests/integration/server/reviews-concurrency.test.ts`) verifying concurrent `submitReview`, late `openForReview`, and concurrent `submitCheckpoint` scenarios. Full suite: 2,377 tests pass; coverage ≥80%.

### Track 13: Concurrency & Transaction Safety (July 2026)

- **Bug fixed (data integrity):** Eliminated TOCTOU (time-of-check-to-time-of-use) race conditions in 10 server handlers across consultations, extensions, 2FA, and user management. All state-transition handlers now perform SELECT + status check inside `db.transaction` with `FOR UPDATE` row locking and post-lock state re-validation.
- **Consultation handlers** (BUG-1, BUG-17) — `verifyConsultationHandler` and `rejectConsultationHandler` moved SELECT inside transaction with FOR UPDATE; stale-state returns 'already processed' error.
- **Extension handlers** (BUG-2, BUG-5, BUG-6, BUG-7) — `approveExtensionHandler`, `rejectExtensionHandler`, `requestExtensionHandler`, and `calculateExtensionAdjustment` all use FOR UPDATE row locking inside transactions.
- **2FA & user handlers** (BUG-8, BUG-13, BUG-22) — `disableTwoFactorHandler` uses DB-first in transaction then auth API; `generateSetupLinkHandler` wraps DELETE+INSERT in transaction; `createUserHandler` and `updateUserHandler` use FOR UPDATE on email uniqueness check + catch PG error 23505.
- **Soft-delete cleanup** (BUG-9) — `deleteUserHandler` now auto-rejects pending consultations and extension requests (with 'User deleted' reason), revokes open upload intents for students, and blocks instructor deletion if they have active assignments.
- **New `reassignAssignment` server function** (FR-4.3, FR-4.5) — Admin-only, validates assignment exists + is active, validates replacement instructor is active instructor, updates `assignments.instructorId`, transitions `under_review` checkpoints back to `submitted`.
- **New `ReassignmentDialog` UI component** (FR-4.4) — Dialog with assignment list, instructor picker dropdown, and block-until-all-reassigned logic; wired into admin user management delete flow.
- **New `listInstructorActiveAssignments` server function** — Admin-only, returns active assignments for a given instructor (used by reassignment dialog).
- **i18n keys** — New EN/ID translations for reassignment dialog labels, instructor picker, and block error.
- **Tests** — 2,399 tests pass across 261 test files; coverage ≥80% on all thresholds (stmts 87.63%, branches 81.04%, functions 81.38%, lines 88.3%).

### Track: Deadline & SLA Logic Correctness (July 2026)

- **8 logic correctness bugs fixed** across the deadline and SLA subsystem: BUG-3, BUG-11, BUG-12, BUG-16, BUG-18, BUG-19, BUG-21, BUG-28.
- **Stale docstrings** — Updated `calculateExtensionAdjustment`, `adjustDeadlinesForBreach`, and `bulkExtendHandler` docstrings to remove false claims of extending `finalDeadline` (immutable per Track 10).
- **SQL arithmetic fix** — Admin dashboard `daysOverdue` now uses `EXTRACT(EPOCH FROM ... ) / 86400` instead of `extract(day from ...)` which wrapped at ~30 days.
- **finalDeadline cap at creation** — `validateDueDates` now optionally rejects checkpoint dueDates exceeding `finalDeadline` when provided (enforced only at assignment creation, not during per-student extensions).
- **extendDeadlineHandler validation** — Added future-date and sequential-ordering validation; does NOT modify `finalDeadline`.
- **Student dashboard fixes** — `upcomingDeadlines` now excludes `passed` checkpoints; null `dueDate` handled as "No deadline" with `isOverdue=false`.
- **Notification cleanup** — Removed dead `channel: 'email'` notification rows from `dispatchSLABreachNotifications` (actual email goes via `sendSLAAlertEmail` through the email queue).
- **effectiveDeadline derivation** — Changed from highest-order checkpoint's `dueDate` to first non-passed checkpoint's `dueDate` via shared `computeEffectiveDeadline` helper.
- **SLA docstring/param** — Updated `calculateBreachDuration` docstring to "from submission upload time" and renamed `underReviewAt` parameter to `anchorTime`.
- **Tests** — 2,397 tests pass across 260 test files; coverage thresholds met.

### Track: Email Queue Robustness (July 2026)

- **Config hygiene** — `EMAIL_FROM` routed through Zod-validated `src/config/env.ts` with default `'SIMAK <noreply@simak.app>'`; processor reads from `getEnv()` instead of raw `process.env`
- **Structured processor logging** — Email queue processor emits structured log lines for cycle start/end (processed/sent/failed counts), stale-row reclamation count, per-email failures (email id + error, no PII from body/subject), and tick errors (with `willRetryNextInterval` flag)
- **Admin queue inspector page** (`/admin/email-queue`) — Paginated table (20/page) with recipient, subject (truncated), template type, status badge, attempts, timestamps, error message; filter by status (all/pending/processing/sent/failed) and free-text search by recipient email or subject; summary stat row (Pending/Sent/Failed counts)
- **Manual retry of failed emails** — `failed` rows expose a Retry action with confirmation dialog; resets status→pending, attempts→0, error_message→null, last_attempt_at→null; idempotent guard (only `failed` rows can be retried); server function `retryEmail(emailId)` with SELECT FOR UPDATE
- **Server functions** — `listEmailQueue` (paginated, filtered, searched query + summary counts) and `retryEmail` (idempotent reset with FOR UPDATE) in `src/server/email-queue.ts` + `email-queue.server.ts`
- **Sidebar link** — 'Email Queue' link with Mail icon in admin sidebar
- **i18n translations** — 31 new keys in EN and ID for admin email queue UI
- **Tests** — 45 new tests across processor logging, server handlers, and route component; full suite 2,445 tests pass; coverage ≥80%

</protect>
