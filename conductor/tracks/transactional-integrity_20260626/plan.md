<protect>
# Track 8.3 — Transactional Integrity & Input Validation
## Implementation Plan

> **Spec:** `./spec.md` | **Workflow:** `../../workflow.md` | **TDD:** Red → Green → Refactor. Every task writes failing tests first, then implements to pass.

---

## Phase 1: Database — Unique Constraint & Migration [checkpoint: 84391e8]

- [x] Task: Read context — review `./spec.md` and `../../workflow.md` before starting this phase [ff2b7e3]
- [x] Task: Write schema & migration tests (Red) [ff2b7e3]
    - [x] Test that `submissions` schema declares a unique constraint on `(checkpointId, version)` [ff2b7e3]
    - [x] Test the migration SQL defensively deduplicates pre-existing rows (delete all but max version per checkpoint) before adding the constraint [ff2b7e3]
    - [x] Test a companion rollback migration exists and drops the constraint [ff2b7e3]
- [x] Task: Implement unique constraint & migration (Green) [ff2b7e3]
    - [x] Add `unique()` on `(checkpointId, version)` to `submissions` schema in `src/db/schema/submissions.ts` [ff2b7e3]
    - [x] Write migration SQL: dedup `DELETE` (keep max version per `checkpoint_id`) + `ALTER TABLE ... ADD CONSTRAINT submissions_checkpoint_version_unq UNIQUE (checkpoint_id, version)` [ff2b7e3]
    - [x] Write companion rollback migration per SQL styleguide §5.1 [ff2b7e3]
    - [x] Run `pnpm db:generate` / verify migration applies on dev DB [ff2b7e3]
- [x] Task: Conductor - User Manual Verification 'Database — Unique Constraint & Migration' (Protocol in workflow.md) [ff2b7e3]

---

## Phase 2: submitCheckpointHandler — Transaction, Metadata Fix & Concurrency [checkpoint: acf4226]

- [x] Task: Read context — review `./spec.md` and `../../workflow.md` before starting this phase [faa70c9]
- [x] Task: Write unit tests (Red) [faa70c9]
    - [x] Test `submitCheckpointHandler` wraps all writes (version select → insert → checkpoint update → notification insert) inside `db.transaction` using `tx` [faa70c9]
    - [x] Test the submission insert uses `.returning({ id: submissions.id })` and returns the real submission ID [faa70c9]
    - [x] Test notification `metadata.submissionId` equals the real inserted submission ID (not the version number) [faa70c9]
    - [x] Test post-commit audit log / notification dispatch failures are wrapped in try/catch and do not surface an error response for the committed transaction [faa70c9]
- [x] Task: Implement transactional submitCheckpointHandler (Green) [faa70c9]
    - [x] Wrap the full handler body in `db.transaction(async (tx) => { ... })` [faa70c9]
    - [x] Use `.returning({ id: submissions.id })` on the submission insert; capture the returned ID [faa70c9]
    - [x] Set notification `metadata.submissionId` to the returned real submission ID [faa70c9]
    - [x] Move audit-log and notification-dispatch calls to AFTER the transaction; wrap in try/catch [faa70c9]
- [x] Task: Write integration test — concurrent version race [faa70c9]
    - [x] Test two concurrent `submitCheckpointHandler` calls for the same checkpoint; the second fails with a unique-violation and rolls back (no duplicate version row) [faa70c9]
- [x] Task: Conductor - User Manual Verification 'submitCheckpointHandler — Transaction, Metadata Fix & Concurrency' (Protocol in workflow.md) [faa70c9]

---

## Phase 3: Transactional Wrapping — User & Password Setup Handlers [checkpoint: cf72b19]

- [x] Task: Read context — review `./spec.md` and `../../workflow.md` before starting this phase
- [x] Task: Write unit tests (Red)
    - [x] Test `createUserHandler` — if the verification-token insert fails, the user insert is rolled back (no partial user row)
    - [x] Test `createUserHandler` — the invitation email is sent only AFTER the transaction commits (not inside it)
    - [x] Test `completePasswordSetup` — if token deletion fails, the account upsert and user update are rolled back
- [x] Task: Implement transactional user & password-setup handlers (Green)
    - [x] Wrap `createUserHandler` user + verification inserts in `db.transaction`; move `sendInvitationEmail` to post-commit try/catch
    - [x] Wrap `completePasswordSetup` account upsert + user update + token deletion in `db.transaction`
- [x] Task: Conductor - User Manual Verification 'Transactional Wrapping — User & Password Setup Handlers' (Protocol in workflow.md) [cf72b19]

---

## Phase 4: Transactional Wrapping — Consultation Handlers [checkpoint: 4d59d88]

- [x] Task: Read context — review `./spec.md` and `../../workflow.md` before starting this phase [c4304f6]
- [x] Task: Write unit tests (Red) [c4304f6]
    - [x] Test `verifyConsultationHandler` — if the notification insert fails, the consultation update is rolled back [c4304f6]
    - [x] Test `rejectConsultationHandler` — if the notification insert fails, the consultation update is rolled back [c4304f6]
    - [x] Test audit logging for both handlers occurs after commit; a failure in the audit insert does not surface an error for the committed transaction [c4304f6]
- [x] Task: Implement transactional consultation handlers (Green) [c4304f6]
    - [x] Wrap `verifyConsultationHandler` writes in `db.transaction`; move `logAuditEvent` to post-commit try/catch [c4304f6]
    - [x] Wrap `rejectConsultationHandler` writes in `db.transaction`; move `logAuditEvent` to post-commit try/catch [c4304f6]
- [x] Task: Conductor - User Manual Verification 'Transactional Wrapping — Consultation Handlers' (Protocol in workflow.md) [c4304f6]

---

## Phase 5: File-Type Validation on Feedback Uploads [checkpoint: 62f75dd]

- [x] Task: Read context — review `./spec.md` and `../../workflow.md` before starting this phase [4d33ee6]
- [x] Task: Write unit tests (Red) [4d33ee6]
    - [x] Test `getPresignedReviewFeedbackUploadUrlHandler` rejects `.exe` extension [4d33ee6]
    - [x] Test `getPresignedReviewFeedbackUploadUrlHandler` rejects `.svg` extension [4d33ee6]
    - [x] Test `getPresignedReviewFeedbackUploadUrlHandler` accepts `.docx` [4d33ee6]
    - [x] Test `getPresignedReviewFeedbackUploadUrlHandler` accepts `.pdf` [4d33ee6]
- [x] Task: Implement file-type validation (Green) [4d33ee6]
    - [x] Call `validateUploadType(extension, contentType)` in `getPresignedReviewFeedbackUploadUrlHandler` before presigning; reject unsupported types [4d33ee6]
- [ ] Task: Conductor - User Manual Verification 'File-Type Validation on Feedback Uploads' (Protocol in workflow.md)

---

## Phase 6: Documentation & fileKey Investigation

- [~] Task: Read context — review `./spec.md` and `../../workflow.md` before starting this phase
- [~] Task: Document "Transaction Wrapping" convention
    - [~] Append a "Transaction Wrapping" section to `conductor/code_styleguides/sql.md` covering: when to use `db.transaction` (2+ writes), the `.returning()` pattern, post-commit advisory work isolation (try/catch after commit), and the gold-standard reference (`submitReviewHandler`)
- [ ] Task: Investigate fileKey trust gap (document only)
    - [ ] Trace the presign→submit flow: how `fileKey` is generated in `getPresignedUploadUrl` and consumed in `submitCheckpointHandler`
    - [ ] Record findings (the exact trust gap, feasibility of a presign-time mapping table, recommended approach) in a findings note within this track's folder
- [ ] Task: Conductor - User Manual Verification 'Documentation & fileKey Investigation' (Protocol in workflow.md)
</protect>
