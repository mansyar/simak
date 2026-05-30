# Implementation Plan: Deadline Extension Workflow

## Phase 1: Database Migration & Schema

- [x] Task: Create Drizzle schema for `extension_requests` table
  - [x] Define `extensionRequests` table in `src/db/schema/extensions.ts` with all columns, FK references, and CHECK constraints
  - [x] Add `extensionRequestsRelations` in `src/db/schema/index.ts`
  - [x] Export `extensionRequests` from `src/db/schema/index.ts`
- [x] Task: Add extension cap columns to `assignments` schema
  - [x] Add `maxExtensionDays: integer('max_extension_days').default(7)` to `src/db/schema/assignments.ts`
  - [x] Add `maxTotalExtensions: integer('max_total_extensions').default(3)` to `src/db/schema/assignments.ts`
- [x] Task: Generate Drizzle migration
  - [x] Run `pnpm db:generate` (migration created manually as SQL file)
  - [x] Verify migration SQL is correct (extension_requests table, assignment columns)
- [x] Task: Conductor - User Manual Verification 'Phase 1: Database Migration & Schema' (Protocol in workflow.md)
  - [x] Phase checkpoint SHA: `391d6ef33f4171586a772712bb34eb48e3f1dfe1`
  - [x] Git note attached with audit verification report

## Phase 2: Server Functions — Extension Request Handlers

- [x] Task: Create `src/server/extensions.ts` with Zod schemas
  - [x] Define `RequestExtensionSchema` (assignmentId, checkpointId nullable, category enum, reason min 10, extensionDays 1–30)
  - [x] Define `ListExtensionRequestsSchema` (assignmentId, status optional, page, limit)
  - [x] Define `ApproveExtensionSchema` (requestId, resolutionReason optional)
  - [x] Define `RejectExtensionSchema` (requestId, resolutionReason required min 20)
  - [x] Define `BulkExtendSchema` (assignmentId, studentId, extraDays positive int, reason)
  - [x] Create client-safe `createServerFn` stubs for all 5 handlers
- [x] Task: Create `src/server/extensions.server.ts` with handlers (split into 2 files for ≤500 line limit)
  - [x] `extensions.server.ts` (279 lines): `requestExtensionHandler` + `listExtensionRequestsHandler`
  - [x] `extensions-extras.server.ts` (408 lines): `approveExtensionHandler`, `rejectExtensionHandler`, `bulkExtendHandler`
  - [x] Add `calculateExtensionAdjustment` helper — extends affected + subsequent checkpoints and finalDeadline
  - [x] Re-export extras from `extensions.server.ts`
- [x] Task: Wire existing handlers to audit log
  - [x] Modify `extendDeadlineHandler` — add `logAuditEvent('deadline.extended')`
  - [x] Modify `unlockCheckpointHandler` — add `logAuditEvent('checkpoint.unlocked')`
- [x] Task: Conductor - User Manual Verification 'Phase 2: Server Functions' (Protocol in workflow.md)
  - [x] Phase checkpoint SHA: `45b7897c42ed2d8ce37555998b4024faf70dd95b`
  - [x] Git note attached with audit verification report

## Phase 3: Notification Events & i18n

- [x] Task: Register extension notification events
  - [x] Wire `extension_requested` notification in `requestExtensionHandler` — sent to assignment instructor
  - [x] Wire `extension_approved` notification in `approveExtensionHandler` — sent to student
  - [x] Wire `extension_rejected` notification in `rejectExtensionHandler` — sent to student
  - [x] Register notification type strings in the existing notification infrastructure (free-text type, no registry needed)
- [x] Task: Add i18n translation keys
  - [x] Add English translations in `locales/en.json` for extension form labels, queue labels, approval dialog, reject dialog, notification messages, status badges
  - [x] Add Indonesian translations in `locales/id.json`
  - [x] Run `pnpm generate:i18n` to regenerate TypeScript types
- [x] Task: Conductor - User Manual Verification 'Phase 3: Notifications & i18n' (Protocol in workflow.md)
  - [x] Phase checkpoint SHA: `f08d0c4d8fcd397c7ff7262a2122bd5cea0a137a`
  - [x] Git note attached with audit verification report

## Phase 4: Student UI — Extension Request Tab ✅

- [x] Task: Write failing tests for extension request UI
  - [x] Write test — form renders with all fields (category, reason, duration, checkpoint selector)
  - [x] Write test — form validation (empty reason, duration out of range, missing category)
  - [x] Write test — submission fires mutation and shows success state
  - [x] Write test — extension history list renders with status badges
- [x] Task: Build ExtensionRequestForm component
  - [x] Create `src/components/student/extensions/ExtensionRequestForm.tsx`
  - [x] Category dropdown (Personal, Research, Health, Other) using shadcn/ui Select
  - [x] Reason textarea with character count
  - [x] Duration number input (1–maxExtensionDays, capped)
  - [x] Optional checkpoint selector dropdown (defaults to current active checkpoint)
  - [x] Submit with loading state and error handling
- [x] Task: Build ExtensionHistoryList component
  - [x] Create `src/components/student/extensions/ExtensionHistoryList.tsx`
  - [x] Table with columns: Date, Category, Duration, Status badge, Resolution
  - [x] Status badges: pending=yellow, approved=green, rejected=red
  - [x] Empty state: "No extension requests"
- [x] Task: Integrate into student assignment detail page
  - [x] Add extension request tab/section to `/student/assignments/$id`
  - [x] Fetch real `maxExtensionDays` and `maxTotalExtensions` from assignment data
  - [x] Wire `requestExtension` mutation via TanStack Query
- [x] Task: Conductor - User Manual Verification 'Phase 4: Student UI' (Protocol in workflow.md)

## Phase 5: Instructor UI — Extension Queue in DeadlineManager ✅

- [x] Task: Write failing tests for extension queue UI
  - [x] Write test — pending extensions section renders with count badge
  - [x] Write test — approve dialog opens and submits
  - [x] Write test — reject dialog enforces min 20 chars reason
- [x] Task: Build PendingExtensionsSection component
  - [x] Each item: student name, checkpoint name, category badge, reason snippet, duration, timestamp
  - [x] Approve/Reject action buttons per item
- [x] Task: Build ApproveExtensionDialog component
  - [x] Dialog shows request details
  - [x] Optional comment textarea
  - [x] Confirm/Cancel buttons
- [x] Task: Build RejectExtensionDialog component
  - [x] Dialog shows request details
  - [x] Required reason textarea (min 20 chars) with character count
  - [x] Submit disabled until min chars met
- [ ] ~~Task: Build BulkExtendControls component~~ (deferred — not in current scope)
- [x] Task: Integrate into instructor assignment detail page
  - [x] Add "Extension Requests" tab with count badge
  - [x] Load pending extension requests on mount alongside consultations
  - [x] Wire approveExtension/rejectExtension handlers with auto-refresh
- [x] Task: Conductor - User Manual Verification 'Phase 5: Instructor UI' (Protocol in workflow.md)

## Phase 6: Server Handler Tests

- [x] Task: Write unit tests for extension request handler (9b74177)
  - [x] Test — creates extension request successfully
  - [x] Test — rejects when max_extension_days exceeded
  - [x] Test — rejects when max_total_extensions exceeded (pending + approved count)
  - [x] Test — sends notification to instructor
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
