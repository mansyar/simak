<protect>
# Implementation Plan: Notifications & File Management UX

## Phase 1: Notification Navigation

- [x] Task: Read `spec.md` and `conductor/workflow.md` to re-establish context before starting this phase

- [x] Task: Add i18n keys for new UI strings (9933b39)
    - [ ] Add `files.previewNotAvailable` and `instructorReviews.nextReview` to `locales/en.json` and `locales/id.json`
    - [ ] Run `pnpm generate:i18n` to regenerate types
    - [ ] Verify `pnpm check:i18n` passes

- [~] Task: Add metadata to notification creation points (server-side)
    - [ ] Write tests verifying `metadata: { assignmentId, checkpointId, submissionId }` is included in notification INSERTs for each creation point
    - [ ] Implement: Add metadata to notification INSERTs in `reviews.server.ts`, `submissions.server.ts`, `consultations.server.ts`, `extensions.server.ts` / `extensions-extras.server.ts`, `review-sla.ts`

- [ ] Task: Create NOTIFICATION_ROUTES map and convert NotificationItem to navigable Link
    - [ ] Write tests for route derivation (type + metadata → correct route; missing metadata → no navigation)
    - [ ] Write tests verifying `markAsRead` is called on click before navigation
    - [ ] Implement: Create `NOTIFICATION_ROUTES` map in client code
    - [ ] Implement: Convert `NotificationItem` from `<button>` to TanStack Router `<Link>` with `text-left w-full` styling; call `markAsRead` in `onClick`

- [ ] Task: Add "Next Review" button to ReviewDetailPage success screen
    - [ ] Write tests: button navigates to next pending review when reviews exist; button hidden when no more reviews
    - [ ] Implement: Add "Next Review" button calling `listPendingReviews({ data: { page: 1, limit: 1 } })`; navigate to `/instructor/reviews/{submissionId}` or hide button when empty

- [ ] Task: Conductor - User Manual Verification 'Notification Navigation' (Protocol in workflow.md)

## Phase 2: Notification UX

- [ ] Task: Read `spec.md` and `conductor/workflow.md` to re-establish context before starting this phase

- [ ] Task: Add "All" / "Unread" tab filter to NotificationCenter
    - [ ] Write tests: "All" tab shows all notifications; "Unread" tab filters to `read === false`; default tab is "All"
    - [ ] Implement: Add shadcn/ui `Tabs` component with "All" and "Unread" tabs to NotificationCenter Sheet header
    - [ ] Implement: Update `useNotificationsList` to accept `unreadOnly: boolean` param
    - [ ] Implement: Update server handler to add `.where(eq(notifications.read, false))` when `unreadOnly` is true

- [ ] Task: Add "Load More" pagination to NotificationCenter
    - [ ] Write tests: Load More button increments page and appends items; button hidden when all loaded; limit is 20 (not 50)
    - [ ] Implement: Change `limit` from 50 to 20; add "Load More" button with `currentPage` state; append new items on click; hide when `items.length >= total`

- [ ] Task: Conductor - User Manual Verification 'Notification UX' (Protocol in workflow.md)

## Phase 3: File UX & Client Perf

- [ ] Task: Read `spec.md` and `conductor/workflow.md` to re-establish context before starting this phase

- [ ] Task: Add DOCX preview message to ReviewFilePreview
    - [ ] Write tests: non-PDF files show "Preview not available" card with `FileText` icon and download button; PDF files show inline preview as before
    - [ ] Implement: Add conditional card for non-PDF files in `ReviewFilePreview` with `t('files.previewNotAvailable')` message

- [ ] Task: Add "Latest" badge to FileList
    - [ ] Write tests: highest version row shows "Latest" badge; non-highest rows do not show badge
    - [ ] Implement: Compute `maxVersion = Math.max(...submissions.map(s => s.version))`; show `Badge` (`variant: "secondary"`) on row where `version === maxVersion`

- [ ] Task: Client-side performance optimizations
    - [ ] Write tests: `useNotificationsList` has `staleTime: 30_000`; `useUnreadCount` has `refetchInterval: 30000` and `refetchIntervalInBackground: false`; `NotificationItem` wrapped in `React.memo`; `NotificationCenter` uses `useMemo` for unread count and groupedNotifications
    - [ ] Implement: Add `staleTime: 30_000` to `useNotificationsList`
    - [ ] Implement: Change `useUnreadCount` `refetchInterval` to `30000` + add `refetchIntervalInBackground: false`
    - [ ] Implement: Wrap `NotificationItem` in `React.memo`; use `useCallback` for `handleClick`
    - [ ] Implement: Memoize `NotificationCenter` unread count + `groupedNotifications` with `useMemo` (eliminates 4 redundant `items.filter()` calls)

- [ ] Task: Conductor - User Manual Verification 'File UX & Client Perf' (Protocol in workflow.md)
</protect>
