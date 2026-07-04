<protect>
# Implementation Plan: Secure Password-Setup Token Consumption

## Phase 1: TDD — Failing Tests & Atomic Consume-Once Implementation

- [ ] Task: Read spec.md and workflow.md
    - [ ] Read `./spec.md` to confirm requirements and acceptance criteria
    - [ ] Read `../../../../workflow.md` to confirm TDD workflow and phase completion protocol
- [ ] Task: Write failing tests for atomic token consumption (Red)
    - [ ] Create `tests/integration/auth/concurrent-token-replay.test.ts` mirroring `tests/integration/submissions/concurrent-version-race.test.ts` structure (real DB, `beforeEach`/`afterEach` setup-teardown, `Promise.all` concurrent invocation)
    - [ ] AC-1: Write concurrent token replay test — insert a verification token, fire two concurrent `completePasswordSetupHandler` calls with the same token but different passwords via `Promise.all`, assert exactly one succeeds and one fails, assert the account password matches the winner, assert token is deleted
    - [ ] AC-3: Write expired token rejection test — insert a verification token with `expiresAt` in the past, call handler, assert `{ error: 'Invalid or expired token' }`, assert token row still exists in DB
    - [ ] AC-4: Write nonexistent user rollback test — insert a valid token whose `identifier` matches no active user, call handler, assert `{ error: 'Internal Server Error' }`, assert token row still exists in DB (transaction rolled back)
    - [ ] AC-5: Write sequential token consumption test — call handler twice with same token, assert first returns `{ success: true }` and second returns `{ error: 'Invalid or expired token' }`
    - [ ] AC-2: Update `tests/unit/server/setup-password-boundary.test.ts` — update mock flow to expect `DELETE ... RETURNING` as first statement inside transaction (replace the two outer `mockDb.select()...then()` mocks with a `mockTx.delete()...returning()` mock), move user lookup mock inside transaction callback, assert `{ success: true }` for valid token + valid password
    - [ ] Run `pnpm vitest run tests/integration/auth/concurrent-token-replay.test.ts tests/unit/server/setup-password-boundary.test.ts` and confirm tests fail as expected (Red phase)
- [ ] Task: Implement atomic consume-once DELETE...RETURNING in handler (Green)
    - [ ] In `src/server/setup-password.ts` `completePasswordSetupHandler`: remove the outer `SELECT verification` block (lines 30-39) and the outer `SELECT users` block (lines 44-53)
    - [ ] Move `hashPassword(password)` to before the `db.transaction()` call (keep it outside the transaction as per FR-2)
    - [ ] Inside `db.transaction(async (tx) => {...})`: as the FIRST statement, execute `DELETE FROM verification WHERE value = token AND expiresAt > now() RETURNING *` via Drizzle's `tx.delete(verification).where(...).returning()`
    - [ ] If the DELETE...RETURNING returns 0 rows, return `{ error: 'Invalid or expired token' }` (FR-4 — generic, no information leakage)
    - [ ] Use the returned row's `identifier` to look up the user INSIDE the transaction via `tx.select({id}).from(users).where(and(eq(users.email, identifier), isNull(users.deletedAt)))`
    - [ ] If no user found, `throw` inside the transaction callback so the transaction rolls back (FR-3 — token restored)
    - [ ] Keep the existing account upsert logic (UPDATE existing or INSERT new) unchanged inside the transaction
    - [ ] Keep the existing `emailVerified` update unchanged inside the transaction
    - [ ] Remove the old `tx.delete(verification)` at the END of the transaction (line 90) — it is now the first statement
    - [ ] Ensure the outer `catch` block still returns `{ error: 'Internal Server Error' }` for thrown errors
    - [ ] Run `pnpm vitest run tests/integration/auth/concurrent-token-replay.test.ts tests/unit/server/setup-password-boundary.test.ts` and confirm all tests pass (Green phase)
- [ ] Task: Conductor - User Manual Verification 'Phase 1: TDD — Failing Tests & Atomic Consume-Once Implementation' (Protocol in workflow.md)

## Phase 2: Final Verification

- [ ] Task: Read spec.md and workflow.md
    - [ ] Read `./spec.md` to confirm requirements and acceptance criteria
    - [ ] Read `../../../../workflow.md` to confirm TDD workflow and phase completion protocol
- [ ] Task: Run full quality gates
    - [ ] Run `pnpm typecheck` — confirm no type errors
    - [ ] Run `pnpm lint` — confirm no lint errors
    - [ ] Run `pnpm test:coverage` — confirm >=80% thresholds (lines, functions, branches, statements)
    - [ ] Run `pnpm test:integration` — confirm all integration tests (including the new concurrent-token-replay tests) pass
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Final Verification' (Protocol in workflow.md)
</protect>
