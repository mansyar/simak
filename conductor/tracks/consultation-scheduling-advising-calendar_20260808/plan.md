# Implementation Plan: TRACK-058 — Consultation Scheduling & Advising Calendar

## Source of Truth

- Specification: `conductor/tracks/consultation-scheduling-advising-calendar_20260808/spec.md`
- Roadmap: `docs/roadmap.md` (Milestone 20, TRACK-058)
- Workflow: `conductor/workflow.md`

## Implementation Constraints

- Follow TDD strictly: RED test first, confirm failure, GREEN implementation, then optional refactor and retest.
- Keep appointment scheduling separate from `consultations` evidence and verified-count gating.
- Use UTC database instants and existing IANA timezone utilities.
- Use the client-safe/server-only split with `typedServerFn`; no direct client import of handlers.
- Keep every source/test file under 500 lines.
- Use transactions and row locks for booking, rescheduling, and lifecycle transitions.
- Add migration and manually tested companion rollback.
- Add English and Indonesian keys through locale source files, then regenerate i18n types.
- Commit each completed task and attach a git note; record the SHA in this plan.
- At every phase checkpoint: run automated verification, present manual verification steps, wait for user confirmation, attach the verification git note, and create a checkpoint commit.

## Phase 1: Appointment contracts and persistence

- [x] **Task 1.1: Confirm implementation boundaries and extension points**
  - [x] Reconfirm current assignment ownership/enrollment helpers, consultation routes/components, calendar-feed selector/serializer, email queue scanner, and notification preference APIs.
  - [x] Confirm the final schema/file split before coding and record any deviation in the plan.
  - [x] Confirm no existing appointment table or status enum conflicts with the proposed domain.
  - **Implementation notes:** No appointment table or status enum exists. Add `src/db/schema/appointments.ts`, re-export it from `src/db/schema/index.ts`, and add its Drizzle relations there. Use `src/server/appointments.ts` for client-safe Zod/server-function stubs and `src/server/appointments.server.ts` for handlers, with an extras handler only if the file limit requires it. Reuse `verifyAssignmentAccess` plus explicit optional-checkpoint validation. Extend `calendar-feed-selection.server.ts` and the existing ICS serializer without changing deadline events. Add appointment reminder scanning at the existing `email-queue-init.ts` boundary; keep deadline reminder behavior independent.
  - **Deviation:** None from the approved specification.
  - **Completion commit:** `24355e70` (`chore(track-058): confirm task 1.1 boundaries`)

- [x] **Task 1.2: Define appointment schema and migration (RED → GREEN)**
  - [x] Write schema/integration tests for assignment and optional checkpoint foreign keys, nullable student before booking, UTC timestamps, valid status values, 15–120 minute duration, indexes, and state-preserving cancellation.
  - [x] Confirm the RED tests fail against the current schema.
  - **RED evidence:** `pnpm vitest run tests/unit/db/appointments.test.ts` failed during Vite import analysis because `@/db/schema/appointments` does not exist; no assertions ran.
  - [x] Add the Drizzle appointment schema with database constraints and participant/time indexes.
  - [x] Generate the forward migration and add the required companion rollback SQL.
  - [x] Apply, inspect, roll back, and re-apply the migration in the development database.
  - [x] Run the schema-focused tests.
  - **GREEN evidence:** `pnpm vitest run tests/unit/db/appointments.test.ts` passed 5/5 and `pnpm typecheck` passed after correcting Drizzle test introspection types.
  - **Implementation notes:** Added `src/db/schema/appointments.ts`, schema exports/relations, generated `drizzle/migrations/0024_powerful_clint_barton.sql`, and companion rollback `drizzle/migrations/rollback/0024_powerful_clint_barton.rollback.sql`. Appointment instants use PostgreSQL `timestamp with time zone`; the database enforces ordering and a 15–120 minute duration.
  - **Migration verification:** `pnpm db:migrate` could not be used because the local database has the existing 23 application tables but an empty `drizzle.__drizzle_migrations` history, causing Drizzle to replay older migrations. Direct execution of migration `0024` succeeded; inspection confirmed all columns, checks, and indexes; the companion rollback removed `appointments`; re-applying `0024` restored it.
  - **Completion commits:** `048e4745` (schema, migration, rollback, and tests), `2bb4b6ea` (Drizzle migration journal and snapshot).

- [x] **Task 1.3: Define pure appointment policies (RED → GREEN)**
  - [x] Write unit tests for duration validation, future-time validation, valid/invalid lifecycle transitions, overlap detection, and timezone-safe display conversion.
  - [x] Confirm RED behavior.
  - **RED evidence:** `pnpm vitest run tests/unit/lib/appointment-policies.test.ts` failed during Vite import analysis because `@/lib/appointment-policies` does not exist; no assertions ran.
  - [x] Implement dependency-light policy helpers and shared Zod contracts.
  - [x] Verify boundary cases, including DST transitions and cancelled appointments excluded from conflicts.
  - **GREEN evidence:** `pnpm vitest run tests/unit/lib/appointment-policies.test.ts` passed 8/8 and `pnpm typecheck` passed.
  - **Implementation notes:** Added `src/lib/appointment-policies.ts` with shared status/window Zod schemas, bounded window validation, lifecycle transition guards, half-open overlap checks that ignore cancelled appointments, and `Intl`-based timezone display using `resolveTimeZone`.
  - **Completion commit:** `2eaa7957` (`feat(track-058): add appointment policy contracts`).

- [x] **Phase 1 Verification & Checkpoint**
  - [x] Run focused schema/policy tests and migration verification.
  - [x] Run typecheck and lint for changed foundation files.
  - [x] Manually verify migration apply/rollback/re-apply and inspect the resulting constraints/indexes.
  - **Automated evidence:** Focused schema/policy suites passed 13/13; `pnpm typecheck` passed; targeted `oxlint` passed with 0 warnings and 0 errors; `git diff --check` passed.
  - **Database evidence:** Direct migration execution applied `0024`, inspection confirmed `timestamp with time zone` instants, nullable checkpoint/student fields, two checks, and four indexes; rollback removed the table; re-apply restored it. `pnpm db:migrate` remains blocked by the pre-existing empty local Drizzle migration history and is documented under Task 1.2.
  - [x] Obtain explicit user confirmation, attach the verification note, update the checkpoint SHA, and commit the plan update.
  - **User confirmation:** Confirmed checkpoint verification through the interactive Conductor prompt.
  - **Verification note:** Phase 1 foundation contracts are accepted. Appointment persistence is isolated from consultation evidence/gating; migration constraints and rollback were directly verified.
  - **Checkpoint commit:** `cf376288` (`docs(track-058): checkpoint phase 1 appointment contracts`).

## Phase 2: Instructor slot management

- [ ] **Task 2.1: Add client-safe server-function contracts (RED → GREEN)**
  - [ ] Write tests for input validation and the standard `typedServerFn` builder behavior.
  - [ ] Confirm RED behavior.
  - [ ] Add the appointment stub module with schemas and dynamic imports; keep handlers server-only.
  - [ ] Keep related handlers split into an extras server file if the 500-line limit requires it.

- [ ] **Task 2.2: Create and list instructor slots (RED → GREEN)**
  - [ ] Write handler tests for instructor role, assignment ownership/section authorization, active assignment requirement, checkpoint ownership, future time, duration, and bounded result ordering.
  - [ ] Add tests proving students, unrelated instructors, admins, and inactive users cannot access the instructor slot mutation.
  - [ ] Confirm RED behavior.
  - [ ] Implement create/list handlers with server-side authorization, explicit selected columns, pagination/bounds, and audit events.
  - [ ] Run focused handler tests and coverage.

- [ ] **Task 2.3: Cancel unbooked slots (RED → GREEN)**
  - [ ] Write tests for valid cancellation, invalid past/status transitions, idempotency behavior, authorization, and audit payload redaction.
  - [ ] Confirm RED behavior.
  - [ ] Implement transactional state transition and post-commit advisory behavior.
  - [ ] Verify cancelled slots no longer appear as bookable or conflict-reserving.

- [ ] **Phase 2 Verification & Checkpoint**
  - [ ] Run focused server tests, typecheck, and lint.
  - [ ] Manually create an instructor slot, inspect its status, list it, and cancel it through the UI/API.
  - [ ] Verify an unauthorized user receives a generic response and cannot enumerate assignment/slot existence.
  - [ ] Obtain confirmation, attach the verification note, record the checkpoint SHA, and commit the plan update.

## Phase 3: Student booking and appointment lifecycle

- [ ] **Task 3.1: Direct booking with race-safe conflict checks (RED → GREEN)**
  - [ ] Write integration tests for eligible student booking, ineligible student rejection, single-winner concurrent booking, instructor overlap, student overlap, and cancelled-slot reuse.
  - [ ] Confirm RED behavior.
  - [ ] Implement transactional slot locking, participant conflict checks, assignment/checkpoint validation, and `available → booked` transition.
  - [ ] Verify the original slot remains unchanged on rejected races/conflicts.

- [ ] **Task 3.2: Cancellation and rescheduling (RED → GREEN)**
  - [ ] Write tests for student/instructor cancellation, future-only rules, selecting another available slot, instructor time changes, target-slot locking, conflict rejection, and preservation of the original appointment on failure.
  - [ ] Confirm RED behavior.
  - [ ] Implement transactional cancellation/rescheduling with stable appointment identity and audit before/after times.
  - [ ] Add preference-aware participant notifications after successful commit.

- [ ] **Task 3.3: Completion, no-show, and explicit evidence action (RED → GREEN)**
  - [ ] Write tests for instructor-only completion/no-show, post-end timing, invalid transitions, and appointment-to-consultation form linkage.
  - [ ] Add a regression test proving completion does not insert a consultation or alter verified counts.
  - [ ] Confirm RED behavior.
  - [ ] Implement lifecycle transitions and an explicit action that opens/prefills the existing consultation evidence flow without auto-verification.
  - [ ] Verify existing consultation verification and gating tests remain green.

- [ ] **Task 3.4: Transaction and authorization integration coverage**
  - [ ] Add database-backed tests for concurrent booking/rescheduling and stale transition handling.
  - [ ] Add privacy tests for soft-cancelled appointments, deleted/inactive users, and cross-assignment access.
  - [ ] Run integration coverage for all appointment mutations.

- [ ] **Phase 3 Verification & Checkpoint**
  - [ ] Run focused unit/integration appointment suites and typecheck.
  - [ ] Manually execute publish → book → reschedule → cancel, plus complete → explicitly record consultation → verify.
  - [ ] Confirm verified consultation counts change only after the existing verification action.
  - [ ] Obtain confirmation, attach the verification note, record the checkpoint SHA, and commit the plan update.

## Phase 4: Notifications and reminders

- [ ] **Task 4.1: Add bilingual appointment notification contracts (RED → GREEN)**
  - [ ] Write tests for notification keys, English/Indonesian parity, participant targeting, and privacy-safe content.
  - [ ] Confirm RED behavior.
  - [ ] Add locale source keys and notification template/type mappings; regenerate i18n types.
  - [ ] Verify `pnpm check:i18n`.

- [ ] **Task 4.2: Booking/lifecycle notification delivery (RED → GREEN)**
  - [ ] Write tests for booking, cancellation, rescheduling, completion/no-show notifications and preference suppression.
  - [ ] Confirm RED behavior.
  - [ ] Implement post-commit in-app notification creation and email queue enqueueing.
  - [ ] Ensure notification/email failure cannot roll back a committed appointment mutation.

- [ ] **Task 4.3: 24-hour and 1-hour reminder scanner (RED → GREEN)**
  - [ ] Write tests for both reminder windows, UTC comparisons, timezone-independent trigger behavior, repeated scans, boundary times, cancelled appointments, and completed/no-show appointments.
  - [ ] Confirm RED behavior.
  - [ ] Implement the scanner using the existing background processor boundary and a durable deduplication mechanism.
  - [ ] Verify failures are logged and isolated from email queue processing.

- [ ] **Phase 4 Verification & Checkpoint**
  - [ ] Run focused notification/reminder tests, i18n parity, and typecheck.
  - [ ] Manually book a future appointment and verify participant notifications plus at-most-once reminder behavior using test fixtures.
  - [ ] Confirm disabled email/in-app preferences are respected.
  - [ ] Obtain confirmation, attach the verification note, record the checkpoint SHA, and commit the plan update.

## Phase 5: Private iCalendar extension

- [ ] **Task 5.1: Appointment event selection (RED → GREEN)**
  - [ ] Write selector tests for student ownership, booked-only status, future events, active assignment authorization, cancelled omission, optional checkpoint labels, and unrelated-student isolation.
  - [ ] Confirm RED behavior.
  - [ ] Extend the existing calendar-feed selection helper without changing deadline event semantics.
  - [ ] Verify token-owner checks remain in the route boundary.

- [ ] **Task 5.2: Stable appointment serialization (RED → GREEN)**
  - [ ] Write serializer tests for stable appointment UID, UTC `DTSTART`/`DTEND`, rescheduling with unchanged UID, RFC 5545 escaping/folding, and safe titles.
  - [ ] Confirm RED behavior.
  - [ ] Implement appointment event serialization using the existing feed conventions.
  - [ ] Preserve existing cache, content-type, rate-limit, and credential secrecy behavior.

- [ ] **Task 5.3: Calendar route regression/security coverage**
  - [ ] Extend route tests for valid/invalid/revoked credentials, generic unauthorized responses, no enumeration, and mixed deadline/appointment feeds.
  - [ ] Confirm the regression tests pass without weakening existing feed security.
  - [ ] Run the focused calendar suite and relevant integration tests.

- [ ] **Phase 5 Verification & Checkpoint**
  - [ ] Run calendar selector/serializer/route tests, typecheck, and lint.
  - [ ] Manually subscribe a test student calendar, confirm a booked appointment appears, reschedule it, and confirm the same UID updates.
  - [ ] Cancel the appointment and confirm it is absent after refresh; confirm existing deadline events remain intact.
  - [ ] Obtain confirmation, attach the verification note, record the checkpoint SHA, and commit the plan update.

## Phase 6: Student appointment experience

- [ ] **Task 6.1: Student UI tests (RED)**
  - [ ] Add component/route tests for available slots, timezone display, booking, conflict feedback, booked appointment details, cancellation, rescheduling, completed/no-show states, and empty/error/loading states.
  - [ ] Add tests for the explicit consultation evidence action.
  - [ ] Confirm RED behavior.

- [ ] **Task 6.2: Student booking and management UI (GREEN)**
  - [ ] Implement responsive assignment-level slot and appointment views using existing UI primitives.
  - [ ] Add inline validation, confirmation for cancellation, clear conflict errors, keyboard/focus behavior, and 44px touch targets.
  - [ ] Use server data loading/mutations through established TanStack Start patterns.
  - [ ] Verify no hardcoded UI strings and no hydration-unsafe timezone rendering.

- [ ] **Task 6.3: Student timezone and accessibility verification**
  - [ ] Add/adjust tests for browser timezone preference, explicit timezone labels, UTC fallback, and DST fixtures.
  - [ ] Run component tests, accessibility checks, i18n parity, and relevant route tests.

- [ ] **Phase 6 Verification & Checkpoint**
  - [ ] Run the exact focused student UI test command and announce it before execution.
  - [ ] Manually test at 320px/mobile and desktop widths in light and dark mode.
  - [ ] Verify booking, cancel/reschedule, timezone display, empty states, keyboard navigation, and explicit evidence action.
  - [ ] Obtain confirmation, attach the verification note, record the checkpoint SHA, and commit the plan update.

## Phase 7: Instructor scheduling experience

- [ ] **Task 7.1: Instructor UI tests (RED)**
  - [ ] Add tests for slot creation, assignment/checkpoint selection, duration/time validation, slot listing, cancellation, rescheduling, completion/no-show, and conflict errors.
  - [ ] Add role/ownership and inactive-assignment UI coverage.
  - [ ] Confirm RED behavior.

- [ ] **Task 7.2: Instructor slot and appointment UI (GREEN)**
  - [ ] Implement the assignment consultation scheduling surface using existing instructor consultation patterns.
  - [ ] Add mobile-friendly list/forms, status presentation, confirmation dialogs, accessible labels, and bilingual messages.
  - [ ] Ensure the instructor cannot modify appointments outside server-authorized assignments.

- [ ] **Task 7.3: UI quality verification**
  - [ ] Run instructor component/route tests, accessibility checks, i18n parity, lint, and typecheck.
  - [ ] Verify appointment state changes are reflected without stale client cache data.

- [ ] **Phase 7 Verification & Checkpoint**
  - [ ] Run the exact focused instructor UI test command and announce it before execution.
  - [ ] Manually test slot publish, student booking visibility, reschedule, cancel, complete/no-show, and conflict feedback.
  - [ ] Verify responsive behavior, dark mode, keyboard use, and destructive-action confirmation.
  - [ ] Obtain confirmation, attach the verification note, record the checkpoint SHA, and commit the plan update.

## Phase 8: End-to-end validation and completion

- [ ] **Task 8.1: Full lifecycle E2E coverage**
  - [ ] Add Playwright coverage for instructor publish → student book → notification → reschedule/cancel → completion/no-show → explicit consultation record → instructor verification.
  - [ ] Add cross-role authorization and calendar-feed scenarios.
  - [ ] Add a DST/timezone scenario and mobile viewport coverage.
  - [ ] Confirm RED behavior for newly added scenarios, then make them pass.

- [ ] **Task 8.2: Regression and quality gates**
  - [ ] Run focused unit suites.
  - [ ] Run `pnpm test`.
  - [ ] Run `pnpm test:integration`.
  - [ ] Run `pnpm test:coverage` and confirm new modules exceed 80%.
  - [ ] Run `pnpm typecheck`.
  - [ ] Run `pnpm lint`.
  - [ ] Run `pnpm format` and inspect the resulting diff.
  - [ ] Run `pnpm check:i18n`.
  - [ ] Run relevant accessibility/E2E checks.
  - [ ] Run `pnpm build`.

- [ ] **Task 8.3: Documentation and self-review**
  - [ ] Update roadmap/product documentation only where completed behavior requires it.
  - [ ] Record migration, rollback, scheduler/reminder, privacy, and operational notes.
  - [ ] Review every acceptance criterion and out-of-scope item against the implementation.
  - [ ] Confirm no new dependency or tech-stack deviation was introduced; if one is required, stop and update `tech-stack.md` before proceeding.
  - [ ] Prepare the track for `conductor-review`.

- [ ] **Final Verification & Completion Checkpoint**
  - [ ] Present final automated verification results and manual verification summary.
  - [ ] Obtain explicit user confirmation.
  - [ ] Attach the final verification git note and record the final checkpoint SHA.
  - [ ] Commit the final plan update.
  - [ ] Run `conductor-review` before archiving the track.

## Definition of Done

- [ ] All approved functional and non-functional requirements are implemented.
- [ ] All TDD red/green tasks and phase checkpoints are complete.
- [ ] Appointment booking is transactionally conflict-safe.
- [ ] Existing consultation verification and gating are unchanged.
- [ ] Timezone, DST, iCalendar, notification, privacy, and accessibility acceptance criteria pass.
- [ ] Migration and rollback are tested.
- [ ] Required quality gates pass with new-code coverage above 80%.
- [ ] Every completed task and phase has a recorded commit SHA and git note.
- [ ] Final review approves the track before archive.
