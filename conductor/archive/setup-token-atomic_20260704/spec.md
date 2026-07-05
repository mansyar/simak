<protect>
# Track: Secure Password-Setup Token Consumption

## Overview

The `completePasswordSetupHandler` in `src/server/setup-password.ts` contains a **non-atomic check-then-act** race condition in its token validation logic. The handler currently `SELECT`s the verification token outside the transaction (line 30-35), then `DELETE`s it later inside the transaction (line 90). Two concurrent requests carrying the same setup token can both pass the `SELECT` check before either reaches the `DELETE`, allowing both to set potentially different passwords on the same account. If an attacker intercepts a setup token, they can exploit this window to silently take over the account.

**Type:** Bug fix (security)

**Root cause:** The `verification` table has no unique constraint on the `value` (token) column, and the consume operation (DELETE) is separated from the validation operation (SELECT) by a non-transactional gap.

## Functional Requirements

### FR-1: Atomic Consume-Once Token Validation

Replace the non-atomic `SELECT` (check) → later `DELETE` (act) pattern with a single atomic `DELETE ... RETURNING` as the **first statement** inside `db.transaction()`.

- The `DELETE ... RETURNING` must filter on both `value = token` AND `expiresAt > now()` so expiry is enforced atomically with consumption.
- If `DELETE ... RETURNING` returns **0 rows**, the token has already been consumed, is expired, or never existed. The handler must return an error (see FR-3).
- The returned row's `identifier` (email) drives the subsequent user lookup — all within the same transaction.

### FR-2: Transaction Encapsulation

All downstream operations must execute inside the same transaction as the `DELETE ... RETURNING`:

1. User lookup (`SELECT id FROM users WHERE email = ? AND deletedAt IS NULL`)
2. Account upsert (UPDATE existing account password or INSERT new account)
3. User `emailVerified` update

The `DELETE verification` that previously appeared at the **end** of the transaction (line 90) is **removed** — it is now the first statement.

**Password hashing** (`hashPassword`) remains **outside** the transaction (before it begins). Rationale: it is CPU-bound (bcrypt/argon2, ~100-300ms), does not touch the database, and if it fails the token has not yet been consumed — nothing needs to roll back.

### FR-3: Rollback on Downstream Failure

If any operation **after** the `DELETE ... RETURNING` fails (user not found, account upsert error, DB error), the handler must throw inside the transaction callback so the transaction **rolls back**. This restores the consumed token row, so the legitimate user can retry.

- A token is only truly consumed (permanently deleted) if the **entire transaction commits**.
- The existing `try/catch` around `db.transaction()` catches the thrown error and returns `{ error: 'Internal Server Error' }`.

### FR-4: Generic Error Message (No Information Leakage)

When the `DELETE ... RETURNING` returns 0 rows (token already consumed, expired, or never existed), the handler must return the **same generic error** it currently returns for missing tokens: `{ error: 'Invalid or expired token' }`.

- Do **not** distinguish "already used" from "expired" or "invalid" in the user-facing message — this prevents timing-based enumeration and token-lifecycle state leakage.

## Non-Functional Requirements

### NFR-1: No Schema Changes

This fix requires **no database migration**. The `verification` table schema (`src/db/schema/auth.ts:39-48`) remains unchanged. The `DELETE ... RETURNING` pattern works on the existing columns (`id`, `identifier`, `value`, `expiresAt`). No unique index is added — the atomic `DELETE ... RETURNING` within a transaction is the sole guard.

### NFR-2: No Public API Change

The handler's signature, return type (`PasswordSetupResult`), and exported server function (`completePasswordSetup`) remain unchanged. The `SetupPasswordSchema` Zod input is unchanged. Existing callers (the `/auth/setup-password` route) need no modification.

### NFR-3: Surgical Scope

Only `src/server/setup-password.ts` is modified (handler logic). No other server files, routes, components, or schema files are touched. The existing unit test (`tests/unit/server/setup-password-boundary.test.ts`) is updated to match the new mock flow.

## Acceptance Criteria

### AC-1: Concurrent Token Replay Prevented (Integration Test)

An integration test at `tests/integration/auth/concurrent-token-replay.test.ts` mirrors the structure of `tests/integration/submissions/concurrent-version-race.test.ts`:

- Sets up a real verification token in the database.
- Fires two concurrent `completePasswordSetupHandler` calls with the same token but different passwords via `Promise.all`.
- Asserts exactly **one** succeeds and exactly **one** fails.
- Asserts the account password matches the password from the successful request only.
- Asserts the verification token is deleted after the operation.

### AC-2: Happy Path Regression (Unit Test)

The existing unit test in `tests/unit/server/setup-password-boundary.test.ts` is updated to mock the new flow (`DELETE ... RETURNING` inside transaction, user lookup moved inside transaction) and asserts `{ success: true }` for a valid token + valid password.

### AC-3: Expired Token Rejection (Integration Test)

An integration test inserts a verification token with `expiresAt` in the past, calls the handler, and asserts:
- The handler returns `{ error: 'Invalid or expired token' }`.
- The token row remains in the database (DELETE returned 0 rows due to the `expiresAt > now()` filter).

### AC-4: Nonexistent User Rolls Back Token (Integration Test)

An integration test inserts a valid (non-expired) verification token whose `identifier` does not match any active user. Calls the handler and asserts:
- The handler returns `{ error: 'Internal Server Error' }` (thrown from inside the transaction, caught by the outer try/catch).
- The verification token row **still exists** in the database (transaction rolled back, DELETE undone).

### AC-5: Sequential Token Consumption (Integration Test)

An integration test calls the handler twice sequentially with the same token:
- First call: returns `{ success: true }`.
- Second call: returns `{ error: 'Invalid or expired token' }` (token was consumed by the first call).

## Out of Scope

- Adding a unique index on `verification.value` — the atomic `DELETE ... RETURNING` within a transaction is sufficient. A unique constraint is a belt-and-suspenders hardening that could be a separate track if desired.
- Adding rate limiting to the setup-password endpoint.
- Changes to the invitation email flow or token generation logic.
- Changes to the `/auth/setup-password` route UI.
- Audit logging for password setup events.
- Rotation of existing tokens in the database.
</protect>
