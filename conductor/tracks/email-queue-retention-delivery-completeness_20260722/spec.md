# Track: Email Queue Retention & Delivery Completeness

## Overview

This track addresses three deferred items from the original audit (BUG-4, BUG-20, PERF-32/33) and one new enhancement (ENH-OPS-1) to improve the email queue's operational hygiene and delivery tracking. It builds on the email queue infrastructure established in TRACK-004 (archived), which explicitly deferred these items.

### Problem Statement

- **BUG-4:** The `email_queue` table lacks a `resendMessageId` column, preventing correlation with Resend's delivery dashboard for bounce/delivery tracking.
- **BUG-20 / ENH-OPS-1:** Sent and failed email queue rows accumulate indefinitely with no retention cleanup, leading to unbounded table growth.
- **PERF-32/33:** The email queue processor sends emails sequentially (up to 10 per 30s cycle), causing cycle latency proportional to batch size × single-send latency.

## Functional Requirements

### FR-1: resendMessageId Column (BUG-4)
- Add a nullable `resendMessageId text` column to the `email_queue` schema.
- Populate it from the Resend API response (`result.data.id`) on successful send in the processor's send path.
- Expose it in the admin email queue inspector (`/admin/email-queue`):
  - Add to `listEmailQueueHandler` SELECT.
  - Add to `EmailQueueEntry` type.
  - Render as a monospace truncated cell with full value in `title` tooltip.

### FR-2: Retention Cleanup (ENH-OPS-1 / BUG-20)
- Create `src/lib/email-queue-retention.ts` with a `pruneOldEmails()` function.
- Delete `sent` rows older than 90 days and `failed` rows older than 180 days.
- Never touch `pending` or `processing` rows.
- SQL: `DELETE FROM email_queue WHERE (status='sent' AND createdAt < now() - interval '90 days') OR (status='failed' AND createdAt < now() - interval '180 days')`
- Trigger: tick-embedded check via module-level `lastPruneAt` timestamp in `email-queue-init.ts`.
  - On each 30s tick, if >24h since last prune, invoke `pruneOldEmails()` and update `lastPruneAt`.
  - Robust to process restarts (first tick after startup prunes if >24h elapsed).
- Log `email_queue.retention_pruned` with deleted count.

### FR-3: Concurrent Batch Sends (PERF-32/33)
- Replace the sequential `for` loop in `email-queue-processor.ts` with chunked `Promise.allSettled`.
- Split the claimed batch into chunks of 5.
- Run `Promise.allSettled` per chunk sequentially (total cycle time ≈ 2× single-send latency instead of 10×).
- Each email's success/failure handled individually in the settled callback (same UPDATE logic as current).
- The existing batch-level `FOR UPDATE SKIP LOCKED` claim remains unchanged.
- The `isRunning` guard and stale-row reclaim remain unchanged.

## Non-Functional Requirements

- **Migration safety:** The `resendMessageId` column is additive (nullable), zero downtime.
- **Rollback:** Migration must have a rollback file (SQL styleguide §5.1).
- **File limit:** All files must stay under 500 lines.
- **Testing:** TDD per `conductor/workflow.md`. Coverage ≥80% on lines/functions/branches/statements.
- **No PII:** Log entries must not contain PII (email addresses, subject lines).
- **i18n:** Column header in admin table needs an i18n key in both `en.json` and `id.json`.

## Acceptance Criteria

1. **AC-1:** `resendMessageId` column exists in `email_queue` schema and migration (with rollback file).
2. **AC-2:** Processor populates `resendMessageId` from `result.data.id` on successful send; remains `null` on failure.
3. **AC-3:** `listEmailQueueHandler` SELECT includes `resendMessageId`; `EmailQueueEntry` type includes it.
4. **AC-4:** `/admin/email-queue` table renders `resendMessageId` in monospace truncated cell with `title` tooltip.
5. **AC-5:** `pruneOldEmails()` function exists in `src/lib/email-queue-retention.ts` and deletes only `sent` rows >90 days and `failed` rows >180 days.
6. **AC-6:** Retention trigger is tick-embedded (`lastPruneAt` in `email-queue-init.ts`); prunes on 30s tick if >24h elapsed.
7. **AC-7:** Processor logs `email_queue.retention_pruned` with deleted count (no PII).
8. **AC-8:** Processor sends emails in chunks of 5 via `Promise.allSettled`; partial failures don't abort the batch.
9. **AC-9:** All quality gates pass: `pnpm test:coverage` ≥80%, `pnpm typecheck`, `pnpm lint`, `pnpm check:i18n`.

## Out of Scope

- External cron/scheduler infrastructure (use the existing in-process loop).
- Email template/content changes.
- Bounce/complaint webhook handling from Resend (separate future feature).
- Changes to the `FOR UPDATE SKIP LOCKED` batch claim logic.
- Changes to the `isRunning` guard or stale-row reclaim logic.

## Context Anchors

- **Roadmap:** `docs/roadmap.md` — TRACK-016 (lines 1003-1049)
- **Prior Track:** `conductor/archive/email-queue-robustness_20260719/` (TRACK-004 — deferred these items)
- **PRD Reference:** `docs/PRD.md` (email queue architecture, admin email queue management)
- **TDD Reference:** `docs/TDD.md` (EmailQueue schema, background processor, Resend integration)
