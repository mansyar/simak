# Implementation Plan: Deadline Extension Workflow

## Phase 1: Database Migration & Schema

- [ ] Task: Create Drizzle schema for `extension_requests` table
  - [ ] Define `extensionRequests` table in `src/db/schema/extensions.ts` with all columns, FK references, and CHECK constraints
  - [ ] Add `extensionRequestsRelations` in `src/db/schema/index.ts`
  - [ ] Export `extensionRequests` from `src/db/schema/index.ts`
- [ ] Task: Add extension cap columns to `assignments` schema
  - [ ] Add `maxExtensionDays: integer('max_extension_days').default(7)` to `src/db/schema/assignments.ts`
  - [ ] Add `maxTotalExtensions: integer('max_total_extensions').default(3)` to `src/db/schema/assignments.ts`
- [ ] Task: Generate Drizzle migration
  - [ ] Run `pnpm db:generate`
  - [ ] Verify migration SQL is correct (extension_requests table, assignment columns)
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Database Migration & Schema' (Protocol in workflow.md)

## Phase 2: Server Functions — Extension Request Handlers

- [ ] Task: Create `src/server/extensions.ts` with Zod schemas
  - [ ] Define `RequestExtensionSchema` (assignmentId, checkpointId nullable, category enum, reason min 10, extensionDays 1–30)
  - [ ] Define `ListExtensionRequestsSchema` (assignmentId, status optional, page, limit)
  - [ ] Define `ApproveExtensionSchema` (requestId, resolutionReason optional)
  - [ ] Define `RejectExtensionSchema` (requestId, resolutionReason required min 20)
  - [ ] Define `BulkExtendSchema` (assignmentId, studentId, extraDays positive int, reason)
  - [ ] Create client-safe `createServerFn` stubs for all 5 handlers
- [ ] Task: Create `src/server/extensions.server.ts` with handlers
  - [ ] Write `requestExtensionHandler` — validates caps, creates request, sends notification
  - [ ] Write `listPendingExtensionsHandler` — lists pending requests (instructor-only, ownership-guarded)
  - [ ] Write `approveExtensionHandler` — approves, extends checkpoints, logs audit event, notifies student
  - [ ] Write `rejectExtensionHandler` — rejects with reason, logs audit event, notifies student
  - [ ] Write `bulkExtendHandler` — extends all unfinished checkpoints by +N days, logs per-extension audit events
  - [ ] Add `calculateExtensionAdjustment` helper — extends affected + subsequent checkpoints and finalDeadline
- [ ] Task: Wire existing handlers to audit log
  - [ ] Modify `extendDeadlineHandler` (assignments.server.ts) — add `logAuditEvent('deadline.extended')`
  - [ ] Modify `unlockCheckpointHandler` (assignments.server.ts) — add `logAuditEvent('checkpoint.unlocked')`
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Server Functions' (Protocol in workflow.md)

## Phase 3: Notification Events & i18n

- [ ] Task: Register extension notification events
  - [ ] Wire `extension_requested` notification in `requestExtensionHandler` — sent to assignment instructor
  - [ ] Wire `extension_approved` notification in `approveExtensionHandler` — sent to student
  - [ ] Wire `extension_rejected` notification in `rejectExtensionHandler` — sent to student
  - [ ] Register notification type strings in the existing notification infrastructure
- [ ] Task: Add i18n translation keys
  - [ ] Add English translations in `locales/en.json` for extension form labels, queue labels, approval dialog, reject dialog, notification messages, status badges
  - [ ] Add Indonesian translations in `locales/id.json`
  - [ ] Run `pnpm generate:i18n` to regenerate TypeScript types
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Notifications & i18n' (Protocol in workflow.md)

## Phase 4: Student UI — Extension Request Tab

- [ ] Task: Write failing tests for extension request UI
  - [ ] Write test — form renders with all fields (category, reason, duration, checkpoint selector)
  - [ ] Write test — form validation (empty reason, duration out of range, missing category)
  - [ ] Write test — submission fires mutation and shows success state
  - [ ] Write test — extension history list renders with status badges
- [ ] Task: Build ExtensionRequestForm component
  - [ ] Create `src/components/student/extensions/ExtensionRequestForm.tsx`
  - [ ] Category dropdown (Personal, Research, Health, Other) using shadcn/ui Select
  - [ ] Reason textarea with character count
  - [ ] Duration number input (1–maxExtensionDays, capped)
  - [ ] Optional checkpoint selector dropdown (defaults to current active checkpoint)
  - [ ] Submit with loading state and error handling
- [ ] Task: Build ExtensionHistoryList component
  - [ ] Create `src/components/student/extensions/ExtensionHistoryList.tsx`
  - [ ] Table with columns: Date, Category, Duration, Status badge, Resolution
  - [ ] Status badges: pending=yellow, approved=green, rejected=red
  - [ ] Empty state: "No extension requests"
- [ ] Task: Integrate into student assignment detail page
  - [ ] Add extension request tab/section to `/student/assignments/$id`
  - [ ] Fetch real `maxExtensionDays` and `maxTotalExtensions` from assignment data
  - [ ] Wire `requestExtension` mutation via TanStack Query
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Student UI' (Protocol in workflow.md)

## Phase 5: Instructor UI — Extension Queue in DeadlineManager

- [ ] Task: Write failing tests for extension queue UI
  - [ ] Write test — pending extensions section renders with count badge
  - [ ] Write test — approve dialog opens and submits
  - [ ] Write test — reject dialog enforces min 20 chars reason
  - [ ] Write test — bulk extend controls work
- [ ] Task: Build PendingExtensionsSection component
  - [ ] Each item: student name, checkpoint name, category badge, reason snippet, duration, timestamp
  - [ ] Approve/Reject action buttons per item
- [ ] Task: Build ApproveExtensionDialog component
  - [ ] Dialog shows request details
  - [ ] Optional comment textarea
  - [ ] Confirm/Cancel buttons
- [ ] Task: Build RejectExtensionDialog component
  - [ ] Dialog shows request details
  - [ ] Required reason textarea (min 20 chars) with character count
  - [ ] Submit disabled until min chars met
- [ ] Task: Build BulkExtendControls component
  - [ ] Per-student section: +N days input (positive integer), reason textarea, Apply button
  - [ ] Confirmation before applying
- [ ] Task: Integrate into DeadlineManager on `/instructor/assignments/$id`
  - [ ] Add pending extensions section with count badge
  - [ ] Wire approveExtension, rejectExtension, bulkExtend mutations via TanStack Query
- [ ] Task: Conductor - User Manual Verification 'Phase 5: Instructor UI' (Protocol in workflow.md)

## Phase 6: Server Handler Tests

- [ ] Task: Write unit tests for extension request handler
  - [ ] Test — creates extension request successfully
  - [ ] Test — rejects when max_extension_days exceeded
  - [ ] Test — rejects when max_total_extensions exceeded (pending + approved count)
  - [ ] Test — sends notification to instructor
- [ ] Task: Write unit tests for approve/reject handlers
  - [ ] Test — approval extends affected checkpoint dueDate
  - [ ] Test — approval extends subsequent checkpoint dueDates
  - [ ] Test — approval extends assignment finalDeadline
  - [ ] Test — approve logs `deadline.extension_approved` audit event
  - [ ] Test — reject with reason logs `deadline.extension_rejected` audit event
  - [ ] Test — reject requires min 20 chars reason
- [ ] Task: Write unit tests for bulk extension handler
  - [ ] Test — extends all unfinished checkpoints (locked, unlocked, submitted, under_review, revise)
  - [ ] Test — skips passed checkpoints
  - [ ] Test — logs individual `deadline.extended` audit events per checkpoint
- [ ] Task: Write unit tests for audit log wiring
  - [ ] Test — `extendDeadlineHandler` logs `deadline.extended`
  - [ ] Test — `unlockCheckpointHandler` logs `checkpoint.unlocked`
- [ ] Task: Verify full test suite passes
  - [ ] Run `pnpm test:coverage`
  - [ ] Run `pnpm typecheck`
  - [ ] Run `pnpm lint`
