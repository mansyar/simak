# Implementation Plan: Escalation & Deadline Management

## Phase 1: SLA Breach Detection & Notification

### Task 1.1 — SLA Calculation Utility

- [x] Write failing tests (`tests/unit/reviews/sla-calculation.test.ts`) for:
  - `calculateBreachDuration()` — correctly identifies if a review was completed within 3 days (72h)
  - Returns 0 breach when review is on time
  - Returns positive breach duration (in days) when review is late
  - Handles edge cases: exactly 3 days, milliseconds precision, no `under_review` timestamp
- [x] Implement `calculateBreachDuration(underReviewAt: Date, reviewedAt: Date): number` utility
- [x] Verify all tests pass (`CI=true pnpm vitest run tests/unit/reviews/sla-calculation.test.ts`) [cbf6a01]

### Task 1.2 — Deadline Adjustment in submitReview

- [x] Write failing tests for deadline adjustment logic (`tests/unit/reviews/deadline-adjustment.test.ts`):
  - On-time review: no deadlines are adjusted
  - Late review: affected checkpoint `dueDate` extended by breach duration
  - Late review: all subsequent checkpoints extended by breach duration
  - Late review: assignment `finalDeadline` extended by breach duration
  - Only the affected student's deadlines are adjusted (other students unchanged)
- [x] Modify `submitReviewHandler` in `reviews.server.ts` to:
  - Calculate breach duration after review submission
  - If breach > 0, extend affected checkpoint + subsequent checkpoints + assignment finalDeadline within the existing transaction
- [x] Verify all tests pass [4781287]

### Task 1.3 — Notification Server Functions (Create)

- [x] Write failing tests (`tests/unit/server/notifications.test.ts`) for:
  - `createNotification` creates rows in the `notifications` table
  - Notification with `channel: 'email'` is created for sla_breach
  - `listNotifications` filters by type, ordered by newest first
- [x] Create `src/server/notifications.ts` with:
  - Zod schemas: `CreateNotificationSchema`, `ListNotificationsSchema`
  - Server function stubs: `createNotification`, `listNotifications`
- [x] Create `src/server/notifications.server.ts` with:
  - `createNotificationHandler` — inserts into `notifications` table
  - `listNotificationsHandler` — fetches with pagination and type filter
- [x] Verify all tests pass [952ed84]

### Task 1.4 — SLA Breach Email & Integration

- [x] Write failing tests (`tests/unit/email/sla-breach-email.test.ts`) for:
  - `sendSLAAlertEmail` sends with correct recipient, subject, and content
- [x] Add `sendSLAAlertEmail` to `src/lib/email.ts` with SIMAK-branded HTML template
- [x] Write failing integration tests for the full flow:
  - `tests/unit/reviews/sla-integration.test.ts` — Late review triggers in-app notification + email + deadline adjustment
  - No notifications/emails for on-time reviews
- [x] Wire SLA breach into `submitReviewHandler`:
  - After deadline adjustment, query Admin users
  - Create `sla_breach` in-app notification per Admin
  - Create `sla_breach` email notification per Admin and call `sendSLAAlertEmail`
- [x] Verify all tests pass
- [x] Ensure i18n keys added for SLA-related UI strings (if any appear in notifications) — already present in both EN/ID locales (slaBreached, slaOnTime, etc.)
- [x] Task: Conductor — Phase Completion Verification (Protocol in workflow.md) [fb54c1b]

## Phase 2: Manual Deadline Management (Server)

### Task 2.1 — Unlock Checkpoint Server Function

- [ ] Write failing tests (`tests/unit/assignments/unlock-checkpoint.test.ts`) for:
  - Instructor can unlock a checkpoint in their own assignment
  - Locked → unlocked transition succeeds
  - Already-unlocked checkpoint returns error
  - Non-owner instructor receives authorization error
  - Non-instructor user receives authorization error
- [ ] Add Zod schema `UnlockCheckpointSchema` to `src/server/assignments.ts`
- [ ] Add server function stub `unlockCheckpoint` to `src/server/assignments.ts`
- [ ] Implement `unlockCheckpointHandler` in `src/server/assignments.server.ts`:
  - Verify assignment ownership
  - Verify checkpoint belongs to that assignment
  - Verify checkpoint is in `locked` state
  - Transition to `unlocked`, update `updatedAt`
- [ ] Verify all tests pass

### Task 2.2 — Extend Deadline Server Function

- [ ] Write failing tests (`tests/unit/assignments/extend-deadline.test.ts`) for:
  - Instructor can extend a checkpoint's dueDate in their own assignment
  - New date must be in the future (validation error for past dates)
  - Non-owner instructor receives authorization error
  - Can extend any checkpoint (locked, unlocked, submitted — not just locked)
- [ ] Add Zod schema `ExtendDeadlineSchema` to `src/server/assignments.ts`
- [ ] Add server function stub `extendDeadline` to `src/server/assignments.ts`
- [ ] Implement `extendDeadlineHandler` in `src/server/assignments.server.ts`:
  - Verify assignment ownership (via checkpoint -> assignment join)
  - Update checkpoint `dueDate` and `updatedAt`
- [ ] Verify all tests pass
- [ ] Task: Conductor — Phase Completion Verification (Protocol in workflow.md)

## Phase 3: Deadline Manager UI

### Task 3.1 — DeadlineManager Component

- [ ] Write failing tests (`tests/unit/components/reviews/deadline-manager.test.tsx`) for:
  - Renders a list of students with their checkpoints and current deadlines
  - Shows "Unlock" button only for `locked` checkpoints
  - Clicking Unlock shows confirmation dialog
  - Confirmed unlock calls the server function
  - "Extend Deadline" date picker is shown per checkpoint
  - New deadline validation (must be future)
  - Loading/error/empty states
- [ ] Create `src/components/reviews/deadline-manager.tsx`:
  - Collapsible section on the assignment detail page
  - Per-student table/accordion showing checkpoints with state badges, current dueDate
  - "Unlock" button (with confirmation dialog) for locked checkpoints
  - "Extend Deadline" date picker per checkpoint with save button
  - TanStack Query mutations for unlock and extend
  - Loading state during mutations
- [ ] Add i18n keys for Deadline Manager UI labels, buttons, and messages
- [ ] Verify all tests pass

### Task 3.2 — Integrate Deadline Manager into Assignment Detail Page

- [ ] Write failing tests (`tests/unit/routes/instructor-assignment-detail.test.tsx`) for:
  - Assignment detail page renders Deadline Manager when data is available
  - Authenticated instructor-only access
- [ ] Update `src/routes/_authenticated/instructor/assignments/$id.tsx`:
  - Add DeadlineManager component below the progress table
  - Pass assignment and student/checkpoint data to DeadlineManager
  - Collapsible section heading: "Deadline Management"
- [ ] Verify all tests pass
- [ ] Task: Conductor — Phase Completion Verification (Protocol in workflow.md)
