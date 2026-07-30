# TRACK-045: Graceful Shutdown & Background Processor Drain

## Overview

**Track ID:** TRACK-045
**Type:** Bug Fix
**Milestone:** 12 — Security, Reliability & Real-Time Infrastructure
**Dependencies:** None

This track eliminates a data-integrity risk in the background processor subsystem. Currently, 4 background jobs (email queue, deadline reminders, R2 cleanup, email retention) run inside a single `tick()` on a 30-second `setInterval` in `src/lib/email-queue-init.ts`. There is no SIGTERM/SIGINT handler, no drain logic, and no DB pool closure. On deployment or container restart, the process is abruptly killed — interrupting in-flight `Promise.allSettled` email batches (up to 5 concurrent Resend API calls) and leaving `email_queue` rows stuck in `processing` status.

## Problem Statement

**Current state (verified by reading source):**

1. **No signal handlers** — `src/router.tsx` starts the email queue via dynamic import on `import.meta.env.SSR`, but no `SIGTERM`/`SIGINT` handler is registered anywhere. Coolify/Traefik sends `SIGTERM` before force-killing the container.

2. **`stopEmailQueue()` is dead code** — The function exists at `email-queue-init.ts:88` and only clears the `setInterval`. It is never called from production code (only in tests). It does not await an in-flight `tick()`.

3. **In-flight tick interrupted on kill** — `tick()` runs 4 jobs sequentially. `processEmailQueue()` sends emails in chunks of 5 via `Promise.allSettled`. An abrupt `SIGKILL` (sent ~10s after `SIGTERM` by default container runtimes) interrupts these network calls mid-flight, leaving queue rows stuck in `processing`.

4. **Stale-row reclaim only inside `tick()`** — `processEmailQueue()` reclaims `processing` rows older than 5 minutes (`STALE_PROCESSING_THRESHOLD_MS`), but this runs *inside* `tick()`. On restart, the first `tick()` runs immediately, but if the reclaim threshold hasn't elapsed, stuck rows remain in `processing` for up to 5 minutes before being reclaimed. Since a fresh process start means no instance could possibly be processing them, all `processing` rows should be reclaimed immediately.

5. **No DB pool closure** — `getDb()` in `src/db/index.ts` creates a `postgres()` client as a local variable (line 16) and stores only the drizzle wrapper (`_db`). The raw client is not retained. There is no `closeDb()` function. On shutdown, the pool connections are not gracefully closed — they're severed by the OS, potentially leaving prepared transactions or connection state in an unclean state.

## Root Cause Analysis

The background processor was built as a fire-and-forget `setInterval` loop (Track: Background Email Queue with Retry). At the time, graceful shutdown was not considered because the system was new and deploys were infrequent. As the system matured (more tracks, more frequent deploys, Coolify auto-deploy on push), the lack of signal handling became a real data-integrity risk. The `stopEmailQueue()` function was added as a stub but never wired to a signal handler.

## Functional Requirements

### FR-1: SIGTERM/SIGINT handler with graceful drain

- A new `src/lib/shutdown.ts` module registers `SIGTERM` and `SIGINT` handlers, guarded by `import.meta.env.SSR`.
- On first signal: clear the `setInterval`, await the in-flight `tick()` if one is running (drain), then close the DB pool via `closeDb()`, then `process.exit(0)`.
- On second signal (any): immediately `process.exit(1)` with a warning log. This is the standard Kubernetes/Docker pattern for force-killing a stuck process.
- A configurable timeout (`SHUTDOWN_TIMEOUT_MS`, default 10000ms) guards the drain. If the in-flight `tick()` doesn't complete within the timeout, log a warning and `process.exit(1)`.

### FR-2: Async `stopGracefully()` replacing `stopEmailQueue()`

- Convert `stopEmailQueue()` (sync, only clears interval) to `stopGracefully()` (async, clears interval + awaits in-flight tick).
- Track the current `tick()` promise in a module-level variable so `stopGracefully()` can await it.
- The `tick()` function's existing error handling (try/catch with logger) ensures the promise never rejects — `stopGracefully()` does not need its own catch.

### FR-3: `closeDb()` for DB pool closure

- Store the raw `postgres()` client in a module-level variable alongside `_db` in `src/db/index.ts`.
- Export `closeDb()` that calls `client.end()` if the client exists, and resets `_db` + the client to `null`.
- Safe to call when `getDb()` has never been called (no-op).

### FR-4: Immediate startup stale-row reclaim

- Add a `reclaimAllProcessingRows()` function to `src/lib/email-queue-processor.ts` that resets ALL rows with `status = 'processing'` back to `pending` (no time threshold — a fresh process start means no instance could be processing them).
- Call `reclaimAllProcessingRows()` in `startEmailQueue()` before the first `tick()`, so stuck rows are reclaimed before any new processing begins.
- Log the reclaimed count via the existing pino logger.
- The existing 5-minute threshold reclaim inside `processEmailQueue()` stays unchanged for mid-runtime stuck-row detection.

### FR-5: `SHUTDOWN_TIMEOUT_MS` environment variable

- Add `SHUTDOWN_TIMEOUT_MS` to the Zod env schema in `src/config/env.ts` as `z.coerce.number().int().positive().default(10000)`.
- Add to `.env.example`.

### FR-6: Wire shutdown handler in `src/router.tsx`

- Alongside the existing `startEmailQueue()` dynamic import, register the shutdown handlers via `registerShutdownHandlers()` from `src/lib/shutdown.ts`.
- Both are guarded by `import.meta.env.SSR`.

## Non-Functional Requirements

### NFR-1: Testing

Unit tests for all new and modified functions:

- `shutdown.ts`: first signal triggers drain, second signal forces exit, timeout forces exit, successful drain exits 0
- `stopGracefully()`: clears interval, awaits in-flight tick, no-op if not started
- `closeDb()`: calls `client.end()`, no-op if never initialized
- `reclaimAllProcessingRows()`: updates all processing rows, logs count
- Tests follow the existing mock patterns (`vi.mock` for `@/db/index`, `@/lib/logger`, etc.)
- Server-handler tests use `/** @vitest-environment node */` where needed
- Coverage >= 80% for all new code

### NFR-2: No i18n impact

This track is infrastructure-only with no user-facing UI changes. No new i18n keys needed.

### NFR-3: Logging

Use the existing pino logger (`src/lib/logger.ts`) for all log lines. Structured events: `shutdown.start`, `shutdown.draining_tick`, `shutdown.complete`, `shutdown.timeout`, `shutdown.force_exit`, `shutdown.error`, `email_queue.startup_reclaimed`.

### NFR-4: File size compliance

All new/modified files must stay under the 500-line limit enforced by `scripts/check-modularity.js`.

### NFR-5: Lint and typecheck clean

`pnpm typecheck` and `pnpm lint` must pass with no new errors.

## Acceptance Criteria (Definition of Done)

1. `SIGTERM` triggers graceful drain: `setInterval` cleared, in-flight `tick()` awaited, DB pool closed, `process.exit(0)`
2. `SIGINT` triggers the same graceful drain as `SIGTERM`
3. A second signal during drain immediately calls `process.exit(1)` with a warning log
4. If drain doesn't complete within `SHUTDOWN_TIMEOUT_MS` (default 10s), `process.exit(1)` with a warning log
5. `stopEmailQueue()` is replaced by async `stopGracefully()` — no references to the old function remain in production code
6. `closeDb()` closes the postgres.js connection pool and resets the singleton
7. `reclaimAllProcessingRows()` resets ALL `processing` rows to `pending` on startup before the first `tick()`
8. `SHUTDOWN_TIMEOUT_MS` env var is Zod-validated with default 10000
9. Shutdown handlers are registered in `src/router.tsx` alongside `startEmailQueue()` (both SSR-guarded)
10. All unit tests pass (`pnpm test`)
11. `pnpm typecheck` clean
12. `pnpm lint` clean
13. Coverage >= 80% for new code

## Out of Scope

- **Better Auth session cleanup on shutdown** — Better Auth manages its own session lifecycle; explicit session cleanup on shutdown is not needed (sessions are persisted in the DB and remain valid across restarts).
- **Graceful HTTP server shutdown** — TanStack Start's built-in server handles HTTP connection draining. This track focuses on the background processor and DB pool only.
- **Health check endpoint** — A `/health` or `/ready` endpoint for container orchestration is a separate concern (potential future track).
- **Changing the 4 background job intervals** — The 30s/1h/6h/24h intervals are not being modified.
- **Process-wide unhandled rejection handler** — Out of scope; the focus is on signal-based graceful shutdown.

## File Scope

| File | Action | Description |
|------|--------|-------------|
| `src/lib/shutdown.ts` | **New** | `registerShutdownHandlers()` — SIGTERM/SIGINT handlers, drain logic, timeout guard |
| `src/lib/email-queue-init.ts` | Modify | Add `reclaimAllProcessingRows()` call before first tick; convert `stopEmailQueue()` to async `stopGracefully()`; track tick promise |
| `src/lib/email-queue-processor.ts` | Modify | Add `reclaimAllProcessingRows()` export (reclaim all `processing` rows, no threshold) |
| `src/db/index.ts` | Modify | Store raw client; add `closeDb()` export |
| `src/router.tsx` | Modify | Wire `registerShutdownHandlers()` alongside `startEmailQueue()` |
| `src/config/env.ts` | Modify | Add `SHUTDOWN_TIMEOUT_MS` to Zod schema |
| `.env.example` | Modify | Document `SHUTDOWN_TIMEOUT_MS` |
