<protect>
# Implementation Plan: Type-Safety Restoration — Eliminate `as unknown as` Casts

**Track ID:** type-safety-restoration_20260727  
**Spec:** `./spec.md`  
**Workflow:** `conductor/workflow.md` (TDD lifecycle, Phase Completion Verification and Checkpointing Protocol)

---

## Phase 1: Root-Cause Diagnosis & Type-Level Test

- [ ] Task: Read spec.md and workflow.md to refresh context for this phase
    - [ ] Read `./spec.md` for requirements, scope boundaries, and acceptance criteria
    - [ ] Read `conductor/workflow.md` for TDD lifecycle and quality gates
    - [ ] Verify: context is refreshed and understood

- [ ] Task: Diagnose the `createServerFn` type-gap root cause
    - [ ] Read `src/server/assignments.ts` (typed-builder pattern) and `src/server/submissions.ts` (inline-parse pattern) to understand both stub patterns
    - [ ] Read `src/hooks/use-notifications.ts` to see the cast pattern at call sites
    - [ ] Investigate why `createServerFn({ method }).inputValidator(Schema).handler(async ({ data }) => { const { handler } = await import('./feature.server'); return handler({ data }); })` doesn't propagate the handler's return type to client callers
    - [ ] Document the root cause (likely: dynamic `await import()` breaks type inference, or `createServerFn`'s generic doesn't capture the handler return type through the builder chain)
    - [ ] Verify: root cause is documented and understood

- [ ] Task: Write type-level test (failing — confirms the gap exists)
    - [ ] Create `tests/unit/types/server-fn-types.test-d.ts`
    - [ ] Write `expectTypeOf` or `@ts-expect-error` assertions demonstrating that a `createServerFn` stub's return type is `unknown` at the call site (before the fix)
    - [ ] Run `pnpm typecheck` — confirm the type-level test fails (the gap exists)
    - [ ] Verify: type-level test fails as expected, confirming the gap

- [ ] Task: Conductor - User Manual Verification 'Phase 1: Root-Cause Diagnosis & Type-Level Test' (Protocol in workflow.md)

---

## Phase 2: Type Fix at Source

- [ ] Task: Read spec.md and workflow.md to refresh context for this phase
    - [ ] Read `./spec.md` for requirements, scope boundaries, and acceptance criteria
    - [ ] Read `conductor/workflow.md` for TDD lifecycle and quality gates
    - [ ] Verify: context is refreshed and understood

- [ ] Task: Write unit test for `typedServerFn` wrapper (Red Phase)
    - [ ] Create `tests/unit/lib/server-fn.test.ts` (or `test-d.ts` for type-level assertions)
    - [ ] Write tests asserting: (1) `typedServerFn` preserves the `.inputValidator(Schema).handler(fn)` builder chain API, (2) the handler's return type propagates to the callable stub, (3) runtime behavior is identical to `createServerFn`
    - [ ] Run `pnpm test` — confirm tests fail (wrapper doesn't exist yet)
    - [ ] Verify: tests fail as expected

- [ ] Task: Implement `src/lib/server-fn.ts` with `typedServerFn` wrapper (Green Phase)
    - [ ] Create `src/lib/server-fn.ts` exporting `typedServerFn` that wraps `createServerFn` with proper generic return-type inference
    - [ ] The wrapper must preserve the `.inputValidator(Schema).handler(fn)` builder chain API
    - [ ] The wrapper must propagate the handler's return type to the callable stub (no `unknown` at call sites)
    - [ ] The wrapper must be a type-only change at runtime (delegates to `createServerFn`)
    - [ ] Run `pnpm test` — confirm wrapper tests pass
    - [ ] Run `pnpm typecheck` — confirm no new type errors
    - [ ] Verify: wrapper tests pass, typecheck clean

- [ ] Task: Update type-level test to verify `typedServerFn` fixes the gap
    - [ ] Update `tests/unit/types/server-fn-types.test-d.ts` to assert that `typedServerFn` stub's return type propagates correctly (no longer `unknown`)
    - [ ] Run `pnpm typecheck` — confirm type-level test now passes
    - [ ] Verify: type-level test passes, confirming the fix works

- [ ] Task: Migrate server-function stubs to `typedServerFn` (batch 1: core features)
    - [ ] Migrate `src/server/assignments.ts` — replace `createServerFn` import with `typedServerFn` from `@/lib/server-fn`
    - [ ] Migrate `src/server/submissions.ts`
    - [ ] Migrate `src/server/notifications.ts`
    - [ ] Migrate `src/server/reviews.ts`
    - [ ] Migrate `src/server/settings.ts`
    - [ ] Run `pnpm typecheck` after each file — catch any inference gaps immediately
    - [ ] Verify: typecheck clean after batch 1

- [ ] Task: Migrate server-function stubs to `typedServerFn` (batch 2: remaining stubs)
    - [ ] Migrate `src/server/consultations.ts`
    - [ ] Migrate `src/server/extensions.ts`
    - [ ] Migrate `src/server/discussions.ts`
    - [ ] Migrate `src/server/gradebook.ts`
    - [ ] Migrate `src/server/dashboard.ts`
    - [ ] Migrate `src/server/templates.ts`
    - [ ] Migrate `src/server/users.ts`
    - [ ] Migrate `src/server/email-queue.ts`
    - [ ] Migrate `src/server/audit-logs.ts`
    - [ ] Migrate `src/server/analytics.ts`
    - [ ] Migrate any other `src/server/*.ts` stub files found via grep
    - [ ] Run `pnpm typecheck` after each file
    - [ ] Run `pnpm test:unit` — confirm all existing tests pass (test mocks for `@tanstack/react-start` should still work since `typedServerFn` delegates to `createServerFn` at runtime)
    - [ ] Verify: typecheck clean, all tests pass

- [ ] Task: Verify quality gates for Phase 2
    - [ ] Run `pnpm typecheck` — 0 errors
    - [ ] Run `pnpm test:coverage` — ≥80% on all thresholds
    - [ ] Run `pnpm lint` — 0 warnings, 0 errors
    - [ ] Run `pnpm check:i18n` — parity maintained
    - [ ] Verify: all quality gates pass

- [ ] Task: Conductor - User Manual Verification 'Phase 2: Type Fix at Source' (Protocol in workflow.md)

---

## Phase 3: Cast Elimination

- [ ] Task: Read spec.md and workflow.md to refresh context for this phase
    - [ ] Read `./spec.md` for requirements, scope boundaries, and acceptance criteria
    - [ ] Read `conductor/workflow.md` for TDD lifecycle and quality gates
    - [ ] Verify: context is refreshed and understood

- [ ] Task: Remove `as unknown as` casts from hooks (7 casts, 2 files)
    - [ ] Remove 4 casts from `src/hooks/use-notifications.ts` — server fn calls should now have proper return types via `typedServerFn`
    - [ ] Remove 3 casts from `src/hooks/use-assignment-tabs.ts`
    - [ ] Run `pnpm typecheck` after each file — confirm no type errors
    - [ ] Verify: zero `as unknown as` in `src/hooks/`

- [ ] Task: Remove `as unknown as` casts from settings components (13 casts, 5 files)
    - [ ] Remove 4 casts from `src/components/settings/TwoFactorSettings.tsx`
    - [ ] Remove 3 casts from `src/components/settings/SessionManagement.tsx`
    - [ ] Remove 2 casts from `src/components/settings/ProfileSection.tsx`
    - [ ] Remove 2 casts from `src/components/settings/NotificationPreferencesSection.tsx`
    - [ ] Remove 2 casts from `src/components/settings/AccessibilitySection.tsx`
    - [ ] Run `pnpm typecheck` after each file
    - [ ] Verify: typecheck clean, zero casts in settings components

- [ ] Task: Remove `as unknown as` casts from review/consultation/discussion components (12 casts, 6 files)
    - [ ] Remove 2 casts from `src/components/reviews/ReviewForm.tsx`
    - [ ] Remove 2 casts from `src/components/reviews/DeadlineManager.tsx`
    - [ ] Remove 1 cast from `src/components/student/extensions/ExtensionRequestForm.tsx`
    - [ ] Remove 1 cast from `src/components/consultations/ConsultationForm.tsx`
    - [ ] Remove 3 casts from `src/components/consultations/VerificationDialog.tsx`
    - [ ] Remove 3 casts from `src/components/discussions/discussion-panel.tsx`
    - [ ] Run `pnpm typecheck` after each file
    - [ ] Verify: typecheck clean, zero casts in these components

- [ ] Task: Remove `as unknown as` casts from admin/instructor components (8 casts, 4 files)
    - [ ] Remove 3 casts from `src/components/admin/templates/TemplateDetailPage.tsx`
    - [ ] Remove 3 casts from `src/components/instructor/assignments/AssignmentWizard.tsx`
    - [ ] Remove 1 cast from `src/components/instructor/assignments/StudentPicker.tsx`
    - [ ] Remove 1 cast from `src/components/instructor/assignments/TemplatePicker.tsx`
    - [ ] Run `pnpm typecheck` after each file
    - [ ] Verify: typecheck clean, zero casts in admin/instructor components

- [ ] Task: Remove `as unknown as` casts from routes (11 casts, 6 files)
    - [ ] Remove 1 cast from `src/routes/_authenticated/student/dashboard.tsx` (loader data cast)
    - [ ] Remove 1 cast from `src/routes/_authenticated/admin/dashboard.tsx` (loader data cast)
    - [ ] Remove 2 casts from `src/routes/_authenticated/admin/analytics.tsx` (loader data + server fn casts)
    - [ ] Remove 2 casts from `src/routes/_authenticated/instructor/analytics.tsx` (loader data + server fn casts)
    - [ ] Remove 7 casts from `src/routes/_authenticated/student/assignments/$id.checkpoints.$checkpointId.tsx` (loader data + server fn casts)
    - [ ] Remove 6 casts from `src/routes/_authenticated/student/assignments/$id.tsx` (loader data + server fn casts)
    - [ ] Run `pnpm typecheck` after each file
    - [ ] Verify: typecheck clean, only `_authenticated.tsx` and `_unauthenticated.tsx` redirect casts remain in routes

- [ ] Task: Remove Drizzle query-result casts from server files (5 casts, 3 files)
    - [ ] Remove 1 cast from `src/server/analytics-export.server.ts` — replace `as unknown as ScoreRow[]` with `$type<RowShape>()` or explicit interface annotation
    - [ ] Remove 3 casts from `src/server/gradebook.server.ts` — use Drizzle `$type<T>()` on query builders or explicit interfaces for raw SQL
    - [ ] Remove 1 cast from `src/server/reviews-extras.server.ts` — use Drizzle `$type<T>()` or explicit interface
    - [ ] Run `pnpm typecheck` after each file
    - [ ] Verify: typecheck clean, zero Drizzle casts in server files

- [ ] Task: Remove Drizzle query-result casts from lib files (3 casts, 2 files)
    - [ ] Remove 1 cast from `src/lib/email-queue-processor.ts` — use Drizzle `$type<T>()` or explicit interface
    - [ ] Remove 2 casts from `src/lib/email-queue-retention.ts` — use Drizzle `$type<T>()` or explicit interfaces
    - [ ] Run `pnpm typecheck` after each file
    - [ ] Verify: typecheck clean, zero Drizzle casts in lib files

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
