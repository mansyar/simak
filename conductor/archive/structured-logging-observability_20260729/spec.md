<protect>
# TRACK-040: Structured Logging & Observability

## Overview

Introduce `pino` as the structured logger for SIMAK's server-side code, replacing the 43 ad-hoc `console.*` calls (38 `console.error`, 4 `console.info`, 1 `console.warn`) across 23 files in `src/lib/` and `src/server/`. The existing `logError()` function in `src/lib/errors.ts` already builds a structured `entry` object — this track routes it through pino instead of `console.error`, preserving the existing shape and `sanitizeInput()` redaction. A global TanStack Start `createMiddleware` injects a `requestId` (from `x-request-id` header or `crypto.randomUUID()`) into all server function contexts for request tracing. Background jobs (email-queue tick, R2 cleanup, deadline scanner) generate their own `requestId` via `crypto.randomUUID()` since they have no HTTP request.

This track addresses ad-hoc `console.*` logging and missing request tracing (no audit finding — proactive infrastructure). It is defined in `docs/roadmap.md` TRACK-040.

## Context Anchors (Traceability)

- **PRD Reference:** N/A (infrastructure, no product impact)
- **TDD Reference:** `docs/TDD.md` — Error handling section (typed `ServerError`, `serverError()` factory, `logError()` structured logger, `sonner` toasts, error boundary)
- **Code References:**
  - `src/lib/errors.ts` (`logError()` lines 82-143 — already builds structured `entry` object with `timestamp`, `code`, `message`, `cause`, `userId`, `handler`, `stack`, `input`; uses `import.meta.env.PROD` for env detection; production mode outputs `JSON.stringify(entry)`; dev mode outputs pretty-printed multi-line; `sanitizeInput()` redacts sensitive keys)
  - `src/config/env.ts` — Zod-validated env schema; optional vars use `.optional()` / `.default()` pattern (e.g., `EMAIL_FROM`)
  - **23 files with `console.*` calls** (43 total — 38 `console.error`, 4 `console.info`, 1 `console.warn`, 0 `console.log`):
    - `src/lib/` (12 files): `errors.ts`, `email-queue-init.ts`, `email-queue-processor.ts`, `deadline-reminder-scanner.ts`, `risk-alerts.ts`, `review-risk-alert.ts`, `review-sla.ts`, `consultation-email.ts`, `extension-email.ts`, `event-email.ts`, `audit.ts`, `r2-cleanup.ts`
    - `src/server/` (11 files): `consultations.server.ts`, `assignments.server.ts`, `extensions-extras.server.ts`, `bulk-import.server.ts`, `discussions.server.ts`, `gradebook.server.ts`, `reviews-extras.server.ts`, `reviews.server.ts`, `submissions.server.ts`, `two-factor.server.ts`, `users.server.ts`

## Architecture Decision

**Logger module:** New `src/lib/logger.ts` creates and exports a singleton `pino` logger instance. Config: JSON transport in production (`import.meta.env.PROD`), `pino-pretty` transport in dev. Log level configurable via optional `LOG_LEVEL` env var (default `info`). Server-side only — must not be imported by client code.

**`logError()` migration:** Refactor `logError()` in `src/lib/errors.ts` to use `logger.error(entry)` instead of `console.error(JSON.stringify(entry))` (production) / `console.error(lines.join('\n'))` (dev). Remove the `import.meta.env.PROD` branching — pino handles format via transport config. Preserve the `entry` object shape and `sanitizeInput()` redaction.

**Two migration patterns for `console.*` calls:**
1. **Structured calls** — `console.error({ event: '...', error: '...' })` → `logger.error({ event: '...', error: '...' })` (preserve payload shape). Found in background job files (`email-queue-init.ts`, `email-queue-processor.ts`, `deadline-reminder-scanner.ts`).
2. **Unstructured calls** — `console.error('Failed to ...', err)` → `logger.error({ event: 'advisory_failed', handler: '...', error: err instanceof Error ? err.message : String(err) })` (add structure). Found in server handler advisory blocks (`reviews.server.ts`, `consultations.server.ts`, `extensions-extras.server.ts`, etc.).

**Request ID propagation:** Global TanStack Start `createMiddleware` that reads `x-request-id` header (or generates UUID via `crypto.randomUUID()`), stores in middleware context. A `createRequestLogger()` helper creates `logger.child({ requestId })` for server functions. Background jobs call `logger.child({ requestId: crypto.randomUUID() })` directly.

**Test strategy (hybrid):**
- **Mock pino** (`vi.mock('@/lib/logger')`) for all handler/server tests — assert `logger.info/error/warn` called with correct args. Existing tests that assert `console.error` calls switch to pino mock.
- **Real pino with captured output** for `logger.ts` config tests only — verify JSON format in production, `pino-pretty` in dev, `LOG_LEVEL` respected. Uses a custom write destination stream for assertion.

**Phase ordering (reordered from roadmap):**
- Phase 1: Logger setup → Phase 2: `logError()` migration → Phase 3: Request ID middleware → Phase 4: Full `console.*` migration.
- This establishes the request ID pattern before the bulk migration, so all 43 migrated calls can include `requestId` from the start (avoids a second pass).

## Functional Requirements

### FR-1: Logger Setup
- New `src/lib/logger.ts` — creates and exports a `pino` logger instance.
- Config: JSON transport in production (`import.meta.env.PROD` → true), `pino-pretty` transport in dev.
- Log level configurable via optional `LOG_LEVEL` env var (default `info`). Added to `src/config/env.ts` as `LOG_LEVEL: z.string().default('info')`.
- Server-side only — must not be imported by client code (no re-export from barrel files that client code imports).

### FR-2: `logError()` Migration
- Refactor `logError()` in `src/lib/errors.ts` (lines 82-143) to use `logger.error(entry)` instead of `console.error`.
- Remove the `import.meta.env.PROD` branching (lines 115-142) — pino handles JSON vs pretty automatically via transport config.
- Preserve the existing `entry` object shape: `timestamp`, `code`, `message`, `cause`, `userId`, `handler`, `stack`, `input`.
- Preserve `sanitizeInput()` redaction of sensitive keys.
- `serverError()` continues to call `logError()` then return `{ error: { code, message } }` — no behavioral change.

### FR-3: Request ID Middleware
- New TanStack Start `createMiddleware` that:
  1. Reads `x-request-id` header from the request.
  2. If absent, generates a UUID via `crypto.randomUUID()`.
  3. Stores `requestId` in the middleware context.
- New `createRequestLogger(context)` helper that creates `logger.child({ requestId })` from the middleware context.
- Background jobs (email-queue tick, R2 cleanup, deadline scanner) call `logger.child({ requestId: crypto.randomUUID() })` directly — they have no HTTP request context.

### FR-4: Full `console.*` Migration (43 calls across 23 files)
- Replace ALL `console.info`/`console.error`/`console.warn` in `src/lib/` and `src/server/` with `logger.info`/`logger.error`/`logger.warn`.
- **Pattern 1 (structured):** `console.error({ event: '...', ...payload })` → `logger.error({ event: '...', ...payload })` (preserve payload shape).
- **Pattern 2 (unstructured):** `console.error('Failed to ...', err)` → `logger.error({ event: 'advisory_failed', handler: '<handler_name>', error: err instanceof Error ? err.message : String(err) })` (add structure with `event` + `handler` fields).
- Each migrated call includes `requestId` where available (from middleware context or background job child logger).

### FR-5: Documentation
- Update `conductor/tech-stack.md` changelog with `pino` and `pino-pretty` additions.
- Update `docs/roadmap.md` TRACK-040 status from `Planned` to `Complete` with key decisions summary.

## Non-Functional Requirements

- **Performance:** Pino is the fastest Node.js logger — negligible overhead. JSON serialization in production is efficient. `pino-pretty` is dev-only (devDependency), never bundled in production.
- **Bundle safety:** `pino` is server-side only — must not appear in client bundles. The logger module is imported only by `.server.ts` files and `src/lib/` modules that are server-only. No re-export from barrel files that client code imports.
- **File limits:** `src/lib/logger.ts` and all modified files under 500 lines.
- **Env detection:** Uses `import.meta.env.PROD` (consistent with existing `logError()`), NOT `process.env.NODE_ENV`.
- **Log output:** JSON in production (`{ level, time, pid, requestId, event, ...payload }`), pretty-printed in dev. Logs go to `stdout` (Docker/Coolify captures).
- **Security:** `sanitizeInput()` continues to redact sensitive keys (`password`, `token`, `secret`, `apiKey`, `authorization`, etc.). No sensitive data in log output.

## Acceptance Criteria

- [ ] `pino` added to `package.json` dependencies; `pino-pretty` added to devDependencies.
- [ ] `src/lib/logger.ts` exists with env-based config using `import.meta.env.PROD` (not `process.env.NODE_ENV`).
- [ ] `LOG_LEVEL` added to `src/config/env.ts` as optional with default `info`.
- [ ] `logError()` in `src/lib/errors.ts` uses `logger.error(entry)` instead of `console.error` — preserves `entry` shape and `sanitizeInput()`.
- [ ] TanStack Start `createMiddleware` injects `x-request-id` (reads or generates UUID).
- [ ] `createRequestLogger()` helper creates `logger.child({ requestId })` from middleware context.
- [ ] Background jobs generate own `requestId` via `crypto.randomUUID()`.
- [ ] Zero `console.info`/`console.error`/`console.warn` in `src/lib/` and `src/server/` (grep verification — `src/db/seed.ts`, `src/db/migrate.ts`, `scripts/` excluded).
- [ ] All migrated calls preserve structured `{ event, ...payload }` shape or add structure with `event` + `handler` fields.
- [ ] `pnpm test:unit` — all tests pass. New tests for: `logger.ts` (JSON in production, pretty in dev, `LOG_LEVEL` respected), `logError()` (routes through pino, preserves `entry` object shape, `sanitizeInput()` still redacts), request ID middleware (generates UUID if header absent, passes through if present).
- [ ] Existing tests that assert `console.error` calls updated to use pino mock.
- [ ] `pnpm test:coverage` >= 80% on all thresholds.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm check:i18n` — all clean.
- [ ] `conductor/tech-stack.md` changelog updated with pino additions.
- [ ] All files under 500 lines.

## Out of Scope

- External log aggregation (Datadog, Loki, etc. — separate infrastructure concern)
- Metrics collection / Prometheus endpoint (separate future track)
- Distributed tracing (OpenTelemetry — separate future track)
- Log-based alerting (Coolify/Docker-level concern)
- `console.log`/`console.error` in `src/db/seed.ts` and `src/db/migrate.ts` (one-off deployment scripts — leave as-is)
- `console.log`/`console.error` in `scripts/` (build tooling — leave as-is)
- Client-side logging (browser console — out of scope; pino is server-side only)
</protect>
