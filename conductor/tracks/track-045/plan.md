# Implementation Plan: TRACK-045 — Graceful Shutdown & Background Processor Drain

## Phase 1: Foundation — `closeDb()` & `SHUTDOWN_TIMEOUT_MS` env var [checkpoint: dfd33aa]

These are the building blocks that the shutdown handler depends on.

- [x] **Task 1.1: Add `SHUTDOWN_TIMEOUT_MS` env var** `28d70a6`
  - [ ] Write test verifying `SHUTDOWN_TIMEOUT_MS` defaults to 10000 and coerces from string
  - [ ] Add `SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10000)` to Zod schema in `src/config/env.ts`
  - [ ] Add `SHUTDOWN_TIMEOUT_MS=10000` to `.env.example`
  - [ ] Verify tests pass

- [x] **Task 1.2: Add `closeDb()` to `src/db/index.ts`** `dfd33aa`
  - [ ] Write tests for `closeDb()`: calls `client.end()` when client exists; no-op when `getDb()` was never called; resets `_db` and client singleton so subsequent `getDb()` creates a fresh connection
  - [ ] Implement: store raw `postgres()` client in module-level `_client` variable alongside `_db`; export `closeDb()` that calls `_client.end()`, sets `_db = null` and `_client = null`
  - [ ] Verify tests pass

- [ ] **Task: Phase Verification & Checkpoint (Refer to workflow.md)**

---

## Phase 2: Startup Stale-Row Reclaim

Eliminate the up-to-5-minute delay before stuck `processing` rows are reclaimed on restart.

- [x] **Task 2.1: Add `reclaimAllProcessingRows()` to `src/lib/email-queue-processor.ts`** (commit `4c667df7`)
  - [ ] Write tests for `reclaimAllProcessingRows()`: updates ALL `status='processing'` rows to `pending` (no time threshold); logs reclaimed count via `email_queue.startup_reclaimed` event; returns `{ reclaimed: number }`
  - [ ] Implement: `UPDATE emailQueue SET status = 'pending' WHERE status = 'processing'` — no `lt(lastAttemptAt, threshold)` condition (unlike the existing in-tick reclaim which uses 5-min threshold)
  - [ ] Verify tests pass

- [x] **Task 2.2: Wire reclaim into `startEmailQueue()`** (commit `a61b46b2`)
  - [ ] Write test verifying `reclaimAllProcessingRows()` is called before the first `tick()` when `startEmailQueue()` is called
  - [ ] Add `await reclaimAllProcessingRows()` call in `startEmailQueue()` before `tick()` (make `startEmailQueue` async, or fire-and-forget the reclaim before tick)
  - [ ] Verify tests pass (update existing `email-queue-init.test.ts` to mock `reclaimAllProcessingRows`)

- [ ] **Task: Phase Verification & Checkpoint (Refer to workflow.md)**

---

## Phase 3: Graceful Stop Conversion

Replace the sync dead-code `stopEmailQueue()` with async `stopGracefully()` that drains in-flight work.

- [x] **Task 3.1: Convert `stopEmailQueue()` to async `stopGracefully()`** (commit `71fa2af8`)
  - [ ] Write tests for `stopGracefully()`: clears the `setInterval`; awaits the in-flight `tick()` promise if one is running; is a no-op if `startEmailQueue()` was never called; the tick promise is tracked so `stopGracefully` awaits the correct in-flight tick (not a resolved promise from a skipped overlap)
  - [ ] Implement: add module-level `currentTickPromise: Promise<void> | null`; set it in `startEmailQueue()` (first tick) and in the `setInterval` callback (only when `!isRunning`); `stopGracefully()` clears interval then `await currentTickPromise` if non-null
  - [ ] Update all references in `email-queue-init.test.ts` from `stopEmailQueue` to `stopGracefully` (the existing tests call it as cleanup — update to `await stopGracefully()`)
  - [ ] Verify all tests pass

- [ ] **Task: Phase Verification & Checkpoint (Refer to workflow.md)**

---

## Phase 4: Shutdown Signal Handler

The new `src/lib/shutdown.ts` module that ties drain + DB closure + signal handling together.

- [ ] **Task 4.1: Create `src/lib/shutdown.ts`**
  - [ ] Write tests for `registerShutdownHandlers()`:
    - First `SIGTERM` triggers: `stopGracefully()` -> `closeDb()` -> `process.exit(0)`
    - First `SIGINT` triggers same drain as `SIGTERM`
    - Second signal (during drain) immediately calls `process.exit(1)` with `shutdown.force_exit` log
    - Timeout (`SHUTDOWN_TIMEOUT_MS` exceeded) calls `process.exit(1)` with `shutdown.timeout` log
    - `registerShutdownHandlers()` is a no-op when `import.meta.env.SSR` is false
    - Mock `process.on`, `process.exit`, `stopGracefully`, `closeDb` via `vi.mock`
  - [ ] Implement `registerShutdownHandlers()`:
    - Guard: `if (!import.meta.env.SSR) return;`
    - Read `SHUTDOWN_TIMEOUT_MS` from `getEnv()`
    - `isShuttingDown` flag for double-signal detection
    - On signal: set flag, log `shutdown.start`, start `setTimeout` for timeout, `await stopGracefully()`, `await closeDb()`, log `shutdown.complete`, `clearTimeout`, `process.exit(0)`
    - Second signal: log `shutdown.force_exit`, `process.exit(1)`
    - Timeout handler: log `shutdown.timeout`, `process.exit(1)`
  - [ ] Verify tests pass

- [ ] **Task 4.2: Wire `registerShutdownHandlers()` in `src/router.tsx`**
  - [ ] Add `registerShutdownHandlers()` import and call alongside `startEmailQueue()` in the `import.meta.env.SSR` block
  - [ ] Run `pnpm typecheck` to verify no type errors

- [ ] **Task: Phase Verification & Checkpoint (Refer to workflow.md)**

---

## Phase 5: Final Verification

Full-system quality gate before marking the track complete.

- [ ] **Task 5.1: Full suite verification**
  - [ ] Run `pnpm test` — all unit tests pass
  - [ ] Run `pnpm typecheck` — clean
  - [ ] Run `pnpm lint` — clean
  - [ ] Verify coverage >= 80% for new code (`src/lib/shutdown.ts`, `src/db/index.ts` `closeDb()`, `email-queue-processor.ts` `reclaimAllProcessingRows()`, `email-queue-init.ts` `stopGracefully()`)

- [ ] **Task: Phase Verification & Checkpoint (Refer to workflow.md)**
