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

- [ ] Task: Conductor - User Manual Verification 'Logger Setup' (Protocol in workflow.md)

## Phase 2: logError() Migration

- [ ] Task: Read spec.md and workflow.md to load context for this phase
    - [ ] Read `conductor/tracks/structured-logging-observability_20260729/spec.md`
    - [ ] Read `conductor/workflow.md` (TDD lifecycle, commit format, checkpoint protocol)

- [ ] Task: Write failing unit tests for refactored logError() (Red Phase)
    - [ ] Check if `tests/unit/lib/errors.test.ts` exists; create or update it with `/** @vitest-environment node */`
    - [ ] Mock `@/lib/logger` — `vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }))`
    - [ ] Test: `logError()` calls `logger.error` (not `console.error`) — assert `logger.error` was called
    - [ ] Test: entry object shape preserved — assert `logger.error` called with object containing `timestamp`, `code`, `message` fields
    - [ ] Test: optional fields included when provided — `cause`, `userId`, `handler`, `stack`, `input`
    - [ ] Test: `sanitizeInput()` still redacts sensitive keys — pass `{ password: 'secret' }` as input, assert `logger.error` called with `input.password === '[REDACTED]'`
    - [ ] Test: `serverError()` calls `logError()` and returns `{ error: { code, message } }` — no behavioral change
    - [ ] Run `pnpm test` and confirm tests fail as expected (existing console.error assertions break)

- [ ] Task: Refactor logError() to use pino (Green Phase)
    - [ ] Import `logger` from `@/lib/logger` in `src/lib/errors.ts`
    - [ ] Replace `console.error(JSON.stringify(entry))` (production, line 116) and `console.error(lines.join('\n'))` (dev, line 142) with `logger.error(entry)`
    - [ ] Remove the `import.meta.env.PROD` branching (lines 115-142) — pino handles format via transport config
    - [ ] Remove the `lines` array construction (dev-mode pretty printing) — no longer needed
    - [ ] Preserve `entry` object construction (lines 89-113) — `timestamp`, `code`, `message`, `cause`, `userId`, `handler`, `stack`, `input`
    - [ ] Preserve `sanitizeInput()` call for input redaction
    - [ ] Run `pnpm test` and confirm all tests now pass

- [ ] Task: Verify coverage & quality gates
    - [ ] Run `pnpm test:coverage` — confirm ≥80% on all four metrics
    - [ ] Run `pnpm typecheck` — clean
    - [ ] Run `pnpm lint` — clean
    - [ ] Confirm `src/lib/errors.ts` is under 500 lines (should decrease — removing dev-mode branching)
    - [ ] Run `pnpm check:i18n` — clean

- [ ] Task: Commit code changes & attach git note
    - [ ] Stage `src/lib/errors.ts`, `tests/unit/lib/errors.test.ts`
    - [ ] Commit: `refactor(logging): Route logError() through pino instead of console.error`
    - [ ] Attach git note with task summary to the commit hash

- [ ] Task: Conductor - User Manual Verification 'logError() Migration' (Protocol in workflow.md)

## Phase 3: Request ID Middleware

- [ ] Task: Read spec.md and workflow.md to load context for this phase
    - [ ] Read `conductor/tracks/structured-logging-observability_20260729/spec.md`
    - [ ] Read `conductor/workflow.md` (TDD lifecycle, commit format, checkpoint protocol)

- [ ] Task: Write failing unit tests for request ID middleware (Red Phase)
    - [ ] Create `tests/unit/lib/request-context.test.ts` with `/** @vitest-environment node */`
    - [ ] Mock `@tanstack/react-start` for `createMiddleware` if needed (or test helper functions directly)
    - [ ] Test: middleware reads `x-request-id` header when present — returns existing UUID
    - [ ] Test: middleware generates UUID via `crypto.randomUUID()` when header absent — returns valid UUID format
    - [ ] Test: `createRequestLogger(context)` creates `logger.child({ requestId })` — assert child logger has `requestId` in bindings
    - [ ] Run `pnpm test` and confirm the new tests fail as expected

- [ ] Task: Implement request ID middleware (Green Phase)
    - [ ] Create `src/lib/request-context.ts` with TanStack Start `createMiddleware`
    - [ ] Implement: read `x-request-id` header from request; if absent, generate via `crypto.randomUUID()`
    - [ ] Store `requestId` in middleware context
    - [ ] Implement `createRequestLogger(context)` helper — returns `logger.child({ requestId })`
    - [ ] Export `requestIdMiddleware` and `createRequestLogger`
    - [ ] Run `pnpm test` and confirm all tests now pass

- [ ] Task: Verify coverage & quality gates
    - [ ] Run `pnpm test:coverage` — confirm ≥80% on all four metrics
    - [ ] Run `pnpm typecheck` — clean
    - [ ] Run `pnpm lint` — clean
    - [ ] Confirm `src/lib/request-context.ts` is under 500 lines
    - [ ] Run `pnpm check:i18n` — clean

- [ ] Task: Commit code changes & attach git note
    - [ ] Stage `src/lib/request-context.ts`, `tests/unit/lib/request-context.test.ts`
    - [ ] Commit: `feat(logging): Add request ID middleware for request tracing`
    - [ ] Attach git note with task summary to the commit hash

- [ ] Task: Conductor - User Manual Verification 'Request ID Middleware' (Protocol in workflow.md)

## Phase 4: Full console.* Migration (remaining calls across 22 files — errors.ts handled in Phase 2)

- [ ] Task: Read spec.md and workflow.md to load context for this phase
    - [ ] Read `conductor/tracks/structured-logging-observability_20260729/spec.md`
    - [ ] Read `conductor/workflow.md` (TDD lifecycle, commit format, checkpoint protocol)

- [ ] Task: Migrate console.* calls in src/lib/ background job files (structured pattern)
    - [ ] `email-queue-init.ts` — replace `console.*({ event: '...' })` with `logger.*({ event: '...' })`; add `requestId: crypto.randomUUID()` at tick start
    - [ ] `email-queue-processor.ts` — replace `console.*({ event: '...' })` with `logger.*({ event: '...' })`; propagate requestId from tick caller
    - [ ] `deadline-reminder-scanner.ts` — replace `console.*({ event: '...' })` with `logger.*({ event: '...' })`; add `requestId: crypto.randomUUID()` at scanner start

- [ ] Task: Migrate console.* calls in src/lib/ advisory & email files (unstructured pattern)
    - [ ] `risk-alerts.ts` — `console.error('Failed to ...', err)` → `logger.error({ event: 'advisory_failed', handler: 'checkAndFireRiskAlert', error: err instanceof Error ? err.message : String(err) })`
    - [ ] `review-risk-alert.ts` — same unstructured pattern
    - [ ] `review-sla.ts` — same unstructured pattern
    - [ ] `consultation-email.ts` — same unstructured pattern
    - [ ] `extension-email.ts` (3 calls) — same unstructured pattern
    - [ ] `event-email.ts` — same unstructured pattern
    - [ ] `audit.ts` — `safeAuditLog` catch block; same unstructured pattern
    - [ ] `r2-cleanup.ts` — same unstructured pattern

- [ ] Task: Migrate console.* calls in src/server/ handler files (unstructured advisory pattern)
    - [ ] `consultations.server.ts` (2 calls)
    - [ ] `assignments.server.ts` (1 call)
    - [ ] `extensions-extras.server.ts` (4 calls)
    - [ ] `bulk-import.server.ts` (2 calls)
    - [ ] `discussions.server.ts` (1 call)
    - [ ] `gradebook.server.ts` (1 call)
    - [ ] `reviews-extras.server.ts` (1 call)
    - [ ] `reviews.server.ts` (2 calls)
    - [ ] `submissions.server.ts` (1 call)
    - [ ] `two-factor.server.ts` (3 calls)
    - [ ] `users.server.ts` (3 calls)

- [ ] Task: Update existing tests that assert console.error calls
    - [ ] Grep `tests/unit/` for `console.error` assertions — `rg "console\.error" tests/unit/`
    - [ ] For each test that asserts `console.error` was called: add `vi.mock('@/lib/logger', ...)` and assert `logger.error` instead
    - [ ] Run `pnpm test` and confirm all tests pass with updated mocks

- [ ] Task: Grep verification — zero console.* in src/lib/ and src/server/
    - [ ] Run `rg "console\.(log|error|warn|info)" src/lib/ src/server/ --glob "!src/db/seed.ts" --glob "!src/db/migrate.ts"` — expect ZERO matches
    - [ ] Confirm `console.*` calls remain only in `src/db/seed.ts`, `src/db/migrate.ts`, and `scripts/` (excluded from scope)

- [ ] Task: Verify coverage & quality gates
    - [ ] Run `pnpm test:coverage` — confirm ≥80% on all four metrics
    - [ ] Run `pnpm typecheck` — clean
    - [ ] Run `pnpm lint` — clean
    - [ ] Run `pnpm check:i18n` — clean
    - [ ] Confirm all modified files are under 500 lines

- [ ] Task: Update documentation
    - [ ] Update `conductor/tech-stack.md` changelog — add pino + pino-pretty entries with date
    - [ ] Update `docs/roadmap.md` TRACK-040 status from `Planned` to `✅ Complete` with key decisions summary

- [ ] Task: Commit code changes & attach git note
    - [ ] Stage all modified `src/lib/`, `src/server/`, `tests/unit/`, `conductor/tech-stack.md`, `docs/roadmap.md` files
    - [ ] Commit: `refactor(logging): Migrate all console.* calls to pino structured logger`
    - [ ] Attach git note with task summary to the commit hash

- [ ] Task: Conductor - User Manual Verification 'Full console.* Migration' (Protocol in workflow.md)

## Phase: Review Fixes
- [ ] Task: Apply review suggestions
</protect>
