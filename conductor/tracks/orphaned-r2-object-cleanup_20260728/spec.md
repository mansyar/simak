<protect>
# TRACK-039: Orphaned R2 Object Cleanup

## Overview

When students upload files to Cloudflare R2 via presigned URLs, an `upload_intents` row is created. If the student never completes the submission (e.g., abandons the page), the R2 object remains in storage indefinitely — an orphaned object that incurs storage costs with no reference. This track implements a periodic cleanup scanner that deletes orphaned R2 objects and marks the corresponding intent rows as cleaned up, integrated into the existing email-queue tick loop.

**Track Type:** Chore (infrastructure)
**Dependencies:** None
**Audit IDs:** None (new infrastructure — addresses storage cost growth from orphaned R2 objects)

## Context

- The `upload_intents` table has NO `status` column — intent lifecycle is implicit via `consumedAt` (null = unconsumed, non-null = file was submitted).
- Orphaned intents = `consumedAt IS NULL AND expiresAt < now() AND cleanedUpAt IS NULL`.
- A new nullable `cleanedUpAt` timestamp column tracks cleanup without losing the audit trail.
- The scanner integrates into the existing email-queue tick loop in `src/lib/email-queue-init.ts` (same pattern as `processDeadlineReminders` from TRACK-021).
- R2 deletes use `DeleteObjectCommand` from `@aws-sdk/client-s3` (already a dependency; needs to be imported).

## Functional Requirements

### FR-1: Migration — Add `cleanedUpAt` column
- Add a nullable `cleanedUpAt` timestamp column to the `uploadIntents` table in `src/db/schema/submissions.ts`.
- Generate migration via `pnpm db:generate`.

### FR-2: Cleanup scanner (`processOrphanedR2Objects`)
- New function in a **separate file** `src/lib/r2-cleanup.ts` (not in `email-queue-init.ts`).
- Queries orphaned intents: `SELECT id, fileKey FROM uploadIntents WHERE consumedAt IS NULL AND expiresAt < now() AND cleanedUpAt IS NULL LIMIT 50`.
- For each intent: call `DeleteObjectCommand` with `getR2Client()` and `getBucketName()` from `src/lib/storage.ts`.
- On successful R2 delete: set `cleanedUpAt = now()` for that intent.
- On R2 delete failure: leave `cleanedUpAt` null (will be retried next tick).
- Use `Promise.allSettled` for parallel deletes with per-object error isolation.
- If R2 is not configured (`getR2Client()` returns null): scanner is a no-op.
- Returns a summary: `{ deleted: number, failed: number, batchSize: number }`.

### FR-3: Throttle mechanism
- In-memory `let lastR2CleanupAt: Date | null = null` variable in `email-queue-init.ts` (same pattern as `lastPruneAt` and `lastReminderScanAt`).
- Runs at most every **6 hours**.
- Resets on server restart (acceptable — same as existing throttle pattern).

### FR-4: Tick loop integration
- `processOrphanedR2Objects()` called from `tick()` in `email-queue-init.ts`.
- Wrapped in `try/catch` — email processing continues regardless of scanner failure.
- Throttle check before calling the scanner.

### FR-5: Audit logging
- Log cleanup runs via `safeAuditLog` from `src/lib/audit.ts`.
- Action: `r2.cleanup`, entity type: `upload_intent`, entity ID: `batch`.
- Details: `{ deleted, failed, batchSize }`.
- `actorId: 'system'` for background cleanup.
- Uses `safeAuditLog` (not `logAuditEvent` directly) to prevent audit failures from crashing the scanner.

### FR-6: Manual admin trigger
- Admin-only server function `triggerR2Cleanup()` with two-file split:
  - `src/server/r2-cleanup.ts` (stub with `typedServerFn`)
  - `src/server/r2-cleanup.server.ts` (handler with `isAdmin` guard)
- Calls `processOrphanedR2Objects()` directly (bypasses throttle).
- Returns summary `{ deleted, failed, batchSize }`.
- Audit logs with admin's `userId` as `actorId`.

### FR-7: Admin UI — trigger button on Email Queue page
- Add a "Trigger R2 Cleanup" button to the existing `/admin/email-queue` page.
- On click: calls `triggerR2Cleanup()` server function.
- Shows returned summary `{ deleted, failed, batchSize }` in a success toast.
- Shows error toast on failure.
- ~3-4 new i18n keys in both `locales/en.json` and `locales/id.json`.

## Non-Functional Requirements

### NFR-1: Logging approach (TRACK-040 forward-compatible)
- Use `console.error`/`console.warn` for per-object failures, but structure calls as objects: `{ event: 'r2_cleanup_failed', fileKey, error: err.message }`.
- This makes migration to `pino` (TRACK-040) trivial — just swap `console.error` → `logger.error`.
- Do NOT use string concatenation patterns like `console.error('Failed to delete', fileKey, err)`.

### NFR-2: Error isolation
- `Promise.allSettled` for parallel R2 deletes — per-object failures don't abort the batch.
- Scanner wrapped in `try/catch` in `tick()` — email processing continues regardless.
- Per-object failures logged but don't throw.

### NFR-3: File limits
- All new/modified files must stay under 500 lines.
- `r2-cleanup.ts` (scanner) and `r2-cleanup.server.ts` (handler) are separate files.

### NFR-4: Testing
- Unit tests for `processOrphanedR2Objects()` (mock R2 client + DB).
- Unit test for `triggerR2Cleanup()` (admin-only, bypasses throttle, returns summary, audit logs).
- Coverage >=80% on all thresholds.

## Acceptance Criteria

1. An upload intent with `consumedAt = NULL AND expiresAt < now()` -> after next tick (or manual trigger) -> R2 object is deleted, `cleanedUpAt` is set.
2. Consumed intents (`consumedAt IS NOT NULL`) are NOT queried by the scanner.
3. R2 not configured -> scanner is a no-op (no errors thrown).
4. R2 delete failure -> `cleanedUpAt` remains null, failure logged, will retry next tick.
5. Scanner runs at most every 6 hours (throttle respected).
6. Scanner failure does not affect email processing (try/catch isolation).
7. Audit log records cleanup action with `actorId: 'system'` for background, admin `userId` for manual trigger.
8. Admin can trigger cleanup from the Email Queue page -> sees summary in toast.
9. Non-admin users cannot trigger cleanup (isAdmin guard rejects).
10. All unit tests pass; coverage >=80%; typecheck + lint clean.

## Out of Scope

- R2 lifecycle policy configuration (bucket-level rules — separate infrastructure concern).
- Cleanup of submitted files (files attached to `submissions` are actively referenced, not orphaned).
- Cleanup of consumed-but-orphaned intents (race condition: file submitted -> submission deleted -> R2 object orphaned but `consumedAt` is set — edge case, not common).
- R2 object listing/inventory (would require `ListObjectsV2Command` — rely on `uploadIntents` as source of truth).
- Batch delete API (`DeleteObjects` multi-object delete) — use individual `DeleteObjectCommand` for simpler error tracking.
- Structured logger migration (TRACK-040 scope — this track uses `console.*` with structured object payloads for forward compatibility).
</protect>
