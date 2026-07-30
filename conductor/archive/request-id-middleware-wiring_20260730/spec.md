<protect>
# Specification: TRACK-044 — Request ID Middleware Wiring

## Overview

Observability completion: wire the `requestIdMiddleware` that TRACK-040 defined but left explicitly unwired, so every server function log entry carries a request-scoped `requestId` via `AsyncLocalStorage` + pino `mixin`. This enables log correlation across multiple server function calls within a single user request — without modifying any of the 100+ handler call sites.

TRACK-040 introduced pino structured logging and defined `requestIdMiddleware` + `createRequestLogger` in `src/lib/request-context.ts`, but noted: "This middleware is defined and tested but NOT yet wired to server functions." Background jobs propagate `requestId` via `logger.child({ requestId: crypto.randomUUID() })`, but server function handlers have no request-scoped tracing.

TRACK-043 established the `.middleware()` chaining pattern on `typedServerFn` (for rate limiting). TRACK-044 reuses this pattern to wire `requestIdMiddleware` to ALL server functions. The key innovation is using `AsyncLocalStorage` + pino `mixin` for automatic propagation — zero handler changes needed.

**Track Type:** Chore (infrastructure / observability)
**Milestone:** 12 — Security, Reliability & Real-Time Infrastructure
**Dependencies:** TRACK-040 (Structured Logging & Observability — provides `requestIdMiddleware` + `createRequestLogger`), TRACK-043 (Application-Level Rate Limiting — provides `.middleware()` method on `TypedBuilder`)
**Coordinate with:** TRACK-043 (complete — `.middleware()` chaining already exists; TRACK-044 builds on this pattern)
**Audit IDs:** None (completes TRACK-040)

## Problem Statement

TRACK-040 defined `requestIdMiddleware` that reads the `x-request-id` header (or generates a UUID) and passes it via TanStack context. However, this middleware was never wired to server functions — it exists as dead code. The structured logging story is incomplete:

1. **No request-scoped tracing:** Server function handlers call `logger.info(...)`, `logger.error(...)`, etc. None of these log entries include a `requestId`. Correlating log entries across multiple server function calls for a single user request (e.g., a page load that triggers `getCurrentUser` + `listInstructorAssignments` + `getAdminDashboardData`) is impossible.

2. **Background jobs work, server functions don't:** Background jobs use `createRequestLogger({ requestId: crypto.randomUUID() })` → `logger.child({ requestId })`. But server function handlers have no equivalent — they use the bare `logger` instance, which has no `requestId`.

3. **The middleware exists but is dead code:** `requestIdMiddleware` is defined and tested in `src/lib/request-context.ts`, but never chained to any server function. The NOTE in the file explicitly says: "Full integration requires extending `typedServerFn` in `src/lib/server-fn.ts` to chain `.middleware([requestIdMiddleware])`... Tracked as future work."

## Functional Requirements

### FR-1: Create `AsyncLocalStorage` store module

New file `src/lib/request-context-store.ts` containing:

1. A `RequestContext` interface: `{ requestId: string }`
2. A module-level `AsyncLocalStorage<RequestContext>` instance, exported as `requestContextStorage`
3. A `getRequestId()` helper function that reads from the store: `requestContextStorage.getStore()?.requestId` — returns `string | undefined`

**Rationale for separate file:** `request-context.ts` imports `logger` from `logger.ts`, and `logger.ts` needs to read from `requestContextStorage` (for the pino mixin). Placing the storage in either file creates a circular import (`request-context.ts` → `logger.ts` → `request-context.ts`). A standalone store module with zero dependencies breaks the cycle.

### FR-2: Update `requestIdMiddleware` to use `AsyncLocalStorage`

Update the existing `requestIdMiddleware` in `src/lib/request-context.ts` to wrap `next()` in `requestContextStorage.run()`:

```ts
import { requestContextStorage } from '@/lib/request-context-store';

export const requestIdMiddleware = createMiddleware({ type: 'request' }).server(
  async ({ next, request }) => {
    const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
    return requestContextStorage.run({ requestId }, () => next({ context: { requestId } }));
  },
);
```

Changes from current implementation:
- Import `requestContextStorage` from the new store module
- Wrap `next({ context: { requestId } })` in `requestContextStorage.run({ requestId }, () => ...)` — stores requestId in the async context for the duration of the request
- Keep the existing TanStack context passing (`next({ context: { requestId } })`) — both propagation mechanisms coexist (per design decision: context provides explicit access for middleware/handlers, AsyncLocalStorage provides automatic log enrichment via the pino mixin)
- Update the NOTE comment to reflect that the middleware is now wired

### FR-3: Add pino `mixin` to `createLogger()` in `src/lib/logger.ts`

Add a `mixin` function to the pino configuration that reads from `requestContextStorage`:

```ts
import { requestContextStorage } from '@/lib/request-context-store';

export function createLogger(options?: CreateLoggerOptions): Logger {
  // ...
  const mixin = () => {
    const store = requestContextStorage.getStore();
    return store ? { requestId: store.requestId } : {};
  };

  if (import.meta.env.PROD) {
    return pino({ level, mixin }, stream);
  }

  // Dev mode: pretty print
  const prettyStream = pretty({ colorize: true, destination: stream });
  return pino({ level, mixin }, prettyStream);
}
```

Behavior:
- When a server function request is in-flight (AsyncLocalStorage has a store): every `logger.*` call automatically includes `requestId` in the log entry — zero handler changes
- When outside a request context (background jobs, startup code, module initialization): mixin returns `{}` — no effect on log output
- Background jobs using `logger.child({ requestId })` are unaffected — child logger bindings persist alongside the mixin. When AsyncLocalStorage is empty, the mixin returns `{}`, and the child logger's `requestId` binding is included normally by pino's binding merge logic.

### FR-4: Wire `requestIdMiddleware` to all server functions via `typedServerFn`

Update `typedServerFn` in `src/lib/server-fn.ts` to always chain `requestIdMiddleware`:

```ts
import { requestIdMiddleware } from '@/lib/request-context';

export function typedServerFn(opts: {
  method: 'GET' | 'POST';
  rateLimit?: RateLimitConfig;
}): TypedBuilder {
  const fn = createServerFn({ method: opts.method }) as unknown as TypedBuilder;

  const middlewares = [requestIdMiddleware];
  if (opts.rateLimit) {
    middlewares.push(createRateLimitMiddleware(opts.rateLimit));
  }

  return fn.middleware(middlewares);
}
```

Changes from current implementation:
- Import `requestIdMiddleware` from `@/lib/request-context`
- Always call `fn.middleware(middlewares)` — `requestIdMiddleware` is always first in the array
- When `rateLimit` is provided, `createRateLimitMiddleware(opts.rateLimit)` is appended after `requestIdMiddleware` — ensures rate limit decisions (including `RATE_LIMITED` short-circuits) are logged with `requestId` via the AsyncLocalStorage context
- The `.middleware()` method on `TypedBuilder` was already added by TRACK-043 — no interface changes needed

**Breaking change to TRACK-043 test:** The test `it('does NOT call .middleware() when rateLimit is omitted (pass-through)')` in `server-fn.test.ts` will fail — `.middleware()` is now ALWAYS called. This test must be updated to assert that `.middleware()` is called with `[requestIdMiddleware]` when `rateLimit` is omitted.

### FR-5: Retain `createRequestLogger` for background jobs

The existing `createRequestLogger(context)` function in `request-context.ts` (line 21-23) is retained unchanged. It creates a child logger with `{ requestId }` from the context parameter — used by background jobs (email queue processor, cron tasks) that don't go through the request middleware and therefore have no AsyncLocalStorage context.

## Non-Functional Requirements

### NFR-1: Zero handler changes

No `.server.ts` files are modified. All `logger.*` calls across 100+ handler call sites automatically include `requestId` when running within a request context — the pino mixin handles this transparently.

### NFR-2: Background job compatibility

Background jobs using `logger.child({ requestId })` or `createRequestLogger({ requestId })` continue to work. The pino mixin returns `{}` when AsyncLocalStorage is empty, so child logger bindings provide `requestId` normally.

### NFR-3: No behavioral change to existing handlers

Request ID propagation is transparent — handlers don't read or use `requestId` directly. The only visible effect is additional `requestId` fields in log output.

### NFR-4: Middleware ordering

`requestIdMiddleware` runs before `createRateLimitMiddleware` (when rate limiting is configured). This ensures rate limit decisions — including `RATE_LIMITED` short-circuit responses — are logged with the `requestId` via the AsyncLocalStorage context established by `requestIdMiddleware`.

### NFR-5: File limit compliance

- `src/lib/request-context-store.ts` — new file, ~10 lines (well under 500)
- `src/lib/request-context.ts` — current 23 lines, ~+5 lines for import + storage.run wrapping (~28 lines, well under 500)
- `src/lib/logger.ts` — current 32 lines, ~+8 lines for mixin + import (~40 lines, well under 500)
- `src/lib/server-fn.ts` — current 75 lines, ~+5 lines for requestIdMiddleware import + always-chain (~80 lines, well under 500)

### NFR-6: Test coverage

All new and modified code must meet >=80% coverage on lines, statements, branches, and functions.

### NFR-7: No circular dependencies

`request-context-store.ts` has zero project dependencies (only `node:async_hooks`). Both `request-context.ts` and `logger.ts` import from it. No circular import chain exists.

## Acceptance Criteria

1. **AC-1:** `src/lib/request-context-store.ts` exists with `RequestContext` interface, `requestContextStorage` (AsyncLocalStorage instance), and `getRequestId()` helper.
2. **AC-2:** `requestIdMiddleware` in `request-context.ts` wraps `next()` in `requestContextStorage.run({ requestId }, () => next({ context: { requestId } }))`.
3. **AC-3:** `requestIdMiddleware` continues passing requestId via TanStack context (`next({ context: { requestId } })`).
4. **AC-4:** `createLogger()` in `logger.ts` includes a `mixin` function that returns `{ requestId: store.requestId }` when `requestContextStorage.getStore()` has a store, `{}` when empty.
5. **AC-5:** `typedServerFn` always chains `requestIdMiddleware` via `.middleware()` (with or without `rateLimit`).
6. **AC-6:** When `rateLimit` is provided, both `requestIdMiddleware` and `createRateLimitMiddleware` are chained (requestId first, rateLimit second).
7. **AC-7:** `createRequestLogger` function is retained unchanged in `request-context.ts`.
8. **AC-8:** `tests/unit/lib/request-context.test.ts` updated: tests verify AsyncLocalStorage wrapping (requestId available in store within `next()` call, unavailable after), header/UUID behavior preserved, context passing preserved.
9. **AC-9:** `tests/unit/lib/server-fn.test.ts` updated: `.middleware()` is always called (even without `rateLimit`); both middlewares chained when `rateLimit` provided; existing builder chain + regression tests pass.
10. **AC-10:** `tests/unit/lib/logger.test.ts` updated: mixin returns `{ requestId }` when AsyncLocalStorage has store; returns `{}` when empty; log entries include `requestId` within request context; child logger bindings persist alongside mixin.
11. **AC-11:** `pnpm typecheck` passes.
12. **AC-12:** `pnpm lint` passes.
13. **AC-13:** `pnpm test` passes (all existing tests + new tests).
14. **AC-14:** `pnpm test:coverage` meets >=80% thresholds on all four metrics.
15. **AC-15:** No circular dependencies introduced (`request-context-store.ts` breaks the would-be `logger.ts` ↔ `request-context.ts` cycle).
16. **AC-16:** Track documented in `conductor/tech-stack.md`.

## Out of Scope

- **W3C Trace Context / OpenTelemetry headers:** Only `x-request-id` is supported. No `traceparent`, `tracestate`, or baggage propagation.
- **Request ID propagation to client-side logs:** Server-side only. The client doesn't receive or propagate `requestId`.
- **Custom header name configuration:** The header name `x-request-id` is hardcoded. No env var for configuration.
- **Distributed tracing across multiple services:** Single-instance, single-service deployment. No cross-service trace propagation.
- **Removing `createRequestLogger`:** Retained for background jobs that need explicit child logger creation outside the request middleware.
- **Handler changes:** No `.server.ts` files are modified. All propagation is automatic via AsyncLocalStorage + pino mixin.
- **Per-function requestId opt-out:** All server functions get `requestIdMiddleware`. No mechanism to exclude specific functions (unlike rate limiting, requestId is pure observability with no performance concern).
</protect>
