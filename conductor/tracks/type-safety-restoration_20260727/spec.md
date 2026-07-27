# Track: Type-Safety Restoration — Eliminate `as unknown as` Casts

**Track ID:** type-safety-restoration_20260727  
**Type:** Refactor  
**Status:** Pending  
**Audit IDs:** INFRA-4 (systemic type-safety erosion — ~80 `as unknown as` casts across hooks, components, routes, and server files)  
**Dependencies:** None (recommended AFTER TRACK-031 — guard consolidation reduces the surface area of server-function calls to audit)  
**Estimated Effort:** 5 Days / 2.5 Sprint Loops

## Overview

The codebase has accumulated ~78 `as unknown as` type casts across 36 files in `src/`. These casts exist because the `createServerFn` return type doesn't propagate through the dynamic `await import('./feature.server')` pattern used in server-function stubs, and because Drizzle raw SQL queries return `unknown[]`. This track restores end-to-end type safety by fixing the type propagation at the source and systematically eliminating all casts (excluding documented TanStack Router typed-routes limitations).

**Current state:** 78 `as unknown as` casts across 36 files (hooks: 7, components: 38, routes: 21, server: 9, lib: 3). 10 casts are documented TanStack Router limitations (sidebar + auth redirects) and are Out of Scope. **68 casts to eliminate.**

## Context Anchors (Traceability)

- **PRD Reference:** N/A (type-safety infrastructure, no product impact)
- **TDD Reference:** `conductor/archive/instructor-ui-consistency_20260619/spec.md` (Track that first identified the `createServerFn` type-gap — removed `@ts-expect-error` from route loaders but the underlying gap was patched with casts); `src/server/assignments.ts` (canonical typed-builder stub pattern: `createServerFn({ method }).inputValidator(Schema).handler(...)`); `src/server/submissions.ts` (canonical inline-parse pattern); `src/hooks/use-notifications.ts` (representative hook with 4 `as unknown as` casts on server fn calls)
- **Roadmap Reference:** `docs/roadmap.md` → Milestone 10 → TRACK-032

## Track Tech Stack

- TypeScript 7 (type inference, generic constraints)
- `@tanstack/react-start` (`createServerFn` — the wrapper whose return type doesn't propagate to client callers)
- `@tanstack/react-router` (route loader typing — `Route.useLoaderData()` return types)
- Drizzle ORM (`as unknown as ScoreRow[]` query-result casts in server handlers)
- `better-auth` (API response types for 2FA and session handlers)

## Architectural Decisions

### Decision 1: Type-Fix Approach — Shared Wrapper Utility

**Chosen:** Create `src/lib/server-fn.ts` with a `typedServerFn()` wrapper that wraps `createServerFn` with proper generic return-type inference.

**Rationale:** Centralized fix — one utility, one import change per stub file. All `createServerFn` stubs migrate from `createServerFn({ method }).inputValidator(Schema).handler(...)` to `typedServerFn({ method }).inputValidator(Schema).handler(...)`. The wrapper preserves the existing builder chain API while adding a generic return-type parameter that propagates the handler's return type to client callers.

**Alternative considered:** Explicit return-type annotations on each stub (Option B) — rejected as too verbose and per-stub maintenance-heavy. Generic constraint patch on `createServerFn` itself (Option C) — rejected as riskiest, may conflict with TanStack Start internal types.

### Decision 2: Drizzle Query-Result Cast Strategy — Native Drizzle Typing

**Chosen:** Use Drizzle's built-in `.then()` callback typing and `$type<RowShape>()` method on query builders where possible. Fall back to explicit TypeScript interfaces for raw SQL queries where Drizzle's typing methods don't apply.

**Rationale:** Most idiomatic for Drizzle. `$type<T>()` annotates query result types at the builder level, and `.then()` callback typing infers from the query shape. For raw SQL (e.g., `db.execute(sql\`...\`)`) where these methods don't apply, define explicit `interface RowShape { ... }` and annotate the result variable.

**Alternative considered:** `z.infer` from Zod schemas (Option A) — rejected as too much boilerplate for query results that already have defined shapes. Explicit interfaces only (Option B) — rejected as it ignores Drizzle's native typing capabilities.

## Scope Boundaries

### In Scope

1. **Diagnose the `createServerFn` type-gap root cause:** Determine why the return type of `.handler(async ({ data }) => { ... })` doesn't propagate to the client-callable stub. Investigate whether the gap is in the TanStack Start `createServerFn` generic, the `.inputValidator()` chain, or the dynamic `await import('./feature.server')` pattern.

2. **Create `src/lib/server-fn.ts` shared wrapper:** Implement `typedServerFn()` that wraps `createServerFn` with proper return-type inference. The wrapper must preserve the existing `.inputValidator(Schema).handler(fn)` builder chain API.

3. **Migrate all server-function stubs to `typedServerFn()`:** Update all `src/server/*.ts` stub files to import and use `typedServerFn` instead of `createServerFn`. This is the centralized fix that eliminates the root cause.

4. **Write type-level test:** Create `tests/unit/types/server-fn-types.test-d.ts` demonstrating that a `typedServerFn` stub's return type propagates correctly to callers (no longer `unknown`).

5. **Remove `as unknown as` casts from hooks (7 casts, 2 files):**
   - `src/hooks/use-notifications.ts` (4 casts)
   - `src/hooks/use-assignment-tabs.ts` (3 casts)

6. **Remove `as unknown as` casts from components (38 casts, 16 files):**
   - `src/components/settings/TwoFactorSettings.tsx` (4 casts)
   - `src/components/settings/SessionManagement.tsx` (3 casts)
   - `src/components/settings/ProfileSection.tsx` (2 casts)
   - `src/components/settings/NotificationPreferencesSection.tsx` (2 casts)
   - `src/components/settings/AccessibilitySection.tsx` (2 casts)
   - `src/components/reviews/ReviewForm.tsx` (2 casts)
   - `src/components/reviews/DeadlineManager.tsx` (2 casts)
   - `src/components/student/extensions/ExtensionRequestForm.tsx` (1 cast)
   - `src/components/consultations/ConsultationForm.tsx` (1 cast)
   - `src/components/consultations/VerificationDialog.tsx` (3 casts)
   - `src/components/discussions/discussion-panel.tsx` (3 casts)
   - `src/components/admin/templates/TemplateDetailPage.tsx` (3 casts)
   - `src/components/instructor/assignments/AssignmentWizard.tsx` (3 casts)
   - `src/components/instructor/assignments/StudentPicker.tsx` (1 cast)
   - `src/components/instructor/assignments/TemplatePicker.tsx` (1 cast)

7. **Remove `as unknown as` casts from routes (21 casts, 8 files — 10 are Out of Scope, so 11 casts in 6 files):**
   - `src/routes/_authenticated/student/dashboard.tsx` (1 cast)
   - `src/routes/_authenticated/admin/dashboard.tsx` (1 cast)
   - `src/routes/_authenticated/admin/analytics.tsx` (2 casts)
   - `src/routes/_authenticated/instructor/analytics.tsx` (2 casts)
   - `src/routes/_authenticated/student/assignments/$id.checkpoints.$checkpointId.tsx` (7 casts)
   - `src/routes/_authenticated/student/assignments/$id.tsx` (6 casts)
   - **Out of Scope:** `_authenticated.tsx` (1 cast), `_unauthenticated.tsx` (1 cast) — TanStack Router typed-routes limitation

8. **Remove `as unknown as` casts from server files (9 casts, 6 files):**
   - `src/server/analytics-export.server.ts` (1 cast — Drizzle query result)
   - `src/server/gradebook.server.ts` (3 casts — Drizzle query results)
   - `src/server/reviews-extras.server.ts` (1 cast — Drizzle query result)
   - `src/server/auth.server.ts` (1 cast — Better Auth `getSession` response)
   - `src/server/auth.ts` (2 casts — **Out of Scope:** TanStack Router redirect limitation)
   - `src/server/two-factor.server.ts` (1 cast — Better Auth 2FA response)

9. **Remove `as unknown as` casts from lib files (3 casts, 2 files):**
   - `src/lib/email-queue-processor.ts` (1 cast — Drizzle query result)
   - `src/lib/email-queue-retention.ts` (2 casts — Drizzle query results)

10. **Type Better Auth API responses properly:** Use documented response types from `better-auth` for `getSession` and 2FA API responses instead of ad-hoc casts.

### Out of Scope

1. **`src/routeTree.gen.ts`** — generated file (`as any` is TanStack Router codegen, not fixable by hand)
2. **Sidebar casts** (`admin-sidebar.tsx`, `instructor-sidebar.tsx`, `student-sidebar.tsx` — 6 casts total) — TanStack Router typed-routes limitation (route paths are string literals; dynamic sidebar configs can't satisfy the literal type). Document as a known limitation.
3. **Auth redirect casts** in `src/server/auth.ts` (`redirect({ to: '/auth/login' as unknown as '.' })` — 2 casts) — same TanStack Router typed-routes limitation. Document, do not fix.
4. **Route redirect casts** in `src/routes/_authenticated.tsx` and `src/routes/_unauthenticated.tsx` (2 casts) — same limitation. Document, do not fix.
5. **Any changes to server handler logic** — type-only changes, no behavioral changes
6. **`as any` casts** (if any exist outside generated files) — this track focuses on `as unknown as` only

## Functional Requirements

### FR-1: Type-Level Test for Server Function Return Type Propagation
- A type-level test (`tests/unit/types/server-fn-types.test-d.ts`) must demonstrate that a `typedServerFn` stub's return type propagates correctly to callers.
- The test must use `expectTypeOf` or `@ts-expect-error` assertions to verify type-level correctness.
- The test must fail before the `typedServerFn` wrapper is applied and pass after.

### FR-2: `typedServerFn` Wrapper Utility
- `src/lib/server-fn.ts` must export a `typedServerFn` function that wraps `createServerFn`.
- The wrapper must preserve the `.inputValidator(Schema).handler(fn)` builder chain API.
- The wrapper must propagate the handler's return type to the callable stub (no `unknown` at call sites).
- The wrapper must not change runtime behavior (type-only change).

### FR-3: Cast Elimination
- After migration, `rg "as unknown as" src/hooks/ src/components/ src/lib/` must return zero matches.
- After migration, `rg "as unknown as" src/routes/` must return only the 2 documented TanStack Router redirect casts in `_authenticated.tsx` and `_unauthenticated.tsx`.
- After migration, `rg "as unknown as" src/server/` must return only the 2 documented TanStack Router redirect casts in `auth.ts`.
- After migration, `rg "as unknown as" src/components/layout/` must return only the 6 documented sidebar casts.

### FR-4: Drizzle Query-Result Typing
- Drizzle query-result casts must be replaced with `$type<RowShape>()` on query builders or explicit interface annotations for raw SQL.
- No runtime behavior change — the query results must be identical.

### FR-5: Better Auth Response Typing
- `src/server/auth.server.ts:56` `result as unknown as NonNullable<Session>` must be replaced with proper Better Auth `getSession` response typing.
- `src/server/two-factor.server.ts` `result as unknown as { totpURI?: string; backupCodes?: string[] }` must be replaced with proper Better Auth 2FA API response typing.

## Non-Functional Requirements

### NFR-1: Zero Behavioral Changes
- All type changes must be inference-based or annotation-based — no runtime logic changes.
- All existing tests must pass unchanged (type-only refactor).
- `pnpm test:unit` must pass with the same test count.

### NFR-2: Quality Gates
- `pnpm typecheck` — 0 errors
- `pnpm test:coverage` — ≥80% on all thresholds (lines, statements, branches, functions)
- `pnpm lint` — 0 warnings, 0 errors
- No `@ts-expect-error` directives added
- No `as any` added
- All files under 500 lines

### NFR-3: No New Dependencies
- No new npm packages. The `typedServerFn` wrapper uses only existing `@tanstack/react-start` and TypeScript.

## Acceptance Criteria

1. **Type-level test exists and passes** — `tests/unit/types/server-fn-types.test-d.ts` confirms return-type propagation via `typedServerFn`.
2. **`typedServerFn` wrapper exists** — `src/lib/server-fn.ts` exports the wrapper, all server stubs migrated.
3. **Zero `as unknown as` in hooks/components/lib** — `rg "as unknown as" src/hooks/ src/components/ src/lib/` returns zero matches (excluding `src/components/layout/*-sidebar.tsx`).
4. **Only documented limitations remain in routes/server** — `rg "as unknown as" src/routes/ src/server/` returns only: sidebar casts (6), auth-redirect casts (2 in `auth.ts`), route-redirect casts (2 in `_authenticated.tsx` + `_unauthenticated.tsx`).
5. **All existing tests pass** — `pnpm test:unit` passes with no test changes (type-only refactor).
6. **Quality gates pass** — `pnpm typecheck`, `pnpm test:coverage`, `pnpm lint` all clean.
7. **No `@ts-expect-error` or `as any` added** — grep confirms zero new directives.
8. **Manual smoke test** — `pnpm dev` runs, all pages render without console errors, settings/review/upload/gradebook flows work.
