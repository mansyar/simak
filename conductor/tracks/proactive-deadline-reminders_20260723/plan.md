<protect>
# Implementation Plan: TRACK-021 — Proactive Deadline Reminder System

> Workflow: TDD per `conductor/workflow.md`. Each task follows Red (write failing tests) → Green (implement to pass) → Verify (coverage + quality gates) → Commit + git note → mark `[x]` in plan. Status markers: `[ ]` pending, `[~]` in progress, `[x]` complete.

## Phase 1: Schema & Migration

- [ ] Task: Read `spec.md` and `conductor/workflow.md` to re-anchor on requirements and TDD protocol before starting Phase 1
- [ ] Task: Create `deadline_reminders` table, `checkpoints` index, and email-queue enum extension
    - [ ] Write Tests (Red): schema tests for `deadline_reminders` — table existence, FK cascade behavior (`checkpointId`→`checkpoints.id` onDelete cascade, `studentId`→`users.id` onDelete cascade), unique constraint `(checkpointId, tier)` enforcement (duplicate insert rejected), and `checkpoints_state_due_date_idx` index existence
    - [ ] Implement (Green): add Drizzle schema for `deadline_reminders` (checkpointId FK, studentId FK, tier text, sentAt timestamp defaultNow, unique `(checkpointId, tier)`); add composite index `checkpoints_state_due_date_idx` on `checkpoints (state, dueDate)`; add `'deadline_reminder'` to the `templateType` array in `src/db/schema/email-queue.ts` (code-only — Drizzle text enum, no `ALTER TYPE`)
    - [ ] Run `pnpm db:generate` + `pnpm db:migrate`; create rollback migration file (per SQL styleguide §5.1)
    - [ ] Verify: migration applies cleanly, rollback works, unique constraint rejects duplicate `(checkpointId, tier)`, index exists, `pnpm typecheck` clean
    - [ ] Commit: `feat(db): Add deadline_reminders table + checkpoints state/dueDate index`; attach git note; mark task `[x]` with commit SHA
- [ ] Task: Conductor - User Manual Verification 'Schema & Migration' (Protocol in workflow.md)

## Phase 2: Scanner Core

- [ ] Task: Read `spec.md` and `conductor/workflow.md` to re-anchor on requirements and TDD protocol before starting Phase 2
- [ ] Task: Implement deadline-reminder scanner module (`src/lib/deadline-reminder-scanner.ts`)
    - [ ] Write Tests (Red): scanner logic — non-overlapping tier band boundaries (7d fires at 4–7 days, 3d at 2–3 days, 1d at 0–1 day, verify NO overlap at boundaries); state filter (`unlocked`/`revise` included, `locked`/`submitted`/`under_review`/`passed` excluded); dedup (second run produces zero new reminders); soft-delete skip (assignment + user deleted → no reminder); `ON CONFLICT DO NOTHING` at-most-once behavior; notification creation (correct `type`, `titleKey`, `messageKey`, `params` all strings, `channel: 'in_app'`); parallel email enqueue via `Promise.allSettled` (advisory, never throws). Mock `@/db/index`, `@/lib/email`, `@/lib/i18n-server`.
    - [ ] Implement (Green): create `src/lib/deadline-reminder-scanner.ts` exporting `processDeadlineReminders()`. Tier constants `REMINDER_TIERS = [{tier:'7d',leadDays:7},{tier:'3d',leadDays:3},{tier:'1d',leadDays:1}]`. Non-overlapping bands (7d: `dueDate <= NOW()+7d AND > NOW()+3d`; 3d: `<= NOW()+3d AND > NOW()+1d`; 1d: `<= NOW()+1d AND > NOW()`). Query `checkpoints JOIN assignments JOIN users WHERE state IN ('unlocked','revise') AND dueDate in band AND assignments.deletedAt IS NULL AND users.deletedAt IS NULL`. Dedup via `INSERT ... ON CONFLICT (checkpointId, tier) DO NOTHING RETURNING *`. For winning rows: batch `db.insert(notifications)` with `getNotificationKeys('deadline_reminder')` (params stringified) + `Promise.allSettled` calling `sendDeadlineReminderEmail`.
    - [ ] Verify: scanner produces zero reminders when none due; exactly one per tier per checkpoint when due; dedup prevents re-send; non-overlapping bands prevent simultaneous multi-tier firing; soft-deleted skipped; `pnpm test:coverage` ≥80% on new file
    - [ ] Commit: `feat(reminders): Add deadline-reminder scanner with non-overlapping tier bands`; attach git note; mark task `[x]` with commit SHA
- [ ] Task: Wire scanner into email-queue tick with hourly throttle
    - [ ] Write Tests (Red): `email-queue-init.ts` tick integration — scanner runs hourly alongside 30s email processing; failure isolated (try/catch does not break email processing); hourly throttle (scanner skips if `lastReminderScanAt` < 1 hour ago)
    - [ ] Implement (Green): add `processDeadlineReminders()` call to `email-queue-init.ts` `tick()` after `processEmailQueue()`, before prune check. Add `lastReminderScanAt` timestamp (same pattern as `lastPruneAt` at line 8) + `REMINDER_SCAN_INTERVAL_MS = 60 * 60 * 1000`. Guard with `try/catch`.
    - [ ] Verify: scanner throttled hourly (not every 30s); email processing unaffected by scanner failure
    - [ ] Commit: `feat(reminders): Hook deadline scanner into email-queue tick with hourly throttle`; attach git note; mark task `[x]` with commit SHA
- [ ] Task: Conductor - User Manual Verification 'Scanner Core' (Protocol in workflow.md)

## Phase 3: Email Template, Helper & i18n

- [ ] Task: Read `spec.md` and `conductor/workflow.md` to re-anchor on requirements and TDD protocol before starting Phase 3
- [ ] Task: Email template builder + helper wrapper
    - [ ] Write Tests (Red): `buildDeadlineReminderHtml` rendering — both locales (en/id), `STRINGS` object intro string, date formatting per locale, HTML escaping, CTA link to `${BETTER_AUTH_URL}/student/assignments/{assignmentId}/checkpoints/{checkpointId}`; `sendDeadlineReminderEmail` wrapper calls `enqueueEventEmail` with correct opts (matching `review-email.ts` pattern)
    - [ ] Implement (Green): add `buildDeadlineReminderHtml` to `src/lib/email-templates.ts` using internal `HEADER_HTML`/`FOOTER_HTML`/`detailRow`/`detailTable`/`deepLinkButton`/`fallbackLink`/`buildEmail` helpers; add `deadlineReminder` intro string to `STRINGS` object for both `en` and `id`. Create `src/lib/deadline-reminder-email.ts` exporting `sendDeadlineReminderEmail(opts)` calling `enqueueEventEmail` with `buildDeadlineReminderHtml`.
    - [ ] Verify: email renders in both locales; helper matches `review-email.ts` pattern; `pnpm typecheck` clean
    - [ ] Commit: `feat(reminders): Add deadline-reminder email template + helper wrapper`; attach git note; mark task `[x]` with commit SHA
- [ ] Task: Notification route mapping + i18n keys
    - [ ] Write Tests (Red): `notification-routes.ts` route derivation for `deadline_reminder` type — returns `/student/assignments/${meta.assignmentId}/checkpoints/${meta.checkpointId}`; missing metadata returns `null`
    - [ ] Implement (Green): extend `src/components/notifications/notification-routes.ts` `getNotificationRoute()` with `case 'deadline_reminder':`. Add i18n keys to both `locales/en.json` and `locales/id.json`: `notifications.events.deadline_reminder.title`/`.message` (params: `assignmentTitle`, `checkpointName`, `dueDate`), `emails.subjects.deadlineReminder`. Run `pnpm generate:i18n`.
    - [ ] Verify: `pnpm check:i18n` parity (no missing/unused keys); in-app notification is clickable (route derived); notification resolves title/message via `getNotificationKeys`; `pnpm lint` clean (no hardcoded strings)
    - [ ] Commit: `feat(reminders): Add deadline_reminder notification route + i18n keys`; attach git note; mark task `[x]` with commit SHA
- [ ] Task: Final quality gates + verify `deadlineBreachRate` unaffected
    - [ ] Run `pnpm test:coverage` (≥80% all thresholds), `pnpm typecheck`, `pnpm lint`, `pnpm check:i18n`, `pnpm check:i18n:unused`
    - [ ] Verify `deadlineBreachRate` analytics metric unaffected (read-only dependency — no query changes)
    - [ ] Verify all new files ≤500 lines (`scripts/check-modularity.js`)
    - [ ] Commit (if any cleanup): `chore(reminders): Final quality gate cleanup`; attach git note; mark task `[x]` with commit SHA
- [ ] Task: Conductor - User Manual Verification 'Email Template, Helper & i18n' (Protocol in workflow.md)
</protect>
