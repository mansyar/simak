# TRACK-039: Orphaned R2 Object Cleanup — Implementation Plan

## Phase 1: Schema Migration & Cleanup Scanner Core

- [ ] Task: Add `cleanedUpAt` column to `uploadIntents` schema
    - [ ] Add nullable `cleanedUpAt: timestamp('cleaned_up_at')` to `uploadIntents` in `src/db/schema/submissions.ts`
    - [ ] Generate migration via `pnpm db:generate`
    - [ ] Verify migration file created in `drizzle/` directory

- [ ] Task: Write failing tests for `processOrphanedR2Objects()` (Red Phase)
    - [ ] Create `tests/unit/lib/r2-cleanup.test.ts` with `/** @vitest-environment node */` header
    - [ ] Mock `@/lib/storage` (getR2Client, getBucketName) and `@/db/index` (getDb)
    - [ ] Test: orphaned intents queried with WHERE clause `consumedAt IS NULL AND expiresAt < now() AND cleanedUpAt IS NULL` with `LIMIT 50`
    - [ ] Test: R2 objects deleted via `DeleteObjectCommand` with correct Bucket and Key
    - [ ] Test: `cleanedUpAt` set to `now()` on successful R2 delete
    - [ ] Test: `cleanedUpAt` NOT set (remains null) on R2 delete failure
    - [ ] Test: R2 not configured (`getR2Client()` returns null) → no-op, returns `{ deleted: 0, failed: 0, batchSize: 0 }`
    - [ ] Test: `Promise.allSettled` per-object failure isolation (one failure doesn't block others)
    - [ ] Test: `safeAuditLog` called with `actorId: 'system'`, action `r2.cleanup`, details `{ deleted, failed, batchSize }`
    - [ ] Test: returns summary `{ deleted, failed, batchSize }` with correct counts
    - [ ] Run `pnpm test` and confirm tests fail as expected

- [ ] Task: Implement `processOrphanedR2Objects()` in `src/lib/r2-cleanup.ts` (Green Phase)
    - [ ] Create `src/lib/r2-cleanup.ts`
    - [ ] Import `DeleteObjectCommand` from `@aws-sdk/client-s3`
    - [ ] Import `getR2Client`, `getBucketName` from `@/lib/storage`
    - [ ] Import `safeAuditLog` from `@/lib/audit`
    - [ ] Import `getDb` and `uploadIntents` schema
    - [ ] Implement orphan query: `SELECT id, fileKey FROM uploadIntents WHERE consumedAt IS NULL AND expiresAt < now() AND cleanedUpAt IS NULL LIMIT 50`
    - [ ] Implement parallel R2 deletes via `Promise.allSettled`
    - [ ] On success: `UPDATE uploadIntents SET cleanedUpAt = now() WHERE id = ...`
    - [ ] On failure: log structured object `{ event: 'r2_cleanup_failed', fileKey, error: err.message }` via `console.error`
    - [ ] Call `safeAuditLog` with `actorId: 'system'` after batch completes
    - [ ] Return summary `{ deleted, failed, batchSize }`
    - [ ] Run `pnpm test` and confirm all tests pass

- [ ] Task: Integrate scanner into email-queue tick loop
    - [ ] Add `let lastR2CleanupAt: Date | null = null` throttle variable in `src/lib/email-queue-init.ts`
    - [ ] Add throttle check (6h interval) in `tick()` before calling scanner
    - [ ] Call `processOrphanedR2Objects()` from `tick()` wrapped in `try/catch` (email processing continues on scanner failure)
    - [ ] Log scanner errors via structured object `{ event: 'r2_cleanup_scanner_failed', error: err.message }`
    - [ ] Run `pnpm test` and confirm all tests still pass

- [ ] Task: Verify quality gates for Phase 1
    - [ ] Run `pnpm test:coverage` — confirm ≥80% on all thresholds
    - [ ] Run `pnpm typecheck` — confirm clean
    - [ ] Run `pnpm lint` — confirm clean
    - [ ] Confirm all files under 500 lines (`node scripts/check-modularity.js`)

- [ ] Task: Commit Phase 1 changes
    - [ ] Stage all code + migration files
    - [ ] Commit with message `chore(r2-cleanup): Add orphaned R2 object cleanup scanner with tick loop integration`
    - [ ] Attach git note with task summary

- [ ] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)

## Phase 2: Manual Admin Trigger & UI

- [ ] Task: Write failing tests for `triggerR2Cleanup()` server function (Red Phase)
    - [ ] Create `tests/unit/server/r2-cleanup.test.ts` with `/** @vitest-environment node */` header
    - [ ] Mock `@tanstack/react-start` (builder chain), `@/server/auth`, `@/db/index`, `@/lib/storage`, `@/lib/audit`
    - [ ] Test: admin user → triggers `processOrphanedR2Objects()` directly (no throttle), returns summary
    - [ ] Test: instructor user → rejected by `isAdmin` guard
    - [ ] Test: student user → rejected by `isAdmin` guard
    - [ ] Test: `safeAuditLog` called with admin's `userId` as `actorId`
    - [ ] Run `pnpm test` and confirm tests fail as expected

- [ ] Task: Implement `triggerR2Cleanup()` server function (Green Phase)
    - [ ] Create `src/server/r2-cleanup.ts` (stub with `typedServerFn` + Zod input schema)
    - [ ] Create `src/server/r2-cleanup.server.ts` (handler with `isAdmin` guard via `getSessionFromHeaders`)
    - [ ] Handler calls `processOrphanedR2Objects()` directly (bypasses throttle)
    - [ ] Handler calls `safeAuditLog` with admin's `userId` as `actorId`
    - [ ] Returns summary `{ deleted, failed, batchSize }`
    - [ ] Run `pnpm test` and confirm all tests pass

- [ ] Task: Add i18n keys for admin UI
    - [ ] Add keys to `locales/en.json`: `adminEmailQueue.r2Cleanup.trigger`, `adminEmailQueue.r2Cleanup.success`, `adminEmailQueue.r2Cleanup.error`
    - [ ] Add same keys to `locales/id.json` with Indonesian translations
    - [ ] Run `pnpm generate:i18n` to regenerate types
    - [ ] Run `pnpm check:i18n` to verify parity

- [ ] Task: Write failing test for admin UI trigger button (Red Phase)
    - [ ] Create/update `tests/unit/routes/admin/email-queue.test.tsx` (or existing test file for that route)
    - [ ] Test: "Trigger R2 Cleanup" button renders on `/admin/email-queue` page
    - [ ] Test: button click calls `triggerR2Cleanup()` and shows success toast with summary
    - [ ] Run `pnpm test` and confirm tests fail as expected

- [ ] Task: Implement admin UI trigger button (Green Phase)
    - [ ] Add "Trigger R2 Cleanup" button to `/admin/email-queue` route component
    - [ ] Wire to `triggerR2Cleanup()` via `useMutation` (or `useServerFn` pattern matching existing page style)
    - [ ] Show success toast with i18n-interpolated summary on success
    - [ ] Show error toast on failure
    - [ ] Run `pnpm test` and confirm all tests pass

- [ ] Task: Verify quality gates for Phase 2
    - [ ] Run `pnpm test:coverage` — confirm ≥80% on all thresholds
    - [ ] Run `pnpm typecheck` — confirm clean
    - [ ] Run `pnpm lint` — confirm clean (including `simak-i18n/no-hardcoded`)
    - [ ] Run `pnpm check:i18n` — confirm parity, no unused keys
    - [ ] Confirm all files under 500 lines (`node scripts/check-modularity.js`)

- [ ] Task: Commit Phase 2 changes
    - [ ] Stage all code + i18n files
    - [ ] Commit with message `feat(r2-cleanup): Add manual admin trigger with UI button on email queue page`
    - [ ] Attach git note with task summary

- [ ] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)
