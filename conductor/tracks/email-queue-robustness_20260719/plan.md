<protect>
# Implementation Plan: Email Queue Robustness

**Track ID:** `email-queue-robustness_20260719`
**Spec:** [./spec.md](./spec.md)

## Phase 1: Config Hygiene (FR-5) [checkpoint: f4eb97a]

- [x] Task: Read spec.md and workflow.md to prepare for Phase 1 implementation
    - [x] Read `./spec.md` — review FR-5 and Acceptance Criterion #5
    - [x] Read `conductor/workflow.md` — review TDD lifecycle, commit format, and quality gates

- [x] Task: Route EMAIL_FROM through validated env config [2bcf3d2]
    - [ ] Write failing tests: extend/inspect `tests/unit/config/env.test.ts` (or create) to assert `getEnv().EMAIL_FROM` returns the env value when set and the default `'SIMAK <noreply@simak.app>'` when unset; update `tests/unit/lib/email-queue-processor.test.ts` to assert the processor reads `EMAIL_FROM` from `getEnv()` (not `process.env`) — run `pnpm test` and confirm failures
    - [ ] Add `EMAIL_FROM: z.string().default('SIMAK <noreply@simak.app>')` to `envSchema` in `src/config/env.ts`; add `EMAIL_FROM: string` to the `Env` type intersection
    - [ ] Replace `process.env.EMAIL_FROM || 'SIMAK <noreply@simak.app>'` (line 91 of `src/lib/email-queue-processor.ts`) with `getEnv().EMAIL_FROM` (getEnv already imported)
    - [ ] Add `EMAIL_FROM=` (commented with default) to `.env.example`
    - [ ] Run `pnpm test` — confirm all tests pass
    - [ ] Run quality gates: `pnpm typecheck && pnpm lint && pnpm check:i18n` — all pass
    - [ ] Commit: `refactor(config): Route EMAIL_FROM through validated env config`
    - [ ] Attach git note with task summary
    - [ ] Record commit SHA in plan.md

- [x] Task: Conductor - User Manual Verification 'Phase 1: Config Hygiene' (Protocol in workflow.md)

## Phase 2: Structured Processor Logging (FR-4) + Verify FR-3 [checkpoint: 4801a1f]

- [x] Task: Read spec.md and workflow.md to prepare for Phase 2 implementation
    - [x] Read `./spec.md` — review FR-3, FR-4, and Acceptance Criteria #3, #4
    - [x] Confirm FR-3 already satisfied: `src/lib/email-queue-init.ts` `tick()` wraps `processEmailQueue()` in try/catch/finally with `isRunning` guard; existing test `tests/unit/lib/email-queue-init.test.ts` ("resets isRunning guard after a tick errors so the next tick runs") verifies the loop continues after an error — no code change needed for FR-3

- [x] Task: Add structured logging to the email queue processor cycle [de96e09]
    - [ ] Write failing tests in `tests/unit/lib/email-queue-processor.test.ts`: (1) assert a structured log line is emitted on cycle start with email count; (2) assert a structured log line is emitted on cycle end with processed/sent/failed counts; (3) assert stale-row reclamation count is logged; (4) assert per-email failure is logged with email id + error message and NO body/subject PII — spy on the logger — run `pnpm test` and confirm failures
    - [ ] Expand `processEmailQueue()` return type in `src/lib/email-queue-processor.ts` to include `reclaimed: number` (capture rowCount from the stale-`processing` UPDATE)
    - [ ] Add structured cycle start/end logs, stale-reclamation log, and per-email failure log (email id + error message only; no PII from `bodyHtml`/`subject`/`recipientEmail`) — use a small `log` helper or `console` with structured fields consistent with existing code
    - [ ] Replace `console.error(error)` in `src/lib/email-queue-init.ts` `tick()` catch block with a structured log line (cycle error + interval-continues semantics)
    - [ ] Run `pnpm test` — confirm all tests pass (including existing init error-isolation test)
    - [ ] Run quality gates: `pnpm typecheck && pnpm lint && pnpm check:i18n` — all pass
    - [ ] Commit: `feat(email-queue): Add structured processor logging and reclaim count`
    - [ ] Attach git note with task summary
    - [ ] Record commit SHA in plan.md

- [x] Task: Conductor - User Manual Verification 'Phase 2: Structured Processor Logging' (Protocol in workflow.md)

## Phase 3: Admin Queue Server Functions (FR-1 backend, FR-2 backend) [checkpoint: 2141cba]

- [x] Task: Read spec.md and workflow.md to prepare for Phase 3 implementation
    - [x] Read `./spec.md` — review FR-1, FR-2, and Acceptance Criteria #1, #2
    - [x] Read `conductor/workflow.md` — review server-function two-file split and quality gates

- [x] Task: Implement listEmailQueue server function (FR-1 backend) [e5393c4]
    - [ ] Write failing tests in `tests/unit/server/email-queue.test.ts` (Node env): (1) returns paginated rows (20/page) ordered by `created_at` DESC; (2) filters by status when provided; (3) free-text search matches recipient_email OR subject (case-insensitive); (4) admin role passes, non-admin is rejected via `requireRole`; (5) returns summary counts (pending/sent/failed) — mock `@/db/index` and `@/server/auth` — run `pnpm test` and confirm failures
    - [ ] Create `src/server/email-queue.ts` — Zod input schema (page, status filter, search) + `createServerFn` stubs (`listEmailQueue`, `retryEmail`) using the typed builder `.inputValidator(Schema).handler(...)` pattern
    - [ ] Create `src/server/email-queue.server.ts` — `listEmailQueueHandler`: `requireRole(['superadmin', 'admin'])`, paginated/filtered/search query using the existing `(status, created_at)` index, plus summary counts
    - [ ] Run `pnpm test` — confirm all tests pass
    - [ ] Run quality gates: `pnpm typecheck && pnpm lint && pnpm check:i18n` — all pass
    - [ ] Commit: `feat(email-queue): Add listEmailQueue admin server function`
    - [ ] Attach git note with task summary
    - [ ] Record commit SHA in plan.md

- [x] Task: Implement retryEmail server function (FR-2 backend) [c2dabd8]
    - [ ] Write failing tests in `tests/unit/server/email-queue.test.ts`: (1) resets a `failed` row to `status='pending'`, `attempts=0`, `errorMessage=null`, `lastAttemptAt=null`; (2) rejects (idempotent guard) when the row is not currently `failed`; (3) admin role passes, non-admin rejected; (4) non-existent id returns a not-found error — run `pnpm test` and confirm failures
    - [ ] Add `retryEmail` stub to `src/server/email-queue.ts` (Zod schema for `emailId`)
    - [ ] Add `retryEmailHandler` to `src/server/email-queue.server.ts`: `requireRole(['superadmin', 'admin'])`, SELECT FOR UPDATE the row, assert `status === 'failed'` else throw stale-state error, UPDATE reset fields
    - [ ] Run `pnpm test` — confirm all tests pass
    - [ ] Run quality gates: `pnpm typecheck && pnpm lint && pnpm check:i18n` — all pass
    - [ ] Commit: `feat(email-queue): Add retryEmail admin server function for failed-email recovery`
    - [ ] Attach git note with task summary
    - [ ] Record commit SHA in plan.md

- [x] Task: Conductor - User Manual Verification 'Phase 3: Admin Queue Server Functions' (Protocol in workflow.md)

## Phase 4: Admin Inspector UI + Retry Action (FR-1, FR-2 frontend)

- [ ] Task: Read spec.md and workflow.md to prepare for Phase 4 implementation
    - [ ] Read `./spec.md` — review FR-1, FR-2, Acceptance Criteria #1, #2, #6
    - [ ] Reference existing admin list page pattern (`/admin/audit-log`) for paginated table + filters + shared `<Pagination>` primitive

- [ ] Task: Add i18n keys for the email queue inspector UI
    - [ ] Add keys under `adminEmailQueue.*` (page title, table headers: recipient/subject/template/attempts/createdAt/lastAttemptAt/errorMessage, status labels, filter labels, retry button, retry confirmation dialog text, empty state) to `locales/en.json` and `locales/id.json`
    - [ ] Run `pnpm generate:i18n` to regenerate types
    - [ ] Run `pnpm check:i18n` — parity passes

- [ ] Task: Implement /admin/email-queue inspector route + retry action
    - [ ] Write failing tests in `tests/unit/routes/admin/email-queue.test.tsx` (and/or component test): (1) page renders table with rows from `listEmailQueue`; (2) status filter and search drive the query; (3) summary stat row shows pending/sent/failed; (4) `failed` rows show a Retry button; (5) clicking Retry opens a confirmation dialog, confirming calls `retryEmail` and refetches — mock the server functions — run `pnpm test` and confirm failures
    - [ ] Create route `src/routes/_authenticated/admin/email-queue/index.tsx` (SSR loader calls `listEmailQueue`; ≤120 lines — extract subcomponents if needed)
    - [ ] Create inspector components (e.g. `src/components/admin/email-queue/EmailQueueTable.tsx`, `EmailQueueFilters.tsx`, summary stat row) reusing shared primitives (`<Pagination>`, `<PageHeader>`, `<EmptyState>`, `<Select>`, status badges)
    - [ ] Wire Retry button → confirmation dialog (AlertDialog) → `retryEmail` mutation via TanStack Query → invalidate list query on success + toast
    - [ ] Add "Email Queue" sidebar link (with Mail icon) to the admin sidebar
    - [ ] Run `pnpm test` — confirm all tests pass
    - [ ] Run quality gates: `pnpm typecheck && pnpm lint && pnpm check:i18n` — all pass
    - [ ] Verify no file in `src/`/`tests/`/`scripts/` exceeds 500 lines (`node scripts/check-modularity.js`)
    - [ ] Commit: `feat(admin): Add email queue inspector page with failed-email retry`
    - [ ] Attach git note with task summary
    - [ ] Record commit SHA in plan.md

- [ ] Task: Conductor - User Manual Verification 'Phase 4: Admin Inspector UI + Retry Action' (Protocol in workflow.md)
</protect>
