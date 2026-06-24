<protect>
# Track 8.2 — Email Pipeline Hardening: Implementation Plan

> **Spec:** [./spec.md](./spec.md)
> **Workflow:** TDD (Red → Green → Refactor), >80% coverage, commit per task with git notes

---

## Phase 1: Database Schema & Migration

- [ ] Task: Read spec.md and workflow.md before starting this phase
    - [ ] Read `./spec.md` — review requirements and acceptance criteria for this phase
    - [ ] Read `../../workflow.md` — review TDD protocol and Phase Completion Verification Protocol
- [ ] Task: Add `processing` status to `email_queue` schema
    - [ ] Write failing unit test asserting `email_queue.status` enum includes `processing` alongside `pending`, `sent`, `failed` (Red)
    - [ ] Run test and confirm it fails as expected
    - [ ] Update `src/db/schema/email-queue.ts` — add `processing` to the `status` text enum array
    - [ ] Create migration `drizzle/migrations/000X_email_queue_processing_status.sql` — alter the CHECK constraint on `status` to include `processing`
    - [ ] Run test and confirm it passes (Green)
    - [ ] Verify migration is reversible (down migration or documented rollback)
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Database Schema & Migration' (Protocol in workflow.md)

---

## Phase 2: Email Queue Concurrency Hardening

- [ ] Task: Read spec.md and workflow.md before starting this phase
    - [ ] Read `./spec.md` — review requirements and acceptance criteria for this phase
    - [ ] Read `../../workflow.md` — review TDD protocol and Phase Completion Verification Protocol
- [ ] Task: Implement transactional claim with `FOR UPDATE SKIP LOCKED`
    - [ ] Write failing unit test — `processEmailQueue` wraps the claim query in `db.transaction` (Red)
    - [ ] Write failing unit test — claim query uses `.for('UPDATE SKIP LOCKED')` (Red)
    - [ ] Write failing unit test — claimed rows are marked `processing` within the transaction before send (Red)
    - [ ] Write failing unit test — Resend send occurs outside the transaction; status updated to `sent`/`pending`/`failed` individually afterward (Red)
    - [ ] Run tests and confirm they fail as expected
    - [ ] Refactor `processEmailQueue` in `src/lib/email-queue-processor.ts` — claim rows via `db.transaction` with `FOR UPDATE SKIP LOCKED`, mark as `processing`, send outside transaction, update status individually
    - [ ] Run tests and confirm they pass (Green)
    - [ ] Verify existing processor tests still pass (no regression in backoff/retry/attempts logic)
- [ ] Task: Implement `isRunning` guard in `email-queue-init.ts`
    - [ ] Write failing unit test — second tick within 30s of first returns immediately without calling `processEmailQueue` (Red)
    - [ ] Write failing unit test — guard resets to `false` after a tick completes (even on error) (Red)
    - [ ] Run tests and confirm they fail as expected
    - [ ] Add `isRunning` boolean guard to `src/lib/email-queue-init.ts` — skip tick if in flight, set true before processing, reset in `finally` block
    - [ ] Run tests and confirm they pass (Green)
- [ ] Task: Implement stale `processing` row recovery
    - [ ] Write failing unit test — `processing` rows with `lastAttemptAt` older than 5 minutes are reclaimed to `pending` at the start of each tick (Red)
    - [ ] Write failing unit test — fresh `processing` rows (under 5 min) are left alone (Red)
    - [ ] Write failing unit test — reclaim runs before claiming new pending rows (Red)
    - [ ] Run tests and confirm they fail as expected
    - [ ] Implement stale-row reclaim as the first step of `processEmailQueue` — `UPDATE email_queue SET status = 'pending' WHERE status = 'processing' AND lastAttemptAt < (now() - 5 min)`
    - [ ] Run tests and confirm they pass (Green)
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Email Queue Concurrency Hardening' (Protocol in workflow.md)

---

## Phase 3: HTML Injection Remediation

- [ ] Task: Read spec.md and workflow.md before starting this phase
    - [ ] Read `./spec.md` — review requirements and acceptance criteria for this phase
    - [ ] Read `../../workflow.md` — review TDD protocol and Phase Completion Verification Protocol
- [ ] Task: Implement `escapeHtml` helper in `src/lib/email.ts`
    - [ ] Write failing unit test — `escapeHtml` escapes ampersand (`&` → `&amp;`) (Red)
    - [ ] Write failing unit test — `escapeHtml` escapes less-than (`<` → `&lt;`) and greater-than (`>` → `&gt;`) (Red)
    - [ ] Write failing unit test — `escapeHtml` escapes double-quote and single-quote to entity equivalents (Red)
    - [ ] Write failing unit test — `escapeHtml` passes through normal text (no special chars) unchanged (Red)
    - [ ] Run tests and confirm they fail as expected
    - [ ] Implement `escapeHtml(s: string): string` in `src/lib/email.ts`
    - [ ] Run tests and confirm they pass (Green)
- [ ] Task: Apply `escapeHtml` to email templates in `src/lib/email.ts`
    - [ ] Write failing unit test — `<script>alert(1)</script>` in `params.name` renders as `&lt;script&gt;` in `sendPasswordResetEmail` body (Red)
    - [ ] Write failing unit test — malicious input in `params.name` renders escaped in `sendInvitationEmail` body (Red)
    - [ ] Write failing unit test — `<img onerror=...>` in `assignmentTitle`, `studentName`, `checkpointName`, `adminName` all render escaped in `sendSLAAlertEmail` body (Red)
    - [ ] Write failing unit test — regression: normal (non-malicious) input in all 3 functions produces identical output to before (existing assertions still pass) (Red)
    - [ ] Run tests and confirm they fail as expected
    - [ ] Apply `escapeHtml` to `params.name` in `sendPasswordResetEmail` and `sendInvitationEmail`
    - [ ] Apply `escapeHtml` to `adminName`, `assignmentTitle`, `studentName`, `checkpointName` in `sendSLAAlertEmail`
    - [ ] Run tests and confirm they pass (Green)
    - [ ] Verify server-controlled values (reset URLs, setup URLs, copyright text) are NOT escaped
- [ ] Task: Apply `escapeHtml` to email templates in `src/server/two-factor.server.ts`
    - [ ] Write failing unit test — malicious input in user display name renders escaped in 2FA enable email body (Red)
    - [ ] Write failing unit test — malicious input in user display name renders escaped in 2FA disable email body (Red)
    - [ ] Write failing unit test — regression: normal input in 2FA emails produces identical output to before (Red)
    - [ ] Run tests and confirm they fail as expected
    - [ ] Apply `escapeHtml` to user display name interpolations in both 2FA enable and disable email templates in `src/server/two-factor.server.ts`
    - [ ] Run tests and confirm they pass (Green)
- [ ] Task: Conductor - User Manual Verification 'Phase 3: HTML Injection Remediation' (Protocol in workflow.md)

---

## Phase 4: Integration Test & Final Verification

- [ ] Task: Read spec.md and workflow.md before starting this phase
    - [ ] Read `./spec.md` — review requirements and acceptance criteria for this phase
    - [ ] Read `../../workflow.md` — review TDD protocol and Phase Completion Verification Protocol
- [ ] Task: Multi-worker integration test for duplicate-delivery prevention
    - [ ] Write integration test in `tests/integration/` — two concurrent `processEmailQueue` calls each send disjoint email sets against real PostgreSQL using `FOR UPDATE SKIP LOCKED`
    - [ ] Write integration test assertion — no email row is sent twice across both workers
    - [ ] Run integration test (`pnpm test:integration`) and confirm it passes
- [ ] Task: Full regression and quality gates
    - [ ] Run full unit test suite (`pnpm test`) — confirm no regressions
    - [ ] Run typecheck (`pnpm typecheck`) — confirm no errors
    - [ ] Run lint (`pnpm lint`) — confirm no errors
    - [ ] Run format check (`pnpm format`) — confirm no changes needed
    - [ ] Run coverage (`pnpm test:coverage`) — confirm >80% thresholds met for changed files
    - [ ] Verify all new files are under 500-line modularity limit (`node scripts/check-modularity.js`)
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Integration Test & Final Verification' (Protocol in workflow.md)
</protect>
