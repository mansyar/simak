# Implementation Plan: Track 7.1 — In-App Notification System

## Phase 1 — Complete Server Functions (markRead, markAllRead, getUnreadCount)

**Objective:** Add the three missing server functions with Zod schemas, stubs, handlers, and TDD tests.

- [ ] Task: Write failing tests for new notification server functions (Red Phase)
  - [ ] Write tests for `MarkReadSchema` — valid/invalid inputs
  - [ ] Write tests for `MarkAllReadSchema` — valid/invalid inputs
  - [ ] Write tests for `GetUnreadCountSchema` — valid/invalid inputs
  - [ ] Write tests for `markReadHandler` — verifies single notification marked as read, ownership check
  - [ ] Write tests for `markAllReadHandler` — verifies all unread notifications marked as read for current user
  - [ ] Write tests for `getUnreadCountHandler` — verifies correct unread count returned
  - [ ] Run tests and confirm they fail
- [ ] Task: Implement new notification server functions (Green Phase)
  - [ ] Add `MarkReadSchema`, `MarkAllReadSchema`, `GetUnreadCountSchema` to `src/server/notifications.ts`
  - [ ] Add `markRead`, `markAllRead`, `getUnreadCount` server function stubs with dynamic imports
  - [ ] Implement `markReadHandler` in `notifications.server.ts` — validates ownership, updates `read` to true
  - [ ] Implement `markAllReadHandler` — updates all unread notifications for session user
  - [ ] Implement `getUnreadCountHandler` — `COUNT(*) WHERE userId = ? AND read = false`
  - [ ] Re-run tests and confirm they pass
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Complete Server Functions' (Protocol in workflow.md)

## Phase 2 — Event Trigger Integration

**Objective:** Wire notification creation into existing server handlers for `submission_received`, `review_completed`, and `revision_requested` events.

- [ ] Task: Write failing tests for event trigger notifications (Red Phase)
  - [ ] Write tests verifying `submitCheckpointHandler` creates `submission_received` notification for the instructor
  - [ ] Write tests verifying `submitReviewHandler` creates `review_completed` notification (pass decision)
  - [ ] Write tests verifying `submitReviewHandler` creates `revision_requested` notification (revise decision)
  - [ ] Run tests and confirm they fail
- [ ] Task: Implement event trigger notifications (Green Phase)
  - [ ] Add `submission_received` notification creation in `submitCheckpointHandler` — notify the assignment instructor
  - [ ] Add `review_completed` notification creation in `submitReviewHandler` (pass decision) — notify the student
  - [ ] Add `revision_requested` notification creation in `submitReviewHandler` (revise decision) — notify the student
  - [ ] Re-run tests and confirm they pass
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Event Trigger Integration' (Protocol in workflow.md)

## Phase 3 — TanStack Query Hooks with Polling

**Objective:** Create custom hooks for notification data fetching with automatic polling for unread count.

- [ ] Task: Write failing tests for notification hooks (Red Phase)
  - [ ] Write tests for `useUnreadCount` — returns count, polls at 15s interval
  - [ ] Write tests for `useNotificationsList` — returns paginated list, supports type filter
  - [ ] Write tests for `useMarkRead` mutation — calls markRead, invalidates query keys
  - [ ] Write tests for `useMarkAllRead` mutation — calls markAllRead, invalidates query keys
  - [ ] Run tests and confirm they fail
- [ ] Task: Implement notification query hooks (Green Phase)
  - [ ] Create `src/hooks/use-notifications.ts` with `useUnreadCount` query (refetchInterval: 15000)
  - [ ] Add `useNotificationsList` query (pagination + type filter, no auto-polling)
  - [ ] Add `useMarkRead` mutation (invalidates `unreadCount` and `notifications` query keys)
  - [ ] Add `useMarkAllRead` mutation (invalidates `unreadCount` and `notifications` query keys)
  - [ ] Re-run tests and confirm they pass
- [ ] Task: Conductor - User Manual Verification 'Phase 3: TanStack Query Hooks' (Protocol in workflow.md)

## Phase 4 — UI Components

**Objective:** Build NotificationBadge, NotificationCenter, and NotificationItem components with i18n support.

- [ ] Task: Write failing tests for notification UI components (Red Phase)
  - [ ] Write tests for `NotificationBadge` — renders bell icon, shows unread count, hides at zero
  - [ ] Write tests for `NotificationItem` — renders icon, title, message, relative timestamp, read/unread indicator
  - [ ] Write tests for `NotificationCenter` — opens slide-over panel, groups by type, supports mark all read, shows empty state
  - [ ] Run tests and confirm they fail
- [ ] Task: Implement notification UI components (Green Phase)
  - [ ] Create `src/components/notifications/NotificationBadge.tsx` — Bell/BellDot icon + unread count badge, click to open panel
  - [ ] Create `src/components/notifications/NotificationItem.tsx` — type-based icon, title+message, relative timestamp via date-fns, read/unread styling
  - [ ] Create `src/components/notifications/NotificationCenter.tsx` — slide-over panel with type-grouped notifications, mark all read, empty state, load more pagination
  - [ ] Add i18n translation keys for notification UI labels
  - [ ] Run `pnpm generate:i18n` to regenerate types
  - [ ] Re-run tests and confirm they pass
- [ ] Task: Conductor - User Manual Verification 'Phase 4: UI Components' (Protocol in workflow.md)

## Phase 5 — Layout Integration & Final Verification

**Objective:** Wire the notification bell into the shared authenticated layout and run the full quality gate.

- [ ] Task: Wire notification components into the shared layout
  - [ ] Add `NotificationBadge` to `_authenticated.tsx` header (next to language switcher/theme toggle)
  - [ ] Ensure `NotificationCenter` renders as a portal overlay accessible from any page
- [ ] Task: Run full test suite and verify coverage >80%
- [ ] Task: Run linter (`pnpm lint`) and TypeScript typecheck (`pnpm typecheck`)
- [ ] Task: Verify build succeeds (`pnpm build`)
- [ ] Task: Conductor - User Manual Verification 'Phase 5: Layout Integration & Final Verification' (Protocol in workflow.md)
