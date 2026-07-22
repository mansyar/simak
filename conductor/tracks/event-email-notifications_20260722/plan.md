<protect>
# Implementation Plan: TRACK-018 — Event Email Notifications

## Phase 1: Foundation — Templates, Schema & i18n [checkpoint: dd274f6]

- [x] Task: Read spec.md and workflow.md to refresh context for this phase
    - [x] Read `conductor/tracks/event-email-notifications_20260722/spec.md`
    - [x] Read `conductor/workflow.md` (TDD lifecycle, commit format, checkpoint protocol)

- [x] Task: Create email template builder module (`src/lib/email-templates.ts`) [e921bc1]
    - [ ] Write unit tests for shared `buildEmailHeader(locale)` and `buildEmailFooter(locale)` helpers (SIMAK branding, HTML structure)
    - [ ] Write unit tests for all 8 localized template-builder functions — verify correct output per locale (EN/ID), deep-link URL, contextual params (assignment name, checkpoint name, actor name, result)
    - [ ] Write unit test verifying locale fallback to English when locale is null/unsupported
    - [ ] Implement shared `buildEmailHeader(locale)` and `buildEmailFooter(locale)` helpers
    - [ ] Implement 8 template-builder functions: `buildSubmissionReceivedHtml`, `buildReviewCompletedHtml`, `buildRevisionRequestedHtml`, `buildConsultationVerifiedHtml`, `buildConsultationRejectedHtml`, `buildExtensionApprovedHtml`, `buildExtensionRejectedHtml`, `buildExtensionRequestedHtml`
    - [ ] Verify all tests pass and file is under 500 lines

- [x] Task: Extend `template_type` CHECK constraint on `email_queue` (4 → 12 values) [e93ffa0]
    - [x] Write test verifying all 12 `template_type` values are accepted by the CHECK constraint
    - [x] Add 8 new enum values to the `email_queue` schema definition in `src/db/schema/`
    - [x] Run `pnpm db:generate` to create migration SQL — N/A: Drizzle's text enum is TypeScript-only, no DB CHECK constraint exists, no migration generated
    - [x] Create rollback SQL file (per SQL styleguide §5.1) — N/A: no migration generated
    - [x] Run `pnpm db:migrate` to apply migration to dev DB — N/A: no migration generated
    - [x] Verify test passes

- [x] Task: Add i18n email subject keys (commit deferred — i18n-only changes; included in Phase 1 checkpoint)
    - [x] Add 8 subject keys to `locales/en.json` under `emails.subjects.*` (submissionReceived, reviewCompleted, revisionRequested, consultationVerified, consultationRejected, extensionApproved, extensionRejected, extensionRequested)
    - [x] Add 8 subject keys to `locales/id.json` with Indonesian translations
    - [x] Run `pnpm generate:i18n` to regenerate types
    - [x] Verify `pnpm check:i18n` passes (EN↔ID parity)

- [x] Task: Conductor - User Manual Verification 'Foundation — Templates, Schema & i18n' (Protocol in workflow.md)

## Phase 2: Recipient Resolution & Handler Wiring

- [x] Task: Read spec.md and workflow.md to refresh context for this phase
    - [x] Read `conductor/tracks/event-email-notifications_20260722/spec.md`
    - [x] Read `conductor/workflow.md` (TDD lifecycle, commit format, checkpoint protocol)

- [x] Task: Create recipient resolution helper [11f9517]
    - [x] Write unit tests for `resolveEmailRecipient(userId)` — returns `{ email, locale }` from DB, returns `null` when user is soft-deleted, returns `null` when `emailVerified` is null/false, defaults locale to `'en'` when null/unsupported
    - [x] Implement `resolveEmailRecipient(userId)` helper (DB query on `users` table for `email`, `locale`, `emailVerified`, `deletedAt`)
    - [x] Verify tests pass

- [ ] Task: Wire `enqueueEmail` in `submitCheckpointHandler` (`submissions.server.ts`)
    - [ ] Write tests verifying `enqueueEmail` called with correct recipient (instructor), subject (`[SIMAK] Submission Received`), `template_type` (`submission_received`), and body HTML built from `buildSubmissionReceivedHtml`
    - [ ] Write test verifying advisory-only failure — primary operation (checkpoint submission) succeeds when `enqueueEmail` throws, `console.error` is called
    - [ ] Write test verifying skip when instructor is soft-deleted or has no verified email
    - [ ] Implement post-commit advisory `enqueueEmail` call (after transaction, `try/catch` with `console.error`)
    - [ ] Verify tests pass

- [ ] Task: Wire `enqueueEmail` in `submitReviewHandler` (`reviews.server.ts`)
    - [ ] Write tests for `review_completed` (pass decision) path — student recipient, subject `[SIMAK] Review Completed`, `template_type` `review_completed`
    - [ ] Write tests for `revision_requested` (revise decision) path — student recipient, subject `[SIMAK] Revision Requested`, `template_type` `revision_requested`
    - [ ] Write advisory-only failure test (review succeeds when enqueue throws)
    - [ ] Write skip test (soft-deleted / no verified email student)
    - [ ] Implement post-commit advisory `enqueueEmail` call (conditional on decision: pass vs revise)
    - [ ] Verify tests pass

- [ ] Task: Wire `enqueueEmail` in consultation handlers (`consultations.server.ts`)
    - [ ] Write tests for `verifyConsultationHandler` — `consultation_verified` → student, subject `[SIMAK] Consultation Verified`, correct template_type and body
    - [ ] Write tests for `rejectConsultationHandler` — `consultation_rejected` → student, subject `[SIMAK] Consultation Rejected`, correct template_type and body
    - [ ] Write advisory-only failure tests for both handlers
    - [ ] Implement post-commit advisory `enqueueEmail` calls in both handlers
    - [ ] Verify tests pass

- [ ] Task: Wire `enqueueEmail` in extension handlers (`extensions-extras.server.ts`)
    - [ ] Write tests for `approveExtensionHandler` — `extension_approved` → student, subject `[SIMAK] Extension Approved`, correct template_type and body (includes extension days + new deadline)
    - [ ] Write tests for `rejectExtensionHandler` — `extension_rejected` → student, subject `[SIMAK] Extension Rejected`, correct template_type and body (includes rejection reason)
    - [ ] Write tests for `requestExtensionHandler` — `extension_requested` → instructor, subject `[SIMAK] Extension Requested`, correct template_type and body (includes category + duration)
    - [ ] Write advisory-only failure tests for all three handlers
    - [ ] Implement post-commit advisory `enqueueEmail` calls in all three handlers
    - [ ] Verify tests pass

- [ ] Task: Wire `enqueueEmail` in `bulkExtendHandler` (`extensions-extras.server.ts`)
    - [ ] Write test verifying one `enqueueEmail` call per affected student in the bulk extend operation
    - [ ] Write test verifying advisory-only failure — bulk extend succeeds even if individual `enqueueEmail` calls throw (each wrapped in its own `try/catch`)
    - [ ] Implement loop-based `enqueueEmail` calls for each affected student (mirroring the existing advisory in-app notification pattern at line 402)
    - [ ] Verify tests pass

- [ ] Task: Conductor - User Manual Verification 'Recipient Resolution & Handler Wiring' (Protocol in workflow.md)

## Phase 3: Quality Gates & Final Verification

- [ ] Task: Read spec.md and workflow.md to refresh context for this phase
    - [ ] Read `conductor/tracks/event-email-notifications_20260722/spec.md`
    - [ ] Read `conductor/workflow.md` (TDD lifecycle, commit format, checkpoint protocol)

- [ ] Task: Run full quality gate suite and fix issues
    - [ ] Run `pnpm test:coverage` — verify ≥80% on lines, statements, branches, and functions
    - [ ] Run `pnpm typecheck` — verify no type errors
    - [ ] Run `pnpm lint` — verify 0 warnings, 0 errors (including `simak-i18n/no-hardcoded`)
    - [ ] Run `pnpm check:i18n` — verify EN↔ID key parity, no new unused keys
    - [ ] Verify all new/modified files under 500 lines (`scripts/check-modularity.js`)
    - [ ] Fix any issues found and re-run gates until clean

- [ ] Task: Conductor - User Manual Verification 'Quality Gates & Final Verification' (Protocol in workflow.md)
</protect>
