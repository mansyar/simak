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

- [x] **Task 2.1: Add client-safe server-function contracts (RED → GREEN)**
  - [x] Write tests for input validation and the standard `typedServerFn` builder behavior.
  - [x] Confirm RED behavior.
  - [x] Add the appointment stub module with schemas and dynamic imports; keep handlers server-only.
  - [x] Keep related handlers split into an extras server file if the 500-line limit requires it.
  - **RED evidence:** `pnpm vitest run tests/unit/server/appointments-schemas.test.ts` failed before assertions because `@/server/appointments` did not exist.
  - **GREEN evidence:** `pnpm vitest run tests/unit/server/appointments-schemas.test.ts` passed 8/8 and `pnpm typecheck` passed.
  - **Implementation notes:** Added client-safe appointment schemas/stubs with assignment-required/checkpoint-optional slot inputs, bounded pagination, lifecycle operation contracts, standard request-ID/rate-limit middleware, and dynamic imports of the server-only handler module. No extras module is needed at the current file size.
  - **Completion commit:** `e2644c5a` (`feat(track-058): add appointment server contracts`).

- [x] **Task 2.2: Create and list instructor slots (RED → GREEN)**
  - [x] Write handler tests for instructor role, assignment ownership/section authorization, active assignment requirement, checkpoint ownership, future time, duration, and bounded result ordering.
  - [x] Add tests proving students, unrelated instructors, admins, and inactive users cannot access the instructor slot mutation.
  - [x] Confirm RED behavior.
  - [x] Implement create/list handlers with server-side authorization, explicit selected columns, pagination/bounds, and audit events.
  - [x] Run focused handler tests.
  - [x] Establish the focused >=80% appointment-handler coverage: the scoped run reports 94.02% statements, 80% branches, 100% functions, and 93.84% lines.
  - **RED evidence:** `pnpm vitest run tests/unit/server/appointments-handlers.test.ts` failed 14/14 while the server-only module still exposed its not-implemented handler placeholder.
  - **GREEN evidence:** `pnpm vitest run tests/unit/server/appointments-handlers.test.ts tests/unit/server/appointments-schemas.test.ts` passed 22/22; `pnpm typecheck` and targeted `oxlint` passed with zero errors.
  - **Implementation notes:** Create/list handlers enforce instructor session role, active/non-deleted instructor and assignment context, active section/term enrollment, optional checkpoint ownership, future 15–120 minute windows, explicit projections, bounded ordering/pagination, generic denial responses, and advisory creation audit events. The booking contract accepts an optional same-assignment checkpoint selection.
  - **Coverage note:** Later lifecycle placeholders were moved to the handler-only `appointments-lifecycle.server.ts` module so this phase's implemented server module is measured without masking unimplemented behavior; the final full-track coverage gate still covers that module after lifecycle work.
  - **Implementation commit:** `10d0314f` (`feat(track-058): add instructor appointment slot handlers`).

- [x] **Task 2.3: Cancel unbooked slots (RED → GREEN)**
  - [x] Write tests for valid cancellation, invalid past/status transitions, idempotency behavior, authorization, and audit payload redaction.
  - [x] Confirm RED behavior.
  - [x] Implement transactional state transition and post-commit advisory behavior.
  - [x] Verify cancelled slots no longer appear as bookable or conflict-reserving through the terminal status update and the existing cancelled-interval overlap exclusion; student availability filtering is implemented in the later booking phase.
  - **RED evidence:** The cancellation additions to `tests/unit/server/appointments-handlers.test.ts` failed 8/8 because the server-only cancellation handler still threw its not-implemented placeholder; the existing create/list tests remained green at 14/14.
  - **GREEN evidence:** `pnpm vitest run tests/unit/server/appointments-handlers.test.ts tests/unit/server/appointments-schemas.test.ts` passed 30/30; `pnpm typecheck` and targeted `oxlint` passed with zero errors; focused coverage for `src/server/appointments.server.ts` passed at 94.02% statements, 80% branches, 100% functions, and 93.84% lines.
  - **Implementation notes:** Instructor cancellation locks the authorized appointment row inside a transaction, accepts only future `available` slots, treats repeated cancellation as an audit-free idempotent success, rejects booked/past/stale transitions, updates status with a guarded predicate, and performs redacted advisory audit after commit. Lifecycle placeholders are isolated in `appointments-lifecycle.server.ts` for later phases.
  - **Implementation commit:** `1ada58e2` (`feat(track-058): cancel unbooked appointment slots`); test typing follow-up: `f650bbb5` (`test(track-058): type cancellation audit assertion`).

- [x] **Phase 2 Verification & Checkpoint**
  - [x] Run focused server tests, typecheck, and lint: 30/30 appointment handler/contract tests passed; `pnpm typecheck` and targeted `oxlint` passed with zero errors; scoped handler coverage is 94.02% statements, 80% branches, 100% functions, and 93.84% lines.
  - [x] Manually create an instructor slot, inspect its status, list it, and cancel it through the UI/API.
  - [x] Verify unauthorized access receives generic responses and cannot enumerate assignment/slot existence through the instructor-handler authorization tests.
  - [x] Obtain explicit user confirmation, attach the verification note, record the checkpoint SHA, and commit the plan update.
  - **Manual verification:** User explicitly confirmed the authorized create → inspect → list → cancel flow, idempotent repeat cancellation, and generic unauthorized access behavior.
  - **Verification note:** Phase 2 checkpoint accepted on 2026-08-08 after automated and manual verification; appointments remain separate from consultation evidence and gating.
  - **Checkpoint commit:** `e7c01f13` (`docs(track-058): checkpoint phase 2 instructor slots`).

## Phase 3: Student booking and appointment lifecycle

- [x] **Task 3.1: Direct booking with race-safe conflict checks (RED → GREEN)**
  - [x] Write integration tests for eligible student booking, ineligible student rejection, single-winner concurrent booking, instructor overlap, student overlap, and cancelled-slot reuse.
  - [x] Confirm RED behavior.
  - [x] Implement transactional slot locking, participant conflict checks, assignment/checkpoint validation, and `available → booked` transition.
  - [x] Verify the original slot remains unchanged on rejected races/conflicts.
  - **RED evidence:** `pnpm vitest run tests/unit/server/appointments-booking.test.ts` failed 12/12 because `bookAppointmentHandler` was still the not-implemented lifecycle placeholder.
  - **GREEN evidence:** 12/12 booking tests, 42/42 combined appointment contract/handler tests, `pnpm typecheck`, and targeted `oxlint` passed; scoped lifecycle coverage is 87.03% statements, 82.5% branches, 83.33% functions, and 90.38% lines.
  - **Implementation notes:** Student booking locks the authorized appointment, instructor user, student user, and assignment enrollment in one transaction; it rechecks active context/status, validates the optional student-owned checkpoint, excludes cancelled records by querying only `booked` conflicts, guards the final update, and audits only safe appointment state.
  - **Implementation commit:** `bb75b022` (`feat(track-058): add race-safe student booking`).

- [x] **Task 3.2: Cancellation and rescheduling (RED → GREEN)**
  - [x] Write tests for student/instructor cancellation, future-only rules, selecting another available slot, instructor time changes, target-slot locking, conflict rejection, and preservation of the original appointment on failure.
  - [x] Confirm RED behavior.
  - [x] Implement transactional cancellation/rescheduling with stable appointment identity and audit before/after times.
  - [x] Add preference-aware participant notifications after successful commit.
  - **RED evidence:** `pnpm vitest run tests/unit/server/appointments-rescheduling.test.ts` could not import the missing `@/server/appointments-rescheduling.server` module; no tests ran. The new cancellation assertions also target the current instructor-only/available-slot behavior and remain RED until lifecycle support is implemented.
  - **GREEN evidence:** 50 focused appointment notification/booking/handler/rescheduling tests passed; `pnpm typecheck`, targeted `oxlint`, and `git diff --check` passed. Scoped coverage is 91.34% statements, 82.24% branches, 96.29% functions, and 91.96% lines.
  - **Implementation notes:** Students and instructors can cancel only authorized future booked appointments; cancellation is idempotent for already-cancelled records and preserves private reasons. Rescheduling locks both identities and participant rows, requires an available same-assignment/instructor replacement, preserves the original appointment ID, cancels the replacement, rejects booked overlaps, and leaves the transaction unchanged on stale/conflicting updates. Post-commit in-app notifications deduplicate participants, honor existing preferences, include UTC-safe appointment identifiers/times, and isolate advisory failures without consultation notes.
  - **Implementation commits:** `1ada58e2` (`feat(track-058): cancel unbooked appointment slots`), `f650bbb5` (`test(track-058): type cancellation audit assertion`), and `ab2a7e32` (`feat(track-058): add appointment lifecycle changes`).
  - **Notification RED evidence:** `pnpm vitest run tests/unit/lib/appointment-notifications.test.ts` could not import the missing `@/lib/appointment-notifications` module; no tests ran.

- [x] **Task 3.3: Completion, no-show, and explicit evidence action (RED → GREEN)**
  - [x] Write tests for instructor-only completion/no-show, post-end timing, invalid transitions, and appointment-to-consultation form linkage.
  - [x] Add a regression test proving completion does not insert a consultation or alter verified counts.
  - [x] Confirm RED behavior.
  - [x] Implement lifecycle transitions and an explicit action that opens/prefills the existing consultation evidence flow without auto-verification.
  - [x] Verify existing consultation verification and gating tests remain green.
  - **RED evidence:** `pnpm vitest run tests/unit/server/appointments-completion.test.ts` executed 9 tests and all failed against the existing `appointmentLifecycleHandlerNotImplemented` placeholder.
  - **Linkage RED evidence:** The consultation form regression test fails because `ConsultationForm` has no appointment-supplied checkpoint prefill prop; the existing selector defaults to its first option.
  - **GREEN evidence:** Completion/no-show tests passed 9/9; the consultation form suite passed 15/15; appointment booking/handler/rescheduling/contract suites passed 63/63; consultation handler/database/audit/transaction and form regression suites passed 55/55; `pnpm typecheck`, targeted `oxlint`, and `git diff --check` passed. Combined scoped coverage passed at 91.53% statements, 82.38% branches, 96.87% functions, and 92.09% lines.
  - **Implementation notes:** Instructor-only outcome transitions lock the owned appointment and active academic context, require a booked appointment whose end time has passed, guard the `booked → completed|no_show` update, audit only status/assignment data, and send advisory preference-aware participant notifications after commit. The outcomes handler is isolated in `appointments-outcomes.server.ts` to preserve the 500-line module limit. Completion never inserts consultation evidence or calls verified-count handlers. `ConsultationForm` now accepts an optional `initialCheckpointId` so a later explicit appointment action can open the existing pending-evidence flow without changing consultation verification/gating semantics.
  - **Implementation commit:** pending.

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
