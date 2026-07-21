# Implementation Plan: Optimistic UI Updates for Mutations

## Phase 0: Query-Key Factory + React Query Migration

- [ ] Task: Create `src/lib/query-keys.ts` with typed key factories
    - [ ] Write failing tests for query-key factory functions (`notificationKeys`, `consultationKeys`, `extensionKeys`, `assignmentKeys`, `userKeys`) — verify each factory returns the correct key structure
    - [ ] Implement `src/lib/query-keys.ts` with typed key factories for the 5 feature domains
    - [ ] Run `pnpm test` — confirm new tests pass
    - [ ] Run `pnpm typecheck` — confirm no type errors
- [ ] Task: Refactor `verifyConsultation`/`rejectConsultation` to `useMutation`+`useQuery` (VerificationDialog.tsx)
    - [ ] Write failing tests for the refactored hooks — verify `useMutation` is used, `useQuery` fetches pending consultations, existing behavior preserved (refetch-on-success, no optimistic logic yet)
    - [ ] Refactor `VerificationDialog.tsx` — replace plain `async`+`useState` with `useMutation` + `useQuery` for pending-consultations cache. Use `consultationKeys` from factory
    - [ ] Run `pnpm test` — confirm tests pass and existing behavior unchanged
- [ ] Task: Refactor `approveExtension`/`rejectExtension` to `useMutation`+`useQuery` (use-assignment-tabs.ts)
    - [ ] Write failing tests for the refactored hooks — verify `useMutation` is used, `useQuery` fetches extension requests, existing behavior preserved
    - [ ] Refactor `use-assignment-tabs.ts` — replace plain `useCallback`+`useState` with `useMutation` + `useQuery` for extension-requests cache. Use `extensionKeys` from factory
    - [ ] Run `pnpm test` — confirm tests pass and existing behavior unchanged
- [ ] Task: Refactor `deleteUser` to `useMutation`+`useQuery` (admin/users/index.tsx)
    - [ ] Write failing tests for the refactored hook — verify `useMutation` is used, `useQuery` fetches user list, existing behavior preserved
    - [ ] Refactor `admin/users/index.tsx` — replace `useServerFn` direct call with `useMutation` + `useQuery` for user-list cache. Use `userKeys` from factory
    - [ ] Run `pnpm test` — confirm tests pass and existing behavior unchanged
- [ ] Task: Fix DeadlineManager invalidation (DeadlineManager.tsx)
    - [ ] Write failing test — verify `queryClient.invalidateQueries` is called with the assignment query key in `onSuccess` for both `unlockMutation` and `extendMutation`
    - [ ] Add `queryClient.invalidateQueries` call to `onSuccess` in both `unlockMutation` and `extendMutation`. Use `assignmentKeys` from factory
    - [ ] Run `pnpm test` — confirm tests pass
- [ ] Task: Migrate existing inline query keys for the 9 mutation sites to factory keys
    - [ ] Update `use-notifications.ts` (`useMarkRead`, `useMarkAllRead`, `useNotificationsList`, `useUnreadCount`) to use `notificationKeys` from factory
    - [ ] Update any remaining inline keys in the 9 mutation sites' related queries to use factory keys
    - [ ] Run `pnpm test` — confirm all tests pass after key migration
    - [ ] Run `pnpm typecheck` — confirm no type errors
- [ ] Task: Conductor - User Manual Verification 'Phase 0: Query-Key Factory + React Query Migration' (Protocol in workflow.md)

## Phase 1: Notification Hooks Optimistic Updates

- [ ] Task: Add optimistic updates to `useMarkRead` hook
    - [ ] Write failing tests — verify `onMutate` flips `read: true` on targeted notification in `useNotificationsList` cache and decrements `useUnreadCount`; `onError` restores snapshot; `onSettled` invalidates; `toast.error()` shown on rollback
    - [ ] Implement `onMutate`/`onError`/`onSettled` in `useMarkRead` — capture `queryClient.getQueryData` snapshot, mutate cache, return `{ previousData }` context, restore on error, invalidate on settle
    - [ ] Run `pnpm test` — confirm tests pass
- [ ] Task: Add optimistic updates to `useMarkAllRead` hook
    - [ ] Write failing tests — verify `onMutate` flips `read: true` on all notifications in list cache and sets `useUnreadCount` to 0; `onError` restores snapshot; `onSettled` invalidates; `toast.error()` shown on rollback
    - [ ] Implement `onMutate`/`onError`/`onSettled` in `useMarkAllRead` — same pattern as `useMarkRead` but for all items
    - [ ] Run `pnpm test` — confirm tests pass
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Notification Hooks Optimistic Updates' (Protocol in workflow.md)

## Phase 2: Consultation & Extension Hooks Optimistic Updates

- [ ] Task: Add optimistic updates to `verifyConsultation` hook (after Phase 0 refactor)
    - [ ] Write failing tests — verify `onMutate` flips `status` to `verified` and removes from pending list in consultations cache; `onError` restores snapshot + shows `toast.error()`; `onSettled` invalidates
    - [ ] Implement `onMutate`/`onError`/`onSettled` in `verifyConsultation` mutation
    - [ ] Run `pnpm test` — confirm tests pass
- [ ] Task: Add optimistic updates to `rejectConsultation` hook (after Phase 0 refactor)
    - [ ] Write failing tests — verify `onMutate` flips `status` to `rejected` and removes from pending list; `onError` restores snapshot + shows `toast.error()`; `onSettled` invalidates
    - [ ] Implement `onMutate`/`onError`/`onSettled` in `rejectConsultation` mutation
    - [ ] Run `pnpm test` — confirm tests pass
- [ ] Task: Add optimistic updates to `approveExtension` hook (after Phase 0 refactor)
    - [ ] Write failing tests — verify `onMutate` removes from pending extension queue optimistically; `onError` restores snapshot + shows `toast.error()`; `onSettled` invalidates
    - [ ] Implement `onMutate`/`onError`/`onSettled` in `approveExtension` mutation
    - [ ] Run `pnpm test` — confirm tests pass
- [ ] Task: Add optimistic updates to `rejectExtension` hook (after Phase 0 refactor)
    - [ ] Write failing tests — verify `onMutate` removes from pending extension queue optimistically; `onError` restores snapshot + shows `toast.error()`; `onSettled` invalidates
    - [ ] Implement `onMutate`/`onError`/`onSettled` in `rejectExtension` mutation
    - [ ] Run `pnpm test` — confirm tests pass
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Consultation & Extension Hooks Optimistic Updates' (Protocol in workflow.md)

## Phase 3: Deadline & User Hooks Optimistic Updates

- [ ] Task: Add optimistic updates to `unlockCheckpoint` (DeadlineManager.tsx)
    - [ ] Write failing tests — verify `onMutate` reflects state change (checkpoint `locked` → `unlocked`) in assignment detail cache; `onError` restores snapshot + shows `toast.error()`; `onSettled` invalidates
    - [ ] Implement `onMutate`/`onError`/`onSettled` in `unlockMutation`
    - [ ] Run `pnpm test` — confirm tests pass
- [ ] Task: Add optimistic updates to `extendDeadline` (DeadlineManager.tsx)
    - [ ] Write failing tests — verify `onMutate` reflects `dueDate` change in assignment detail cache; `onError` restores snapshot + shows `toast.error()`; `onSettled` invalidates
    - [ ] Implement `onMutate`/`onError`/`onSettled` in `extendMutation`
    - [ ] Run `pnpm test` — confirm tests pass
- [ ] Task: Add optimistic updates to `deleteUser` (admin/users/index.tsx, after Phase 0 refactor)
    - [ ] Write failing tests — verify `onMutate` removes row from user list cache optimistically; `onError` restores snapshot (re-adds row) + shows `toast.error()`; `onSettled` invalidates
    - [ ] Implement `onMutate`/`onError`/`onSettled` in `deleteUser` mutation
    - [ ] Run `pnpm test` — confirm tests pass
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Deadline & User Hooks Optimistic Updates' (Protocol in workflow.md)

## Phase 4: Audit & Regression

- [ ] Task: Verify all 9 mutation sites have optimistic logic
    - [ ] Run `grep -r "onMutate" src/` — confirm all 9 mutation hooks have `onMutate` optimistic logic
    - [ ] Run `grep -r "useMutation" src/` — confirm all 9 mutation sites use `useMutation` (no plain `async`+`useState` patterns remain for these features)
    - [ ] Verify `src/lib/query-keys.ts` exists and all migrated queries reference factory keys
- [ ] Task: Run full quality gate suite
    - [ ] Run `pnpm test:coverage` — confirm all tests pass and coverage ≥80% on all four metrics
    - [ ] Run `pnpm typecheck` — confirm clean
    - [ ] Run `pnpm lint` — confirm 0 warnings, 0 errors (including `simak-i18n/no-hardcoded`)
    - [ ] Run `pnpm check:i18n` — confirm parity
    - [ ] Verify all files ≤500 lines
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Audit & Regression' (Protocol in workflow.md)
