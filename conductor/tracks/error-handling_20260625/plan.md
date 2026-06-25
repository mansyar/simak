<protect>
# Implementation Plan: Error Boundary & Error Message Improvements

## Phase 1: Server Error Utilities

**Objective:** Create the foundational server-side error module (`src/lib/errors.ts`) with typed error codes, a `serverError()` factory, and a structured `logError()` logger.

- [x] Task: Read `./spec.md` and `../../workflow.md` before starting this phase [1d9781e]
    - [ ] Re-read the track specification for requirements context
    - [ ] Re-read the workflow for the TDD task lifecycle and phase completion protocol
- [x] Task: Write failing tests for `src/lib/errors.ts` (Red Phase) [1d9781e]
    - [ ] Create `tests/unit/lib/errors.test.ts`
    - [ ] Test `ErrorCode` union includes: UNAUTHORIZED, FORBIDDEN, NOT_FOUND, VALIDATION, CONFLICT, INTERNAL
    - [ ] Test `serverError(code, message)` returns `{ error: { code, message } }`
    - [ ] Test `serverError(code, message, context)` calls `logError` with code, message, context
    - [ ] Test `logError` writes a structured entry containing: timestamp, code, message, stack (when an Error is passed), userId, handler, sanitized input summary
    - [ ] Test `logError` output is readable text in dev and JSON in production (`import.meta.env.PROD`)
    - [ ] Test the returned `ServerError` object NEVER contains stack/internal details (only code + message)
    - [ ] Run `CI=true pnpm vitest run tests/unit/lib/errors.test.ts` and confirm tests fail
- [x] Task: Implement `src/lib/errors.ts` (Green Phase) [1d9781e]
    - [ ] Create `src/lib/errors.ts` exporting `ErrorCode`, `ServerError` type, `serverError()`, `logError()`
    - [ ] `logError` reads session/userId where available and sanitizes input (redact sensitive fields)
    - [ ] Dev: readable multi-line log; Prod: single-line JSON (`import.meta.env.PROD`)
    - [ ] Run `CI=true pnpm vitest run tests/unit/lib/errors.test.ts` and confirm tests pass
- [x] Task: Verify coverage [1d9781e]
    - [x] Run `pnpm test:coverage` and confirm `src/lib/errors.ts` >= 80% coverage
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Server Error Utilities' (Protocol in workflow.md)

## Phase 2: i18n Error Keys, Sonner & Client Toast Helper

**Objective:** Add bilingual error message keys, install sonner, mount the global `<Toaster />`, and build the client `showErrorToast()` helper plus a response-shape-tolerant parser.

- [ ] Task: Read `./spec.md` and `../../workflow.md` before starting this phase
    - [ ] Re-read the track specification for requirements context
    - [ ] Re-read the workflow for the TDD task lifecycle and phase completion protocol
- [ ] Task: Add error i18n keys to both locales
    - [ ] Extend the existing `error` namespace in `locales/en.json` (camelCase convention; reuse existing `error.notFound`): add `unauthorized`, `forbidden`, `validation`, `conflict`, `internal`, `network`, `default`, `somethingWentWrong`, `reload`
    - [ ] Add matching Indonesian translations to `locales/id.json`
    - [ ] Run `pnpm generate:i18n` to regenerate `src/i18n/types.ts` + `detect-locale.ts`
    - [ ] Run `pnpm check:i18n` and `pnpm check:i18n:unused`; confirm parity and no unused keys
- [ ] Task: Install sonner
    - [ ] Run `pnpm add sonner`
    - [ ] Add the shadcn sonner wrapper via `pnpm dlx shadcn@latest add sonner` (or import `Toaster` directly)
- [ ] Task: Write failing tests for `src/lib/toast.ts` (Red Phase)
    - [ ] Create `tests/unit/lib/toast.test.tsx`
    - [ ] Test `showErrorToast(code, t)` calls `toast.error` with the translated message for each code
    - [ ] Test unknown code falls back to `t('error.default')`
    - [ ] Test `parseServerError(res)` extracts `{ code, message }` from the new typed shape `{ error: { code, message } }`
    - [ ] Test `parseServerError(res)` tolerates legacy shape `{ error: 'string' }` (maps to INTERNAL/default)
    - [ ] Run tests and confirm they fail
- [ ] Task: Implement `src/lib/toast.ts` (Green Phase)
    - [ ] Create `src/lib/toast.ts` exporting `showErrorToast(code, t)` with an explicit code->`TranslationKey` map, and `parseServerError(res)` helper
    - [ ] Run tests and confirm they pass
- [ ] Task: Mount `<Toaster />` in `src/routes/__root.tsx`
    - [ ] Import `Toaster` from the sonner wrapper
    - [ ] Render `<Toaster richColors position="top-right" />` inside `<QueryClientProvider>` in `RootDocument`
    - [ ] Wire theme (light/dark) and reduced-motion; localize close-button aria-label via `t()`
- [ ] Task: Verify coverage
    - [ ] Run `pnpm test:coverage`; confirm `src/lib/toast.ts` >= 80%
- [ ] Task: Conductor - User Manual Verification 'Phase 2: i18n Error Keys, Sonner & Client Toast Helper' (Protocol in workflow.md)

## Phase 3: Global Error Boundary

**Objective:** Add a TanStack Router `errorComponent` to `__root.tsx` that catches render crashes and shows a bilingual fallback with reload + dashboard links.

- [ ] Task: Read `./spec.md` and `../../workflow.md` before starting this phase
    - [ ] Re-read the track specification for requirements context
    - [ ] Re-read the workflow for the TDD task lifecycle and phase completion protocol
- [ ] Task: Write failing tests for the error boundary (Red Phase)
    - [ ] Create `tests/unit/components/error-boundary.test.tsx`
    - [ ] Test the fallback renders "Something went wrong" heading + reassurance via i18n
    - [ ] Test a "Reload" button is present and triggers `window.location.reload`
    - [ ] Test a "Go to dashboard" link is present
    - [ ] Test the caught error is logged via `console.error`
    - [ ] Test the fallback is keyboard-navigable and theme-aware (renders in light/dark)
    - [ ] Run tests and confirm they fail
- [ ] Task: Implement the error boundary (Green Phase)
    - [ ] Create `src/components/error-boundary.tsx` exporting `RootErrorComponent`
    - [ ] Add `errorComponent: RootErrorComponent` to the `createRootRoute({...})` options in `src/routes/__root.tsx`
    - [ ] Run tests and confirm they pass
- [ ] Task: Verify coverage
    - [ ] Run `pnpm test:coverage`; confirm `src/components/error-boundary.tsx` >= 80%
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Global Error Boundary' (Protocol in workflow.md)

## Phase 4: Server Handler Migration

**Objective:** Migrate all 24 server handlers from `{ error: '<string>' }` to `serverError(code, message, context?)`, wrap uncaught DB ops in try/catch, and update their unit tests.

- [ ] Task: Read `./spec.md` and `../../workflow.md` before starting this phase
    - [ ] Re-read the track specification for requirements context
    - [ ] Re-read the workflow for the TDD task lifecycle and phase completion protocol
- [ ] Task: Migrate handlers and update tests (per file)
    - [ ] `src/server/users.server.ts` + its test - map Unauthorized->UNAUTHORIZED, not-found->NOT_FOUND, DB errors->INTERNAL
    - [ ] `src/server/templates.server.ts` + test
    - [ ] `src/server/assignments.server.ts` + `assignments-extras.server.ts` + tests
    - [ ] `src/server/submissions.server.ts` + test
    - [ ] `src/server/reviews.server.ts` + `reviews-extras.server.ts` + tests
    - [ ] `src/server/consultations.server.ts` + `consultations-extras.server.ts` + tests
    - [ ] `src/server/extensions.server.ts` + `extensions-extras.server.ts` + tests
    - [ ] `src/server/due-dates.server.ts` + test
    - [ ] `src/server/notifications.server.ts` + test (assert `{ error: { code: 'INTERNAL', message } }` instead of `{ error: 'Internal Server Error' }`)
    - [ ] `src/server/files.server.ts` + test
    - [ ] `src/server/dashboard.server.ts` + `dashboard-student`/`dashboard-instructor`/`dashboard-admin` + tests
    - [ ] `src/server/instructor-assignments-filter.server.ts` + test
    - [ ] `src/server/settings.server.ts` + `sessions.server.ts` + `two-factor.server.ts` + tests
    - [ ] `src/server/bulk-import.server.ts` + `audit-logs.server.ts` + tests
- [ ] Task: Wrap uncaught DB operations in try/catch returning `serverError('INTERNAL', ...)`
    - [ ] For each handler above, audit for unguarded `await db...` and wrap with the original error in `context`
- [ ] Task: Run full test suite and quality gates
    - [ ] Run `CI=true pnpm test` and confirm all pass
    - [ ] Run `pnpm typecheck` and `pnpm lint`; confirm clean
    - [ ] Run `pnpm test:coverage`; confirm no regression below thresholds
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Server Handler Migration' (Protocol in workflow.md)

## Phase 5: Mutation Hook Wiring

**Objective:** Wire client mutation hooks (and any inline `useMutation` sites in routes) to call `showErrorToast(code, t)` on server errors, replacing the `throw new Error(res.error)` pattern.

- [ ] Task: Read `./spec.md` and `../../workflow.md` before starting this phase
    - [ ] Re-read the track specification for requirements context
    - [ ] Re-read the workflow for the TDD task lifecycle and phase completion protocol
- [ ] Task: Update client hooks
    - [ ] `src/hooks/use-notifications.ts` - replace 4x `throw new Error(res.error)` with `parseServerError` + `showErrorToast`; update hook tests to mock the new error shape
    - [ ] `src/hooks/use-assignment-tabs.ts` - replace `if (!result.error)` checks with the typed flow + toast; update test
    - [ ] Scan `src/routes/**` for inline `useMutation` calls and wire them with `showErrorToast` on error
- [ ] Task: Update and run hook tests
    - [ ] Update affected hook tests to assert the new error-shape flow
    - [ ] Run `CI=true pnpm test` and confirm all pass
    - [ ] Run `pnpm typecheck` and `pnpm lint`; confirm clean
    - [ ] Run `pnpm test:coverage`; confirm no regression below thresholds
- [ ] Task: Conductor - User Manual Verification 'Phase 5: Mutation Hook Wiring' (Protocol in workflow.md)
</protect>
