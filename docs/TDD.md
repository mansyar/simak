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
/                                         → Landing / Login [v1]

/ (authenticated — shared routes)
├── /settings                             → Personal preferences (profile, theme, notifs) [v2]
├── /settings/security                    → Password change, 2FA, sessions [v2]

/ (authenticated — student)
├── /student                              → Student sidebar layout
│   ├── /student/dashboard                → Student dashboard with summary widgets [v1]
│   ├── /student/assignments              → Assignment list [v1]
│   ├── /student/assignments/$id          → Assignment detail with checkpoints [v1]
│   │   └── /student/assignments/$id/
│   │       └── checkpoints/$checkpointId → Single checkpoint submission [v1]
│   ├── /student/progress                 → Progress tracking [v2]
│   └── /student/files                    → File manager [v2]

/ (authenticated — instructor)
├── /instructor                           → Instructor sidebar layout
│   ├── /instructor/dashboard             → Instructor dashboard with summary widgets [v1]
│   ├── /instructor/assignments           → All assignments [v1]
│   ├── /instructor/assignments/new       → Assignment creation wizard [v1]
│   ├── /instructor/assignments/$id       → Assignment detail (instructor view) [v1]
│   ├── /instructor/reviews               → Review queue [v1]
│   ├── /instructor/analytics             → Performance analytics [v2]
│   └── /instructor/reports               → Report builder & history [v2]

/ (authenticated — admin)
├── /admin                                → Admin sidebar layout
│   ├── /admin/dashboard                  → Admin dashboard with system metrics [v1]
│   ├── /admin/users                      → User management [v1]
│   ├── /admin/templates                  → Template list [v1]
│   ├── /admin/templates/$id              → Template editor [v1]
│   ├── /admin/analytics                  → System analytics [v2]
│   └── /admin/settings                   → System configuration [v2]

/ (unauthenticated)
├── /auth/login                           → Login page [v1]
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
│   │   ├── layout/           → Sidebar (student, instructor, admin), language switcher, theme toggle
│   │   ├── dashboard/        → Role-specific dashboard components (StudentDashboard, InstructorDashboard, AdminDashboard)
│   │   ├── student/
│   │   │   └── assignments/  → Student assignment card, filters, checkpoint timeline, checkpoint card, detail header, empty state, loading skeleton
│   │   ├── instructor/
│   │   │   └── assignments/  → Assignment wizard, template picker, student picker, progress table, card, filters, empty state, loading skeleton
│   │   ├── reviews/          → Review dialog, review queue, feedback upload, DeadlineManager
│   │   ├── consultations/    → Log form, consultation list, progress bar, verification queue item, verification dialog
│   │   ├── files/            → File upload, preview, file list
│   │   ├── notifications/    → Notification center, badge
│   │   ├── analytics/        → Charts, metric cards, export
│   │   ├── settings/         → Preferences, security section
│   │   └── admin/            → User table, template builder, template cards, pagination, filters, empty state, loading skeleton
│   ├── server/               → Server functions (split: .ts = client-safe stubs + Zod, .server.ts = handlers)
│   │   ├── auth.ts           → Login, logout, session
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
│   │   ├── setup-password.ts → Custom password setup handler
│   │   ├── files.ts          → Presigned URL generation
│   │   ├── dashboard.ts      → Dashboard data stubs (student, instructor, admin)
│   │   ├── dashboard.server.ts → Re-exports from per-role handler files
│   │   ├── dashboard-student.server.ts → Student dashboard handler
│   │   ├── dashboard-instructor.server.ts → Instructor dashboard handler
│   │   └── dashboard-admin.server.ts → Admin dashboard handler
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
│   │   ├── route-utils.ts    → Role-based dashboard routing utility
│   │   └── utils.ts          → Shared utilities
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

### Hybrid Navigation Pattern

- **Dashboard as hub**: Each role gets a dedicated dashboard (`/student/dashboard`, `/instructor/dashboard`, `/admin/dashboard`) with summary widgets and quick actions. [v1]
- **Role-based redirects**: After login, users are redirected to their role's dashboard. The `_unauthenticated` layout redirects authenticated users to their role-specific dashboard via `getRoleDashboard()`. [v1]
- **Dedicated pages**: Complex workflows have full-featured pages linked from the dashboard. [v1]
- **Context-aware navigation**: Breadcrumbs and back-links preserve workflow context. [v2]

### List Views & Pagination [v1]

All list views (assignments, reviews, users, notifications) implement offset-based pagination:

- **20 items per page** as default page size.
- **Page state** persisted in TanStack Router search params (e.g. `?page=2`) so the URL is shareable.
- **Loading state**: skeleton rows while the next page loads. Prefetch next page on scroll near the bottom.
- **[v2]**: Migrate to cursor-based pagination for submission histories and audit logs (append-only data where offset pagination drifts).

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
**ExtensionRequest** — student-initiated deadline extension with approval. [v2]
**EmailQueue** — background delivery queue for transactional emails. [v2]
**AuditLog** — administrative action record. [v2]
**Session** — Better-Auth session token, FK to users, expiresAt.
**Account** — Better-Auth credential provider entry (stores hashed password).
**Verification** — Better-Auth one-time token for password reset and email verification. Replaces the former `password_reset_tokens` table.

### Tables

#### users

| Column    | Type                   | Notes                                                                               |
| --------- | ---------------------- | ----------------------------------------------------------------------------------- |
| id        | text (PK)              | UUID                                                                                |
| name      | text, not null         | Full name                                                                           |
| email     | text, unique, not null | Login identifier                                                                    |
| role      | enum, not null         | superadmin \| admin \| instructor \| student                                        |
| locale    | text, default 'en'     | Language preference: 'en' \| 'id'. Used for UI, notifications, and email templates. |
| createdAt | timestamp              |                                                                                     |
| updatedAt | timestamp              |                                                                                     |
| deletedAt | timestamp              | Soft delete                                                                         |

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

#### verification (Better-Auth)

| Column     | Type                | Notes              |
| ---------- | ------------------- | ------------------ |
| id         | text (PK)           | UUID               |
| identifier | text, not null      | e.g. email address |
| value      | text, not null      | Token value        |
| expiresAt  | timestamp, not null | 1-hour expiry      |
| createdAt  | timestamp           |                    |
| updatedAt  | timestamp           |                    |

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

| Column           | Type                                | Notes                                 |
| ---------------- | ----------------------------------- | ------------------------------------- |
| id               | serial (PK)                         |                                       |
| templateId       | integer (FK → assignment_templates) |                                       |
| name             | text, not null                      | e.g. "Abstract", "Introduction"       |
| order            | integer, not null                   | Position in sequence                  |
| minConsultations | integer, default 0                  | Required for checkpoint unlock/submit |
| createdAt        | timestamp                           |                                       |

#### assignments

| Column        | Type                                | Notes                                                                                                   |
| ------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------- |
| id            | serial (PK)                         |                                                                                                         |
| templateId    | integer (FK → assignment_templates) | Template used                                                                                           |
| title         | text, not null                      |                                                                                                         |
| description   | text                                |                                                                                                         |
| finalDeadline | timestamp, not null                 | Soft target deadline — individual checkpoint dueDates enforce locking; finalDeadline is a display/guide |
| instructorId  | text (FK → users)                   |                                                                                                         |
| createdAt     | timestamp                           |                                                                                                         |
| updatedAt     | timestamp                           |                                                                                                         |
| deletedAt     | timestamp                           | Soft delete                                                                                             |

#### assignment_students [v1]

| Column       | Type                       | Notes |
| ------------ | -------------------------- | ----- |
| id           | serial (PK)                |       |
| assignmentId | integer (FK → assignments) |       |
| studentId    | text (FK → users)          |       |
| createdAt    | timestamp                  |       |

_Note: Each row represents one student's individual participation. Group assignments (collaborative submissions) will be added in v2._

#### checkpoints

| Column           | Type                       | Notes                                                               |
| ---------------- | -------------------------- | ------------------------------------------------------------------- |
| id               | serial (PK)                |                                                                     |
| assignmentId     | integer (FK → assignments) |                                                                     |
| name             | text, not null             | Copied from template                                                |
| order            | integer, not null          |                                                                     |
| dueDate          | timestamp                  | Per-checkpoint deadline (optional)                                  |
| minConsultations | integer, default 0         | Required for submission unlock                                      |
| state            | enum, not null             | locked \| unlocked \| submitted \| under_review \| passed \| revise |
| createdAt        | timestamp                  |                                                                     |
| updatedAt        | timestamp                  |                                                                     |

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

#### reviews

| Column           | Type                       | Notes                                                      |
| ---------------- | -------------------------- | ---------------------------------------------------------- |
| id               | serial (PK)                |                                                            |
| submissionId     | integer (FK → submissions) |                                                            |
| instructorId     | text (FK → users)          |                                                            |
| decision         | text, not null             | pass \| revise                                             |
| comment          | text                       |                                                            |
| feedbackFileKey  | text                       | R2 key for optional feedback file                          |
| revisionDeadline | timestamp                  | Deadline for resubmission (if revise)                      |
| createdAt        | timestamp                  |                                                            |
| reviewedAt       | timestamp                  | When instructor submitted the review (for SLA calculation) |

#### consultations

| Column                 | Type                       | Notes                                        |
| ---------------------- | -------------------------- | -------------------------------------------- |
| id                     | serial (PK)                |                                              |
| assignmentId           | integer (FK → assignments) |                                              |
| checkpointId           | integer (FK → checkpoints) | Which stage this consultation supports       |
| studentId              | text (FK → users)          |                                              |
| verifiedById           | text (FK → users)          | Internal instructor who verified the log     |
| status                 | enum, not null             | pending \| verified \| rejected              |
| notes                  | text                       | Session notes from student                   |
| externalConsultantName | text                       | Name if session was with external supervisor |
| sessionType            | text                       | internal \| external                         |
| verifiedAt             | timestamp                  | When instructor verified                     |
| createdAt              | timestamp                  |                                              |

#### notifications

| Column    | Type                   | Notes                                   |
| --------- | ---------------------- | --------------------------------------- |
| id        | serial (PK)            |                                         |
| userId    | text (FK → users)      | Recipient                               |
| type      | text, not null         | Event type identifier                   |
| title     | text, not null         | Short summary                           |
| message   | text                   | Body                                    |
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

#### extension_requests [v2]

| Column            | Type                       | Notes                           |
| ----------------- | -------------------------- | ------------------------------- |
| id                | serial (PK)                |                                 |
| assignmentId      | integer (FK → assignments) |                                 |
| studentId         | text (FK → users)          |                                 |
| requestedDeadline | timestamp, not null        | Proposed new deadline           |
| reason            | text                       |                                 |
| status            | text, not null             | pending \| approved \| rejected |
| reviewedBy        | text (FK → users)          | Instructor who decided          |
| createdAt         | timestamp                  |                                 |
| updatedAt         | timestamp                  |                                 |

#### email_queue [v2]

| Column         | Type               | Notes                     |
| -------------- | ------------------ | ------------------------- |
| id             | serial (PK)        |                           |
| recipientEmail | text, not null     |                           |
| subject        | text, not null     |                           |
| bodyHtml       | text, not null     |                           |
| status         | text, not null     | pending \| sent \| failed |
| attempts       | integer, default 0 |                           |
| lastAttemptAt  | timestamp          |                           |
| errorMessage   | text               | Last failure reason       |
| createdAt      | timestamp          |                           |

#### audit_logs [v2]

| Column     | Type              | Notes                               |
| ---------- | ----------------- | ----------------------------------- |
| id         | serial (PK)       |                                     |
| userId     | text (FK → users) | Who performed the action            |
| action     | text, not null    | e.g. user.created, template.deleted |
| entityType | text              | e.g. user, assignment               |
| entityId   | text              | ID of affected entity               |
| metadata   | jsonb             | Additional context                  |
| createdAt  | timestamp         |                                     |

### Database Indexes

| Table                   | Column(s)        | Type             | Purpose                                      |
| ----------------------- | ---------------- | ---------------- | -------------------------------------------- |
| `checkpoints`           | `assignmentId`   | b-tree           | Fetch checkpoints when loading an assignment |
| `submissions`           | `checkpointId`   | b-tree           | Fetch submissions for a checkpoint           |
| `submissions`           | `uploadedBy`     | b-tree           | Student's submission history                 |
| `reviews`               | `submissionId`   | b-tree           | Fetch review for a submission                |
| `consultations`         | `checkpointId`   | b-tree           | Count consultations for gating logic         |
| `consultations`         | `status`         | b-tree           | Filter pending verifications                 |
| `notifications`         | `userId`, `read` | composite b-tree | Notification center filtering                |
| `password_reset_tokens` | `token`          | unique b-tree    | Token lookup on password setup               |
| `audit_logs`            | `userId`         | b-tree           | Filter by admin (v2)                         |
| `email_queue`           | `status`         | b-tree           | Pick pending emails for delivery (v2)        |

All indexes use Drizzle's `index()` or `uniqueIndex()` API. Migration generated with `drizzle-kit generate`.

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

| Action                    | SuperAdmin | Admin | Instructor | Student |
| ------------------------- | ---------- | ----- | ---------- | ------- |
| Create Admin              | ✓          | —     | —          | —       |
| Create Instructor/Student | —          | ✓     | —          | —       |
| Manage templates          | —          | ✓     | —          | —       |
| Create assignments        | —          | —     | ✓          | —       |
| Review submissions        | —          | —     | ✓          | —       |
| Submit checkpoint work    | —          | —     | —          | ✓       |
| Log consultations         | —          | —     | —          | ✓       |
| Verify consultations      | —          | —     | ✓          | —       |
| View own progress         | —          | —     | —          | ✓       |
| View all progress         | —          | —     | ✓          | —       |
| View system analytics     | —          | —     | —          | —       |
| Read audit logs           | ✓          | ✓     | —          | —       |

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
- Tokens are single-use.
- Resend handles all transactional email delivery.

### Session & Access Control [v1]

- Server-side sessions stored in the `session` table (managed by Better-Auth via Drizzle adapter).
- Session validation via `getSessionFromHeaders()` server function using `auth.api.getSession()` with SSR request headers.
- Route-level guard via TanStack Router `beforeLoad`:
  - `_unauthenticated` layout redirects authenticated users to their role-specific dashboard via `getRoleDashboard()`.
  - `_authenticated` layout redirects unauthenticated users to `/auth/login`.
- Role-based access via `requireRole(roles)` helper — wraps session check with role validation. Unauthorized users are redirected to their own dashboard.
- Password hashing uses Better-Auth's built-in scrypt via `better-auth/crypto`.
- File downloads check ownership and role before generating a presigned URL.

### Two-Factor Authentication [v2]

- TOTP via authenticator app.
- Backup codes (8 single-use) generated on enable.
- Per-user enable/disable.

---

## 5. File Management [v1]

### Upload Flow (Cloudflare R2)

```
1. Client selects file
2. Client calls server function → generates short-lived presigned PUT URL
3. Client uploads file directly to R2 via the presigned URL
4. Client calls server function → records file metadata in PostgreSQL
5. UI confirms upload complete
```

### Rules

| Aspect               | Rule                                                                                                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Accepted formats** | `.docx` and `.pdf` only. Enforced client-side (accept attribute) and server-side (MIME check).                                                                                                                     |
| **File naming**      | UUID-based keys in R2 (e.g. `submissions/{uuid}.pdf`). Original name stored in DB.                                                                                                                                 |
| **Presigned URLs**   | 5 minutes for upload, 1 hour for download.                                                                                                                                                                         |
| **Versioning**       | Version increments by 1 each time a student resubmits after a REVISE decision. Initial submission is version 1.                                                                                                    |
| **Preview**          | PDF: in-browser via blob URL. [v2: use range requests to fetch only the first few pages for thumbnail preview instead of downloading the full 25MB file.] DOCX: metadata display only (name, size, date, version). |
| **Permissions**      | Students see own submissions; instructors see all for their assignments; admins see all.                                                                                                                           |

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
- The assignment's `finalDeadline` is a **soft target** — it does not auto-lock anything. Individual checkpoint `dueDate` values are what enforce deadlines.
- On-time submissions awaiting review: if the instructor reviews late, the student is not penalized. Subsequent deadlines are **automatically extended by the number of days the review was delayed** (breach duration added to affected deadlines).

### Review SLA (3 days)

- Instructors have a 3-day SLA to review submissions from the time they transition to `UNDER_REVIEW`.
- If the SLA is breached, an `sla_breach` in-app notification is sent to the Admin.
- The SLA is advisory (non-blocking) — Admin can follow up with the instructor. No automatic action is taken beyond the alert and the automatic deadline adjustment for the student (see Overdue Behavior above).

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

- Notifications stored in the `notifications` table.
- TanStack Query `refetchInterval` polls for new notifications with differentiated intervals per priority:
  - **High priority** (submission_received, review_completed): 10s active, 60s background.
  - **Medium priority** (deadline_approaching, deadline_missed): 30s active, 120s background.
  - **Low priority** (consultation_verified): 60s active, 300s background.
- Notification center UI with read/unread filtering.
- Badge indicator on the sidebar.

### Email Delivery [v2]

- Sent via Resend API.
- Email queue (`email_queue` table) with retry logic: 3 attempts (5min, 30min, 2h backoff).
- Dead letter after 3 failed attempts (logged, not retried).

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
| **Email delivery**    | Queue-based with retry. Transient failures are retried; permanent failures are logged.                             |
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

---

## 10. Testing Strategy

### Unit Tests (Vitest) [v1]

| Focus                 | Examples                                                                              |
| --------------------- | ------------------------------------------------------------------------------------- |
| **Gating logic**      | Checkpoint unlock conditions, consultation counting, sequential order enforcement.    |
| **State transitions** | Valid and invalid checkpoint state transitions (e.g. can't go from LOCKED to PASSED). |
| **Validation**        | Zod schema tests for all input types (assignment creation, submission upload, etc.).  |
| **Permission checks** | Role-based access logic unit tests.                                                   |

### Integration Tests (Vitest) [v2]

| Focus                | Examples                                                                   |
| -------------------- | -------------------------------------------------------------------------- |
| **Server functions** | Call server functions with test database, verify DB state changes.         |
| **Auth flow**        | Login, session validation, role enforcement end-to-end within test server. |
| **File upload flow** | Presigned URL generation → mock upload → metadata persistence.             |

### E2E Tests (Playwright) [v2]

| Flow                               | What it validates                                                   |
| ---------------------------------- | ------------------------------------------------------------------- |
| **Complete submit → review cycle** | Student uploads → instructor reviews → pass/revise reflects in UI.  |
| **User creation flow**             | Admin creates user → email sent → password setup → login.           |
| **Consultation flow**              | Student logs consultation → instructor verifies → progress updates. |
| **Deadline enforcement**           | Overdue checkpoint locks → instructor unlocks → student can submit. |

---

## 11. Performance

### Loading Strategy [v1]

- TanStack Router lazy loads route components.
- Suspense boundaries with skeleton screens for async data.
- TanStack Query stale times: user profile (5min), checkpoint list (30s), notifications: 10s (high), 30s (medium), 60s (low).
- TanStack Query `gcTime`: dashboard data cached for 30 minutes in memory after the user navigates away, so returning to the dashboard is instant.

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
| Analytics              | SSR skeleton + client hydrate (charts need JS).                  |

### Vite Optimizations [v1]

- Automatic code splitting per route (TanStack Router + Vite).
- Dynamic imports for heavy libraries (chart library, file preview).

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

| Variable               | Purpose                            |
| ---------------------- | ---------------------------------- |
| `DATABASE_URL`         | PostgreSQL connection string       |
| `R2_ENDPOINT`          | Cloudflare R2 endpoint URL         |
| `R2_ACCESS_KEY_ID`     | R2 API access key                  |
| `R2_SECRET_ACCESS_KEY` | R2 API secret key                  |
| `R2_BUCKET_NAME`       | R2 bucket for uploads              |
| `RESEND_API_KEY`       | Resend API key for email delivery  |
| `BETTER_AUTH_SECRET`   | Signing secret for auth tokens     |
| `BETTER_AUTH_URL`      | Public URL of the app              |
| `SUPERADMIN_EMAIL`     | Email for the seeded SuperAdmin    |
| `SUPERADMIN_PASSWORD`  | Password for the seeded SuperAdmin |

### Database Migrations [v1]

- Drizzle Kit for migration generation and execution.
- `drizzle-kit push` for development; `drizzle-kit migrate` for production.
- Migration runs as part of the Docker entrypoint or a separate init container.

### Connection Pooling

- **Development**: Direct connections (Drizzle uses a single pool internally).
- **Production**: PgBouncer deployed as a sidecar container in Coolify. The app connects to PgBouncer, which multiplexes connections to PostgreSQL. Prevents connection exhaustion under concurrent load.
- Connection string format: `postgresql://user:pass@pgbouncer:6432/simak` (PgBouncer on port 6432).

---

## 13. UI & Design System [v1]

### Component Library

All UI built on shadcn/ui primitives (Radix UI wrappers). Components used by category:

| Category         | Components                                     |
| ---------------- | ---------------------------------------------- |
| **Form**         | Input, Textarea, Select, Checkbox, Radio, Form |
| **Layout**       | Sidebar, Tabs, Card, Separator                 |
| **Navigation**   | Breadcrumb, Navigation Menu                    |
| **Data Display** | Table, Avatar, Badge, Card                     |
| **Feedback**     | Alert, Progress, Dialog, Popover, Toast, Sheet |
| **Charts**       | Recharts-based components                      |
| **Overlay**      | Dialog, Sheet, Dropdown Menu                   |

### Theme

- Light and dark modes via Tailwind `dark:` variant + CSS custom properties.
- Semantic colors: success (pass), warning (revise), error (overdue/missed), info (consultation).
- System font stack with configurable type scale (12px–48px).
- 4px base spacing unit.

---

## 14. Accessibility [v1]

- Radix UI primitives provide built-in ARIA attributes.
- Keyboard navigation for all interactive elements.
- Focus management: focus trapping in dialogs, skip-to-content link.
- Screen reader announcements for dynamic content (toast, progress updates).
- Color contrast meets WCAG 2.1 AA minimum.
- Form validation errors announced via `aria-live` regions.

---

## 15. Internationalization (i18n) [v1]

### Strategy

- **Library**: typesafe-i18n. Generates TypeScript types from translation JSON files. Compile-time guarantee that every translation key exists.
- **Languages**: English (`en`) and Indonesian (`id`). English is the default.

### Locale Resolution

1. **First visit (unauthenticated)**: Detect from browser `navigator.language`. If Indonesian → use `id`, otherwise fall back to `en`. A **language switcher toggle** is available on the login and password setup pages so users can switch before authenticating.
2. **Logged-in user**: Use the `locale` column from the user's profile (can change in `/settings`).
3. **Server functions**: Resolve locale from the authenticated user's session. Used for email subjects, notification messages, and validation errors.

### Translation Scope

| Surface             | Strategy                                                                         | Example                                                    |
| ------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **UI labels**       | Static translation keys                                                          | `t('button.submit')`                                       |
| **Dynamic text**    | Interpolation with parameters                                                    | `t('checkpoint.passed', { name: checkpoint.name })`        |
| **Notifications**   | Store event `type` + `params` in DB. Render with current locale at display time. | `{ type: 'review_completed', params: { checkpointName } }` |
| **Email templates** | Render at send time based on recipient's locale.                                 | Resend email body in `en` or `id`                          |

### Files

- `locales/en.json` — English source of truth.
- `locales/id.json` — Indonesian translations.
- Both files share the same key structure. Missing keys in `id.json` fall back to `en` at compile time (typesafe-i18n warning).

### User Preference

- Stored in `users.locale` (`'en' | 'id'`).
- Changeable via `/settings`.
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
| Two-factor authentication                                              |          | ✓             |
| Email notifications (transactional beyond invitations)                 |          | ✓             |
| Push notifications (Web Push)                                          |          | ✓             |
| Notification preferences                                               |          | ✓             |
| Analytics dashboards                                                   |          | ✓             |
| Reports with scheduling and export                                     |          | ✓             |
| Deadline extension workflow                                            |          | ✓             |
| Audit logging                                                          |          | ✓             |
| Integration tests                                                      |          | ✓             |
| Playwright E2E tests                                                   |          | ✓             |
