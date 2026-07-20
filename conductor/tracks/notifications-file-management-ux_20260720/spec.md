<protect>
# Track Specification: Notifications & File Management UX

## Overview

Enhance the notification system with clickable navigation, read/unread filtering, and incremental loading. Improve the file management UX with DOCX preview messaging and a "Latest" version badge. Optimize client-side performance by reducing notification polling load and memoizing notification components.

**Track ID:** TRACK-012
**Type:** Feature
**Dependencies:** TRACK-010 (Complete — NotificationCenter `Sheet` refactor provides the base)
**Estimated Effort:** 2 Days / 1 Sprint Loop
**Audit IDs:** UX-41, UX-42, UX-46, UX-48, UX-49, UX-51, UX-53, PERF-27, PERF-29, PERF-30, PERF-31

## Functional Requirements

### FR-1: Notification Navigation (UX-42, UX-46)
Notifications must be clickable links that navigate to the relevant page based on notification type and metadata.

- **Server-side:** Add `metadata: { assignmentId, checkpointId, submissionId }` to notification INSERT statements in ~6-8 creation points (`reviews.server.ts`, `submissions.server.ts`, `consultations.server.ts`, `extensions.server.ts`/`extensions-extras.server.ts`, `review-sla.ts`). The `metadata` jsonb column already exists — no schema migration needed.
- **Client-side:** Create a `NOTIFICATION_ROUTES` map deriving the route from `type` + `metadata`. Example mappings:
  - `review_completed` → `/student/assignments/{assignmentId}/checkpoints/{checkpointId}`
  - `submission_received` → `/instructor/reviews/{submissionId}`
  - `consultation_verified` / `consultation_rejected` → `/student/assignments/{assignmentId}`
  - `extension_requested` → `/instructor/assignments/{assignmentId}`
  - `extension_approved` / `extension_rejected` → `/student/assignments/{assignmentId}`
  - `sla_breach` → `/admin/dashboard` (or no navigation — admin already sees it)
- **Component:** Replace `NotificationItem`'s `<button>` (from TRACK-010) with a TanStack Router `<Link>` styled as a block element (`text-left w-full`). Call `markAsRead` in `onClick` before navigation.
- **Fallback:** If `metadata` is missing or route can't be derived, the item still calls `markAsRead` on click but does not navigate.

### FR-2: Next Review Button (UX-41)
Add a "Next Review" button to the `ReviewDetailPage` success screen.

- On click, call `listPendingReviews({ data: { page: 1, limit: 1 } })` to fetch the next pending submission.
- If response has items, navigate to `/instructor/reviews/{items[0].submissionId}`.
- If response is empty (no more pending reviews), **hide** the "Next Review" button — only "Back to Queue" shows.
- Button appears alongside the existing "Back to Queue" link on the review success screen.

### FR-3: Read/Unread Filter (UX-48)
Add "All" / "Unread" tab toggle in the `NotificationCenter` Sheet header.

- Default tab: **"All"** (shows all notifications).
- "Unread" tab filters to `read === false` only.
- Pass `unreadOnly: boolean` to `useNotificationsList`. Server handler adds `.where(eq(notifications.read, false))` when `unreadOnly` is true.
- Use shadcn/ui `Tabs` component.

### FR-4: Load More Pagination (UX-49)
Replace the hardcoded `limit: 50` with incremental loading.

- Change `limit` from 50 to 20.
- Add a "Load More" button at the bottom of the notification list.
- Track `currentPage` in state. On click, increment page and append new items.
- Hide button when `items.length >= total` (all loaded).

### FR-5: DOCX Preview Message (UX-51)
Show an explicit "Preview not available" card for non-PDF files in `ReviewFilePreview`.

- Display a `FileText` icon + message + the existing download button.
- No new dependency — the current download-only behavior is preserved but with an explicit explanation.

### FR-6: Latest Version Badge (UX-53)
Add a "Latest" badge to the `FileList` row with the highest `version` number.

- Compute `maxVersion = Math.max(...submissions.map(s => s.version))`.
- Show a small `Badge` (`variant: "secondary"`) next to the version number for the row where `version === maxVersion`.

## Non-Functional Requirements

### NFR-1: Client-Side Performance (PERF-27, PERF-29, PERF-30, PERF-31)

- **PERF-29 (staleTime):** Add `staleTime: 30_000` (30s) to `useNotificationsList`. Prevents refetch on every window focus/mount when data is fresh.
- **PERF-30 (polling):** Change `useUnreadCount` `refetchInterval` from 15s to 30s. Add `refetchIntervalInBackground: false` so polling stops when the tab is not visible. Reduces server load by ~75%.
- **PERF-31 (memoization):** Wrap `NotificationItem` in `React.memo`. Use `useCallback` for `handleClick`.
- **PERF-27 (grouped notifications):** Memoize `NotificationCenter` unread count computation and `groupedNotifications` with `useMemo`. Eliminates 4 redundant `items.filter()` calls and double unread count computation on every render.

### NFR-2: i18n

- 2 new i18n keys in both `locales/en.json` and `locales/id.json`:
  - `files.previewNotAvailable` (en: "Preview not available — download to view", id: "Pratinjau tidak tersedia — unduh untuk melihat")
  - `instructorReviews.nextReview` (en: "Next Review", id: "Ulasan Berikutnya")
- Run `pnpm generate:i18n` after adding keys.
- No hardcoded UI strings (enforced by `simak-i18n/no-hardcoded` lint rule).

### NFR-3: Testing

- TDD per `conductor/workflow.md` — write failing tests first, then implement.
- Coverage ≥80% on lines, statements, branches, and functions.
- Tests for: notification navigation routing, next-review button, unread filter, load-more pagination, DOCX preview message, latest badge, staleTime, refetchInterval, React.memo, useMemo.

## Acceptance Criteria

1. **AC-1:** Clicking a `review_completed` notification navigates to the student assignment checkpoint page.
2. **AC-2:** Clicking a `submission_received` notification navigates to the instructor review page.
3. **AC-3:** Clicking a notification with missing metadata calls `markAsRead` but does not navigate.
4. **AC-4:** "Next Review" button on review success screen navigates to the next pending submission; hidden when no more reviews exist.
5. **AC-5:** "All" / "Unread" tabs in NotificationCenter filter correctly. Default is "All".
6. **AC-6:** "Load More" button loads 20 more notifications per click; hidden when all loaded.
7. **AC-7:** Non-PDF files in `ReviewFilePreview` show "Preview not available" card with download button.
8. **AC-8:** `FileList` shows "Latest" badge on the highest-version row.
9. **AC-9:** `useUnreadCount` polls every 30s (not 15s) and stops when tab is hidden.
10. **AC-10:** `useNotificationsList` has `staleTime: 30_000` — does not refetch on refocus if <30s old.
11. **AC-11:** `NotificationItem` is wrapped in `React.memo`; `NotificationCenter` uses `useMemo` for unread count and grouped notifications.
12. **AC-12:** All new i18n keys exist in both `en.json` and `id.json`; `pnpm check:i18n` passes.

## Out of Scope

- **UX-47 (notification preferences):** Dropped — feature, not a UX fix. Low impact. Deferred to a future feature track.
- **UX-52 (bulk download / ZIP):** Dropped — feature, not a UX fix. Low impact. Deferred to a future feature track.
- **NotificationCenter a11y refactor:** Already done in TRACK-010.
- **Search debounce:** TRACK-011.
- **Email delivery improvements:** TRACK-004.
- **Empty states for notifications:** TRACK-013.
- **Schema migration:** The `metadata` jsonb column already exists — no migration needed.
</protect>
