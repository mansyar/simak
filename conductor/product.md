<protect>
# Initial Concept

SIMAK (Sistem Informasi dan Manajemen Akademik) — Help students and instructors track assignment progress through defined checkpoints with structured feedback cycles.

---

# Product Guide: SIMAK

## Project Overview

SIMAK (Sistem Informasi dan Manajemen Akademik) is a web-based academic information and management system designed for universities and schools. It enables instructors to assign structured assignments with sequential checkpoints, allows students to submit work for review, and facilitates structured feedback cycles.

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
- **Edit template sheet** — Slide-in panel with pre-filled Name, Type, and checkpoint data; reuses CheckpointListEditor for checkpoint management
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
- **Automatic deadline adjustment** — Late reviews extend affected + subsequent checkpoint `dueDate` values and assignment `finalDeadline` by breach duration (per-student)
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
- **Auto-deadline adjustment on approval** — Extends affected checkpoint + subsequent checkpoints + assignment `finalDeadline`
- **Instructor-initiated bulk extension** — Directly extends all unfinished checkpoints for a student by +N days with reason
- **Audit log integration** — `deadline.extension_approved`, `deadline.extension_rejected`, `deadline.extended`, and `checkpoint.unlocked` audit events
- **In-app notifications** — `extension_requested` → instructor, `extension_approved`/`extension_rejected` → student
- **Student extension history** — Table on assignment detail page showing past requests with status badges (pending/approved/rejected)
- **i18n translations** — Full English and Indonesian translations for extension request form, instructor queue, approval/rejection dialogs, and notification titles
- **Server handler tests** — Unit tests for request, list, approve, reject, bulk, and audit log wiring handlers
- **UI component tests** — Unit tests for student request form, history list, instructor queue section, and approval/rejection dialogs

</protect>
