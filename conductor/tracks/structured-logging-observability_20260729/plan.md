<protect>
# Implementation Plan: TRACK-040 — Structured Logging & Observability

## Phase 1: Logger Setup

- [x] Task: Read spec.md and workflow.md to load context for this phase
    - [x] Read `conductor/tracks/structured-logging-observability_20260729/spec.md`
    - [x] Read `conductor/workflow.md` (TDD lifecycle, commit format, checkpoint protocol)

- [x] Task: Install pino + pino-pretty and add LOG_LEVEL to env.ts
    - [x] Run `pnpm add pino` (production dependency — server-side only)
    - [x] Run `pnpm add -D pino-pretty` (devDependency — dev-only pretty-printer)
    - [x] Add `LOG_LEVEL: z.string().default('info')` to `src/config/env.ts` envSchema
    - [x] Add `LOG_LEVEL=info` to `.env.example` with comment

- [x] Task: Write failing unit tests for logger.ts (Red Phase)
    - [x] Create `tests/unit/lib/logger.test.ts` with `/** @vitest-environment node */`
    - [x] Test: logger outputs JSON in production mode (`import.meta.env.PROD = true`) — assert `JSON.parse(output)` has `level`, `time`, `pid`, `msg` fields
    - [x] Test: logger uses pino-pretty in dev mode (`import.meta.env.PROD = false`) — assert output is human-readable (not raw JSON)
    - [x] Test: `LOG_LEVEL` env var respected — `LOG_LEVEL=debug` allows debug messages, `LOG_LEVEL=error` suppresses info messages
    - [x] Test: `logger.info`/`logger.error`/`logger.warn` methods exist and are callable
    - [x] Run `pnpm test` and confirm the new tests fail as expected

- [x] Task: Implement logger.ts (Green Phase)
    - [x] Create `src/lib/logger.ts` — singleton pino instance
    - [x] Configure: `import.meta.env.PROD` → JSON to stdout; dev → `pino-pretty` transport to stdout
    - [x] Use `getEnv().LOG_LEVEL` for log level (default `info`)
    - [x] Export `logger` instance and `Logger` type
    - [x] Run `pnpm test` and confirm all tests now pass

- [x] Task: Verify coverage & quality gates
    - [x] Run `pnpm test:coverage` — confirm ≥80% on lines, statements, branches, functions
    - [x] Run `pnpm typecheck` — clean
    - [x] Run `pnpm lint` — clean
    - [x] Confirm `src/lib/logger.ts` is under 500 lines
    - [x] Run `pnpm check:i18n` — clean (no i18n changes expected)

- [x] Task: Commit code changes & attach git note (e279d8e)
    - [x] Stage `package.json`, `pnpm-lock.yaml`, `src/config/env.ts`, `src/lib/logger.ts`, `tests/unit/lib/logger.test.ts`, `.env.example`
    - [x] Commit: `feat(logging): Add pino structured logger with env-based config`
    - [x] Attach git note with task summary to the commit hash

- [x] Task: Conductor - User Manual Verification 'Logger Setup' (Protocol in workflow.md)

[checkpoint: 66b7b28]

## Phase 2: logError() Migration

- [x] Task: Read spec.md and workflow.md to load context for this phase
    - [x] Read `conductor/tracks/structured-logging-observability_20260729/spec.md`
    - [x] Read `conductor/workflow.md` (TDD lifecycle, commit format, checkpoint protocol)

- [x] Task: Write failing unit tests for refactored logError() (Red Phase)
    - [x] Check if `tests/unit/lib/errors.test.ts` exists; create or update it with `/** @vitest-environment node */`
    - [x] Mock `@/lib/logger` — `vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }))`
    - [x] Test: `logError()` calls `logger.error` (not `console.error`) — assert `logger.error` was called
    - [x] Test: entry object shape preserved — assert `logger.error` called with object containing `timestamp`, `code`, `message` fields
    - [x] Test: optional fields included when provided — `cause`, `userId`, `handler`, `stack`, `input`
    - [x] Test: `sanitizeInput()` still redacts sensitive keys — pass `{ password: 'secret' }` as input, assert `logger.error` called with `input.password === '[REDACTED]'`
    - [x] Test: `serverError()` calls `logError()` and returns `{ error: { code, message } }` — no behavioral change
    - [x] Run `pnpm test` and confirm tests fail as expected (existing console.error assertions break)

- [x] Task: Refactor logError() to use pino (Green Phase)
    - [x] Import `logger` from `@/lib/logger` in `src/lib/errors.ts`
    - [x] Replace `console.error(JSON.stringify(entry))` (production, line 116) and `console.error(lines.join('\n'))` (dev, line 142) with `logger.error(entry)`
    - [x] Remove the `import.meta.env.PROD` branching (lines 115-142) — pino handles format via transport config
    - [x] Remove the `lines` array construction (dev-mode pretty printing) — no longer needed
    - [x] Preserve `entry` object construction (lines 89-113) — `timestamp`, `code`, `message`, `cause`, `userId`, `handler`, `stack`, `input`
    - [x] Preserve `sanitizeInput()` call for input redaction
    - [x] Run `pnpm test` and confirm all tests now pass
    - [x] Fix 3 downstream test files: `sla-integration.test.ts` (add LOG_LEVEL to env mock), `two-factor.test.ts` (add @/lib/logger mock), `error-boundary.test.tsx` (mock @/lib/logger, assert logger.error instead of console.error)

- [x] Task: Verify coverage & quality gates
    - [x] Run `pnpm test:coverage` — confirm ≥80% on all four metrics
    - [x] Run `pnpm typecheck` — clean
    - [x] Run `pnpm lint` — clean
    - [x] Confirm `src/lib/errors.ts` is under 500 lines (should decrease — removing dev-mode branching)
    - [x] Run `pnpm check:i18n` — clean

- [x] Task: Commit code changes & attach git note (3560064a)
    - [x] Stage `src/lib/errors.ts`, `tests/unit/errors.test.ts`
    - [x] Commit: `refactor(logging): Route logError() through pino instead of console.error`
    - [x] Attach git note with task summary to the commit hash

- [x] Task: Conductor - User Manual Verification 'logError() Migration' (Protocol in workflow.md)

[checkpoint: 643f1c7a]

## Phase 3: Request ID Middleware

- [x] Task: Read spec.md and workflow.md to load context for this phase
    - [x] Read `conductor/tracks/structured-logging-observability_20260729/spec.md`
    - [x] Read `conductor/workflow.md` (TDD lifecycle, commit format, checkpoint protocol)

- [x] Task: Write failing unit tests for request ID middleware (Red Phase)
    - [x] Create `tests/unit/lib/request-context.test.ts` with `/** @vitest-environment node */`
    - [x] Mock `@tanstack/react-start` for `createMiddleware` if needed (or test helper functions directly)
    - [x] Test: middleware reads `x-request-id` header when present — returns existing UUID
    - [x] Test: middleware generates UUID via `crypto.randomUUID()` when header absent — returns valid UUID format
    - [x] Test: `createRequestLogger(context)` creates `logger.child({ requestId })` — assert child logger has `requestId` in bindings
    - [x] Run `pnpm test` and confirm the new tests fail as expected

- [x] Task: Implement request ID middleware (Green Phase)
    - [x] Create `src/lib/request-context.ts` with TanStack Start `createMiddleware`
    - [x] Implement: read `x-request-id` header from request; if absent, generate via `crypto.randomUUID()`
    - [x] Store `requestId` in middleware context
    - [x] Implement `createRequestLogger(context)` helper — returns `logger.child({ requestId })`
    - [x] Export `requestIdMiddleware` and `createRequestLogger`
    - [x] Run `pnpm test` and confirm all tests now pass

- [x] Task: Verify coverage & quality gates
    - [x] Run `pnpm test:coverage` — confirm ≥80% on all four metrics
    - [x] Run `pnpm typecheck` — clean
    - [x] Run `pnpm lint` — clean
    - [x] Confirm `src/lib/request-context.ts` is under 500 lines
    - [x] Run `pnpm check:i18n` — clean

- [x] Task: Commit code changes & attach git note (1c44f407)
    - [x] Stage `src/lib/request-context.ts`, `tests/unit/lib/request-context.test.ts`
    - [x] Commit: `feat(logging): Add request ID middleware for request tracing`
    - [x] Attach git note with task summary to the commit hash

- [x] Task: Conductor - User Manual Verification 'Request ID Middleware' (Protocol in workflow.md)

[checkpoint: 3d8c37a4]

## Phase 4: Full console.* Migration (remaining calls across 22 files — errors.ts handled in Phase 2)

- [x] Task: Read spec.md and workflow.md to load context for this phase
    - [x] Read `conductor/tracks/structured-logging-observability_20260729/spec.md`
    - [x] Read `conductor/workflow.md` (TDD lifecycle, commit format, checkpoint protocol)

- [x] Task: Migrate console.* calls in src/lib/ background job files (structured pattern)
    - [x] `email-queue-init.ts` — replace `console.*({ event: '...' })` with `logger.*({ event: '...' })`; add `requestId: crypto.randomUUID()` at tick start
    - [x] `email-queue-processor.ts` — replace `console.*({ event: '...' })` with `logger.*({ event: '...' })`; propagate requestId from tick caller
    - [x] `deadline-reminder-scanner.ts` — replace `console.*({ event: '...' })` with `logger.*({ event: '...' })`; add `requestId: crypto.randomUUID()` at scanner start

- [x] Task: Migrate console.* calls in src/lib/ advisory & email files (unstructured pattern)
    - [x] `risk-alerts.ts` — `console.error('Failed to ...', err)` → `logger.error({ event: 'advisory_failed', handler: 'checkAndFireRiskAlert', error: err instanceof Error ? err.message : String(err) })`
    - [x] `review-risk-alert.ts` — same unstructured pattern
    - [x] `review-sla.ts` — same unstructured pattern
    - [x] `consultation-email.ts` — same unstructured pattern
    - [x] `extension-email.ts` (3 calls) — same unstructured pattern
    - [x] `event-email.ts` — same unstructured pattern
    - [x] `audit.ts` — `safeAuditLog` catch block; same unstructured pattern
    - [x] `r2-cleanup.ts` — same unstructured pattern

- [x] Task: Migrate console.* calls in src/server/ handler files (unstructured advisory pattern)
    - [x] `consultations.server.ts` (2 calls)
    - [x] `assignments.server.ts` (1 call)
    - [x] `extensions-extras.server.ts` (4 calls)
    - [x] `bulk-import.server.ts` (2 calls)
    - [x] `discussions.server.ts` (1 call)
    - [x] `gradebook.server.ts` (1 call)
    - [x] `reviews-extras.server.ts` (1 call)
    - [x] `reviews.server.ts` (2 calls)
    - [x] `submissions.server.ts` (1 call)
    - [x] `two-factor.server.ts` (3 calls)
    - [x] `users.server.ts` (3 calls)

- [x] Task: Update existing tests that assert console.error calls
    - [x] Grep `tests/unit/` for `console.error` assertions — `rg "console\.error" tests/unit/`
    - [x] For each test that asserts `console.error` was called: add `vi.mock('@/lib/logger', ...)` and assert `logger.error` instead
    - [x] Run `pnpm test` and confirm all tests pass with updated mocks

- [x] Task: Grep verification — zero console.* in src/lib/ and src/server/
    - [x] Run `rg "console\.(log|error|warn|info)" src/lib/ src/server/ --glob "!src/db/seed.ts" --glob "!src/db/migrate.ts"` — expect ZERO matches
    - [x] Confirm `console.*` calls remain only in `src/db/seed.ts`, `src/db/migrate.ts`, and `scripts/` (excluded from scope)

- [x] Task: Verify coverage & quality gates
    - [x] Run `pnpm test:coverage` — confirm ≥80% on all four metrics
    - [x] Run `pnpm typecheck` — clean
    - [x] Run `pnpm lint` — clean
    - [x] Run `pnpm check:i18n` — clean
    - [x] Confirm all modified files are under 500 lines

- [x] Task: Update documentation
    - [x] Update `conductor/tech-stack.md` changelog — add pino + pino-pretty entries with date
    - [x] Update `docs/roadmap.md` TRACK-040 status from `Planned` to `✅ Complete` with key decisions summary

- [x] Task: Commit code changes & attach git note (48b1945b)
    - [x] Stage all modified `src/lib/`, `src/server/`, `tests/unit/`, `conductor/tech-stack.md`, `docs/roadmap.md` files
    - [x] Commit: `refactor(logging): Migrate all console.* calls to pino structured logger`
    - [x] Attach git note with task summary to the commit hash

- [x] Task: Conductor - User Manual Verification 'Full console.* Migration' (Protocol in workflow.md)

[checkpoint: 3b02f99e]

## Phase: Review Fixes
- [x] Task: Apply review suggestions 7708d54f
</protect>
