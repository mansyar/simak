# Track: TRACK-021 — Proactive Deadline Reminder System

## Overview

SIMAK currently reacts to deadlines only **after** they pass (auto-locking overdue checkpoints, SLA-breach escalation, `deadlineBreachRate` analytics). There is no proactive nudge *before* a deadline. This track adds a background scanner that, once per hour, finds student checkpoints approaching their due date and dispatches a tiered reminder (in-app notification + email) at 7-day, 3-day, and 1-day lead times.

The scanner reuses the existing email-queue poller (`src/lib/email-queue-init.ts`) and mirrors the batch-notification + advisory-email pattern already proven in `src/lib/review-sla.ts`. It is throttled to hourly (day-based tiers need no 30s precision) and is multi-instance safe via `ON CONFLICT DO NOTHING` dedup.

**Track type:** Feature  ·  **Status:** Pending  ·  **Dependencies:** None  ·  **Estimated effort:** 5 days / 3 sprint loops

## Context Anchors (Traceability)

- **PRD:** `docs/PRD.md#checkpoints--submissions` (checkpoint lifecycle — students submit per checkpoint with due dates), `docs/PRD.md#analytics--reporting` (existing `deadlineBreachRate` metric measures the gap this track closes)
- **TDD:** `checkpoints` table (`src/db/schema/assignments.ts:77` — `dueDate` timestamp + `state` pgEnum), `email_queue` table (`src/db/schema/email-queue.ts:3` — `templateType` enum, `status` lifecycle), `notifications` table (`src/db/schema/notifications.ts:13` — `type`, `titleKey`, `messageKey`, `channel`)
- **Extension points:** `src/lib/email-queue-init.ts` (existing 30s polling loop), `src/lib/email-queue-processor.ts` (`FOR UPDATE SKIP LOCKED` concurrency model), `src/lib/review-sla.ts` (closest analog — reactive scan dispatching batch notifications + emails), `src/lib/event-email.ts` (`enqueueEventEmail` advisory pattern), `src/server/dashboard-student.server.ts:49-67` (upcoming-deadlines query shape reused by scanner)

## Functional Requirements

### FR-1: Dedup tracking table (`deadline_reminders`)
- New table `deadline_reminders`: `checkpointId` (FK→`checkpoints.id`, `onDelete: cascade`), `studentId` (FK→`users.id`, `onDelete: cascade`), `tier` (text — `'7d'`/`'3d'`/`'1d'`), `sentAt` (timestamp, `defaultNow`).
- **Unique constraint `(checkpointId, tier)`** — guarantees at-most-once delivery per tier per checkpoint, even across multiple server instances.

### FR-2: Supporting index
- Add composite index `checkpoints_state_due_date_idx` on `checkpoints (state, dueDate)` — supports the scanner's `WHERE state IN (...) AND dueDate BETWEEN ...` query (no existing index covers `dueDate`).

### FR-3: Email-queue enum extension
- Add `'deadline_reminder'` to the `templateType` array in `src/db/schema/email-queue.ts`. This is a Drizzle **text** enum (`text('template_type', { enum: [...] })`), NOT a pg enum — a code-only change, no `ALTER TYPE` migration.

### FR-4: Scanner module (`src/lib/deadline-reminder-scanner.ts`)
- Exports `processDeadlineReminders()`.
- **Tier constants:** `[{ tier: '7d', leadDays: 7 }, { tier: '3d', leadDays: 3 }, { tier: '1d', leadDays: 1 }]`.
- **NON-overlapping tier bands** (confirmed: no catch-up — a short-deadline checkpoint skips earlier tiers, preventing simultaneous multi-tier firing):
  - 7d band: `dueDate <= NOW() + 7 days AND dueDate > NOW() + 3 days`
  - 3d band: `dueDate <= NOW() + 3 days AND dueDate > NOW() + 1 day`
  - 1d band: `dueDate <= NOW() + 1 day AND dueDate > NOW()`
- For each tier, query `checkpoints` JOIN `assignments` JOIN `users` WHERE `state IN ('unlocked', 'revise')` (confirmed: both initial submission and revision deadlines use the same `dueDate` field) AND `dueDate` within that tier's band AND `assignments.deletedAt IS NULL` AND `users.deletedAt IS NULL`.
- **Dedup:** `INSERT INTO deadline_reminders ... ON CONFLICT (checkpointId, tier) DO NOTHING RETURNING *` — only process rows where the insert succeeded (this instance won the race).
- For winning rows: batch-create in-app notifications via `db.insert(notifications).values(...)` with `getNotificationKeys('deadline_reminder')` (params all stringified: `assignmentTitle`, `checkpointName`, `dueDate: String(dueDate)` — matching `review-sla.ts:85-90`) + parallel-enqueue emails via `Promise.allSettled` calling `sendDeadlineReminderEmail` (advisory, never throws — same pattern as `review-sla.ts:114-125`).

### FR-5: Poller hook
- Add `processDeadlineReminders()` call to `email-queue-init.ts` `tick()` — runs after `processEmailQueue()`, before the prune check.
- **Hourly throttle** (confirmed: hourly for all tiers): `lastReminderScanAt` timestamp (same pattern as `lastPruneAt` at line 8) — only runs if `Date.now() - lastReminderScanAt.getTime() > REMINDER_SCAN_INTERVAL_MS` where `REMINDER_SCAN_INTERVAL_MS = 60 * 60 * 1000`.
- Guarded by `try/catch` (advisory — scanner failure must not break email processing).

### FR-6: Email template + helper
- New `buildDeadlineReminderHtml` in `src/lib/email-templates.ts` (named `build{Event}Html` per convention) using internal `HEADER_HTML`/`FOOTER_HTML`/`detailRow`/`detailTable`/`deepLinkButton`/`fallbackLink`/`buildEmail` helpers. Shows assignment title, checkpoint name, due date (locale-formatted), CTA link to `${BETTER_AUTH_URL}/student/assignments/{assignmentId}/checkpoints/{checkpointId}`.
- Email body uses the `STRINGS` constant object in `email-templates.ts` (NOT locales JSON) — add `deadlineReminder` intro string to both `en` and `id` entries. Only the email **subject** uses locales JSON: `emails.subjects.deadlineReminder` (camelCase).
- New `src/lib/deadline-reminder-email.ts` exporting `sendDeadlineReminderEmail(opts)` calling `enqueueEventEmail` with `buildDeadlineReminderHtml` (matching `review-email.ts` pattern).

### FR-7: In-app notification route mapping
- Extend `src/components/notifications/notification-routes.ts` `getNotificationRoute()` switch with `case 'deadline_reminder':` returning `/student/assignments/${meta.assignmentId}/checkpoints/${meta.checkpointId}`. Without this, in-app notifications are not clickable (return `null`).

### FR-8: i18n keys
- `notifications.events.deadline_reminder.title` / `.message` (params: `assignmentTitle`, `checkpointName`, `dueDate` — all strings)
- `emails.subjects.deadlineReminder`
- Added to both `locales/en.json` and `locales/id.json`; run `pnpm generate:i18n`.

## Non-Functional Requirements

- **Multi-instance safety:** `ON CONFLICT (checkpointId, tier) DO NOTHING` ensures at-most-once delivery per tier even with multiple server instances.
- **Performance:** Scanner queries use the `(state, dueDate)` index — no sequential scan. Hourly throttle prevents excessive DB queries.
- **Isolation:** Scanner failure is isolated via `try/catch` in `tick()` — email-queue processing unaffected.
- **Reuse:** Scanner reuses `getNotificationKeys`, `enqueueEventEmail`, batch `db.insert(notifications)`, `Promise.allSettled` (same patterns as `review-sla.ts`).
- **Concurrency:** Drizzle text enum extension is code-only (no `ALTER TYPE` migration).
- **File limits:** All new files ≤500 lines; migration has a rollback file.
- **Coverage:** ≥80% on lines, statements, branches, functions.
- **i18n:** Full EN + ID parity; `pnpm check:i18n` clean.

## Acceptance Criteria

- [ ] A checkpoint due in 5 days with state `unlocked` → after hourly tick, student gets a 7d-tier in-app notification + email.
- [ ] At 2 days out → 3d-tier notification; at 0.5 days out → 1d-tier notification.
- [ ] A checkpoint created with a 2-day deadline triggers ONLY the 3d tier (7d band is `> 3 days`, doesn't qualify).
- [ ] A checkpoint due in 5 days does NOT trigger the 3d tier (5 > 3, outside band).
- [ ] A second hourly tick produces zero duplicate notifications (dedup via unique constraint).
- [ ] Checkpoints with state `passed`/`submitted`/`under_review`/`locked` produce no reminder.
- [ ] Checkpoints with state `revise` DO produce a reminder (revision deadline).
- [ ] Soft-deleted assignment's checkpoints produce no reminders.
- [ ] Scanner runs hourly (not every 30s — `lastReminderScanAt` throttle).
- [ ] Existing email-queue processing unaffected by scanner failures (try/catch isolation).
- [ ] `deadlineBreachRate` analytics metric continues to compute correctly (read-only dependency).
- [ ] In-app `deadline_reminder` notifications are clickable (navigate to checkpoint page).
- [ ] `pnpm test:unit` passes; `pnpm test:coverage` ≥80%; `pnpm typecheck`, `pnpm lint`, `pnpm check:i18n` all clean.

## Out of Scope

- Admin-configurable lead times (v1 uses constants in scanner module `REMINDER_TIERS`; v2 adds admin settings UI / env override).
- Instructor review-pending reminders ("you have N reviews awaiting" — different trigger/query — deferred to a follow-up track).
- Per-user notification preferences / opt-out (deferred to TRACK-022 — confirmed: proceed with TRACK-021 alone, reminders non-mutable in v1).
- SMS / push notification channels (email + in-app only in v1).
- Overdue reminders (deadline already passed — `deadlineBreachRate` analytics tracks these; v1 sends pre-deadline reminders only via `dueDate > NOW()`).
- Reminders for checkpoints with `dueDate IS NULL` (no due date → no reminder).
