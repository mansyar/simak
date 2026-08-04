# TRACK-056 — Search Bar Performance Implementation Plan

## Plan Rules

- Execute tasks in the listed order; do not begin a later task while an earlier task is incomplete.
- Before each task, change its status from `[ ]` to `[~]`.
- For every behavior change, write focused failing tests first, run the red phase, implement the minimum change, run the green phase, and then refactor only when covered.
- Complete the project's quality gates before marking a task complete.
- After each task, commit the related changes using the required commit format, attach a git note with the task summary, record the first seven characters of the commit SHA here, and commit the plan update separately.
- Keep the existing authorization, filters, ordering, pagination, i18n, accessibility behavior, and server-function split intact.
- If implementation requires a tech-stack change, stop and update `conductor/tech-stack.md` with a dated rationale before continuing.

## Phase 1: Client Search Interaction and Rendering

### 1.1 Establish regression tests for the remote-search contract

- [x] Extend `tests/unit/hooks/use-debounced-callback.test.ts` with fake-timer coverage for the 300 ms delay, last-value-wins behavior, cleanup, and immediate clear/cancel behavior required by the search inputs.
- [x] Extend the existing filter tests and add focused tests for `EmailQueueFilters` and `TemplateFilters` covering immediate visible input updates, one parent callback after 300 ms of inactivity, prop-to-local synchronization, and immediate clearing.
- [x] Add or extend route/component tests for admin users, admin templates, admin email queue, admin audit log, instructor assignments, and student assignments to verify that search changes reset the page and do not navigate once per keystroke.
- [x] Add focused tests for `FeedbackSnippetsPage` and `FeedbackSnippetPicker` covering debounced query state, stale search values, retained prior results, loading, empty, and error states.
- [x] Run the focused tests and confirm the new tests fail before implementation (red phase).
- [x] Implement the smallest client changes needed for the tests to pass (green phase), then rerun focused coverage.
- [x] Commit the completed task with a `test(...)` or `fix(...)` message, attach the task git note, and record the seven-character SHA below.

Commit SHA: b26cb61

### 1.2 Apply the consistent remote-search interaction

- [x] Update `src/components/admin/email-queue/EmailQueueFilters.tsx` and `src/components/admin/templates/TemplateFilters.tsx` to use local input state and the existing debounce pattern instead of navigating on every keystroke.
- [x] Verify and align `src/components/admin/users/UserFilters.tsx`, `src/components/instructor/assignments/AssignmentFilters.tsx`, `src/components/student/assignments/StudentAssignmentFilters.tsx`, and `src/routes/_authenticated/admin/audit-log.tsx` with the same 300 ms, immediate-clear, prop-sync, and page-reset contract.
- [x] Update the affected route loaders/navigation handlers in `src/routes/_authenticated/admin/users/index.tsx`, `src/routes/_authenticated/admin/templates/index.tsx`, `src/routes/_authenticated/admin/email-queue.tsx`, `src/routes/_authenticated/instructor/assignments/index.tsx`, and `src/routes/_authenticated/student/assignments/index.tsx` only as needed to consume committed search values and preserve existing filters.
- [x] Configure the affected TanStack Query consumers to retain the previous result while a settled search is loading where supported, without allowing an older result to replace the current key.
- [x] Run focused component and route tests, then verify the green phase and coverage before committing.
- [x] Commit the completed task, attach a git note, and record the seven-character SHA below.

Commit SHA: 4613bea

### 1.3 Optimize local picker filtering without adding requests

- [x] Add failing component tests for `src/components/instructor/assignments/StudentPicker.tsx` and `src/components/instructor/assignments/TemplatePicker.tsx` proving that typing makes no server request, preserves current fetch caps and selection behavior, and avoids repeated normalization/membership work.
- [x] Memoize normalized student/template search fields and use efficient selection membership checks while preserving card layout, select-all behavior, keyboard behavior, and empty states.
- [x] Confirm `AssignmentWizard` continues to receive the same selected IDs/template data and that no user-facing strings are hardcoded.
- [x] Run focused picker and wizard tests, then commit the completed task with a git note and record the seven-character SHA below.

Commit SHA: c7c17a9 (follow-up: 8cff4ab)

### Phase 1 Verification Checkpoint

- [x] Run the complete affected component/route test set with `pnpm vitest run` using the relevant test paths.
- [x] Run `pnpm typecheck` for the phase changes.
- [x] Manually verify that each remote input remains responsive while typing, that clearing is immediate, and that local pickers issue no per-keystroke network request.
- [x] Present the phase manual-verification steps to the user, await explicit confirmation, attach the verification report as a git note, record the checkpoint SHA in this plan, and commit the plan update.

Phase checkpoint: 51e1dbc (user-confirmed; verification note attached)

## Phase 2: Server Workload and Result Contracts

### 2.1 Bound feedback-snippet search results

- [x] Add failing server/component tests in `tests/unit/server/feedback-snippets.test.ts` and the relevant feedback-snippet component test for capped pagination, stable ordering, required filters, and a minimal list/picker projection.
- [x] Extend the schemas in `src/server/feedback-snippets.ts` with bounded page/limit inputs while preserving authorization and archived/instructor filters.
- [x] Update `src/server/feedback-snippets.server.ts` to apply a hard server-side limit, return pagination metadata, select only fields required by the list/picker, and preserve content insertion behavior without returning unrelated columns.
- [x] Update `src/lib/query-keys.ts`, `src/components/instructor/feedback-snippets/FeedbackSnippetsPage.tsx`, and `src/components/reviews/FeedbackSnippetPicker.tsx` to use committed search state, bounded results, retained previous data, and the existing loading/empty/error accessibility states.
- [x] Add any required i18n keys to both locale files, regenerate i18n types, run the focused tests, and commit with a git note and recorded SHA.

Commit SHA: c7c5ad2

### 2.2 Remove redundant template and email-queue search work

- [x] Add failing handler/component tests covering query invocation boundaries, unchanged result shape, and independent type/status summaries in `tests/unit/server/templates.test.ts`, `tests/unit/server/email-queue.test.ts`, and the related route tests.
- [x] Refactor `src/server/templates.server.ts` and `src/server/templates.ts` so unrelated type options are cached/separated from search work and required checkpoint enrichment is performed in the minimum necessary query phases without changing the template result shape.
- [x] Refactor `src/server/email-queue.server.ts` and `src/server/email-queue.ts` so the unfiltered status summary is not recomputed for every search term; preserve status filtering, pagination, and summary values in `src/routes/_authenticated/admin/email-queue.tsx`.
- [x] Update `src/routes/_authenticated/admin/templates/index.tsx` and `src/lib/query-keys.ts` as needed to give stable data independent of the committed search value its own cache boundary.
- [x] Run focused server/route tests and verify that the red/green query-workload assertions pass before committing with a git note and recorded SHA.

Commit SHA: c8fb90d

### 2.3 Preserve and correct user, assignment, and audit search handlers

- [x] Add failing non-empty-search tests to the existing users, assignments, and audit-log server test suites, including authorization, filters, pagination, ordering, enrichment, and stale/empty result behavior.
- [x] Review `src/server/users.server.ts`, `src/server/assignments.server.ts`, `src/server/assignments-extras.server.ts`, and `src/server/audit-log.server.ts` for redundant fetch layers and preserve the existing response contracts while reducing avoidable work.
- [x] Make audit-log search type-correct by explicitly searching a text representation or targeted JSON fields for `details`, while retaining entity ID matching and existing action/date/entity/actor filters.
- [x] Ensure the admin users loader and React Query consumer do not cause redundant requests for the same committed search state, while retaining the current cache freshness behavior.
- [x] Run the focused server tests and commit the completed task with a git note and recorded SHA.

Commit SHA: 1789d07

### Phase 2 Verification Checkpoint

- [x] Run all affected unit tests for server handlers, query keys, filters, routes, feedback snippets, and pickers.
- [x] Run `pnpm typecheck`, `pnpm lint`, and the relevant modularity check for changed files.
- [x] Verify representative responses preserve existing filters, authorization, ordering, pagination, empty states, and error states.
- [x] Present manual verification steps for network request counts and retained-result transitions, await explicit confirmation, attach the verification note, record the checkpoint SHA, and commit the plan update.

Phase checkpoint: 7aae157 (user-confirmed; verification note attached)

## Phase 3: PostgreSQL Trigram Search Support

### 3.1 Define migration and schema regression tests

- [x] Add failing database/schema tests for the `pg_trgm` extension and required search index names/definitions covering users, templates, email queue, assignments, feedback snippets, and audit-log entity/details text.
- [x] Verify the migration is compatible with the project's PostgreSQL 16 environment and does not alter existing data, permissions, or non-search indexes.
- [x] Commit the red-phase tests only if they form a separately useful test task; otherwise keep them with the migration task and document the red phase in the task note.

Commit SHA: 18cde2f

### 3.2 Add the reversible search-index migration

- [x] Create the next Drizzle migration and rollback under `drizzle/migrations/` to enable `pg_trgm` and add trigram support for `users.name`, `users.email`, `assignment_templates.name`, `email_queue.recipient_email`, `email_queue.subject`, `assignments.title`, `feedback_snippets.title`, `feedback_snippets.category`, `audit_log.entity_id`, and the searched text form of `audit_log.details`.
- [x] Represent index metadata in the Drizzle schema where supported; use explicit SQL for expression indexes such as JSONB-to-text search and document the reason for any schema limitation.
- [x] Add safe rollback statements for the indexes and extension, accounting for extension ownership/dependencies.
- [x] Run migration/schema tests, `pnpm db:generate` if schema declarations require generation, and the focused database tests before committing with a git note and recorded SHA.

Commit SHA: 75b42dc

### 3.3 Verify index-backed query plans

- [x] Add or extend an opt-in integration test/procedure under `tests/integration/` that runs representative `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` searches against a configured PostgreSQL database.
- [x] Verify non-empty searches for every indexed search family use the intended trigram indexes at realistic row counts and that the audit JSONB predicate is type-correct.
- [x] Record the query-plan evidence and any environment limitations in the plan and attach it to the task git note.
- [x] Commit the completed task and record the seven-character SHA below.

Commit SHA: f00f87c

### Phase 3 Verification Checkpoint

- [x] Apply the migration to a configured PostgreSQL 16 database and verify both forward migration and rollback behavior.
- [x] Run the database/schema unit tests and opt-in integration/query-plan verification.
- [x] Confirm no existing non-search indexes or application data were changed.
- [x] Present the database verification results to the user, await explicit confirmation, attach the checkpoint report as a git note, record the checkpoint SHA, and commit the plan update.

Phase checkpoint: 0dd1e38 (user-confirmed; verification note attached)

## Phase 4: Full Regression, Browser Verification, and Completion

### 4.1 Run project quality gates

- [x] Run `pnpm generate:i18n` and `pnpm check:i18n` after all locale/schema changes.
- [x] Run `pnpm typecheck`.
- [x] Run `pnpm lint`.
- [x] Run `pnpm test:coverage` and confirm the project thresholds and new-code coverage requirements are met.
- [x] Run the staged-file modularity check and confirm every changed file remains under the 500-line limit.
- [x] Run formatting with the repository's configured formatter and review the resulting diff.

Commit SHA: b11c165 (verification baseline; no source changes)

### 4.2 Verify authenticated user flows

- [x] Run the relevant Playwright tests with the configured authenticated environment, or document the exact environment blocker if the required database/auth services are unavailable.
- Evidence: authenticated Chromium coverage passed 18 relevant admin/template/user/feedback/assignment tests. The serial smoke suite reached the audit-log page and verified its heading/search placeholder, but its console-error assertion is blocked by the pre-existing ThemeScript nonce hydration mismatch (`nonce=""` in SSR versus a random client nonce); four subsequent smoke cases were not run.
- [x] In an authenticated browser session, rapidly type into every remote search surface and confirm immediate input feedback, one settled update after 300 ms, no stale result replacement, and retained prior results while loading.
- [x] Confirm clearing each search immediately resets the visible value and page to 1.
- [x] Confirm StudentPicker and TemplatePicker remain local-only, preserve selected values, and remain usable on the supported responsive layouts.
- [x] Confirm loading, empty, error, labels, keyboard/focus behavior, i18n, and authorization behavior remain intact.
- [x] Attach the manual verification report to the last functional commit after explicit user confirmation.

Commit SHA: 75b42dc (manual verification note attached)

### 4.3 Finalize the track

- [x] Resolve the conductor-review findings before finalization.
  - [x] Make the pg_trgm rollback safe when the extension is shared or pre-existing.
  - [x] Add explicit unauthorized-path coverage for independent type and email-summary handlers.
  - [x] Verify trigram plans with representative data and normal planner scan selection.
- [x] Review the complete diff against `spec.md`, including migration rollback, tests, i18n output, and query-plan evidence.
- [x] Update this plan with every completed task SHA, phase checkpoint SHA, implementation notes, and any approved deviations.
- [ ] Ensure `metadata.json` status and `updatedAt` reflect the final track state after final confirmation.
- [x] Run `conductor-review` before marking the track complete.
- [x] Confirm the active registry entry remains linked to `conductor/tracks/track-056/index.md` until review/archive.

Commit SHA: 0941085

Review outcome: no blocking correctness, security, performance, accessibility, or modularity issues remain. Review fixes in 0941085 retain a shared/pre-existing `pg_trgm` extension during rollback, add unauthorized-handler regression tests, and make query-plan fixtures transactional with representative 100,000-row data and normal planner selection. The independent `listTemplateTypes` endpoint intentionally replaces `allTypes` in `listTemplates`; all in-repository consumers were migrated to the cached endpoint, preserving the UI behavior while avoiding per-search type discovery.

Final automated verification: `pnpm test:coverage` passed 423 files and 4187 tests with 87.80% statements, 80.64% branches, 83.72% functions, and 88.59% lines. `pnpm typecheck`, i18n checks, formatting, and modularity passed. Lint passed with four pre-existing warnings in NotificationCenter and analytics-export.server.ts. The authenticated Chromium run passed 18 relevant search-route tests; the serial smoke suite remains limited by the pre-existing ThemeScript nonce hydration mismatch.

### Phase 4 Verification Checkpoint

- [ ] Confirm all acceptance criteria in `spec.md` are satisfied.
- [ ] Confirm all quality gates pass and all task/phase SHA references are recorded.
- [ ] Present the final verification summary and await explicit user confirmation before final track status/archive changes.

Phase checkpoint: _pending_

## Implementation Notes

- The expected database migration is the next migration after the current `0020` series; use the repository's migration generator/naming conventions rather than hard-coding a generated name in advance.
- No new runtime dependency is planned. PostgreSQL `pg_trgm` is an extension supplied by the existing PostgreSQL deployment.
- If query-plan verification cannot run because no representative database is available, stop before claiming completion and record the exact blocker and required command.
- The review-safe rollback intentionally retains `pg_trgm`; `CREATE EXTENSION IF NOT EXISTS` cannot prove extension ownership, so dropping it could affect other database objects.
- Query-plan integration seeds representative rows inside a transaction and deliberately rolls the transaction back after assertions, preserving the shared test database.
