<protect>
# Implementation Plan: Track 4.1 — Background Email Queue with Retry

## Phase 1: Database Schema & Migration

- [x] Task: Create Drizzle schema for `email_queue` table (46465f9)
  - [x] Create `src/db/schema/email-queue.ts` with `emailQueue` table definition
  - [x] Define columns: id (serial PK), recipient_email, subject, body_html, template_type (CHECK constraint), status, attempts, last_attempt_at, error_message, created_at
  - [x] Add index on `(status, created_at ASC)` for dequeuing
  - [x] Register table in `src/db/schema/index.ts` (re-export + relations)
- [x] Task: Generate Drizzle migration
  - [x] Manually wrote `drizzle/migrations/0007_email_queue.sql` (drizzle-kit generate failed due to stale snapshot state — see git notes)
  - [x] Updated `drizzle/migrations/meta/_journal.json` with entry 0007
  - [x] Applied email_queue table to dev DB via `drizzle-kit push` (push works; migrate framework has stale \_\_drizzle_migrations state)
- [x] Task: Write tests for schema (46465f9)
  - [x] Test column types and constraints
  - [x] Test index existence
  - [x] Run `CI=true pnpm test` and confirm new tests fail (Red phase)
- [x] Task: Implement schema — make tests pass (46465f9)
  - [x] Run `CI=true pnpm test` and confirm all tests pass
- [ ] Task: Conductor - User Manual Verification 'Database Schema & Migration' (Protocol in workflow.md)

## Phase 2: Enqueue Helpers

- [ ] Task: Create `enqueueEmail` internal helper in `src/lib/email.ts`
  - [ ] Add function that inserts a row into `email_queue` with status `pending`
  - [ ] Accept recipient_email, subject, body_html, template_type as parameters
- [ ] Task: Refactor `sendPasswordResetEmail` to enqueue
  - [ ] Keep the same function signature
  - [ ] Generate HTML template as before, then call `enqueueEmail` instead of `resend.emails.send()`
- [ ] Task: Refactor `sendInvitationEmail` to enqueue
  - [ ] Same pattern — generate HTML, call `enqueueEmail`
- [ ] Task: Refactor `sendSLAAlertEmail` to enqueue
  - [ ] Same pattern — generate HTML, call `enqueueEmail`
- [ ] Task: Update existing email tests
  - [ ] Update `tests/unit/lib/email.test.ts` to mock DB insert instead of Resend
  - [ ] Update `tests/unit/email/sla-breach-email.test.ts` to mock DB insert instead of Resend
  - [ ] Add new test for `enqueueEmail` helper
  - [ ] Run `CI=true pnpm test` and confirm new tests fail (Red phase)
- [ ] Task: Implement enqueue — make tests pass (Green phase)
  - [ ] Run `CI=true pnpm test` and confirm all tests pass
- [ ] Task: Conductor - User Manual Verification 'Enqueue Helpers' (Protocol in workflow.md)

## Phase 3: Background Processor

- [ ] Task: Create email queue processor module (`src/lib/email-queue-processor.ts`)
  - [ ] Implement `processEmailQueue()` function:
    - [ ] Query pending emails ordered by `created_at ASC`
    - [ ] For each: attempt Resend via shared `sendEmailWithResend()`
    - [ ] On success: update status to `sent`
    - [ ] On failure: increment attempts, store error_message, update last_attempt_at
    - [ ] After 3 failures: mark status as `failed`
- [ ] Task: Implement retry backoff logic
  - [ ] Skip emails that were attempted less than the backoff interval ago:
    - [ ] Attempt 1 → 2: min 30s since last_attempt_at
    - [ ] Attempt 2 → 3: min 5min since last_attempt_at
    - [ ] Attempt 3 → fail: min 30min since last_attempt_at
- [ ] Task: Wire processor into server startup
  - [ ] Create `src/lib/email-queue-init.ts` that starts a `setInterval` at 30s
  - [ ] Import and call init from the app entry point
  - [ ] Handle graceful cleanup (clearInterval on server shutdown)
- [ ] Task: Write tests for processor
  - [ ] Test dequeuing — picks pending rows in correct order
  - [ ] Test send success — updates status to `sent`
  - [ ] Test send failure — increments attempts, stores error
  - [ ] Test backoff — skips emails not yet due for retry
  - [ ] Test max attempts — marks `failed` after 3 failures
  - [ ] Run `CI=true pnpm test` and confirm new tests fail (Red phase)
- [ ] Task: Implement processor — make tests pass (Green phase)
  - [ ] Run `CI=true pnpm test` and confirm all tests pass
- [ ] Task: Conductor - User Manual Verification 'Background Processor' (Protocol in workflow.md)

## Phase 4: Admin Dashboard Widget & i18n

- [ ] Task: Add email queue status query to admin dashboard handler
  - [ ] In `src/server/dashboard-admin.server.ts`, add query to count pending/sent/failed
- [ ] Task: Create AdminEmailQueueWidget component
  - [ ] Small card component showing 3 stat boxes (Pending, Sent, Failed) with color coding
  - [ ] Display on `/admin/dashboard` alongside existing metric cards
- [ ] Task: Add i18n translations
  - [ ] Add `adminDashboard.emailQueue.pending`, `.sent`, `.failed` to `locales/en.json`
  - [ ] Add Indonesian translations to `locales/id.json`
  - [ ] Regenerate i18n types with `pnpm generate:i18n`
- [ ] Task: Write tests for admin widget
  - [ ] Test dashboard handler returns queue counts
  - [ ] Test widget component renders counts correctly
  - [ ] Run `CI=true pnpm test` and confirm new tests fail (Red phase)
- [ ] Task: Implement widget — make tests pass (Green phase)
  - [ ] Run `CI=true pnpm test` and confirm all tests pass
- [ ] Task: Conductor - User Manual Verification 'Admin Dashboard Widget & i18n' (Protocol in workflow.md)

## Phase 5: Final Verification

- [ ] Task: Run full test suite
  - [ ] `pnpm typecheck` — no type errors
  - [ ] `CI=true pnpm test` — all tests pass (including existing)
  - [ ] `pnpm lint` — no lint errors
- [ ] Task: Verify modularity limits
  - [ ] `node scripts/check-modularity.js` — all new files under 500 lines
- [ ] Task: Conductor - User Manual Verification 'Final Verification' (Protocol in workflow.md)
      </protect>
