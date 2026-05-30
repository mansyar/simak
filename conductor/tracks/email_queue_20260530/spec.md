# Track 4.1 — Background Email Queue with Retry

## Overview

Introduce an `email_queue` database table and background processing architecture to replace the current synchronous Resend API calls. The three existing email-sending functions (`sendPasswordResetEmail`, `sendInvitationEmail`, `sendSLAAlertEmail`) will enqueue email records instead of calling Resend directly. An in-process background processor dequeues and sends pending emails every 30 seconds with exponential backoff retry.

**Current state:** All three email functions in `src/lib/email.ts` call `resend.emails.send()` synchronously, blocking the server function response until the HTTP request completes (typically 200–500ms per send). On transient failures (network blips, Resend rate limits), the original operation (user creation, password reset request) fails entirely.

**Target state:** Email functions write to `email_queue` (sub-millisecond DB insert), returning immediately. The background processor handles delivery asynchronously with automatic retry. Transient failures are retried; permanent failures are logged and surfaced in the admin dashboard.

## Dependencies

- V1 email sending infrastructure (`src/lib/email.ts`) — the 3 functions to refactor
- PostgreSQL with Drizzle ORM
- `getEnv` config (`RESEND_API_KEY`, `BETTER_AUTH_URL`)
- Existing admin dashboard (`/admin/dashboard`) — for the queue status widget

## Database Schema

### New Table: `email_queue`

| Column          | Type               | Notes                                                             |
| --------------- | ------------------ | ----------------------------------------------------------------- |
| id              | serial (PK)        |                                                                   |
| recipient_email | text, not null     |                                                                   |
| subject         | text, not null     |                                                                   |
| body_html       | text, not null     |                                                                   |
| template_type   | text, not null     | CHECK constraint: `password_reset` \| `invitation` \| `sla_alert` |
| status          | text, not null     | `pending` \| `sent` \| `failed`                                   |
| attempts        | integer, default 0 |                                                                   |
| last_attempt_at | timestamp          | NULLABLE                                                          |
| error_message   | text               | NULLABLE — last failure reason                                    |
| created_at      | timestamp          | DEFAULT NOW()                                                     |

Index on `(status, created_at ASC)` for efficient dequeuing.

## Existing File Changes

### `src/lib/email.ts` — Refactored

The three existing functions will be refactored to:

1. Accept the same parameters (no signature change for callers)
2. Insert a row into `email_queue` with `status: 'pending'`
3. Return immediately (no longer await Resend)

A new internal helper `sendEmailWithResend(record)` will contain the actual Resend call, shared between the processor and (optionally) direct sends.

### Callers — No Changes Needed

Since the function signatures don't change, callers remain untouched:

- `src/auth/config.ts` → `sendPasswordResetEmail`
- `src/server/users.server.ts` → `sendInvitationEmail`
- `src/lib/review-sla.ts` → `sendSLAAlertEmail`

### New File: Email Queue Processor

A module that:

- Runs on a `setInterval` every 30 seconds
- Queries `email_queue` for `status = 'pending'` ordered by `created_at ASC`
- For each pending email, attempts to send via Resend
- On success: updates status to `'sent'`
- On failure: increments `attempts`, updates `last_attempt_at` and `error_message`
  - If `attempts < 3`: leaves status as `'pending'` (will be retried)
  - If `attempts >= 3`: marks status as `'failed'`

Backoff schedule:

- Attempt 1 → 2: 30s delay between retries (natural interval — processed on next tick)
- Attempt 2 → 3: 5min delay (skipped if the processor ticks before the minimum interval)
- Attempt 3 → fail: 30min delay (skipped similarly; marked failed after exceeding max)

### New Drizzle Schema: `src/db/schema/email-queue.ts`

Standard Drizzle table definition following the existing pattern in `src/db/schema/`.

### Admin Dashboard Widget

A small card on `/admin/dashboard` showing:

- Pending: count (blue/number)
- Sent: count (green/number)
- Failed: count (red/number)

Part of the existing admin dashboard aggregated query (`getAdminDashboardData`).

### i18n Translations

Add translation keys for:

- Admin dashboard widget labels: `emailQueue.pending`, `emailQueue.sent`, `emailQueue.failed`
- English and Indonesian locales

## Non-Functional Requirements

- **Zero regression** in email content or formatting — all three HTML templates remain identical
- **Queue isolation** — email delivery failures must not affect the primary operation (e.g., a failed SLA alert must not prevent the review from completing)
- **Graceful shutdown** — the processor interval is cleared on server shutdown (if supported by the framework)

## Acceptance Criteria

- [ ] `email_queue` table created with proper indexes and CHECK constraint on `template_type`
- [ ] All three email-sending functions enqueue instead of calling Resend directly
- [ ] Background processor dequeues and sends pending emails every 30 seconds
- [ ] Retry logic: 3 attempts with exponential backoff (30s, 5min, 30min between retries)
- [ ] After 3 failures → marked `failed` with stored error message
- [ ] Admin dashboard shows queue status counts (pending/sent/failed)
- [ ] No regression in email content or formatting
- [ ] i18n translations for queue status labels
- [ ] Existing caller tests still pass with updated mocks

## Out of Scope

- Email queue admin detail page (viewing individual failed emails, manual retry) — deferred
- Email template editing in the admin panel
- Metrics/analytics on email delivery (send time, open rate)
- Dead letter queue or webhook-based delivery status
