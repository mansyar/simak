# Track 8.3 — Transactional Integrity & Input Validation

## Overview

This track hardens the data-integrity and input-validation guarantees of SIMAK's multi-step mutation handlers. It addresses five audit findings (3 HIGH, 1 MEDIUM, 1 LOW) by wrapping non-transactional multi-step writes in `db.transaction`, adding a database-level unique constraint to close a time-of-check-to-time-of-use (TOCTOU) race on submission versions, fixing a notification-metadata bug, and enforcing file-type validation on instructor feedback uploads.

The `fileKey` trust gap (LOW-severity IDOR) is investigated and documented only; implementation is deferred to a follow-up track to keep this track focused on the HIGH-severity transactional fixes.

## Audit Findings Addressed

| Severity | Finding | Location |
| -------- | ------- | -------- |
| HIGH | Submission Version Race Condition (TOCTOU) | `src/server/submissions.server.ts` `submitCheckpointHandler` |
| HIGH | Non-Transactional Multi-Step Operations | `users.server.ts` `createUserHandler`, `setup-password.ts` `completePasswordSetup`, `consultations.server.ts` `verify`/`rejectConsultationHandler`, `submissions.server.ts` `submitCheckpointHandler` |
| HIGH | Instructor Feedback Upload Skips File-Type Validation | `src/server/files.server.ts` `getPresignedReviewFeedbackUploadUrlHandler` |
| MEDIUM | Notification Metadata Bug — `submissionId` Set to Version Number | `src/server/submissions.server.ts` `submitCheckpointHandler` (lines 143–147) |
| LOW | `fileKey` Trust in `submitCheckpoint` (Limited IDOR) — investigate only | `src/server/submissions.server.ts` `submitCheckpointHandler` |

## Functional Requirements

### FR-1: Database Unique Constraint on Submission Versions
- Add a `UNIQUE (checkpoint_id, version)` constraint to the `submissions` table.
- The migration MUST defensively deduplicate pre-existing rows before adding the constraint: for each `(checkpoint_id)` group, delete all but the row with the maximum `version`, leaving one row per checkpoint-version pair. This guarantees the migration succeeds regardless of current data state.

### FR-2: Transactional Wrapping of Multi-Step Handlers
Each handler below runs all its DB writes inside a single `db.transaction`, using the transaction handle `tx` for every query. Post-commit advisory work (emails, audit logs, notifications) is placed AFTER the transaction commits and wrapped in try/catch so a failure in advisory work does not surface a misleading error for a transaction that committed successfully.

| Handler | Writes to wrap | Advisory work (post-commit, try/catch) |
| ------- | -------------- | --------------------------------------- |
| `submitCheckpointHandler` | version select → submission insert (`.returning({ id })`) → checkpoint state update → notification insert | audit log, notification dispatch |
| `createUserHandler` | user insert → verification token insert | invitation email send |
| `completePasswordSetup` | account upsert → user update → token deletion | (none) |
| `verifyConsultationHandler` | consultation update → notification insert | audit log (`consultation.verified`) |
| `rejectConsultationHandler` | consultation update → notification insert | audit log (`consultation.rejected`) |

### FR-3: Notification Metadata Fix
- `submitCheckpointHandler` must use `.returning({ id: submissions.id })` on the submission insert and store the REAL submission ID in the notification `metadata.submissionId` — not the version number (current bug, lines 143–147).

### FR-4: File-Type Validation on Feedback Uploads
- `getPresignedReviewFeedbackUploadUrlHandler` must call `validateUploadType(extension, contentType)` before presigning, rejecting unsupported extensions/content-types.
- Accepted types mirror the student upload policy: `.docx` and `.pdf` only.

### FR-5: Write-Transaction Convention Documentation
- Append a "Transaction Wrapping" section to `conductor/code_styleguides/sql.md` documenting:
  - When to use `db.transaction` (any handler with 2+ writes).
  - The `.returning()` pattern for obtaining inserted IDs.
  - Post-commit advisory work isolation (try/catch, after commit).
  - The gold-standard reference (`submitReviewHandler`).

### FR-6: fileKey Trust Investigation (Document Only)
- Investigate the presign→submit flow in `submitCheckpointHandler`: trace how `fileKey` is generated at presign time (`getPresignedUploadUrl`) and consumed at submit time.
- Record findings in this track's `spec.md` (or a findings note): the exact trust gap, feasibility of a presign-time mapping table, and recommended approach.
- No implementation in this track; defer to a follow-up track.

## Non-Functional Requirements

- **NFR-1 (Correctness):** No partial writes persist if a transaction fails midway — verified by integration test.
- **NFR-2 (Concurrency):** Concurrent submissions for the same checkpoint do not produce duplicate versions; the second transaction fails with a unique-violation and rolls back — verified by integration test against real PostgreSQL.
- **NFR-3 (Resilience):** Post-commit advisory work failures (email, audit log) do not return an error response for a successfully committed transaction.
- **NFR-4 (No regression):** All existing tests pass; no change to email content, formatting, or i18n.
- **NFR-5 (i18n unaffected):** No new UI strings.

## Acceptance Criteria

- [ ] `submissions` table has a `UNIQUE (checkpoint_id, version)` constraint, applied via a migration that defensively deduplicates pre-existing rows first.
- [ ] `submitCheckpointHandler` runs entirely within `db.transaction`; all queries use `tx`.
- [ ] `submitCheckpointHandler` uses `.returning({ id: submissions.id })` and stores the real submission ID in notification metadata (not the version number).
- [ ] Concurrent submissions for the same checkpoint do not produce duplicate versions — the second transaction fails and rolls back (integration test).
- [ ] `createUserHandler` wraps user + verification inserts in `db.transaction`; email is sent only after the transaction commits.
- [ ] `completePasswordSetup` wraps account upsert + user update + token deletion in `db.transaction`.
- [ ] `verifyConsultationHandler` and `rejectConsultationHandler` wrap all writes in `db.transaction`; audit logging occurs after commit.
- [ ] `getPresignedReviewFeedbackUploadUrlHandler` calls `validateUploadType` and rejects unsupported extensions/content-types (`.exe`, `.svg` rejected; `.docx`, `.pdf` accepted).
- [ ] If a transaction fails midway, no partial writes persist (verified by integration test).
- [ ] Post-commit advisory work (emails, audit logs) is placed after the transaction and wrapped in try/catch so failures don't surface misleading errors.
- [ ] "Transaction Wrapping" convention documented in `conductor/code_styleguides/sql.md`.
- [ ] `fileKey` trust gap investigated and findings documented; no implementation in this track.
- [ ] i18n not affected (no new UI strings).

## Out of Scope

- `fileKey` trust IDOR implementation (deferred to follow-up track — investigation only here).
- `deleteUserHandler` transactional wrapping (handled by Track 8.1).
- Dashboard query parallelization and bulk-import batching (Track 8.4).
- `submitReviewHandler` post-commit audit-log try/catch isolation (Track 8.4).
