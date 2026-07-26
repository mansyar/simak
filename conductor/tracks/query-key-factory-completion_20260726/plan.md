<protect>
# Implementation Plan: Query-Key Factory Completion & Client Data-Fetching Consistency (TRACK-029)

## Phase 1: Query-Key Factory Completion + Settings Migration

- [x] Task: Read `spec.md` and `workflow.md` to ground implementation context
    - [x] Re-read `conductor/tracks/query-key-factory-completion_20260726/spec.md`
    - [x] Re-read `conductor/workflow.md` (TDD lifecycle, Phase Completion Verification & Checkpointing Protocol)

- [x] Task: Write unit tests for `settingsKeys` and `gradebookKeys` factory functions [91e3e93]
    - [x] Create `tests/unit/lib/query-keys.test.ts` (or extend if exists)
    - [x] Test `settingsKeys.currentUser()` returns `['settings', 'currentUser'] as const`
    - [x] Test `settingsKeys.activeSessions()` returns `['settings', 'activeSessions'] as const`
    - [x] Test `settingsKeys.twoFactorStatus()` returns `['settings', 'twoFactorStatus'] as const`
    - [x] Test `settingsKeys.accessibility()` returns `['settings', 'accessibility'] as const`
    - [x] Test `gradebookKeys.studentFinalGrade(assignmentId)` returns `['gradebook', 'studentFinalGrade', assignmentId] as const`
    - [x] Run `pnpm test` — confirm tests fail (factories don't exist yet)

- [x] Task: Implement `settingsKeys` and `gradebookKeys` in `src/lib/query-keys.ts` [91e3e93]
    - [x] Add `settingsKeys` factory with 4 sub-keys (`currentUser`, `activeSessions`, `twoFactorStatus`, `accessibility`) following existing pattern (`as const` return types)
    - [x] Add `gradebookKeys` factory with `studentFinalGrade(assignmentId: number)` sub-key
    - [x] Run `pnpm test` — confirm factory unit tests now pass
    - [x] Run `pnpm typecheck` — confirm no type errors

- [ ] Task: Write/update tests for settings components migration
    - [ ] Update `tests/unit/components/settings/profile-section.test.tsx` (or create if missing) — assert `useQuery` uses `settingsKeys.currentUser()`, assert `updateNameMutation` has `onSettled` invalidation calling `queryClient.invalidateQueries({ queryKey: settingsKeys.currentUser() })`
    - [ ] Update tests for `SessionManagement`, `TwoFactorSettings`, `AccessibilitySection`, `NotificationPreferencesSection` — assert factory keys used instead of inline arrays
    - [ ] Run `pnpm test` — confirm updated tests fail (components still use inline keys)

- [ ] Task: Migrate 5 settings components to factory keys + fix ProfileSection invalidation bug
    - [ ] `ProfileSection.tsx`: Replace `queryKey: ['currentUser']` with `settingsKeys.currentUser()`; add `onSettled: () => queryClient.invalidateQueries({ queryKey: settingsKeys.currentUser() })` to `updateNameMutation`
    - [ ] `SessionManagement.tsx`: Replace `queryKey: ['activeSessions']` with `settingsKeys.activeSessions()`; update `invalidateQueries` calls
    - [ ] `TwoFactorSettings.tsx`: Replace `queryKey: ['twoFactorStatus']` with `settingsKeys.twoFactorStatus()`; update `invalidateQueries` calls
    - [ ] `AccessibilitySection.tsx`: Replace inline key with `settingsKeys.accessibility()`; update `invalidateQueries` calls
    - [ ] `NotificationPreferencesSection.tsx`: Replace `queryKey: ['currentUser']` with `settingsKeys.currentUser()` (line 112); update `invalidateQueries` call (line 138)
    - [ ] Run `pnpm test` — confirm all settings tests pass
    - [ ] Run `pnpm typecheck` — confirm no type errors
    - [ ] Grep `src/components/settings/` for `queryKey: ['` — confirm zero matches

- [ ] Task: Conductor - User Manual Verification 'Phase 1: Query-Key Factory Completion + Settings Migration' (Protocol in workflow.md)

## Phase 2: Gradebook TanStack Query Migration

- [ ] Task: Read `spec.md` and `workflow.md` to ground implementation context
    - [ ] Re-read `conductor/tracks/query-key-factory-completion_20260726/spec.md`
    - [ ] Re-read `conductor/workflow.md` (TDD lifecycle, Phase Completion Verification & Checkpointing Protocol)

- [ ] Task: Write/update tests for `StudentFinalGradeCard` using `useQuery`
    - [ ] Update `tests/unit/components/student-final-grade-card.test.tsx` (or create if missing) — wrap in `QueryClientProvider`, assert `useQuery` with `gradebookKeys.studentFinalGrade(assignmentId)`, assert skeleton shown while loading, assert grade shown on success, assert error state on failure
    - [ ] Run `pnpm test` — confirm tests fail (component still uses `useState`/`useEffect`)

- [ ] Task: Migrate `StudentFinalGradeCard.tsx` from `useState`/`useEffect` to `useQuery`
    - [ ] Replace `useState(grade)` + `useState(loading)` + `useState(error)` + `useEffect` manual fetch (lines 14-36) with `useQuery({ queryKey: gradebookKeys.studentFinalGrade(assignmentId), queryFn: ... })`
    - [ ] Update loading/error rendering to use `isPending`/`isError` from `useQuery`
    - [ ] Run `pnpm test` — confirm StudentFinalGradeCard tests pass
    - [ ] Run `pnpm typecheck` — confirm no type errors

- [ ] Task: Write/update tests for `RecomputeGradesButton` using `useMutation` with dual invalidation
    - [ ] Update `tests/unit/components/recompute-grades-button.test.tsx` (or create if missing) — assert `useMutation` used, assert `onSuccess` calls both `queryClient.invalidateQueries({ queryKey: gradebookKeys.studentFinalGrade(assignmentId) })` AND `router.invalidate()`, assert error toast on `onError`
    - [ ] Run `pnpm test` — confirm tests fail (component still uses `useState`/`async`)

- [ ] Task: Migrate `RecomputeGradesButton.tsx` from `useState`/`async` to `useMutation`
    - [ ] Replace `useState(loading)` + inline async handler with try/catch/finally (lines 24-43) with `useMutation`
    - [ ] Add `onSuccess` callback calling both `queryClient.invalidateQueries({ queryKey: gradebookKeys.studentFinalGrade(assignmentId) })` and `router.invalidate()`
    - [ ] Add `onError` callback for error toast (verify existing i18n key or add `gradebook.recomputeError` to both locales if missing)
    - [ ] Run `pnpm test` — confirm RecomputeGradesButton tests pass
    - [ ] Run `pnpm typecheck` — confirm no type errors
    - [ ] Verify gradebook route page (`$id.gradebook.tsx`) `handleSaveConfig` is unchanged (keeps `router.invalidate()` for SSR loader data)

- [ ] Task: Conductor - User Manual Verification 'Phase 2: Gradebook TanStack Query Migration' (Protocol in workflow.md)

## Phase 3: Full Audit + Final Verification

- [ ] Task: Read `spec.md` and `workflow.md` to ground implementation context
    - [ ] Re-read `conductor/tracks/query-key-factory-completion_20260726/spec.md`
    - [ ] Re-read `conductor/workflow.md` (TDD lifecycle, Phase Completion Verification & Checkpointing Protocol)

- [ ] Task: Audit all `src/**/*.tsx` files for remaining inline query keys
    - [ ] Grep for `queryKey: ['` across all `.tsx` files in `src/`
    - [ ] Document all found instances and their domains
    - [ ] For each found inline key, determine the appropriate factory domain (add new factory entries to `query-keys.ts` if needed)

- [ ] Task: Write tests for any newly discovered inline-key migrations
    - [ ] For each additional domain found in the audit, write/update tests asserting factory key usage
    - [ ] Run `pnpm test` — confirm tests fail for un-migrated components

- [ ] Task: Migrate all remaining inline keys to factory calls
    - [ ] Replace each found inline `queryKey: ['...']` with appropriate factory call
    - [ ] Update all associated `queryClient.invalidateQueries` calls to use factory keys
    - [ ] If a key is intentionally inline (one-off query), add a code comment documenting the exception
    - [ ] Run `pnpm test` — confirm all tests pass
    - [ ] Run `pnpm typecheck` — confirm no type errors
    - [ ] Grep `src/**/*.tsx` for `queryKey: ['` — confirm zero matches (excluding documented exceptions)

- [ ] Task: Run full quality gate suite
    - [ ] Run `pnpm test:coverage` — confirm ≥80% on all thresholds (lines/stmts/branches/funcs)
    - [ ] Run `pnpm typecheck` — confirm clean
    - [ ] Run `pnpm lint` — confirm 0 warnings, 0 errors
    - [ ] Run `pnpm check:i18n` — confirm EN↔ID parity maintained
    - [ ] Verify all files under 500 lines (`node scripts/check-modularity.js`)
    - [ ] Verify pre-push gate passes (`pnpm typecheck && pnpm vitest run --coverage`)

- [ ] Task: Conductor - User Manual Verification 'Phase 3: Full Audit + Final Verification' (Protocol in workflow.md)
</protect>
