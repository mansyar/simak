# Implementation Plan: Atomic Extension Request + Notification

## Phase 1: Reshape Unit Tests to Mock `db.transaction` (Red)

- [ ] Task: Add `transaction` mock to `mockDb` in `beforeEach`
    - [ ] Add a `transaction: vi.fn()` method to the `mockDb` object in `beforeEach` that invokes the provided callback with `mockDb` itself as the `tx` argument, returning the callback's result
    - [ ] Ensure the existing `.then` queue logic continues to work when reads run on `db` and writes run on `tx` (same mock object)
- [ ] Task: Update existing 9 unit tests for the transaction boundary
    - [ ] Update the two happy-path tests ("create extension request successfully with default checkpoint" + "create extension request with specific checkpointId") to assert `tx.insert` is called instead of `db.insert` for both the extensionRequests and notifications writes
    - [ ] Update the "should notify instructor via notification insert" test to assert the notification insert goes through `tx.insert` (not `db.insert`), and that `db.transaction` was called once
    - [ ] Verify the 6 validation-read tests (unauthorized, not-a-student, not-enrolled, exceeds-max-days, max-extensions-exceeded, checkpoint-not-found) still pass without modification — they short-circuit before the transaction boundary
- [ ] Task: Add new rollback unit test
    - [ ] Write a test that mocks `db.transaction` to invoke the callback, then makes the second `tx.insert` (notifications) throw an error
    - [ ] Assert the handler returns `serverError(INTERNAL)`
    - [ ] Assert the extensionRequests insert was called inside the tx but the transaction rejected (rollback semantics)
- [ ] Task: Run tests and confirm Red phase
    - [ ] Run `pnpm vitest run tests/unit/server/extensions-request.test.ts` and confirm the reshaped/new tests fail because `requestExtensionHandler` does not yet call `db.transaction`

- [ ] Task: Conductor - User Manual Verification 'Phase 1: Reshape Unit Tests to Mock `db.transaction` (Red)' (Protocol in workflow.md)

## Phase 2: Wrap Two Writes in `db.transaction` (Green)

- [ ] Task: Implement the transaction wrapper in `requestExtensionHandler`
    - [ ] Wrap the `db.insert(extensionRequests)` (step 7) and `db.insert(notifications)` (step 8) in a single `db.transaction(async (tx) => { ... })` block
    - [ ] Change both `db.insert(...)` calls to `tx.insert(...)` inside the transaction callback
    - [ ] Move the `requestedDeadline` calculation and `requestedParams`/`requestedKeys` setup inside the transaction callback (they depend on data computed before the writes)
    - [ ] Keep all six validation reads outside the transaction, using `db` (not `tx`)
    - [ ] Preserve the return shape: `{ extensionRequest: { id: request.id } }` returned from inside the tx callback
- [ ] Task: Run tests and confirm Green phase
    - [ ] Run `pnpm vitest run tests/unit/server/extensions-request.test.ts` and confirm all 10 tests (9 reshaped + 1 new rollback) pass
    - [ ] Run `pnpm test` to confirm no regressions across the full unit suite

- [ ] Task: Conductor - User Manual Verification 'Phase 2: Wrap Two Writes in `db.transaction` (Green)' (Protocol in workflow.md)

## Phase 3: Quality Gates & Coverage Verification

- [ ] Task: Verify type safety
    - [ ] Run `pnpm typecheck` and confirm zero errors
- [ ] Task: Verify linting
    - [ ] Run `pnpm lint` and confirm zero errors
- [ ] Task: Verify test coverage
    - [ ] Run `pnpm test:coverage` and confirm all thresholds met (>80% lines, functions, branches, statements)
    - [ ] Confirm the `extensions.server.ts` module coverage is not reduced by the transaction wrapper

- [ ] Task: Conductor - User Manual Verification 'Phase 3: Quality Gates & Coverage Verification' (Protocol in workflow.md)
