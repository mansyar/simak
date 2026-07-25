# TRACK-026: Checkpoint Discussion / Q&A Threads

## Overview

### Summary

Add lightweight, async Q&A discussion threads to checkpoint detail pages, enabling students and instructors to communicate about checkpoint requirements, submissions, and feedback without scheduling formal consultation sessions. Discussions complement the existing consultation tracking (Kartu Bimbingan) — consultations are formal advising sessions with verification gating; discussions are informal, instant, and ungated.

### Context

- **Roadmap Reference:** `docs/roadmap.md` — TRACK-026, Milestone 6 (New Features)
- **PRD Reference:** `docs/PRD.md#consultation-tracking-kartu-bimbingan` (formal counterpart), `docs/PRD.md#notifications` (notification extension point), `docs/PRD.md#checkpoints--submissions` (checkpoint lifecycle context)
- **TDD Reference:** `docs/TDD.md` — `checkpoints` table (`src/db/schema/assignments.ts:77`), `consultations` table (`src/db/schema/consultations.ts:17`), `notifications` table (`src/db/schema/notifications.ts:13`), `assignment_students` join table (`src/db/schema/assignments.ts:56`)
- **Dependencies:** None (complementary to existing consultation tracking; extends notification infrastructure from TRACK-022 and TRACK-018)
- **Estimated Effort:** 4 Days / 2 Sprint Loops

### Design Decisions (Confirmed)

1. **Message alignment:** Role-based — student messages left-aligned, instructor messages right-aligned (iMessage/WhatsApp style)
2. **Threading depth:** 1 level deep — top-level messages + one level of indented replies (parentMessageId column used; deeper nesting reserved for v2)
3. **Review page integration:** Inline `DiscussionPanel` embedded on the review detail page below the file preview
4. **Deletion window:** 15 minutes — author can soft-delete their own message within 15 minutes of posting; after that, the delete button is hidden

## Functional Requirements

### FR-1: Discussion Schema

- **FR-1.1:** New `checkpoint_discussions` table with: `id` (serial PK), `checkpointId` (integer, FK → checkpoints, `onDelete: cascade`), `assignmentId` (integer, FK → assignments, `onDelete: cascade` — denormalized for efficient instructor queries), `userId` (text, FK → users — message author), `message` (text, not null, min 1 char, max 2000 chars), `parentMessageId` (integer, FK → `checkpoint_discussions.id`, nullable — for 1-level-deep threaded replies), `createdAt` (timestamp), `updatedAt` (timestamp — set equal to `createdAt` on insert; never updated in v1), `deletedAt` (timestamp, nullable — soft-delete)
- **FR-1.2:** Indexes: `(checkpointId, createdAt ASC)` for message list queries, `(assignmentId, createdAt DESC)` for instructor overview, `(parentMessageId)` for reply threading
- **FR-1.3:** Soft-delete via `deletedAt` timestamp (matching codebase convention used by `assignments`, `users`, `assignmentTemplates`, etc.). Deleted messages render as a muted "[deleted]" placeholder with no author or content. Replies to a deleted message are preserved.

### FR-2: Server Functions (Two-File Split)

- **FR-2.1:** `src/server/discussions.ts` — client-safe Zod schemas + `createServerFn` stubs with `.inputValidator(Schema).handler(...)` builder pattern:
  - `ListDiscussionMessagesSchema` — `checkpointId` + `page`/`limit` pagination
  - `PostDiscussionMessageSchema` — `checkpointId` + `message` (min 1, max 2000) + optional `parentMessageId`
  - `DeleteOwnMessageSchema` — `messageId`
- **FR-2.2:** `src/server/discussions.server.ts` — handler implementations:
  - **`listDiscussionMessagesHandler`** — paginated (20/page), ordered by `createdAt ASC`, includes author name + role via JOIN to `users`. Ownership verified: students can only view discussions on their own checkpoints; instructors can view discussions on any checkpoint in their assignments.
  - **`postDiscussionMessageHandler`** — validates message length (1–2000 chars), verifies ownership (student owns the checkpoint OR instructor owns the assignment), inserts message, fires `discussion_reply` notification to the other party (student → instructor, instructor → student) via `maybeInsertNotification` + `enqueueEventEmail` (advisory, post-commit, try/catch). If `parentMessageId` is provided, validates it belongs to the same checkpoint.
  - **`deleteOwnMessageHandler`** — verifies the requesting user is the message author AND the message was posted within the 15-minute deletion window. Soft-deletes the message via `deletedAt` timestamp. Replies to a deleted message are preserved.

### FR-3: Student Discussion UI

- **FR-3.1:** New `DiscussionPanel` component on `/student/assignments/$id.checkpoints.$checkpointId.tsx` — below the submission/review section
- **FR-3.2:** `ScrollArea` with message bubbles — student messages left-aligned, instructor messages right-aligned (role-based alignment)
- **FR-3.3:** `Avatar` with user initials per message. Message timestamps via `formatRelativeTime` (from `src/lib/format.ts`)
- **FR-3.4:** Reply threading — 1 level deep. Replies indented under parent messages via `parentMessageId`
- **FR-3.5:** `Textarea` + send `Button` using react-hook-form + Zod (`mode: 'onSubmit'`, matching existing form patterns)
- **FR-3.6:** Delete button on own messages within 15-minute window. After window expires, delete button is hidden.
- **FR-3.7:** Deleted messages render as muted "[deleted]" placeholder with replies preserved underneath
- **FR-3.8:** Empty state: "No messages yet — ask a question about this checkpoint" (reuses `EmptyState` component with `MessageCircle` icon)
- **FR-3.9:** Loading state: `Skeleton` placeholders
- **FR-3.10:** `useQuery` with 30s `refetchInterval` for near-real-time message list. `useMutation` with optimistic insert (matching TRACK-014 pattern — `onMutate` adds message to cache, `onError` rolls back) and optimistic soft-delete on delete.

### FR-4: Instructor Discussion View

- **FR-4.1:** New "Discussions" tab on `/instructor/assignments/$id` — alongside Overview, Consultations, Extensions tabs
- **FR-4.2:** Shows all discussion messages across all checkpoints for this assignment, grouped by checkpoint
- **FR-4.3:** Instructor can reply to any message using the same `DiscussionPanel` component (with `instructorView` prop — changes message alignment, shows student name on each message)
- **FR-4.4:** Inline `DiscussionPanel` on the review detail page (`/instructor/reviews/$submissionId`) below the file preview section

### FR-5: Notification Integration

- **FR-5.1:** New `discussion_reply` notification type — target: the other party (student → instructor, instructor → student)
- **FR-5.2:** Notification route: `/student/assignments/{assignmentId}/checkpoints/{checkpointId}` (for student target) or `/instructor/assignments/{assignmentId}` (for instructor target). Route determined by `metadata.target` (`'student'` | `'instructor'`)
- **FR-5.3:** `getNotificationRoute` in `src/components/notifications/notification-routes.ts` checks `metadata.target` to return the correct path
- **FR-5.4:** Params all strings: `authorName`, `checkpointName`, `assignmentTitle`, `messagePreview` (truncated to 100 chars)
- **FR-5.5:** Added to `consultations` group in `GROUP_CONFIGS` (alongside `consultation_verified`, `consultation_logged`, `consultation_rejected` — all checkpoint-scoped communication)
- **FR-5.6:** Add `discussion_reply: MessageCircle` to `TYPE_ICONS` in `NotificationItem.tsx`
- **FR-5.7:** Respects user notification preferences (TRACK-022) — can be disabled per-channel (email and/or in-app)

### FR-6: Email Integration

- **FR-6.1:** New `buildDiscussionReplyHtml` in `src/lib/email-templates.ts` (matching `build{Event}Html` convention) — shows author name, checkpoint name, assignment title, message preview (truncated, HTML-escaped), CTA link to the checkpoint page
- **FR-6.2:** New `src/lib/discussion-email.ts` — `sendDiscussionReplyEmail()` helper wrapping `enqueueEventEmail` (matching `review-email.ts` pattern)
- **FR-6.3:** Add `'discussion_reply'` to `templateType` enum array in `src/db/schema/email-queue.ts` AND to `TemplateType` union in `src/lib/email.ts` (both required — `enqueueEventEmail` takes `templateType: TemplateType`). Both are code-only changes (Drizzle text enum, not pg enum, no `ALTER TYPE`).
- **FR-6.4:** Email subject key: `emails.subjects.discussionReply` (camelCase)

### FR-7: i18n

- **FR-7.1:** New i18n keys in both `locales/en.json` and `locales/id.json` under `discussions.*` namespace: `discussions.title`, `discussions.placeholder`, `discussions.send`, `discussions.reply`, `discussions.delete`, `discussions.deleted`, `discussions.empty.title`/`.description`, `discussions.deleteWindowExpired`, `discussions.loading`
- **FR-7.2:** Notification keys: `notifications.events.discussion_reply.title`/`.message` (params: `authorName`, `checkpointName`, `assignmentTitle`, `messagePreview`)
- **FR-7.3:** Email subject key: `emails.subjects.discussionReply`
- **FR-7.4:** Discussions tab label uses `discussions.title` (matching existing pattern — no `instructorAssignments.tabs.*` namespace)
- **FR-7.5:** Run `pnpm generate:i18n` after adding keys

## Non-Functional Requirements

### NFR-1: Performance
- Message list uses pagination (20/page) with TanStack Query `refetchInterval: 30s` for near-real-time updates
- Optimistic updates (insert + soft-delete) ensure instant UI feedback without waiting for server round-trip
- No WebSocket/SSE in v1 (30s polling is sufficient for async Q&A)

### NFR-2: Security
- Ownership guards on all server functions: students can only access discussions on their own checkpoints; instructors can only access discussions on checkpoints in their assignments
- Message input validated via Zod (1–2000 chars, non-empty)
- `parentMessageId` validated to belong to the same checkpoint (prevents cross-checkpoint reply injection)
- Deletion window enforced server-side (15-minute check in `deleteOwnMessageHandler` — client can hide the button but server enforces the actual window)
- Email enqueue is advisory (post-commit, try/catch) — never affects the message post transaction

### NFR-3: Accessibility
- `ScrollArea` is keyboard-navigable
- Delete button has `aria-label` (i18n key)
- Message input has associated label via `FormField`/`FormItem` pattern
- Empty state uses `EmptyState` component with `icon` prop (WCAG compliant)
- Color contrast meets WCAG 2.1 AA (role-based alignment supplemented by author name + avatar — not color alone)

### NFR-4: Code Quality
- Server functions follow two-file split with `.inputValidator(Schema).handler(...)` builder pattern
- All files ≤500 lines (enforced by `check-modularity.js`)
- `discussionKeys` factory added to `src/lib/query-keys.ts` (matching `notificationKeys`/`consultationKeys` pattern)
- New schema registered in `src/db/schema/index.ts` re-exports + relations

## Acceptance Criteria

- **AC-1:** Student opens `/student/assignments/$id/checkpoints/$checkpointId` → sees a discussion panel below the submission section. Posts a message → message appears instantly (optimistic update) and persists after refetch.
- **AC-2:** Instructor opens `/instructor/assignments/$id` → clicks "Discussions" tab → sees all discussion messages across checkpoints, grouped by checkpoint. Instructor replies → student receives in-app notification + email (if not disabled in preferences).
- **AC-3:** Student clicks the notification → navigates to the checkpoint page with the discussion panel visible.
- **AC-4:** Student tries to delete their own message after 15 minutes → delete button is gone. Within 15 minutes → delete succeeds, message shows "[deleted]" placeholder, replies preserved.
- **AC-5:** Student tries to delete an instructor's message → no delete button visible. Instructor cannot delete student messages.
- **AC-6:** Instructor opens review detail page → sees inline `DiscussionPanel` below the file preview.
- **AC-7:** A student cannot view another student's discussion thread (ownership guard returns error).
- **AC-8:** `discussion_reply` notifications are clickable and navigate to the correct page based on `metadata.target`.
- **AC-9:** Notifications respect user preferences — disabling in-app or email for `discussion_reply` stops that channel.
- **AC-10:** `discussion_reply` appears in the "Consultations" group in the notification center.
- **AC-11:** Reply threading works — replies indented 1 level under parent messages. Deleting a parent preserves replies.
- **AC-12:** `pnpm test:coverage` ≥80% on all thresholds. `pnpm typecheck` and `pnpm lint` pass. `pnpm check:i18n` parity confirmed.

## Out of Scope

- Real-time WebSocket/SSE push (v2 — v1 uses 30s polling)
- @mentions or user tagging (v2)
- Rich text / markdown formatting (v1 is plain text only)
- File attachments in discussions (v2 — files go through the existing submission/upload flow)
- Class-wide discussion threads visible to all students (v1 is per-student-per-checkpoint — private between student and instructor; v2 could add "class discussion" mode)
- Discussion moderation tools (v2 — instructor can't delete student messages, only their own; admin has no discussion access)
- Read receipts (v2)
- Search within discussion threads (v2)
- Deeper reply nesting beyond 1 level (v2)
