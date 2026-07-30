<protect>
# Implementation Plan: TRACK-044 — Request ID Middleware Wiring

## Phase 1: AsyncLocalStorage Store + Request Context Middleware (FR-1, FR-2) [checkpoint: f354406]

- [x] Task: Read `spec.md` and `conductor/workflow.md` to refresh context before implementation (f354406)
- [x] Task: Write tests for `src/lib/request-context-store.ts` (TDD Red Phase) (f354406)
    - [x] Create `tests/unit/lib/request-context-store.test.ts` with `/** @vitest-environment node */` header
    - [x] Test: `requestContextStorage` is an `AsyncLocalStorage` instance
    - [x] Test: `getRequestId()` returns `undefined` when called outside a store context (no `requestContextStorage.run()`)
    - [x] Test: `getRequestId()` returns the `requestId` string when called inside `requestContextStorage.run({ requestId: 'test-id' }, () => ...)`
    - [x] Test: `getRequestId()` returns `undefined` after `requestContextStorage.run()` callback completes (context is scoped)
    - [x] Test: nested `requestContextStorage.run()` calls correctly restore the parent store after the inner run completes
    - [x] Run `pnpm test` and confirm new tests fail (`request-context-store.ts` not yet created)
- [x] Task: Implement `src/lib/request-context-store.ts` (TDD Green Phase) (f354406)
    - [x] Import `AsyncLocalStorage` from `node:async_hooks`
    - [x] Define `RequestContext` interface: `{ requestId: string }`
    - [x] Create `requestContextStorage = new AsyncLocalStorage<RequestContext>()`
    - [x] Implement `getRequestId(): string | undefined` — returns `requestContextStorage.getStore()?.requestId`
    - [x] Run `pnpm test` and confirm all `request-context-store.test.ts` tests pass
- [x] Task: Update `tests/unit/lib/request-context.test.ts` for AsyncLocalStorage wrapping (TDD Red Phase) (f354406)
    - [x] Import `requestContextStorage` from `@/lib/request-context-store` in the test file (real instance, no mock needed — `AsyncLocalStorage` works in Node.js test environment)
    - [x] Update existing test "reads x-request-id header when present and passes it to next": verify `next()` is called with `{ context: { requestId: 'existing-id-123' } }` (unchanged — regression check)
    - [x] Update existing test "generates a UUID when x-request-id header is absent": verify `next()` is called with `{ context: { requestId: <UUID> } }` (unchanged — regression check)
    - [x] New test: `requestIdMiddleware` stores `requestId` in `requestContextStorage` — within the `next()` callback, `requestContextStorage.getStore()?.requestId` equals the header value (or generated UUID)
    - [x] New test: `requestId` is NOT available in `requestContextStorage` after `next()` returns (async context is scoped to the request)
    - [x] New test: TanStack context passing preserved — `next()` is called with `{ context: { requestId } }` (both AsyncLocalStorage and context propagation work)
    - [x] Run `pnpm test` and confirm new tests fail (middleware not yet wrapping `next()` in `storage.run()`)
- [x] Task: Update `requestIdMiddleware` in `src/lib/request-context.ts` (TDD Green Phase) (f354406)
    - [x] Import `requestContextStorage` from `@/lib/request-context-store`
    - [x] Wrap `next({ context: { requestId } })` in `requestContextStorage.run({ requestId }, () => next({ context: { requestId } }))`
    - [x] Update the NOTE comment to reflect that the middleware is now wired (remove the "not yet wired" language, note it's wired via `typedServerFn` in TRACK-044)
    - [x] Run `pnpm test` and confirm all `request-context.test.ts` tests pass
- [x] Task: Conductor - User Manual Verification 'Phase 1: AsyncLocalStorage Store + Request Context Middleware' (Protocol in workflow.md) (f354406)

## Phase 2: Pino Mixin in Logger (FR-3) [checkpoint: d15de12]

- [x] Task: Read `spec.md` and `conductor/workflow.md` to refresh context before implementation (d15de12)
- [x] Task: Update `tests/unit/lib/logger.test.ts` for mixin behavior (TDD Red Phase) (d15de12)
    - [x] Import `requestContextStorage` from `@/lib/request-context-store` in the test file
    - [x] New test (production mode): mixin returns `{ requestId: 'test-id' }` when `requestContextStorage.run({ requestId: 'test-id' }, () => logger.info('msg'))` is called — verify parsed JSON log output contains `requestId: 'test-id'`
    - [x] New test (production mode): mixin returns `{}` when `requestId` is NOT in AsyncLocalStorage — verify parsed JSON log output does NOT contain a `requestId` field
    - [x] New test (production mode): child logger bindings persist alongside mixin — `logger.child({ requestId: 'bg-job-id' }).info('msg')` outside AsyncLocalStorage context produces log output with `requestId: 'bg-job-id'` (from child binding, not mixin)
    - [x] New test (production mode): when both AsyncLocalStorage and child logger have `requestId`, the mixin value does NOT override the child logger binding (or verify pino's merge behavior — document the actual behavior; pino uses the mixin value)
    - [x] Existing tests (JSON output, pretty output, LOG_LEVEL, logger methods) still pass — regression check
    - [x] Run `pnpm test` and confirm new tests fail (mixin not yet added to `createLogger()`)
- [x] Task: Add pino `mixin` to `createLogger()` in `src/lib/logger.ts` (TDD Green Phase) (d15de12)
    - [x] Import `requestContextStorage` from `@/lib/request-context-store`
    - [x] Define `mixin` function: `() => { const store = requestContextStorage.getStore(); return store ? { requestId: store.requestId } : {}; }`
    - [x] Add `mixin` to pino config in both production (`pino({ level, mixin }, stream)`) and development (`pino({ level, mixin }, prettyStream)`) code paths
    - [x] Run `pnpm test` and confirm all `logger.test.ts` tests pass
- [x] Task: Conductor - User Manual Verification 'Phase 2: Pino Mixin in Logger' (Protocol in workflow.md) (d15de12)

## Phase 3: Wire requestIdMiddleware to typedServerFn (FR-4) [checkpoint: d63bf09]

- [x] Task: Read `spec.md` and `conductor/workflow.md` to refresh context before implementation (d63bf09)
- [x] Task: Update `tests/unit/lib/server-fn.test.ts` for always-chained middleware (TDD Red Phase) (d63bf09)
    - [x] Update test "does NOT call .middleware() when rateLimit is omitted (pass-through)" → rename to "calls .middleware([requestIdMiddleware]) when rateLimit is omitted" — assert `builder.middleware` WAS called (not `not.toHaveBeenCalled()`)
    - [x] New test: `.middleware()` is called with an array containing `requestIdMiddleware` (or at least one function) when `rateLimit` is omitted — verify the middleware array includes the request ID middleware
    - [x] Update test "calls .middleware([...]) when rateLimit is provided" → verify `.middleware()` is called with an array containing BOTH `requestIdMiddleware` and the rate limit middleware (array length >= 2)
    - [x] Existing builder chain tests (typed-builder pattern, inline-parse pattern, rateLimit + builder chain, regression tests) still pass
    - [x] Run `pnpm test` and confirm new/updated tests fail (middleware not yet always-chained in `typedServerFn`)
- [x] Task: Wire `requestIdMiddleware` in `typedServerFn` (TDD Green Phase) (d63bf09)
    - [x] Import `requestIdMiddleware` from `@/lib/request-context` in `src/lib/server-fn.ts`
    - [x] Replace the `if (opts.rateLimit) { return fn.middleware([...]); } return fn;` logic with always-chain: construct `middlewares = [requestIdMiddleware]`, push `createRateLimitMiddleware(opts.rateLimit)` when `rateLimit` is provided, call `fn.middleware(middlewares)`
    - [x] Run `pnpm test` and confirm all `server-fn.test.ts` tests pass
- [x] Task: Run `pnpm test` to verify all existing tests still pass (no other test files should break — the `middleware: vi.fn().mockReturnThis()` mock from TRACK-043 handles the always-chained `.middleware()` call) (d63bf09)
    - [x] Investigated intermittent Vitest/Zod unhandled rejection: full suite passes serially with `--maxWorkers=1`; individual reported tests pass, implicating the default parallel vmThreads runner rather than track changes.
- [x] Task: Conductor - User Manual Verification 'Phase 3: Wire requestIdMiddleware to typedServerFn' (Protocol in workflow.md) (d63bf09)

## Phase 4: Documentation & Final Verification

- [x] Task: Read `spec.md` and `conductor/workflow.md` to refresh context before implementation (689395c)
- [x] Task: Document request ID middleware wiring in `conductor/tech-stack.md` (689395c)
    - [x] Add dated note (2026-07-30) documenting: `requestIdMiddleware` wired to all server functions via `typedServerFn`; `AsyncLocalStorage<{ requestId: string }>` in `src/lib/request-context-store.ts` (standalone module to avoid circular dependency between `logger.ts` and `request-context.ts`); pino `mixin` in `createLogger()` reads from AsyncLocalStorage — automatic `requestId` in all log entries within a request context (zero handler changes); `x-request-id` header propagated when provided, UUID generated when absent; background job `logger.child({ requestId })` and `createRequestLogger()` continue working (mixin returns `{}` when AsyncLocalStorage is empty); `requestIdMiddleware` runs before `createRateLimitMiddleware` (rate limit decisions logged with requestId); `createRequestLogger` retained for background jobs
- [x] Task: Run full quality gate suite (689395c)
    - [x] Run `pnpm test:coverage` — 87.97% statements, 81.02% branches, 83.37% functions, 88.63% lines
    - [x] Run `pnpm typecheck` — clean (0 errors)
    - [x] Run `pnpm lint` — clean (0 errors; 4 pre-existing warnings)
    - [x] Run `pnpm check:i18n` — EN<->ID parity verified
    - [x] Verify no file in `src/`, `tests/`, `scripts/` exceeds 500 lines (`scripts/check-modularity.js`)
    - [x] Verify no circular dependencies: `request-context-store.ts` has zero project deps; `logger.ts` imports from `request-context-store.ts` (not `request-context.ts`); `request-context.ts` imports from both `logger.ts` and `request-context-store.ts` (no cycle)
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Documentation & Final Verification' (Protocol in workflow.md)
</protect>
