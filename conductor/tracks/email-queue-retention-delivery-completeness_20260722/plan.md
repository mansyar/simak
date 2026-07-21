<protect>
# Implementation Plan: Email Queue Retention & Delivery Completeness

## Phase 1: resendMessageId Column (BUG-4) [checkpoint: 4ea0aca]

- [x] Task: Read `spec.md` and `conductor/workflow.md` to establish context for Phase 1
    - [x] Read this track's `spec.md` to review all functional requirements and acceptance criteria
    - [x] Read `conductor/workflow.md` to review the TDD workflow, quality gates, and phase completion protocol

- [x] Task: Add `resendMessageId` column to `email_queue` schema [b326d3c]
    - [x] Write test verifying `resendMessageId` column exists in `email_queue` schema definition
    - [x] Add `resendMessageId: text('resend_message_id')` nullable column to `email_queue` schema
    - [x] Run `pnpm db:generate` to create migration
    - [x] Create rollback file for the migration (SQL styleguide §5.1)
    - [x] Run `pnpm db:migrate` on dev DB

- [x] Task: Populate `resendMessageId` in processor send path [413fdbe]
    - [x] Write test verifying `resendMessageId` is populated from `result.data.id` on successful send
    - [x] Write test verifying `resendMessageId` remains `null` on send failure
    - [x] Update `email-queue-processor.ts` send path to capture `result.data.id` and UPDATE the row

- [x] Task: Expose `resendMessageId` in admin email queue UI [5d5d541]
    - [x] Write test verifying `listEmailQueueHandler` SELECT includes `resendMessageId`
    - [x] Add `resendMessageId` to `listEmailQueueHandler` SELECT query
    - [x] Add `resendMessageId` to `EmailQueueEntry` type
    - [x] Add i18n key for column header to both `en.json` and `id.json`
    - [x] Run `pnpm generate:i18n`
    - [x] Render `resendMessageId` as monospace truncated cell with `title` tooltip in `/admin/email-queue` table
    - [x] Write test verifying monospace cell rendering and `title` tooltip

- [x] Task: Conductor - User Manual Verification 'Phase 1: resendMessageId Column' (Protocol in workflow.md)

## Phase 2: Retention Cleanup (ENH-OPS-1 / BUG-20) [checkpoint: a04f856]

- [x] Task: Read `spec.md` and `conductor/workflow.md` to establish context for Phase 2
    - [x] Read this track's `spec.md` to review all functional requirements and acceptance criteria
    - [x] Read `conductor/workflow.md` to review the TDD workflow, quality gates, and phase completion protocol

- [x] Task: Create `pruneOldEmails` function in `email-queue-retention.ts` [e8fae0b]
    - [x] Write test verifying `sent` rows older than 90 days are deleted
    - [x] Write test verifying `failed` rows older than 180 days are deleted
    - [x] Write test verifying `pending` and `processing` rows are never deleted
    - [x] Write test verifying recently sent/failed rows (within retention window) are not deleted
    - [x] Create `src/lib/email-queue-retention.ts` with `pruneOldEmails()` function implementing the bulk DELETE query

- [x] Task: Wire retention trigger into `email-queue-init.ts` [17a873a]
    - [x] Write test verifying `pruneOldEmails` is called when >24h since last prune
    - [x] Write test verifying `pruneOldEmails` is NOT called when <24h since last prune
    - [x] Write test verifying `email_queue.retention_pruned` log is emitted with deleted count (no PII)
    - [x] Add module-level `lastPruneAt` timestamp to `email-queue-init.ts`
    - [x] On each 30s tick, check if >24h since `lastPruneAt`; if so, invoke `pruneOldEmails()` and update `lastPruneAt`
    - [x] Log `email_queue.retention_pruned` with deleted count

- [x] Task: Conductor - User Manual Verification 'Phase 2: Retention Cleanup' (Protocol in workflow.md) [a04f856]

## Phase 3: Concurrent Batch Sends (PERF-32/33)

- [x] Task: Read `spec.md` and `conductor/workflow.md` to establish context for Phase 3
    - [x] Read this track's `spec.md` to review all functional requirements and acceptance criteria
    - [x] Read `conductor/workflow.md` to review the TDD workflow, quality gates, and phase completion protocol

- [x] Task: Refactor processor send loop to chunked `Promise.allSettled` [c8253f5]
    - [x] Write test verifying emails are sent in chunks of 5
    - [x] Write test verifying partial failures don't abort the batch
    - [x] Write test verifying all emails in batch are processed (success and failure UPDATE paths)
    - [x] Replace sequential `for` loop with chunked `Promise.allSettled` (batches of 5) in `email-queue-processor.ts`
    - [x] Handle each email's success/failure individually in the settled callback (same UPDATE logic as current)
    - [x] Verify `isRunning` guard and stale-row reclaim remain unchanged

- [x] Task: Conductor - User Manual Verification 'Phase 3: Concurrent Batch Sends' (Protocol in workflow.md) [c8253f5]
</protect>
