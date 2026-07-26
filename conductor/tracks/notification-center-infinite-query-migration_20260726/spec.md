# Track Specification: NotificationCenter Infinite Query Migration (TRACK-030)

## Overview

Migrate the NotificationCenter's data-fetching from manual `useQuery` + `useState`/`useEffect` accumulation to TanStack Query's native `useInfiniteQuery`. This is an architectural consistency / tech-debt remediation track — no new product features, no backend changes, no schema migrations, no i18n keys. The goal is to replace hand-rolled infinite-scroll pagination with the framework's built-in primitive, eliminating manual state management and fixing a latent bug where optimistic `markRead`/`markAllRead` updates silently no-op against the `useInfiniteQuery` data shape.

**Track Type:** Refactor
**Milestone:** 9 — Client Architecture Consistency
**Dependencies:** TRACK-014 (query-key factory — `notificationKeys` ✅), TRACK-012 (Notifications & File Management UX — "Load More" pagination ✅). Can be implemented independently of TRACK-029.
**Estimated Effort:** 1 Day / 0.5 Sprint Loops

## Context Anchors (Traceability)

- **PRD Reference:** `docs/PRD.md` — In-App Notification System (notification center with All/Unread tabs, grouped notifications, "Load More" pagination)
- **TDD Reference:**
  - `src/hooks/use-notifications.ts:36-58` — `useNotificationsList` uses `useQuery` with `notificationKeys.list({ page, limit, type, unreadOnly })`, `staleTime: 30_000`
  - `src/components/notifications/NotificationCenter.tsx:47-71` — manual accumulation: `useState<Notification[]>([])` + `useEffect` that appends items across pages with `Set`-based dedup (lines 56-67); `hasMore` derived from `items.length < total` (line 71)
  - `src/hooks/use-notifications.ts:60-116` — `useMarkRead` optimistic `onMutate`/`onError`/`onSettled` with `notificationKeys.all()` invalidation; `setQueriesData` callback checks `'items' in old` (line 89)
  - `src/hooks/use-notifications.ts:118-172` — `useMarkAllRead` same optimistic pattern; `setQueriesData` callback checks `'items' in old` (line 147)
  - `src/lib/query-keys.ts:8-13` — `notificationKeys` factory: `all()`, `unreadCount()`, `list({ page?, limit?, type?, unreadOnly? })`
- **Product Spec Reference:**
  - `conductor/archive/notifications-file-management-ux_20260720/spec.md` (TRACK-012 — FR-4: "Load More" pagination)
  - `conductor/archive/optimistic-ui-updates_20260722/spec.md` (TRACK-014 — optimistic `markRead`/`markAllRead` mutations with `notificationKeys` factory)

## Track Tech Stack

- **TanStack Query** (`@tanstack/react-query`) — `useInfiniteQuery`. Already installed, no new dependency.
- **Existing `listNotifications` server function** — already returns `{ items, total }` with `page`/`limit` params. Already structured for infinite query (no backend changes needed — `getNextPageParam` derives `page` from `total` and current `items` count).
- No new dependencies, no schema migrations, no i18n keys, no backend changes.

## Scope Boundaries

### In Scope

1. **Convert `useNotificationsList` to `useInfiniteQuery`:** Replace `useQuery` (with `page` param) in `src/hooks/use-notifications.ts` with `useInfiniteQuery`. The `queryKey` uses `notificationKeys.list({ limit, type, unreadOnly })` (no `page` — `useInfiniteQuery` manages page tracking via `pageParam`/`getNextPageParam`). `getNextPageParam` returns the next page number when `total > accumulated items count`, or `undefined` when all pages are loaded. `initialPageParam: 1`.

2. **Refactor `NotificationCenter` component:** Remove the manual accumulation `useState<Notification[]>(allItems)` (line 47) and the `useEffect` append/dedup logic (lines 56-67). Replace with `data.pages.flatMap(page => page.items)` to flatten the infinite query's pages into a single array. Replace `setCurrentPage((p) => p + 1)` "Load More" button (line 166) with `fetchNextPage()`. Use `isFetching` for the Load More button spinner, `hasNextPage` for button visibility, and `isFetchingNextPage` for the load-more-specific loading state.

3. **Rewrite optimistic mutation callbacks for infinite query shape:** The existing `useMarkRead` and `useMarkAllRead` optimistic mutations (lines 60-172) use `queryClient.setQueriesData` with a callback that checks `'items' in old` — this matches the `useQuery` data shape (`{ items, total }`) but NOT the `useInfiniteQuery` shape (`{ pages: Array<{ items, total }>, pageParams: number[] }`). The `'items' in old` check silently falls through to `return old` (no-op), breaking the optimistic update. Rewrite both callbacks to check `'pages' in old` and map over `old.pages` to update `items` within each page. The `typeof old === 'number'` check (for `useUnreadCount` — still uses `useQuery`) is preserved unchanged. The `onSettled` `invalidateQueries({ queryKey: notificationKeys.all() })` works unchanged.

4. **Update `notificationKeys.list` factory:** Remove `page` from the factory's `list` filter type signature. The current factory accepts `{ page?, limit?, type?, unreadOnly? }` — with `useInfiniteQuery`, `page` is managed by `pageParam` and should not be part of the cache key (all pages of the same filter share one cache entry). This is a breaking API change to the factory type signature, which is intentional — it forces any callers passing `page` to migrate.

5. **Unit tests:** Update `tests/unit/hooks/use-notifications.test.tsx` and `tests/unit/components/notifications/notification-center.test.tsx` to use `useInfiniteQuery` mock pattern. Verify: initial page loads, "Load More" fetches next page, accumulated items include all pages, `hasNextPage` is `false` when all items loaded, optimistic `markRead`/`markAllRead` still updates items across pages, invalidation refetches all pages.

### Out of Scope

- **Cursor-based pagination** — the server function uses offset pagination (`page`/`limit`). `useInfiniteQuery` works with offset pagination via `pageParam`. Migrating to cursor-based is a separate backend concern (deferred per TRACK-006 v2 note).
- **Changing the `staleTime` or `refetchInterval`** — the existing `staleTime: 30_000` and `refetchInterval: 30_000` (on `useUnreadCount`) are preserved.
- **Notification grouping logic** (`GROUP_CONFIGS` in `NotificationCenter.tsx`) — unchanged. The grouping operates on the flattened items array, which is the same regardless of pagination mechanism.
- **Any UI/UX changes to the notification center layout** — this is a pure internal refactor (same user-visible behavior, better state management).
- **Scroll restoration** — when reopening the NotificationCenter, scroll position resets to top. Acceptable; scroll restoration is out of scope.

## Functional Requirements

- **FR-1:** `useNotificationsList` must use `useInfiniteQuery` with `initialPageParam: 1` and a `getNextPageParam` that returns the next page number when `total > accumulated items count`, or `undefined` when all pages are loaded.
- **FR-2:** `NotificationCenter` must compute `items` via `data?.pages.flatMap(p => p.items) ?? []` (no `useState` for accumulation, no `useEffect` for append/dedup).
- **FR-3:** The "Load More" button must call `fetchNextPage()`, be visible when `hasNextPage` is true, and show a spinner via `isFetchingNextPage`.
- **FR-4:** `useMarkRead` and `useMarkAllRead` optimistic `onMutate` callbacks must check `'pages' in old` (not `'items' in old`) and map over `old.pages` to update `items` within each page.
- **FR-5:** The `typeof old === 'number'` check for `useUnreadCount` (still `useQuery`) must be preserved unchanged.
- **FR-6:** `notificationKeys.list` factory type signature must no longer accept `page` (managed by `pageParam`).
- **FR-7:** `useUnreadCount` must remain unchanged (still `useQuery` with `notificationKeys.unreadCount()`).

## Non-Functional Requirements

- **NFR-1:** No new dependencies, no schema migrations, no i18n keys, no backend changes.
- **NFR-2:** All files must remain under 500 lines (`scripts/check-modularity.js`).
- **NFR-3:** Test coverage ≥80% on lines, statements, branches, and functions.
- **NFR-4:** `pnpm typecheck`, `pnpm lint`, `pnpm check:i18n` must pass.
- **NFR-5:** Same user-visible behavior — no UI/UX changes to the notification center layout.

## Acceptance Criteria / Definition of Done (DoD)

- [ ] **Manual Checkpoint:** Open the NotificationCenter (bell icon) — notifications load on page 1. Click "Load More" — the next page loads and appends to the existing list (no flicker, no duplicate items). Click "Mark All Read" — all visible items across all loaded pages transition to read state immediately (optimistic). Navigate away and reopen the NotificationCenter — previously loaded pages are cached (instant render within `staleTime`), and the scroll position is at the top (acceptable — scroll restoration is out of scope). Toggle between "All" and "Unread" tabs — the infinite query resets to page 1 for the new filter. Verify no console errors during any of these actions.
- [ ] **Automated Tests:** `pnpm test:unit` — all tests pass. Updated tests for: `useNotificationsList` (returns `useInfiniteQuery` with correct `queryKey`, `initialPageParam: 1`, `getNextPageParam` returns next page when `total > accumulated`, returns `undefined` when all loaded), `NotificationCenter` (renders page 1 items, "Load More" calls `fetchNextPage`, accumulated items include all pages, `hasNextPage` controls Load More visibility, `isFetchingNextPage` shows spinner on Load More button only), `useMarkRead`/`useMarkAllRead` (optimistic `setQueriesData` updates items in the infinite query page structure, `onError` rolls back, `onSettled` invalidates). `pnpm test:coverage` ≥80%. `pnpm typecheck` clean. `pnpm lint` clean. `pnpm check:i18n` parity maintained.
- [ ] **Conductor Review:** `useNotificationsList` uses `useInfiniteQuery` (not `useQuery`). `NotificationCenter.tsx` has no `useState` for items accumulation and no `useEffect` for append/dedup (grep `allItems` and `existingIds` returns zero matches). `items` is computed via `data?.pages.flatMap(...)` (not `useState`). Load More button calls `fetchNextPage()` (not `setCurrentPage`). `hasNextPage` and `isFetchingNextPage` are used (not manually computed `hasMore`). `useMarkRead`/`useMarkAllRead` `onMutate` `setQueriesData` callback checks `'pages' in old` (not `'items' in old`) and maps over `old.pages` to update items within each page. The `typeof old === 'number'` check for `useUnreadCount` is preserved. `notificationKeys.list` factory type signature no longer accepts `page` (managed by `pageParam`). All files under 500 lines. `pnpm typecheck`, `pnpm lint`, `pnpm check:i18n` pass. Pre-push gate passes.
