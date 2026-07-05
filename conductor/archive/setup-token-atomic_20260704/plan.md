<protect>
# Implementation Plan: Secure Password-Setup Token Consumption

## Phase 1: TDD — Failing Tests & Atomic Consume-Once Implementation [checkpoint: 5c08edd]

- [x] Task: Read spec.md and workflow.md
    - [x] Read `./spec.md` to confirm requirements and acceptance criteria
    - [x] Read `../../../../workflow.md` to confirm TDD workflow and phase completion protocol
- [x] Task: Write failing tests for atomic token consumption (Red)
    - [x] Create `tests/integration/auth/concurrent-token-replay.test.ts` mirroring `tests/integration/submissions/concurrent-version-race.test.ts` structure (real DB, `beforeEach`/`afterEach` setup-teardown, `Promise.all` concurrent invocation)
    - [x] AC-1: Write concurrent token replay test — insert a verification token, fire two concurrent `completePasswordSetupHandler` calls with the same token but different passwords via `Promise.all`, assert exactly one succeeds and one fails, assert the account password matches the winner, assert token is deleted
    - [x] AC-3: Write expired token rejection test — insert a verification token with `expiresAt` in the past, call handler, assert `{ error: 'Invalid or expired token' }`, assert token row still exists in DB
    - [x] AC-4: Write nonexistent user rollback test — insert a valid token whose `identifier` matches no active user, call handler, assert `{ error: 'Internal Server Error' }`, assert token row still exists in DB (transaction rolled back)
    - [x] AC-5: Write sequential token consumption test — call handler twice with same token, assert first returns `{ success: true }` and second returns `{ error: 'Invalid or expired token' }`
    - [x] AC-2: Update `tests/unit/server/setup-password-boundary.test.ts` — update mock flow to expect `DELETE ... RETURNING` as first statement inside transaction (replace the two outer `mockDb.select()...then()` mocks with a `mockTx.delete()...returning()` mock), move user lookup mock inside transaction callback, assert `{ success: true }` for valid token + valid password
    - [x] Run `pnpm vitest run tests/integration/auth/concurrent-token-replay.test.ts tests/unit/server/setup-password-boundary.test.ts` and confirm tests fail as expected (Red phase)
- [x] Task: Implement atomic consume-once DELETE...RETURNING in handler (Green) (4ec3868)
    - [x] In `src/server/setup-password.ts` `completePasswordSetupHandler`: remove the outer `SELECT verification` block (lines 30-39) and the outer `SELECT users` block (lines 44-53)
    - [x] Move `hashPassword(password)` to before the `db.transaction()` call (keep it outside the transaction as per FR-2)
    - [x] Inside `db.transaction(async (tx) => {...})`: as the FIRST statement, execute `DELETE FROM verification WHERE value = token AND expiresAt > now() RETURNING *` via Drizzle's `tx.delete(verification).where(...).returning()`
    - [x] If the DELETE...RETURNING returns 0 rows, return `{ error: 'Invalid or expired token' }` (FR-4 — generic, no information leakage)
    - [x] Use the returned row's `identifier` to look up the user INSIDE the transaction via `tx.select({id}).from(users).where(and(eq(users.email, identifier), isNull(users.deletedAt)))`
    - [x] If no user found, `throw` inside the transaction callback so the transaction rolls back (FR-3 — token restored)
    - [x] Keep the existing account upsert logic (UPDATE existing or INSERT new) unchanged inside the transaction
    - [x] Keep the existing `emailVerified` update unchanged inside the transaction
    - [x] Remove the old `tx.delete(verification)` at the END of the transaction (line 90) — it is now the first statement
    - [x] Ensure the outer `catch` block still returns `{ error: 'Internal Server Error' }` for thrown errors
    - [x] Run `pnpm vitest run tests/integration/auth/concurrent-token-replay.test.ts tests/unit/server/setup-password-boundary.test.ts` and confirm all tests pass (Green phase)
- [x] Task: Conductor - User Manual Verification 'Phase 1: TDD — Failing Tests & Atomic Consume-Once Implementation' (Protocol in workflow.md)

## Phase 2: Final Verification [checkpoint: c23df1d]

- [x] Task: Read spec.md and workflow.md
    - [x] Read `./spec.md` to confirm requirements and acceptance criteria
    - [x] Read `../../../../workflow.md` to confirm TDD workflow and phase completion protocol
- [x] Task: Run full quality gates
    - [x] Run `pnpm typecheck` — confirm no type errors
    - [x] Run `pnpm lint` — confirm no lint errors
    - [x] Run `pnpm test:coverage` — confirm >=80% thresholds (lines, functions, branches, statements)
    - [x] Run `pnpm test:integration` — confirm all integration tests (including the new concurrent-token-replay tests) pass
- [x] Task: Conductor - User Manual Verification 'Phase 2: Final Verification' (Protocol in workflow.md)
</protect>
