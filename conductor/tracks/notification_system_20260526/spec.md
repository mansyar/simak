# Specification: Track 7.1 — In-App Notification System

## Overview

Build a complete in-app notification engine. Key events trigger notification records stored in the `notifications` table. A notification center (slide-over panel with type-based grouping) lets users view, filter, and mark notifications as read. A bell icon in the shared header shows the unread count via polling with a 15-second interval.

The database schema (`notifications` table), Drizzle relation, and partial server functions (`createNotification`, `listNotifications`) already exist. This track completes the remaining server functions, builds the UI components, wires event triggers into existing handler files, and implements TanStack Query polling.

## Dependencies

All prior tracks — notification events are triggered by existing server handlers for submissions, reviews, and consultations.

## Functional Requirements

### FR1: Server Functions (Complete)

| Function             | Purpose                                                   | Status      |
| -------------------- | --------------------------------------------------------- | ----------- |
| `createNotification` | Insert a new notification row                             | ✅ Exists   |
| `listNotifications`  | Paginated list for current user with optional type filter | ✅ Exists   |
| `markRead`           | Mark a single notification as read                        | 🔲 To build |
| `markAllRead`        | Mark all unread notifications as read for current user    | 🔲 To build |
| `getUnreadCount`     | Return the count of unread notifications for current user | 🔲 To build |

### FR2: Event Trigger Integration

Insert direct DB insert calls at these existing action points:

| Event                   | Trigger Location                                               | Target Audience            |
| ----------------------- | -------------------------------------------------------------- | -------------------------- |
| `submission_received`   | `submitCheckpointHandler` in `submissions.server.ts`           | Assignment instructor      |
| `review_completed`      | `submitReviewHandler` in `reviews.server.ts` (pass decision)   | Submission owner (student) |
| `revision_requested`    | `submitReviewHandler` in `reviews.server.ts` (revise decision) | Submission owner (student) |
| `consultation_verified` | `verifyConsultationHandler` in `consultations.server.ts`       | ✅ Already implemented     |
| `sla_breach`            | `dispatchSLABreachNotifications` in `review-sla.ts`            | ✅ Already implemented     |

Note: `deadline_approaching` and `deadline_missed` are out of scope — they require a background scheduler.

### FR3: UI Components

**NotificationBadge** — Rendered in `_authenticated.tsx` header, next to theme toggle/language switcher:

- Bell icon (lucide-react `Bell`/`BellDot`)
- Red badge with unread count (auto-hides at zero)
- Uses `getUnreadCount` with 15s polling via TanStack Query

**NotificationCenter** — Slide-over panel from the right:

- Header: "Notifications" title + "Mark all read" action
- Grouped by notification type (e.g., "New Reviews", "Consultation Updates")
- Each group shows type icon + item count
- Notification items within each group, sorted newest-first
- Loading skeleton states, empty state ("No notifications yet")
- Scrollable with pagination (load more on scroll)

**NotificationItem** — Single notification row:

- Type-based icon (lucide-react: `FileUp` for submission, `CheckCircle` for pass, `RefreshCw` for revise, `ClipboardCheck` for consultation, `AlertTriangle` for SLA)
- Title + message (truncated to 2 lines)
- Relative timestamp (e.g., "2m ago", "1h ago") via `date-fns`
- Read/unread visual (bold vs normal text, blue dot for unread)
- Click to mark as read

### FR4: TanStack Query Hooks

- `useUnreadCount` — Fetches unread count, `refetchInterval: 15000` (15s)
- `useNotificationsList` — Fetches paginated list with optional type filter (no auto-polling)
- `useMarkRead` — Mutation, invalidates `unreadCount` and `notifications` query keys
- `useMarkAllRead` — Mutation, invalidates `unreadCount` and `notifications` query keys

## Non-Functional Requirements

- **Persistence** — Notifications stored in PostgreSQL, survive page reloads
- **Real-time feel** — 15s polling gives near-real-time updates without WebSockets
- **Performance** — Count query is a lightweight `COUNT(*)` on indexed column (`userId`, `read` composite index exists)
- **Accessibility** — ARIA labels on bell button, `role="status"` for badge, keyboard navigation in panel

## Acceptance Criteria

- [ ] `markRead` server function marks a single notification as read
- [ ] `markAllRead` marks all unread notifications as read for the current user
- [ ] `getUnreadCount` returns the correct unread count
- [ ] Notification bell in header shows live unread badge count
- [ ] Clicking bell opens slide-over panel from the right
- [ ] Panel groups notifications by type with section headers
- [ ] Notification items show type icon, title, message, relative timestamp, read/unread indicator
- [ ] Clicking a notification marks it as read
- [ ] "Mark all read" action clears all unread
- [ ] Empty state shows "No notifications yet" when no notifications exist
- [ ] Submitting a checkpoint creates a `submission_received` notification for the instructor
- [ ] Passing a review creates a `review_completed` notification for the student
- [ ] Revising a review creates a `revision_requested` notification for the student
- [ ] Verifying a consultation creates a `consultation_verified` notification for the student (already implemented)
- [ ] SLA breach creates an `sla_breach` notification for admins (already implemented)
- [ ] Polling at 15s interval updates the unread count

## Out of Scope

- Email notifications (v2)
- Notification preferences (`notification_preferences` table — v2)
- Deadline-approaching and deadline-missed events (require scheduler)
- Real-time push via WebSockets (polling only)
