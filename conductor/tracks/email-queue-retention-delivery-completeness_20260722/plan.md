# Implementation Plan: Email Queue Retention & Delivery Completeness

## Phase 1: resendMessageId Column (BUG-4)

- [ ] Task: Add `resendMessageId` column to `email_queue` schema
    - [ ] Write test verifying `resendMessageId` column exists in `email_queue` schema definition
    - [ ] Add `resendMessageId: text('resend_message_id')` nullable column to `email_queue` schema
    - [ ] Run `pnpm db:generate` to create migration
    - [ ] Create rollback file for the migration (SQL styleguide §5.1)
    - [ ] Run `pnpm db:migrate` on dev DB

- [ ] Task: Populate `resendMessageId` in processor send path
    - [ ] Write test verifying `resendMessageId` is populated from `result.data.id` on successful send
    - [ ] Write test verifying `resendMessageId` remains `null` on send failure
    - [ ] Update `email-queue-processor.ts` send path to capture `result.data.id` and UPDATE the row

- [ ] Task: Expose `resendMessageId` in admin email queue UI
    - [ ] Write test verifying `listEmailQueueHandler` SELECT includes `resendMessageId`
    - [ ] Add `resendMessageId` to `listEmailQueueHandler` SELECT query
    - [ ] Add `resendMessageId` to `EmailQueueEntry` type
    - [ ] Add i18n key for column header to both `en.json` and `id.json`
    - [ ] Run `pnpm generate:i18n`
    - [ ] Render `resendMessageId` as monospace truncated cell with `title` tooltip in `/admin/email-queue` table
    - [ ] Write test verifying monospace cell rendering and `title` tooltip

- [ ] Task: Conductor - User Manual Verification 'Phase 1: resendMessageId Column' (Protocol in workflow.md)

## Phase 2: Retention Cleanup (ENH-OPS-1 / BUG-20)

- [ ] Task: Create `pruneOldEmails` function in `email-queue-retention.ts`
    - [ ] Write test verifying `sent` rows older than 90 days are deleted
    - [ ] Write test verifying `failed` rows older than 180 days are deleted
    - [ ] Write test verifying `pending` and `processing` rows are never deleted
    - [ ] Write test verifying recently sent/failed rows (within retention window) are not deleted
    - [ ] Create `src/lib/email-queue-retention.ts` with `pruneOldEmails()` function implementing the bulk DELETE query

- [ ] Task: Wire retention trigger into `email-queue-init.ts`
    - [ ] Write test verifying `pruneOldEmails` is called when >24h since last prune
    - [ ] Write test verifying `pruneOldEmails` is NOT called when <24h since last prune
    - [ ] Write test verifying `email_queue.retention_pruned` log is emitted with deleted count (no PII)
    - [ ] Add module-level `lastPruneAt` timestamp to `email-queue-init.ts`
    - [ ] On each 30s tick, check if >24h since `lastPruneAt`; if so, invoke `pruneOldEmails()` and update `lastPruneAt`
    - [ ] Log `email_queue.retention_pruned` with deleted count

- [ ] Task: Conductor - User Manual Verification 'Phase 2: Retention Cleanup' (Protocol in workflow.md)

## Phase 3: Concurrent Batch Sends (PERF-32/33)

- [ ] Task: Refactor processor send loop to chunked `Promise.allSettled`
    - [ ] Write test verifying emails are sent in chunks of 5
    - [ ] Write test verifying partial failures don't abort the batch
    - [ ] Write test verifying all emails in batch are processed (success and failure UPDATE paths)
    - [ ] Replace sequential `for` loop with chunked `Promise.allSettled` (batches of 5) in `email-queue-processor.ts`
    - [ ] Handle each email's success/failure individually in the settled callback (same UPDATE logic as current)
    - [ ] Verify `isRunning` guard and stale-row reclaim remain unchanged

- [ ] Task: Conductor - User Manual Verification 'Phase 3: Concurrent Batch Sends' (Protocol in workflow.md)
