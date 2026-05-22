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
