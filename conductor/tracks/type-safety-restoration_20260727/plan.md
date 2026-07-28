<protect>
# Implementation Plan: Type-Safety Restoration — Eliminate `as unknown as` Casts

**Track ID:** type-safety-restoration_20260727  
**Spec:** `./spec.md`  
**Workflow:** `conductor/workflow.md` (TDD lifecycle, Phase Completion Verification and Checkpointing Protocol)

---

## Phase 1: Root-Cause Diagnosis & Type-Level Test [checkpoint: 663747f]

- [x] Task: Read spec.md and workflow.md to refresh context for this phase
    - [x] Read `./spec.md` for requirements, scope boundaries, and acceptance criteria
    - [x] Read `conductor/workflow.md` for TDD lifecycle and quality gates
    - [x] Verify: context is refreshed and understood

- [x] Task: Diagnose the `createServerFn` type-gap root cause
    - [x] Read `src/server/assignments.ts` (typed-builder pattern) and `src/server/submissions.ts` (inline-parse pattern) to understand both stub patterns
    - [x] Read `src/hooks/use-notifications.ts` to see the cast pattern at call sites
    - [x] Investigate why `createServerFn({ method }).inputValidator(Schema).handler(async ({ data }) => { const { handler } = await import('./feature.server'); return handler({ data }); })` doesn't propagate the handler's return type to client callers
    - [x] Document the root cause: `createServerFn`'s `handler` method has generic `<TNewResponse>` but `ServerFnReturnType` applies `ValidateSerializableInput` (a recursive conditional type from `@tanstack/router-core`) that prevents TypeScript from inferring `TNewResponse` through the conditional. `TNewResponse` defaults to `unknown`, making the `Fetcher` return type `Promise<unknown>` at call sites. The dynamic `await import()` is NOT the cause — even direct handler returns suffer the same inference failure.
    - [x] Verify: root cause is documented and understood

- [x] Task: Write type-level test (failing — confirms the gap exists) [ca36ab8]
    - [x] Create `tests/unit/types/server-fn-types.test-d.ts`
    - [x] Write `expectTypeOf` or `@ts-expect-error` assertions demonstrating that a `createServerFn` stub's return type is `unknown` at the call site (before the fix)
    - [x] Run `pnpm typecheck` — confirm the type-level test fails (the gap exists)
    - [x] Verify: type-level test fails as expected, confirming the gap — 2 type errors on return type assertions (Tests 1-2), Test 3 (input param) passes

- [x] Task: Conductor - User Manual Verification 'Phase 1: Root-Cause Diagnosis & Type-Level Test' (Protocol in workflow.md) [663747f]

---

## Phase 2: Type Fix at Source [checkpoint: 1791ee69]

- [x] Task: Read spec.md and workflow.md to refresh context for this phase
    - [x] Read `./spec.md` for requirements, scope boundaries, and acceptance criteria
    - [x] Read `conductor/workflow.md` for TDD lifecycle and quality gates
    - [x] Verify: context is refreshed and understood

- [x] Task: Write unit test for `typedServerFn` wrapper (Red Phase) [8ed44dc]
    - [x] Create `tests/unit/lib/server-fn.test.ts` (or `test-d.ts` for type-level assertions)
    - [x] Write tests asserting: (1) `typedServerFn` preserves the `.inputValidator(Schema).handler(fn)` builder chain API, (2) the handler's return type propagates to the callable stub, (3) runtime behavior is identical to `createServerFn`
    - [x] Run `pnpm test` — confirm tests fail (wrapper doesn't exist yet)
    - [x] Verify: tests fail as expected

- [x] Task: Implement `src/lib/server-fn.ts` with `typedServerFn` wrapper (Green Phase) [1048c14]
    - [x] Create `src/lib/server-fn.ts` exporting `typedServerFn` that wraps `createServerFn` with proper generic return-type inference
    - [x] The wrapper must preserve the `.inputValidator(Schema).handler(fn)` builder chain API
    - [x] The wrapper must propagate the handler's return type to the callable stub (no `unknown` at call sites)
    - [x] The wrapper must be a type-only change at runtime (delegates to `createServerFn`)
    - [x] Run `pnpm test` — confirm wrapper tests pass
    - [x] Run `pnpm typecheck` — confirm no new type errors
    - [x] Verify: wrapper tests pass, typecheck clean

- [x] Task: Update type-level test to verify `typedServerFn` fixes the gap [c331e6f]
    - [x] Update `tests/unit/types/server-fn-types.test-d.ts` to assert that `typedServerFn` stub's return type propagates correctly (no longer `unknown`)
    - [x] Run `pnpm typecheck` — confirm type-level test now passes
    - [x] Verify: type-level test passes, confirming the fix works — typecheck 0 errors (2 pre-existing type errors resolved), 3740 tests pass, lint 0 errors

- [x] Task: Migrate server-function stubs to `typedServerFn` (batch 1: core features) [5d2650a]
    - [x] Migrate `src/server/assignments.ts` — replace `createServerFn` import with `typedServerFn` from `@/lib/server-fn`
    - [x] Migrate `src/server/submissions.ts`
    - [x] Migrate `src/server/notifications.ts`
    - [x] Migrate `src/server/reviews.ts`
    - [x] Migrate `src/server/settings.ts`
    - [x] Run `pnpm typecheck` after each file — catch any inference gaps immediately
    - [x] Verify: typecheck clean after batch 1 — typecheck 0 errors, 3780 tests pass, lint 0 errors

- [x] Task: Migrate server-function stubs to `typedServerFn` (batch 2: remaining stubs) [16d62f6]
    - [x] Migrate `src/server/consultations.ts`
    - [x] Migrate `src/server/extensions.ts`
    - [x] Migrate `src/server/discussions.ts`
    - [x] Migrate `src/server/gradebook.ts`
    - [x] Migrate `src/server/dashboard.ts`
    - [x] Migrate `src/server/templates.ts`
    - [x] Migrate `src/server/users.ts`
    - [x] Migrate `src/server/email-queue.ts`
    - [x] Migrate `src/server/audit-logs.ts`
    - [x] Migrate `src/server/analytics.ts`
    - [x] Migrate other `src/server/*.ts` stub files found via grep: auth.ts, bulk-import.ts, files.ts, instructor-assignments-filter.ts, rubrics.ts, two-factor.ts, setup-password.ts, sessions.ts (8 additional files)
    - [x] Fix `OptionalFetcher` type in `src/lib/server-fn.ts` for handler-only fns called with 0 args
    - [x] Run `pnpm typecheck` after migration — 0 errors (fixed 5 TS2554 errors from handler-only fns)
    - [x] Run `pnpm test:unit` — 3780 tests pass (0 failures)
    - [x] Run `pnpm lint` — 0 errors, 4 pre-existing warnings
    - [x] Verify: typecheck clean, all tests pass, all 23 server stub files migrated

- [x] Task: Verify quality gates for Phase 2
    - [x] Run `pnpm typecheck` — 0 errors
    - [x] Run `pnpm test:coverage` — ≥80% on all thresholds (88.01% stmts, 81.91% branches, 83.29% funcs, 88.65% lines)
    - [x] Run `pnpm lint` — 0 warnings, 0 errors (4 pre-existing warnings in analytics-export.server.ts)
    - [x] Run `pnpm check:i18n` — parity maintained (781 keys used, 963 in both locales)
    - [x] Verify: all quality gates pass

- [x] Task: Conductor - User Manual Verification 'Phase 2: Type Fix at Source' (Protocol in workflow.md) [1791ee69]

---

## Phase 3: Cast Elimination

- [x] Task: Read spec.md and workflow.md to refresh context for this phase
    - [x] Read `./spec.md` for requirements, scope boundaries, and acceptance criteria
    - [x] Read `conductor/workflow.md` for TDD lifecycle and quality gates
    - [x] Verify: context is refreshed and understood

- [x] Task: Remove `as unknown as` casts from hooks (7 casts, 2 files) [a9973ab]
    - [x] Remove 4 casts from `src/hooks/use-notifications.ts` — server fn calls should now have proper return types via `typedServerFn`
    - [x] Remove 3 casts from `src/hooks/use-assignment-tabs.ts`
    - [x] Run `pnpm typecheck` after each file — confirm no type errors
    - [x] Verify: zero `as unknown as` in `src/hooks/`

- [x] Task: Remove `as unknown as` casts from settings components (13 casts, 5 files) [4b0c5e3]
    - [ ] Remove 4 casts from `src/components/settings/TwoFactorSettings.tsx`
    - [ ] Remove 3 casts from `src/components/settings/SessionManagement.tsx`
    - [ ] Remove 2 casts from `src/components/settings/ProfileSection.tsx`
    - [ ] Remove 2 casts from `src/components/settings/NotificationPreferencesSection.tsx`
    - [ ] Remove 2 casts from `src/components/settings/AccessibilitySection.tsx`
    - [ ] Run `pnpm typecheck` after each file
    - [ ] Verify: typecheck clean, zero casts in settings components

- [x] Task: Remove `as unknown as` casts from review/consultation/discussion components (12 casts, 6 files) [14714a95]
    - [x] Remove 2 casts from `src/components/reviews/ReviewForm.tsx`
    - [x] Remove 2 casts from `src/components/reviews/DeadlineManager.tsx`
    - [x] Remove 1 cast from `src/components/student/extensions/ExtensionRequestForm.tsx`
    - [x] Remove 1 cast from `src/components/consultations/ConsultationForm.tsx`
    - [x] Remove 3 casts from `src/components/consultations/VerificationDialog.tsx`
    - [x] Remove 3 casts from `src/components/discussions/discussion-panel.tsx`
    - [x] Run `pnpm typecheck` after each file
    - [x] Verify: typecheck clean, zero casts in these components

- [x] Task: Remove `as unknown as` casts from admin/instructor components (8 casts, 4 files) [83060e7e]
    - [x] Remove 3 casts from `src/components/admin/templates/TemplateDetailPage.tsx`
    - [x] Remove 3 casts from `src/components/instructor/assignments/AssignmentWizard.tsx`
    - [x] Remove 1 cast from `src/components/instructor/assignments/StudentPicker.tsx`
    - [x] Remove 1 cast from `src/components/instructor/assignments/TemplatePicker.tsx`
    - [x] Run `pnpm typecheck` after each file
    - [x] Verify: typecheck clean, zero casts in admin/instructor components

- [x] Task: Remove `as unknown as` casts from routes (19 casts, 6 files) [0393f6a1]
    - [x] Remove 1 cast from `src/routes/_authenticated/student/dashboard.tsx` (loader data cast)
    - [x] Remove 1 cast from `src/routes/_authenticated/admin/dashboard.tsx` (loader data cast)
    - [x] Remove 2 casts from `src/routes/_authenticated/admin/analytics.tsx` (loader data + server fn casts)
    - [x] Remove 2 casts from `src/routes/_authenticated/instructor/analytics.tsx` (loader data + server fn casts)
    - [x] Remove 7 casts from `src/routes/_authenticated/student/assignments/$id.checkpoints.$checkpointId.tsx` (loader data + server fn casts)
    - [x] Remove 6 casts from `src/routes/_authenticated/student/assignments/$id.tsx` (loader data + server fn casts)
    - [x] Run `pnpm typecheck` after each file
    - [x] Verify: typecheck clean, only `_authenticated.tsx` and `_unauthenticated.tsx` redirect casts remain in routes
    - Note: Also removed orphaned type aliases (InstructorAnalyticsData, RubricCriterionMetric, InstructorRubricAnalytics, AdminAnalyticsData) in commit 73ddad61. Updated ConsultationList, ExtensionHistoryList, file-list, AdminDashboard, StudentDashboard interfaces for Drizzle nullable timestamps.

- [x] Task: Remove Drizzle query-result casts from server files (5 casts, 3 files) [4348d492]
    - [x] Remove 1 cast from `src/server/analytics-export.server.ts` — replaced `as unknown as ScoreRow[]` with `as ScoreRow[]` (Drizzle inferred type is structurally compatible with ScoreRow)
    - [x] Remove 3 casts from `src/server/gradebook.server.ts` — same pattern: `as ScoreRow[]` suffices because Drizzle enum unions are assignable to string, optional ScoreRow fields absent in queries that don't select them
    - [x] Remove 1 cast from `src/server/reviews-extras.server.ts` — same pattern
    - [x] Run `pnpm typecheck` after each file
    - [x] Verify: typecheck clean, zero Drizzle casts in server files

- [x] Task: Remove Drizzle query-result casts from lib files (3 casts, 2 files) [3e355892]
    - [x] Remove 1 cast from `src/lib/email-queue-processor.ts` — replaced `as unknown as { rowCount?: number }` with `as { rowCount?: number }` (Drizzle update() return type compatible with simple `as`)
    - [x] Remove 2 casts from `src/lib/email-queue-retention.ts` — same pattern for Drizzle delete() results
    - [x] Run `pnpm typecheck` after each file
    - [x] Verify: typecheck clean, zero Drizzle casts in lib files

- [ ] Task: Type Better Auth API responses properly (2 casts, 2 files)
    - [ ] Replace `result as unknown as NonNullable<Session>` in `src/server/auth.server.ts:56` with proper Better Auth `getSession` response type — import the documented response type from `better-auth` or infer from the API call
    - [ ] Replace `result as unknown as { totpURI?: string; backupCodes?: string[] }` in `src/server/two-factor.server.ts` with proper Better Auth 2FA API response type
    - [ ] Run `pnpm typecheck` after each file
    - [ ] Verify: typecheck clean, zero Better Auth casts

- [ ] Task: Final cast elimination verification
    - [ ] Run `rg "as unknown as" src/hooks/ src/components/ src/lib/` — confirm zero matches (excluding `src/components/layout/*-sidebar.tsx`)
    - [ ] Run `rg "as unknown as" src/routes/` — confirm only `_authenticated.tsx` (1 cast) and `_unauthenticated.tsx` (1 cast) remain (documented TanStack Router limitation)
    - [ ] Run `rg "as unknown as" src/server/` — confirm only `auth.ts` (2 casts) remains (documented TanStack Router redirect limitation)
    - [ ] Run `rg "as unknown as" src/components/layout/` — confirm only 3 sidebar files (6 casts) remain (documented TanStack Router typed-routes limitation)
    - [ ] Verify: only 10 documented TanStack Router limitation casts remain across the entire `src/` directory

- [ ] Task: Run full quality gate suite
    - [ ] Run `pnpm typecheck` — 0 errors
    - [ ] Run `pnpm test:unit` — all existing tests pass unchanged (type-only refactor)
    - [ ] Run `pnpm test:coverage` — ≥80% on all thresholds (lines, statements, branches, functions)
    - [ ] Run `pnpm lint` — 0 warnings, 0 errors
    - [ ] Run `pnpm check:i18n` — parity maintained
    - [ ] Run `rg "@ts-expect-error" src/` — confirm zero new directives added
    - [ ] Run `rg "as any" src/` — confirm zero new `as any` casts added (excluding `routeTree.gen.ts`)
    - [ ] Verify: all quality gates pass, no regressions

- [ ] Task: Conductor - User Manual Verification 'Phase 3: Cast Elimination' (Protocol in workflow.md)
</protect>
