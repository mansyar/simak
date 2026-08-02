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

- [x] **2.1 Add settings-handler tests (RED)**
  - [x] Add a companion `tests/unit/server/settings-timezone.test.ts` because `settings.test.ts` is already at the 500-line limit; cover timezone validation, authenticated updates, UTC fallback, and read-modify-write preservation of reduced-motion and notification settings.
  - [x] Test unauthorized access and malformed timezone input at the server-function boundary.
  - [x] Test that stored settings do not alter deadline values or reminder preferences.
  - **RED evidence:** The invalid persisted-timezone normalization assertion failed before the settings handler implementation changed.

- [ ] **2.2 Implement timezone settings persistence (GREEN)**
  - [ ] Update `src/server/settings.ts` and `src/server/settings.server.ts` using the existing typed server-function pair.
  - [ ] Preserve all existing settings fields when saving timezone changes.
  - [ ] Return the normalized settings shape needed by the student settings UI.

- [ ] **2.3 Add timezone settings component tests (RED)**
  - [ ] Create a settings component test for hydration-safe placeholder rendering before browser detection.
  - [ ] Test detected timezone persistence, manual IANA override, invalid selection feedback, UTC fallback, loading, save success, and save failure states.
  - [ ] Test accessible labels, keyboard selection, focus behavior, and English/Indonesian key usage.

- [ ] **2.4 Implement the timezone preference UI (GREEN)**
  - [ ] Add a focused component under `src/components/settings/` and wire it into `SettingsPage` for the student settings route.
  - [ ] Detect the browser timezone only after hydration and avoid SSR/client text mismatches.
  - [ ] Provide a manual valid-IANA selection, a clear UTC fallback, and accessible status/error messaging.
  - [ ] Add the required keys to `locales/en.json` and `locales/id.json`; regenerate i18n types.

- [ ] **2.5 Add deadline-surface regression tests (RED)**
  - [ ] Extend `tests/unit/components/dashboard/student-dashboard.test.tsx` for explicit timezone rendering, DST transitions, placeholders, relative time, overdue state, and null deadlines.
  - [ ] Add or extend a checkpoint-card test for student assignment/checkpoint deadline formatting and overdue behavior.
  - [ ] Assert that pending-review, consultation, instructor, and admin date surfaces are not unintentionally changed.

- [ ] **2.6 Apply timezone formatting to target surfaces (GREEN)**
  - [ ] Update `src/components/dashboard/StudentDashboard.tsx` and student assignment/checkpoint deadline components to consume the resolved student timezone.
  - [ ] Keep existing effective-deadline, relative-time, badge, and authorization behavior unchanged.
  - [ ] Do not change the reminder scanner or server-side deadline calculations.

### Phase Verification

- [ ] Run settings and student-surface tests with `pnpm vitest run tests/unit/server/settings.test.ts tests/unit/components/settings tests/unit/components/dashboard/student-dashboard.test.tsx`.
- [ ] Run `pnpm check:i18n` and verify both locale files have matching new keys.
- [ ] Perform a manual SSR/hydration check in a browser with a DST-observing timezone and with browser timezone access unavailable.

## Phase 3: Calendar Token Schema and Authenticated Lifecycle

### Tasks

- [ ] **3.1 Define token lifecycle behavior tests (RED)**
  - [ ] Create `tests/unit/server/calendar-feed.test.ts` covering enable, status, regenerate, and revoke operations.
  - [ ] Test high-entropy opaque token generation, one-way hash persistence, and absence of plaintext in return-side logs/audit details.
  - [ ] Test ownership, student-role authorization, inactive/deleted users, regeneration invalidation, revocation, and one-active-token behavior.
  - [ ] Add database-backed integration cases for concurrent lifecycle requests and the database uniqueness invariant.

- [ ] **3.2 Add the token schema and migration (GREEN)**
  - [ ] Add a dedicated token table to `src/db/schema/` with student ownership, token hash, lifecycle timestamps, and appropriate foreign-key/index constraints.
  - [ ] Enforce at most one active token per student at the database level.
  - [ ] Register the schema in `src/db/schema/index.ts` and generate the next Drizzle migration.
  - [ ] Add the required companion rollback SQL under `drizzle/migrations/rollback/` and verify it follows the SQL style guide.

- [ ] **3.3 Implement authenticated token handlers (GREEN)**
  - [ ] Add a client-safe `src/server/calendar-feed.ts` stub/schema file and a server-only handler file, splitting helpers if the 500-line limit requires it.
  - [ ] Implement explicit enablement, status retrieval, regeneration, and revocation with transaction-safe writes.
  - [ ] Hash tokens before persistence and return plaintext only on the enable/regenerate response needed to construct the URL.
  - [ ] Use the existing audit helper after successful commits, recording lifecycle actions without sensitive token data.
  - [ ] Apply an appropriate authenticated mutation/read rate limit to the handlers.

- [ ] **3.4 Add lifecycle integration tests (RED/GREEN)**
  - [ ] Verify the full handler-to-database flow for enable, regenerate, revoke, and old-token invalidation.
  - [ ] Verify unrelated settings and audit records remain correct when lifecycle operations succeed or fail.

### Phase Verification

- [ ] Run server lifecycle tests with `pnpm vitest run tests/unit/server/calendar-feed.test.ts`.
- [ ] Run the forward migration, validate the token constraints, execute the companion rollback in a disposable development database, and re-apply the migration.
- [ ] Confirm no test output, audit row, or application log contains a plaintext token.

## Phase 4: Calendar Event Selection and RFC 5545 Serialization

### Tasks

- [ ] **4.1 Define feed-selection tests (RED)**
  - [ ] Create focused tests for student ownership and active-assignment filtering.
  - [ ] Cover non-passed checkpoints with due dates, locked future checkpoints, overdue checkpoints, passed checkpoints, null due dates, and inactive assignments.
  - [ ] Cover assignment final-deadline inclusion only when the assignment is active and has at least one non-passed checkpoint.
  - [ ] Test stable UIDs across refreshes and changed due dates, including removal after a checkpoint passes.

- [ ] **4.2 Implement authoritative feed selection (GREEN)**
  - [ ] Add a server-only query/helper that joins assignment ownership and checkpoint data without exposing other students’ records.
  - [ ] Compare checkpoint state and assignment activity using authoritative database values.
  - [ ] Return event data with canonical UTC instants and deterministic event identity inputs.

- [ ] **4.3 Define iCalendar serialization tests (RED)**
  - [ ] Create `tests/unit/lib/calendar-ics.test.ts` for VCALENDAR/VEVENT structure and `text/calendar` output.
  - [ ] Test UTC timed timestamps, stable UIDs, DTSTAMP, escaped assignment/checkpoint text, CRLF line endings, safe line folding, Unicode, quotes, commas, semicolons, and backslashes.
  - [ ] Test empty feeds and feeds containing overdue or locked events.

- [ ] **4.4 Implement the RFC 5545 serializer (GREEN)**
  - [ ] Add a small pure serializer module under `src/lib/` or a handler-only server helper with a typed event model.
  - [ ] Emit valid UTC timed events independent of the student display timezone.
  - [ ] Keep event identity stable and update event timestamps when source deadlines change.
  - [ ] Ensure no token or internal-sensitive data is serialized.

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
