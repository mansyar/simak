<protect>
# Implementation Plan: NotificationCenter Infinite Query Migration (TRACK-030)

## Phase 1: Hook Conversion (useQuery → useInfiniteQuery)

- [x] Task: Read `spec.md` and `conductor/workflow.md` to re-establish context before implementation
- [x] Task: Write failing tests for `useNotificationsList` with `useInfiniteQuery` [SHA: 32a3c868]
    - [x] Update `tests/unit/hooks/use-notifications.test.tsx` — replace `useNotificationsList` tests to assert `useInfiniteQuery` behavior: `initialPageParam: 1`, `getNextPageParam` returns next page when `total > accumulated items`, returns `undefined` when all loaded, `queryKey` excludes `page` (uses `notificationKeys.list({ limit, type, unreadOnly })`), `staleTime: 30_000` preserved, `fetchNextPage` available on result
    - [x] Add test: `getNextPageParam` returns `2` when page 1 has fewer items than `total`
    - [x] Add test: `getNextPageParam` returns `undefined` when all items loaded
    - [x] Add test: `listNotifications` called with `page` from `pageParam` (not from options)
    - [x] Run `pnpm test` — confirm new tests fail (Red phase)
- [x] Task: Update `notificationKeys.list` factory to remove `page` from type signature [SHA: 32a3c868]
    - [x] Edit `src/lib/query-keys.ts` line 11 — change `list` filter type from `{ page?, limit?, type?, unreadOnly? }` to `{ limit?, type?, unreadOnly? }`
    - [x] Run `pnpm typecheck` — confirm type errors in `NotificationCenter.tsx` (callers passing `page`); hook file clean
- [x] Task: Convert `useNotificationsList` to `useInfiniteQuery` [SHA: 32a3c868]
    - [x] Edit `src/hooks/use-notifications.ts` — replace `useQuery` with `useInfiniteQuery`, update `useNotificationsList` to use `useInfiniteQuery` with `initialPageParam: 1`, `getNextPageParam`, `queryKey` without `page`, `queryFn` receives `{ pageParam }`, keep `staleTime: 30_000`
    - [x] Run `pnpm test` — confirm hook tests pass (Green phase)
    - [x] Run `pnpm typecheck` — confirm no type errors in hook file (component will still error — fixed in Phase 2)
    - [x] Split test file into `use-notifications.test.tsx` and `use-notifications-mutations.test.tsx` to stay under 500-line limit
- [x] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)

## Phase 2: Component Refactor (NotificationCenter)

- [x] Task: Read `spec.md` and `conductor/workflow.md` to re-establish context before implementation
- [x] Task: Write failing tests for `NotificationCenter` with infinite query data shape [SHA: 97377657]
    - [x] Update `tests/unit/components/notifications/notification-pagination.test.tsx` — mock `useInfiniteQuery` returning `{ pages: [{ items: [...], total: N }], pageParams: [1] }`, assert "Load More" button calls `fetchNextPage` (not `setCurrentPage`), assert accumulated items include all pages via `data.pages.flatMap`, assert `hasNextPage` controls button visibility, assert `isFetchingNextPage` shows spinner on Load More button only
    - [x] Update `tests/unit/components/notifications/notification-filter.test.tsx` — verify tab switch resets infinite query to page 1 (filter change creates new query entry)
    - [x] Run `pnpm test` — confirm new/updated component tests fail (Red phase)
- [x] Task: Refactor `NotificationCenter` component to use infinite query data [SHA: 97377657]
    - [x] Edit `src/components/notifications/NotificationCenter.tsx` — remove `useState<Notification[]>(allItems)` (line 47), remove `useEffect` accumulation/dedup (lines 56-67), remove `currentPage` state (line 46)
    - [x] Replace `items` computation: `const items = data?.pages.flatMap((p) => p.items) ?? []` (was `allItems`)
    - [x] Replace `total`: `const total = data?.pages[0]?.total ?? 0`
    - [x] Replace `hasMore` with `hasNextPage` from `useNotificationsList` return
    - [x] Replace Load More button `onClick`: `setCurrentPage((p) => p + 1)` → `fetchNextPage()`
    - [x] Replace Load More spinner: `isFetching` → `isFetchingNextPage`
    - [x] Replace Load More visibility: `hasMore` → `hasNextPage`
    - [x] Update `useNotificationsList` call: remove `page: currentPage` from options (no longer accepts `page`)
    - [x] Run `pnpm test` — confirm component tests pass (Green phase)
    - [x] Run `pnpm typecheck` — confirm no type errors
- [x] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

## Phase 3: Optimistic Mutation Rewrite + Full Test Suite

- [x] Task: Read `spec.md` and `conductor/workflow.md` to re-establish context before implementation
- [x] Task: Write failing tests for optimistic mutations with infinite query shape [SHA: 73305425]
    - [x] Update `tests/unit/hooks/use-notifications-mutations.test.tsx` — `useMarkRead`/`useMarkAllRead` optimistic tests: replace `queryClient.setQueryData(notificationKeys.list({ page: 1, limit: 20 }), mockList)` with infinite query shape `{ pages: [{ items: [...], total: N }], pageParams: [1] }`, assert optimistic update modifies items within `pages[0].items` (not top-level `items`), assert rollback restores full `{ pages, pageParams }` structure, assert `useUnreadCount` (number type) still decrements/zeroes correctly
    - [x] Add test: optimistic `markRead` updates the correct item across multiple pages (not just page 1)
    - [x] Add test: optimistic `markAllRead` updates items in all loaded pages
    - [x] Run `pnpm test` — confirm optimistic tests fail (Red phase — `'items' in old` check no-ops against `{ pages, pageParams }` shape)
- [x] Task: Rewrite `useMarkRead` and `useMarkAllRead` optimistic callbacks for infinite query shape [SHA: 73305425]
    - [x] Edit `src/hooks/use-notifications.ts` `useMarkRead` `onMutate` — replace `'items' in old` check with `'pages' in old`, then map over `old.pages` to update `items` within each page: `old.pages.map(page => ({ ...page, items: page.items.map(item => item.id === notificationId ? { ...item, read: true } : item) }))`
    - [x] Edit `src/hooks/use-notifications.ts` `useMarkAllRead` `onMutate` — same pattern: check `'pages' in old`, map over `old.pages` to set all items `read: true`
    - [x] Preserve `typeof old === 'number'` check for `useUnreadCount` (unchanged)
    - [x] Preserve `onError` rollback and `onSettled` invalidation (unchanged — `notificationKeys.all()` still works)
    - [x] Run `pnpm test` — confirm all optimistic tests pass (Green phase)
- [x] Task: Quality gate verification [SHA: 73305425]
    - [x] Run `pnpm test:coverage` — verify ≥80% on lines, statements, branches, functions
    - [x] Run `pnpm typecheck` — clean
    - [x] Run `pnpm lint` — 0 warnings, 0 errors (including `simak-i18n/no-hardcoded`)
    - [x] Run `pnpm check:i18n` — parity maintained (no new keys expected)
    - [x] Verify all files under 500 lines: `use-notifications.ts`, `NotificationCenter.tsx`, `query-keys.ts`, all test files
    - [x] Grep verification: `allItems` and `existingIds` return zero matches in `NotificationCenter.tsx`; `'items' in old` returns zero matches in `use-notifications.ts`; `setCurrentPage` returns zero matches in `NotificationCenter.tsx`
- [x] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)

## Phase: Review Fixes
- [x] Task: Apply review suggestions 545e66b
</protect>
