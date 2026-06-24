# Track 8.2 — Email Pipeline Hardening

## Overview

This track hardens the email pipeline against two security/correctness findings from the four-pillar audit:

1. **CRITICAL — Email Queue Race Condition (Duplicate Delivery):** The background email processor (`processEmailQueue`) dequeues pending rows using a plain `SELECT ... LIMIT 10` with no `FOR UPDATE SKIP LOCKED`, no transaction, and no in-flight mutex. Overlapping `setInterval` ticks (the 30s interval fires without awaiting the previous run) and multi-instance deployments cause the same email row to be claimed by two workers, resulting in duplicate email delivery.

2. **HIGH — HTML Injection in Email Templates (CWE-79):** User-controlled values (assignment titles, checkpoint names, student names, user display names) are interpolated directly into HTML email bodies via template literals without escaping. A compromised instructor account (or crafted input) can inject styled content, fake login forms, and deceptive links, enabling phishing and content spoofing against every email recipient.

**Type:** Bug / Security Hardening
**Dependencies:** Track 4.1 (Email Queue — `email_queue` table and processor being hardened)

## Audit Findings Addressed

| Severity | Finding | Location |
| -------- | ------- | -------- |
| CRITICAL | Email Queue Race Condition (Duplicate Delivery) | `src/lib/email-queue-processor.ts` `processEmailQueue` + `src/lib/email-queue-init.ts` |
| HIGH | HTML Injection in Email Templates | `src/lib/email.ts` (lines 52, 113, 178-193) + `src/server/two-factor.server.ts` (lines 96, 178) |

## Functional Requirements

### FR-1: Add `processing` status to email queue
- Extend the `email_queue.status` CHECK constraint to include `processing` alongside `pending`, `sent`, `failed`.
- Update the Drizzle schema (`src/db/schema/email-queue.ts`) to reflect the new enum value.
- The `processing` status marks rows that have been claimed by a worker but not yet sent.

### FR-2: Row-level locking in `processEmailQueue`
- `processEmailQueue` claims pending rows using `SELECT ... FOR UPDATE SKIP LOCKED` within a `db.transaction`.
- Claimed rows are immediately marked `processing` (within the same transaction) so concurrent workers skip them.
- The actual Resend API send occurs **outside** the transaction (network calls must not hold row locks).
- After sending, each row is individually updated to `sent` (success) or back to `pending` with incremented `attempts` (failure), or `failed` after 3 attempts.

### FR-3: Prevent overlapping interval ticks
- `email-queue-init.ts` adds an `isRunning` boolean guard so a new `setInterval` tick returns immediately if the previous run is still in flight.

### FR-4: Stale `processing` row recovery
- Each processor tick reclaims rows stuck in `processing` state longer than a configurable timeout (default 5 minutes) back to `pending`.
- This prevents silent email loss when a worker crashes/restarts after claiming rows but before completing the send.
- The reclaim runs as the first step of `processEmailQueue`, before claiming new pending rows.

### FR-5: `escapeHtml` helper
- Add a centralized `escapeHtml(s: string): string` helper in `src/lib/email.ts`.
- Escapes ampersand, less-than, greater-than, double-quote, and single-quote to their HTML entity equivalents.

### FR-6: Apply `escapeHtml` to all email body generation
- Apply `escapeHtml` to every interpolation of user-derived data across all email body generation code:
  - `src/lib/email.ts`:
    - `sendPasswordResetEmail` — `params.name`
    - `sendInvitationEmail` — `params.name`
    - `sendSLAAlertEmail` — `adminName`, `assignmentTitle`, `studentName`, `checkpointName`
  - `src/server/two-factor.server.ts`:
    - 2FA enable email — user display name
    - 2FA disable email — user display name
- Server-controlled values (URLs constructed from env config, static copyright text, breach day counts) are NOT escaped — only user-derived data.

## Non-Functional Requirements

### NFR-1: No regression for non-malicious input
- Email templates containing normal (non-malicious) user data must produce byte-identical output to before this track, except for the added escaping of special characters. Existing tests asserting on email body content must continue to pass.

### NFR-2: Multi-worker safety
- In a multi-worker scenario, no two workers send the same email. Verified by an integration test against a real PostgreSQL database.

### NFR-3: i18n unaffected
- Email bodies are server-rendered HTML, not i18n keys. No new i18n strings are required.

## Acceptance Criteria

- [ ] `email_queue.status` CHECK constraint includes `processing` value; migration applied and reversible
- [ ] `processEmailQueue` claims rows using `SELECT ... FOR UPDATE SKIP LOCKED` within a transaction
- [ ] Claimed rows are marked `processing` within the transaction before the Resend send occurs
- [ ] Resend API send occurs outside the transaction; status updated to `sent`/`pending`/`failed` individually afterward
- [ ] `email-queue-init.ts` guards against overlapping ticks via `isRunning` flag
- [ ] Stale `processing` rows older than 5 minutes are reclaimed to `pending` at the start of each tick
- [ ] In a multi-worker scenario, no two workers send the same email (verified by integration test in `tests/integration/`)
- [ ] `escapeHtml` helper exists in `src/lib/email.ts`
- [ ] `escapeHtml` is applied to all user-derived interpolations in `src/lib/email.ts` (3 functions) and `src/server/two-factor.server.ts` (2 email templates)
- [ ] Email templates containing `<script>`, `<img onerror=...>`, or `<a href=...>` in user data render as escaped text, not executable HTML
- [ ] No regression in email content or formatting for non-malicious input
- [ ] i18n not affected (email bodies are server-rendered HTML, not i18n keys)

## Out of Scope

- In-app notification system (separate from email pipeline — no changes to `notifications` table or notification handlers)
- Email template visual redesign or new email types
- Performance optimizations (instructor dashboard query parallelization, bulk import batching — Track 8.4)
- Transactional integrity of non-email handlers (Track 8.3)
- SMTP/provider migration (staying with Resend)

## Test Plan

| Area | Approach |
| ---- | ------- |
| Race condition — single worker | Unit test — overlapping `processEmailQueue` calls do not pick up the same rows (mocked DB verifies `FOR UPDATE SKIP LOCKED` in query + `processing` status set) |
| Race condition — multi-worker | Integration test (`tests/integration/`) — two concurrent `processEmailQueue` calls each send disjoint email sets against real PostgreSQL |
| `isRunning` guard | Unit test — second tick within 30s of first returns immediately without processing |
| Stale row recovery | Unit test — `processing` rows older than 5 min are reclaimed to `pending`; fresh `processing` rows are left alone |
| HTML escaping — single field | Unit test — `<script>alert(1)</script>` in assignment title renders as `&lt;script&gt;` in email body |
| HTML escaping — all fields | Unit test — `name`, `assignmentTitle`, `studentName`, `checkpointName`, `adminName` all escaped in every template (email.ts + two-factor.server.ts) |
| Regression — non-malicious input | Unit test — normal input produces identical email output as before (existing assertions still pass) |
