<protect>
# Implementation Plan: Atomic Extension Request + Notification

## Phase 1: Reshape Unit Tests to Mock `db.transaction` (Red) [checkpoint: 3420328]

- [x] Task: Pre-phase context review
    - [x] Read `spec.md` (`./conductor/tracks/extension-atomic_20260704/spec.md`) to confirm requirements and acceptance criteria
    - [x] Read `workflow.md` (`./conductor/workflow.md`) to confirm TDD workflow and quality gates
- [x] Task: Add `transaction` mock to `mockDb` in `beforeEach`
    - [x] Add a `transaction: vi.fn()` method to the `mockDb` object in `beforeEach` that invokes the provided callback with `mockDb` itself as the `tx` argument, returning the callback's result
    - [x] Ensure the existing `.then` queue logic continues to work when reads run on `db` and writes run on `tx` (same mock object)
- [x] Task: Update existing 9 unit tests for the transaction boundary
    - [x] Update the two happy-path tests ("create extension request successfully with default checkpoint" + "create extension request with specific checkpointId") to assert `tx.insert` is called instead of `db.insert` for both the extensionRequests and notifications writes
    - [x] Update the "should notify instructor via notification insert" test to assert the notification insert goes through `tx.insert` (not `db.insert`), and that `db.transaction` was called once
    - [x] Verify the 6 validation-read tests (unauthorized, not-a-student, not-enrolled, exceeds-max-days, max-extensions-exceeded, checkpoint-not-found) still pass without modification — they short-circuit before the transaction boundary
- [x] Task: Add new rollback unit test
    - [x] Write a test that mocks `db.transaction` to invoke the callback, then makes the second `tx.insert` (notifications) throw an error
    - [x] Assert the handler returns `serverError(INTERNAL)`
    - [x] Assert the extensionRequests insert was called inside the tx but the transaction rejected (rollback semantics)
- [x] Task: Run tests and confirm Red phase
    - [x] Run `pnpm vitest run tests/unit/server/extensions-request.test.ts` and confirm the reshaped/new tests fail because `requestExtensionHandler` does not yet call `db.transaction`

- [x] Task: Conductor - User Manual Verification 'Phase 1: Reshape Unit Tests to Mock `db.transaction` (Red)' (Protocol in workflow.md)

## Phase 2: Wrap Two Writes in `db.transaction` (Green) [checkpoint: 4d41ee6]

- [x] Task: Pre-phase context review
    - [x] Read `spec.md` (`./conductor/tracks/extension-atomic_20260704/spec.md`) to confirm requirements and acceptance criteria
    - [x] Read `workflow.md` (`./conductor/workflow.md`) to confirm implementation workflow and commit format
- [x] Task: Implement the transaction wrapper in `requestExtensionHandler`
    - [x] Wrap the `db.insert(extensionRequests)` (step 7) and `db.insert(notifications)` (step 8) in a single `db.transaction(async (tx) => { ... })` block
    - [x] Change both `db.insert(...)` calls to `tx.insert(...)` inside the transaction callback
    - [x] Move the `requestedDeadline` calculation and `requestedParams`/`requestedKeys` setup inside the transaction callback (they depend on data computed before the writes)
    - [x] Keep all six validation reads outside the transaction, using `db` (not `tx`)
    - [x] Preserve the return shape: `{ extensionRequest: { id: request.id } }` returned from inside the tx callback
- [x] Task: Run tests and confirm Green phase
    - [x] Run `pnpm vitest run tests/unit/server/extensions-request.test.ts` and confirm all 10 tests (9 reshaped + 1 new rollback) pass
    - [x] Run `pnpm test` to confirm no regressions across the full unit suite

- [x] Task: Conductor - User Manual Verification 'Phase 2: Wrap Two Writes in `db.transaction` (Green)' (Protocol in workflow.md)

## Phase 3: Quality Gates & Coverage Verification

- [x] Task: Pre-phase context review
    - [x] Read `spec.md` (`./conductor/tracks/extension-atomic_20260704/spec.md`) to confirm acceptance criteria
    - [x] Read `workflow.md` (`./conductor/workflow.md`) to confirm quality gate definitions and commit format
- [x] Task: Verify type safety
    - [x] Run `pnpm typecheck` and confirm zero errors
- [x] Task: Verify linting
    - [x] Run `pnpm lint` and confirm zero errors
- [x] Task: Verify test coverage
    - [x] Run `pnpm test:coverage` and confirm all thresholds met (>80% lines, functions, branches, statements)
    - [x] Confirm the `extensions.server.ts` module coverage is not reduced by the transaction wrapper

- [~] Task: Conductor - User Manual Verification 'Phase 3: Quality Gates & Coverage Verification' (Protocol in workflow.md)
</protect>
