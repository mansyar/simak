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
- oxlint/oxfmt/lint-staged pass on all new files
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
- oxlint/oxfmt/lint-staged pass on all new files
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
- oxlint/oxfmt/lint-staged pass on all new files
- All new files under 500-line modularity limit
- Pre-push hook (typecheck + vitest coverage) passes
- Review fixes applied: CHECK constraints added to migration SQL, FROM address made configurable via env var

---

### Track 4.2 — Email Pipeline Hardening

**Description:** Harden the background email queue against concurrent duplicate delivery and stale-row lockup, and eliminate stored-XSS vectors in email bodies. Adds a `processing` status, transactional claim with `FOR UPDATE SKIP LOCKED`, an in-process `isRunning` guard, stale-row reclaim (rows stuck in `processing` > 5 min), and HTML-escaping of all user-derived interpolations in email templates.

**Dependencies:** Track 4.1 (`email_queue` table, processor, enqueue helpers).

**Status:** ✅ Complete (June 2026)

**Estimated Scope:**

| Area                                                | Effort |
| --------------------------------------------------- | ------ |
| Schema — `processing` status enum value              | Small  |
| Transactional claim (`FOR UPDATE SKIP LOCKED`)       | Medium |
| `isRunning` re-entrancy guard                        | Small  |
| Stale-row reclaim (> 5 min threshold)                | Small  |
| `escapeHtml` helper + apply to email templates       | Small  |
| Tests (unit + integration)                           | Medium |

**Database Schema Changes:**

**Modified Table: `email_queue`** — `status` enum extended from `pending | sent | failed` to `pending | processing | sent | failed`. Migration `0001_email_queue_processing_status.sql` adds the `email_queue_status_check` CHECK constraint and a companion rollback file at `drizzle/migrations/rollback/0001_email_queue_processing_status.rollback.sql` (per SQL styleguide §5.1).

**Acceptance Criteria:**

- [x] `processing` status added to `email_queue.status` enum (migration 0001)
- [x] Processor claims rows in a transaction using `FOR UPDATE SKIP LOCKED`; marks `processing` inside the tx; sends via Resend **outside** the tx (no long-lived locks)
- [x] `isRunning` guard prevents overlapping processor ticks within a single process
- [x] Rows stuck in `processing` for > 5 minutes are reclaimed to `pending` at the start of each tick
- [x] `escapeHtml` helper introduced; applied to all user-derived interpolations in `src/lib/email.ts` (3 functions) and `src/server/two-factor.server.ts` (2 emails)
- [x] No regression in email content or formatting (NFR-1)
- [x] Multiple concurrent workers do not produce duplicate deliveries (NFR-2, integration-tested)
- [x] i18n unaffected (NFR-3)

**Actual Files Created/Modified:**

| File                                                         | Purpose                                                                                                          |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `drizzle/migrations/0001_email_queue_processing_status.sql`  | Migration — add `processing` to status enum + `email_queue_status_check` CHECK constraint                       |
| `drizzle/migrations/rollback/0001_email_queue_processing_status.rollback.sql` | **New:** Companion rollback file (drops the CHECK constraint), per SQL styleguide §5.1            |
| `src/db/schema/email-queue.ts`                               | **Modified:** Added `processing` to the status enum                                                              |
| `src/lib/email-queue-processor.ts`                           | **Modified:** Stale reclaim, transactional `SKIP LOCKED` claim, `isRunning` guard, send-outside-tx              |
| `src/lib/email-queue-init.ts`                                | **Modified:** Init wiring for the hardened processor                                                             |
| `src/lib/email.ts`                                           | **Modified:** `escapeHtml` applied to user-derived fields in `sendPasswordResetEmail`, `sendInvitationEmail`, `sendSLAAlertEmail` |
| `src/server/two-factor.server.ts`                            | **Modified:** `escapeHtml` applied to user name in 2FA enable/disable emails                                     |
| `tests/unit/server/email-queue-processor.test.ts`            | **Modified:** Coverage for stale reclaim, SKIP LOCKED claim, isRunning guard, send-outside-tx                    |
| `tests/integration/lib/email-queue-processor.test.ts`        | **New:** Multi-worker duplicate-delivery prevention against live PostgreSQL (opt-in, not in pre-push)           |

**Test Plan:**

| Area                    | Approach                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| Stale reclaim            | Unit test — `processing` rows older than 5 min reset to `pending`                         |
| Transactional claim     | Unit test — `FOR UPDATE SKIP LOCKED` claim marks `processing` inside tx; Resend called outside |
| isRunning guard          | Unit test — overlapping ticks are skipped                                                 |
| escapeHtml              | Unit test — user-derived fields are escaped before interpolation                          |
| Multi-worker no-dup      | Integration test — two workers against live PostgreSQL claim disjoint rows, no duplicates |

**Test Results (at time of archiving):**

- 2183/2183 unit tests passing across 229 test files
- TypeScript typecheck passes with no errors
- oxlint passes (0 errors; 1 pre-existing unrelated warning)
- Integration test passes against live PostgreSQL (run via `pnpm test:integration`)
- Review fixes applied: restored pre-push coverage gate to `pnpm test:coverage` (excludes integration), added missing migration rollback file

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

### Track 6.0 — UI Redesign (Warm Academic Design System)

**Description:** Complete visual redesign of SIMAK's user interface implementing the "Warm Academic" design system. Frontend-only change that restyles all existing pages and components while preserving all current functionality. Includes new color palette (warm neutrals), typography (Fraunces serif headings, DM Sans body), redesigned sidebar navigation (dark navy, 3 role variants), sticky header with backdrop blur, metric cards with color-coded borders, zebra-striped tables, semantic badges, and meaningful empty states.

**Dependencies:** None (visual-only, no backend changes).

**Status:** ✅ Complete (June 2026)

**Key Changes:**

| Area               | Changes                                                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Design Tokens      | CSS custom properties in `global.css`, Tailwind config — warm neutral palette, semantic colors, typography scale                                                   |
| Shared Layout      | Redesigned sidebar (admin, instructor, student variants) with dark navy bg, active border indicators, section labels, user card. Sticky header with backdrop blur  |
| Core UI Components | `MetricCard` (color-coded top border, tinted icon bg, hover lift), `EmptyState` (64px icon, dashed border, CTA), zebra tables with sticky headers, semantic badges |
| Admin Pages        | Dashboard (metric cards, activity feed, escalation alerts), Users, Templates, Audit Log, Settings                                                                  |
| Instructor Pages   | Dashboard (SLA badges, pending reviews), Assignments, Reviews                                                                                                      |
| Student Pages      | Dashboard (progress bars, deadline urgency), Assignments, Checkpoints                                                                                              |
| Auth Pages         | Login, Password Setup, 2FA — centered card layout                                                                                                                  |
| Font Loading       | Self-hosted Fraunces + DM Sans in `public/fonts/`, `font-display: swap`                                                                                            |
| Testing            | Updated test assertions to match new CSS classes                                                                                                                   |

**Acceptance Criteria:**

- [x] All pages use the new Warm Academic design system
- [x] Metric cards, badges, and status indicators use semantic colors
- [x] Fraunces for headings, DM Sans for body text throughout
- [x] Dark mode with system default + manual toggle, persists across sessions
- [x] Responsive layouts work at 320px–1920px viewports
- [x] WCAG 2.1 AA compliance maintained
- [x] All existing functionality preserved — visual-only changes
- [x] Tests pass (1751 passed, 2 pre-existing date-sensitive failures unrelated to this track)
- [x] Review fix: `getActivityDotColor` in AdminDashboard now differentiates activity types

**Test Results (at time of archiving):**

- 1751/1753 tests passing (2 pre-existing date-sensitive failures: `assignments-duration.test.ts`, `due-dates.test.ts`)
- TypeScript typecheck passes with no errors
- All files under 500-line modularity limit

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
- oxlint/oxfmt/lint-staged pass on all new files
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

### Track 6.4 — UI Consistency for Student-Facing UI

**Description:** Focused visual consistency pass across all student-facing routes and components. The Tailwind v4 design system (CSS variables, semantic colors, Fraunces/DM Sans typography, dark mode) established in Track 6.0 was inconsistently applied across the student dashboard, assignments list, assignment detail, consultations, extensions, and shared layout components. This refactor unifies the visual treatment without adding new features or changing business logic. Scope is frontend-only.

**Dependencies:** Track 6.0 (UI Redesign — design tokens and shared components). V1 student routes (assignments, checkpoints, consultations, extensions, settings).

**Status:** ✅ Complete (June 2026)

**Estimated Scope:**

| Area                                                       | Effort |
| ---------------------------------------------------------- | ------ |
| Shared component foundation (`Progress` primitive, `EmptyState` `compact` prop, `CardTitle` font) | Small  |
| Card & dashboard (template-type badge, progress bar, empty state density) | Medium |
| Detail & checkpoint timeline (semantic colors, tab styling) | Medium |
| Sidebar & cross-cutting routes (active-state, status badges) | Medium |
| Tests + quality gates                                      | Medium |

**Acceptance Criteria:**

- [x] Template-type label looks identical in dashboard card, assignment card, and assignment detail header
- [x] `CheckpointCard` uses only semantic color tokens; no literal Tailwind colors remain for state styling
- [x] Progress percentage always renders as `<number>%`, never bare `%` (uses `?? 0` fallback)
- [x] Dashboard widget empty states use the new `compact` variant — no longer dominate card height
- [x] Assignment detail tabs have a clearly distinguishable active state (`px-3`, `rounded-t-md`, `hover:bg-muted/50`, `data-state` attribute)
- [x] Sidebar active item is highlighted with full-width `bg-sidebar-accent`, no `border-l-[3px]` indentation
- [x] `StudentAssignmentCard` no longer uses the rogue `violet-500` gradient accent
- [x] `CardTitle` uses `font-sans`; page headings (`h1`–`h2`) remain Fraunces
- [x] `ConsultationList`, `ExtensionHistoryList`, and `ExtensionRequestForm` use semantic `Badge` variants instead of inline spans
- [x] Sidebar logout hover uses `destructive/10 destructive` instead of `red-500/10 red-400`
- [x] `listStudentAssignmentsHandler` computes `progressPercent` per assignment via batched `inArray` query
- [x] All existing tests pass and new component tests cover the changed UI behavior
- [x] `pnpm typecheck`, `pnpm lint`, and `pnpm test` pass without errors
- [x] Review cleanup: removed unused `Tabs` component + its test, removed a fake test file that asserted on hardcoded class strings, reverted an unrelated `vitest.config.ts` change, and removed a destructive `tests/integration/db/migrate.test.ts`

**Actual Files Created/Modified:**

| File                                                       | Action                                                                                             |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/components/ui/progress.tsx`                           | **New:** `Progress` component with `value` / `max` / `label` / `showValue` props                   |
| `src/components/ui/card.tsx`                               | **Modified:** `CardTitle` `font-heading` → `font-sans`                                             |
| `src/components/ui/empty-state.tsx`                        | **Modified:** Added `compact` prop for dashboard widget density                                    |
| `src/components/student/assignments/StudentAssignmentCard.tsx` | **Modified:** `Badge` for template type, `Progress` for progress bar, `?? 0` fallback, removed `violet-500` |
| `src/components/student/assignments/AssignmentDetailHeader.tsx` | **Modified:** `Badge` variant `default` → `outline`                                             |
| `src/components/student/assignments/CheckpointCard.tsx`    | **Modified:** `stateConfig` uses semantic tokens (`border-l-success/info/warning/error/primary/border`); blocking reasons and overdue text use `text-warning` (not error) |
| `src/components/dashboard/StudentDashboard.tsx`             | **Modified:** `Badge` outline, `Progress` component, `?? 0` fallback, `compact` on all four `EmptyState` usages |
| `src/components/layout/{student,instructor,admin}-sidebar.tsx` | **Modified:** Removed `border-l-[3px]`, kept full-width `bg-sidebar-accent`; logout hover uses `destructive/10 destructive` |
| `src/components/consultations/ConsultationList.tsx`         | **Modified:** Inline status spans → semantic `Badge` variants                                       |
| `src/components/student/extensions/ExtensionHistoryList.tsx` | **Modified:** Inline status spans → semantic `Badge` variants                                      |
| `src/components/student/extensions/ExtensionRequestForm.tsx` | **Modified:** `text-green-600` → `text-success`                                                     |
| `src/routes/_authenticated/student/assignments/$id.tsx`     | **Modified:** Tabs strengthened (`px-3`, `rounded-t-md`, `hover:bg-muted/50`, `data-state`); `progressPercent ?? 0` |
| `src/server/assignments-extras.server.ts`                   | **Modified:** `listStudentAssignmentsHandler` computes `progressPercent` per assignment (batched `inArray` query) |
| `tests/integration/db/migrate.test.ts`                      | **Deleted:** 136 lines — `beforeAll` dropped all tables in `public` and `drizzle` schemas; unsafe in `pnpm test` |
| `tests/unit/components/{progress,StudentAssignmentCard,empty-state,card,StudentDashboard,checkpoint-card,assignment-detail-header,admin-sidebar,student-sidebar,instructor-sidebar,consultations/consultation-list}.test.tsx` | **New / modified:** coverage for all changed components |
| `vitest.config.ts`                                          | **Reverted:** `importDurations` restored to original (unrelated to track)                          |

**Test Results (at time of archiving):**

- 1808/1808 tests passing across 190 test files
- TypeScript typecheck passes with no errors
- oxlint/oxfmt pass on all files
- All files under 500-line modularity limit
- Pre-push gate (`pnpm typecheck && pnpm vitest run --coverage`) passes — coverage thresholds met (80% lines / 80% functions / 72% branches / 79% statements)

---

### Track 6.5 — UI Consistency for Instructor-Facing UI

**Description:** Refactor pass on the instructor surface to extract missing shared primitives, fix functional UI bugs, unify duplicated styling, and close a systemic `createServerFn` type-gap that forced `// @ts-expect-error` on every instructor route loader. The audit identified 23 issues (5 functional, 10 high-impact visual, 5 medium, 3 low). This track is a refactor — no new product features, no business-logic changes. Scope is the instructor surface only (`src/routes/_authenticated/instructor/**`, `src/components/instructor/**`, `src/components/dashboard/InstructorDashboard.tsx`, and new shared primitives under `src/components/ui/` + `src/lib/` + `src/hooks/`). The single mechanical change in `admin/templates/index.tsx` was included to delete the duplicate `TemplatePagination` component.

**Dependencies:** Track 6.0 (UI Redesign — design tokens and shared components). Track 6.4 (Student-Facing UI Consistency — established the pattern this track follows). V1 instructor routes (assignments, reviews, extensions, settings).

**Status:** ✅ Complete (June 2026)

**Estimated Scope:**

| Area                                                                                                          | Effort |
| ------------------------------------------------------------------------------------------------------------- | ------ |
| Foundational primitives — `Textarea`, `PageHeader`, `BackLink`, `TemplateTypeBadge`, `CountBadge`, `formatDate` | Medium |
| Functional bug fixes — review-queue filter, SLA badge unification, i18n key split, dead-code removal            | Small  |
| Surface migration — 7 pages to `<PageHeader>`, 3 sites to `<BackLink>`, 3 to `<TemplateTypeBadge>`, 4 to `<Textarea>`, 3 to `<Skeleton>`, etc. | Large |
| Design system cleanup — hardcoded Tailwind palette → design tokens; redundant `Button` className removed; 9 wizard + 2 review-form hardcoded English strings → i18n | Medium |
| Structural cleanups — split 446-line assignment detail page into thin route + 5 subcomponents; dedupe `Pagination` + `RefreshButton`; add `<Tabs>` primitive | Large |
| Systemic type fix — apply `.inputValidator(Schema)` builder pattern across 20 server functions; remove `// @ts-expect-error` from all instructor loaders | Large (gated) |

**Acceptance Criteria:**

- [x] Review-queue assignment filter dropdown is populated with the instructor's assignments
- [x] Instructor dashboard "Pending Review Queue" widget and the review-queue "Status" column render identical SLA badges (same `SLABadge` component, same variants)
- [x] All 7 instructor pages use `<PageHeader>` and render the same canonical heading (`font-display text-3xl text-foreground`)
- [x] All 3 inlined template-type pills use `<TemplateTypeBadge>`; all 4 raw `<textarea>` use `<Textarea>`; all 3 hand-rolled skeletons use `<Skeleton>`; `ReviewQueueFilters` uses `<Select>` and is populated
- [x] All 6+ hand-rolled `bg-card` wrappers in the instructor surface use `<Card>`; 4 overview cards on the assignment detail page use `<MetricCard>`
- [x] All date strings in the instructor surface are formatted via `formatDateShort` / `formatDateLong` / `formatDateTimeShort` (locale-aware EN+ID)
- [x] The duplicated `instructorAssignments.details.studentsProgress` key is split into two distinct keys (`totalStudents` and `studentsProgress`); the dead `colSpan` branch in `ReviewQueueTable` is removed; the redundant outer guard in `$submissionId.tsx:134` is removed
- [x] The local `SLABadge` in `InstructorDashboard.tsx` is deleted; the shared `SLABadge` is reused
- [x] `instructor/assignments/$id.tsx` is ≤120 lines and is composed of `<PageHeader>` + 4 tab subcomponents
- [x] Both refresh buttons use `<RefreshButton>` + `useRefreshSearch`; both paginations (admin templates, instructor reviews + assignments) use the shared `<Pagination>` primitive (2 duplicates deleted)
- [x] All hardcoded Tailwind palette colours (`green-*`, `orange-*`, `violet-500`, `blue-100`, etc.) in the instructor surface are replaced with design tokens (`text-success`, `text-warning`, `Badge` variants)
- [x] All 9 hardcoded English validation messages in `AssignmentWizard`, 2 in `ReviewForm`, the pagination page-of-total label, and `ReviewHistory`'s labelled date are replaced with i18n keys
- [x] The `as TranslationKey` cast in extension dialogs is removed (the missing `extensions.queue.reason` key is added)
- [x] `pnpm generate:i18n` succeeds; every new key exists in both `locales/en.json` and `locales/id.json`; an i18n regression test guards new keys
- [x] No `// @ts-expect-error` remains in any instructor route loader (or student loader that benefits from the systemic type fix)
- [x] `pnpm typecheck`, `pnpm lint`, and `pnpm vitest run` all pass; coverage thresholds met (80% lines / 80% functions / 72% branches / 79% statements)
- [x] Review fixes applied: `.inputValidator()` completed in `src/server/assignments.ts` (5 additional functions), 3 unused `@ts-expect-error` directives removed from student routes, inline `// TODO` comments added to the 5 remaining `as unknown as` casts (data-shape mismatch follow-up), fragile relative imports in 3 new subcomponents fixed to `@/` alias, `description=""` workarounds dropped now that `EmptyState.description` is optional

**Test Results (at time of archiving):**

- 1913/1913 tests passing across 199 test files
- TypeScript typecheck passes with no errors
- oxlint passes with 0 errors (1 pre-existing warning in `ReviewForm.tsx:61`)
- All files under 500-line modularity limit
- Pre-push gate (`pnpm typecheck && pnpm vitest run --coverage`) passes — coverage thresholds met (84.94% lines, 84.28% statements, 80.86% branches, 80% functions)
- New unit tests for every primitive, i18n regression test, 44 test-file mock updates to support the new `.inputValidator()` server-fn pattern
- Reference: audit `conductor/audits/instructor-ui-consistency-2026-06-19.md`; track plan `conductor/tracks/instructor-ui-consistency_20260619/plan.md` (now archived)

---

### Track 6.6 — UI Consistency for Admin-Facing UI

**Description:** Refactor pass on the admin surface to adopt shared UI primitives (`PageHeader`, `RefreshButton`, `BackLink`, `Skeleton`, `EmptyState`, `Pagination`, `Select`, `Card`), extract new primitives (`AlertBanner`, `QuickActionCard`, `EmailQueueStat`, `ListRow`), fix 12 audit-identified bugs (native dialog replacement, type-filter missing types, setup-link security, hardcoded colors, i18n gaps), unify role config and audit-event colors, and close the `createServerFn` type-gap with `.inputValidator()` across admin server functions. The audit identified 31 findings + 12 bugs. This track is a refactor — no new product features, no business-logic changes. Scope is the admin surface only (`src/routes/_authenticated/admin/**`, `src/components/admin/**`, `src/components/dashboard/AdminDashboard.tsx`, and new shared primitives under `src/components/ui/` + `src/lib/`).

**Dependencies:** Track 6.0 (UI Redesign — design tokens and shared components). Track 6.4 (Student-Facing UI Consistency — established the pattern). Track 6.5 (Instructor-Facing UI Consistency — `.inputValidator()` pattern, `formatDate` helper, `TemplateTypeBadge`).

**Status:** ✅ Complete (June 2026)

**Estimated Scope:**

| Area                                                                                                          | Effort |
| ------------------------------------------------------------------------------------------------------------- | ------ |
| Foundational primitives — `AlertBanner`, `QuickActionCard`, `EmailQueueStat`, `ListRow`, `ROLES` config, `audit-actions` module, `formatDate` helper | Medium |
| Bug fixes — native dialog replacement (`DeleteUserDialog`, `SetupLinkSheet`), type-filter full type list, i18n gaps, hardcoded colors | Small  |
| Surface migration — 5 pages to `<PageHeader>`, 3 sites to `<RefreshButton>`, 2 to `<BackLink>`, 3 to `<Skeleton>`, 2 to `<EmptyState>`, 2 to `<Pagination>`, 1 to `<Select>`, 1 to `<Card>`, 1 to `<TemplateTypeBadge>`, 2 to `<QuickActionCard>`, 3 to `<EmailQueueStat>` | Large  |
| Design system cleanup — `text-amber-500` → `text-warning`; `bg-error text-white` → `bg-error text-foreground`; `bg-muted animate-pulse` → `<Skeleton>`; `data-slot="select-value"` workaround removed | Medium |
| Structural cleanups — split 356-line `TemplateDetailPage` into thin route + 4 subcomponents; dedupe `ROLES` config; unify `getActionVisualProps` + `ACTION_TYPES` source-of-truth | Large  |
| Systemic type fix — apply `.inputValidator(Schema)` to admin server functions; remove `// @ts-expect-error` from all admin routes; remove ad-hoc `as` result-shape casts | Large (gated) |

**Acceptance Criteria:**

- [x] All 5 admin pages render headers via `<PageHeader>` at `text-3xl` scale
- [x] All refresh buttons use `<RefreshButton>` with `router.invalidate()` (no `setTimeout` fake delays)
- [x] `TemplateDetailPage` and `TemplateNotFound` use `<BackLink>`; all skeletons use `<Skeleton>`; all empty states use `<EmptyState>`
- [x] `admin/audit-log.tsx` action filter uses `<Select>` (not raw `<select>`); `data-slot="select-value"` workaround removed from 3 admin filter components
- [x] `admin/users/index.tsx` delete uses `<DeleteUserDialog>` (not `window.confirm`); setup-link uses `<SetupLinkSheet>` (not `window.alert`); errors are inline
- [x] `listTemplates` server function returns `allTypes` (full distinct type list); type filter shows all types, not just current-page types
- [x] All hardcoded colors replaced with design tokens; `bg-muted animate-pulse` eliminated from admin surface
- [x] `ROLES` config module deduplicates role labels/variants across `UserTable`, `UserFilters`, `CreateUserDialog`; no `as TranslationKey` casts remain
- [x] `ACTION_TYPES` centralized in `src/lib/admin/audit-actions.ts`; `getActionVisualProps` unifies dashboard + audit-log colors
- [x] `formatDate` helper used consistently across all admin date displays
- [x] `TemplateDetailPage.tsx` split to 201 lines (under 500-line limit); 4 subcomponents extracted
- [x] `createServerFn` stubs use `.inputValidator()`; all `// @ts-expect-error` removed from admin routes; ad-hoc `as` result-shape casts removed
- [x] a11y gaps closed: `aria-label` on refresh buttons, `Label` on typed-DELETE input, `htmlFor` on metadata labels, `aria-hidden` on decorative icons, `aria-expanded`/`aria-controls` on audit-log view/hide, `role="columnheader"` on checkpoint editor headers
- [x] Escalation alert items wrapped in `<Card>` (review fix)
- [x] All existing tests pass (2070/2070); coverage thresholds met (85.48% lines, 81.62% functions, 80.99% branches, 86.19% statements)
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm vitest run --coverage` all pass
- [x] Review fixes applied: escalation alert items wrapped in `<Card>` (FR-10.4), `as *Result` type assertions removed from `templates/index.tsx` (FR-24.3), `[] as string[]` assertion removed from `templates.server.ts`
- Reference: track plan `conductor/archive/admin-ui-consistency_20260620/plan.md`

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

## Phase 8: Security & Correctness Hardening

Phase 8 addresses 16 findings from a full four-pillar security and code-quality audit (Logic & Correctness, Performance & Scalability, Security & Vulnerability, Maintainability). Tracks are ordered by severity and dependency: Track 8.1 (session/auth) goes first because the deleted-user session bypass is the single most critical risk and its `revokeUserSessions` helper is reused by Track 8.3's transactional user-deletion flow. Track 8.2 (email) is independent. Track 8.3 (transactions) touches the most handlers but has no new schema dependencies. Track 8.4 (performance) is the lowest priority and can be implemented last.

**Audit Reference:** Findings are referenced by severity and short title throughout (e.g., `CRITICAL — Deleted-User Session Bypass`). The full audit report lives in session context; each track's Acceptance Criteria trace directly to specific findings.

---

### Track 8.1 — Session Lifecycle & Auth Hardening

**Description:** Closes the critical deleted-user session bypass where soft-deleted users retain full access because `_getSession` does not filter on `deletedAt` and `deleteUserHandler` never revokes active sessions. Encompasses broader auth hardening: Better Auth rate limiting (currently absent, exposing login and password-setup endpoints to brute-force attacks), setup-token cleanup (stale tokens accumulate without invalidation), expired-session filtering in the active-sessions list, session enrichment with `role`/`locale` via Better Auth `additionalFields` (eliminating the per-request extra DB query), and strengthening `BETTER_AUTH_SECRET` validation from `.min(1)` to `.min(32)`.

A central `revokeUserSessions(userId, actorId)` helper is introduced and called from `deleteUserHandler`, password-reset, and 2FA-disable flows — closing the bypass and hardening the auth lifecycle in one place.

**Dependencies:** V1.3 (Better Auth base auth with Drizzle adapter), Track 3.1 (2FA & Session Management — `session` table and `twoFactorEnabled` column), Track 1.1 (audit log — session revocation events logged).

**Status:** ✅ Complete (June 2026)

**Audit Findings Addressed:**

| Severity | Finding | Location |
| -------- | ------- | -------- |
| CRITICAL | Deleted-User Session Bypass | `src/server/auth.ts` `_getSession` + `src/server/users.server.ts` `deleteUserHandler` |
| HIGH | No Rate Limiting on Authentication | `src/auth/config.ts` |
| MEDIUM | Every Authenticated Request Triggers Extra DB Query | `src/server/auth.ts` `_getSession` |
| LOW | `generateSetupLink` Doesn't Invalidate Prior Tokens | `src/server/users.server.ts` `generateSetupLinkHandler` |
| LOW | `listActiveSessions` Returns Expired Sessions | `src/server/sessions.server.ts` `listActiveSessionsHandler` |

**Estimated Scope:**

| Area                                                                              | Effort |
| --------------------------------------------------------------------------------- | ------ |
| `revokeUserSessions(userId)` helper in `src/lib/auth-session.ts`                  | Small  |
| `_getSession` — filter `deletedAt IS NULL` on user lookup                         | Small  |
| `deleteUserHandler` — call `revokeUserSessions` before soft-delete                | Small  |
| Better Auth `rateLimit` plugin + `trustedOrigins` in `src/auth/config.ts`         | Small  |
| `generateSetupLinkHandler` — delete prior verification tokens before insert       | Small  |
| `listActiveSessionsHandler` — add `expiresAt > now()` filter                      | Small  |
| Session enrichment — wire `role`/`locale` into Better Auth `additionalFields`    | Medium |
| `src/config/env.ts` — `BETTER_AUTH_SECRET` `.min(32)`                            | Small  |
| Remove redundant per-request DB query from `getSessionFromHeaders`                | Small  |
| Tests                                                                              | Medium |

**Database Schema Changes:**

None — uses existing `session` table, `users` table, and `verification` table. The `role` and `locale` columns already exist on `users` and are already declared as `additionalFields` in the Better Auth config; this track wires them into the session payload so `auth.api.getSession` returns them directly.

**Modified: `src/auth/config.ts`**

```typescript
// In betterAuth config — rateLimit is a built-in top-level option, not a plugin:
rateLimit: {
  window: 60,
  max: 10,
},
trustedOrigins: [getEnv().BETTER_AUTH_URL],
```

**New Server Helper: `src/lib/auth-session.ts`**

```typescript
export async function revokeUserSessions(userId: string, actorId?: string): Promise<void>;
```

Deletes all rows from the `session` table for the given user and logs a `session.revoked` audit event. The optional `actorId` parameter (defaults to `userId`) records who initiated the revocation. Single-import helper used by `deleteUserHandler`, password-reset, and 2FA-disable flows.

**Acceptance Criteria:**

- [x] Soft-deleted users (`deletedAt IS NOT NULL`) are rejected by `_getSession` — their session returns `null`, treating them as logged out
- [x] `deleteUserHandler` calls `revokeUserSessions(userId, actorId)` before setting `deletedAt`, invalidating all active sessions atomically
- [x] `revokeUserSessions` helper is importable from `src/lib/auth-session.ts` and used by all session-revoking flows (delete user, password reset, 2FA disable)
- [x] Better Auth built-in `rateLimit` config is set with a 60-second window and max 10 requests per window per IP
- [x] `trustedOrigins` is set to `[BETTER_AUTH_URL]` from env config
- [x] `BETTER_AUTH_SECRET` validation in `src/config/env.ts` enforces `.min(32)` (currently `.min(1)`)
- [x] `generateSetupLinkHandler` deletes existing verification tokens for the user's email before inserting a new one
- [x] `listActiveSessionsHandler` filters out expired sessions (`expiresAt > now()`)
- [x] `role` and `locale` are returned by `auth.api.getSession` via `additionalFields` session mapping — `getSessionFromHeaders` no longer issues a separate `SELECT role, locale FROM users` query
- [x] Session revocation events are logged to audit log (`session.revoked` action)
- [x] i18n translations for any new UI strings (e.g., rate-limit error messages)

**Test Plan:**

| Area                          | Approach                                                                                  |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| Deleted-user session bypass   | Unit test — user with `deletedAt` set returns `null` from `_getSession`                 |
| Session revocation on delete  | Unit test — `deleteUserHandler` calls `revokeUserSessions`; session table is empty after |
| `revokeUserSessions` helper   | Unit test — deletes all sessions for a user; leaves other users' sessions intact        |
| Rate limiting                 | Unit test — 11th request within window is rejected with 429                               |
| Token cleanup                 | Unit test — `generateSetupLinkHandler` deletes prior tokens; only one valid token exists |
| Expired session filtering     | Unit test — `listActiveSessionsHandler` excludes sessions with `expiresAt < now()`       |
| Session enrichment            | Unit test — `auth.api.getSession` returns `role` and `locale` without extra DB query     |
| Secret length validation      | Unit test — env config rejects `BETTER_AUTH_SECRET` shorter than 32 chars                 |

**Actual Files Created/Modified:**

| File | Type | Purpose |
|------|------|---------|
| `src/lib/auth-session.ts` | New | `revokeUserSessions(userId, actorId?)` helper — deletes sessions + logs audit |
| `src/auth/config.ts` | Modified | Added `onPasswordReset` callback, `trustedOrigins`, built-in `rateLimit` config |
| `src/config/env.ts` | Modified | `BETTER_AUTH_SECRET` validation `.min(32)` |
| `src/server/auth.ts` | Modified | `_getSession` filters soft-deleted users, returns role/locale from session payload |
| `src/server/users.server.ts` | Modified | `deleteUserHandler` calls `revokeUserSessions`; `generateSetupLinkHandler` clears prior tokens |
| `src/server/sessions.server.ts` | Modified | `listActiveSessionsHandler` adds `gt(expiresAt, now)` filter |
| `src/server/two-factor.server.ts` | Modified | `disableTwoFactorHandler` calls `revokeUserSessions` |
| `locales/en.json`, `locales/id.json` | Modified | Added `rateLimit` i18n key |
| `src/i18n/types.ts` | Generated | i18n type definitions updated |
| `tests/unit/lib/auth-session.test.ts` | New | 4 tests: deletes sessions, logs audit, handles no sessions, uses actorId |
| `tests/unit/config/env.test.ts` | Modified | Tests reject <32 char secret, accept 32+ char |
| `tests/unit/auth/config.test.ts` | Modified | Tests additionalFields, trustedOrigins, rateLimit, onPasswordReset |
| `tests/unit/server/auth.test.ts` | Modified | Tests soft-deleted null return, session payload role/locale |
| `tests/unit/server/users.test.ts` | Modified | Tests deleteUserHandler calls revokeUserSessions, generateSetupLinkHandler clears tokens |
| `tests/unit/server/two-factor.test.ts` | Modified | Tests disableTwoFactorHandler calls revokeUserSessions |
| `tests/unit/server/sessions.test.ts` | Modified | Tests expired session filtering with `gt(expiresAt)` mock |
| `tests/unit/server/users-audit.test.ts` | Modified | Added `delete` mock to DB for revokeUserSessions |
| `tests/unit/i18n/i18n.test.ts` | New | Validates `rateLimit` key present in en/id JSON |

**Test Results:** All 55 tests across 4 affected test files pass. Full suite: 2158 passed, 2 pre-existing timeouts (unrelated instructor route tests). Lint: 0 errors. Typecheck: clean.

**Review Fixes Applied (commit `72a5a35`):**
1. Import style in `auth-session.ts` — changed `@/` aliases to relative imports (codebase convention)
2. Weak test in `sessions.test.ts` — added `drizzle-orm` mock to verify `gt(expiresAt)` filter is applied
3. Misleading comment in `two-factor.server.ts` — "password change" → "security change"
4. Plan deviation in `plan.md` — updated rateLimit description from plugin import to built-in config

---

### Track 8.3 — Transactional Integrity & Input Validation

**Description:** Wraps all multi-step mutation handlers in `db.transaction` following the gold-standard pattern already established in `submitReviewHandler` (reviews). Adds a database-level unique constraint on `(submissions.checkpointId, version)` to enforce version uniqueness even under concurrent contention (defense-in-depth complementing the transaction). Fixes the notification metadata bug where `submissionId` is incorrectly set to the version number instead of the actual submission ID (the insert lacks `.returning()`). Enforces file-type validation on instructor feedback uploads (currently skipped, allowing arbitrary file types to R2). Investigates the fileKey trust gap where the client-supplied `fileKey` is not verified against the server-presigned key for that checkpoint.

**Dependencies:** V1 server functions (submissions, reviews, consultations, users, setup-password, files). Track 8.1 (`revokeUserSessions` helper used by transactional `deleteUserHandler`).

**Status:** ⏳ Planned

**Audit Findings Addressed:**

| Severity | Finding | Location |
| -------- | ------- | -------- |
| HIGH | Submission Version Race Condition (TOCTOU) | `src/server/submissions.server.ts` `submitCheckpointHandler` |
| HIGH | Non-Transactional Multi-Step Operations | `users.server.ts` `createUserHandler`, `setup-password.ts` `completePasswordSetup`, `consultations.server.ts` `verify`/`rejectConsultationHandler`, `submissions.server.ts` `submitCheckpointHandler` |
| HIGH | Instructor Feedback Upload Skips File-Type Validation | `src/server/files.server.ts` `getPresignedReviewFeedbackUploadUrlHandler` |
| MEDIUM | Notification Metadata Bug — submissionId Set to Version Number | `src/server/submissions.server.ts` `submitCheckpointHandler` (lines 143–147) |
| LOW | fileKey Trust in submitCheckpoint (Limited IDOR) | `src/server/submissions.server.ts` `submitCheckpointHandler` |

**Estimated Scope:**

| Area                                                                                          | Effort |
| --------------------------------------------------------------------------------------------- | ------ |
| Unique constraint on `(submissions.checkpointId, version)` + migration                        | Small  |
| `submitCheckpointHandler` — wrap in `db.transaction`, use `.returning()` for submission ID   | Medium |
| `createUserHandler` — wrap in `db.transaction`                                                | Small  |
| `completePasswordSetup` — wrap in `db.transaction`                                           | Small  |
| `verifyConsultationHandler` / `rejectConsultationHandler` — wrap in `db.transaction`         | Small  |
| `getPresignedReviewFeedbackUploadUrlHandler` — call `validateUploadType`                     | Small  |
| `fileKey` trust investigation — record presigned fileKey ↔ checkpoint mapping at presign time | Medium |
| Establish "write transaction" convention in `conductor/code_styleguides/`                    | Small  |
| Tests                                                                                         | Medium |

**Database Schema Changes:**

**Modified: `submissions`** (add unique constraint)

```sql
ALTER TABLE submissions
  ADD CONSTRAINT submissions_checkpoint_version_unq
  UNIQUE (checkpoint_id, version);
```

This ensures that even if two concurrent transactions both read `MAX(version) = N` and both try to insert `version = N+1`, the second insert fails and the transaction rolls back — preventing duplicate versions at the database level.

**Modified Handlers:**

| Handler | Current | After |
| ------- | ------- | ----- |
| `submitCheckpointHandler` | 5 separate statements (version select → insert → checkpoint update → notification insert) | Single `db.transaction` with `.returning({ id })` for submission ID |
| `createUserHandler` | insert user → insert verification → send email (3 separate statements) | `db.transaction` for user + verification; email sent after commit |
| `completePasswordSetup` | upsert account → update user → delete token (3 separate statements) | Single `db.transaction` |
| `verifyConsultationHandler` | update consultation → insert notification → audit log (3 separate statements) | Single `db.transaction`; audit log after commit |
| `rejectConsultationHandler` | same pattern as verify | Same fix |
| `getPresignedReviewFeedbackUploadUrlHandler` | No file-type validation | Calls `validateUploadType(extension, contentType)` before presigning |

**Acceptance Criteria:**

- [ ] `submissions` table has a unique constraint on `(checkpoint_id, version)`
- [ ] `submitCheckpointHandler` runs entirely within `db.transaction`; all queries use `tx`
- [ ] `submitCheckpointHandler` uses `.returning({ id: submissions.id })` and stores the real submission ID in notification metadata (not the version number)
- [ ] Concurrent submissions for the same checkpoint do not produce duplicate versions — the second transaction fails and rolls back
- [ ] `createUserHandler` wraps user + verification inserts in `db.transaction`; email is sent only after the transaction commits
- [ ] `completePasswordSetup` wraps account upsert + user update + token deletion in `db.transaction`
- [ ] `verifyConsultationHandler` and `rejectConsultationHandler` wrap all writes in `db.transaction`; audit logging occurs after commit
- [ ] `getPresignedReviewFeedbackUploadUrlHandler` calls `validateUploadType` and rejects unsupported extensions/content-types
- [ ] If a transaction fails midway, no partial writes persist (verified by integration test)
- [ ] Post-commit advisory work (emails, audit logs) is placed after the transaction and wrapped in try/catch so failures don't surface misleading errors
- [ ] "Write transaction" convention is documented in `conductor/code_styleguides/`
- [ ] **Investigation Required:** `fileKey` trust — if implemented, presigned fileKey ↔ checkpoint mapping is recorded at presign time and validated at submit time
- [ ] i18n not affected (no new UI strings)

**Test Plan:**

| Area                         | Approach                                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| Version race — single        | Unit test — `submitCheckpointHandler` wraps all writes in a transaction                       |
| Version race — concurrent    | Integration test — two concurrent submissions for same checkpoint; second fails with unique violation |
| Notification metadata fix    | Unit test — notification metadata `submissionId` matches the actual inserted submission ID    |
| `createUserHandler` txn      | Unit test — if verification insert fails, user insert is rolled back                          |
| `completePasswordSetup` txn  | Unit test — if token deletion fails, account upsert is rolled back                            |
| Consultation verify txn      | Unit test — if notification insert fails, consultation update is rolled back                  |
| Consultation reject txn      | Unit test — same as verify                                                                     |
| Feedback upload validation   | Unit test — `.exe` / `.svg` extensions are rejected; `.docx` / `.pdf` are accepted            |
| Post-commit failure isolation | Unit test — audit log failure after successful transaction does not return error to client    |
| fileKey trust (if implemented) | Unit test — fileKey not matching the presigned checkpoint mapping is rejected                |

---

### Track 8.4 — Performance Refinements

**Description:** Parallelizes independent dashboard queries with `Promise.all` (the instructor dashboard currently issues 6+ queries strictly sequentially — many are independent and could run concurrently). Refactors bulk user import to batch database writes and decouple email sends from the request cycle (currently up to 500 rows are processed sequentially with per-row DB + Resend calls, potentially taking minutes). Isolates post-commit advisory work (audit logging in `submitReviewHandler`) in try/catch so that a failure in the audit insert doesn't surface a misleading "Internal Server Error" response for a transaction that actually committed successfully.

**Dependencies:** V1 dashboards (`dashboard-instructor.server.ts`), Track 1.1 (audit log — `logAuditEvent` called post-commit), bulk import infrastructure (`bulk-import.server.ts`).

**Status:** ⏳ Planned

**Audit Findings Addressed:**

| Severity | Finding | Location |
| -------- | ------- | -------- |
| MEDIUM | Dashboard Sequential Query Fan-out | `src/server/dashboard-instructor.server.ts` `getInstructorDashboardDataHandler` |
| MEDIUM | Bulk Import Sequential Processing | `src/server/bulk-import.server.ts` `bulkCreateUsersHandler` |
| LOW | Audit-Log Failure Returns Misleading "Internal Server Error" | `src/server/reviews.server.ts` `submitReviewHandler` (lines 376–396) |

**Estimated Scope:**

| Area                                                                                  | Effort |
| ------------------------------------------------------------------------------------- | ------ |
| `getInstructorDashboardDataHandler` — parallelize independent queries with `Promise.all` | Medium |
| `bulkCreateUsersHandler` — batch user + verification inserts                          | Medium |
| `bulkCreateUsersHandler` — decouple email sends (enqueue after DB transaction)       | Small  |
| `submitReviewHandler` — wrap post-commit audit log in try/catch                       | Small  |
| Tests                                                                                 | Medium |

**Database Schema Changes:**

None.

**Acceptance Criteria:**

- [ ] `getInstructorDashboardDataHandler` uses `Promise.all` for independent queries (e.g., recent submissions, assignment overview, and count queries run concurrently)
- [ ] Instructor dashboard load time is reduced (measurable: sequential round-trips → parallel)
- [ ] `bulkCreateUsersHandler` batches DB inserts (users + verifications) rather than per-row sequential inserts
- [ ] `bulkCreateUsersHandler` enqueues invitation emails after the DB transaction commits (no per-row `await sendInvitationEmail` in the loop)
- [ ] `submitReviewHandler` wraps post-commit `logAuditEvent` and SLA notification calls in try/catch — a failure in advisory work does not return an error response for a successful review
- [ ] No regression in dashboard data correctness or bulk import behavior
- [ ] i18n not affected

**Test Plan:**

| Area                        | Approach                                                                          |
| --------------------------- | --------------------------------------------------------------------------------- |
| Dashboard parallelization   | Unit test — `Promise.all` fires queries concurrently; results match sequential    |
| Dashboard correctness       | Unit test — same data returned as before parallelization                          |
| Bulk import batching        | Unit test — 100 rows produce batched inserts, not 100 sequential inserts          |
| Bulk import email decoupling | Unit test — emails are enqueued post-transaction, not awaited in the loop        |
| Bulk import partial failure | Unit test — if batch fails, no partial users persist (transaction rollback)       |
| Audit log failure isolation | Unit test — `logAuditEvent` throw does not change the success response           |

---

## Priority Summary

| Priority         | Track                          | Rationale                                                                |
| ---------------- | ------------------------------ | ------------------------------------------------------------------------ |
| 🔴 **Immediate** | Track 1.1 (Audit Log)          | Foundation — all later tracks write to it; enables accountability        |
| 🔴 **Immediate** | Track 1.2 (DueDates)           | Fixes broken V1 deadline logic; unblocks all deadline-dependent features |
| 🔴 **High**      | Track 1.3 (Extensions)         | Depends on Track 1.1 + 1.2; student/instructor extension workflow        |
| 🔴 **High**      | Track 4.1 (Email Queue)        | Removes synchronous Resend bottleneck; improves reliability              |
| ✅ **Completed** | Track 8.1 (Session & Auth)     | FIXED: deleted-user session bypass closed, rate limiting added, session revocation on delete/password-reset/2FA-disable, secret validation, audit logging |
| 🔴 **Immediate** | Track 8.2 (Email Pipeline)     | CRITICAL: email queue race condition (duplicate delivery) + HTML injection in email templates |
| 🟠 **High**      | Track 8.3 (Transactions)       | HIGH: submission version race, non-transactional handlers, feedback upload validation, notification metadata bug |
| 🟠 **Medium**    | Track 2.1 (Groups)             | Largest feature request; significant scope                               |
| 🟡 **Lower**     | Track 8.4 (Performance)        | MEDIUM/LOW: dashboard query parallelization, bulk import batching, audit log error isolation |
| 🟡 **Lower**     | Tracks 3.1, 5.1, 6.2, 6.3, 6.4, 6.5, 7.1 | Security, analytics, UX polish, UI consistency, testing — valuable but not blocking |
| ✅ **Completed** | Bulk Import (Users & Templates) | Ad-hoc track: Excel bulk import for users and templates with client preview, server re-validation, per-group atomicity, audit logging, bilingual i18n |

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
7. ✅ Track 6.0 — UI Redesign / Warm Academic Design System (Complete)
8. ✅ Track 6.1 — Settings Hub (Complete)
9. ✅ Track 6.4 — UI Consistency for Student-Facing UI (Complete)
10. ✅ Track 6.5 — UI Consistency for Instructor-Facing UI (Complete)
11. ✅ Track 6.6 — UI Consistency for Admin-Facing UI (Complete)
12. ✅ Production Migration Hardening — Dockerfile executes bundled `migrate.mjs` (advisory-locked, PgBouncer bypass via `MIGRATE_DATABASE_URL`); `drizzle-kit` removed from production image (Complete)
13. ✅ Bulk Import for Users & Templates — Excel (.xlsx) bulk import with client-side preview (SheetJS), server-side re-validation, per-group atomicity for templates, audit logging, bilingual i18n, 500 row/5 MB limits (Complete)
14. ✅ Track 8.1 — Session Lifecycle & Auth Hardening (Complete — deleted-user session bypass fixed, rate limiting, session revocation, secret validation, audit logging)
15. [ ] Select next track to implement (recommended priority order: **Track 8.2 → 8.3 → 8.4** for security hardening, then **Track 2.1 — Group Assignments** for feature work)
16. [ ] Create implementation plan in `conductor/tracks/<id>/plan.md`
17. [ ] Write failing tests
18. [ ] Implement features
19. [ ] Verify & archive

---

_Document Status: Finalized for v2. Features in Appendix A deferred to v3. Approved for track planning._
