# Track: Atomic Extension Request + Notification

## Overview

`requestExtensionHandler` (`src/server/extensions.server.ts:81-214`) performs two non-transactional database writes:

1. **Extension request insert** (line 174): `db.insert(extensionRequests)` — persists the student's pending extension request.
2. **Instructor notification insert** (line 191): `db.insert(notifications)` — creates an `extension_requested` in-app notification for the instructor.

These two writes are independent. If the notification insert fails (e.g., DB constraint violation, connection drop), the extension request is already committed. The student receives a 500 error, but their request is silently persisted as `pending` with no instructor notification ever created. The instructor never learns about the request, and the student cannot tell that their request was partially saved.

### Root Cause

The two writes are plain `db.insert(...)` calls executed sequentially outside any transaction boundary. There is no rollback guarantee.

### Precedent

`submitCheckpointHandler` (`src/server/submissions.server.ts:44`) establishes the correct pattern: it wraps the submission insert + checkpoint state transition + instructor notification insert inside a single `db.transaction(async (tx) => { ... })`, using `tx.insert(notifications)` so that any insert failure rolls back all preceding writes in the same transaction.

## Functional Requirements

### FR-1: Wrap the two writes in `db.transaction`

The `extensionRequests` insert and the `notifications` insert must be wrapped in a single `db.transaction(async (tx) => { ... })` call. Both inserts must use `tx.insert(...)` instead of `db.insert(...)`.

### FR-2: Leave validation reads outside the transaction

All six validation reads must remain outside the transaction boundary, using `db` (not `tx`):

1. Enrollment check (assignmentStudents select)
2. Assignment caps + instructorId fetch (assignments select)
3. Extension-days cap validation
4. Active extension count (countActiveExtensionRequests)
5. Active checkpoint resolution (findActiveCheckpoint, when no checkpointId provided)
6. Checkpoint dueDate fetch (for requestedDeadline calculation)

The transaction opens immediately before the extension request insert and closes after the notification insert.

### FR-3: Return value preserved

The handler's return shape must remain `{ extensionRequest: { id } }` on success and the existing `serverError(...)` shapes on failure. No API contract change.

### FR-4: Rollback on notification failure

If the `notifications` insert throws inside the transaction, the `extensionRequests` insert must be rolled back. The handler must return a `serverError(INTERNAL)` — no orphaned pending request may persist.

## Non-Functional Requirements

### NFR-1: No behavioral change to existing happy-path

Students who successfully request an extension must see identical behavior: request persisted, instructor notified, return `{ extensionRequest: { id } }`.

### NFR-2: No new dependencies

The fix uses the existing Drizzle `db.transaction()` API already used by `submitCheckpointHandler`. No new packages, no schema changes, no migrations.

### NFR-3: Test coverage maintained

All 9 existing unit tests in `tests/unit/server/extensions-request.test.ts` must pass after reshaping. The mock strategy extends the existing `mockDb` with a `transaction` method that invokes the callback with `mockDb` itself as the `tx` object, so existing `.then` queue logic continues to work.

## Acceptance Criteria

- [ ] AC-1: `requestExtensionHandler` wraps the extensionRequests insert + notifications insert in `db.transaction(async (tx) => { ... })`, with both inserts using `tx.insert(...)`.
- [ ] AC-2: All six validation reads remain outside the transaction, using `db`.
- [ ] AC-3: A unit test asserts that when the notifications insert throws, the extension request is NOT persisted (rollback verified via mock assertions on `tx.insert` call ordering and transaction rejection).
- [ ] AC-4: All 9 existing unit tests pass after reshaping to mock `db.transaction`.
- [ ] AC-5: `pnpm typecheck` passes.
- [ ] AC-6: `pnpm lint` passes.
- [ ] AC-7: `pnpm test` passes with coverage thresholds met (>80%).

## Out of Scope

- **Count-cap race condition** — The `countActiveExtensionRequests` read (step 4) is outside the transaction and susceptible to a TOCTOU race where two concurrent requests could both pass the count check. This is tracked independently and is NOT addressed by this track.
- **Integration test** — An integration test mirroring the C2/H3 concurrency-test precedent was considered but deferred. Unit-level rollback assertions are sufficient proof for this fix.
- **Audit logging** — The handler does not currently log audit events, and no audit logging is added by this track. The `submitCheckpointHandler` post-commit audit pattern is noted as a possible future enhancement but is out of scope.
- **API contract changes** — No changes to request/response shapes, Zod schemas, or server-function stubs (`src/server/extensions.ts`).
- **Other extension handlers** — `approveExtensionHandler`, `rejectExtensionHandler`, `bulkExtendHandler`, and `listExtensionRequestsHandler` are not modified.
