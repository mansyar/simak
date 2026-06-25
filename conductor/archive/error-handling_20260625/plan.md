<protect>
# Implementation Plan: Error Boundary & Error Message Improvements

## Phase 1: Server Error Utilities [checkpoint: 6985efb]

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
- [x] Task: Conductor - User Manual Verification 'Phase 1: Server Error Utilities' (Protocol in workflow.md) [6985efb]

## Phase 2: i18n Error Keys, Sonner & Client Toast Helper [checkpoint: 6e1505e]

**Objective:** Add bilingual error message keys, install sonner, mount the global `<Toaster />`, and build the client `showErrorToast()` helper plus a response-shape-tolerant parser.

- [x] Task: Read `./spec.md` and `../../workflow.md` before starting this phase
    - [ ] Re-read the track specification for requirements context
    - [ ] Re-read the workflow for the TDD task lifecycle and phase completion protocol
- [x] Task: Add error i18n keys to both locales
    - [ ] Extend the existing `error` namespace in `locales/en.json` (camelCase convention; reuse existing `error.notFound`): add `unauthorized`, `forbidden`, `validation`, `conflict`, `internal`, `network`, `default`, `somethingWentWrong`, `reload`
    - [ ] Add matching Indonesian translations to `locales/id.json`
    - [ ] Run `pnpm generate:i18n` to regenerate `src/i18n/types.ts` + `detect-locale.ts`
    - [ ] Run `pnpm check:i18n` and `pnpm check:i18n:unused`; confirm parity and no unused keys
- [x] Task: Install sonner
    - [ ] Run `pnpm add sonner`
    - [ ] Add the shadcn sonner wrapper via `pnpm dlx shadcn@latest add sonner` (or import `Toaster` directly)
- [x] Task: Write failing tests for `src/lib/toast.ts` (Red Phase) [5d571b0]
    - [ ] Create `tests/unit/lib/toast.test.tsx`
    - [ ] Test `showErrorToast(code, t)` calls `toast.error` with the translated message for each code
    - [ ] Test unknown code falls back to `t('error.default')`
    - [ ] Test `parseServerError(res)` extracts `{ code, message }` from the new typed shape `{ error: { code, message } }`
    - [ ] Test `parseServerError(res)` tolerates legacy shape `{ error: 'string' }` (maps to INTERNAL/default)
    - [ ] Run tests and confirm they fail
- [x] Task: Implement `src/lib/toast.ts` (Green Phase) [5d571b0]
    - [ ] Create `src/lib/toast.ts` exporting `showErrorToast(code, t)` with an explicit code->`TranslationKey` map, and `parseServerError(res)` helper
    - [ ] Run tests and confirm they pass
- [x] Task: Mount `<Toaster />` in `src/routes/__root.tsx` [5d571b0]
    - [x] Import `Toaster` from the sonner wrapper
    - [x] Render `<Toaster richColors position="top-right" />` inside `<QueryClientProvider>` in `RootDocument`
    - [x] Wire theme (light/dark) and reduced-motion; localize close-button aria-label via `t()`
- [x] Task: Verify coverage [5d571b0]
    - [x] Run `pnpm test:coverage`; confirm `src/lib/toast.ts` >= 80%
- [x] Task: Conductor - User Manual Verification 'Phase 2: i18n Error Keys, Sonner & Client Toast Helper' (Protocol in workflow.md) [6e1505e]

## Phase 3: Global Error Boundary [checkpoint: 536f170]

**Objective:** Add a TanStack Router `errorComponent` to `__root.tsx` that catches render crashes and shows a bilingual fallback with reload + dashboard links.

- [x] Task: Read `./spec.md` and `../../workflow.md` before starting this phase [796e8db]
    - [x] Re-read the track specification for requirements context
    - [x] Re-read the workflow for the TDD task lifecycle and phase completion protocol
- [x] Task: Write failing tests for the error boundary (Red Phase) [796e8db]
    - [x] Create `tests/unit/components/error-boundary.test.tsx`
    - [x] Test the fallback renders "Something went wrong" heading + reassurance via i18n
    - [x] Test a "Reload" button is present and triggers `window.location.reload`
    - [x] Test a "Go to dashboard" link is present
    - [x] Test the caught error is logged via `console.error`
    - [x] Test the fallback is keyboard-navigable and theme-aware (renders in light/dark)
    - [x] Run tests and confirm they fail
- [x] Task: Implement the error boundary (Green Phase) [796e8db]
    - [x] Create `src/components/error-boundary.tsx` exporting `RootErrorComponent`
    - [x] Add `errorComponent: RootErrorComponent` to the `createRootRoute({...})` options in `src/routes/__root.tsx`
    - [x] Run tests and confirm they pass
- [x] Task: Verify coverage [796e8db]
    - [x] Run `pnpm test:coverage`; confirm `src/components/error-boundary.tsx` >= 80%
- [x] Task: Conductor - User Manual Verification 'Phase 3: Global Error Boundary' (Protocol in workflow.md) [536f170]

## Phase 4: Server Handler Migration [checkpoint: e1003e5]

**Objective:** Migrate all 24 server handlers from `{ error: '<string>' }` to `serverError(code, message, context?)`, wrap uncaught DB ops in try/catch, and update their unit tests.

- [x] Task: Read `./spec.md` and `../../workflow.md` before starting this phase [40684b8]
    - [x] Re-read the track specification for requirements context
    - [x] Re-read the workflow for the TDD task lifecycle and phase completion protocol
- [x] Task: Migrate handlers and update tests (per file) [40684b8]
    - [x] `src/server/users.server.ts` + its test - map Unauthorized->UNAUTHORIZED, not-found->NOT_FOUND, DB errors->INTERNAL
    - [x] `src/server/templates.server.ts` + test
    - [x] `src/server/assignments.server.ts` + `assignments-extras.server.ts` + tests
    - [x] `src/server/submissions.server.ts` + test
    - [x] `src/server/reviews.server.ts` + `reviews-extras.server.ts` + tests
    - [x] `src/server/consultations.server.ts` + `consultations-extras.server.ts` + tests
    - [x] `src/server/extensions.server.ts` + `extensions-extras.server.ts` + tests
    - [x] `src/server/due-dates.server.ts` + test
    - [x] `src/server/notifications.server.ts` + test (assert `{ error: { code: 'INTERNAL', message } }` instead of `{ error: 'Internal Server Error' }`)
    - [x] `src/server/files.server.ts` + test
    - [x] `src/server/dashboard.server.ts` + `dashboard-student`/`dashboard-instructor`/`dashboard-admin` + tests
    - [x] `src/server/instructor-assignments-filter.server.ts` + test
    - [x] `src/server/settings.server.ts` + `sessions.server.ts` + `two-factor.server.ts` + tests
    - [x] `src/server/bulk-import.server.ts` + `audit-logs.server.ts` + tests
- [x] Task: Wrap uncaught DB operations in try/catch returning `serverError('INTERNAL', ...)` [40684b8]
    - [x] For each handler above, audit for unguarded `await db...` and wrap with the original error in `context`
- [x] Task: Run full test suite and quality gates [40684b8]
    - [x] Run `CI=true pnpm test` and confirm all pass (234 files / 2271 tests)
    - [x] Run `pnpm typecheck` and `pnpm lint`; confirm clean
    - [x] Run `pnpm test:coverage`; confirm no regression below thresholds (Stmt 87.21%, Branch 80.11%, Funcs 81.73%, Lines 87.97%)
- [x] Task: Conductor - User Manual Verification 'Phase 4: Server Handler Migration' (Protocol in workflow.md) [e1003e5]

## Phase 5: Mutation Hook Wiring [checkpoint: d3cf731]

**Objective:** Wire client mutation hooks (and any inline `useMutation` sites in routes) to call `showErrorToast(code, t)` on server errors, replacing the `throw new Error(res.error)` pattern.

- [x] Task: Read `./spec.md` and `../../workflow.md` before starting this phase [452a2c6]
    - [x] Re-read the track specification for requirements context
    - [x] Re-read the workflow for the TDD task lifecycle and phase completion protocol
- [x] Task: Update client hooks [452a2c6]
    - [x] `src/hooks/use-notifications.ts` - replace 4x `throw new Error(res.error)` with `parseServerError` + `showErrorToast`; update hook tests to mock the new error shape
    - [x] `src/hooks/use-assignment-tabs.ts` - replace `if (!result.error)` checks with the typed flow + toast; update test
    - [x] Scan `src/routes/**` for inline `useMutation` calls and wire them with `showErrorToast` on error (none found)
- [x] Task: Update and run hook tests [452a2c6]
    - [x] Update affected hook tests to assert the new error-shape flow
    - [x] Run `CI=true pnpm test` and confirm all pass (234 files / 2272 tests)
    - [x] Run `pnpm typecheck` and `pnpm lint`; confirm clean
    - [x] Run `pnpm test:coverage`; confirm no regression below thresholds
- [x] Task: Conductor - User Manual Verification 'Phase 5: Mutation Hook Wiring' (Protocol in workflow.md) [d3cf731]

## Phase: Review Fixes

- [x] Task: Apply review suggestions 844b380
</protect>
