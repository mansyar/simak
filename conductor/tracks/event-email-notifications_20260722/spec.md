# Specification: TRACK-018 — Event Email Notifications

## Overview

Currently, SIMAK sends emails only for auth-related events (invitations, password reset, 2FA enable/disable, SLA breach alerts). All other event notifications — submission received, review completed, revision requested, consultation verified/rejected, extension approved/rejected, extension requested — are in-app only. This track extends the existing email queue infrastructure to also dispatch email notifications for these 8 event types, alongside the in-app notifications already created in the handlers.

The email queue processor (30s cycle, retry with exponential backoff, `FOR UPDATE SKIP LOCKED`) is already production-hardened from TRACK-004. No new infrastructure is required — this track wires `enqueueEmail()` calls into existing handlers and creates localized HTML email templates.

**Track Type:** Feature (ENH-FEAT-1)
**Dependencies:** None (leverages existing email queue infra)
**Estimated Effort:** 4 Days / 2 Sprint Loops

## Functional Requirements

### FR-1: Email Template Builder Module (`src/lib/email-templates.ts`)

Create a new module with 8 localized HTML email template-builder functions. Each function accepts event-specific params + locale, and returns an HTML string. Shared header/footer HTML extracted as helper functions in the same file.

**Email body content (per user decision):** Each email includes:
- Full contextual details (assignment name, checkpoint name, reviewer/actor name, decision/result)
- A "View in SIMAK" deep-link button to the relevant page
- SIMAK-branded header/footer (consistent with existing auth email templates)

**The 8 template builders:**

| # | Template | Recipient | Context to Include | Deep Link |
|---|----------|-----------|-------------------|----------|
| 1 | `submission_received` | Instructor | Student name, assignment name, checkpoint name | `/instructor/reviews/{submissionId}` |
| 2 | `review_completed` | Student | Instructor/reviewer name, assignment name, checkpoint name, result: Pass | `/student/assignments/{assignmentId}` |
| 3 | `revision_requested` | Student | Instructor/reviewer name, assignment name, checkpoint name, result: Revise, revision deadline | `/student/assignments/{assignmentId}` |
| 4 | `consultation_verified` | Student | Instructor name, checkpoint name | `/student/assignments/{assignmentId}` |
| 5 | `consultation_rejected` | Student | Instructor name, checkpoint name, rejection reason | `/student/assignments/{assignmentId}` |
| 6 | `extension_approved` | Student | Instructor name, assignment name, extension days, new deadline | `/student/assignments/{assignmentId}` |
| 7 | `extension_rejected` | Student | Instructor name, assignment name, rejection reason | `/student/assignments/{assignmentId}` |
| 8 | `extension_requested` | Instructor | Student name, assignment name, category, duration requested | `/instructor/assignments/{assignmentId}` |

**Subject line format (per user decision):** `[SIMAK] {Localized Event Description}` — e.g., `[SIMAK] Submission Received`, `[SIMAK] Review Completed`.

**Locale fallback (per user decision):** If recipient locale is null, undefined, or unsupported, default to English (`'en'`).

### FR-2: `template_type` Enum Extension

Extend the existing `CHECK` constraint on `email_queue.template_type` from 4 values to 12 values:

- **Existing (4):** `password_reset`, `invitation`, `sla_alert`, `two_factor`
- **New (8):** `submission_received`, `review_completed`, `revision_requested`, `consultation_verified`, `consultation_rejected`, `extension_approved`, `extension_rejected`, `extension_requested`

Run `pnpm db:generate` + `pnpm db:migrate` to create and apply the migration.

### FR-3: Post-Commit Advisory Email Enqueue in Handlers

Add `enqueueEmail()` calls alongside existing in-app notification INSERTs in 8+ handlers. The email enqueue is **post-commit advisory** — after the transaction commits, wrap `enqueueEmail()` in `try/catch` with `console.error` on failure. The primary operation must succeed even if email enqueue fails. Modeled after `two-factor.server.ts` lines 96-97, 198-199.

**Handler wiring list:**

| Handler File | Event(s) | In-App Notification Already Exists? |
|---|---|---|
| `submissions.server.ts` → `submitCheckpointHandler` | `submission_received` → instructor | Yes |
| `reviews.server.ts` → `submitReviewHandler` | `review_completed` (pass) / `revision_requested` (revise) → student | Yes |
| `consultations.server.ts` → `verifyConsultationHandler` | `consultation_verified` → student | Yes |
| `consultations.server.ts` → `rejectConsultationHandler` | `consultation_rejected` → student | Yes |
| `extensions-extras.server.ts` → `approveExtensionHandler` | `extension_approved` → student | Yes |
| `extensions-extras.server.ts` → `rejectExtensionHandler` | `extension_rejected` → student | Yes |
| `extensions-extras.server.ts` → `requestExtensionHandler` | `extension_requested` → instructor | Yes |
| `extensions-extras.server.ts` → `bulkExtendHandler` | `extension_approved` → all affected students (loop) | Yes (line 402, outside tx) |

### FR-4: Recipient Resolution

Each event resolves recipients from the existing notification dispatch logic:
- `submission_received` → instructor (assignment's `instructorId`)
- `review_completed` / `revision_requested` → student (checkpoint's student)
- `consultation_verified` / `consultation_rejected` → student (consultation's student)
- `extension_approved` / `extension_rejected` → student (extension request's student)
- `extension_requested` → instructor (assignment's `instructorId`)
- `extension_approved` (bulk) → all affected students in the bulk extend
- SLA breach emails already sent via `sendSLAAlertEmail` — **no change**

**Skip conditions:** Skip email enqueue if the recipient:
- Has no verified email (`emailVerified` is null/false)
- Is soft-deleted (`deletedAt` is not null)

**Locale resolution:** Use `session.user.locale` (already enriched in `auth.ts:60` via `_getSession`). For recipients not in the current session (e.g., the other party in a consultation), resolve locale from the DB `users.locale` column.

### FR-5: i18n Subject Keys

Add locale-aware email subject i18n keys to both `locales/en.json` and `locales/id.json` under a new `emails.subjects.*` namespace:

```json
{
  "emails": {
    "subjects": {
      "submissionReceived": "Submission Received",
      "reviewCompleted": "Review Completed",
      "revisionRequested": "Revision Requested",
      "consultationVerified": "Consultation Verified",
      "consultationRejected": "Consultation Rejected",
      "extensionApproved": "Extension Approved",
      "extensionRejected": "Extension Rejected",
      "extensionRequested": "Extension Requested"
    }
  }
}
```

(With corresponding Indonesian translations in `locales/id.json`.)

Run `pnpm generate:i18n` after adding keys.

## Non-Functional Requirements

### NFR-1: File Size Compliance

- `src/lib/email-templates.ts` must stay under 500 lines (8 templates × ~50 lines each + shared helpers). If approaching the limit, extract shared header/footer to a separate section within the same file.
- `src/lib/email.ts` (currently 255 lines) must remain under 500 lines after importing from `email-templates.ts`.
- All modified handler files must remain under 500 lines.

### NFR-2: No Processor Changes

The email queue processor (`src/lib/email-queue-processor.ts`) is already production-hardened. This track makes NO changes to the processor itself — only enqueues new rows that the processor picks up.

### NFR-3: Advisory-Only Guarantee

Email enqueue failure must NEVER roll back the primary operation (submission, review, consultation, extension). The `try/catch` pattern ensures this. `console.error` logs the failure for debugging.

### NFR-4: Coverage

All new code must meet ≥80% coverage on lines, statements, branches, and functions.

## Acceptance Criteria

1. **AC-1:** As a student, when I submit a checkpoint, the instructor receives both an in-app notification AND an email (visible in `/admin/email-queue` as an enqueued row).
2. **AC-2:** As an instructor, when I complete a review (pass or revise), the student receives both an in-app notification AND an email.
3. **AC-3:** As an instructor, when I verify/reject a consultation, the student receives both an in-app notification AND an email.
4. **AC-4:** As an instructor, when I approve/reject an extension request, the student receives both an in-app notification AND an email.
5. **AC-5:** As a student, when I request an extension, the instructor receives both an in-app notification AND an email.
6. **AC-6:** When an instructor triggers a bulk extend, all affected students receive emails (one per student).
7. **AC-7:** Email subjects are prefixed with `[SIMAK]` and are locale-aware (Indonesian recipients see Indonesian subjects).
8. **AC-8:** Email bodies include full contextual details (assignment name, checkpoint name, actor name, result) and a "View in SIMAK" deep-link button.
9. **AC-9:** If the recipient's locale is null/unsupported, the email defaults to English.
10. **AC-10:** If email enqueue fails, the primary operation still succeeds (advisory-only).
11. **AC-11:** If the recipient is soft-deleted or has no verified email, no email is enqueued (in-app notification may still fire).
12. **AC-12:** `template_type` CHECK constraint on `email_queue` accepts all 12 values.
13. **AC-13:** `src/lib/email-templates.ts` exists with 8 template-builder functions + shared header/footer helpers.
14. **AC-14:** `pnpm typecheck`, `pnpm lint`, `pnpm check:i18n` all pass.
15. **AC-15:** Coverage ≥80% on all four metrics.

## Out of Scope

- **Per-user email notification preferences / opt-out** (ENH-UX-4 / original UX-47) — separate future track. This track sends all event emails to all recipients.
- **Email digest / batch mode** — immediate send per event.
- **Resend webhook / bounce handling** — separate future feature.
- **Changes to the email queue processor** — already production-hardened.
- **Migration of existing auth email templates** (invitation, password reset, SLA alert) to `email-templates.ts` — they stay in `email.ts`.
- **`consultation_logged` email** — only `consultation_verified` and `consultation_rejected` get emails (matching the current in-app notification scope for instructor-facing consultation events).
