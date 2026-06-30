<protect>
# Track: Audit HIGH-Remediation (H1, H2, H3 + L1)

**Type:** Bug (security & correctness remediation)
**Status:** New
**Created:** 2026-06-30
**Proposed Track ID:** `audit-high-remediation_20260630`

## Overview

Closes the three HIGH-severity findings from the SIMAK codebase audit (2026-06-30), plus the L1 low-severity fix bundled into the H2 pass. Security/correctness remediation, not a feature track. Follows the Conductor TDD workflow: failing tests first, >80% coverage, server-fn `.ts`/`.server.ts` split, 500-line file limit, no hardcoded UI strings. The Medium (M1–M8) and remaining Low (L2–L8) findings are out of scope — deferred to a separate cleanup track.

## Background — Audit Findings Addressed

- **H1 — fileKey trust boundary.** `submitCheckpointHandler`/`submitReviewHandler` accept a client `fileKey` validated only as `z.string().min(1)`. The server never verifies the key was issued by presign for the acting user, nor that the R2 object exists. Enables fabricated-key submissions (state-machine integrity break) and cross-user/cross-namespace file reads via the download path.
- **H2 — SLA bypassable.** SLA clock uses `underReviewAt = checkpointState==='under_review' ? checkpointUpdatedAt : new Date()`. A direct `submitReview` on a `submitted` checkpoint (skipping `openForReview`) yields `underReviewAt=now` → zero breach → all SLA penalties evaded.
- **H3 — Bulk import email-uniqueness inconsistency + batch-failure.** Bulk pre-check excludes soft-deleted users (unlike single-create); DB UNIQUE on `email` is absolute → a soft-deleted email passes the pre-check, INSERT violates the constraint, whole batch rolls back with a generic 500.
- **L1 — openForReview wrong error message** (`reviews-extras.server.ts:61`): returns "Checkpoint is not in submittable state" for an open-for-REVIEW action.

## Functional Requirements

### FR-H1 — Upload-intent binding (fileKey trust boundary)
1. Introduce an `upload_intents` table: `fileKey` (unique), `userId`, `purpose` (`'submission' | 'review_feedback'`), `checkpointId` (nullable — null for review_feedback), `fileName`, `fileSize`, `contentType`, `expiresAt`, `consumedAt`.
2. At presign — `getPresignedUploadUrl` (submissions) and `getPresignedReviewFeedbackUploadUrl` (reviews): insert an intent row bound to the session user + context (checkpointId for submissions; purpose=`review_feedback` for reviews), `consumedAt=null`, `expiresAt=now+~15min`.
3. At submit — `submitCheckpointHandler` and `submitReviewHandler`: **mandatory** verification. `SELECT … FOR UPDATE WHERE fileKey=? AND userId=? AND consumedAt IS NULL AND expiresAt>now`; verify checkpointId/purpose match; set `consumedAt=now`. Reject if no matching unconsumed, unexpired intent. Closes fabricated-key + cross-user/cross-namespace attacks.
4. Size authority: R2 HEAD `Content-Length` is the single size authority; enforce 25MB max. Intent `fileSize` is audit-only, NOT for accept/reject. Do NOT cross-validate client `fileSize`, intent `fileSize`, HEAD `Content-Length`.
5. Scope: both submission `fileKey` and review `feedbackFileKey`.
6. No janitor shipped initially (deferred). Rely on `expiresAt`; accept orphaned R2 objects short-term; lazy-cleanup-on-presign may be revisited later (out of scope here).

### FR-H2 — SLA anchored at submission time (+ L1)
1. Set `underReviewAt = submission.uploadedAt` **always** (regardless of checkpoint state), replacing the state-conditional `checkpointUpdatedAt`/`now` logic.
2. `submitReview` continues to accept `REVIEWABLE_STATES = ['submitted','under_review']` (one-step review; no forced `openForReview`).
3. Client auto-`openForReview` (`ReviewDetailPage` useEffect) stays a pure state transition decoupled from SLA — no client change.
4. Closes both the direct-API bypass and the pre-open gap.
5. **L1 (bundled):** correct the `openForReview` error message at `reviews-extras.server.ts:61` to an accurate open-for-review message (e.g. "not in submitted state"). Add i18n keys.
6. **Impl-time verification:** confirm the extension-grant path in `review-sla.ts` / `due-dates.server.ts` honors the student-earns-extension assumption under the new `uploadedAt` anchor. Surface if it diverges.

### FR-H3 — Bulk import + single-create restore-on-soft-deleted
1. `bulkCreateUsersHandler`: remove the `isNull(users.deletedAt)` pre-check entirely. Wrap each row INSERT in a SAVEPOINT; catch `23505` (unique_violation); report per-row. Non-23505 errors roll back the whole batch (one outer tx + savepoint per row).
2. Restore-on-soft-deleted: if an import email matches a soft-deleted user, RESTORE (reactivate identity + history) — overwrite `name`, `cohort`, `role` from the import row (role from import row wins, including mismatches), keeping `password`, password-setup-state, `user id`, history untouched.
3. Apply the **same** restore policy to single-create `createUserHandler`.
4. Per-row report shape: `{ results: [{ rowIndex, email, status: 'created' | 'restored' | 'skipped', reason? }] }`.
5. Audit events: `user.created` (new) vs `user.reactivated` (restore).
6. New i18n keys (`created`/`restored`/`skipped` + skip-reason variants) in `locales/en.json` + `locales/id.json`, then `pnpm generate:i18n`.

## Non-Functional Requirements
- **TDD:** every fix lands behind failing tests first (Red → Green → Refactor per `workflow.md`).
- **Coverage:** >80% for new/changed code (pre-push gate).
- **Server-fn split:** handlers in `.server.ts`, stubs in `.ts`; client never bundles handler code.
- **File limit:** 500 lines max per file (scripts/check-modularity.js on commit).
- **i18n:** no hardcoded UI strings; all new text via keys in en.json + id.json + generate:i18n.
- **Migration:** `upload_intents` table ships via Drizzle migration (pnpm db:generate → db:migrate).
- **Security:** no new vulnerabilities; input validation present; parameterized queries.

## Acceptance Criteria
- **AC-H1-1** Submit with a fileKey not backed by a matching, unconsumed, unexpired intent for the session user → **rejected** (fabricated-key closed).
- **AC-H1-2** Submit with a fileKey issued for a different user/checkpoint/purpose → **rejected** (cross-user/cross-namespace closed).
- **AC-H1-3** Valid presign → submit succeeds and consumes the intent (single-use); a second submit reusing the same fileKey → **rejected**.
- **AC-H1-4** R2 HEAD enforces 25MB max via Content-Length; oversized → **rejected**.
- **AC-H1-5** Opt-in integration test proves fabricated-key rejection end-to-end (pnpm test:integration; not gated).
- **AC-H2-1** SLA breach calculated from submission's `uploadedAt`; direct `submitReview` on a `submitted` checkpoint (no openForReview) → non-zero breach when past the SLA window.
- **AC-H2-2** L1 fixed — openForReview on a non-submitted checkpoint returns an accurate message (not "submittable state"), i18n keys in both locales.
- **AC-H3-1** Bulk import with an email matching a soft-deleted user → **restores** (name/cohort/role from import row; password/id/history preserved); batch does NOT fail; other rows inserted.
- **AC-H3-2** Bulk import with a duplicate *active* email → **skips** that row with a clear reason; other rows inserted (no whole-batch rollback on 23505).
- **AC-H3-3** Single-create with an email matching a soft-deleted user → **restores** (consistent with bulk).
- **AC-H3-4** Per-row report shape returned; `user.created`/`user.reactivated` audit events emitted; i18n keys present + types regenerated.

## Out of Scope
- M1–M8 and L2–L8 (deferred to a separate cleanup track).
- `upload_intents` janitor / scheduled cleanup (deferred; lazy-cleanup-on-presign may be revisited later).
- Cross-validating client fileSize ↔ intent fileSize ↔ HEAD Content-Length (deliberately not done; HEAD Content-Length is the sole size authority for the 25MB cap).
- Any client-side changes for H2 (auto-openForReview stays as-is).
- Wiring the opt-in H1 integration test into the pre-push gate (stays opt-in).
- Proactive reactivation of soft-deleted users not matched by a new create/import.

## Risks / Open Items
- **H2:** verify the extension-grant path in review-sla.ts / due-dates.server.ts under the new `uploadedAt` anchor (student-earns-extension assumption). Surface if it diverges.
- **H3:** confirm no existing production flows depend on the old "block on soft-deleted email" behavior — the restore policy changes single-create and bulk-create behavior.

</protect>
