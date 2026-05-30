# SIMAK V2 Roadmap

> **Project:** SIMAK — Sistem Informasi dan Manajemen Akademik  
> **Stack:** TanStack Start + PostgreSQL + Drizzle ORM + shadcn/ui + Tailwind v4  
> **Document Status:** Post-MVP feature planning. Track ordering reflects priority.

---

## Phase 1: Foundation Infrastructure & V1 Logic Fixes

This phase first establishes a comprehensive audit log — an immutable record of all meaningful actions across the system, enabling accountability, debugging, and historical analysis. Every subsequent track (extensions, deadline changes, unlocks) will write to this log. The phase then fixes the critical V1 issue where `checkpoints.dueDate` is NULL for virtually all assignments because `estimatedDuration` was never implemented on templates.

---

### Track 1.1 — Comprehensive Audit Log

**Description:** Build a system-wide audit log infrastructure. An `audit_log` table records every meaningful action: extension approvals, deadline changes, manual unlocks, user creation/deletion, template CRUD, assignment creation, review decisions, and consultation verifications. Server-side helpers make logging a one-liner from any handler. An admin-facing audit log viewer provides search, filter by action type / actor / entity, and date range filtering.

This track goes first so all subsequent tracks can write to the audit log from day one.

**Dependencies:** V1 database foundation (Drizzle schema, DB client).

**Status:** ✅ Complete (May 2026)

**Estimated Scope:**

| Area                                                                                                         | Effort |
| ------------------------------------------------------------------------------------------------------------ | ------ |
| Schema — `audit_log` table with indexes                                                                      | Small  |
| Server helper — `logAuditEvent(event)`                                                                       | Small  |
| Audit log query handler (paginated, filterable, role-guarded)                                                | Medium |
| Wire existing handlers to audit log (user create/delete, assignment create, review decisions, template CRUD) | Medium |
| Admin audit log viewer page (`/admin/audit-log`) with search, filters, pagination                            | Medium |
| Tests                                                                                                        | Medium |

**Database Schema Changes:**

**New Table: `audit_log`**

| Column      | Type              | Notes                                                                                                                                                                                                                                                                                                           |
| ----------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id          | serial (PK)       |                                                                                                                                                                                                                                                                                                                 |
| actor_id    | text (FK → users) | NOT NULL — who performed the action                                                                                                                                                                                                                                                                             |
| action      | text, not null    | `user.created`, `user.deleted`, `template.created`, `template.updated`, `template.deleted`, `assignment.created`, `review.passed`, `review.revised`, `checkpoint.unlocked`, `deadline.extended`, `deadline.extension_approved`, `deadline.extension_rejected`, `consultation.verified`, `consultation.rejected` |
| entity_type | text, not null    | `user` \| `template` \| `assignment` \| `checkpoint` \| `submission` \| `review` \| `consultation`                                                                                                                                                                                                              |
| entity_id   | text, not null    | Stringified ID of affected entity                                                                                                                                                                                                                                                                               |
| details     | jsonb             | NULLABLE — arbitrary context (previous value, new value, reason, etc.)                                                                                                                                                                                                                                          |
| created_at  | timestamp         | DEFAULT NOW()                                                                                                                                                                                                                                                                                                   |

Index on `(created_at DESC)` for time-ordered queries. Index on `(action)` for type filtering. Index on `(entity_type, entity_id)` for entity-specific history.

**New Server Helper: `src/lib/audit.ts`**

```typescript
export async function logAuditEvent(event: {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
}): Promise<void>;
```

Single-import helper used across all handlers. Writes to `audit_log` table. No complex setup needed.

**Modified: Existing handlers** — Wire `logAuditEvent` into:

| Handler                        | Action logged           | Details                            |
| ------------------------------ | ----------------------- | ---------------------------------- |
| `createUserHandler`            | `user.created`          | role, email                        |
| `deleteUserHandler`            | `user.deleted`          | soft-delete marker                 |
| `createTemplateHandler`        | `template.created`      | name, type, checkpoint count       |
| `updateTemplateHandler`        | `template.updated`      | name, type changes                 |
| `deleteTemplateHandler`        | `template.deleted`      | soft-delete marker                 |
| `createAssignmentHandler`      | `assignment.created`    | template, student count, deadline  |
| `submitReviewHandler` (pass)   | `review.passed`         | checkpoint name, comment snippet   |
| `submitReviewHandler` (revise) | `review.revised`        | checkpoint name, revision deadline |
| `verifyConsultationHandler`    | `consultation.verified` | checkpoint, student                |
| `rejectConsultationHandler`    | `consultation.rejected` | checkpoint, student, reason        |

**Admin Viewer:**

- New route: `/admin/audit-log`
- Paginated table with columns: Timestamp, Action (badge), Actor, Entity Type, Entity ID, Details (expandable JSON)
- Filters: action type dropdown, date range picker, free-text search on details
- Role guard: `requireRole(['superadmin', 'admin'])`

**Acceptance Criteria:**

- [x] `audit_log` table created with proper indexes
- [x] `logAuditEvent` helper exists and is importable from any handler
- [x] All existing handlers listed above write an audit log entry on execution
- [x] Admin audit log page at `/admin/audit-log` loads with paginated entries
- [x] Admin can filter by action type (dropdown derived from distinct values)
- [x] Admin can filter by date range
- [x] Non-admin users cannot access the audit log page (redirected)
- [x] Audit log entries are immutable (no update/delete endpoint)
- [x] i18n translations for audit log UI

**Test Plan:**

| Area                   | Approach                                                         |
| ---------------------- | ---------------------------------------------------------------- |
| `audit_log` schema     | Unit test — column types, foreign keys, indexes                  |
| `logAuditEvent` helper | Unit test — writes correct row to DB                             |
| Handler wiring         | Unit test — each handler produces expected audit entry           |
| Admin viewer           | Unit test — page renders, pagination works, filters update query |
| Role guard             | Unit test — non-admin redirected                                 |

---

### Track 1.2 — Estimated Duration & Auto-Calculated DueDates

**Description:** Add `estimated_duration` (days) to `template_checkpoints`. During assignment creation, auto-calculate each checkpoint's `dueDate` as `baseDate + cumulative durations`. Instructors can override calculated dates before finalizing. Validate sequential ordering (CP1 < CP2 < CP3) and reject past dates.

**Dependencies:** Track 1.1 (audit log — assignment creation and deadline changes are logged).

**Status:** ✅ Complete (May 2026)

**Database Schema Changes:**

**Modified: `template_checkpoints`** (add column)

| Column               | Type    | Default | Notes                             |
| -------------------- | ------- | ------- | --------------------------------- |
| `estimated_duration` | integer | 0       | Days allotted for this checkpoint |

**No change to `checkpoints`** — `dueDate` column already exists; we stop inserting NULL.

**Acceptance Criteria:**

- [x] Template checkpoint form shows `estimated_duration` input (integer, min 0, default 7)
- [x] Assignment creation calculates `dueDate` as `assignment.createdAt + Σ(durations)` per checkpoint
- [x] Instructor can override any calculated `dueDate` before finalizing
- [x] Server-side validation rejects out-of-order dueDates (CP3 due before CP1)
- [x] Server-side validation rejects past dueDates
- [x] Existing `extendDeadlineHandler` is reused for post-creation adjustments (no new handler)
- [x] `createAssignmentHandler` writes `assignment.created` audit log entry
- [x] Student assignment detail page shows real dueDates on all checkpoints
- [x] Student dashboard "Upcoming Deadlines" widget shows all checkpoints (no longer filtered out by `IS NOT NULL`)
- [x] SLA breach `adjustDeadlinesForBreach` now operates on real dates
- [x] Migration adds `estimated_duration` column + backfills existing templates with 14-day default
- [x] i18n translations for duration labels and UI

**Actual Files Created/Modified:**

| File                                                          | Purpose                                                                                                                                                                                                                     |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `drizzle/migrations/0005_estimated_duration.sql`              | Migration SQL — add `estimated_duration` column, backfill existing templates with 14-day default, backfill existing checkpoints.dueDate from template durations                                                             |
| `src/db/schema/templates.ts`                                  | **Modified:** Added `estimatedDuration: integer('estimated_duration').default(0)` to `templateCheckpoints` schema                                                                                                           |
| `src/server/due-dates.server.ts`                              | **New:** `calculateDueDates()` — cumulative duration calc; `validateDueDates()` — sequential ordering + past date validation                                                                                                |
| `src/server/assignments.ts`                                   | **Modified:** Added `OverrideDueDateSchema` + `overrideDueDates` field to `CreateAssignmentSchema`; exported `CreateAssignmentInputSchema`                                                                                  |
| `src/server/assignments.server.ts`                            | **Modified:** Fetches `estimatedDuration` from template; calculates dueDates via `calculateDueDates`; applies overrides; validates via `validateDueDates`                                                                   |
| `src/server/templates.ts`                                     | **Modified:** Added `estimatedDuration: z.coerce.number().int().min(0).default(7)` to `CheckpointInputSchema`                                                                                                               |
| `src/server/templates.server.ts`                              | **Modified:** All handlers (get, create, update, duplicate) now read/write `estimatedDuration` on checkpoints                                                                                                               |
| `src/server/dashboard-student.server.ts`                      | **Modified:** Removed `IS NOT NULL` SQL filter and `.filter((d) => d.dueDate)` JS guard on upcoming deadlines query                                                                                                         |
| `src/lib/review-sla.ts`                                       | **Modified:** Removed null-guard `if (cp.dueDate)` and `if (submission.checkpointDueDate)` now that dueDates are always populated                                                                                           |
| `src/components/admin/templates/CheckpointListEditor.tsx`     | **Modified:** Added `estimatedDuration` input per checkpoint row + column headers + hint text                                                                                                                               |
| `src/components/instructor/assignments/DueDatePreview.tsx`    | **New:** Due date preview step — shows calculated dates + override inputs for each checkpoint                                                                                                                               |
| `src/components/instructor/assignments/ReviewStep.tsx`        | **New:** Extracted review step component (previously inline in AssignmentWizard)                                                                                                                                            |
| `src/components/instructor/assignments/AssignmentWizard.tsx`  | **Modified:** Added Step 4 (DueDatePreview) between Step 3 (Students) and Step 5 (Confirm); passes `overrideDueDates` to `createAssignment`                                                                                 |
| `locales/en.json` / `locales/id.json`                         | **Modified:** Added `estimatedDuration`, `durationPlaceholder`, `durationHint`, `minConsHint` to `adminTemplates.form`; added `stepDueDates`, `dueDatesPrompt`, `daysLabel`, `dueDateFor` to `instructorAssignments.wizard` |
| `tests/unit/server/due-dates.test.ts`                         | **New:** 9 tests — cumulative calculation (3 checkpoints), zero duration, null duration, valid order, out-of-order, same-day reject, past dates, future dates                                                               |
| `tests/unit/server/assignments-duration.test.ts`              | **New:** 1 test — full `createAssignmentHandler` integration with duration-based dueDates and audit log verification                                                                                                        |
| `tests/unit/components/instructor/due-date-preview.test.tsx`  | **New:** 9 tests — checkpoint cards render, cumulative calculation, zero duration, default baseDate, override highlight, user change, clear, update, empty state                                                            |
| `tests/unit/components/instructor/assignment-wizard.test.tsx` | **Modified:** Updated for 5-step wizard; added DueDatePreview tests, override verification, submission without overrides                                                                                                    |
| `tests/unit/server/dashboard.test.ts`                         | **Modified:** Updated for removed IS NOT NULL filter                                                                                                                                                                        |
| `tests/unit/server/notifications-events.test.ts`              | **Modified:** Updated with valid dueDates instead of null                                                                                                                                                                   |

**Test Results (at time of archiving):**

- 1242/1242 tests passing across 141 test files
- TypeScript typecheck passes with no errors
- eslint/prettier/lint-staged pass on all new files
- All new files under 500-line modularity limit
- Pre-push hook (typecheck + vitest coverage) passes
- Review fixes applied: transaction rollback on validation failure, non-null assertions replaced with safe fallbacks

---

### Track 1.3 — Deadline Extension Workflow

**Description:** Implement a two-path deadline extension system. **Student-initiated:** Students request extensions with reason categories (Personal, Research, Health, Other) and a proposed duration. Instructors approve/reject with optional comment. **Instructor-initiated:** Direct bulk extension of all checkpoints for a student +N days with reason capture. Both paths write to the audit log via `logAuditEvent`.

Admin-configurable caps: max extension days per request (1–30) and max total extensions per assignment (1–10). Auto-adjustment extends subsequent checkpoints and assignment finalDeadline on approval.

**Dependencies:** Track 1.1 (audit log — all extension actions logged). Track 1.2 (dueDates must exist before extension is meaningful).

**Status:** ✅ Complete (May 2026)

**Estimated Scope:**

| Area                                                                             | Effort |
| -------------------------------------------------------------------------------- | ------ |
| Schema — `extension_requests` table                                              | Medium |
| Handler — student request/create/approve/reject                                  | Medium |
| Handler — instructor direct bulk extension                                       | Medium |
| Wire audit log into extension handlers                                           | Small  |
| Wire existing `extendDeadlineHandler` and `unlockCheckpointHandler` to audit log | Small  |
| Extension cap validation (admin-configurable)                                    | Small  |
| Auto-extend subsequent checkpoints + finalDeadline on approval                   | Small  |
| Student notification on approve/reject                                           | Small  |
| UI — extension request form (student)                                            | Medium |
| UI — pending extensions queue (instructor)                                       | Medium |
| UI — bulk extension controls in DeadlineManager                                  | Medium |
| Tests                                                                            | Medium |

**Database Schema Changes:**

**New Table: `extension_requests`**

| Column             | Type                                | Notes                                                    |
| ------------------ | ----------------------------------- | -------------------------------------------------------- |
| id                 | serial (PK)                         |                                                          |
| assignment_id      | integer (FK → assignments, CASCADE) | NOT NULL                                                 |
| student_id         | text (FK → users)                   | NOT NULL                                                 |
| checkpoint_id      | integer (FK → checkpoints)          | NULLABLE — which checkpoint is affected                  |
| requested_deadline | timestamp, not null                 | Proposed new deadline                                    |
| reason             | text, not null                      | Student's explanation                                    |
| category           | text, not null                      | `personal` \| `research` \| `health` \| `other`          |
| extension_days     | integer, not null                   | CHECK (1–30)                                             |
| status             | text, not null                      | `pending` \| `approved` \| `rejected`                    |
| resolved_by        | text (FK → users)                   | NULLABLE — instructor who acted                          |
| resolution_reason  | text                                | NULLABLE — instructor's comment (required for rejection) |
| created_at         | timestamp                           | DEFAULT NOW()                                            |
| resolved_at        | timestamp                           | NULLABLE                                                 |

Index on `(assignment_id, status)` for instructor queue queries.

**Modified: `assignments`** (add columns)

| Column               | Type               | Notes                               |
| -------------------- | ------------------ | ----------------------------------- |
| max_extension_days   | integer, default 7 | Admin cap per request, CHECK (1–30) |
| max_total_extensions | integer, default 3 | Cap per assignment, CHECK (1–10)    |

**Acceptance Criteria:**

- [x] Admin can configure max extension days (1–30, default 7) and max total extensions (1–10, default 3) per assignment
- [x] Student can submit extension request with reason category, custom reason, and duration (1–max_extension_days)
- [x] Cap validation rejects requests exceeding max_extension_days or max_total_extensions
- [x] Instructor sees pending extension requests queue (filterable by assignment, status)
- [x] Instructor can approve request → auto-extends affected checkpoint + subsequent checkpoints + finalDeadline; `deadline.extension_approved` logged to audit log
- [x] Instructor can reject request with required reason (min 20 chars); `deadline.extension_rejected` logged
- [x] Student notified when request is approved or rejected (in-app notification)
- [x] Instructor can directly extend all checkpoints for a student by N days (bulk, bypassing request); `deadline.extended` logged
- [x] Existing `extendDeadlineHandler` writes `deadline.extended` to audit log
- [x] Existing `unlockCheckpointHandler` writes `checkpoint.unlocked` to audit log
- [x] Student can see extension history on their assignment detail page
- [x] i18n translations for extension request form, queue, approval dialog, and notifications

**Test Plan:**

| Area                     | Approach                                                              |
| ------------------------ | --------------------------------------------------------------------- |
| Extension request schema | Unit test — Zod validation for request input                          |
| Request handler          | Unit test — creates request, validates caps, sends notification       |
| Approval handler         | Unit test — approves, extends checkpoints, writes audit log entry     |
| Rejection handler        | Unit test — rejects with reason, writes audit log entry               |
| Bulk extension           | Unit test — extends all checkpoints, writes audit log entries         |
| Audit log wiring         | Unit test — existing handlers produce correct audit entries           |
| UI — request form        | Unit test — form renders, validation works, submission fires mutation |
| UI — instructor queue    | Unit test — pending list renders, approve/reject actions work         |

---

## Phase 2: Group Assignments & Collaborative Workflows

Enable multiple students to work on the same assignment with shared checkpoints, collaborative submissions, and version comparison. This is the largest feature request for collaborative learning workflows.

---

### Track 2.1 — Group Assignments & Version Comparison

**Description:** Allow instructors to create group assignments where multiple students share checkpoint progress. Any group member can submit; the version history tracks who submitted what. A side-by-side version comparison view helps instructors track revisions across submissions.

**Dependencies:** V1 assignment management, file upload, checkpoint lifecycle.

**Status:** ⏳ Planned

**Estimated Scope:**

| Area                                                                 | Effort |
| -------------------------------------------------------------------- | ------ |
| Schema — `assignment_groups` + `assignment_group_members` tables     | Small  |
| Schema — `group_id` column on `submissions`                          | Small  |
| Template admin — max group size configuration                        | Small  |
| Assignment wizard — group student selection                          | Medium |
| Checkpoint sharing — group members share one checkpoint progress row | Large  |
| Version history timeline component                                   | Medium |
| Side-by-side version comparison UI                                   | Large  |
| Tests                                                                | Medium |

**Database Schema Changes:**

**New Table: `assignment_groups`**

| Column        | Type                                | Notes                                         |
| ------------- | ----------------------------------- | --------------------------------------------- |
| id            | serial (PK)                         |                                               |
| assignment_id | integer (FK → assignments, CASCADE) | NOT NULL                                      |
| name          | text                                | NULLABLE — auto-generated or instructor-named |
| max_size      | integer, not null                   | 2–10                                          |
| created_at    | timestamp                           | DEFAULT NOW()                                 |

**New Table: `assignment_group_members`**

| Column     | Type                                      | Notes                   |
| ---------- | ----------------------------------------- | ----------------------- |
| id         | serial (PK)                               |                         |
| group_id   | integer (FK → assignment_groups, CASCADE) | NOT NULL                |
| student_id | text (FK → users)                         | NOT NULL                |
| role       | text, not null                            | `contributor` \| `lead` |
| joined_at  | timestamp                                 | DEFAULT NOW()           |
| left_at    | timestamp                                 | NULLABLE                |

**Modified: `submissions`** (add column)

| Column   | Type              | Notes                                                    |
| -------- | ----------------- | -------------------------------------------------------- |
| group_id | integer, nullable | FK → assignment_groups (NULL for individual submissions) |

**Acceptance Criteria:**

- [ ] Admin can configure max group size per template (2–10, or disabled)
- [ ] Instructor creates group assignment by selecting multiple students as a group
- [ ] Group members share checkpoint state (one checkpoint progress per group)
- [ ] Any group member can upload a submission for the group
- [ ] Version history shows which group member submitted each version
- [ ] Side-by-side comparison shows current vs previous version metadata
- [ ] Individual (non-group) assignments remain fully functional
- [ ] Role guards: instructor-only group creation
- [ ] i18n translations for group UI labels and messages

**Test Plan:**

| Area                       | Approach                                                    |
| -------------------------- | ----------------------------------------------------------- |
| Group schema               | Unit test — Zod validation for group creation               |
| Handler — create group     | Unit test — creates group + members + shared checkpoints    |
| Handler — group submission | Unit test — any member can submit, audit trail captures who |
| Version comparison         | Unit test — comparison data returned correctly              |
| UI — wizard                | Unit test — group selection renders, validation works       |
| Regression                 | Full test suite must pass                                   |

---

## Phase 3: Enhanced Security & Authentication

Two-factor authentication using Better Auth's built-in `twoFactor` plugin, plus active session management.

---

### Track 3.1 — Two-Factor Authentication & Session Management

**Description:** Enable TOTP-based 2FA via Better Auth's `twoFactor` plugin. Users can enable/disable 2FA with an authenticator app, generate backup codes, view active sessions, and revoke sessions.

**Dependencies:** V1.3 (Better Auth base auth with Drizzle adapter).

**Status:** ✅ Complete (May 2026)

**Database Schema Changes:**

Added `twoFactor` table via Better Auth's Drizzle adapter with:

- `secret`, `backup_codes`, `verified`, `user_id` columns
- Index on `user_id` for session queries
- `twoFactorEnabled` boolean column on `users` table

**Acceptance Criteria:**

- [x] User can enable 2FA via authenticator app (TOTP QR code)
- [x] Backup codes (8) displayed on enable; user must confirm they've saved them
- [x] Login prompts for 6-digit TOTP code when 2FA is enabled
- [x] Backup code works as fallback when TOTP device is unavailable
- [x] User can disable 2FA with current password confirmation
- [x] Active sessions list shows device, IP, timestamp for all sessions
- [x] Session revocation works (revoke specific session or all other sessions)
- [ ] New device login notification (optional — v2.1 enhancement) — deferred
- [x] Email notification sent on 2FA enable/disable
- [x] All 2FA actions logged to audit log
- [x] i18n translations for 2FA and session management UI

**Test Results (at time of archiving):**

- 1448/1448 tests passing across 159 test files
- TypeScript typecheck passes with no errors
- eslint/prettier/lint-staged pass on all new files
- All new files under 500-line modularity limit
- Review fixes applied: removed encrypted backup codes retrieval from DB, fixed unauthorized response consistency, applied naming convention fixes

---

## Phase 4: Email Queue Infrastructure

Currently, all email sends (password reset, invitation, SLA alerts) are synchronous Resend API calls that block the server function response. This phase introduces a background email queue with retry logic for reliability.

---

### Track 4.1 — Background Email Queue with Retry

**Description:** Create an `email_queue` table. Refactor `sendPasswordResetEmail`, `sendInvitationEmail`, and `sendSLAAlertEmail` to enqueue rather than calling Resend synchronously. A background processor (SSR-only interval) dequeues and sends emails with exponential backoff retry.

**Dependencies:** V1 email sending infrastructure (`src/lib/email.ts`).

**Status:** ✅ Complete (May 2026)

**Estimated Scope:**

| Area                                          | Effort |
| --------------------------------------------- | ------ |
| Schema — `email_queue` table                  | Small  |
| Enqueue helpers (replace direct Resend calls) | Small  |
| Background processor (30s interval)           | Medium |
| Retry logic (3 attempts: 30s, 5min, 30min)    | Medium |
| Admin dashboard — queue status widget         | Small  |
| Tests                                         | Medium |

**Database Schema Changes:**

**New Table: `email_queue`**

| Column          | Type               | Notes                                           |
| --------------- | ------------------ | ----------------------------------------------- |
| id              | serial (PK)        |                                                 |
| recipient_email | text, not null     |                                                 |
| subject         | text, not null     |                                                 |
| body_html       | text, not null     |                                                 |
| template_type   | text, not null     | `password_reset` \| `invitation` \| `sla_alert` |
| status          | text, not null     | `pending` \| `sent` \| `failed`                 |
| attempts        | integer, default 0 |                                                 |
| last_attempt_at | timestamp          | NULLABLE                                        |
| error_message   | text               | NULLABLE — last failure reason                  |
| created_at      | timestamp          | DEFAULT NOW()                                   |

Index on `(status, created_at ASC)` for efficient dequeuing.

**Acceptance Criteria:**

- [x] Email queue table stores outbound emails with status tracking
- [x] All three email-sending functions enqueue instead of calling Resend directly
- [x] Background processor dequeues and sends pending emails every 30 seconds
- [x] Retry logic: 3 attempts with exponential backoff (30s, 5min, 30min)
- [x] After 3 failures → marked `failed` with stored error message
- [x] Admin dashboard shows queue status counts (pending/sent/failed)
- [x] No regression in email content or formatting
- [x] i18n translations for queue status labels
- [x] CHECK constraints on `template_type` and `status` columns in migration SQL

**Actual Files Created/Modified:**

| File                                                       | Purpose                                                                                                                                          |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `drizzle/migrations/0007_email_queue.sql`                  | Migration SQL — create `email_queue` table with indexes and CHECK constraints                                                                    |
| `src/db/schema/email-queue.ts`                             | **New:** Drizzle schema for `email_queue` table with `templateType` enum and `status` enum                                                       |
| `src/db/schema/index.ts`                                   | **Modified:** Re-export `emailQueue` schema                                                                                                      |
| `src/lib/email.ts`                                         | **Modified:** Refactored `sendPasswordResetEmail`, `sendInvitationEmail`, `sendSLAAlertEmail` to call `enqueueEmail` instead of Resend directly  |
| `src/lib/email-queue-processor.ts`                         | **New:** Background processor — Resend singleton, backoff logic (30s/5min/30min), max 10 items per tick, max 3 attempts                          |
| `src/lib/email-queue-init.ts`                              | **New:** 30s interval init with graceful shutdown signal handling                                                                                |
| `src/router.tsx`                                           | **Modified:** Dynamic SSR-only import of email queue init                                                                                        |
| `src/server/dashboard-admin.server.ts`                     | **Modified:** Added email queue status counts using FILTER clauses                                                                               |
| `src/components/dashboard/AdminDashboard.tsx`              | **Modified:** Added Email Queue widget card with 3 stat boxes (pending/sent/failed) using i18n keys                                              |
| `locales/en.json` / `locales/id.json`                      | **Modified:** Added `adminDashboard.emailQueue.{title,pending,sent,failed}` translation keys                                                     |
| `tests/unit/db/schema/email-queue.test.ts`                 | **New:** Schema test — checks column existence                                                                                                   |
| `tests/unit/server/email-queue-processor.test.ts`          | **New:** 249-line test covering dequeuing order, send success, failure, Resend error response, backoff, max attempts, null attempts, empty queue |
| `tests/unit/server/email.test.ts`                          | **New:** Tests that `sendPasswordResetEmail`, `sendInvitationEmail`, `sendSLAAlertEmail` enqueue with correct data                               |
| `tests/unit/server/dashboard-admin.test.ts`                | **New:** 212-line test covering auth, metrics, recent activity, escalation alerts, email queue counts                                            |
| `tests/unit/components/dashboard/admin-dashboard.test.tsx` | **New:** Component test for Email Queue widget rendering and count display                                                                       |
| `tests/integration/sla-escalation.test.ts`                 | **Modified:** Refactored from Resend mocks to DB mocks                                                                                           |
| `tests/unit/server/dashboard.test.ts`                      | **Modified:** Migrated admin handler tests out to `dashboard-admin.test.ts`                                                                      |

**Test Plan:**

| Area              | Approach                                                                |
| ----------------- | ----------------------------------------------------------------------- |
| Enqueue           | Unit test — functions write to `email_queue` instead of calling Resend  |
| Dequeue processor | Unit test — picks pending rows, calls Resend, updates status            |
| Retry logic       | Unit test — increments attempts, respects backoff, marks failed after 3 |
| Admin widget      | Unit test — renders queue status counts                                 |

**Test Results (at time of archiving):**

- 1359/1359 tests passing across 152 test files
- TypeScript typecheck passes with no errors
- eslint/prettier/lint-staged pass on all new files
- All new files under 500-line modularity limit
- Pre-push hook (typecheck + vitest coverage) passes
- Review fixes applied: CHECK constraints added to migration SQL, FROM address made configurable via env var

---

## Phase 5: Analytics & Export

Role-based analytics dashboards with performance metrics and CSV/PDF export capabilities. Builds on V1 dashboard widgets.

---

### Track 5.1 — Role-Based Analytics & Export

**Description:** Extend existing role-based dashboards (Track 7.2 in V1) with deeper analytics: instructor review performance, SLA breach trends, student completion rates, and admin system metrics. Add CSV/PDF export.

**Dependencies:** V1 dashboards (student, instructor, admin), notification system, review system.

**Status:** ⏳ Planned

**Estimated Scope:**

| Area                                                       | Effort |
| ---------------------------------------------------------- | ------ |
| `analytics_events` table + event capture hooks             | Medium |
| Student analytics widgets (completion rate, deadlines)     | Small  |
| Instructor analytics (review time, SLA trends, engagement) | Medium |
| Admin analytics (system metrics, usage reports)            | Small  |
| CSV export service (server-side generation)                | Medium |
| PDF export service                                         | Medium |
| Tests                                                      | Medium |

**Database Schema Changes:**

**New Table: `analytics_events`**

| Column      | Type              | Notes                                                           |
| ----------- | ----------------- | --------------------------------------------------------------- |
| id          | serial (PK)       |                                                                 |
| user_id     | text (FK → users) | NULLABLE for anonymous system events                            |
| action      | text, not null    | `assignment.created`, `submission.uploaded`, `review.completed` |
| entity_type | text              | `assignment` \| `submission` \| `review` \| `consultation`      |
| entity_id   | text              | ID of affected entity                                           |
| metadata    | jsonb             | NULLABLE — additional context                                   |
| created_at  | timestamp         | DEFAULT NOW()                                                   |

Index on `(action, created_at DESC)` for trend queries.

**Acceptance Criteria:**

- [ ] Student analytics show completion rate and upcoming deadlines
- [ ] Instructor analytics show average review time and SLA breach count/trend
- [ ] Admin analytics show user counts (by role), active assignments, escalations
- [ ] CSV export of assignment data works (instructor + admin)
- [ ] Export queries use indexes (no full table scans)
- [ ] No PII stored in analytics events beyond FK references
- [ ] Event capture hooks fire on key actions (assignment created, submission uploaded, review completed)
- [ ] i18n translations for analytics UI labels

**Test Plan:**

| Area                    | Approach                                            |
| ----------------------- | --------------------------------------------------- |
| Analytics event capture | Unit test — hooks fire and write correct events     |
| Query logic             | Unit test — aggregation queries return correct data |
| Export generation       | Unit test — CSV/PDF output matches expected format  |

---

## Phase 6: User Experience Enhancements

Settings hub, notification preferences, and file preview optimization — incremental UX improvements on existing infrastructure.

---

### Track 6.1 — Settings Hub

**Description:** A unified settings page accessible from the sidebar for all roles. Includes profile editing (name, avatar upload, read-only email), password change, 2FA & session management, language/theme preferences, and accessibility settings (reduced motion). Uses role-specific routes (`/student/settings`, `/instructor/settings`, `/admin/settings`) inheriting sidebar layouts.

**Dependencies:** V1 auth (password change), V1 theme/language infrastructure, Track 3.1 (2FA & Session Management components), V1 R2 storage client, V1 sidebar layouts.

**Status:** ✅ Complete (May 2026)

**Database Schema Changes:**

**Modified: `users`** (add column)

| Column   | Type  | Notes                                               |
| -------- | ----- | --------------------------------------------------- |
| settings | jsonb | NULLABLE — `{ reducedMotion: boolean }` preferences |

**Acceptance Criteria:**

- [x] Settings hub page accessible from sidebar for all three roles — `/student/settings`, `/instructor/settings`, `/admin/settings`
- [x] Profile name editing saves with validation (non-empty, max 100)
- [x] Avatar upload via presigned URL → R2 `avatars/` prefix → `users.image` updated
- [x] Current avatar shown as circle; initials fallback when none
- [x] Email displayed read-only
- [x] Password change via Better Auth with validation (min 8 chars, confirm match)
- [x] Language switcher and theme toggle work on settings page (reuse existing `useI18n()` and `useTheme()`)
- [x] Reduced motion toggle persists via `settings` jsonb
- [x] 2FA and Session Management remain functional unchanged (reuse existing components)
- [x] All new UI strings translated in EN and ID
- [x] Migration adds `settings` column to `users`
- [x] No regression — all existing tests pass

**Actual Files Created/Modified:**

| File                                               | Action                                        |
| -------------------------------------------------- | --------------------------------------------- |
| `src/db/schema/users.ts`                           | **Modified:** Added `settings` jsonb column   |
| `src/server/settings.ts`                           | **New:** Zod schemas + `createServerFn` stubs |
| `src/server/settings.server.ts`                    | **New:** Server handlers                      |
| `src/routes/_student/settings.tsx`                 | **New:** Minimal route, imports SettingsPage  |
| `src/routes/_instructor/settings.tsx`              | **New:** Minimal route, imports SettingsPage  |
| `src/routes/_admin/settings.tsx`                   | **New:** Minimal route, imports SettingsPage  |
| `src/routes/_authenticated/settings.tsx`           | **Removed:** Replaced by role-specific routes |
| `src/components/settings/SettingsPage.tsx`         | **New:** Shared settings hub component        |
| `src/components/settings/ProfileSection.tsx`       | **New:** Profile editing + avatar upload      |
| `src/components/settings/PasswordSection.tsx`      | **New:** Inline password change form          |
| `src/components/settings/AppearanceSection.tsx`    | **New:** Language EN/ID + theme toggles       |
| `src/components/settings/AccessibilitySection.tsx` | **New:** Reduced motion toggle                |
| `src/components/layout/student-sidebar.tsx`        | **Modified:** Added Settings link             |
| `src/components/layout/instructor-sidebar.tsx`     | **Modified:** Added Settings link             |
| `src/components/layout/admin-sidebar.tsx`          | **Modified:** Added Settings link             |
| `locales/en.json`                                  | **Modified:** Added settings section keys     |
| `locales/id.json`                                  | **Modified:** Added ID translations           |
| `scripts/generate-i18n-types.ts`                   | **Modified:** Added settings i18n type defs   |

**Test Results (at time of archiving):**

- 1537/1537 tests passing across 170 test files
- TypeScript typecheck passes with no errors
- eslint/prettier/lint-staged pass on all new files
- All new files under 500-line modularity limit
- Pre-push hook (typecheck + vitest coverage) passes
- Coverage for new `settings.server.ts` is 100%
- Review fixes applied: hardcoded "Loading..." strings replaced with `t('common.loading')` i18n keys
- **Deviation:** Used native checkbox for reduced motion toggle (no shadcn/ui Switch component available)

---

### Track 6.2 — Notification Preferences

**Description:** Allow users to configure per-event-type, per-channel notification preferences. Filters are applied at notification creation time. Backed by a `notification_preferences` table.

**Dependencies:** V1 notification system (Track 7.1).

**Status:** ⏳ Planned

**Estimated Scope:**

| Area                                                | Effort |
| --------------------------------------------------- | ------ |
| Schema — `notification_preferences` table           | Small  |
| Preference CRUD handler                             | Small  |
| Notification creation — apply preferences as filter | Small  |
| UI — preferences form in settings                   | Medium |
| Tests                                               | Small  |

**Database Schema Changes:**

**New Table: `notification_preferences`**

| Column     | Type                           | Notes                                                                                                |
| ---------- | ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| id         | serial (PK)                    |                                                                                                      |
| user_id    | text (FK → users, CASCADE)     | NOT NULL                                                                                             |
| event_type | text, not null                 | `review_completed`, `revision_requested`, `deadline_extended`, `consultation_verified`, `sla_breach` |
| channel    | text, not null                 | `in_app` \| `email`                                                                                  |
| enabled    | boolean, default true          |                                                                                                      |
| UNIQUE     | (user_id, event_type, channel) |                                                                                                      |

**Acceptance Criteria:**

- [ ] Users can toggle notification preferences per event type and channel
- [ ] Default: all enabled
- [ ] Notification creation filters out disabled preferences
- [ ] Preferences persist across sessions
- [ ] i18n translations for preference labels

---

### Track 6.3 — File Preview Optimization

**Description:** Optimize PDF preview to fetch only first 5 pages (via HTTP Range headers) instead of the full 25MB file. Add inline PDF viewer with page navigation. Show DOCX metadata without downloading the full file.

**Dependencies:** V1 file upload (Track 4.1), R2 storage.

**Status:** ⏳ Planned

**Estimated Scope:**

| Area                                               | Effort |
| -------------------------------------------------- | ------ |
| PDF range request (first 5 pages via Range header) | Medium |
| Inline PDF viewer component                        | Medium |
| DOCX metadata extraction + display                 | Small  |
| Tests                                              | Small  |

**Acceptance Criteria:**

- [ ] PDF preview requests only first 5 pages via `Range: bytes=...` header
- [ ] Inline PDF viewer shows pages with zoom and navigation
- [ ] DOCX files show metadata (page count if available, author, created date) + download prompt
- [ ] Existing full download still works when user clicks "Download"
- [ ] i18n translations for preview UI labels

---

## Phase 7: Testing Infrastructure

Integration tests against a real PostgreSQL database, deferred from V1.

---

### Track 7.1 — Vitest Integration Tests

**Description:** Write integration tests for critical server function flows: assignment creation with DB transaction verification, file upload + submission lifecycle, review pass/revise with SLA breach detection, and consultation verification gating. Integration tests use a test database with real Drizzle queries (not mocked handler internals).

**Dependencies:** V1 server functions (assignments, submissions, reviews, consultations).

**Status:** ⏳ Planned

**Estimated Scope:**

| Area                                                                       | Effort |
| -------------------------------------------------------------------------- | ------ |
| Test database setup (Docker Compose test instance or transaction rollback) | Small  |
| Assignment creation integration test                                       | Medium |
| Submission + review lifecycle integration test                             | Medium |
| Consultation gating integration test                                       | Medium |
| SLA breach + deadline adjustment integration test                          | Medium |
| CI integration (separate step or conditional run)                          | Small  |

**Test Plan:**

| Area                | Scenario                                                                  | Verification                                  |
| ------------------- | ------------------------------------------------------------------------- | --------------------------------------------- |
| Assignment creation | Create template → create assignment → assign students                     | Checkpoints created in DB with correct states |
| Submission flow     | Student submits file → checkpoint transitions to `submitted`              | State change persists in DB                   |
| Review pass         | Instructor passes submission → checkpoint becomes `passed`, next unlocked | State transitions verified in DB              |
| Review revise       | Instructor revises → checkpoint becomes `revise`                          | Revision deadline stored correctly            |
| SLA breach          | Late review → deadlines extended                                          | DueDates adjusted in DB                       |
| Consultation gating | Submit with insufficient consultations → blocked                          | Error returned, no state change               |

**Acceptance Criteria:**

- [ ] Integration tests run against a real PostgreSQL database (Docker Compose)
- [ ] Tests use transaction rollback (no persistent data between runs)
- [ ] Critical server function flows are covered (assignment creation, submit, review, consultation gate)
- [ ] Integration tests can be run separately from unit tests (`pnpm test:integration`)
- [ ] CI pipeline runs integration tests as a separate step (not blocking pre-push)

---

## Priority Summary

| Priority         | Track                          | Rationale                                                                |
| ---------------- | ------------------------------ | ------------------------------------------------------------------------ |
| 🔴 **Immediate** | Track 1.1 (Audit Log)          | Foundation — all later tracks write to it; enables accountability        |
| 🔴 **Immediate** | Track 1.2 (DueDates)           | Fixes broken V1 deadline logic; unblocks all deadline-dependent features |
| 🔴 **High**      | Track 1.3 (Extensions)         | Depends on Track 1.1 + 1.2; student/instructor extension workflow        |
| 🔴 **High**      | Track 4.1 (Email Queue)        | Removes synchronous Resend bottleneck; improves reliability              |
| 🟠 **Medium**    | Track 2.1 (Groups)             | Largest feature request; significant scope                               |
| 🟡 **Lower**     | Tracks 3.1, 5.1, 6.2, 6.3, 7.1 | Security, analytics, UX, testing — valuable but not blocking             |

## Implementation Strategy

### Track Lifecycle

1. **Spec** → Create `conductor/tracks/<id>/spec.md` with detailed requirements
2. **Plan** → Create `conductor/tracks/<id>/plan.md` with step-by-step tasks
3. **Red** → Write failing tests
4. **Green** → Implement until tests pass
5. **Archive** → Move track to `conductor/archive/`; update this roadmap

### TDD Checklist (per track)

- [ ] Feature spec in `conductor/tracks/<id>/spec.md`
- [ ] Implementation plan in `conductor/tracks/<id>/plan.md`
- [ ] Failing tests written (Red phase)
- [ ] Features implemented (Green phase)
- [ ] Tests pass with coverage thresholds (lines 80%, functions 80%, branches 72%, statements 79%)
- [ ] `pnpm typecheck` passes
- [ ] Pre-push gate passes (`pnpm typecheck && pnpm vitest run --coverage`)
- [ ] Track archived in `conductor/archive/`
- [ ] Implementation notes added to `plan.md`

### Git Workflow

- Commit format: `<type>(<scope>): <description>`
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
- Pre-push: `pnpm typecheck && pnpm vitest run --coverage`
- Pre-commit: `pnpm lint-staged` (ESLint, Prettier, modularity check via `scripts/check-modularity.js`)

---

## Appendix A: Deferred to v3 (Excessive for v2)

The following features were evaluated against SIMAK's core mission — tracking assignment progress through checkpoints with feedback cycles — and determined to be excessive for the v2 iteration. They add significant complexity relative to their value for the core use case and introduce operational overhead (new services to run, new infrastructure dependencies). These are tracked for possible v3.

### Web Push Notifications

**Original context:** Phase 4, complement to in-app polling.

**Why deferred:** The existing 15-second polling interval is highly responsive for this use case. Students and instructors access SIMAK through the browser — if they are off-platform, email (already queued reliably by Track 4.1) handles out-of-app delivery. Web Push would add: VAPID key management, a service worker registration flow, a `push_subscriptions` table, browser permission prompts across 4+ event types, and ongoing maintenance of push infrastructure for marginal benefit.

**Revisit when:** User feedback explicitly requests push notifications. Track 4.1 provides a delivery foundation that Web Push could leverage.

### Reports Builder with Scheduling

**Original context:** Phase 5, scheduled report generation with daily/weekly/monthly delivery.

**Why deferred:** This is essentially a BI tool. Configurable scheduled reports require: `report_configs` and `report_deliveries` tables, a cron-based scheduler, a report generation engine, email delivery integration, and an entire report configuration UI. Track 5.1 already provides CSV/PDF export on demand — which covers 95% of the real use case ("I need to export this data right now"). Scheduled reports add a whole product layer on top.

**Revisit when:** Admins consistently request recurring report delivery. The `analytics_events` infrastructure from Track 5.1 can be reused.

### Redis Caching Layer

**Original context:** Phase 6, session cache and dashboard data cache.

**Why deferred:** Premature optimization for a university system with dozens (not thousands) of concurrent users. Session lookups to PostgreSQL are not a bottleneck at this scale. Adding Redis introduces a new service to deploy, monitor, and troubleshoot. The existing architecture works fine for the expected load.

**Revisit when:** Profiling shows dashboard load times exceeding 2 seconds, or concurrent users exceed 200.

### PgBouncer Connection Pooling

**Original context:** Phase 6, server-side connection pooling via PgBouncer.

**Why deferred:** Even more premature than Redis. Postgres.js already handles client-side pooling. PgBouncer adds a new Docker service, connection routing logic, and configuration surface area for a system that doesn't yet have connection pressure. The `postgres` driver's built-in pooling is sufficient for the foreseeable future.

**Revisit when:** Connection pool exhaustion is observed under production load.

### Playwright E2E Tests

**Original context:** Phase 8, end-to-end browser testing.

**Why deferred:** E2E tests are brittle, slow to run, and require significant maintenance. For a team of one, the ROI is not there. Integration tests (Track 7.1) catch the same class of regressions using real database queries, faster, and more reliably. Playwright would also require: a headless Chromium install in CI, test data seeding/cleanup scripts, and ongoing maintenance of flaky selectors.

**Revisit when:** The product stabilizes and a second developer joins. Integration tests from Track 7.1 provide a foundation to build E2E upon.

---

## Appendix B: Post-MVP UX Improvements (Confusing Flows)

The following items were identified during V1 codebase analysis as confusing user flows. These are tracked separately from the phased roadmap above and may be folded into active tracks based on user feedback during v2 development.

| #   | Issue                                                                                                                                            | Fix                                                                                                       | v2 Target |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | --------- |
| 1   | **Checkpoint Unlock Blocking Reasons** — Students see "LOCKED" but don't know WHY (previous checkpoint not passed vs insufficient consultations) | Display blocking reasons prominently on checkpoint cards with clear messaging                             | v2.1      |
| 2   | **Consultation Gating Visibility** — Students don't know consultations are required for checkpoint submission                                    | Display consultation requirement on each checkpoint with progress indicator                               | v2.1      |
| 3   | **Review Queue Assignment Context** — Queue shows submissions without clear assignment context                                                   | Sort/filter by assignment with "Assignment: [Name]" badges on each item                                   | v2.2      |
| 4   | **State Terminology Consistency** — Mixed terminology between technical states and display labels                                                | Standardize: "Submitted" (file uploaded), "Pending Review" (instructor), "Under Review" (being evaluated) | v2.2      |
| 5   | **Version History Clarity** — Resubmission creates new record but old one stays — unclear which is current                                       | Show "Version X of Y" badge with current version highlighted                                              | v2.3      |
| 6   | **SLA Escalation Notifications** — Deadlines extend automatically but no one is notified                                                         | Notify student + instructor when deadlines are extended (partially covered by Track 1.2)                  | v2.3      |
| 7   | **Dashboard Metric Context** — Numbers lack meaning (e.g., "10 pending reviews")                                                                 | Show breakdown with contextual labels                                                                     | v2.4      |

_Note: Items 1–2 are partially addressed by V1 code (blocking reasons already display in `CheckpointCard`). This appendix captures remaining polish work._

---

## Next Steps

1. ✅ Roadmap v2 finalized — excessive features stripped to Appendix A
2. ✅ Track 1.1 — Comprehensive Audit Log (Complete)
3. ✅ Track 1.2 — Estimated Duration & Auto-Calculated DueDates (Complete)
4. ✅ Track 1.3 — Deadline Extension Workflow (Complete)
5. ✅ Track 4.1 — Background Email Queue with Retry (Complete)
6. ✅ Track 3.1 — Two-Factor Authentication & Session Management (Complete)
7. ✅ Track 6.1 — Settings Hub (Complete)
8. [ ] Select next track to implement (recommended: **Track 2.1 — Group Assignments & Version Comparison**)
9. [ ] Create implementation plan in `conductor/tracks/<id>/plan.md`
10. [ ] Write failing tests
11. [ ] Implement features
12. [ ] Verify & archive

---

_Document Status: Finalized for v2. Features in Appendix A deferred to v3. Approved for track planning._
