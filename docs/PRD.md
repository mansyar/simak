# Product Requirements Document (PRD)

## Project Overview

**Project Name:** SIMAK (Sistem Informasi dan Manajemen Akademik)
**Purpose:** Help students and instructors track assignment progress through defined checkpoints with structured feedback cycles.
**Audience:** University or school instructors and students.
**Platform:** Web application, deployed via Docker on a VPS.

---

## Goals

### Primary Goals (MVP & Post-MVP Scope)

_(Note: Features marked with `[v2]` are deferred to a post-MVP phase.)_

- Instructors can assign assignments with structured checkpoints to students.
- Students can submit work for each checkpoint.
- Instructors can review, approve, or request revisions on submissions.
- In-app notifications keep both parties informed of submissions, reviews, revision requests, and missed deadlines. (Email notifications are `[v2]`, except for auth-related emails: invitations, password reset, and 2FA enable/disable).
- Checkpoints must be completed in sequential order.
- Admins can manage users and assignment templates.
- Admins can bulk import users and assignment templates via Excel (.xlsx) files with client-side preview and server-side re-validation.
- Both students and instructors can view and download previously submitted checkpoint files.
- Consultation sessions (Kartu Bimbingan) are tracked as a requirement for assignment completion.
- Admins can view audit logs via the viewer at `/admin/audit-log`. System-wide analytics dashboards are `[v2]`.
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
| **Instructor** | Creates assignments, reviews submissions, manages deadlines. Can assign multiple assignments per student.                                |
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
8. Downloads previously submitted files from any checkpoint.
9. Manages profile, preferences, and notification settings.

### Instructor

1. Logs in and is redirected to the instructor dashboard with pending review queue (SLA badges), recent submissions, assignment overview, and quick actions.
2. Creates new assignments by selecting a template and assigning students.
3. Reviews submissions from the review queue, providing pass/revise decisions with comments and optional feedback files.
4. Manages deadlines — extends individual checkpoint due dates and unlocks overdue checkpoints via the collapsible Deadline Manager on the assignment detail page.
5. Monitors student progress across assignments.
6. Views and validates student consultation logs.

### Admin

1. Logs in and is redirected to the admin dashboard with system-wide metrics (total users, active assignments, pending reviews, active consultations), recent activity feed, deadline escalation alerts, and quick actions.
2. Creates Instructor and Student accounts — system sends password setup email.
3. Generates password setup links for manual sharing when needed.
4. Manages assignment templates — creates templates with ordered checkpoints and types.
5. Views system-wide analytics and audit logs.

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
- Instructors review and mark as Pass or Revise with comments.
- Instructors can attach feedback files to reviews.
- Late submissions are controlled: overdue checkpoints lock automatically; instructors can unlock them.
- **SLA & Escalation (Addressing the Instructor Bottleneck):** To ensure students aren't unfairly blocked, if an instructor does not review a submission within a defined SLA (e.g., 3 days), an automated escalation alert is sent to the Admin, and the student's subsequent deadlines are **automatically extended by the number of days the review was delayed** (breach duration is added to affected deadlines).
- **Deadline Extension Workflow**
  - **Student-Initiated:** Students can request deadline extensions via an approval workflow with reason categories (Personal, Research, Health, Other) and a proposed duration (1–30 days). Instructors approve or reject with optional comment.
  - **Instructor-Initiated:** Instructors can directly extend deadlines for one or all checkpoints without student request. Bulk extension applies +N days to all remaining checkpoints for a student.
  - **Auto-Adjustment:** Subsequent checkpoints and assignment finalDeadline auto-extend when an extension is approved or directly applied.
  - **Configurable Caps:** Admin-configurable extension limits per assignment: `maxExtensionDays` (1–30, default 7) and `maxTotalExtensions` (1–10, default 3).
  - **Audit Trail:** All deadline changes — approved requests, direct extensions, and manual unlocks — are recorded in the shared `audit_log` table with actor, previous/next values, reason, and timestamp.

### Consultation Tracking (Kartu Bimbingan)

- Students log consultation sessions via the assignment detail page.
- Each consultation is associated with a specific checkpoint stage.
- Instructors verify logs ("Trust but Verify" model).
- The minimum number of consultations required per checkpoint (`minConsultations`) is defined by the **Admin in the assignment template**. Only **verified** consultations count toward the minimum.
- Supports logging sessions with external consultants (guest supervisors, clinicians).
- Progress bars show completed vs. required consultations at assignment and checkpoint levels.

### Notifications

- In-app notification center with read/unread tracking and type-based grouping.
- Email delivery via Resend for account invitations and password setup.
- Users receive in-app alerts for submissions, reviews, revision requests, and consultation verifications.
- SLA breach alerts are sent to Admins via in-app and email notifications.
- Notification bell in the shared header shows the unread count with 15-second polling.
- Clicking the bell opens a slide-over panel with grouped notifications, "Mark all read" action, and empty state.
- Users can mark individual notifications as read or mark all as read.
- Notification preferences are `[v2]` — currently all event types are enabled for all users.

### Two-Factor Authentication & Session Management

- Users can enable TOTP-based two-factor authentication via an authenticator app using Better Auth's built-in `twoFactor` plugin.
- 8 single-use backup codes are generated on enable (shown during setup only — codes are stored encrypted).
- Login prompts for a 6-digit TOTP code when 2FA is enabled.
- Backup codes work as a fallback when the authenticator device is unavailable.
- Users can enable/disable 2FA with current password confirmation.
- Active sessions panel shows device type, IP address, and last activity per session.
- Users can revoke individual sessions or all other sessions at once.
- Email notification sent on 2FA enable/disable.
- All 2FA and session management actions are logged to the audit log.
- Active sessions are **automatically revoked** when a user is soft-deleted, when their password is reset, or when 2FA is disabled — ensuring security changes take effect immediately across all devices.
- The active sessions list filters out expired sessions automatically.

### Analytics & Reporting `[v2]`

- Role-based analytics dashboards showing progress metrics, completion rates, and engagement data.
- Reports can be generated on demand or scheduled for recurring delivery.
- Export formats: PDF, CSV, Excel, JSON.
- Instructor performance metrics (response times, satisfaction).

### File Management

- Files are accessible within assignment and submission context.
- Previously submitted files can be downloaded at any time.
- Role-based access control with audit trails.

### User Management (Admin / SuperAdmin)

- User CRUD with filtering and bulk operations.
- Role assignment: SuperAdmin creates Admin; Admin creates Instructor and Student.
- Email-based password setup on account creation.
- **Bulk Import**: Admins can upload `.xlsx` files to create multiple users (columns: `name`, `email`, `role`) or assignment templates (columns: `templateName`, `type`, `checkpointName`, `minConsultations`, `estimatedDuration`). Client-side parsing via SheetJS provides a preview table with validation badges. Server re-validates all rows (role permissions, email uniqueness excluding soft-deleted users, row/size limits). Partial success is supported — invalid rows are skipped with per-row error reasons. Template groups are inserted atomically per group via `db.transaction()`. All actions are audit-logged. Bilingual (EN/ID) throughout. Limits: 500 rows / 5 MB per file.

---

### Landing Page

- Public-facing landing page at `/` with 4 sections: Hero (headline, subtitle, CTA → `/auth/login`), Features Grid (2×3 responsive with lucide-react icons), How It Works (3-step flow), and Footer (with login, about, contact links + copyright).
- CSS-only decorative elements (gradient blobs, no images).
- All text bilingual via `t()` translation keys (`landing.*` namespace).
- No new dependencies — uses existing Tailwind + lucide-react.
- Responsive: mobile-first with `sm`/`lg` breakpoints.

## UI Requirements

- **Design System**: "Warm Academic" design system with warm neutrals, serif display fonts (Fraunces for headings, DM Sans for body), and semantic color coding. Defined in `docs/UI_REDESIGN.md`.
- **Responsive Design**: Usable on desktop and mobile devices with touch-friendly interactions (320px–1920px viewports).
- **Bilingual**: Full English and Indonesian language support. Users can switch via settings or browser preference detection.
- **Role-based Dashboards**: Each role has a dedicated dashboard page (`/student/dashboard`, `/instructor/dashboard`, `/admin/dashboard`) with metric cards (color-coded top borders, tinted icon backgrounds), summary widgets, and quick actions. Users are redirected to their role's dashboard after login.
- **Dedicated Pages**: Complex workflows have full-featured dedicated pages linked from the dashboard.
- **Dark Mode**: Light and dark theme support. System preference detection (`prefers-color-scheme`) with manual toggle. Persisted via `localStorage`. Class strategy: `.dark` on `<html>`.
- **Accessibility**: Keyboard navigation, screen reader support. WCAG 2.1 AA compliance (contrast, focus, ARIA). Touch targets minimum 44×44px.
- **Sidebar Navigation**: Dark navy sidebar (`#1C2333`) with role-specific navigation, active state indicators (blue left border), and user card with logout.
- **Typography**: Fraunces (serif) for display/headings, DM Sans (sans-serif) for body text. Self-hosted font files in `public/fonts/`.
- **Empty States**: Meaningful empty states with 64px icons, dashed borders, headline/description text, and CTA buttons. A `compact` variant is used inside dashboard cards to avoid dominating card height.
- **Progress Display**: A shared `Progress` component is used wherever a 0–100% progress bar is rendered (student assignment cards, student dashboard widgets). The label and value display are configurable; the percentage always renders a numeric value followed by `%` (never a bare `%`).
- **UI Consistency**: All status indicators, badges, and state colors must use the project's semantic color tokens (`text-success`, `text-warning`, `text-error`, `text-info`, `text-primary`, `text-muted`) and the shared `Badge` component. Literal Tailwind palette classes (e.g. `green-500`, `red-600`, `violet-500`) are not permitted for state styling. Card titles use the sans-serif font; page headings (`h1`–`h2`) use Fraunces. Sidebar active items use a full-width accent background (no left-border indent). Logout hover uses the `destructive` semantic token.

---

## Data Model (Summary)

Core entities:

- **User** — with role (SuperAdmin, Admin, Instructor, Student) and optional `settings` jsonb column for storing profile, theme, and accessibility preferences (e.g., reduced motion).
- **AssignmentTemplate** — defines type + ordered checkpoint names.
- **Assignment** — ties template to one or more students + final deadline + title + description.
- **AssignmentGroupMember** `[v2]` — maps students to group assignments.
- **Checkpoint** — one per assignment stage; tracks state, due date, description, and required consultations.
- **Submission** — files uploaded by student per checkpoint (`.docx` or `.pdf`). Append-only log: each resubmission creates a new row with an auto-incremented version number.
- **Review** — instructor decision (pass/revise) + comments + deadline + optional feedback file.
- **Consultation** — log entry for a student-instructor session tied to a specific checkpoint.
- **Notification** — in-app and/or email event logs.
- **AuditLog** — immutable record of all meaningful system actions (user created/deleted, template CRUD, assignment creation, review decisions, deadline changes, unlock actions, consultation verifications/rejections). Includes actor, action type, entity reference, and JSON details. Implemented with an admin viewer at `/admin/audit-log`.
- **ExtensionRequest** — student-initiated deadline extension request with reason category, proposed duration, and approval/rejection by instructor. Subject to admin-configurable caps (`maxExtensionDays`, `maxTotalExtensions`).
