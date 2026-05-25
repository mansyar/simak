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
- In-app notifications keep both parties informed of submissions, reviews, revision requests, and missed deadlines. (Email notifications are `[v2]`, except for auth invitations).
- Checkpoints must be completed in sequential order.
- Admins can manage users and assignment templates.
- Both students and instructors can view and download previously submitted checkpoint files.
- Consultation sessions (Kartu Bimbingan) are tracked as a requirement for assignment completion.
- Admins can view system-wide analytics and audit logs. `[v2]`
- Students can request deadline extensions via an approval workflow. `[v2]`

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
- Authentication is powered by **Better-Auth** with email/password, database-backed sessions, and HTTP-only cookies.
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
2. Sets password, logs in, and sees a dashboard with active assignments and progress.
3. Opens an assignment to view its checkpoints, deadlines, and required consultations.
4. Submits files for the current checkpoint (`.docx`, `.pdf`).
5. If review is **Pass** → next checkpoint unlocks.
6. If review is **Revise** → receives instructor feedback, resubmits (creates new version), and deadline for resubmission. _(Note: If a checkpoint is revised more than 3 times, a non-blocking escalation notification is triggered to the instructor and admin. The escalation is advisory-only — there is no hard block on resubmissions beyond 3.)_
7. Logs consultation sessions with supervisor as needed (via assignment detail page).
8. Downloads previously submitted files from any checkpoint.
9. Manages profile, preferences, and notification settings.

### Instructor

1. Logs in and sees a dashboard with pending reviews and student progress summaries.
2. Creates new assignments by selecting a template and assigning students.
3. Reviews submissions from the review queue, providing pass/revise decisions with comments and optional feedback files.
4. Manages deadlines — extends individual checkpoint due dates and unlocks overdue checkpoints via the collapsible Deadline Manager on the assignment detail page.
5. Monitors student progress across assignments.
6. Views and validates student consultation logs.

### Admin

1. Logs in to an admin dashboard with system-wide metrics.
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

### Assignment Management

- Instructors create assignments from templates, assign title + description, set a final deadline, and select one or more students.
- Each selected student gets their own independent progress, checkpoint states, and submissions tied to the same assignment.
- Group assignments (collaborative submissions by multiple students) are deferred to a post-MVP iteration. `[v2]`
- Deadlines can be extended via an approval workflow. `[v2]`
- Progress tracking shows completion status for each student.

### Checkpoints & Submissions

- Checkpoints are completed in sequential order — each unlocks only after the previous is passed.
- Students upload `.docx` or `.pdf` files per checkpoint. **Maximum file size is restricted to 25MB** to balance quality and storage limits.
- Each submission has an audit trail with file versioning. Resubmitting creates a new immutable record in the audit trail.
- Instructors review and mark as Pass or Revise with comments.
- Instructors can attach feedback files to reviews.
- Late submissions are controlled: overdue checkpoints lock automatically; instructors can unlock them.
- **SLA & Escalation (Addressing the Instructor Bottleneck):** To ensure students aren't unfairly blocked, if an instructor does not review a submission within a defined SLA (e.g., 3 days), an automated escalation alert is sent to the Admin, and the student's subsequent deadlines are **automatically extended by the number of days the review was delayed** (breach duration is added to affected deadlines).

### Consultation Tracking (Kartu Bimbingan)

- Students log consultation sessions via the assignment detail page.
- Each consultation is associated with a specific checkpoint stage.
- Instructors verify logs ("Trust but Verify" model).
- The minimum number of consultations required per checkpoint (`minConsultations`) is defined by the **Admin in the assignment template**. Only **verified** consultations count toward the minimum.
- Supports logging sessions with external consultants (guest supervisors, clinicians).
- Progress bars show completed vs. required consultations at assignment and checkpoint levels.

### Notifications

- In-app notification center with read/unread tracking.
- Email delivery via Resend for account invitations and password setup.
- Users receive alerts for submissions, reviews, revision requests, deadline reminders, and missed deadlines.
- Users control which notification types they receive.

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

---

## UI Requirements

- **Responsive Design**: Usable on desktop and mobile devices with touch-friendly interactions.
- **Bilingual**: Full English and Indonesian language support. Users can switch via settings or browser preference detection.
- **Role-based Dashboards**: Each role sees relevant information and actions on first load.
- **Dedicated Pages**: Complex workflows have full-featured dedicated pages linked from the dashboard.
- **Dark Mode**: Light and dark theme support.
- **Accessibility**: Keyboard navigation, screen reader support.

---

## Data Model (Summary)

Core entities:

- **User** — with role (SuperAdmin, Admin, Instructor, Student).
- **AssignmentTemplate** — defines type + ordered checkpoint names.
- **Assignment** — ties template to one or more students + final deadline + title + description.
- **AssignmentGroupMember** `[v2]` — maps students to group assignments.
- **Checkpoint** — one per assignment stage; tracks state, due date, description, and required consultations.
- **Submission** — files uploaded by student per checkpoint (`.docx` or `.pdf`). Append-only log: each resubmission creates a new row with an auto-incremented version number.
- **Review** — instructor decision (pass/revise) + comments + deadline + optional feedback file.
- **Consultation** — log entry for a student-instructor session tied to a specific checkpoint.
- **Notification** — in-app and/or email event logs.
- **ExtensionRequest** `[v2]` — student request for deadline extension with approval workflow.
- **AuditLog** `[v2]` — administrative action trail.
