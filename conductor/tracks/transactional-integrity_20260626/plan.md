<protect>
# Track 8.3 — Transactional Integrity & Input Validation
## Implementation Plan

> **Spec:** `./spec.md` | **Workflow:** `../../workflow.md` | **TDD:** Red → Green → Refactor. Every task writes failing tests first, then implements to pass.

---

## Phase 1: Database — Unique Constraint & Migration

- [~] Task: Read context — review `./spec.md` and `../../workflow.md` before starting this phase
- [~] Task: Write schema & migration tests (Red)
    - [~] Test that `submissions` schema declares a unique constraint on `(checkpointId, version)`
    - [~] Test the migration SQL defensively deduplicates pre-existing rows (delete all but max version per checkpoint) before adding the constraint
    - [~] Test a companion rollback migration exists and drops the constraint
- [ ] Task: Implement unique constraint & migration (Green)
    - [ ] Add `unique()` on `(checkpointId, version)` to `submissions` schema in `src/db/schema/submissions.ts`
    - [ ] Write migration SQL: dedup `DELETE` (keep max version per `checkpoint_id`) + `ALTER TABLE ... ADD CONSTRAINT submissions_checkpoint_version_unq UNIQUE (checkpoint_id, version)`
    - [ ] Write companion rollback migration per SQL styleguide §5.1
    - [ ] Run `pnpm db:generate` / verify migration applies on dev DB
- [ ] Task: Conductor - User Manual Verification 'Database — Unique Constraint & Migration' (Protocol in workflow.md)

---

## Phase 2: submitCheckpointHandler — Transaction, Metadata Fix & Concurrency

- [ ] Task: Read context — review `./spec.md` and `../../workflow.md` before starting this phase
- [ ] Task: Write unit tests (Red)
    - [ ] Test `submitCheckpointHandler` wraps all writes (version select → insert → checkpoint update → notification insert) inside `db.transaction` using `tx`
    - [ ] Test the submission insert uses `.returning({ id: submissions.id })` and returns the real submission ID
    - [ ] Test notification `metadata.submissionId` equals the real inserted submission ID (not the version number)
    - [ ] Test post-commit audit log / notification dispatch failures are wrapped in try/catch and do not surface an error response for the committed transaction
- [ ] Task: Implement transactional submitCheckpointHandler (Green)
    - [ ] Wrap the full handler body in `db.transaction(async (tx) => { ... })`
    - [ ] Use `.returning({ id: submissions.id })` on the submission insert; capture the returned ID
    - [ ] Set notification `metadata.submissionId` to the returned real submission ID
    - [ ] Move audit-log and notification-dispatch calls to AFTER the transaction; wrap in try/catch
- [ ] Task: Write integration test — concurrent version race
    - [ ] Test two concurrent `submitCheckpointHandler` calls for the same checkpoint; the second fails with a unique-violation and rolls back (no duplicate version row)
- [ ] Task: Conductor - User Manual Verification 'submitCheckpointHandler — Transaction, Metadata Fix & Concurrency' (Protocol in workflow.md)

---

## Phase 3: Transactional Wrapping — User & Password Setup Handlers

- [ ] Task: Read context — review `./spec.md` and `../../workflow.md` before starting this phase
- [ ] Task: Write unit tests (Red)
    - [ ] Test `createUserHandler` — if the verification-token insert fails, the user insert is rolled back (no partial user row)
    - [ ] Test `createUserHandler` — the invitation email is sent only AFTER the transaction commits (not inside it)
    - [ ] Test `completePasswordSetup` — if token deletion fails, the account upsert and user update are rolled back
- [ ] Task: Implement transactional user & password-setup handlers (Green)
    - [ ] Wrap `createUserHandler` user + verification inserts in `db.transaction`; move `sendInvitationEmail` to post-commit try/catch
    - [ ] Wrap `completePasswordSetup` account upsert + user update + token deletion in `db.transaction`
- [ ] Task: Conductor - User Manual Verification 'Transactional Wrapping — User & Password Setup Handlers' (Protocol in workflow.md)

---

## Phase 4: Transactional Wrapping — Consultation Handlers

- [ ] Task: Read context — review `./spec.md` and `../../workflow.md` before starting this phase
- [ ] Task: Write unit tests (Red)
    - [ ] Test `verifyConsultationHandler` — if the notification insert fails, the consultation update is rolled back
    - [ ] Test `rejectConsultationHandler` — if the notification insert fails, the consultation update is rolled back
    - [ ] Test audit logging for both handlers occurs after commit; a failure in the audit insert does not surface an error for the committed transaction
- [ ] Task: Implement transactional consultation handlers (Green)
    - [ ] Wrap `verifyConsultationHandler` writes in `db.transaction`; move `logAuditEvent` to post-commit try/catch
    - [ ] Wrap `rejectConsultationHandler` writes in `db.transaction`; move `logAuditEvent` to post-commit try/catch
- [ ] Task: Conductor - User Manual Verification 'Transactional Wrapping — Consultation Handlers' (Protocol in workflow.md)

---

## Phase 5: File-Type Validation on Feedback Uploads

- [ ] Task: Read context — review `./spec.md` and `../../workflow.md` before starting this phase
- [ ] Task: Write unit tests (Red)
    - [ ] Test `getPresignedReviewFeedbackUploadUrlHandler` rejects `.exe` extension
    - [ ] Test `getPresignedReviewFeedbackUploadUrlHandler` rejects `.svg` extension
    - [ ] Test `getPresignedReviewFeedbackUploadUrlHandler` accepts `.docx`
    - [ ] Test `getPresignedReviewFeedbackUploadUrlHandler` accepts `.pdf`
- [ ] Task: Implement file-type validation (Green)
    - [ ] Call `validateUploadType(extension, contentType)` in `getPresignedReviewFeedbackUploadUrlHandler` before presigning; reject unsupported types
- [ ] Task: Conductor - User Manual Verification 'File-Type Validation on Feedback Uploads' (Protocol in workflow.md)

---

## Phase 6: Documentation & fileKey Investigation

- [ ] Task: Read context — review `./spec.md` and `../../workflow.md` before starting this phase
- [ ] Task: Document "Transaction Wrapping" convention
    - [ ] Append a "Transaction Wrapping" section to `conductor/code_styleguides/sql.md` covering: when to use `db.transaction` (2+ writes), the `.returning()` pattern, post-commit advisory work isolation (try/catch after commit), and the gold-standard reference (`submitReviewHandler`)
- [ ] Task: Investigate fileKey trust gap (document only)
    - [ ] Trace the presign→submit flow: how `fileKey` is generated in `getPresignedUploadUrl` and consumed in `submitCheckpointHandler`
    - [ ] Record findings (the exact trust gap, feasibility of a presign-time mapping table, recommended approach) in a findings note within this track's folder
- [ ] Task: Conductor - User Manual Verification 'Documentation & fileKey Investigation' (Protocol in workflow.md)
</protect>
