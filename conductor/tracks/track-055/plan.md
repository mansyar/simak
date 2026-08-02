# Implementation Plan: TRACK-055 Student Timezone & iCalendar Support

## Source of Truth

- Specification: `conductor/tracks/track-055/spec.md`
- Roadmap: `docs/roadmap.md` (Milestone 18, TRACK-055)
- Workflow: `conductor/workflow.md`

## Implementation Constraints

- Keep client-safe server-function stubs and server-only handlers in separate files.
- Keep every file under the repository’s 500-line limit.
- Preserve authoritative stored UTC instants and existing reminder scanning.
- Validate all client-crossing inputs with Zod and preserve unrelated `users.settings` keys.
- Use transactions for multi-write token lifecycle operations; audit logging must not expose bearer credentials.
- Add English and Indonesian source keys, then regenerate i18n types rather than editing generated files.
- Maintain >80% coverage for new modules and follow the project’s unit/integration/E2E test split.

## Phase 1: Shared Timezone Contracts and Formatting

### Tasks

- [x] **1.1 Establish the integration boundary** [commit: 155aded]
  - [x] Review the current TRACK-013/053 date-display and student deadline surfaces on this branch.
  - [x] Record the explicit student deadline call sites that will change and the instructor/admin call sites that must remain unchanged.
  - [x] Confirm the canonical UTC-instant convention for `assignments.finalDeadline` and `checkpoints.dueDate` without changing stored data.
  - **Boundary notes:** Student deadline formatting is used by `StudentDashboard`, `StudentAssignmentCard`, `AssignmentDetailHeader`, and `CheckpointCard`. Consultation reminders, pending-review dates, instructor/admin surfaces, and reminder scanning remain unchanged. `assignments.finalDeadline` and `checkpoints.dueDate` are authoritative stored instants and are serialized with `toISOString()` at the dashboard boundary.

- [x] **1.2 Define timezone validation and fallback tests (RED)** [commit: 40b6ab3]
  - [x] Create `tests/unit/lib/timezone.test.ts`.
  - [x] Test valid IANA zones, `UTC`, invalid strings, missing values, and runtime zones unsupported by `Intl`.
  - [x] Test deterministic UTC fallback and preservation of a valid saved preference over browser detection.
  - **RED evidence:** The targeted test initially failed because `@/lib/timezone` did not exist; it now passes after the separate GREEN implementation task.

- [x] **1.3 Implement shared timezone contracts (GREEN)** [commit: b5c9318]
  - [x] Add a small typed timezone validator/resolver in `src/lib/` with no browser-only code in server-rendered paths.
  - [x] Extend the typed `users.settings` shape and `UpdateUserSettingsSchema` with an optional validated timezone.
  - [x] Keep invalid persisted values from affecting rendering or server-side deadline comparisons.

- [x] **1.4 Define explicit timezone formatter behavior (RED)** [commit: 8cc1516]
  - [x] Extend `tests/unit/lib/format-date.test.ts` and `tests/unit/lib/format.test.ts` with explicit-timezone cases.
  - [x] Cover locale-aware short/long/time output, DST boundary instants, UTC fallback, null values, invalid dates, and relative-time behavior.
  - [x] Add regression assertions that omitted timezone behavior remains unchanged for non-target callers.
  - **RED evidence:** The new explicit-timezone assertions failed against the existing local-time-only formatter before the GREEN implementation.

- [x] **1.5 Implement timezone-aware formatting (GREEN)** [commit: 82f72df]
  - [x] Extend the shared date formatting boundary with an optional explicit IANA timezone.
  - [x] Ensure the formatter passes `timeZone` to `Intl`/date-fns-compatible formatting without mutating the `Date` or ISO instant.
  - [x] Keep the implementation locale-aware for English and Indonesian.

### Phase Verification

- [x] Run targeted timezone and formatter tests with `pnpm vitest run tests/unit/lib/timezone.test.ts tests/unit/lib/format-date.test.ts tests/unit/lib/format.test.ts`.
- [x] Confirm the new pure modules meet the project coverage target before proceeding.
- **Checkpoint:** [commit: 82f72df]. Automated verification passed 45 tests; targeted module coverage was above 80% for all new/changed formatter and timezone modules. The scoped coverage command's global threshold failure is deferred to the full-suite gate because it intentionally selected only three test files. Manual checkpoint confirmation was received before proceeding.

## Phase 2: Settings Persistence and Student Deadline Surfaces

### Tasks

- [x] **2.1 Add settings-handler tests (RED)** [commit: eae8641]
  - [x] Add a companion `tests/unit/server/settings-timezone.test.ts` because `settings.test.ts` is already at the 500-line limit; cover timezone validation, authenticated updates, UTC fallback, and read-modify-write preservation of reduced-motion and notification settings.
  - [x] Test unauthorized access and malformed timezone input at the server-function boundary.
  - [x] Test that stored settings do not alter deadline values or reminder preferences.
  - **RED evidence:** The invalid persisted-timezone normalization assertion failed before the settings handler implementation changed.

- [x] **2.2 Implement timezone settings persistence (GREEN)** [commit: 2772e37]
  - [x] Update `src/server/settings.ts` and `src/server/settings.server.ts` using the existing typed server-function pair.
  - [x] Preserve all existing settings fields when saving timezone changes.
  - [x] Return the normalized settings shape needed by the student settings UI.

- [x] **2.3 Add timezone settings component tests (RED)** [commit: dbe4701]
  - [x] Create a settings component test for hydration-safe placeholder rendering before browser detection.
  - [x] Test detected timezone persistence, manual IANA override, invalid selection feedback, UTC fallback, loading, save success, and save failure states.
  - [x] Test accessible labels, keyboard selection, focus behavior, and English/Indonesian key usage.
  - **RED evidence:** The test suite initially failed because the focused timezone settings component did not yet exist.

- [x] **2.4 Implement the timezone preference UI (GREEN)**
  - [x] Add a focused component under `src/components/settings/` and wire it into `SettingsPage` for the student settings route.
  - [x] Detect the browser timezone only after hydration and avoid SSR/client text mismatches.
  - [x] Provide a manual valid-IANA selection, a clear UTC fallback, and accessible status/error messaging.
  - [x] Add the required keys to `locales/en.json` and `locales/id.json`; regenerate i18n types.

- [x] **2.5 Add deadline-surface regression tests (RED)** [commit: d3ce94b]
  - [x] Extend `tests/unit/components/dashboard/student-dashboard.test.tsx` for explicit timezone rendering, DST transitions, placeholders, relative time, overdue state, and null deadlines.
  - [x] Add or extend a checkpoint-card test for student assignment/checkpoint deadline formatting and overdue behavior.
  - [x] Assert that pending-review, consultation, instructor, and admin date surfaces are not unintentionally changed.
  - **RED evidence:** The focused suite showed dashboard/checkpoint formatters still received no timezone and assignment deadline headers/cards still used date-fns directly.

- [x] **2.6 Apply timezone formatting to target surfaces (GREEN)** [commit: 90ed3ae]
  - [x] Update `src/components/dashboard/StudentDashboard.tsx` and student assignment/checkpoint deadline components to consume the resolved student timezone.
  - [x] Keep existing effective-deadline, relative-time, badge, and authorization behavior unchanged.
  - [x] Do not change the reminder scanner or server-side deadline calculations.

### Phase Verification

- [x] Run settings and student-surface tests with `pnpm vitest run tests/unit/server/settings.test.ts tests/unit/components/settings tests/unit/components/dashboard/student-dashboard.test.tsx`.
  - **Evidence:** 11 files and 143 tests passed.
- [x] Run `pnpm check:i18n` and verify both locale files have matching new keys.
  - **Evidence:** 917 used keys are present in both locale files.
- [x] Perform a manual SSR/hydration check in a browser with a DST-observing timezone and with browser timezone access unavailable.
  - **Checkpoint:** functional commit `90ed3ae`; automated verification passed with 143 tests and i18n parity; user confirmed the browser checks for hydration, DST-aware rendering, manual override/validation, UTC fallback, and unchanged non-student surfaces.

## Phase 3: Calendar Token Schema and Authenticated Lifecycle

### Tasks

- [x] **3.1 Define token lifecycle behavior tests (RED)** [commit: 5424dea]
  - [x] Create `tests/unit/server/calendar-feed.test.ts` covering enable, status, regenerate, and revoke operations.
  - [x] Test high-entropy opaque token generation, one-way hash persistence, and absence of plaintext in return-side logs/audit details.
  - [x] Test ownership, student-role authorization, inactive/deleted users, regeneration invalidation, revocation, and one-active-token behavior.
  - [x] Add database-backed integration cases for concurrent lifecycle requests and the database uniqueness invariant.
  - **RED evidence:** The unit suite initially failed because `src/server/calendar-feed.server.ts` did not yet exist; the integration case also references the not-yet-defined token table.

- [x] **3.2 Add the token schema and migration (GREEN)** [commit: 6ce7efb]
  - [x] Add a dedicated token table to `src/db/schema/` with student ownership, token hash, lifecycle timestamps, and appropriate foreign-key/index constraints.
  - [x] Enforce at most one active token per student at the database level.
  - [x] Register the schema in `src/db/schema/index.ts` and generate the next Drizzle migration.
  - [x] Add the required companion rollback SQL under `drizzle/migrations/rollback/` and verify it follows the SQL style guide.
  - **Evidence:** `pnpm db:generate` produced migration `0020_white_spacker_dave.sql`; the schema and rollback passed targeted oxlint and `git diff --check`.

- [x] **3.3 Implement authenticated token handlers (GREEN)** [commit: a6e0b65]
  - [x] Add a client-safe `src/server/calendar-feed.ts` stub/schema file and a server-only handler file, splitting helpers if the 500-line limit requires it.
  - [x] Implement explicit enablement, status retrieval, regeneration, and revocation with transaction-safe writes.
  - [x] Hash tokens before persistence and return plaintext only on the enable/regenerate response needed to construct the URL.
  - [x] Use the existing audit helper after successful commits, recording lifecycle actions without sensitive token data.
  - [x] Apply an appropriate authenticated mutation/read rate limit to the handlers.
  - **Evidence:** 7 lifecycle unit tests passed; `pnpm typecheck` and targeted oxlint passed with zero errors. Bearer plaintext is generated only in the response URL, while persisted values and audit details contain only the SHA-256 hash/metadata.

- [x] **3.4 Add lifecycle integration tests (RED/GREEN)** [commit: 58cf555]
  - [x] Verify the full handler-to-database flow for enable, regenerate, revoke, and old-token invalidation.
  - [x] Verify unrelated settings and audit records remain correct when lifecycle operations succeed or fail.
  - **Evidence:** Both calendar lifecycle integration tests passed against the development database after applying migration 0020 directly; the migration runner remains blocked by the repository's pre-existing migration-ledger inconsistency.

### Phase Verification

- [x] Run server lifecycle tests with `pnpm vitest run tests/unit/server/calendar-feed.test.ts`.
  - **Evidence:** 1 file and 7 tests passed.
- [x] Run the forward migration, validate the token constraints, execute the companion rollback in a disposable development database, and re-apply the migration.
  - **Evidence:** The disposable `simak-postgres-test` database reported 4 indexes and 3 constraints after forward application, reported the table absent after rollback, and reported the table/indexes restored after re-application. The repository `pnpm db:migrate` command remains blocked by its pre-existing migration-ledger inconsistency, so the SQL was applied directly for this verification.
- [x] Confirm no test output, audit row, or application log contains a plaintext token.
  - **Evidence:** Unit assertions found no plaintext in audit calls; the real-database lifecycle test found no plaintext in audit rows.
  - **Checkpoint:** functional commit `a6e0b65`; user confirmed backend manual verification of hash-only storage, token rotation/revocation, audit/log redaction, and the migration-ledger caveat.

## Phase 4: Calendar Event Selection and RFC 5545 Serialization

### Tasks

- [x] **4.1 Define feed-selection tests (RED)**
  - [x] Create focused tests for student ownership and active-assignment filtering.
  - [x] Cover non-passed checkpoints with due dates, locked future checkpoints, overdue checkpoints, passed checkpoints, null due dates, and inactive assignments.
  - [x] Cover assignment final-deadline inclusion only when the assignment is active and has at least one non-passed checkpoint.
  - [x] Test stable UIDs across refreshes and changed due dates, including removal after a checkpoint passes.
  - **RED evidence:** The focused suite failed before execution because `src/server/calendar-feed-selection.server.ts` did not yet exist.

- [x] **4.2 Implement authoritative feed selection (GREEN)**
  - [x] Add a server-only query/helper that joins assignment ownership and checkpoint data without exposing other students’ records.
  - [x] Compare checkpoint state and assignment activity using authoritative database values.
  - [x] Return event data with canonical UTC instants and deterministic event identity inputs.
  - **Evidence:** 4 focused selection tests passed; `pnpm typecheck` and targeted oxlint passed. The query restricts by student-owned checkpoints, active assignments, non-passed state, and non-null due date; final events are derived only from qualifying rows.
  - **Commit:** `18d11dec`

- [x] **4.3 Define iCalendar serialization tests (RED)**
  - [x] Create `tests/unit/lib/calendar-ics.test.ts` for VCALENDAR/VEVENT structure and `text/calendar` output.
  - [x] Test UTC timed timestamps, stable UIDs, DTSTAMP, escaped assignment/checkpoint text, CRLF line endings, safe line folding, Unicode, quotes, commas, semicolons, and backslashes.
  - [x] Test empty feeds and feeds containing overdue or locked events.
  - **RED evidence:** The focused suite failed before execution because `src/lib/calendar-ics.ts` did not yet exist.

- [x] **4.4 Implement the RFC 5545 serializer (GREEN)**
  - [x] Add a small pure serializer module under `src/lib/` or a handler-only server helper with a typed event model.
  - [x] Emit valid UTC timed events independent of the student display timezone.
  - [x] Keep event identity stable and update event timestamps when source deadlines change.
  - [x] Ensure no token or internal-sensitive data is serialized.
  - **Evidence:** 3 serializer tests passed; UTC timestamps, stable UIDs, CRLF output, RFC 5545 escaping, UTF-8-safe line folding, Unicode, empty feeds, and overdue/locked events are covered. `pnpm typecheck` and targeted oxlint passed.
  - **Commit:** `78230e25`

### Phase Verification

- [ ] Run selection and serializer tests with `pnpm vitest run tests/unit/lib/calendar-ics.test.ts tests/unit/server/calendar-feed-selection.test.ts`.
- [ ] Validate generated feeds with an RFC 5545-aware parser or calendar-client fixture and inspect line endings and escaped values.

## Phase 5: Bearer-Protected Route and Feed Management UI

### Tasks

- [ ] **5.1 Define route security tests (RED)**
  - [ ] Add route/integration tests for missing, malformed, unknown, revoked, and valid bearer credentials.
  - [ ] Assert generic unauthorized responses, no account/assignment enumeration, student ownership isolation, and inactive-user handling.
  - [ ] Assert `text/calendar`, private/no-store cache behavior, safe referrer policy, and rate-limit responses.
  - [ ] Assert valid requests return only the selected events and reflect later state/deadline changes.

- [ ] **5.2 Implement the calendar route (GREEN)**
  - [ ] Add a stable route-level GET endpoint under `src/routes/api/` using the project’s TanStack route-handler pattern.
  - [ ] Extract the bearer credential, hash/lookup it, enforce token activity and student ownership, then call the selection and serializer helpers.
  - [ ] Add a credential-authenticated rate-limit key that does not require a browser session.
  - [ ] Set safe response headers and ensure credentials are never included in logs or error bodies.

- [ ] **5.3 Define feed-management UI tests (RED)**
  - [ ] Create component tests for disabled, enabled, loading, success, empty, failure, regeneration-confirmation, and revoked states.
  - [ ] Test copyable subscription URL behavior without exposing the token beyond the URL response and without hardcoded UI strings.
  - [ ] Test keyboard operation, focus/confirmation behavior, live status messaging, responsive layout, and both locales.

- [ ] **5.4 Implement feed-management UI (GREEN)**
  - [ ] Add a focused calendar-feed settings component and wire it into the student settings page only.
  - [ ] Provide explicit enable, copy URL, regenerate, and revoke/disable controls with confirmations for destructive actions.
  - [ ] Invalidate/refetch settings/feed status after mutations and handle clipboard or network failures accessibly.
  - [ ] Add matching English/Indonesian translations and regenerate i18n types.

### Phase Verification

- [ ] Run route and component tests with `pnpm test:integration` plus the targeted Vitest files for the route and settings components.
- [ ] Manually subscribe a test calendar client or inspect a downloaded feed, then regenerate and revoke the token and confirm the old URL fails generically.
- [ ] Confirm response headers and logs do not disclose the bearer credential.

## Phase 6: End-to-End Accessibility and Quality Gates

### Tasks

- [ ] **6.1 Add end-to-end flow tests (RED/GREEN)**
  - [ ] Add `tests/e2e/student-timezone-calendar.spec.ts` for student timezone detection/override, deadline display, feed enablement, URL copy, regeneration, and revocation.
  - [ ] Cover a DST-sensitive deadline fixture and verify the feed remains UTC while the UI uses the selected display timezone.
  - [ ] Verify non-student routes and existing reminder behavior remain unaffected.

- [ ] **6.2 Add accessibility and responsive coverage**
  - [ ] Run axe-core coverage for the new settings sections and relevant student deadline surfaces.
  - [ ] Verify keyboard-only operation, focus visibility, live announcements, color-independent status, mobile touch targets, and light/dark themes.

- [ ] **6.3 Complete localization and generated artifacts**
  - [ ] Run `pnpm generate:i18n` and `pnpm check:i18n`.
  - [ ] Run the unused-key check and remove or correct any new unused/mismatched keys.
  - [ ] Confirm no generated i18n file was edited manually.

- [ ] **6.4 Run final quality gates**
  - [ ] Run `pnpm format` and review the resulting diff for unrelated changes.
  - [ ] Run `pnpm lint`.
  - [ ] Run `pnpm typecheck`.
  - [ ] Run `pnpm test:coverage` and confirm new code remains above 80% lines, functions, branches, and statements.
  - [ ] Run `pnpm build`.
  - [ ] Review the final diff for secrets, plaintext tokens, hardcoded UI strings, unsafe headers, and files over 500 lines.

- [ ] **6.5 Complete manual verification and documentation**
  - [ ] Document the stable feed URL, token lifecycle behavior, UTC storage invariant, and operational/security considerations in implementation notes if required.
  - [ ] Execute the workflow’s frontend and backend manual verification steps against the development server.
  - [ ] Record user confirmation for the final phase checkpoint before attaching the verification git note.

### Phase Verification

- [ ] Attach the automated test commands, manual verification steps, and user confirmation to the final functional commit using a git note.
- [ ] Record the final phase checkpoint SHA in this plan and commit the plan update according to `conductor/workflow.md`.

## Definition of Done

- [ ] Approved specification is implemented without expanding the out-of-scope boundary.
- [ ] All TDD red/green tasks and phase checkpoints are complete.
- [ ] Database migration and tested companion rollback are committed.
- [ ] English and Indonesian UI is accessible and responsive.
- [ ] Unit, integration, E2E, accessibility, typecheck, lint, coverage, i18n, and build gates pass.
- [ ] Task summaries and phase verification reports are attached with git notes.
- [ ] Completed task and phase commit SHAs are recorded in this plan.
