<protect>
# Track: Optimistic UI Updates for Mutations

## Overview

**Audit ID:** ENH-PERF-1  
**Track Type:** Feature (with prerequisite refactor)  
**Estimated Effort:** 7 Days / 3.5 Sprint Loops  
**Dependencies:** None (self-contained; introduces query-key factory consumed by later tracks)  

Currently, all TanStack Query mutations in SIMAK wait for the full server round-trip before reflecting state changes, causing perceived latency on every action. This track adds optimistic UI updates with rollback to 9 mutation sites. As a prerequisite, 5 plain `async`+`useState` mutation patterns are refactored to `useMutation`+`useQuery` to establish a consistent React Query architecture, and a typed query-key factory is introduced.

## Functional Requirements

### FR-1: Query-Key Factory

- Create `src/lib/query-keys.ts` with typed key factories for the 5 feature domains touched by the 9 mutation sites: `notificationKeys`, `consultationKeys`, `extensionKeys`, `assignmentKeys`, `userKeys`.
- Migrate only the inline query key arrays used by the 9 mutation sites and their related queries to use the factory. Other features keep inline keys until touched.

### FR-2: React Query Migration (5 mutations)

Refactor 5 plain `async`+`useState` mutation patterns to `useMutation`+`useQuery`:

- **`verifyConsultation` / `rejectConsultation`** (in `VerificationDialog.tsx`) — introduce `useQuery` for the pending-consultations cache.
- **`approveExtension` / `rejectExtension`** (in `use-assignment-tabs.ts`) — introduce `useQuery` for the extension-requests cache.
- **`deleteUser`** (in `admin/users/index.tsx`) — introduce `useQuery` for the user-list cache.

After migration, all 9 mutation sites use `useMutation` and data flows through the query cache. Existing behavior (refetch-on-success) is preserved — no optimistic logic yet.

### FR-3: DeadlineManager Invalidation Fix

- Fix `unlockMutation` and `extendMutation` in `DeadlineManager.tsx` — add `queryClient.invalidateQueries` for the parent assignment query key in `onSuccess`. Currently these mutations only toast on success and never invalidate the cache, leaving the deadline list stale until manual refresh.

### FR-4: Optimistic Updates (9 sites)

Add `onMutate`/`onError`/`onSettled` optimistic update logic to all 9 mutation hooks:

1. **`useMarkRead`** — flip `read: true` on the targeted notification in the `useNotificationsList` cache; decrement `useUnreadCount` optimistically.
2. **`useMarkAllRead`** — flip `read: true` on all notifications in the list cache; set `useUnreadCount` to 0 optimistically.
3. **`verifyConsultation`** (after refactor) — flip `status` to `verified` in the pending-consultations cache; remove from pending list optimistically.
4. **`rejectConsultation`** (after refactor) — flip `status` to `rejected`; remove from pending list optimistically.
5. **`approveExtension`** (after refactor) — remove from pending extension queue optimistically.
6. **`rejectExtension`** (after refactor) — remove from pending extension queue optimistically.
7. **`unlockCheckpoint`** — reflect state change in the assignment detail cache (after invalidation fix).
8. **`extendDeadline`** — reflect `dueDate` change in the assignment detail cache (after invalidation fix).
9. **`deleteUser`** (after refactor) — remove row from user list optimistically.

### FR-5: Rollback Contract

- Every optimistic mutation captures the previous cache snapshot in `onMutate` (via `queryClient.getQueryData`) and restores it verbatim in `onError` before refetching.
- On rollback, show `toast.error()` with the server's error message so the user sees both the visual revert and an explanation.

### FR-6: Scope Guard

- Optimistic updates are applied ONLY where the predicted state is deterministic (e.g., mark-as-read flips `read: true`; verify consultation flips `status: 'verified'`).
- Do NOT apply optimistic updates to mutations whose server response carries computed/derived data the client can't predict (e.g., `submitReview` which unlocks the next checkpoint and adjusts deadlines server-side). Those keep the current refetch-on-success flow.

## Non-Functional Requirements

- **Performance:** Optimistic updates eliminate perceived latency for the 9 mutation sites. UI reflects state changes immediately on click, before the server responds.
- **Consistency:** All 9 mutation sites use `useMutation` with the standard TanStack Query `onMutate`/`onError`/`onSettled` pattern. No plain `async`+`useState` mutation patterns remain for these features.
- **Testability:** Each `useMutation` hook has hook-level unit tests verifying: optimistic cache mutation in `onMutate`, snapshot capture, rollback restoration in `onError`, invalidation in `onSettled`.
- **Coverage:** ≥80% on lines, statements, branches, and functions.
- **File limit:** All files ≤500 lines.
- **i18n:** No new user-visible strings required (error toasts use existing i18n keys or server-returned messages).

## Acceptance Criteria

1. **AC-1:** `src/lib/query-keys.ts` exists with typed key factories for `notificationKeys`, `consultationKeys`, `extensionKeys`, `assignmentKeys`, `userKeys`. All 9 mutation sites and their related queries reference factory keys.
2. **AC-2:** `grep -r "useMutation" src/` confirms all 9 mutation sites use `useMutation` (no plain `async`+`useState` mutation patterns remain for these features).
3. **AC-3:** `grep` for `onMutate` in `src/` confirms all 9 mutation hooks have optimistic logic.
4. **AC-4:** Click "Mark all read" — unread badge drops to 0 instantly (before server responds), stays 0 on success, returns to prior count with an error toast if the server errors.
5. **AC-5:** Verify a consultation — it disappears from the pending queue instantly; reappears with an error toast if the server returns "already processed".
6. **AC-6:** Delete a user — row fades out instantly; reappears with an error toast if the instructor has active assignments (server rejects).
7. **AC-7:** `DeadlineManager.tsx` `unlockMutation` and `extendMutation` call `queryClient.invalidateQueries` in `onSuccess`.
8. **AC-8:** `pnpm test:unit` passes with new hook-level tests for each of the 9 mutation hooks. Coverage ≥80%.
9. **AC-9:** `pnpm typecheck`, `pnpm lint`, `pnpm check:i18n` all pass.

## Out of Scope

- Optimistic updates for `submitReview`, `submitCheckpoint`, `createAssignment`, `bulkCreateUsers` (server response carries derived data the client can't predict).
- Optimistic updates for file upload (R2 PUT is external I/O; success is binary).
- WebSocket/SSE real-time push (separate future feature).
- Migrating the entire codebase to query-key factories — only the 9 mutation sites and their related queries are migrated; other features keep inline keys until touched.
- Retry button in error toasts (rollback shows error message only, no retry action).
- Component-level or integration tests for optimistic behavior (hook-level unit tests only).
</protect>
