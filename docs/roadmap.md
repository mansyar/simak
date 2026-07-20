# Product Roadmap: SIMAK Remediation

> **Methodology:** Context-Driven Development (CDD) via Conductor.
> **Purpose:** This document acts as the global architectural index mapping out our remediation path following a comprehensive three-way audit (bugs, performance, UX). It serves as the single source of truth for generating discrete micro-plans to address 98 identified issues across 13 tracks.

---

## Audit Summary

The audit identified issues across three categories:

| Category | Critical/High | Medium | Low | Total |
|----------|:---:|:---:|:---:|:---:|
| **Bugs** | 13 | 9 | 6 | 28 |
| **Performance** | 3 | ~12 | ~15 | ~30 |
| **UX** | 8 | ~12 | ~20 | ~40 |

Each track below references individual findings by their audit ID (BUG-X, PERF-X, UX-X). See the full audit report for detailed descriptions, file locations, and reproduction steps.

---

## Global System Configuration & Context

Before initializing individual tracks, the following foundational context files must be present and updated in the repository:

- **PRD Source:** `docs/PRD.md` (Defines feature requirements and user logic)
- **TDD Source:** `docs/TDD.md` (Defines architecture, system design, and schemas)
- **Tech Stack:** `conductor/tech-stack.md` (Defines pinned languages, frameworks, and tools)
- **Guidelines:** `conductor/product-guidelines.md`, `conductor/code_styleguides/` (Defines code style, patterns, and testing thresholds)
- **Workflow:** `conductor/workflow.md` (Defines TDD lifecycle, commit format, and checkpoint protocol)
- **Audit Source:** This document (cross-references all audit findings by ID)

### Cross-Cutting Constraints

All tracks must adhere to the following project constraints:

- **Server function split:** Every feature has two files — `*.ts` (client-safe stub with `createServerFn` + dynamic import) and `*.server.ts` (handler with DB code). See `AGENTS.md` → "Server function split".
- **File limit:** Max 500 lines per file in `src/`, `tests/`, `scripts/`.
- **i18n:** All new user-visible strings must be added to both `locales/en.json` and `locales/id.json`, then `pnpm generate:i18n`.
- **Testing:** TDD per `conductor/workflow.md`. Coverage thresholds: lines/functions/branches/statements ≥ 80%. Integration tests excluded from default run.
- **Concurrency pattern:** All checkpoint state transitions must use `db.transaction` + `.for('update')` inside the transaction, with status re-check after locking. Gold standard: `submitCheckpointHandler` (`src/server/submissions.server.ts`).

---

## Milestone 1: Critical Fixes (Concurrency, Data Integrity, Deadlines)

> These tracks address data corruption risks, race conditions, and logic errors that can cause incorrect state or lost data. They should be prioritized above all other work.

---

### TRACK-001: Concurrency & Transaction Safety

- **Status:** `Complete` (archived to `conductor/archive/concurrency-tx-safety_20260718/`)
- **Dependencies:** None
- **Estimated Effort:** 5 Days / 3 Sprint Loops
- **Audit IDs:** BUG-1, BUG-2, BUG-5, BUG-6, BUG-7, BUG-8, BUG-9, BUG-13, BUG-17, BUG-22
- **Decisions:**
  - BUG-9 (instructor): Build assignment reassignment flow — admin must reassign ALL active (non-deleted) assignments to a replacement instructor before soft-delete proceeds. `under_review` checkpoints transition back to `submitted`; already-`submitted` checkpoints stay as-is (new instructor sees them automatically once `instructorId` is updated).
  - BUG-9 (student): Auto-reject all pending consultations and extension requests with reason "User deleted".
  - BUG-8: DB first in a transaction (update `users.twoFactorEnabled` + delete `twoFactor` row), then call `auth.api.disableTwoFactor` last. If API call fails post-commit, reconcile on next login by checking DB flag.
  - BUG-22: Catch PG error `23505` for clean "Email already in use" message AND move email existence check inside transaction with `FOR UPDATE` on users rows.

#### Context Anchors (Traceability)

- **PRD Reference:** `docs/PRD.md` (consultation verification, extension approval, user management, 2FA flows)
- **TDD Reference:** `docs/TDD.md` (transaction patterns, `FOR UPDATE` locking, state machine transitions)
- **Gold Standard:** `src/server/submissions.server.ts` (`submitCheckpointHandler` — correct transaction + lock pattern)

#### Track Tech Stack

- PostgreSQL `SELECT ... FOR UPDATE` row locking
- Drizzle ORM transactions (`db.transaction`)
- Better Auth API (2FA disable flow)
- Vitest (concurrency test patterns)

#### Scope Boundaries

- **In Scope:**
  - Add `FOR UPDATE` + move status checks inside transactions for consultation verify/reject (BUG-1, BUG-17)
  - Add `FOR UPDATE` + move status checks inside transactions for extension approve/reject (BUG-2, BUG-7)
  - Lock checkpoint rows inside `calculateExtensionAdjustment` reads (BUG-6)
  - Move extension count check inside transaction with row locking (BUG-5)
  - Wrap `disableTwoFactorHandler` DB operations in a transaction; DB first, then auth API last (BUG-8)
  - Wrap `generateSetupLinkHandler` DELETE + INSERT in a single transaction (BUG-13)
  - Move email uniqueness check inside transaction; catch PG error `23505` for clean "Email already in use" message (BUG-22)
  - Soft-delete cleanup — student: auto-reject pending consultations and extension requests with reason "User deleted" (BUG-9)
  - Soft-delete cleanup — instructor: build assignment reassignment flow; admin must reassign ALL active (non-deleted) assignments to a replacement instructor before soft-delete proceeds; transition `under_review` checkpoints back to `submitted`; revoke open upload intents (BUG-9)
- **Out of Scope:**
  - Deadline logic correctness (TRACK-002)
  - Email queue idempotency (TRACK-004)
  - Input validation gaps (TRACK-003)

#### High-Level Execution Vectors

- **Phase 1 (Consultations):** Refactor `verifyConsultationHandler` and `rejectConsultationHandler` — move SELECT inside `db.transaction`, add `.for('update', { of: consultations })`, re-check `status === 'pending'` after lock. Write concurrency test that simulates parallel verify calls.
- **Phase 2 (Extensions):** Refactor `approveExtensionHandler`, `rejectExtensionHandler`, `requestExtensionHandler` — same pattern. Move notification INSERT inside transaction (keep audit log post-commit with try/catch). Fix extension count TOCTOU by counting inside the transaction under lock.
- **Phase 3 (2FA & Users):** Wrap `disableTwoFactorHandler` DB operations in a transaction (DB first, auth API last). Wrap `generateSetupLinkHandler` in a transaction. Add `23505` catch to `createUserHandler`/`updateUserHandler`.
- **Phase 4 (Soft-Delete Cleanup):** Student soft-delete: auto-reject pending consultations + extension requests with reason "User deleted", revoke open upload intents. Instructor soft-delete: build reassignment flow — block soft-delete if active assignments exist, require admin to select replacement instructor per assignment, update `assignments.instructorId`, transition `under_review` checkpoints to `submitted`.
- **Phase 5 (Tests):** Write integration tests that simulate concurrent requests for each race condition. Verify no duplicate notifications, no double-extensions, no auth/DB inconsistency. Test reassignment flow end-to-end.

#### Verification & Definition of Done (DoD)

- [x] **Manual Checkpoint:** Open two browser tabs for the same consultation; submit verify simultaneously. Only one succeeds; the other gets "already processed" error.
- [x] **Manual Checkpoint:** Attempt to soft-delete an instructor with active assignments — system blocks and requires reassignment. After reassignment, new instructor sees pending reviews in their queue.
- [x] **Automated Tests:** `pnpm test:unit` and `pnpm test:integration` — all pass. New concurrency tests verify no duplicate operations under parallel load.
- [x] **Code Review:** All state-transition handlers use `db.transaction` + `FOR UPDATE` + post-lock status re-check. No SELECT-then-UPDATE patterns remain outside transactions.
- [x] **Conductor Review:** Passes `pnpm typecheck`, `pnpm lint`, and `pnpm test:coverage` (≥80%).

---

### TRACK-002: Deadline & SLA Logic Correctness

- **Status:** `Complete` (archived to `conductor/archive/deadline-sla-correctness_20260719/`)
- **Dependencies:** None (but coordinate with TRACK-001 — both touch extension handlers)
- **Estimated Effort:** 3 Days / 1.5 Sprint Loops
- **Audit IDs:** BUG-3, BUG-11, BUG-12, BUG-16, BUG-18, BUG-19, BUG-21, BUG-28
- **Decisions:**
  - **BUG-3/12 — `finalDeadline` is immutable (honors Track 10):** `assignments.finalDeadline` is course-wide (one value shared by all students). Checkpoints are per-student. Extensions and SLA breaches are per-student operations. Bumping a course-wide deadline for one student's extension would incorrectly move the deadline for ALL students. Therefore `finalDeadline` remains **immutable** after assignment creation. Per-student effective deadlines are derived from checkpoint `dueDate` values, which DO move with extensions. The `finalDeadline >= max(checkpoint.dueDate)` invariant is enforced **only at assignment creation time** via `validateDueDates`. The `maxExtensionDays` (1-30) and `maxTotalExtensions` (1-10) schema caps remain the real limits on extension magnitude. Docstrings in `calculateExtensionAdjustment`, `adjustDeadlinesForBreach`, and `bulkExtendHandler` were updated to remove stale claims of extending `finalDeadline`.
  - **BUG-16 — Fix SLA docstring and rename parameter (implemented):** The submission-anchored SLA clock is a deliberate Track 9 decision. The `sla.ts` docstring was updated to say "from submission upload time" and the misleading `underReviewAt` parameter/variable was renamed to `anchorTime` for accuracy. No schema change, no migration. `openForReviewHandler` remains a pure state marker with no SLA effect.

#### Context Anchors (Traceability)

- **PRD Reference:** `docs/PRD.md` (assignment deadlines, extension workflow, SLA policy)
- **TDD Reference:** `docs/TDD.md` (checkpoint state machine, deadline derivation, SLA calculation)

#### Track Tech Stack

- PostgreSQL date/interval functions (`EXTRACT(EPOCH FROM ...)`, date arithmetic)
- Drizzle ORM (`sql` template literals for date math)
- `src/lib/sla.ts`, `src/lib/review-sla.ts`
- `src/server/due-dates.server.ts`, `src/server/extensions-extras.server.ts`, `src/server/assignments-extras.server.ts`

#### Scope Boundaries

- **In Scope (implemented):**
  - Update stale docstrings in `calculateExtensionAdjustment`, `adjustDeadlinesForBreach`, and `bulkExtendHandler` to remove claims of extending `assignments.finalDeadline` — `finalDeadline` is immutable per Track 10 (BUG-3). No code behavior change, docstrings only.
  - Fix admin dashboard `daysOverdue` to use `EXTRACT(EPOCH FROM now() - uploadedAt) / 86400` instead of `extract(day from ...)` (BUG-11). Fixed in both SELECT and ORDER BY.
  - Add optional `finalDeadline` parameter to `validateDueDates` — reject checkpoint dueDates past `finalDeadline` **at assignment creation time only** (BUG-12). Not enforced at extension request/approve time (per-student extensions legitimately push dueDates past the course-wide `finalDeadline`).
  - Update `sla.ts` docstring to say "from submission upload time" (BUG-16). Renamed `underReviewAt` parameter in `calculateBreachDuration` and the local variable in `submitReviewHandler` to `anchorTime`.
  - Add validation to `extendDeadlineHandler` — check `newDueDate` is in the future, maintains sequential ordering relative to adjacent checkpoints (BUG-18). Does NOT modify `assignments.finalDeadline` (immutable per Track 10).
  - Fix student dashboard `upcomingDeadlines` query — filter out `passed` checkpoints; handle null `dueDate` as "No deadline" with `isOverdue=false` and `daysRemaining=null` (BUG-19).
  - Remove dead `channel: 'email'` notification rows from `dispatchSLABreachNotifications` — the actual email goes through `sendSLAAlertEmail` → email queue (BUG-21).
  - Fix `effectiveDeadline` computation — use first non-passed checkpoint's dueDate via shared `computeEffectiveDeadline` helper instead of highest-order checkpoint (BUG-28). Helper is used by all three call sites: `listStudentAssignmentsHandler`, `getStudentAssignmentDetailHandler`, `getStudentDashboardDataHandler`.
- **Out of Scope:**
 - Concurrency/locking fixes for extension handlers (TRACK-001)
 - Email queue improvements (TRACK-004)
 - Pagination for dashboard queries (TRACK-006)

#### High-Level Execution Vectors

- **Phase 1 (Documentation & Naming Fixes):** Updated stale docstrings in `calculateExtensionAdjustment`, `adjustDeadlinesForBreach`, and `bulkExtendHandler` to remove claims of extending `finalDeadline` (BUG-3). Updated `sla.ts` docstring + renamed `underReviewAt` to `anchorTime` in `calculateBreachDuration` and `submitReviewHandler` (BUG-16).
- **Phase 2 (SQL & Dashboard Query Fixes):** Fixed `daysOverdue` SQL to `EXTRACT(EPOCH FROM ...) / 86400` + fixed ORDER BY (BUG-11). Fixed `upcomingDeadlines` query to exclude `passed` checkpoints + handle null `dueDate` as "No deadline" with `isOverdue=false` and `daysRemaining=null` (BUG-19). Added i18n key `studentDashboard.noDeadline` to both locales.
- **Phase 3 (Validation Logic):** Added optional `finalDeadline` parameter to `validateDueDates` — caps dueDates at creation time only (BUG-12). Added future-date + sequential-ordering validation to `extendDeadlineHandler` (BUG-18). Does NOT bump `finalDeadline` (immutable per Track 10).
- **Phase 4 (Notification Cleanup):** Removed dead `channel: 'email'` SLA notification INSERT rows from `dispatchSLABreachNotifications` (BUG-21). Kept in-app notification INSERT and `sendSLAAlertEmail` call intact.
- **Phase 5 (effectiveDeadline Derivation):** Created shared `computeEffectiveDeadline` helper in `src/server/due-dates.server.ts`. Refactored all three call sites to use the helper: `listStudentAssignmentsHandler`, `getStudentAssignmentDetailHandler`, `getStudentDashboardDataHandler` (BUG-28).

#### Verification & Definition of Done (DoD)

- [x] **Manual Checkpoint:** Create an assignment with checkpoints spanning past `finalDeadline` — creation is rejected. Admin dashboard shows correct overdue days for a 45-day-old submission (not ~15). Student dashboard excludes passed checkpoints from upcoming deadlines and shows "No deadline" for null dueDates. Extensions and SLA breaches adjust per-student checkpoint dueDates only — `finalDeadline` stays immutable.
- [x] **Automated Tests:** `pnpm test:unit` — 260 test files, 2397 tests, all pass. New tests for `validateDueDates` (with `finalDeadline` cap), `computeEffectiveDeadline` (first non-passed checkpoint logic), `extendDeadlineHandler` (future/sequential validation, finalDeadline immutability), `sla.ts` (`anchorTime` parameter), `daysOverdue` SQL (EPOCH extraction), `upcomingDeadlines` filter, `dispatchSLABreachNotifications` (no email channel rows). Coverage: 87.55% lines, 81.38% statements, 81.37% branches, 88.2% functions (all ≥80%).
- [x] **Conductor Review:** No docstring/implementation mismatches remain in SLA-related code. `finalDeadline` is immutable across all extension and SLA-breach paths. `computeEffectiveDeadline` shared helper used by all three call sites. Code review passed with 2 Low-severity style fixes applied (non-null assertion removal).

---

### TRACK-003: Input Validation & Data Integrity

- **Status:** `Complete (Archived)`
- **Dependencies:** None
- **Estimated Effort:** 2 Days / 1 Sprint Loop
- **Audit IDs:** BUG-10, BUG-15, BUG-24, BUG-25, BUG-26, BUG-27
- **Decisions:**
  - **BUG-10 (R2 error discrimination):** Return discriminated type `{ ok: true, size } | { ok: false, reason: 'not_configured' | 'not_found' }` from `getObjectContentLength`. Two new i18n keys in both `en.json` and `id.json`: `files.r2NotConfigured` = "File storage is not configured. Contact your administrator." and `files.objectNotFound` = "The uploaded file could not be found. Please try uploading again." The "file too large" message is shown ONLY when `actualSize > MAX_FILE_SIZE`. Must catch the `HeadObjectCommand` 404 throw and convert to `{ ok: false, reason: 'not_found' }` rather than letting it propagate to the outer catch.
  - **BUG-15 (settings Zod bypass):** Use the preferred typed builder pattern `.inputValidator(Schema).handler(fn)` (per Track 6.4 convention) on all three POST stubs (`updateProfile`, `updateUserSettings`, `getPresignedAvatarUploadUrl`). Remove the unsafe `args as { name: string }` / `args as { extension: string }` / `args as { reducedMotion: boolean }` casts from the handlers. `getCurrentUser` (GET, no input) is unchanged.
  - **BUG-24 (studentIds role validation):** Reject the ENTIRE assignment creation if ANY studentId is not a valid active student (`role='student'` AND `deletedAt IS NULL`). Single query: `SELECT id FROM users WHERE id IN (studentIds) AND role='student' AND deletedAt IS NULL`, compare returned count to `studentIds.length`. If mismatch, return `serverError(BAD_REQUEST, 'One or more selected users are not active students')` before the transaction begins.
  - **BUG-25 (EMAIL_FROM env):** Add `EMAIL_FROM` to `baseSchema` in `src/config/env.ts` as `z.string().min(1, 'EMAIL_FROM is required')`. App fails to start if not set. Update `.env.example` with a placeholder. Replace `process.env.EMAIL_FROM` in `email-queue-processor.ts:91` with `getEnv().EMAIL_FROM`. Remove the fallback `'SIMAK <noreply@simak.app>'`.
    > **Note:** Partially addressed by TRACK-004 (FR-5) — `EMAIL_FROM` was added to `env.ts` with `z.string().default('SIMAK <noreply@simak.app>')` (default fallback, not required) and `process.env.EMAIL_FROM` was replaced with `getEnv().EMAIL_FROM` in the processor. TRACK-003 should decide whether to tighten this to `z.string().min(1)` (required, no default) or accept the default-fallback approach.
  - **BUG-26 (instructorId WHERE):** Add `eq(assignments.instructorId, session.user.id)` to the WHERE clause in `getAssignmentDetailHandler`. Remove the `select` on `assignments.instructorId` column and the JS post-query check. Trivial move.
  - **BUG-27 (actualSize storage):** Store `actualSize` (R2-verified) instead of `fileSize` (client-reported) in the `submissions` INSERT. Naturally resolved by BUG-10 fix — only the `{ ok: true, size }` case proceeds to INSERT; `not_configured` and `not_found` are rejected with their specific messages. No cross-validation between client-reported and R2-verified sizes (encoding differences may cause minor mismatches).

#### Context Anchors (Traceability)

- **PRD Reference:** `docs/PRD.md` (settings/profile, assignment creation, file submission)
- **TDD Reference:** `docs/TDD.md` (Zod schema validation, server function stub patterns)

#### Track Tech Stack

- Zod schemas (input validation)
- Drizzle ORM (query construction)
- `src/config/env.ts` (Zod-validated environment)
- `src/lib/storage.ts` (R2 integration)

#### Scope Boundaries

- **In Scope:**
  - Fix `settings.ts` stubs to use `.inputValidator(Schema).handler(fn)` (typed builder pattern) on `updateProfile`, `updateUserSettings`, `getPresignedAvatarUploadUrl`. Remove unsafe casts from handlers (BUG-15).
  - Refactor `getObjectContentLength` to return `{ ok: true, size } | { ok: false, reason: 'not_configured' | 'not_found' }`. Catch `HeadObjectCommand` 404 and return `{ ok: false, reason: 'not_found' }`. Callers emit specific i18n messages per case (BUG-10).
  - Add two new i18n keys (`files.r2NotConfigured`, `files.objectNotFound`) to both `locales/en.json` and `locales/id.json` (BUG-10).
  - Validate ALL `studentIds` have `role='student'` AND `deletedAt IS NULL` before the transaction in `createAssignmentHandler`. Reject entire request if any invalid (BUG-24).
  - Add `EMAIL_FROM` to `baseSchema` in `src/config/env.ts` as `z.string().min(1)`. Update `.env.example`. Replace `process.env.EMAIL_FROM` with `getEnv().EMAIL_FROM` in `email-queue-processor.ts:91`. Remove fallback (BUG-25).
  - Move `instructorId` check into WHERE clause of `getAssignmentDetailHandler`; drop JS post-query check and the `instructorId` column from the SELECT (BUG-26).
  - Store R2-verified `actualSize` instead of client-reported `fileSize` in the `submissions` INSERT in `submitCheckpointHandler` (BUG-27, resolved by BUG-10 fix).
- **Out of Scope:**
 - Moving R2 HEAD check outside the DB transaction (BUG-14 — deferred to TRACK-006 as it's a performance issue, not a correctness issue)
 - Concurrency fixes for settings/assignment handlers (TRACK-001 if applicable)

#### High-Level Execution Vectors

- **Phase 1 (Settings Validation):** Add `.inputValidator(Schema)` to all three `settings.ts` POST stubs using the typed builder pattern. Update handlers to receive typed args instead of `unknown`. Remove unsafe `args as { ... }` casts. Write tests that submit invalid inputs (`name: ""`, oversized strings, non-boolean `reducedMotion`, unsupported `extension`) and verify rejection at the validation layer.
- **Phase 2 (Storage & Env):** Refactor `getObjectContentLength` to return discriminated type `{ ok: true, size } | { ok: false, reason: 'not_configured' | 'not_found' }`. Wrap `client.send(command)` in try/catch to convert 404 to `not_found`. Update both callers (`submissions.server.ts:140`, `reviews.server.ts:333`) to handle each case with the appropriate i18n key. Add `files.r2NotConfigured` and `files.objectNotFound` to both locale files. Add `EMAIL_FROM` to `baseSchema` in `env.ts`, update `.env.example`, replace `process.env.EMAIL_FROM` with `getEnv().EMAIL_FROM` in `email-queue-processor.ts`.
- **Phase 3 (Assignment & Submission):** Add pre-transaction studentId validation query in `createAssignmentHandler` (SELECT `id` WHERE `id IN (studentIds) AND role='student' AND deletedAt IS NULL`, compare counts). Move `instructorId` into WHERE clause in `getAssignmentDetailHandler`. Change `fileSize` to `actualSize` in the `submissions` INSERT in `submitCheckpointHandler`.

#### Verification & Definition of Done (DoD)

- [x] **Manual Checkpoint:** Call `updateProfile` with `{ name: "" }` — rejected with Zod validation error (not silently accepted). Submit a file without R2 configured — error says "File storage is not configured" (not "File exceeds 25MB"). Create an assignment with an admin userId in `studentIds` — rejected with "One or more selected users are not active students". Start the app without `EMAIL_FROM` set — fails with Zod env validation error.
- [x] **Automated Tests:** `pnpm test:unit` — new tests for: settings Zod rejection (empty name, oversized, wrong types), storage error discrimination (not_configured vs not_found vs too_large), studentId role validation (admin/instructor/deleted userIds rejected), actualSize storage in submission record. All pass. Run `pnpm check:i18n` — new keys exist in both locales.
- [x] **Conductor Review:** No server function stub bypasses Zod validation (grep for `args: unknown` in `*.ts` stubs — should be zero outside of `getCurrentUser` GET). No `process.env` reads outside of `env.ts` and `storage.ts` (R2 client). `getObjectContentLength` callers handle all three result branches.

---

### TRACK-004: Email Queue Robustness

- **Status:** `Complete` (archived to `conductor/archive/email-queue-robustness_20260719/`)
- **Dependencies:** None
- **Estimated Effort:** 2 Days / 1 Sprint Loop
- **Audit IDs:** BUG-4, BUG-20, PERF-32, PERF-33 (re-scoped — see Decisions below)
- **Decisions:**
  - **Re-scope rationale:** The original scope (BUG-4 `resendMessageId`, BUG-20 retention cleanup, PERF-32/33 concurrent sends) was re-scoped after review. The email queue processor already had concurrency hardening (`FOR UPDATE SKIP LOCKED`, `isRunning` guard, stale-row reclaim) from prior work. The track was re-scoped to focus on **admin observability** (queue inspector UI), **manual retry capability**, **structured logging**, and **config hygiene** — gaps that were more impactful for day-to-day operations. The original BUG-4/BUG-20/PERF-32/33 items remain deferred to a future track if needed.
  - **FR-1 (Admin queue inspector):** New route `/admin/email-queue` with paginated list (20/page), status filter (All/Pending/Processing/Sent/Failed), search (recipient email OR subject), and summary stats (pending/sent/failed counts). Server function `listEmailQueue` runs 3 parallel queries (count, data, summary) via `Promise.all`. Admin-only (role check via `requireRole(['admin'])`). Route file kept thin (~138 lines) with 4 extracted subcomponents in `src/components/admin/email-queue/`.
  - **FR-2 (Manual retry):** Server function `retryEmail` resets a failed email to `pending` (status→pending, attempts→0, errorMessage→null, lastAttemptAt→null) inside a `db.transaction` with `SELECT ... FOR UPDATE` on the email_queue row. Idempotent guard: if `status !== 'failed'`, returns `CONFLICT` (409). Not-found returns `NOT_FOUND` (404). Confirmation Dialog on the client before retry. Admin-only.
  - **FR-3 (Processor lifecycle resilience):** Verified by test (not reimplemented). The existing `isRunning` guard and try/catch in the tick handler already prevent loop termination on throw. Test added in `email-queue-init.test.ts` verifying structured error logging on tick throw.
  - **FR-4 (Structured processor logging):** Replaced `console.error`/`console.log` with structured log objects: `email_queue.cycle_start` (dueCount), `email_queue.cycle_end` (processed/sent/failed/reclaimed), `email_queue.reclaimed` (count of stale rows reclaimed), `email_queue.send_failed` (emailId, error, attempts, status — NO PII). Tick errors logged as `email_queue.tick_error` with `willRetryNextInterval: true`. All logs are single-line JSON in production for log aggregation.
  - **FR-5 (Config hygiene — EMAIL_FROM):** Added `EMAIL_FROM` to `src/config/env.ts` as `z.string().default('SIMAK <noreply@simak.app>')` (with default fallback, not required). Replaced `process.env.EMAIL_FROM` in `email-queue-processor.ts` with `getEnv().EMAIL_FROM`. Added to `.env.example` (commented out, optional). Note: TRACK-003 BUG-25 originally planned `z.string().min(1)` (required, no default) — the default-fallback approach was chosen to avoid breaking existing deployments that don't have `EMAIL_FROM` set. TRACK-003 should decide whether to tighten this to required.

#### Context Anchors (Traceability)

- **PRD Reference:** `docs/PRD.md` (email notifications, admin email queue management)
- **TDD Reference:** `docs/TDD.md` (email queue architecture, background processor, Resend integration, admin route structure)

#### Track Tech Stack

- TanStack Start server functions (two-file split: `email-queue.ts` stubs + `email-queue.server.ts` handlers)
- Zod schemas (input validation for list/retry)
- Drizzle ORM (`email_queue` table, `FOR UPDATE` row locking for retry idempotency)
- `src/lib/email-queue-processor.ts` (structured logging, `getEnv().EMAIL_FROM`)
- `src/lib/email-queue-init.ts` (tick error logging)
- `src/config/env.ts` (Zod-validated `EMAIL_FROM` with default)
- shadcn/ui components (Card, Select, Badge, Dialog, Pagination, Input)

#### Scope Boundaries

- **In Scope (implemented):**
  - Admin queue inspector page at `/admin/email-queue` — paginated list (20/page), status filter, search (recipient email OR subject), summary stats (pending/sent/failed counts). Admin-only via `requireRole(['admin'])` (FR-1).
  - Manual retry of failed emails — `retryEmail` server function resets status→pending, attempts→0, errorMessage→null, lastAttemptAt→null inside a `db.transaction` with `SELECT ... FOR UPDATE`. Idempotent guard (`status !== 'failed'` → CONFLICT). Confirmation Dialog on client (FR-2).
  - Processor lifecycle resilience — verified by test (not reimplemented). Tick handler try/catch already prevents loop termination (FR-3).
  - Structured processor logging — `email_queue.cycle_start`, `email_queue.cycle_end`, `email_queue.reclaimed`, `email_queue.send_failed` (NO PII), `email_queue.tick_error` (FR-4).
  - Config hygiene — `EMAIL_FROM` added to `src/config/env.ts` as `z.string().default('SIMAK <noreply@simak.app>')`. Replaced `process.env.EMAIL_FROM` with `getEnv().EMAIL_FROM` in processor. Added to `.env.example` (FR-5).
  - Admin sidebar entry with Mail icon linking to `/admin/email-queue`.
  - 31 new i18n keys (`adminEmailQueue.*`) + 1 sidebar key in both `en.json` and `id.json`.
  - 45 new tests across 6 files (config, processor, init, server handlers, route component).
- **Out of Scope:**
  - `resendMessageId` column (BUG-4) — deferred to future track
  - Retention cleanup DELETE (BUG-20) — deferred to future track
  - Concurrent sends via `Promise.allSettled` (PERF-32/33) — deferred to future track
  - Removing dead SLA notification rows (BUG-21 — TRACK-002, already complete)
  - Email template/content changes
  - Background job scheduling infrastructure changes

#### High-Level Execution Vectors

- **Phase 1 (Config Hygiene):** Added `EMAIL_FROM` to `src/config/env.ts` with Zod validation and default fallback. Replaced `process.env.EMAIL_FROM` in `email-queue-processor.ts` with `getEnv().EMAIL_FROM`. Updated `.env.example`. Tests: EMAIL_FROM from env, default when unset. Commit: `2bcf3d2` → checkpoint `f4eb97a`.
- **Phase 2 (Structured Logging):** Added structured log objects to `email-queue-processor.ts` (cycle_start, cycle_end, reclaimed, send_failed with NO PII) and `email-queue-init.ts` (tick_error). Extracted mock DB helpers to `tests/unit/lib/helpers/email-queue-mock.ts`. Tests: reads EMAIL_FROM from getEnv(), default, reclaimed count, cycle_start/end logs, reclamation log, per-email failure log with NO PII assertion. Commits: `de96e09` → `4801a1f`.
- **Phase 3 (Server Functions):** Created `email-queue.server.ts` (listEmailQueueHandler + retryEmailHandler) and `email-queue.ts` (Zod schemas + createServerFn stubs). listEmailQueue: 3 parallel queries via Promise.all (count/data/summary), pagination (limit=20/offset), status filter, ilike search. retryEmail: db.transaction with FOR UPDATE, idempotent guard (CONFLICT), not-found (NOT_FOUND). Tests: 45 new tests covering schemas, stubs, handlers, role checks, error cases. Commits: `e5393c4`, `c2dabd8` → `2141cba`.
- **Phase 4 (Inspector UI):** Created route `src/routes/_authenticated/admin/email-queue.tsx` with validateSearch/loaderDeps/loader, EmailQueuePage component (summary stats, filters, table, retry Dialog, pagination). Added admin sidebar entry. 31 i18n keys in both locales. Review fixes: extracted 4 subcomponents to `src/components/admin/email-queue/` (route 334→138 lines), moved shared types to client-safe `email-queue.ts`, added type assertion justification comments, replaced non-null assertion with explicit null check. Commit: `cdb08a8` → `9ac6bc4` → review fixes `652c9ec`.

#### Verification & Definition of Done (DoD)

- [x] **Manual Checkpoint:** Admin navigates to `/admin/email-queue` — sees paginated queue with summary stats (pending/sent/failed). Filters by status, searches by recipient email or subject. Clicks Retry on a failed email — confirmation Dialog appears — confirms — row returns to `pending` status. Processor logs show structured `email_queue.cycle_start`/`cycle_end` with counts. No PII in failure logs.
- [x] **Automated Tests:** `pnpm test:unit` — 262 test files, 2445 tests (+32 xlsx-threaded = 2477 total), all pass. 45 new tests across 6 files: `env.test.ts` (EMAIL_FROM), `email-queue-init.test.ts` (tick error log), `email-queue-processor.test.ts` (getEnv EMAIL_FROM, default, reclaimed, cycle logs, failure log NO PII), `email-queue.test.ts` (schemas, stubs, listEmailQueue handler: pagination/filter/search/summary/role checks/errors, retryEmail handler: reset fields/CONFLICT/NOT_FOUND/role checks/errors), `admin-email-queue.test.tsx` (route, summary, table, retry dialog, filters, empty states). Coverage: lines 87.55%, statements 81.38%, branches 81.37%, functions 88.2% (all ≥80%).
- [x] **Conductor Review:** `EMAIL_FROM` in `env.ts` with default. No `process.env.EMAIL_FROM` in processor. Structured logs present (cycle_start/end, reclaimed, send_failed, tick_error). Admin inspector at `/admin/email-queue` with pagination/filter/search/summary. Retry handler uses `FOR UPDATE` + idempotent guard. All files under 500 lines. `pnpm typecheck`, `pnpm lint`, `pnpm check:i18n` all pass. Code review completed with 3 fixes applied (route subcomponent extraction, shared types, type assertion comments). Track archived to `conductor/archive/email-queue-robustness_20260719/`.

---

## Milestone 2: Performance & Optimization

> These tracks address database performance, query efficiency, and bundle safety. TRACK-005 (indexes) should be completed before TRACK-006 (query optimization) as indexes are a prerequisite for optimal query plans.

---

### TRACK-005: Database Indexes & Schema Optimization

- **Status:** `Complete` (archived to `conductor/archive/database-indexes-schema-optimization_20260719/`)
- **Dependencies:** None
- **Estimated Effort:** 1 Day / 0.5 Sprint Loops
- **Audit IDs:** PERF-7, PERF-8, PERF-9, PERF-10, PERF-11, PERF-12, PERF-13, PERF-14
- **Decisions:**
  - **PERF-11 (consultations):** Replace — DROP `consultations_status_idx` (low-cardinality, 3 enum values, rarely useful), CREATE `consultations_assignment_id_status_idx` on `(assignmentId, status)`. One useful index instead of two. Drizzle generates DROP + CREATE automatically.
  - **PERF-14 (reviews):** Replace — DROP `reviews_submission_id_idx`, CREATE `reviews_submission_id_created_at_idx` on `(submissionId, createdAt)`. The composite's leftmost prefix `(submissionId)` still satisfies FK enforcement, so the replacement is safe. Strictly better — covers both the join and `ORDER BY createdAt DESC`.
  - **PERF-8 (notifications):** Minimal — add only `notifications_created_at_idx` on `(createdAt)`. Fixes the HIGH-priority admin dashboard full-table scan. Keep existing `(userId, read)` index as-is (user notification list is paginated to 50, acceptable without ORDER BY optimization).
  - **Migration approach:** Standard — `pnpm db:generate` + `pnpm db:migrate`. Drizzle generates standard `CREATE INDEX` (not `CONCURRENTLY`). Table locks are trivial for this data volume (academic app). No hand-editing of migration SQL.

#### Context Anchors (Traceability)

- **PRD Reference:** `docs/PRD.md` (all list/dashboard features that query these tables)
- **TDD Reference:** `docs/TDD.md` (database schema definitions, index strategy)

#### Track Tech Stack

- Drizzle ORM indexes (`index('name').on(table.col1, table.col2)`)
- Drizzle Kit migrations (`pnpm db:generate`, `pnpm db:migrate`)
- PostgreSQL `EXPLAIN ANALYZE` for verification

#### Scope Boundaries

- **In Scope:**
  - **PERF-7 [HIGH]:** Add `assignment_students_assignment_id_student_id_idx` on `(assignmentId, studentId)` + `assignment_students_student_id_idx` on `(studentId)` to `assignmentStudents` table (currently has ZERO indexes — most-queried join table). Requires adding the table-callback function (currently a plain object).
  - **PERF-8 [HIGH]:** Add `notifications_created_at_idx` on `(createdAt)` to `notifications` table. Fixes admin dashboard `recentActivity` full-table scan. Keep existing `(userId, read)` index.
  - **PERF-9:** Add `template_checkpoints_template_id_order_idx` on `(templateId, order)` to `templateCheckpoints` (currently has ZERO indexes). Requires adding the table-callback function.
  - **PERF-10:** Add `users_role_deleted_at_idx` on `(role, deletedAt)` to `users` table for admin user list filtering. Requires adding the table-callback function.
  - **PERF-11:** Replace `consultations_status_idx` on `(status)` with `consultations_assignment_id_status_idx` on `(assignmentId, status)`. DROP the low-cardinality standalone index; CREATE the composite. Keep existing `consultations_checkpoint_id_idx`.
  - **PERF-12:** Add `extension_requests_assignment_id_student_id_idx` on `(assignmentId, studentId)` to `extensionRequests`. Keep existing `extension_requests_assignment_id_status_idx`.
  - **PERF-13:** Add `audit_log_actor_id_idx` on `(actorId)` to `auditLog` for JOIN in `listAuditLogsHandler`. Keep existing `(createdAt)`, `(action)`, `(entityType, entityId)` indexes.
  - **PERF-14:** Replace `reviews_submission_id_idx` on `(submissionId)` with `reviews_submission_id_created_at_idx` on `(submissionId, createdAt)`. DROP + CREATE. Leftmost prefix satisfies FK enforcement.
- **Out of Scope:**
  - Query rewriting / N+1 elimination (TRACK-006)
  - Adding pagination to unbounded queries (TRACK-006)
  - `(userId, type, createdAt)` composite for notifications (minimal approach chosen)
  - Schema changes beyond index additions/replacements

#### High-Level Execution Vectors

- **Phase 1 (Schema Changes — 7 files):** Edit 7 schema files in `src/db/schema/`:
  - `assignments.ts` — `assignmentStudents` gains the table-callback function with 2 indexes (currently a plain object, no callback).
  - `notifications.ts` — add `createdAt` index to existing callback.
  - `templates.ts` — `templateCheckpoints` gains the table-callback function with 1 index (currently a plain object).
  - `users.ts` — `users` gains the table-callback function with 1 index (currently a plain object).
  - `consultations.ts` — replace `(status)` index definition with `(assignmentId, status)` in existing callback.
  - `extensions.ts` — add `(assignmentId, studentId)` index to existing callback.
  - `submissions.ts` — replace `(submissionId)` index definition with `(submissionId, createdAt)` in `reviews` table callback.
  - Run `pnpm db:generate` to create the migration. Review the generated SQL — expect 7 `CREATE INDEX` + 2 `DROP INDEX` statements (for the 2 replacements).
- **Phase 2 (Migration & Verification):** Run `pnpm db:migrate` on dev DB. Use `EXPLAIN ANALYZE` on key queries to verify index usage:
  - Admin dashboard `recentActivity` — confirm Index Scan on `notifications_created_at_idx` instead of Seq Scan.
  - Ownership check query (`assignmentStudents` join) — confirm Index Scan.
  - `listPendingConsultationsHandler` — confirm Index Scan on `consultations_assignment_id_status_idx`.
  - Review history query — confirm Index Scan on `reviews_submission_id_created_at_idx`.
  - Write a test that verifies all 9 indexes exist (query `pg_indexes` or use Drizzle's schema introspection).

#### Verification & Definition of Done (DoD)

- [x] **Manual Checkpoint:** `EXPLAIN ANALYZE` verified on 4 queries: (1) admin dashboard `recentActivity` — Index Scan on `notifications_created_at_idx`; (2) ownership check query — Index Scan on `assignment_students_assignment_id_student_id_idx`; (3) `listPendingConsultationsHandler` — Index Scan on `consultations_assignment_id_status_idx`; (4) review history query — Index Scan on `reviews_submission_id_created_at_idx`.
- [x] **Automated Tests:** `pnpm test:unit` — 15 new unit tests in `tests/unit/db/schema/indexes.test.ts` (Drizzle Symbol introspection) + 2 integration tests in `tests/integration/db/migration-applied.test.ts` (query `pg_indexes` view). All pass. Migration `0008_deep_santa_claus.sql` applies cleanly. Typecheck and lint clean.
- [x] **Conductor Review:** All 9 indexes (7 new + 2 replaced) verified non-breaking. The 2 replaced indexes (`consultations_status_idx` → `consultations_assignment_id_status_idx`, `reviews_submission_id_idx` → `reviews_submission_id_created_at_idx`) correctly dropped and recreated — no orphaned indexes. FK enforcement on `reviews.submissionId` confirmed via leftmost-prefix rule. Review found missing rollback file (SQL styleguide §5.1) — created `0008_deep_santa_claus.rollback.sql` with 9 DROP IF EXISTS + 2 CREATE INDEX (recreating replaced single-column indexes).

---

### TRACK-006: Query & Data-Fetching Optimization

- **Status:** `Complete` (archived to `conductor/archive/query-data-fetching-optimization_20260719/`)
- **Dependencies:** TRACK-005 (indexes should be in place before optimizing queries)
- **Estimated Effort:** 4 Days / 2 Sprint Loops
- **Audit IDs:** PERF-1, PERF-2, PERF-3, PERF-4, PERF-5, PERF-6, PERF-15, PERF-16, PERF-17, PERF-18, PERF-19, PERF-20, PERF-21, PERF-23, PERF-24, PERF-25, PERF-26, PERF-35, BUG-14
- **Decisions:**
  - **PERF-15-21 (Pagination):** Full pagination for the 5 list handler endpoints (consultations, pending consultations, submissions, template assignments, extension requests) — add page/limit Zod params matching the `listInstructorAssignmentsHandler` pattern, with total count queries and client-side Pagination components. Dashboard queries (`activeAssignments` student, `assignmentOverview` instructor) get a hardcoded `.limit(20)` safety cap since they are inline widgets within a multi-data dashboard response and cannot be independently paginated.
  - **PERF-35 (correlated subquery):** Rewrite using a LATERAL join — restructure the query to start from checkpoints and LATERAL join the latest submission per checkpoint (`ORDER BY version DESC LIMIT 1`). PostgreSQL optimizes this well, typically as an index scan on `submissions(checkpoint_id, version)`.
  - **PERF-36 (audit-log LIKE):** Leave as-is. Admin-only, paginated (20/page), modest table volume (thousands of rows, not millions). The full scan is acceptable. Dropped from TRACK-006 scope — defer until EXPLAIN ANALYZE shows a problem.
  - **PERF-5 (SLA dispatch):** Remove dead `channel:'email'` notification rows (TRACK-002 BUG-21 coordination). Batch the in-app notification INSERT into a single `db.insert(notifications).values([...])` for all admins. Send SLA alert emails concurrently with `Promise.allSettled`.
  - **PERF-6 (bulk-import post-commit):** Send invitation emails concurrently with `Promise.allSettled` (each does locale lookup + enqueue). Batch audit log inserts into a single `db.insert(auditLog).values([...])`.
  - **PERF-23 (notifications over-fetch):** Select only needed columns (`id, type, titleKey, messageKey, params, read, createdAt`) — keep `params` for resolution, drop `metadata`. After resolution, construct response objects explicitly (no `...item` spread) to avoid leaking raw columns into the response.
  - **PERF-24 (redundant locale query):** Use `session.user.locale` directly (already enriched in `auth.ts:60` via `_getSession`). Remove the separate `SELECT locale FROM users` query.
  - **BUG-14 (R2 HEAD inside transaction):** Move `getObjectContentLength` call before `db.transaction()` in both `submitCheckpointHandler` and `submitReviewHandler`. Coordinates with TRACK-003 BUG-10 (discriminated return type from `getObjectContentLength`).
  - **Review fix (§6.4 compliance):** During code review, `bulkExtendHandler`'s advisory work (batch audit INSERT + notification INSERT after transaction commit) was found to not be wrapped in try/catch — violating SQL styleguide §6.4. Fixed by wrapping each advisory INSERT in its own try/catch with `console.error`, matching the pattern used by sibling handlers (`approveExtensionHandler`, `rejectExtensionHandler`).

#### Context Anchors (Traceability)

- **PRD Reference:** `docs/PRD.md` (consultation counts, extension adjustments, dashboard data, template list, instructor assignments)
- **TDD Reference:** `docs/TDD.md` (query patterns, pagination strategy, data-fetching layer)

#### Track Tech Stack

- Drizzle ORM (`groupBy`, `inArray`, bulk `UPDATE ... WHERE`, `Promise.all`, `Promise.allSettled`)
- PostgreSQL `LATERAL` joins
- TanStack Query (client-side Pagination components, Zod schemas for page/limit params)

#### Scope Boundaries

- **In Scope:**
  - **N+1 elimination:** Replace per-checkpoint COUNT loop in `listVerifiedCountsHandler` with a single `GROUP BY` query (PERF-1). Replace sequential per-checkpoint UPDATE loops in `calculateExtensionAdjustment`, `bulkExtendHandler`, and `adjustDeadlinesForBreach` with bulk `UPDATE ... WHERE order > ?` (PERF-2, PERF-3, PERF-4). Batch `dispatchSLABreachNotifications` admin loop: remove dead `channel:'email'` rows, batch in-app INSERT, `Promise.allSettled` emails (PERF-5). Batch `bulk-import.server.ts` post-commit: `Promise.allSettled` invitation emails, batch audit INSERT (PERF-6).
  - **Missing pagination:** Add full pagination (page/limit Zod params + total count query + client-side Pagination component) to `listConsultationsHandler` (PERF-15), `listPendingConsultationsHandler` (PERF-16), `listSubmissionsHandler` (PERF-17), `listTemplateAssignmentsHandler` (PERF-18), `listMyExtensionRequestsHandler` (PERF-19). Add safety `.limit(20)` cap to student dashboard `activeAssignments` (PERF-20) and instructor dashboard `assignmentOverview` (PERF-21).
  - **Over-fetching:** Select only needed columns in `listNotificationsHandler` (`id, type, titleKey, messageKey, params, read, createdAt` — keep `params` for resolution, drop `metadata`). After resolution, construct response objects explicitly without `...item` spread (PERF-23). Remove redundant `SELECT locale FROM users` — use `session.user.locale` directly (PERF-24).
  - **Parallelization:** Parallelize independent queries in `listTemplatesHandler` (total count + distinct types run in parallel with data query via `Promise.all`; checkpoint counts + names remain dependent on data query) (PERF-25). Parallelize `listInstructorAssignmentsHandler` (total count runs in parallel with data query via `Promise.all`; student counts remain dependent on data query) (PERF-26).
  - **Query optimization:** Replace correlated subquery in `listPendingReviewsHandler` (`reviews.server.ts:109-114`) with a LATERAL join — start from checkpoints, LATERAL join latest submission per checkpoint (`ORDER BY version DESC LIMIT 1`) (PERF-35).
  - **R2 HEAD outside transaction:** Move `getObjectContentLength` call before the `FOR UPDATE` lock in `submitCheckpointHandler` and `submitReviewHandler` to avoid holding row locks during slow I/O (BUG-14). Coordinates with TRACK-003 BUG-10 (discriminated return type).
- **Out of Scope:**
  - Session caching (TRACK-007)
  - Bundle splitting (TRACK-007)
  - Client-side query refetch tuning (TRACK-007)
  - PERF-36 (audit-log LIKE on jsonb — left as-is, admin-only, defer until EXPLAIN ANALYZE shows a problem)

#### High-Level Execution Vectors

- **Phase 1 (N+1 Fixes):** Rewrote `listVerifiedCountsHandler` with a single `GROUP BY` query (PERF-1). Rewrote the three sequential-UPDATE loops (`calculateExtensionAdjustment`, `bulkExtendHandler`, `adjustDeadlinesForBreach`) as bulk `UPDATE ... WHERE order > targetCheckpoint.order` (PERF-2, PERF-3, PERF-4). Rewrote `dispatchSLABreachNotifications`: removed dead `channel:'email'` rows, batched in-app INSERT into single `db.insert(notifications).values([...])`, `Promise.allSettled` the `sendSLAAlertEmail` calls (PERF-5). Rewrote `bulk-import.server.ts` post-commit: `Promise.allSettled` invitation emails, batched audit INSERT (PERF-6). Commits: `16c543c`, `a1c1ece`, `de69169`, `23943d3` → checkpoint `f3df6e2`.
- **Phase 2 (Pagination):** Added page/limit Zod params + total count queries + client-side Pagination components to the 5 list handlers (consultations, pending consultations, submissions, template assignments, extension requests). Added `.limit(20)` safety cap to the 2 dashboard queries (activeAssignments, assignmentOverview). Commits: `d4d4655`, `17e70fe`, `2bc80d9`, `718c756`, `540e518`, `ea386e1` → checkpoint `162d012`.
- **Phase 3 (Over-fetch, Parallel & Query Rewrite):** Narrowed `listNotificationsHandler` SELECT to specific columns, constructed response objects explicitly (no `...item` spread) (PERF-23). Removed redundant locale query — used `session.user.locale` (PERF-24). Parallelized `listTemplatesHandler` and `listInstructorAssignmentsHandler` independent queries with `Promise.all` (PERF-25, PERF-26). Rewrote the `listPendingReviewsHandler` correlated subquery as a LATERAL join (PERF-35). Moved `getObjectContentLength` calls before `db.transaction()` in both handlers (BUG-14). Commits: `1938fcf`, `e3e1f2f`, `1c3f70f`, `f81c77d`, `45fb0df`, `8e2190a` → checkpoint `bb3c171`.
- **Phase 4 (Tests & Verification):** Verified all query results are identical before/after N+1 rewrites. Ran `EXPLAIN ANALYZE` on the LATERAL join query and the bulk UPDATEs to confirm improved plans. Fixed `logAuditEvent` N+1 in `bulkExtendHandler` (replaced sequential calls with batch INSERT). Commit: `662df5a` → checkpoint `c65b6f3`. Review fix: wrapped advisory INSERTs in try/catch per §6.4. Commit: `bda0e3b`.

#### Verification & Definition of Done (DoD)

- [x] **Manual Checkpoint:** Load the student assignment detail page — `listVerifiedCountsHandler` makes 1 query instead of N. Load notification list — response payload is smaller (no `metadata`, no leaked raw columns). Load instructor review queue — LATERAL join query is efficient in EXPLAIN ANALYZE. Submit a checkpoint — R2 HEAD check occurs before transaction opens (no lock held during I/O). Navigate to paginated list pages — Pagination component renders correctly.
- [x] **Automated Tests:** `pnpm test:unit` — 266 test files, 2508 tests, all pass. New tests verify: pagination limits and total counts for 5 list handlers, GROUP BY result parity for `listVerifiedCountsHandler`, bulk UPDATE result parity for 3 extension/SLA functions, concurrent sending in `dispatchSLABreachNotifications`, batched audit INSERT in bulk-import, explicit response construction in `listNotificationsHandler`, LATERAL join query results. `pnpm test:coverage` >= 80% (lines 87.55%, statements 81.38%, branches 81.37%, functions 88.2%).
- [x] **Conductor Review:** No sequential per-row queries remain in server handlers (grep for `for (const` in `.server.ts` files). All 5 list handlers have page/limit Zod params + total count queries. Both dashboard queries have `.limit(20)`. `listNotificationsHandler` does not spread `...item` into the response. `getObjectContentLength` is called before `db.transaction()` in both `submitCheckpointHandler` and `submitReviewHandler`. PERF-36 is explicitly documented as deferred. One Medium finding (§6.4 violation in `bulkExtendHandler`) fixed during review. Track archived to `conductor/archive/query-data-fetching-optimization_20260719/`.

---

### TRACK-007: Session Caching & Bundle Safety

- **Status:** `Complete` (archived to `conductor/archive/session-caching-bundle-safety_20260719/`)
- **Dependencies:** None
- **Estimated Effort:** 2 Days / 1 Sprint Loop
- **Audit IDs:** PERF-22, PERF-34
- **Decisions:**
  - **PERF-22 (session caching):** Short-TTL in-memory cache (5s) keyed by user ID. A simple `Map<string, { role, locale, expiresAt }>` inside the `_getSession` handler. After Better Auth's `auth.api.getSession()` returns a valid user ID, check the cache. If hit, use cached role/locale values. If miss, do the DB query and cache the result with a 5s TTL. Clean up expired entries on cache miss (lazy eviction). No AsyncLocalStorage — each server function call is a separate HTTP request, so ALS only helps within a single request (rare; handlers typically call `getSessionFromHeaders()` once). The short-TTL cache handles the real problem: cross-request redundancy during a page load that triggers 4-6 server function calls. Tradeoff: 5s delay for soft-delete lockout and role changes — acceptable for a university system.
  - **PERF-34 (auth.ts split):** Split `src/server/auth.ts` into the standard two-file pattern: `auth.ts` (client-safe stub: `Session` type, `getSessionFromHeaders`, `requireRole`, `_getSession` createServerFn with dynamic import to `auth.server.ts` — no DB/schema imports) and `auth.server.ts` (handler: Better Auth session validation, DB query, short-TTL cache). 6 route layout files import from `auth.ts` — they get only client-safe code. Verify with `vite-bundle-visualizer` before and after that `pg`/`drizzle-orm` don't leak into the client bundle.
  - **PERF-37 (template caching):** Dropped from scope. Templates are small tables (dozens of rows), indexed after TRACK-005, and queried infrequently (template list, assignment creation, assignment detail). DB queries are fast. Defer until profiling shows a problem. Role permissions are already in-memory (`role-permissions.ts`) — correct, no action needed.

#### Context Anchors (Traceability)

- **PRD Reference:** `docs/PRD.md` (session management, authentication, server function architecture)
- **TDD Reference:** `docs/TDD.md` (server function architecture, bundle splitting)

#### Track Tech Stack

- In-memory `Map` with TTL (session cache)
- TanStack Start server function two-file stub pattern (dynamic import)
- Vite bundle analysis (`vite-bundle-visualizer`)

#### Scope Boundaries

- **In Scope:**
  - **Session caching (PERF-22):** Add a `Map<string, { role, locale, expiresAt }>` with 5s TTL inside the `_getSession` handler (in `auth.server.ts` after the split). Key: `u.user.id` from Better Auth's session response. Check cache after `auth.api.getSession()` succeeds; if hit, skip the DB query; if miss, query DB and cache the result. Lazy eviction of expired entries on cache miss. No AsyncLocalStorage. Tradeoff documented: 5s delay for soft-delete lockout and role changes.
  - **auth.ts two-file split (PERF-34):** Split `src/server/auth.ts` into `auth.ts` (stub: `Session` type, `getSessionFromHeaders`, `requireRole`, `_getSession` createServerFn with `await import('./auth.server')` — no DB/schema/auth imports) and `auth.server.ts` (handler: `getRequestHeaders`, `auth.api.getSession`, `getDb`, `users` schema, DB query, session cache). Update all 6 route layout files to import from `auth.ts` (unchanged import paths — they already import from `@/server/auth` or `../../server/auth`). Run `vite-bundle-visualizer` before and after to verify no `pg`/`drizzle-orm` in client bundle.
- **Out of Scope:**
  - AsyncLocalStorage request-scoped context (doesn't help for the main use case — cross-request redundancy)
  - Template caching (PERF-37 — dropped, defer until profiling)
  - Redis or external cache infrastructure
  - Client-side query refetch tuning (TRACK-012)
  - Role permissions (already in-memory — `role-permissions.ts` is correct)

#### High-Level Execution Vectors

- **Phase 1 (auth.ts split):** Create `src/server/auth.server.ts` with the `getSessionHandler` function (Better Auth validation + DB query + session cache). Rewrite `src/server/auth.ts` as a stub: `Session` type, `_getSession` createServerFn with `await import('./auth.server')`, `getSessionFromHeaders`, `requireRole`. Verify all 6 route layout imports still resolve. Run `pnpm typecheck`. Run `vite-bundle-visualizer` before and after.
- **Phase 2 (Session cache):** Add the `Map<string, { role, locale, expiresAt }>` cache with 5s TTL inside `getSessionHandler` in `auth.server.ts`. After `auth.api.getSession()` returns a valid `u.user.id`, check the cache. If hit and not expired, return the cached role/locale. If miss or expired, do the DB query, cache the result, and evict any expired entries found during the lookup. Write tests verifying: cache hit skips DB query, cache miss queries DB and caches, expiry after 5s triggers re-query, concurrent requests share cache.
- **Phase 3 (Tests & Bundle verification):** Update existing `auth.test.ts` tests to mock `auth.server` instead of `auth`. Add cache-specific tests. Run `pnpm build` and inspect bundle output. Verify `pg`/`drizzle-orm` are not in the client bundle.

#### Verification & Definition of Done (DoD)

- [x] **Manual Checkpoint:** Bundle verification confirmed — grep of 106 client JS chunks for `pg`/`drizzle-orm`/`postgres` returned 0 matches. `auth.ts` (43 lines) contains no DB/schema/auth imports — only `Session` type, `getSessionFromHeaders`, `requireRole`, and `_getSession` with dynamic import to `auth.server.ts`. Session cache uses 5s TTL with lazy eviction. Soft-delete check is skipped on cache hit (documented tradeoff: soft-deleted user retains access for up to 5s).
- [x] **Automated Tests:** `pnpm test:unit` — 263 test files, 2488 tests, all pass. 13 test cases in `auth-server.test.ts` covering: null session, valid session, soft-deleted user, emailVerified flag, DB query path, payload vs DB fallback, cache miss/hit/expiry/concurrent access/lazy eviction. `auth.test.ts` has file-content assertions (AC-1: 0 forbidden imports), delegation tests, and requireRole tests. `pnpm typecheck` passes. `pnpm lint` — 0 warnings, 0 errors on 253 files. Coverage ≥ 80% (all thresholds met).
- [x] **Conductor Review:** `auth.ts` follows the two-file stub pattern (grep confirmed 0 forbidden imports: `getDb`, `users` schema, `auth` config). No server-only code in client-bundled files. Session cache has 5s TTL and lazy eviction. PERF-37 (template caching) explicitly documented as deferred. Review found 5 issues (1 Medium, 4 Low) — all fixed in commit `d30059d`: renamed `_clearSessionCache` → `clearSessionCacheForTests` (TS style guide compliance), extracted `buildSession()` helper to eliminate duplicated return object construction, removed 3 stale mocks from `auth.test.ts`, added missing `afterEach` import, removed unnecessary optional chaining. Track archived to `conductor/archive/session-caching-bundle-safety_20260719/`.

---

## Milestone 3: UX & Accessibility

> These tracks address user experience gaps, broken functionality, accessibility violations, and i18n compliance. Most tracks are independent and can be parallelized.

---

### TRACK-008: Critical UX Fixes (Broken Functionality)

- **Status:** `Complete` (archived to `conductor/archive/critical-ux-fixes_20260720/`)
- **Dependencies:** None
- **Estimated Effort:** 1 Day / 0.5 Sprint Loops
- **Audit IDs:** UX-29, UX-38, UX-39, UX-57
- **Decisions:**
  - **UX-29 (FileUploader "Upload Another" broken):** Add `onResetSuccess?: () => void` callback prop to `FileUploader`. Call `onResetSuccess?.()` inside `handleReset()` (after clearing internal state). Parent `CheckpointSubmissionPage` passes `() => setUploadSuccess(false)` as the callback. This is the minimal fix — preserves the existing prop-based architecture where the parent owns the `uploadSuccess` state. No refactor to internal state management needed.
  - **UX-38 (404 page links to non-existent `/dashboard`):** Change `href="/dashboard"` to `href="/"`. Change label from `t('common.goToDashboard')` to `t('common.goHome')`. Add new i18n key `common.goHome` = "Go Home" (en) / "Ke Beranda" (id) to both `locales/en.json` and `locales/id.json`. Run `pnpm generate:i18n` to regenerate types. An authenticated user on the landing page can click "Login" which redirects them to their role dashboard via the `_unauthenticated` layout. No client-side auth check needed — keeps the 404 component simple.
  - **UX-39 (ErrorBoundary misleading label):** Link already goes to `/` — only the label needs fixing. Change `t('common.goToDashboard')` to `t('common.goHome')` (same new i18n key as UX-38).
  - **UX-57 (empty list pagination):** Wrap `<Pagination>` in `{users.length > 0 && (...)}` in `admin/users/index.tsx:211-218`. Matches the pattern in `student/assignments/index.tsx`.

#### Context Anchors (Traceability)

- **PRD Reference:** `docs/PRD.md` (file upload, error pages, user list)
- **TDD Reference:** `docs/TDD.md` (routing, 404 handling, component state management)

#### Track Tech Stack

- React state management (callback prop pattern for parent-owned state)
- TanStack Router (404 component, route definitions)
- i18n codegen (`pnpm generate:i18n` for new `common.goHome` key)
- `src/routes/__root.tsx` (NotFoundComponent)
- `src/components/files/file-uploader.tsx` (FileUploader + new `onResetSuccess` prop)
- `src/routes/_authenticated/student/assignments/$id.checkpoints.$checkpointId.tsx` (CheckpointSubmissionPage parent)
- `src/components/error-boundary.tsx` (RootErrorComponent)
- `src/routes/_authenticated/admin/users/index.tsx` (UsersPage pagination)

#### Scope Boundaries

- **In Scope:**
  - **UX-29 (FileUploader fix):** Add `onResetSuccess?: () => void` prop to `FileUploaderProps`. Call `onResetSuccess?.()` in `handleReset()` (line 88-94 of `file-uploader.tsx`). Pass `() => setUploadSuccess(false)` from `CheckpointSubmissionPage` (line 131 of `$id.checkpoints.$checkpointId.tsx`). Verify the full flow: upload -> success view -> click "Upload Another" -> dropzone reappears.
  - **UX-38 (404 link fix):** Change `href="/dashboard"` to `href="/"` in `NotFoundComponent` (`__root.tsx:112`). Change label from `t('common.goToDashboard')` to `t('common.goHome')`. Add `common.goHome` key to `locales/en.json` ("Go Home") and `locales/id.json` ("Ke Beranda"). Run `pnpm generate:i18n`.
  - **UX-39 (ErrorBoundary label fix):** Change label from `t('common.goToDashboard')` to `t('common.goHome')` in `RootErrorComponent` (`error-boundary.tsx:38`). Link already goes to `/` — no link change needed.
  - **UX-57 (empty list pagination):** Wrap `<Pagination>` in `{users.length > 0 && (...)}` in `admin/users/index.tsx:211-218`.
- **Out of Scope:**
  - Adding `toast.success` calls (TRACK-009)
  - Adding `pendingComponent` to routes (TRACK-009)
  - File upload progress percentage (TRACK-013)
  - Client-side auth check for role-specific dashboard links (defer — current fix is simple and honest)

#### High-Level Execution Vectors

- **Phase 1 (FileUploader Fix):** Add `onResetSuccess` prop to `FileUploaderProps` interface. Call it in `handleReset()`. Pass callback from `CheckpointSubmissionPage`. Write a test verifying the "Upload Another" flow: upload -> success -> click "Upload Another" -> dropzone reappears -> new file selectable.
- **Phase 2 (Navigation & Pagination Fixes):** Add `common.goHome` i18n key to both locale files. Run `pnpm generate:i18n`. Change 404 link to `/` and label to `t('common.goHome')`. Change ErrorBoundary label to `t('common.goHome')`. Wrap pagination in conditional. Write tests for 404 navigation, ErrorBoundary label, and empty-list pagination rendering.

#### Verification & Definition of Done (DoD)

- [x] **Manual Checkpoint:** Upload a file -> click "Upload Another" -> dropzone reappears and a new file can be uploaded. Navigate to a non-existent route -> click "Go Home" -> lands on the landing page (not another 404). Trigger an error boundary -> click "Go Home" -> lands on the landing page. View empty user list -> no pagination controls rendered.
- [x] **Automated Tests:** `pnpm test:unit` — 263 test files, 2494 tests, all pass. New tests for FileUploader reset flow (onResetSuccess called, dropzone reappears, optional callback), 404 link target (`href="/"` not `/dashboard`), ErrorBoundary label (`t('common.goHome')`), empty-list pagination hidden. `pnpm check:i18n` passes (713=713 keys, `common.goHome` in both locales). `pnpm typecheck` clean. `pnpm lint` — 0 warnings, 0 errors. Coverage: 87.66% stmts / 81.32% branches / 81.36% funcs / 88.29% lines (all >= 80%).
- [x] **Conductor Review:** No broken links remain (grep for `href="/dashboard"` in `src/` returns zero matches). `common.goHome` key exists in both `en.json` and `id.json`. `onResetSuccess` prop is called in `handleReset`. Pagination wrapped in conditional. Review found 1 Low-severity issue (`any[]` in test mock — TypeScript style guide §2) — fixed in commit `1ddb4ff`. Track archived to `conductor/archive/critical-ux-fixes_20260720/`.

---

### TRACK-009: Action Feedback & Loading States

- **Status:** `Pending`
- **Dependencies:** None
- **Estimated Effort:** 2 Days / 1 Sprint Loop
- **Audit IDs:** UX-1, UX-2, UX-3, UX-4, UX-5, UX-6, UX-7, UX-8, UX-9, UX-30, UX-31, UX-32
- **Decisions:**
  - **UX-5 (toast.success):** Create a `showSuccessToast(message: string)` helper in `toast.ts` for consistency with `showErrorToast`. Add `toast.success()` to ALL action `onSuccess` handlers: ConsultationForm (log), CreateUserDialog (create), EditUserSheet (update), DeleteUserDialog (delete), DeadlineManager (unlock + extend), VerificationDialog (verify + reject), use-assignment-tabs (approve + reject extension). Replace inline success text in ProfileSection and PasswordSection with toasts for consistency. Need ~12 new i18n keys (e.g., `consultations.logSuccess`, `adminUsers.createSuccess`, `instructorAssignments.deadlineManager.unlockSuccess`, `extensions.approveSuccess`, etc.) in both `en.json` and `id.json`.
  - **UX-1 (pendingComponent):** Create 3 reusable skeleton components: `DashboardSkeleton` (for all 3 dashboards — student/instructor/admin), `TableSkeleton` (for admin users list + audit log), `AssignmentDetailSkeleton` (for instructor assignment detail). Add `pendingComponent` to all 7 routes. The `admin/users/import.tsx` route fetches only session data (very fast) — a simple spinner is sufficient there.
  - **UX-2 (AssignmentDetailPage side data):** Add `loadingConsultations` / `loadingExtensions` state to the existing `useEffect` in `student/assignments/$id.tsx`. Show `Skeleton` components in the consultations and extensions tabs while loading.
  - **UX-3 (ConsultationForm spinner):** Add `<Loader2 className="mr-2 h-4 w-4 animate-spin" />` to the submit button when `loading` is true. Match the pattern in `ReviewForm.tsx` (lines 206-213).
  - **UX-4 (ProfileSection + VerificationDialog loading):** Replace plain "Loading..." text with `Loader2` spinner icon. Match `TwoFactorSettings.tsx` pattern (which uses `RefreshCw` spinner).
  - **UX-6 (StudentDashboard error):** Show `data.error` (the actual error message) instead of `t('common.error')`. Match `InstructorDashboard.tsx` pattern (lines 26-28 show `data.error.message`).
  - **UX-7 (AssignmentDetailPage swallowed errors):** Add try/catch to the `useEffect` that loads side data. Set `sideDataError` state. Show inline error banner with a retry button.
  - **UX-8 (ReviewDetailPage auto-openForReview):** Add try/catch to the `openForReview` call (line 46). Show `toast.error()` on failure. Prevent the `navigate({ replace: true })` self-navigation on failure — stay on the page with an error banner.
  - **UX-9 (CheckpointSubmissionPage upload error):** Distinguish network errors (`TypeError` — "Network error, check your connection") from server errors (parse the response — "Server error, try again"). Add 2 new i18n keys: `files.networkError` and `files.serverError`.
  - **UX-30/31/32 (action feedback):** Add `toast.success()` in `DeadlineManager` mutation `onSuccess` handlers, `VerificationDialog` verify/reject success paths, and `use-assignment-tabs` approve/reject success paths. These are subsumed by the UX-5 decision above.
  - **UX-33 (undo):** Skip. Just add success toasts. Undo is a feature, not a bug fix. Defer to a future feature track. Dropped from this track's scope.

#### Context Anchors (Traceability)

- **PRD Reference:** `docs/PRD.md` (all user actions: delete, approve, reject, unlock, submit, review)
- **TDD Reference:** `docs/TDD.md` (toast infrastructure, loading skeletons, error boundary patterns)

#### Track Tech Stack

- `sonner` (toast library — already wired up in `__root.tsx:174`)
- shadcn/ui `Skeleton` component (`@/components/ui/skeleton`)
- `Loader2` spinner icon (from `lucide-react`)
- TanStack Query `onSuccess` / `onError` handlers
- i18n codegen (`pnpm generate:i18n` for ~14 new keys)

#### Scope Boundaries

- **In Scope:**
  - **Toast infrastructure (UX-5):** Create `showSuccessToast(message: string)` helper in `toast.ts`. Add `toast.success(t('...'))` to all action `onSuccess` handlers: `ConsultationForm` (log), `CreateUserDialog` (create), `EditUserSheet` (update), `DeleteUserDialog` (delete), `DeadlineManager` (unlock + extend), `VerificationDialog` (verify + reject), `use-assignment-tabs` (approve + reject extension). Replace inline success text in `ProfileSection` and `PasswordSection` with toasts. Add ~12 new i18n keys to both `locales/en.json` and `locales/id.json`. Run `pnpm generate:i18n`.
  - **Loading skeletons (UX-1):** Create 3 reusable skeleton components: `DashboardSkeleton` (cards + grid layout for all 3 dashboards), `TableSkeleton` (header + rows for admin users list + audit log), `AssignmentDetailSkeleton` (for instructor assignment detail). Add `pendingComponent` to 7 routes: `student/dashboard.tsx`, `instructor/dashboard.tsx`, `admin/dashboard.tsx`, `admin/users/index.tsx`, `admin/audit-log.tsx`, `admin/users/import.tsx` (simple spinner), `instructor/assignments/$id.tsx`.
  - **Side data loading (UX-2):** Add `loadingConsultations` / `loadingExtensions` state to `useEffect` in `student/assignments/$id.tsx`. Show `Skeleton` in consultations and extensions tabs while loading.
  - **Error handling (UX-6, UX-7, UX-8, UX-9):** Fix `StudentDashboard` error to show `data.error` instead of `t('common.error')`. Add try/catch to `AssignmentDetailPage` side-data `useEffect` — set error state, show inline error banner with retry. Add try/catch to `ReviewDetailPage` auto-`openForReview` effect — show `toast.error()` on failure, prevent self-navigation loop. Differentiate upload errors in `CheckpointSubmissionPage` — network vs server, with 2 new i18n keys.
  - **Spinners (UX-3, UX-4):** Add `Loader2` spinner to `ConsultationForm` submit button, `ProfileSection` loading state, `VerificationDialog` loading state. Match `ReviewForm.tsx` pattern.
  - **Action feedback (UX-30, UX-31, UX-32):** Subsumed by the toast infrastructure decision above — `DeadlineManager`, `VerificationDialog`, and `use-assignment-tabs` all get `toast.success()` in their success handlers.
- **Out of Scope:**
  - Undo functionality for destructive actions (UX-33 — dropped, defer to future feature track)
  - Accessibility improvements for notification components (TRACK-010)
  - Form validation improvements (TRACK-011)
  - Empty state improvements (TRACK-013)
  - Search debounce (TRACK-011)

#### High-Level Execution Vectors

- **Phase 1 (Toast Infrastructure):** Define all success toast i18n keys in `locales/en.json` + `locales/id.json` (~12 keys for action success + 2 keys for upload errors). Run `pnpm generate:i18n`. Create `showSuccessToast` helper in `toast.ts`. Add `toast.success(t('...'))` to every `onSuccess` handler across: `ConsultationForm`, `CreateUserDialog`, `EditUserSheet`, `DeleteUserDialog`, `DeadlineManager` (unlock + extend), `VerificationDialog` (verify + reject), `use-assignment-tabs` (approve + reject). Replace inline success text in `ProfileSection` and `PasswordSection` with toasts. Write tests verifying toast is called on success.
- **Phase 2 (Loading Skeletons):** Create `DashboardSkeleton`, `TableSkeleton`, `AssignmentDetailSkeleton` components. Add `pendingComponent` to the 7 routes. Add loading state + `Skeleton` to `AssignmentDetailPage` side-data tabs. Add `Loader2` spinners to `ConsultationForm`, `ProfileSection`, `VerificationDialog`. Write tests verifying skeleton renders during load.
- **Phase 3 (Error Handling):** Fix `StudentDashboard` error display to show `data.error`. Add try/catch to `AssignmentDetailPage` side-data `useEffect` with error banner + retry. Add try/catch to `ReviewDetailPage` auto-`openForReview` with `toast.error()` + prevent self-navigation. Differentiate upload errors in `CheckpointSubmissionPage` (network vs server). Write tests verifying error states and retry functionality.

#### Verification & Definition of Done (DoD)

- [ ] **Manual Checkpoint:** Delete a user -> success toast appears. Unlock a checkpoint -> success toast appears. Verify a consultation -> success toast appears. Approve an extension -> success toast appears. Load admin dashboard -> skeleton shows during fetch, not blank screen. Load student assignment detail -> consultations tab shows skeleton while loading. Trigger a side-data fetch error -> inline error banner with retry appears. Trigger `openForReview` failure -> error toast appears, no navigation loop. Upload a file with network disconnected -> "Network error" message shown.
- [ ] **Automated Tests:** `pnpm test:unit` — tests for `showSuccessToast` calls in action handlers (ConsultationForm, CreateUserDialog, EditUserSheet, DeleteUserDialog, DeadlineManager, VerificationDialog, use-assignment-tabs), `pendingComponent` rendering on 7 routes, error state display in StudentDashboard, side-data error handling in AssignmentDetailPage, `openForReview` error handling in ReviewDetailPage, upload error differentiation. `pnpm check:i18n` — all ~14 new keys exist in both locales. `pnpm test:coverage` >= 80%.
- [ ] **Conductor Review:** No action completes silently (grep for `onSuccess` handlers without `toast.success`). All 7 routes with loaders have `pendingComponent`. `showSuccessToast` helper exists in `toast.ts`. `StudentDashboard` shows `data.error` not `t('common.error')`. `ReviewDetailPage` `openForReview` has try/catch. `CheckpointSubmissionPage` distinguishes network vs server errors. UX-33 (undo) is explicitly documented as deferred.

---

### TRACK-010: Accessibility (a11y) & i18n Compliance

- **Status:** `Complete` (archived to `conductor/archive/accessibility-i18n-compliance_20260720/`)
- **Dependencies:** None
- **Estimated Effort:** 3 Days / 1.5 Sprint Loops
- **Audit IDs:** UX-13, UX-14, UX-15, UX-16, UX-17, UX-18, UX-19, UX-20, UX-21, UX-22, UX-23, UX-24, UX-50
- **Decisions:**
  - **UX-15 (NotificationCenter refactor):** Replace the custom slide-over panel with the shadcn `Sheet` component (`sheet.tsx`), which uses `@base-ui/react/dialog` and handles Escape key, focus trapping, and backdrop click automatically. Restructure `NotificationCenter` to use `<Sheet open={isOpen} onOpenChange={onClose}><SheetContent side="right">...</SheetContent></Sheet>`. Remove the custom backdrop div and panel div. The Sheet's built-in close button and focus management replace the manual X button and missing focus trap.
  - **UX-14 (NotificationItem keyboard a11y):** Change `<div onClick={handleClick}>` to `<button type="button" onClick={handleClick}>`. A `<button>` is semantically correct, automatically focusable via Tab, and Enter/Space activate it natively. Add `text-left` and `w-full` to the className to maintain the current block-level layout. No `role`/`tabIndex`/`onKeyDown` needed — native button handles everything.
  - **UX-13 (AdminDashboard hardcoded English):** Add i18n key `adminDashboard.noRecentActivityDescription` to both locales (en: "No recent activity to display", id: "Tidak ada aktivitas terbaru untuk ditampilkan"). Replace the hardcoded `description="No recent activity to display"` with `description={t('adminDashboard.noRecentActivityDescription')}`.
  - **UX-17 (UserTable "Status" hardcoded):** Add i18n key `adminUsers.table.status` to both locales (en: "Status", id: "Status"). Replace `header: 'Status'` with `header: t('adminUsers.table.status')`.
  - **UX-18 (ExtensionHistoryList "days" hardcoded):** Add i18n key `extensions.daysCount` with `{count}` param to both locales (en: "{count} days", id: "{count} hari"). Replace `{item.extensionDays} days` with `t('extensions.daysCount', { count: String(item.extensionDays) })`.
  - **UX-19 (ExtensionHistoryList toLocaleDateString('en-US')):** Remove the local `formatDate` function (lines 44-51). Import `formatDate` from `@/lib/format-date`. Use `formatDate(item.createdAt, locale, 'short')`. Get `locale` from `useI18n()` (already available in the component but not currently used for dates).
  - **UX-20 (StudentDashboard + ConsultationList toLocaleDateString()):** Replace `new Date(date).toLocaleDateString()` calls with `formatDate(date, locale, 'short')` from `@/lib/format-date`. Get `locale` from `useI18n()` in both components.
  - **UX-16 (FileList download button):** Add `aria-label={t('files.download')}` to the download `<Button>`. The `title` attribute is a tooltip, not a reliable accessible name.
  - **UX-21 (ProgressTable + ConsultationProgress progress bars):** Add `role="progressbar"` `aria-valuenow={value}` `aria-valuemin={0}` `aria-valuemax={100}` `aria-label={t('instructorAssignments.table.progress')}` to the progress bar container divs in `ProgressTable.tsx:78`. Add `role="progressbar"` `aria-valuenow={totalVerified}` `aria-valuemin={0}` `aria-valuemax={totalRequired}` `aria-label={t('consultations.consultationProgress')}` to the summary progress bar in `ConsultationProgress.tsx:34`. Add similar ARIA to per-checkpoint bars.
  - **UX-22 (DeadlineManager no aria-expanded):** Add `aria-expanded={isExpanded}` and `aria-controls={`student-${student.id}-details`}` to the toggle `<button>` at line 206. Add `id={`student-${student.id}-details`}` to the expandable content div at line 228.
  - **UX-23 (NotificationBadge count no aria-label):** Make the button's `aria-label` dynamic: `aria-label={hasUnread ? t('notifications.unreadCount', { count: String(count) }) : t('notifications.viewNotifications')}`. Add new i18n key `notifications.unreadCount` with `{count}` param to both locales (en: "{count} unread notifications", id: "{count} notifikasi belum dibaca"). Remove `role="status"` from the count span (the button's dynamic aria-label now conveys the count).
  - **UX-24 (CheckpointTimeline decorative dots):** Add `aria-hidden="true"` to the decorative connector line div (line 21) and dot div (line 24) in `CheckpointTimeline.tsx`. These are purely visual — the `CheckpointCard` inside is the accessible content.

#### Context Anchors (Traceability)

- **PRD Reference:** `docs/PRD.md` (notification center, file management, user tables, progress displays)
- **TDD Reference:** `docs/TDD.md` (component patterns, shadcn/ui primitives, i18n implementation)
- **Guidelines:** `AGENTS.md` -> "Custom lint rule -- no hardcoded UI strings"

#### Track Tech Stack

- shadcn/ui `Sheet` component (`@/components/ui/sheet` -- replaces custom notification panel, uses `@base-ui/react/dialog`)
- ARIA attributes (`role="progressbar"`, `aria-label`, `aria-expanded`, `aria-controls`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-hidden`)
- `@/lib/format-date` (`formatDate(date, locale, 'short')` -- replaces `toLocaleDateString('en-US')` and `toLocaleDateString()`)
- `locales/en.json`, `locales/id.json` (4 new i18n keys)
- `lint-plugin.js` (custom `simak-i18n/no-hardcoded` rule)

#### Scope Boundaries

- **In Scope:**
  - **Notification a11y (HIGH):** Refactor `NotificationCenter` to use shadcn `Sheet` component (`<Sheet open={isOpen} onOpenChange={onClose}><SheetContent side="right">`) -- handles Escape, focus trap, backdrop automatically (UX-15). Convert `NotificationItem` from `<div onClick>` to `<button type="button" onClick>` with `text-left w-full` for layout (UX-14). Make `NotificationBadge` button `aria-label` dynamic to include unread count (UX-23). Add `aria-live="polite"` for notification count changes (UX-50 -- moved from TRACK-012 as it's a11y).
  - **i18n fixes:** Replace hardcoded `"No recent activity to display"` with `t('adminDashboard.noRecentActivityDescription')` (UX-13). Replace hardcoded `'Status'` column header with `t('adminUsers.table.status')` (UX-17). Replace hardcoded `"days"` with `t('extensions.daysCount', { count: String(item.extensionDays) })` (UX-18). Replace `toLocaleDateString('en-US')` in `ExtensionHistoryList` with `formatDate(date, locale, 'short')` from `@/lib/format-date` (UX-19). Replace `toLocaleDateString()` in `StudentDashboard` and `ConsultationList` with `formatDate(date, locale, 'short')` (UX-20). 4 new i18n keys total.
  - **Icon button a11y:** Add `aria-label={t('files.download')}` to `FileList` download button (UX-16).
  - **Progress bar a11y:** Add `role="progressbar"`, `aria-valuenow`, `aria-valuemin={0}`, `aria-valuemax={100}`, `aria-label` to progress bars in `ProgressTable` (UX-21) and `ConsultationProgress` (UX-21).
  - **Collapsible a11y:** Add `aria-expanded={isExpanded}` and `aria-controls={`student-${student.id}-details`}` to `DeadlineManager` student header button. Add matching `id` to the expandable content div (UX-22).
  - **Decorative element a11y:** Add `aria-hidden="true"` to `CheckpointTimeline` decorative connector line and dot divs (UX-24).
- **Out of Scope:**
  - Notification navigation links (TRACK-012)
  - Search input debounce (TRACK-011)
  - Mobile layout changes (TRACK-013)
  - Form validation a11y (TRACK-011)

#### High-Level Execution Vectors

- **Phase 1 (Notification Refactor):** Refactor `NotificationCenter` to use `<Sheet>`/`<SheetContent side="right">` -- remove custom backdrop div and panel div, move header/content into `SheetHeader`/`SheetContent`. Convert `NotificationItem` from `<div onClick>` to `<button type="button" onClick>` with `text-left w-full`. Make `NotificationBadge` `aria-label` dynamic with unread count. Add `aria-live="polite"` to the badge container. Add 2 new i18n keys (`notifications.unreadCount`, `adminDashboard.noRecentActivityDescription`). Run `pnpm generate:i18n`. Write tests verifying keyboard navigation (Tab to bell, Enter to open, Tab through items, Enter to mark as read, Escape to close).
- **Phase 2 (i18n Fixes):** Add remaining 2 i18n keys (`adminUsers.table.status`, `extensions.daysCount`) to both locale files. Run `pnpm generate:i18n`. Replace hardcoded strings in `AdminDashboard`, `UserTable`, `ExtensionHistoryList`. Replace `toLocaleDateString('en-US')` and `toLocaleDateString()` with `formatDate(date, locale, 'short')` in `ExtensionHistoryList`, `StudentDashboard`, `ConsultationList`. Run `pnpm check:i18n` and `pnpm lint` to verify no hardcoded strings remain.
- **Phase 3 (ARIA Attributes):** Add `aria-label` to `FileList` download button. Add `role="progressbar"` + ARIA value attributes to `ProgressTable` and `ConsultationProgress` progress bars. Add `aria-expanded` + `aria-controls` to `DeadlineManager` toggle button. Add `aria-hidden="true"` to `CheckpointTimeline` decorative elements. Write tests verifying ARIA attributes are present and correct.

#### Verification & Definition of Done (DoD)

- [x] **Manual Checkpoint:** Navigate notification center using only keyboard -- Tab to bell, Enter to open, Tab through items, Enter to mark as read, Escape to close (Sheet handles this). Screen reader announces notification count changes via dynamic `aria-label`. Switch to Indonesian locale -- all strings (including "Status", "days", dates) are translated. Progress bars announce progress via screen reader. Collapsible sections announce expanded/collapsed state.
- [x] **Automated Tests:** `pnpm test:unit` -- 270 test files, 2,608 tests, all pass. New tests verify keyboard interaction in NotificationCenter (Escape closes via Sheet onOpenChange, Tab trapping delegated to Sheet), `NotificationItem` is a `<button type="button">` (focusable, Enter/Space activates onClick), ARIA presence on progress bars/collapsible/icon buttons, dynamic `aria-label` + `aria-live="polite"` on NotificationBadge, i18n key usage (no hardcoded strings). `pnpm check:i18n` -- parity verified for 4 new keys (717 = 717). `pnpm lint` -- 0 warnings, 0 errors (no `simak-i18n/no-hardcoded` warnings). `pnpm test:coverage` >= 80% on all thresholds.
- [x] **Conductor Review:** No hardcoded English UI strings (grep verified). All interactive elements are keyboard accessible. `NotificationCenter` uses `Sheet` component (no custom backdrop div). `NotificationItem` is a `<button>`. Progress bars have `role="progressbar"`. `DeadlineManager` toggle has `aria-expanded`. `CheckpointTimeline` decorative elements have `aria-hidden`. WCAG 2.1.1 (Keyboard) compliant. Review passed with no Critical/High/Medium issues; one Low informational observation about `aria-live` on the NotificationBadge button (spec-compliant, no change required). Track archived to `conductor/archive/accessibility-i18n-compliance_20260720/`.

---

### TRACK-011: Search Debounce & Form Validation

- **Status:** `Pending`
- **Dependencies:** None
- **Estimated Effort:** 3 Days / 1.5 Sprint Loops
- **Audit IDs:** UX-25, UX-26, UX-27, UX-28, UX-54, UX-56
- **Decisions:**
  - **UX-54 (debounce):** Create a custom `useDebouncedCallback` hook in `src/hooks/use-debounced-callback.ts` (~15 lines, `setTimeout`/`clearTimeout` pattern). No new dependency. Apply with 300ms delay to the **4 server-side search inputs** only: `StudentAssignmentFilters`, `UserFilters`, `AssignmentFilters`, `audit-log.tsx`. `StudentPicker` and `TemplatePicker` filter **client-side** in-memory data — no debounce needed (they call `setSearch()` which filters an already-loaded array, no server fetch).
  - **UX-25/26/27 (form migration):** Full migration of all 3 forms to `react-hook-form` + Zod, matching the `EditUserSheet` pattern: `useForm` + `zodResolver(Schema)` + `FormField` + `FormItem` + `FormLabel` + `FormControl` + `FormMessage`. Reuse existing server-side Zod schemas where possible (e.g., `LogConsultationSchema`, `RequestExtensionSchema`). Add `onBlur` validation and per-field inline errors. For `PasswordSection`, create a local Zod schema (password min 8, match confirmation) since Better Auth handles the actual password change.
  - **UX-28 (upload progress):** Replace `fetch()` with `XMLHttpRequest` in `CheckpointSubmissionPage` (the parent component that performs the PUT to R2). Add `xhr.upload.onprogress` handler to track bytes uploaded. Pass `uploadProgress: number` (0-100) as a new prop to `FileUploader`. Display a determinate progress bar in `FileUploader` when `isUploading` is true. Keep the existing spinner as fallback for browsers that don't support progress events.
  - **UX-56 (clear filters):** Add a conditional X icon button inside the search input wrapper (positioned right, `absolute right-2.5 top-2.5`). Show only when `search` is non-empty. Clicking clears the search and triggers `onSearchChange('')` (which is already debounced). Apply to all 4 server-side search inputs.

#### Context Anchors (Traceability)

- **PRD Reference:** `docs/PRD.md` (assignment/user/audit-log search, consultation logging, extension requests, password change, file upload)
- **TDD Reference:** `docs/TDD.md` (form patterns, react-hook-form usage, search/filter architecture)

#### Track Tech Stack

- Custom `useDebouncedCallback` hook (`src/hooks/use-debounced-callback.ts`, ~15 lines)
- `react-hook-form` + `@hookform/resolvers/zod` (form validation, already in dependencies)
- shadcn/ui `Form` components (`FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage` — already used in `EditUserSheet`)
- `XMLHttpRequest` with `upload.onprogress` (replaces `fetch()` for upload progress tracking)
- TanStack Router `navigate` (debounced search)

#### Scope Boundaries

- **In Scope:**
  - **Debounce (UX-54):** Create `src/hooks/use-debounced-callback.ts` with a generic `useDebouncedCallback<T>(callback: T, delay: number)` pattern. Wrap the `onSearchChange` / `handleSearchChange` handlers in `StudentAssignmentFilters`, `UserFilters`, `AssignmentFilters`, and `audit-log.tsx` with `useDebouncedCallback(fn, 300)`. StudentPicker and TemplatePicker are NOT modified (client-side filtering, no server fetch).
  - **Clear filters (UX-56):** Add a conditional X icon button (`lucide-react` `X` icon) inside the search input wrapper for all 4 server-side search inputs. Positioned `absolute right-2.5 top-2.5`. Visible only when `search !== ''`. Clicking calls `onSearchChange('')` (or the debounced equivalent).
  - **ConsultationForm migration (UX-25):** Replace raw `useState` with `useForm` + `zodResolver`. Fields: `checkpointId` (required), `sessionType` (default 'internal'), `externalConsultantName` (required when sessionType is 'external'), `notes` (required, min length). Add `FormField` + `FormMessage` for each field. Add `onBlur` validation. Keep the existing `logConsultation` server function call.
  - **ExtensionRequestForm migration (UX-26):** Replace raw `useState` with `useForm` + `zodResolver`. Fields: `category` (required), `reason` (required, min 10 chars), `duration` (required, min 1, max `maxExtensionDays`), `checkpointId` (optional). Add `FormField` + `FormMessage` for each field. Add `onBlur` validation. Keep the existing `requestExtension` server function call.
  - **PasswordSection migration (UX-27):** Replace raw `useState` with `useForm` + `zodResolver`. Fields: `currentPassword` (required), `newPassword` (required, min 8), `confirmPassword` (required, must match `newPassword`). Add `FormField` + `FormMessage` for each field. Add `onBlur` validation. Keep the existing `authClient.changePassword` call.
  - **Upload progress (UX-28):** In `CheckpointSubmissionPage` (`$id.checkpoints.$checkpointId.tsx`), replace the `fetch(uploadUrl, { method: 'PUT', body: file })` call with `XMLHttpRequest`. Add `xhr.upload.onprogress` handler computing `Math.round((loaded / total) * 100)`. Store progress in state. Pass `uploadProgress` prop to `FileUploader`. In `FileUploader`, add a `Progress` bar component (from `@/components/ui/progress`) when `isUploading` is true and `uploadProgress` is available. Keep the `Loader2` spinner as fallback.
- **Out of Scope:**
  - `ReviewForm` comment validation (low priority, server validates)
  - Search result quality/relevance tuning
  - Form auto-save functionality
  - Debouncing StudentPicker/TemplatePicker (client-side filtering, no server fetch)

#### High-Level Execution Vectors

- **Phase 1 (Debounce & Clear):** Create `src/hooks/use-debounced-callback.ts`. Wrap `onSearchChange`/`handleSearchChange` in all 4 server-side search inputs with `useDebouncedCallback(fn, 300)`. Add conditional X clear button to all 4 search inputs. Write tests verifying: only 1 navigate call after rapid typing, X button clears search.
- **Phase 2 (Form Migration):** Migrate `ConsultationForm`, `ExtensionRequestForm`, and `PasswordSection` to `react-hook-form` + Zod. Create or reuse Zod schemas. Add `FormField` + `FormItem` + `FormLabel` + `FormControl` + `FormMessage` for each field. Add `onBlur` validation. Write tests for: invalid input rejection (empty required fields, short reason, mismatched passwords), valid submission, field-level error messages.
- **Phase 3 (Upload Progress):** Replace `fetch()` with `XMLHttpRequest` in `CheckpointSubmissionPage`. Add `xhr.upload.onprogress` handler. Pass `uploadProgress` prop to `FileUploader`. Add `Progress` bar component. Write tests for: progress tracking, progress bar rendering, fallback spinner when progress unavailable.

#### Verification & Definition of Done (DoD)

- [ ] **Manual Checkpoint:** Type "algorithm" in any of the 4 server-side search fields — only 1 server request fires (after 300ms debounce), not 9. Click the X button — search clears immediately. Fill `ConsultationForm` with empty notes — inline error appears on blur. Fill `ExtensionRequestForm` with a 5-char reason — "min 10 characters" error appears on blur. Fill `PasswordSection` with mismatched passwords — "passwords do not match" error appears on blur. Upload a 10MB file — progress bar shows percentage from 0 to 100.
- [ ] **Automated Tests:** `pnpm test:unit` — tests for: debounced search (1 navigate call after rapid typing), X button clearing, ConsultationForm validation (empty fields, valid submission), ExtensionRequestForm validation (short reason, invalid duration), PasswordSection validation (mismatched passwords, short password), XMLHttpRequest upload progress tracking, progress bar rendering. `pnpm test:coverage` >= 80%.
- [ ] **Conductor Review:** No server-side search input fires `navigate()` on every keystroke (grep for `onChange.*onSearchChange` without debounce). All 3 forms use `react-hook-form` + `zodResolver` (grep for `useForm` in ConsultationForm, ExtensionRequestForm, PasswordSection). Upload uses `XMLHttpRequest` (grep for `XMLHttpRequest` in CheckpointSubmissionPage). Custom hook exists at `src/hooks/use-debounced-callback.ts`. No `use-debounce` dependency added to `package.json`.

---

### TRACK-012: Notifications & File Management UX

- **Status:** `Pending`
- **Dependencies:** TRACK-010 (NotificationCenter refactor to `Sheet` should be done first)
- **Estimated Effort:** 2 Days / 1 Sprint Loop
- **Audit IDs:** UX-41, UX-42, UX-46, UX-48, UX-49, UX-51, UX-53, PERF-27, PERF-29, PERF-30, PERF-31
- **Decisions:**
  - **UX-42/46 (notification navigation):** Metadata-based links. Store `assignmentId`/`checkpointId`/`submissionId` in the `metadata` jsonb field when creating notifications (server-side). The `metadata` column already exists in the `notifications` table — no schema migration needed. Update ~6-8 notification creation points (`reviews.server.ts`, `submissions.server.ts`, `consultations.server.ts`, `extensions.server.ts`/`extensions-extras.server.ts`, `review-sla.ts`). Derive the route client-side from `type` + `metadata` via a type-to-route map (e.g., `review_completed` -> `/student/assignments/{assignmentId}/checkpoints/{checkpointId}`, `submission_received` -> `/instructor/reviews/{submissionId}`). Convert `NotificationItem` from a `<button>` (after TRACK-010) to a `<Link>` wrapping the content, with `markAsRead` called on click. If `metadata` is missing or route can't be derived, fall back to mark-as-read only (no navigation).
  - **UX-51 (docx preview):** Explicit message. Show a "Preview not available — download to view" card for non-PDF files in `ReviewFilePreview`. No new dependency. The current behavior (download link only) is preserved but with an explicit explanation card so the instructor knows why there's no inline preview.
  - **UX-41 (next review):** Implement. On the review success screen (`ReviewDetailPage`), add a "Next Review" button alongside the existing "Back to Queue" link. The button calls `listPendingReviews` (with `page: 1, limit: 1`) to get the next pending submission ID and navigates to `/instructor/reviews/{submissionId}`. If no more pending reviews exist (empty response), hide the "Next Review" button and show "Back to Queue" only. This reduces clicks for instructors with many reviews.
  - **UX-48/49 (filter + pagination):** Add "All"/"Unread" tab toggle in the `NotificationCenter` Sheet header (after TRACK-010 refactor). The `useNotificationsList` hook already accepts a `type` param — add an `unreadOnly` option. Add a "Load More" button at the bottom of the notification list that increments the page param (the hook already supports pagination). Remove the hardcoded `limit: 50` — use `limit: 20` with "Load More" for incremental loading.
  - **UX-53 (latest version):** Add a "Latest" badge to the `FileList` row with the highest `version` number. Compute `maxVersion = Math.max(...submissions.map(s => s.version))` and show a small badge next to the version number for that row.
  - **UX-47 (notification preferences):** Dropped. This is a feature, not a UX fix. Low impact. Defer to a future feature track.
  - **UX-52 (bulk download):** Dropped. This is a feature, not a UX fix. Low impact. Defer to a future feature track.
  - **PERF-29 (staleTime):** Add `staleTime: 30_000` (30s) to `useNotificationsList`. Prevents refetch on every window focus/mount when data is fresh.
  - **PERF-30 (polling):** Change `refetchInterval` from 15s to 30s. Add `refetchIntervalInBackground: false` so polling stops when the tab is not visible. Reduces server load by ~75% while maintaining reasonable notification latency.
  - **PERF-31 (memoization):** Wrap `NotificationItem` in `React.memo`. Use `useCallback` for `handleClick`. Memoize `NotificationCenter` unread count computation and `groupedNotifications` with `useMemo` (PERF-27 — eliminates the 4 redundant `items.filter()` calls on every render and the double unread count computation).

#### Context Anchors (Traceability)

- **PRD Reference:** `docs/PRD.md` (notification system, file preview, review workflow)
- **TDD Reference:** `docs/TDD.md` (notification data model, TanStack Query hooks, file storage)

#### Track Tech Stack

- TanStack Query (`staleTime: 30_000`, `refetchInterval: 30000`, `refetchIntervalInBackground: false`, `React.memo`, `useMemo`, `useCallback`)
- Notification `metadata` jsonb field (stores `assignmentId`/`checkpointId`/`submissionId` for navigation)
- TanStack Router `<Link>` (notification items become navigable links)
- shadcn/ui `Tabs` (read/unread filter in NotificationCenter)
- 2 new i18n keys: `files.previewNotAvailable` (en: "Preview not available — download to view", id: "Pratinjau tidak tersedia — unduh untuk melihat"), `instructorReviews.nextReview` (en: "Next Review", id: "Ulasan Berikutnya")

#### Scope Boundaries

- **In Scope:**
  - **Notification navigation (UX-42, UX-46):** Add `metadata: { assignmentId, checkpointId, submissionId }` to notification INSERT statements in ~6-8 server handler notification creation points. Create a client-side `NOTIFICATION_ROUTES` map: `{ review_completed: { route: '/student/assignments/$assignmentId/checkpoints/$checkpointId', params: ['assignmentId', 'checkpointId'] }, ... }`. Convert `NotificationItem` to render a `<Link>` (after TRACK-010 makes it a `<button>` — wrap the button content in a `<Link>` or use `onClick` with `navigate`). Call `markAsRead` on click before navigating. Fall back to mark-as-read only if `metadata` is missing.
  - **Next Review button (UX-41):** On the `ReviewDetailPage` success screen (line 72-85 of `$submissionId.tsx`), add a "Next Review" button. On click, call `listPendingReviews({ data: { page: 1, limit: 1 } })`. If response has items, navigate to `/instructor/reviews/{items[0].submissionId}`. If empty, hide the button. Add i18n key `instructorReviews.nextReview`.
  - **Read/unread filter (UX-48):** Add `Tabs` component with "All" and "Unread" tabs in the `NotificationCenter` Sheet header. Pass `unreadOnly: boolean` to `useNotificationsList`. The server handler adds a `.where(eq(notifications.read, false))` when `unreadOnly` is true.
  - **Load More (UX-49):** Replace fixed `limit: 50` with `limit: 20` + a "Load More" button. Track `currentPage` in state. On click, increment page and append new items. Hide button when `items.length >= total`.
  - **DOCX preview message (UX-51):** In `ReviewFilePreview`, add a conditional card for non-PDF files: show a `FileText` icon + `t('files.previewNotAvailable')` message + the existing download button. Add i18n key `files.previewNotAvailable`.
  - **Latest version badge (UX-53):** In `FileList`, compute `maxVersion` from `submissions`. Show a small "Latest" badge (`Badge` component, `variant: "secondary"`) next to the version number for the row where `version === maxVersion`.
  - **Client-side perf (PERF-27, PERF-29, PERF-30, PERF-31):** Add `staleTime: 30_000` to `useNotificationsList`. Change `useUnreadCount` `refetchInterval` from `15000` to `30000` and add `refetchIntervalInBackground: false`. Wrap `NotificationItem` in `React.memo`. Use `useCallback` for `handleClick` in `NotificationItem`. Use `useMemo` for unread count + `groupedNotifications` in `NotificationCenter` (eliminates 4 redundant `items.filter()` calls + double unread count computation on every render).
- **Out of Scope:**
  - Notification preferences in settings (UX-47 — dropped, feature not a fix)
  - Bulk download / ZIP (UX-52 — dropped, feature not a fix)
  - NotificationCenter a11y refactor (TRACK-010)
  - Search debounce (TRACK-011)
  - Email delivery improvements (TRACK-004)

#### High-Level Execution Vectors

- **Phase 1 (Notification Navigation):** Update ~6-8 notification creation points to include `metadata: { assignmentId, checkpointId, submissionId }` in the INSERT. Create client-side `NOTIFICATION_ROUTES` map. Convert `NotificationItem` to use `<Link>` or `navigate()` based on type + metadata. Add "Next Review" button to `ReviewDetailPage` success screen. Add 2 i18n keys (`files.previewNotAvailable`, `instructorReviews.nextReview`). Run `pnpm generate:i18n`. Write tests for navigation routing and next-review button.
- **Phase 2 (Notification UX):** Add "All"/"Unread" `Tabs` to `NotificationCenter`. Update `useNotificationsList` to accept `unreadOnly`. Add "Load More" button with incremental page loading. Change `limit` from 50 to 20. Write tests for filter behavior and load-more pagination.
- **Phase 3 (File UX & Client Perf):** Add "Preview not available" card for non-PDF files in `ReviewFilePreview`. Add "Latest" badge to `FileList`. Add `staleTime: 30_000` to `useNotificationsList`. Change `refetchInterval` to 30s + `refetchIntervalInBackground: false`. Wrap `NotificationItem` in `React.memo` + `useCallback`. Memoize `NotificationCenter` unread count + `groupedNotifications` with `useMemo`. Write tests for memoization, staleTime behavior, and badge rendering.

#### Verification & Definition of Done (DoD)

- [ ] **Manual Checkpoint:** Click a `review_completed` notification — navigates to the student assignment checkpoint page. Click `submission_received` notification — navigates to instructor review page. Click "Next Review" on review success screen — goes to the next pending submission. If no more pending reviews, "Next Review" button is hidden. Switch to "Unread" tab — only unread notifications show. Click "Load More" — next 20 notifications appear. Upload a `.docx` file — "Preview not available" card shows with download button. View `FileList` — highest version row shows "Latest" badge. Check network tab — `useUnreadCount` polls every 30s, not 15s, and stops when tab is hidden. Re-focus the tab — list does not refetch if < 30s old (staleTime).
- [ ] **Automated Tests:** `pnpm test:unit` — tests for: notification navigation routing (type + metadata -> correct route), next-review button (navigates when pending reviews exist, hidden when none), unread filter tab, load-more pagination, non-PDF preview message, "Latest" badge on highest version, `staleTime` behavior, `refetchInterval` value, `React.memo` wrapping, `useMemo` for grouped notifications. `pnpm check:i18n` — 2 new keys in both locales. `pnpm test:coverage` >= 80%.
- [ ] **Conductor Review:** Notification creation points include `metadata` with navigation IDs (grep for `metadata:` in notification INSERT statements). `NotificationItem` renders a `<Link>` or uses `navigate()`. `ReviewDetailPage` success screen has "Next Review" button. `NotificationCenter` has "All"/"Unread" tabs + "Load More" button. `useNotificationsList` has `staleTime: 30_000`. `useUnreadCount` has `refetchInterval: 30000` + `refetchIntervalInBackground: false`. `NotificationItem` is wrapped in `React.memo`. `NotificationCenter` uses `useMemo` for unread count + grouped notifications. UX-47 and UX-52 are explicitly documented as dropped.

---

### TRACK-013: Empty States, Date Display & Mobile Polish

- **Status:** `Pending`
- **Dependencies:** Coordinate with TRACK-010 (i18n date fixes — both touch `formatDate` usage and locale-aware formatting)
- **Estimated Effort:** 2 Days / 1 Sprint Loop
- **Audit IDs:** UX-10, UX-11, UX-12, UX-34, UX-35, UX-36, UX-43, UX-45
- **Decisions:**
  - **UX-36/37 (mobile tables):** ProgressTable only — add card-based layout for ProgressTable on mobile (each student becomes a card with progress info). Other tables (UserTable, FileList, ExtensionHistoryList, audit-log) keep horizontal scroll — acceptable for admin/instructor-only usage. UX-37 (bulk import preview tables) left as-is.
  - **UX-43 (relative dates):** Key places only — add `formatDistanceToNow` from `date-fns` (locale-aware via `localeMap`) to CheckpointCard due dates, StudentDashboard upcoming deadlines, and SLABadge. Not everywhere — consultation log dates and review history dates don't benefit from relative context. Uses `formatDistanceToNow(date, { addSuffix: true, locale: localeMap[locale] })` — returns "in 3 days" (en) or "dalam 3 hari" (id). No custom i18n keys needed for the relative text itself.
  - **UX-44 (timezone):** Dropped — all users are in Indonesia (WIB/UTC+7). Timezone ambiguity is minimal for a single-timezone user base. Defer until multi-timezone support is needed.
  - **UX-10 (ConsultationList empty state):** Replace plain text `<div>` with `<EmptyState>` component using `MessageSquare` icon. Use existing `consultations.noConsultations` as title.
  - **UX-11 (ReviewHistory returns null):** Render the Card with an `<EmptyState>` inside instead of returning `null`. Add i18n key `instructorReviews.noReviewsYet` (en: "No previous reviews", id: "Belum ada ulasan sebelumnya").
  - **UX-12 (ConsultationProgress returns null):** Show the Card with a message instead of returning `null`. Add i18n key `consultations.noConsultationsRequired` (en: "No consultations required for this assignment", id: "Tidak ada konsultasi yang diperlukan untuk tugas ini").
  - **UX-34 (CheckpointListEditor mobile):** Stack fields vertically on mobile (`flex-col sm:flex-row`). Each checkpoint row becomes a stacked layout on small screens — reorder buttons, name input, min consultations, duration, and remove button flow vertically.
  - **UX-35 (AssignmentWizard step labels):** Show the current step name on mobile above the form content (replacing the hidden `hidden md:block` labels). Keep step numbers visible. The current step name is available from the `steps` array.
  - **UX-45 (SLABadge time remaining):** Add `title` attribute with relative time using `formatDistanceToNow` (e.g., "2 days overdue" or "1 day left"). Badge text (On Time / Approaching / Breached) remains unchanged. Tooltip provides time context without cluttering the badge.

#### Context Anchors (Traceability)

- **PRD Reference:** `docs/PRD.md` (dashboard displays, deadline management, template editing, mobile support)
- **TDD Reference:** `docs/TDD.md` (component patterns, responsive design, date formatting utilities)

#### Track Tech Stack

- shadcn/ui `EmptyState` component (icon + title + description + CTA)
- `date-fns` `formatDistanceToNow` (locale-aware via `localeMap` in `format.ts`)
- Tailwind v4 responsive utilities (`flex-col`, `sm:flex-row`, responsive card layouts)
- shadcn/ui `Card` (ProgressTable mobile card layout)

#### Scope Boundaries

- **In Scope:**
  - **Empty states (UX-10, UX-11, UX-12):** Replace plain text in `ConsultationList` (line 35-41) with `<EmptyState icon={MessageSquare} title={t('consultations.noConsultations')} />`. Render `ReviewHistory` Card with `<EmptyState>` inside instead of `return null` (line 22). Render `ConsultationProgress` Card with "No consultations required" message instead of `return null` (line 21-23). Add 2 i18n keys (`instructorReviews.noReviewsYet`, `consultations.noConsultationsRequired`).
  - **Relative dates (UX-43):** Add `formatDistanceToNow` display alongside absolute dates in: `CheckpointCard` due date (line 113 — append "(in 3 days)" after the formatted date), `StudentDashboard` upcoming deadlines (line 155 — append relative time). Uses `formatDistanceToNow(date, { addSuffix: true, locale: localeMap[locale] })`.
  - **SLABadge time remaining (UX-45):** Add `title` attribute to each SLA Badge variant with `formatDistanceToNow(updatedAt, { addSuffix: true, locale })`. E.g., "Breached" badge gets `title="3 days ago"`. No new i18n keys — date-fns handles locale.
  - **CheckpointListEditor mobile (UX-34):** Change the checkpoint row from `flex items-start gap-2` to `flex flex-col sm:flex-row sm:items-start gap-2`. Column headers hidden on mobile (`hidden sm:flex`). Reorder buttons and remove button reflow naturally in vertical layout.
  - **AssignmentWizard step labels (UX-35):** Add a `<p className="sm:hidden ...">{steps[currentStep].label}</p>` above the form content to show the current step name on mobile. Desktop keeps the existing `hidden md:block` labels.
  - **ProgressTable mobile (UX-36):** Add a card-based layout for mobile (`flex sm:hidden` / `hidden sm:block` pattern). Each student becomes a card showing name, progress bar, and percentage. Desktop keeps the table layout.
- **Out of Scope:**
  - Timezone display (UX-44 — dropped, defer until multi-timezone support needed)
  - Bulk import preview table responsive (UX-37 — left as-is, horizontal scroll acceptable)
  - Other table mobile layouts (UserTable, FileList, ExtensionHistoryList — horizontal scroll acceptable)
  - i18n date fixes (TRACK-010 — coordinate to avoid conflicts)
  - Notification empty states (TRACK-012)

#### High-Level Execution Vectors

- **Phase 1 (Empty States):** Update `ConsultationList` to use `<EmptyState>`. Update `ReviewHistory` to render Card with `<EmptyState>` instead of `null`. Update `ConsultationProgress` to render Card with message instead of `null`. Add 2 i18n keys. Run `pnpm generate:i18n`. Write tests verifying empty states render (not `null`).
- **Phase 2 (Relative Dates & SLABadge):** Import `formatDistanceToNow` from `date-fns`. Add relative date display to `CheckpointCard` (append to absolute date) and `StudentDashboard` upcoming deadlines. Add `title` attribute to `SLABadge` with relative time. Write tests for relative date computation.
- **Phase 3 (Mobile Layout):** Refactor `CheckpointListEditor` to `flex-col sm:flex-row` responsive layout. Add mobile step label to `AssignmentWizard`. Add card-based mobile layout for `ProgressTable`. Test on 375px viewport. Write tests for responsive class presence.

#### Verification & Definition of Done (DoD)

- [ ] **Manual Checkpoint:** View an assignment with no consultations — `ConsultationList` shows `<EmptyState>` with icon, not plain text. View `ReviewHistory` with no reviews — Card renders with "No previous reviews" message, not blank. View `ConsultationProgress` with `totalRequired === 0` — Card renders with "No consultations required" message, not blank. View a deadline — shows "Mar 5, 2026 (in 3 days)" or "Mar 5, 2026 (3 days ago)". Hover over a SLA Badge — tooltip shows relative time. Edit a template on 375px viewport — checkpoint fields stack vertically and are usable. View `ProgressTable` on mobile — students appear as cards, not a cramped table. View `AssignmentWizard` on mobile — current step name is visible above the form.
- [ ] **Automated Tests:** `pnpm test:unit` — tests for: empty state rendering (3 components, verify not `null`), relative date computation (future date shows "in X days", past date shows "X days ago"), SLABadge `title` attribute presence, responsive class presence in CheckpointListEditor, ProgressTable mobile card layout, AssignmentWizard mobile label. `pnpm check:i18n` — 2 new keys in both locales. `pnpm test:coverage` >= 80%.
- [ ] **Conductor Review:** No component returns `null` for empty state (grep for `return null` in component files — verify none are empty-state returns). `formatDistanceToNow` is used in CheckpointCard and StudentDashboard. `SLABadge` has `title` attribute. `CheckpointListEditor` uses `flex-col sm:flex-row`. `ProgressTable` has mobile card layout. `AssignmentWizard` shows step name on mobile. UX-44 is explicitly documented as dropped. UX-37 is explicitly documented as left as-is.

---

## Track Dependency Graph

```
Milestone 1: Critical Fixes
├── TRACK-001: Concurrency & Transaction Safety [no deps]
├── TRACK-002: Deadline & SLA Logic Correctness [coordinate with 001]
├── TRACK-003: Input Validation & Data Integrity [no deps]
└── TRACK-004: Email Queue Robustness [no deps]

Milestone 2: Performance & Optimization
├── TRACK-005: Database Indexes & Schema Optimization [no deps]
├── TRACK-006: Query & Data-Fetching Optimization [depends on 005]
└── TRACK-007: Session Caching & Bundle Safety [no deps]

Milestone 3: UX & Accessibility
├── TRACK-008: Critical UX Fixes (Broken Functionality) [no deps]
├── TRACK-009: Action Feedback & Loading States [no deps]
├── TRACK-010: Accessibility & i18n Compliance [no deps]
├── TRACK-011: Search Debounce & Form Validation [no deps]
├── TRACK-012: Notifications & File Management UX [depends on 010]
└── TRACK-013: Empty States, Date Display & Mobile [coordinate with 010]
```

### Parallelization Strategy

The following track groups can be worked on simultaneously:

| Group | Tracks | Rationale |
|-------|--------|-----------|
| **A** | TRACK-001, TRACK-003, TRACK-004, TRACK-007, TRACK-008 | Fully independent — no file overlap |
| **B** | TRACK-002 + TRACK-001 | Both touch extension handlers — coordinate to avoid merge conflicts |
| **C** | TRACK-005 → TRACK-006 | Sequential — indexes must precede query optimization |
| **D** | TRACK-009, TRACK-010, TRACK-011 | Independent UX tracks — minimal file overlap |
| **E** | TRACK-012 + TRACK-010 | NotificationCenter refactor in 010 precedes notification UX in 012 |
| **F** | TRACK-013 + TRACK-010 | Both touch date formatting — coordinate i18n date changes |

---

## Effort Summary

| Milestone | Tracks | Estimated Effort |
|-----------|:---:|:---:|
| 1: Critical Fixes | 4 | ~12 Days |
| 2: Performance & Optimization | 3 | ~7 Days |
| 3: UX & Accessibility | 6 | ~13 Days |
| **Total** | **13** | **~32 Days** |

> Effort estimates assume a single developer. Tracks within the same parallelization group can be distributed across developers to reduce wall-clock time.
