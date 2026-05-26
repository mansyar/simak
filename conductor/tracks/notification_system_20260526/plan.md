# Implementation Plan: Track 7.1 — In-App Notification System

## Phase 1 — Complete Server Functions (markRead, markAllRead, getUnreadCount) [checkpoint: 53e17e6]

**Objective:** Add the three missing server functions with Zod schemas, stubs, handlers, and TDD tests.

- [x] Task: Write failing tests for new notification server functions (Red Phase)
  - [x] Write tests for `MarkReadSchema` — valid/invalid inputs
  - [x] Write tests for `MarkAllReadSchema` — valid/invalid inputs
  - [x] Write tests for `GetUnreadCountSchema` — valid/invalid inputs
  - [x] Write tests for `markReadHandler` — verifies single notification marked as read, ownership check
  - [x] Write tests for `markAllReadHandler` — verifies all unread notifications marked as read for current user
  - [x] Write tests for `getUnreadCountHandler` — verifies correct unread count returned
  - [x] Run tests and confirm they fail
- [x] Task: Implement new notification server functions (Green Phase) [33fc349]
  - [x] Add `MarkReadSchema`, `MarkAllReadSchema`, `GetUnreadCountSchema` to `src/server/notifications.ts`
  - [x] Add `markRead`, `markAllRead`, `getUnreadCount` server function stubs with dynamic imports
  - [x] Implement `markReadHandler` in `notifications.server.ts` — validates ownership, updates `read` to true
  - [x] Implement `markAllReadHandler` — updates all unread notifications for session user
  - [x] Implement `getUnreadCountHandler` — `COUNT(*) WHERE userId = ? AND read = false`
  - [x] Re-run tests and confirm they pass
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Complete Server Functions' (Protocol in workflow.md)

## Phase 2 — Event Trigger Integration [checkpoint: e832577]

**Objective:** Wire notification creation into existing server handlers for `submission_received`, `review_completed`, and `revision_requested` events.

- [x] Task: Write failing tests for event trigger notifications (Red Phase) [3d7c577]
  - [x] Write tests verifying `submitCheckpointHandler` creates `submission_received` notification for the instructor
  - [x] Write tests verifying `submitReviewHandler` creates `review_completed` notification (pass decision)
  - [x] Write tests verifying `submitReviewHandler` creates `revision_requested` notification (revise decision)
  - [x] Run tests and confirm they fail
- [x] Task: Implement event trigger notifications (Green Phase) [08981db]
  - [x] Add `submission_received` notification creation in `submitCheckpointHandler` — notify the assignment instructor
  - [x] Add `review_completed` notification creation in `submitReviewHandler` (pass decision) — notify the student
  - [x] Add `revision_requested` notification creation in `submitReviewHandler` (revise decision) — notify the student
  - [x] Re-run tests and confirm they pass
- [x] Task: Conductor - User Manual Verification 'Phase 2: Event Trigger Integration' (Protocol in workflow.md) [e832577]

## Phase 3 — TanStack Query Hooks with Polling [checkpoint: 79c3c4e]

**Objective:** Create custom hooks for notification data fetching with automatic polling for unread count.

- [x] Task: Write failing tests for notification hooks (Red Phase) [859f8c0]
  - [x] Write tests for `useUnreadCount` — returns count, polls at 15s interval
  - [x] Write tests for `useNotificationsList` — returns paginated list, supports type filter
  - [x] Write tests for `useMarkRead` mutation — calls markRead, invalidates query keys
  - [x] Write tests for `useMarkAllRead` mutation — calls markAllRead, invalidates query keys
  - [x] Run tests and confirm they fail
- [x] Task: Implement notification query hooks (Green Phase) [3321626]
  - [x] Create `src/hooks/use-notifications.ts` with `useUnreadCount` query (refetchInterval: 15000)
  - [x] Add `useNotificationsList` query (pagination + type filter, no auto-polling)
  - [x] Add `useMarkRead` mutation (invalidates `unreadCount` and `notifications` query keys)
  - [x] Add `useMarkAllRead` mutation (invalidates `unreadCount` and `notifications` query keys)
  - [x] Re-run tests and confirm they pass
- [x] Task: Conductor - User Manual Verification 'Phase 3: TanStack Query Hooks' (Protocol in workflow.md) [79c3c4e]

## Phase 4 — UI Components [checkpoint: 6c3c793]

**Objective:** Build NotificationBadge, NotificationCenter, and NotificationItem components with i18n support.

- [x] Task: Write failing tests for notification UI components (Red Phase) [05e5000]
  - [x] Write tests for `NotificationBadge` — renders bell icon, shows unread count, hides at zero
  - [x] Write tests for `NotificationItem` — renders icon, title, message, relative timestamp, read/unread indicator
  - [x] Write tests for `NotificationCenter` — opens slide-over panel, groups by type, supports mark all read, shows empty state
  - [x] Run tests and confirm they fail
- [x] Task: Implement notification UI components (Green Phase) [0645438]
  - [x] Create `src/components/notifications/NotificationBadge.tsx` — Bell/BellDot icon + unread count badge, click to open panel
  - [x] Create `src/components/notifications/NotificationItem.tsx` — type-based icon, title+message, relative timestamp via date-fns, read/unread styling
  - [x] Create `src/components/notifications/NotificationCenter.tsx` — slide-over panel with type-grouped notifications, mark all read, empty state, load more pagination
  - [x] Add i18n translation keys for notification UI labels
  - [x] Run `pnpm generate:i18n` to regenerate types
  - [x] Re-run tests and confirm they pass
- [x] Task: Conductor - User Manual Verification 'Phase 4: UI Components' (Protocol in workflow.md) [6c3c793]

## Phase 5 — Layout Integration & Final Verification [checkpoint: b5719a4]

**Objective:** Wire the notification bell into the shared authenticated layout and run the full quality gate.

- [x] Task: Wire notification components into the shared layout
  - [x] Add `NotificationBadge` to Student, Instructor, and Admin pathless authenticated layout headers (next to language switcher)
  - [x] Ensure `NotificationCenter` is wired correctly and triggers on badge click
- [x] Task: Run full test suite and verify coverage >80%
- [x] Task: Run linter (`pnpm lint`) and TypeScript typecheck (`pnpm typecheck`)
- [x] Task: Verify build succeeds (`pnpm build`)
- [x] Task: Conductor - User Manual Verification 'Phase 5: Layout Integration & Final Verification' (Protocol in workflow.md)
