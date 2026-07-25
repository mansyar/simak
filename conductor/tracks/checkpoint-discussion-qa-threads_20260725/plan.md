<protect>
# TRACK-026: Checkpoint Discussion / Q&A Threads — Implementation Plan

## Phase 1: Schema & Server Functions [checkpoint: ec13b93c]

- [x] Task: Read `spec.md` and `workflow.md` to re-establish context before starting Phase 1 implementation
    - [x] Read `conductor/tracks/checkpoint-discussion-qa-threads_20260725/spec.md`
    - [x] Read `conductor/workflow.md`

- [x] Task: Create `checkpoint_discussions` database schema
    - [x] Write failing tests for schema definition (table exists, FKs cascade, indexes present, soft-delete column, self-referencing parentMessageId)
    - [x] Implement `src/db/schema/discussions.ts` with `checkpoint_discussions` table — `id` (serial PK), `checkpointId` (integer FK → checkpoints `onDelete: cascade`), `assignmentId` (integer FK → assignments `onDelete: cascade`), `userId` (text FK → users), `message` (text not null), `parentMessageId` (integer FK self-ref nullable), `createdAt`, `updatedAt`, `deletedAt` (nullable soft-delete). Indexes: `(checkpointId, createdAt ASC)`, `(assignmentId, createdAt DESC)`, `(parentMessageId)`
    - [x] Register in `src/db/schema/index.ts` re-exports + `checkpointDiscussionsRelations`
    - [x] Run `pnpm test` — confirm schema tests pass
    - [x] Run `pnpm db:generate` to generate migration
    - [x] Run `pnpm db:push` to apply to dev DB (applied via psql — drizzle-kit push requires TTY)
    - **Commit:** `88a5cac4` — feat(db): Add checkpoint_discussions table schema

- [x] Task: Add `'discussion_reply'` to email queue template type enums
    - [x] Write failing test asserting `'discussion_reply'` is in the `templateType` enum array in `email-queue.ts` and in the `TemplateType` union in `email.ts`
    - [x] Add `'discussion_reply'` to `templateType` enum array in `src/db/schema/email-queue.ts`
    - [x] Add `'discussion_reply'` to `TemplateType` union in `src/lib/email.ts`
    - [x] Run `pnpm test` — confirm tests pass
    - **Commit:** `569a64ea` — feat(email): Add discussion_reply template type for checkpoint Q&A emails

- [x] Task: Create Zod schemas and server function stubs (`src/server/discussions.ts`)
    - [x] Write failing test asserting stubs exist and are callable (mock `createServerFn` builder chain per `submissions.test.ts` pattern)
    - [x] Implement `ListDiscussionMessagesSchema` (checkpointId + page/limit pagination), `PostDiscussionMessageSchema` (checkpointId + message min 1 max 2000 + optional parentMessageId), `DeleteOwnMessageSchema` (messageId)
    - [x] Implement `createServerFn` stubs with `.inputValidator(Schema).handler(...)` builder pattern — `listDiscussionMessages`, `postDiscussionMessage`, `deleteOwnMessage`
    - [x] Run `pnpm test` — confirm tests pass
    - **Commit:** `21b9e112` — feat(server): Add discussions Zod schemas and server function stubs

- [x] Task: Implement `listDiscussionMessagesHandler` (`src/server/discussions.server.ts`)
    - [x] Write failing tests: paginated 20/page, ordered by createdAt ASC, includes author name + role via JOIN, ownership verified (student can't view other students' discussions, instructor can view all in their assignments), soft-deleted messages excluded from list but replies to them included
    - [x] Implement handler — paginated query with JOIN to `users` for author name/role, ownership guard via `assignmentStudents` join for students and `assignments.instructorId` for instructors, exclude `deletedAt IS NOT NULL` from top-level but include replies to deleted parents
    - [x] Run `pnpm test` — confirm all handler tests pass
    - **Commit:** `a1ed2908` — feat(server): Implement listDiscussionMessagesHandler with pagination and ownership guard

- [x] Task: Implement `postDiscussionMessageHandler` (`src/server/discussions.server.ts`)
    - [x] Write failing tests: validates message length 1–2000, rejects empty, rejects > 2000, verifies ownership (student owns checkpoint OR instructor owns assignment), inserts message, fires `discussion_reply` notification to the other party via `maybeInsertNotification` with `metadata.target` set to recipient role, fires email via `enqueueEventEmail` advisory post-commit try/catch, `parentMessageId` validated to same checkpoint
    - [x] Implement handler — Zod validation, ownership guard, message insert, post-commit advisory notification + email dispatch (try/catch), parentMessageId validation
    - [x] Run `pnpm test` — confirm all handler tests pass
    - **Commit:** `302d3187` — feat(server): Implement postDiscussionMessageHandler with notifications and email

- [x] Task: Implement `deleteOwnMessageHandler` (`src/server/discussions.server.ts`)
    - [x] Write failing tests: verifies requesting user is author, rejects after 15-min deletion window, soft-deletes via `deletedAt`, preserves reply threading (replies to deleted message still render)
    - [x] Implement handler — author verification, 15-min window check (`createdAt` vs `now()`), soft-delete via `deletedAt` update
    - [x] Run `pnpm test` — confirm all handler tests pass
    - **Commit:** `f98f72ca` — feat(server): Implement deleteOwnMessageHandler with 15-min deletion window

- [x] Task: Add `discussionKeys` factory to `src/lib/query-keys.ts`
    - [x] Write failing test asserting `discussionKeys` factory exists with `list(checkpointId, page)` and `detail(checkpointId)` methods
    - [x] Implement `discussionKeys` factory matching `notificationKeys`/`consultationKeys` pattern
    - [x] Run `pnpm test` — confirm tests pass
    - **Commit:** `a566e4f4` — feat(lib): Add discussionKeys query-key factory for checkpoint discussions

- [x] Task: Conductor - User Manual Verification 'Phase 1: Schema & Server Functions' (Protocol in workflow.md)

## Phase 2: UI Components & Notifications [checkpoint: 72088a36]

- [x] Task: Read `spec.md` and `workflow.md` to re-establish context before starting Phase 2 implementation
    - [x] Read `conductor/tracks/checkpoint-discussion-qa-threads_20260725/spec.md`
    - [x] Read `conductor/workflow.md`

- [x] Task: Create `DiscussionPanel` component (`src/components/discussions/discussion-panel.tsx`)
    - [x] Write failing tests: renders message list, send button disabled on empty input, delete button visible within 15-min window only on own messages, deleted messages show "[deleted]" placeholder, empty state renders `EmptyState` with `icon` prop, loading state renders `Skeleton`, optimistic insert on send, optimistic soft-delete on delete, role-based message alignment (student left / instructor right), 1-level reply threading with indentation
    - [x] Implement `DiscussionPanel` — `ScrollArea` with message bubbles (role-based alignment), `Avatar` with initials, `formatRelativeTime` timestamps, reply threading via `parentMessageId` (1 level indented), `Textarea` + send `Button` (react-hook-form + Zod `mode: 'onSubmit'`), delete button on own messages within 15-min window, deleted messages as muted placeholder, `EmptyState` with `MessageCircle` icon, `Skeleton` loading
    - [x] Implement `useQuery` with `discussionKeys.list(checkpointId, page)` and 30s `refetchInterval`
    - [x] Implement `useMutation` for post (optimistic insert via `onMutate`/`onError`/`onSettled` matching TRACK-014 pattern) and delete (optimistic soft-delete)
    - [x] Run `pnpm test` — confirm all component tests pass
    - **Commit:** `b7493a9d` — feat(ui): Add DiscussionPanel with Avatar and ScrollArea components

- [x] Task: Mount `DiscussionPanel` on student checkpoint detail page
    - [x] Write failing test asserting `DiscussionPanel` renders below the submission/review section on `/student/assignments/$id.checkpoints.$checkpointId.tsx`
    - [x] Import and render `DiscussionPanel` with `checkpointId` and `assignmentId` props below the submission section
    - [x] Run `pnpm test` — confirm tests pass
    - **Commit:** `1a22b99f` — feat(ui): Mount DiscussionPanel on student checkpoint detail page

- [x] Task: Add "Discussions" tab on instructor assignment detail page
    - [x] Write failing test asserting the Discussions tab renders and shows messages grouped by checkpoint
    - [x] Add `{ id: 'discussions', label: t('discussions.title') }` to `tabList` array in instructor assignment detail route
    - [x] Add conditional render block for discussions tab — `DiscussionPanel` with `instructorView` prop, showing all checkpoint discussions grouped by checkpoint
    - [x] Run `pnpm test` — confirm tests pass
    - **Commit:** `d2056669` — feat(ui): Add Discussions tab on instructor assignment detail page

- [x] Task: Add inline `DiscussionPanel` on review detail page
    - [x] Write failing test asserting `DiscussionPanel` renders below the file preview section on `/instructor/reviews/$submissionId.tsx`
    - [x] Import and render `DiscussionPanel` below the file preview section with `checkpointId` derived from the submission's checkpoint
    - [x] Run `pnpm test` — confirm tests pass
    - **Commit:** `37e59afe` — feat(ui): Mount DiscussionPanel inline on instructor review detail page

- [x] Task: Integrate `discussion_reply` notification type
    - [x] Write failing tests: notification route for `discussion_reply` returns correct path for student target (`/student/assignments/{id}/checkpoints/{checkpointId}`) and instructor target (`/instructor/assignments/{id}`), missing target returns null
    - [x] Add `case 'discussion_reply':` to `getNotificationRoute()` in `src/components/notifications/notification-routes.ts` — checks `metadata.target` to return student or instructor route
    - [x] Add `discussion_reply: MessageCircle` to `TYPE_ICONS` in `src/components/notifications/NotificationItem.tsx`
    - [x] Add `discussion_reply` to `consultations` group in `GROUP_CONFIGS` in `src/components/notifications/NotificationCenter.tsx`
    - [x] Run `pnpm test` — confirm all notification integration tests pass
    - **Commit:** `98628402` — feat(notifications): Integrate discussion_reply notification type

- [x] Task: Conductor - User Manual Verification 'Phase 2: UI Components & Notifications' (Protocol in workflow.md)

## Phase 3: Email, i18n & Polish

- [ ] Task: Read `spec.md` and `workflow.md` to re-establish context before starting Phase 3 implementation
    - [ ] Read `conductor/tracks/checkpoint-discussion-qa-threads_20260725/spec.md`
    - [ ] Read `conductor/workflow.md`

- [ ] Task: Create `buildDiscussionReplyHtml` email template
    - [ ] Write failing tests: email renders both locales, uses `STRINGS` object, message preview truncated to 100 chars + HTML-escaped, CTA link correct (student → checkpoint page, instructor → assignment page)
    - [ ] Implement `buildDiscussionReplyHtml` in `src/lib/email-templates.ts` — internal helpers, `STRINGS[locale].discussionReply` for intro, message preview truncated + HTML-escaped, CTA link
    - [ ] Run `pnpm test` — confirm email template tests pass

- [ ] Task: Create `sendDiscussionReplyEmail` helper (`src/lib/discussion-email.ts`)
    - [ ] Write failing test asserting the helper calls `enqueueEventEmail` with correct params (templateType: `'discussion_reply'`, recipient, subject, body)
    - [ ] Implement `sendDiscussionReplyEmail()` wrapping `enqueueEventEmail` (matching `review-email.ts` pattern — receives all data as params, no DB lookup needed)
    - [ ] Run `pnpm test` — confirm tests pass

- [ ] Task: Add i18n keys to both locales
    - [ ] Add `discussions.*` keys to `locales/en.json`: `title`, `placeholder`, `send`, `reply`, `delete`, `deleted`, `empty.title`, `empty.description`, `deleteWindowExpired`, `loading`
    - [ ] Add same keys to `locales/id.json` with Indonesian translations
    - [ ] Add `notifications.events.discussion_reply.title`/`.message` to both locales (params: authorName, checkpointName, assignmentTitle, messagePreview)
    - [ ] Add `emails.subjects.discussionReply` to both locales
    - [ ] Run `pnpm generate:i18n` to regenerate types
    - [ ] Run `pnpm check:i18n` — confirm EN↔ID parity

- [ ] Task: Final quality gates verification
    - [ ] Run `pnpm test:coverage` — confirm ≥80% on all thresholds (lines, statements, branches, functions)
    - [ ] Run `pnpm typecheck` — confirm 0 errors
    - [ ] Run `pnpm lint` — confirm 0 warnings, 0 errors (including `simak-i18n/no-hardcoded` rule)
    - [ ] Run `pnpm check:i18n` — confirm parity
    - [ ] Verify all files under 500 lines (`scripts/check-modularity.js`)
    - [ ] Verify responsive layout at mobile/tablet/desktop widths (browser dev tools)
    - [ ] Verify keyboard navigation through discussion panel (Tab/Enter/Space)

- [ ] Task: Conductor - User Manual Verification 'Phase 3: Email, i18n & Polish' (Protocol in workflow.md)
</protect>
