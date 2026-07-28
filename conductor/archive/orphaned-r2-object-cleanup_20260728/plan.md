<protect>
# TRACK-039: Orphaned R2 Object Cleanup — Implementation Plan

## Phase 1: Schema Migration & Cleanup Scanner Core [checkpoint: 65c9492]

- [x] Task: Read `spec.md` and `workflow.md` before starting Phase 1
    - [x] Read `conductor/tracks/orphaned-r2-object-cleanup_20260728/spec.md`
    - [x] Read `conductor/workflow.md`

- [x] Task: Add `cleanedUpAt` column to `uploadIntents` schema
    - [x] Add nullable `cleanedUpAt: timestamp('cleaned_up_at')` to `uploadIntents` in `src/db/schema/submissions.ts`
    - [x] Generate migration via `pnpm db:generate` (failed due to stale snapshot; manually created `0016_orphaned_r2_cleanup.sql`)
    - [x] Verify migration file created in `drizzle/` directory

- [x] Task: Write failing tests for `processOrphanedR2Objects()` (Red Phase)
    - [x] Create `tests/unit/lib/r2-cleanup.test.ts` with `/** @vitest-environment node */` header
    - [x] Mock `@/lib/storage` (getR2Client, getBucketName) and `@/db/index` (getDb)
    - [x] Test: orphaned intents queried with WHERE clause `consumedAt IS NULL AND expiresAt < now() AND cleanedUpAt IS NULL` with `LIMIT 50`
    - [x] Test: R2 objects deleted via `DeleteObjectCommand` with correct Bucket and Key
    - [x] Test: `cleanedUpAt` set to `now()` on successful R2 delete
    - [x] Test: `cleanedUpAt` NOT set (remains null) on R2 delete failure
    - [x] Test: R2 not configured (`getR2Client()` returns null) → no-op, returns `{ deleted: 0, failed: 0, batchSize: 0 }`
    - [x] Test: `Promise.allSettled` per-object failure isolation (one failure doesn't block others)
    - [x] Test: `safeAuditLog` called with `actorId: 'system'`, action `r2.cleanup`, details `{ deleted, failed, batchSize }`
    - [x] Test: returns summary `{ deleted, failed, batchSize }` with correct counts
    - [x] Run `pnpm test` and confirm tests fail as expected

- [x] Task: Implement `processOrphanedR2Objects()` in `src/lib/r2-cleanup.ts` (Green Phase)
    - [x] Create `src/lib/r2-cleanup.ts`
    - [x] Import `DeleteObjectCommand` from `@aws-sdk/client-s3`
    - [x] Import `getR2Client`, `getBucketName` from `@/lib/storage`
    - [x] Import `safeAuditLog` from `@/lib/audit`
    - [x] Import `getDb` and `uploadIntents` schema
    - [x] Implement orphan query: `SELECT fileKey FROM uploadIntents WHERE consumedAt IS NULL AND expiresAt < now() AND cleanedUpAt IS NULL LIMIT 50` (table has no `id` column; uses `fileKey` as unique identifier)
    - [x] Implement parallel R2 deletes via `Promise.allSettled`
    - [x] On success: `UPDATE uploadIntents SET cleanedUpAt = now() WHERE fileKey = ...`
    - [x] On failure: log structured object `{ event: 'r2_cleanup_failed', fileKey, error: err.message }` via `console.error`
    - [x] Call `safeAuditLog` with `actorId: 'system'` after batch completes
    - [x] Return summary `{ deleted, failed, batchSize }`
    - [x] Run `pnpm test` and confirm all tests pass (13/13 passing)

- [x] Task: Integrate scanner into email-queue tick loop
    - [x] Add `let lastR2CleanupAt: Date | null = null` throttle variable in `src/lib/email-queue-init.ts`
    - [x] Add throttle check (6h interval) in `tick()` before calling scanner
    - [x] Call `processOrphanedR2Objects()` from `tick()` wrapped in `try/catch` (email processing continues on scanner failure)
    - [x] Log scanner errors via structured object `{ event: 'r2_cleanup_scanner_failed', error: err.message }`
    - [x] Run `pnpm test` and confirm all tests still pass (17/17 passing)

- [x] Task: Verify quality gates for Phase 1
    - [x] Run `pnpm test:coverage` — confirm ≥80% on all thresholds (87.94% stmts, 81.91% branches, 83.43% funcs, 88.57% lines)
    - [x] Run `pnpm typecheck` — confirm clean
    - [x] Run `pnpm lint` — confirm clean
    - [x] Confirm all files under 500 lines (`node scripts/check-modularity.js`)

- [x] Task: Commit Phase 1 changes [4b0efd8]
    - [x] Stage all code + migration files
    - [x] Commit with message `chore(r2-cleanup): Add orphaned R2 object cleanup scanner with tick loop integration`
    - [x] Attach git note with task summary

- [x] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)

## Phase 2: Manual Admin Trigger & UI [checkpoint: 25d07a6]

- [x] Task: Read `spec.md` and `workflow.md` before starting Phase 2
    - [x] Read `conductor/tracks/orphaned-r2-object-cleanup_20260728/spec.md`
    - [x] Read `conductor/workflow.md`

- [x] Task: Write failing tests for `triggerR2Cleanup()` server function (Red Phase)
    - [x] Create `tests/unit/server/r2-cleanup.test.ts` with `/** @vitest-environment node */` header
    - [x] Mock `@tanstack/react-start` (builder chain), `@/server/auth`, `@/db/index`, `@/lib/r2-cleanup`, `@/lib/audit`
    - [x] Test: admin user → triggers `processOrphanedR2Objects()` directly (no throttle), returns summary
    - [x] Test: instructor user → rejected by `isAdmin` guard
    - [x] Test: student user → rejected by `isAdmin` guard
    - [x] Test: `safeAuditLog` called with admin's `userId` as `actorId`
    - [x] Run `pnpm test` and confirm tests fail as expected

- [x] Task: Implement `triggerR2Cleanup()` server function (Green Phase)
    - [x] Create `src/server/r2-cleanup.ts` (stub with `typedServerFn` + Zod input schema)
    - [x] Create `src/server/r2-cleanup.server.ts` (handler with `isAdmin` guard via `getSessionFromHeaders`)
    - [x] Handler calls `processOrphanedR2Objects()` directly (bypasses throttle)
    - [x] Handler calls `safeAuditLog` with admin's `userId` as `actorId`
    - [x] Returns summary `{ deleted, failed, batchSize }`
    - [x] Run `pnpm test` and confirm all tests pass (9/9 passing)

- [x] Task: Add i18n keys for admin UI
    - [x] Add keys to `locales/en.json`: `adminEmailQueue.r2Cleanup.trigger`, `adminEmailQueue.r2Cleanup.success`, `adminEmailQueue.r2Cleanup.error`
    - [x] Add same keys to `locales/id.json` with Indonesian translations
    - [x] Run `pnpm generate:i18n` to regenerate types
    - [x] Run `pnpm check:i18n` to verify parity (966=966; unused keys expected until UI implemented)

- [x] Task: Write failing test for admin UI trigger button (Red Phase)
    - [x] Create/update `tests/unit/routes/admin/email-queue.test.tsx` (or existing test file for that route)
    - [x] Test: "Trigger R2 Cleanup" button renders on `/admin/email-queue` page
    - [x] Test: button click calls `triggerR2Cleanup()` and shows success toast with summary
    - [x] Run `pnpm test` and confirm tests fail as expected

- [x] Task: Implement admin UI trigger button (Green Phase)
    - [x] Add "Trigger R2 Cleanup" button to `/admin/email-queue` route component
    - [x] Wire to `triggerR2Cleanup()` via `useMutation` (or `useServerFn` pattern matching existing page style)
    - [x] Show success toast with i18n-interpolated summary on success
    - [x] Show error toast on failure
    - [x] Run `pnpm test` and confirm all tests pass (20/20 passing)

- [x] Task: Verify quality gates for Phase 2
    - [x] Run `pnpm test:coverage` — confirm ≥80% on all thresholds (87.93% stmts, 81.92% branches, 83.4% funcs, 88.56% lines)
    - [x] Run `pnpm typecheck` — confirm clean
    - [x] Run `pnpm lint` — confirm clean (0 errors, 4 pre-existing warnings)
    - [x] Run `pnpm check:i18n` — confirm parity (966=966), no unused keys
    - [x] Confirm all files under 500 lines (`node scripts/check-modularity.js`)

- [x] Task: Commit Phase 2 changes [27dced4]
    - [x] Stage all code + i18n files
    - [x] Commit with message `feat(r2-cleanup): Add manual admin trigger with UI button on email queue page`
    - [x] Attach git note with task summary

- [x] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

## Phase: Review Fixes
- [x] Task: Apply review suggestions 7780990e
</protect>
