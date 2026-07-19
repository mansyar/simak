<protect>
# Track: Email Queue Robustness

## Overview

Harden the existing email queue subsystem (`email_queue` table + in-process background processor) so that no email is permanently lost, admins can inspect and recover failed emails, the background processor cannot silently die, and configuration follows the project's validated-env conventions.

**Track type:** Chore (hardening) with a feature addition (admin queue inspector + retry page).
**Branch:** `track-004/email-queue-robustness`

## Background & Current State

The email queue was introduced in Track 4.1 (May 2026) and further hardened in `email-pipeline-hardening`. Current implementation:

- **Schema** (`src/db/schema/email-queue.ts`): `email_queue` (id, recipient_email, subject, body_html, template_type, status ∈ {pending, processing, sent, failed}, attempts, last_attempt_at, error_message, created_at); index on (status, created_at).
- **Enqueue** (`src/lib/email.ts`): `enqueueEmail()` + `sendPasswordResetEmail`, `sendInvitationEmail`, `sendSLAAlertEmail`, and 2FA email via `two-factor.server.ts`.
- **Processor** (`src/lib/email-queue-processor.ts`): `processEmailQueue()` claims up to 10 due rows via `SELECT ... FOR UPDATE SKIP LOCKED`, reclaims stale `processing` (>5 min), sends via Resend, applies exponential backoff [0, 30s, 5min, 30min], marks `failed` after 3 attempts.
- **Wiring** (`src/lib/email-queue-init.ts`): in-process `setInterval` (30s) auto-started via `import.meta.env.SSR`; `tick()` wraps the processor in try/catch/finally with an `isRunning` overlap guard and supports graceful `clearInterval` shutdown.
- **Admin**: dashboard widget shows Pending/Sent/Failed counts only.

## Problem Statement / Gaps

1. **Terminal failures are unrecoverable.** After 3 failed attempts an email is `failed` forever. A failed password-reset or invitation email means a user cannot access the system, with no in-product recovery path.
2. **No admin drill-down.** Admins see only aggregate counts; they cannot see which emails failed, why, or when — and cannot act on them.
3. **Processor can die silently.** If `processEmailQueue()` throws an unhandled error, the `setInterval` loop may stop with no signal. *(Note: the current `tick()` already isolates errors — FR-3 verifies this rather than reimplements it.)*
4. **Config bypasses validated env.** `EMAIL_FROM` is read via raw `process.env.EMAIL_FROM` in the processor, bypassing the Zod-validated `src/config/env.ts` used by all other configuration.

## Goals

- Make every queued email recoverable: no email is permanently lost without an admin action path.
- Give admins full visibility into queue state and failure reasons.
- Guarantee the background processor survives per-cycle errors and surfaces its health.
- Bring `EMAIL_FROM` into the validated environment configuration.

## Functional Requirements

### FR-1: Admin Queue Inspector Page
- New admin route `/admin/email-queue` guarded by `requireRole(['superadmin', 'admin'])`.
- Paginated table (20/page) of `email_queue` rows showing: recipient, subject (truncated), template type, status badge, attempts, created_at, last_attempt_at, error_message (when present). For `sent` rows, `last_attempt_at` represents the sent time.
- Filter by status (all / pending / processing / sent / failed) and free-text search by recipient email or subject.
- Summary stat row at top (Pending / Sent / Failed counts) consistent with the existing dashboard widget semantics.

### FR-2: Manual Retry of Failed Emails
- On the inspector page, `failed` rows expose a "Retry" action.
- Retry resets the row: `status` → `pending`, `attempts` → 0, `error_message` → null, `last_attempt_at` → null (fresh 3-attempt budget; processor picks it up next cycle).
- Confirmation dialog before retry (consistent with other significant admin actions).
- Server function `retryEmail(emailId)` — admin-only; validates the row is currently `failed` before resetting (idempotent guard).

### FR-3: Processor Lifecycle Resilience
- Each `processEmailQueue()` invocation from the `setInterval` loop is wrapped so a thrown error in one cycle does not terminate the loop.
- Unhandled errors in a cycle are logged (structured) and the interval continues.
- Graceful shutdown (`clearInterval`) behavior preserved.
- *(Already implemented in `src/lib/email-queue-init.ts` `tick()`; this requirement is verified by test, not reimplemented.)*

### FR-4: Structured Processor Logging
- The processor emits structured log lines for: cycle start/end, emails processed/sent/failed per cycle, stale-row reclamation count, and per-email failures (email id + error message; no PII from body/subject).
- Developer-facing strings only — no i18n keys required.

### FR-5: Config Hygiene
- Add `EMAIL_FROM` to `src/config/env.ts` as an optional string (default `'SIMAK <noreply@simak.app>'`).
- Processor reads `EMAIL_FROM` from the validated env instead of `process.env`.
- Update `.env.example` to document the new optional variable.

## Non-Functional Requirements

- **Security**: Retry server function is admin-only with role guard; no PII in logs.
- **Performance**: Inspector queries use the existing `(status, created_at)` index; pagination 20/page.
- **Backward compatibility**: No schema migration required — all changes use existing columns.
- **Testing**: Unit tests for retry handler, processor logging, env config; component tests for inspector; coverage ≥80%.
- **i18n**: All user-visible strings translated in `locales/en.json` and `locales/id.json`.

## Acceptance Criteria

1. An admin can navigate to `/admin/email-queue` and view a paginated, filterable list of all queued emails with status, attempts, timestamps, and error messages.
2. An admin can click "Retry" on a `failed` email; after confirmation the row returns to `pending` and is sent on the next processor cycle.
3. If `processEmailQueue()` throws during a cycle, the `setInterval` loop continues running (verified by test).
4. Processor cycle outcomes (processed/sent/failed) and failures are emitted as structured log lines.
5. `EMAIL_FROM` is read from `src/config/env.ts`; removing it from the environment falls back to the documented default.
6. `pnpm test`, `pnpm test:coverage`, `pnpm typecheck`, `pnpm lint`, and `pnpm check:i18n` all pass; no file in `src/`/`tests/`/`scripts/` exceeds 500 lines.

## Out of Scope

- Replacing the in-process `setInterval` scheduler with an external worker / cron / queue service (BullMQ, pg-boss, etc.). The in-process model remains.
- Changing the automatic retry/backoff strategy (3-attempt / [0, 30s, 5min, 30min] backoff stays).
- Sending failure-alert emails to admins (inspector + logging is the recovery path for this track).
- Bulk retry / "retry all" action (single-row retry only).
- New email templates or email body/content changes.
</protect>
