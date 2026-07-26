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

- [x] Task: Write/update tests for settings components migration [8a753fe4]
    - [x] Update `tests/unit/components/settings/profile-section.test.tsx` (or create if missing) — assert `useQuery` uses `settingsKeys.currentUser()`, assert `updateNameMutation` has `onSettled` invalidation calling `queryClient.invalidateQueries({ queryKey: settingsKeys.currentUser() })`
    - [x] Update tests for `SessionManagement`, `TwoFactorSettings`, `AccessibilitySection`, `NotificationPreferencesSection` — assert factory keys used instead of inline arrays
    - [x] Run `pnpm test` — confirm updated tests fail (components still use inline keys)

- [x] Task: Migrate 5 settings components to factory keys + fix ProfileSection invalidation bug [8a753fe4]
    - [x] `ProfileSection.tsx`: Replace `queryKey: ['currentUser']` with `settingsKeys.currentUser()`; add `onSettled: () => queryClient.invalidateQueries({ queryKey: settingsKeys.currentUser() })` to `updateNameMutation`
    - [x] `SessionManagement.tsx`: Replace `queryKey: ['activeSessions']` with `settingsKeys.activeSessions()`; update `invalidateQueries` calls
    - [x] `TwoFactorSettings.tsx`: Replace `queryKey: ['twoFactorStatus']` with `settingsKeys.twoFactorStatus()`; update `invalidateQueries` calls
    - [x] `AccessibilitySection.tsx`: Replace inline key with `settingsKeys.accessibility()`; update `invalidateQueries` calls
    - [x] `NotificationPreferencesSection.tsx`: Replace `queryKey: ['currentUser']` with `settingsKeys.currentUser()` (line 112); update `invalidateQueries` call (line 138)
    - [x] Run `pnpm test` — confirm all settings tests pass
    - [x] Run `pnpm typecheck` — confirm no type errors
    - [x] Grep `src/components/settings/` for `queryKey: ['` — confirm zero matches

- [x] Task: Conductor - User Manual Verification 'Phase 1: Query-Key Factory Completion + Settings Migration' (Protocol in workflow.md) [checkpoint: 3b6cfd87]

## Phase 2: Gradebook TanStack Query Migration

- [x] Task: Read `spec.md` and `workflow.md` to ground implementation context
    - [x] Re-read `conductor/tracks/query-key-factory-completion_20260726/spec.md`
    - [x] Re-read `conductor/workflow.md` (TDD lifecycle, Phase Completion Verification & Checkpointing Protocol)

- [x] Task: Write/update tests for `StudentFinalGradeCard` using `useQuery` [5669a090]
    - [x] Update `tests/unit/components/student-final-grade-card.test.tsx` (or create if missing) — wrap in `QueryClientProvider`, assert `useQuery` with `gradebookKeys.studentFinalGrade(assignmentId)`, assert skeleton shown while loading, assert grade shown on success, assert error state on failure
    - [x] Run `pnpm test` — confirm tests fail (component still uses `useState`/`useEffect`)

- [x] Task: Migrate `StudentFinalGradeCard.tsx` from `useState`/`useEffect` to `useQuery` [5669a090]
    - [x] Replace `useState(grade)` + `useState(loading)` + `useState(error)` + `useEffect` manual fetch (lines 14-36) with `useQuery({ queryKey: gradebookKeys.studentFinalGrade(assignmentId), queryFn: ... })`
    - [x] Update loading/error rendering to use `isPending`/`isError` from `useQuery`
    - [x] Run `pnpm test` — confirm StudentFinalGradeCard tests pass
    - [x] Run `pnpm typecheck` — confirm no type errors

- [x] Task: Write/update tests for `RecomputeGradesButton` using `useMutation` with dual invalidation [5669a090]
    - [x] Update `tests/unit/components/recompute-grades-button.test.tsx` (or create if missing) — assert `useMutation` used, assert `onSuccess` calls both `queryClient.invalidateQueries({ queryKey: gradebookKeys.studentFinalGrade(assignmentId) })` AND `router.invalidate()`, assert error toast on `onError`
    - [x] Run `pnpm test` — confirm tests fail (component still uses `useState`/`async`)

- [x] Task: Migrate `RecomputeGradesButton.tsx` from `useState`/`async` to `useMutation` [5669a090]
    - [x] Replace `useState(loading)` + inline async handler with try/catch/finally (lines 24-43) with `useMutation`
    - [x] Add `onSuccess` callback calling both `queryClient.invalidateQueries({ queryKey: gradebookKeys.studentFinalGrade(assignmentId) })` and `router.invalidate()`
    - [x] Add `onError` callback for error toast (verify existing i18n key or add `gradebook.recomputeError` to both locales if missing)
    - [x] Run `pnpm test` — confirm RecomputeGradesButton tests pass
    - [x] Run `pnpm typecheck` — confirm no type errors
    - [x] Verify gradebook route page (`$id.gradebook.tsx`) `handleSaveConfig` is unchanged (keeps `router.invalidate()` for SSR loader data)

- [x] Task: Conductor - User Manual Verification 'Phase 2: Gradebook TanStack Query Migration' (Protocol in workflow.md) [checkpoint: 16014dfc]

## Phase 3: Full Audit + Final Verification

- [x] Task: Read `spec.md` and `workflow.md` to ground implementation context
    - [x] Re-read `conductor/tracks/query-key-factory-completion_20260726/spec.md`
    - [x] Re-read `conductor/workflow.md` (TDD lifecycle, Phase Completion Verification & Checkpointing Protocol)

- [x] Task: Audit all `src/**/*.tsx` files for remaining inline query keys
    - [x] Grep for `queryKey: ['` across all `.tsx` files in `src/`
    - [x] Document all found instances and their domains
    - [x] For each found inline key, determine the appropriate factory domain (add new factory entries to `query-keys.ts` if needed)
    - [x] Result: ZERO inline query keys found — all `queryKey:` usages already use factory function calls across all 9 domains

- [x] Task: Write tests for any newly discovered inline-key migrations
    - [x] For each additional domain found in the audit, write/update tests asserting factory key usage
    - [x] Run `pnpm test` — confirm tests fail for un-migrated components
    - [x] Result: No-op — no newly discovered inline keys to write tests for

- [x] Task: Migrate all remaining inline keys to factory calls
    - [x] Replace each found inline `queryKey: ['...']` with appropriate factory call
    - [x] Update all associated `queryClient.invalidateQueries` calls to use factory keys
    - [x] If a key is intentionally inline (one-off query), add a code comment documenting the exception
    - [x] Run `pnpm test` — confirm all tests pass
    - [x] Run `pnpm typecheck` — confirm no type errors
    - [x] Grep `src/**/*.tsx` for `queryKey: ['` — confirm zero matches (excluding documented exceptions)
    - [x] Result: No-op — no remaining inline keys to migrate

- [x] Task: Run full quality gate suite
    - [x] Run `pnpm test:coverage` — confirm ≥80% on all thresholds (lines/stmts/branches/funcs)
    - [x] Run `pnpm typecheck` — confirm clean
    - [x] Run `pnpm lint` — confirm 0 warnings, 0 errors
    - [x] Run `pnpm check:i18n` — confirm EN↔ID parity maintained
    - [x] Verify all files under 500 lines (`node scripts/check-modularity.js`)
    - [x] Verify pre-push gate passes (`pnpm typecheck && pnpm vitest run --coverage`)

- [x] Task: Conductor - User Manual Verification 'Phase 3: Full Audit + Final Verification' (Protocol in workflow.md) [checkpoint: 174f6c6a]

## Phase: Review Fixes
- [x] Task: Apply review suggestions [15633523]
</protect>
