# Track — Error Boundary & Error Message Improvements

## Overview

Implement the documented-but-unbuilt error handling strategy (per `docs/TDD.md` §9 and `product-guidelines.md` "Error & Empty State Guidelines"). The codebase currently has: **no error boundary** (`errorComponent`) in any route, **no toast library** (sonner was never installed — earlier tracks marked it optional and used `window.confirm()`/inline banners), and **server handlers that return generic hardcoded English strings** like `{ error: 'Unauthorized' }` / `{ error: 'Internal Server Error' }` with no structured logging.

This track delivers two complementary halves:
1. **Server-side (debuggability):** A structured error logger and typed error-code responses so failures are traceable and debuggable without leaking internals to the client.
2. **UI-side (user-friendliness):** Sonner toast notifications for action/transient errors, a global error boundary for render crashes, and bilingual user-facing error messages — surfacing "just enough" to the user.

## Dependencies

All prior tracks (server functions and mutation hooks exist across the app). No new external infrastructure. Adds the `sonner` npm dependency.

## Functional Requirements

### FR1: Server Error Utilities
- Create `src/lib/errors.ts` exporting:
  - An `ErrorCode` union: `'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION' | 'CONFLICT' | 'INTERNAL'`.
  - A `ServerError` response shape: `{ error: { code: ErrorCode; message: string } }`.
  - A `serverError(code, message, context?)` helper that: (a) calls `logError(...)` to record structured debug context, and (b) returns the `ServerError` object.
  - A `logError(code, message, context?)` helper that writes a structured log entry: timestamp, code, message, stack (when an Error is passed), userId (from session when available), handler/action name, and a sanitized input summary. Readable text in dev, structured JSON in production (`import.meta.env.PROD`).
- **Stack traces and internal details are NEVER included in the response returned to the client** — only `code` and a short `message`. The `message` is a concise dev-facing summary; the client displays the translated user message derived from `code`.

### FR2: Server Handler Migration
- Migrate all existing server handlers (`src/server/*.server.ts`) from returning `{ error: '<string>' }` to `serverError(code, message, context?)`.
- Map existing strings to codes: `'Unauthorized'` → `UNAUTHORIZED`, `'... not found'` → `NOT_FOUND`, validation failures → `VALIDATION`, caught DB/unknown errors → `INTERNAL`.
- Wrap previously-uncaught DB operations in `try/catch` returning `serverError('INTERNAL', ...)` with the original error captured in `context`.
- Update existing unit tests asserting the old `{ error: 'string' }` shape to assert the new `{ error: { code, message } }` shape.

### FR3: Client Error Utilities
- Create `src/lib/toast.ts` exporting `showErrorToast(code: ErrorCode, t)`: looks up the translated message via `t('errors.<lowercase-code>')`, shows a sonner `toast.error(...)`; falls back to `t('errors.default')` for unknown codes.
- A client-side parse helper to extract `{ code, message }` from a server response, tolerant of both the new typed shape and the legacy `{ error: string }` shape during transition.

### FR4: Sonner Toaster Integration
- Add `sonner` as a project dependency.
- Mount `<Toaster />` once in `src/routes/__root.tsx`: `richColors`, theme-aware (light/dark), `position="top-right"`, reduced-motion respected.
- Any Toaster UI strings (e.g., close-button aria-label) use i18n keys.

### FR5: TanStack Query Mutation Wiring
- Update all existing client mutation hooks (`src/hooks/*.ts`) so that on a server error response they call `showErrorToast(code, t)`.
- Replace the current `throw new Error(res.error)` pattern (which stringifies the new object shape into `[object Object]`) with the typed error-code flow.

### FR6: Global Error Boundary
- Add an `errorComponent` to `src/routes/__root.tsx` (TanStack Router) rendering a fallback on uncaught render crashes: a "Something went wrong" heading, a short reassurance message, a "Reload" button, and a "Go to dashboard" link.
- Bilingual (i18n), keyboard-navigable, theme/dark-mode aware.
- Client-side `console.error` of the boundary error for visibility (server-side logging of client render crashes is out of scope for v1).

### FR7: i18n Error Keys
- Add an `errors` namespace to `locales/en.json` and `locales/id.json` with user-friendly messages for each code: `unauthorized`, `forbidden`, `not_found`, `validation`, `conflict`, `internal`, `network`, and a `default`.
- Add UI strings for the error boundary and Toaster.
- Run `pnpm generate:i18n`; validate with `pnpm check:i18n`.

> **Implementation note (from plan.md):** the codebase already has an `error` i18n namespace (e.g. `error.notFound`) using camelCase keys. To avoid a redundant parallel namespace, the implementation extends the existing `error` namespace (camelCase) and reuses `error.notFound` for the `NOT_FOUND` code, rather than introducing a separate `errors` (plural) namespace. The spec intent (code → translated user message) is unchanged.

## Non-Functional Requirements

- **No internal leakage:** Stack traces, SQL, file paths, and raw error objects never reach the client.
- **Debuggability:** Server logs include enough structured context to reproduce/diagnose without re-running.
- **Bilingual:** All user-facing error messages localized EN/ID; lint rule `simak-i18n/no-hardcoded` satisfied.
- **Accessibility:** Error boundary fallback is keyboard-navigable with ARIA; toasts are announced to screen readers.
- **Reduced motion:** Toast animations respect the user's reduced-motion preference.
- **Coverage:** New utilities (`errors.ts`, `toast.ts`, error boundary) ≥ 80% coverage; no regression below project thresholds.
- **File limits:** New files ≤ 500 lines (respects `check-modularity.js`).

## Acceptance Criteria

- [ ] `src/lib/errors.ts` exists with `ErrorCode`, `serverError()`, `logError()` and unit tests.
- [ ] All server handlers return typed `{ error: { code, message } }` via `serverError()`; legacy string errors removed.
- [ ] `sonner` installed; `<Toaster />` mounted in `__root.tsx`; mutation hooks show translated toasts on error.
- [ ] `__root.tsx` has an `errorComponent` rendering a bilingual fallback with reload + dashboard links.
- [ ] `errors.*` keys present in both `locales/en.json` and `locales/id.json`; `pnpm check:i18n` passes.
- [ ] `pnpm test` passes (incl. updated handler tests); `pnpm typecheck` and `pnpm lint` clean; coverage thresholds met.
- [ ] No stack trace or internal detail is ever present in a client-visible response (verified by tests).

## Out of Scope

- Per-route `errorComponent`s (route-level fallbacks) — global only for v1.
- Server-side logging of client-side render crashes (needs a telemetry endpoint — v2).
- A persisted/external log sink (e.g., Sentry, file rotation) — logs go to server stdout only for v1.
- Auth-session-expiry redirect refinement (existing redirect behavior unchanged).
- Refactoring handlers to throw `AppError` (option C) — keeping the return-error pattern.
