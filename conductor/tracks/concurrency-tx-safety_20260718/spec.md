<protect>
# Track Specification: Concurrency & Transaction Safety (TRACK-001)

## Overview

This track remediates 10 concurrency and transaction-safety bugs (BUG-1, BUG-2, BUG-5, BUG-6, BUG-7, BUG-8, BUG-9, BUG-13, BUG-17, BUG-22) identified in the three-way audit. These bugs involve non-atomic check-then-act race conditions, missing `SELECT ... FOR UPDATE` row locks, TOCTOU windows, and unsafe soft-delete flows that risk data corruption, duplicate operations, and lost state.

The gold standard for the correct pattern is `submitCheckpointHandler` (`src/server/submissions.server.ts`): `db.transaction` + `.for('update')` inside the transaction + status re-check after locking.

## Audit IDs & Root Causes

| Bug ID | Area | Root Cause |
|--------|------|------------|
| BUG-1, BUG-17 | Consultation verify/reject | SELECT-then-UPDATE outside transaction; no row lock |
| BUG-2, BUG-7 | Extension approve/reject | SELECT-then-UPDATE outside transaction; no row lock |
| BUG-5 | Extension count | TOCTOU on extension count check |
| BUG-6 | Extension adjustment | Checkpoint rows read without lock inside `calculateExtensionAdjustment` |
| BUG-8 | 2FA disable | DB operations not in transaction; auth API called before DB commit |
| BUG-9 | User soft-delete | No assignment reassignment flow; no auto-reject of pending requests |
| BUG-13 | Setup link generation | DELETE + INSERT not in a single transaction |
| BUG-22 | User create/update email | Email uniqueness check outside transaction; no PG error 23505 catch |

## Confirmed Decisions

These decisions are documented in `docs/roadmap.md` (TRACK-001) and confirmed during spec review:

1. **BUG-8 (2FA disable):** DB-first in a transaction (update `users.twoFactorEnabled` + delete `twoFactor` row), then call `auth.api.disableTwoFactor` last. If the API call fails post-commit, reconcile on next login by checking the DB flag.
2. **BUG-9 (instructor soft-delete):** Build assignment reassignment flow — admin must reassign ALL active (non-deleted) assignments to a replacement instructor before soft-delete proceeds. `under_review` checkpoints transition back to `submitted`; already-`submitted` checkpoints stay as-is (new instructor sees them automatically once `instructorId` is updated).
3. **BUG-9 (student soft-delete):** Auto-reject all pending consultations and extension requests with reason "User deleted". Revoke open upload intents.
4. **BUG-22 (email uniqueness):** Catch PG error `23505` for a clean "Email already in use" message AND move the email existence check inside the transaction with `FOR UPDATE` on users rows.

## Codebase Findings (Verified)

- **Current `deleteUserHandler`** (`src/server/users.server.ts:292`): Simple soft-delete (`deletedAt = new Date()`), revokes sessions, logs audit event. No assignment check, no reassignment logic, no auto-reject of pending requests.
- **No existing reassignment UI:** grep for "reassign" across `src/` returns zero matches. No server function to change an assignment's `instructorId` post-creation. No dialog or component exists.
- **Assignment `instructorId` is set only at creation** (`assignments.server.ts:96`) and is read-only thereafter.

## Functional Requirements

### Phase 1: Consultations (BUG-1, BUG-17)

- **FR-1.1:** `verifyConsultationHandler` must move the consultation SELECT inside `db.transaction`, add `.for('update', { of: consultations })`, and re-check `status === 'pending'` after acquiring the lock. If status is no longer pending, return a descriptive "already processed" error.
- **FR-1.2:** `rejectConsultationHandler` must follow the same pattern (transaction + `FOR UPDATE` + post-lock status re-check).

### Phase 2: Extensions (BUG-2, BUG-5, BUG-6, BUG-7)

- **FR-2.1:** `approveExtensionHandler` and `rejectExtensionHandler` must move the extension-request SELECT inside `db.transaction`, add `.for('update')`, and re-check `status === 'pending'` after the lock.
- **FR-2.2:** `requestExtensionHandler` must move the extension count check inside the transaction with row locking to eliminate the TOCTOU window (BUG-5).
- **FR-2.3:** `calculateExtensionAdjustment` must lock checkpoint rows inside the transaction before reading them (BUG-6).
- **FR-2.4:** Notification INSERTs must be moved inside the transaction (keep audit log post-commit with try/catch).

### Phase 3: 2FA & Users (BUG-8, BUG-13, BUG-22)

- **FR-3.1:** `disableTwoFactorHandler` must wrap DB operations (update `users.twoFactorEnabled` + delete `twoFactor` row) in a `db.transaction`. The `auth.api.disableTwoFactor` call must happen last, after the DB commit. If the API call fails post-commit, the system reconciles on next login by checking the DB flag (BUG-8).
- **FR-3.2:** `generateSetupLinkHandler` must wrap the DELETE + INSERT in a single `db.transaction` (BUG-13).
- **FR-3.3:** `createUserHandler` and `updateUserHandler` must move the email uniqueness check inside the transaction with `FOR UPDATE` on the users rows, and catch PG error `23505` to return a clean "Email already in use" message (BUG-22).

### Phase 4: Soft-Delete Cleanup (BUG-9)

- **FR-4.1 (Student soft-delete):** When soft-deleting a student, the `deleteUserHandler` must auto-reject all pending consultations and extension requests with reason "User deleted". Open upload intents must be revoked.
- **FR-4.2 (Instructor soft-delete — block):** When soft-deleting an instructor, the `deleteUserHandler` must block the operation and return a descriptive error if the instructor has ANY active (non-deleted) assignments.
- **FR-4.3 (Instructor soft-delete — reassignment server function):** A new server function `reassignAssignment` must allow an admin to update `assignments.instructorId` for a specific assignment. Input validation (Zod) must verify: the caller is admin/superadmin, the target assignment exists and is active (not deleted), and the replacement instructor is an active instructor (`role='instructor'` AND `deletedAt IS NULL`).
- **FR-4.4 (Instructor soft-delete — reassignment UI):** A new reassignment dialog/component must be built. When an admin attempts to soft-delete an instructor with active assignments, the UI presents the list of active assignments and a replacement-instructor picker (dropdown of active instructors) per assignment. The admin must reassign ALL active assignments before the soft-delete can proceed.
- **FR-4.5 (Instructor soft-delete — checkpoint transition):** When `assignments.instructorId` is updated via reassignment, all `under_review` checkpoints for that assignment must transition back to `submitted` (so the new instructor sees them in their review queue).

### Phase 5: Tests

- **FR-5.1:** Unit tests (mocked DB transactions) must be written for every refactored handler, verifying: state-transition logic, stale-state rejection (post-lock status re-check returns descriptive error), and correct transaction/lock usage.
- **FR-5.2:** Unit tests for the reassignment flow must verify: admin-only access, active-instructor validation, checkpoint state transition (`under_review` → `submitted`), and that soft-delete is blocked when active assignments remain.
- **FR-5.3:** Unit tests for student soft-delete must verify: pending consultations auto-rejected with "User deleted", pending extension requests auto-rejected, upload intents revoked.

## Non-Functional Requirements

- **NFR-1:** All state-transition handlers must use `db.transaction` + `FOR UPDATE` + post-lock status re-check. No SELECT-then-UPDATE patterns may remain outside transactions for the handlers in scope.
- **NFR-2:** No new i18n keys are required for phases 1-3 (reusing existing error messages). Phase 4 requires new i18n keys for: reassignment dialog labels, replacement-instructor picker, "active assignments block delete" error, and "User deleted" rejection reason — added to both `locales/en.json` and `locales/id.json`.
- **NFR-3:** Test coverage must remain ≥80% on lines, statements, branches, and functions.
- **NFR-4:** No integration tests are required for this track (unit tests with mocked DB transactions only, per confirmed test strategy).
- **NFR-5:** All server functions must follow the two-file split (`*.ts` stub + `*.server.ts` handler).
- **NFR-6:** Files must not exceed 500 lines (enforced by `scripts/check-modularity.js`).

## Acceptance Criteria

- [ ] **AC-1:** All 10 audit bugs (BUG-1, BUG-2, BUG-5, BUG-6, BUG-7, BUG-8, BUG-9, BUG-13, BUG-17, BUG-22) are remediated per the decisions above.
- [ ] **AC-2:** `pnpm test:unit` passes with ≥80% coverage on all four metrics.
- [ ] **AC-3:** `pnpm typecheck` passes.
- [ ] **AC-4:** `pnpm lint` passes (including `simak-i18n/no-hardcoded`).
- [ ] **AC-5:** `pnpm check:i18n` passes (new keys added to both locales).
- [ ] **AC-6:** Code review confirms all state-transition handlers use `db.transaction` + `FOR UPDATE` + post-lock status re-check. No SELECT-then-UPDATE patterns remain outside transactions for in-scope handlers.
- [ ] **AC-7:** Manual checkpoint: attempting to soft-delete an instructor with active assignments blocks the operation and presents the reassignment UI. After reassignment, the new instructor sees pending reviews in their queue.
- [ ] **AC-8:** Manual checkpoint: opening two browser tabs for the same consultation and submitting verify simultaneously — only one succeeds; the other gets an "already processed" error.

## Out of Scope

- Deadline logic correctness (TRACK-002)
- Email queue idempotency (TRACK-004)
- Input validation gaps (TRACK-003)
- Integration tests (opt-in tier; this track uses unit tests only)
- Database schema migrations (no new columns/tables required — existing schema supports all changes)
- Moving R2 HEAD check outside transaction (BUG-14 — deferred to TRACK-006)
</protect>
