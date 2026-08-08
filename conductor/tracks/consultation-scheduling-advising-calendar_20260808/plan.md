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
  - **Implementation commit:** `897895db` (`feat(track-058): add appointment outcomes`).

- [x] **Task 3.4: Transaction and authorization integration coverage**
  - [x] Add database-backed tests for concurrent booking/rescheduling and stale transition handling.
  - [x] Add privacy tests for soft-cancelled appointments, deleted/inactive users, and cross-assignment access.
  - [x] Run integration coverage for all appointment mutations.
  - **GREEN evidence:** `tests/integration/server/appointments-lifecycle.test.ts` passed 4/4 against real PostgreSQL: one-winner booking, same-target rescheduling with stable original identity, cross-assignment/soft-deleted-student non-mutation, and one-winner instructor outcome transition. `pnpm typecheck`, targeted `oxlint`, and `git diff --check` passed.
  - **Implementation notes:** Integration fixtures use unique users, active academic context, assignments, enrollment, checkpoints, and appointment rows with deterministic cleanup. Advisory audit/notification work is mocked so the assertions isolate committed mutation state. The rescheduling handler now exposes its concrete success result type instead of `unknown`, preserving type-safe integration assertions. The disposable `simak_test` database was synchronized with the current schema using `pnpm db:push`; the default local database remains pre-TRACK-057 and `pnpm db:migrate` remains blocked by its empty migration history/prelaunch prerequisite.

- [x] **Phase 3 Verification & Checkpoint**
  - [x] Run focused unit/integration appointment suites and typecheck.
  - [x] Manually execute publish → book → reschedule → cancel, plus complete → explicitly record consultation → verify.
  - [x] Confirm verified consultation counts change only after the existing verification action.
  - [x] Obtain confirmation, attach the verification note, record the checkpoint SHA, and commit the plan update.
  - **Automated evidence:** 82 focused appointment/UI tests passed; real PostgreSQL integration coverage passed 4/4; consultation regression coverage passed 55/55; typecheck, targeted lint, and diff checks passed. Task 3.4 commit: `53c1b577`.
  - **Manual verification:** User explicitly confirmed the publish → book → reschedule → cancel → complete → explicit consultation record → verify flow and that verified counts/gating remain unchanged until consultation verification.
  - **Verification note:** Phase 3 checkpoint accepted on 2026-08-08; appointment outcomes remain separate from consultation evidence, verification, and gating.
  - **Checkpoint commit:** `9519720c`.

## Phase 4: Notifications and reminders

- [x] **Task 4.1: Add bilingual appointment notification contracts (RED → GREEN)**
  - [x] Write tests for notification keys, English/Indonesian parity, participant targeting, and privacy-safe content.
  - [x] Confirm RED behavior.
  - [x] Add locale source keys and notification template/type mappings; regenerate i18n types.
  - [x] Verify `pnpm check:i18n`.
  - **RED evidence:** `pnpm vitest run tests/unit/lib/appointment-notification-locales.test.ts` failed all 3 tests because appointment lifecycle/reminder notification keys and email subject keys were absent from both locale files.
  - **GREEN evidence:** Locale, appointment notification, and email-queue schema suites passed 12/12; `pnpm check:i18n`, `pnpm typecheck`, targeted `oxlint`, and `git diff --check` passed.
  - **Implementation notes:** Added seven lifecycle/reminder notification event pairs and six email subject keys to both locale sources, regenerated `src/i18n/types.ts`, and extended the existing text-backed email template/type unions. No database migration was required because `email_queue.template_type` is a typed text column rather than a PostgreSQL enum.
  - **Implementation commit:** `b4e2f9bf`.

- [x] **Task 4.2: Booking/lifecycle notification delivery (RED → GREEN)**
  - [x] Write tests for booking, cancellation, rescheduling, completion/no-show notifications and preference suppression.
  - [x] Confirm RED behavior.
  - [x] Implement post-commit in-app notification creation and email queue enqueueing.
  - [x] Ensure notification/email failure cannot roll back a committed appointment mutation.
  - **RED evidence:** The new appointment email body import failed because `src/lib/appointment-email.ts` was absent; the delivery assertions also confirmed lifecycle notification delivery had not yet enqueued participant emails (2 delivery assertions failed while 4 existing helper tests passed).
  - **GREEN evidence:** Seven focused suites passed 77/77 tests, covering appointment email rendering, participant notification delivery, email preference suppression, booking/cancellation/rescheduling/completion/no-show event assertions, and schema contracts. `pnpm check:i18n`, `pnpm typecheck`, targeted `oxlint`, and `git diff --check` passed. Scoped V8 coverage across appointment notification/email and event-email modules passed global thresholds at 97.43% statements, 80.76% branches, 83.33% functions, and 97.22% lines.
  - **Implementation notes:** Added localized appointment email configuration/body rendering, extended the existing participant helper to enqueue preference-aware email after in-app work, isolated each channel and database acquisition as advisory work, and retained `void` post-commit calls from mutation handlers so committed appointment state is never rolled back by notification failures. Email subjects/body parameters contain appointment/assignment/time identifiers only; consultation notes and tokens are excluded.
  - **Implementation commit:** `9c7c996f`.

- [x] **Task 4.3: 24-hour and 1-hour reminder scanner (RED → GREEN)**
  - [x] Write tests for both reminder windows, UTC comparisons, timezone-independent trigger behavior, repeated scans, boundary times, cancelled appointments, and completed/no-show appointments.
  - [x] Confirm RED behavior.
  - [x] Implement the scanner using the existing background processor boundary and a durable deduplication mechanism.
  - [x] Verify failures are logged and isolated from email queue processing.
  - **RED evidence:** The persistence contract initially failed during import analysis because `@/db/schema/appointment-reminders` did not exist; after the schema contract was added, the scanner contract `pnpm vitest run tests/unit/lib/appointment-reminder-scanner.test.ts` failed during import analysis because `@/lib/appointment-reminder-scanner` did not exist; no scanner assertions ran.
  - **GREEN evidence:** Schema tests passed 4/4; scanner and email-queue-init suites passed 28/28; `pnpm typecheck`, targeted `oxlint`, and `git diff --check` passed. Scoped V8 coverage for `appointment-reminder-scanner.ts` and `email-queue-init.ts` passed at 97% statements, 83.01% branches, 100% functions, and 100% lines.
  - **Implementation notes:** Added `appointment_reminders` durable rows with a PostgreSQL `appointment_reminder_tier` enum, participant/tier uniqueness, foreign keys, indexes, and forward/rollback migrations. The scanner evaluates booked active appointments in UTC half-open 24-hour and 1-hour windows, atomically claims student/instructor reminder rows with `ON CONFLICT DO NOTHING`, groups claimed participants, and dispatches through the existing preference-aware notification/email helper. `email-queue-init` invokes it on its existing 30-second tick with an independent hourly throttle; scanner, deduplication, and delivery failures are advisory and cannot stop queue processing. Direct `simak_test` apply/inspect/rollback/re-apply verification confirmed migration behavior.
  - **Implementation commits:** `0e32cfb6` (persistence), `6c9a3662` (scanner/queue integration).

- [x] **Phase 4 Verification & Checkpoint**
  - [x] Run focused notification/reminder tests, i18n parity, and typecheck.
  - [x] Manually book a future appointment and verify participant notifications plus at-most-once reminder behavior using test fixtures.
  - [x] Confirm disabled email/in-app preferences are respected.
  - [x] Confirm cancelled/completed/no-show appointments do not trigger reminders and notification failures do not interrupt queue processing.
  - **Automated verification:** Appointment schema tests passed 4/4; notification/email and lifecycle suites passed 77/77; reminder scanner/email-queue suites passed 28/28; `pnpm check:i18n`, `pnpm typecheck`, targeted `oxlint`, and `git diff --check` passed. Scoped V8 coverage passed at 97% statements, 83.01% branches, 100% functions, and 100% lines. Disposable `simak_test` migration apply/inspect/rollback/re-apply was verified.
  - **Manual verification:** User confirmed the future booking notification flow, 24-hour/1-hour at-most-once reminder behavior, independent email/in-app preference suppression, terminal-status reminder exclusion, and advisory notification failure isolation on 2026-08-08.
  - **Checkpoint commit:** `a31d2d34`.

## Phase 5: Private iCalendar extension

- [x] **Task 5.1: Appointment event selection (RED → GREEN)**
  - [x] Write selector tests for student ownership, booked-only status, future events, active assignment authorization, cancelled omission, optional checkpoint labels, and unrelated-student isolation.
  - [x] Confirm RED behavior.
  - [x] Extend the existing calendar-feed selection helper without changing deadline event semantics.
  - [x] Verify token-owner checks remain in the route boundary.
  - **RED evidence:** `pnpm vitest run tests/unit/server/calendar-feed-selection.test.ts` retained the seven existing deadline tests but failed the two new appointment tests because `buildAppointmentFeedEvents` and `CalendarAppointmentRow` were not yet exported. `pnpm typecheck` reported the same missing exports; no production changes were made.
  - **GREEN evidence:** The selector suite passed 7/7; the existing calendar selector, route-security, and serializer regression suites passed 15/15; `pnpm typecheck`, targeted `oxlint`, and `git diff --check` passed. Scoped V8 coverage for `calendar-feed-selection.server.ts` passed at 83.33% statements, 94.11% branches, 85.71% functions, and 82.35% lines.
  - **Implementation notes:** Added a separate appointment projection/query joined to active assignments and the authorized student's assignment membership. Selection is limited server-side to future `booked` appointments for the requested student, excludes cancelled/available/terminal/inactive/deleted contexts, retains optional checkpoint labels, and emits stable `appointment-{id}@simak` UIDs with UTC instants and end times. Existing deadline selection remains unchanged. The existing route still performs token hashing, active student ownership, rate limiting, generic unauthorized responses, and secure private headers.
  - **Implementation commit:** `4ea12742`.

- [x] **Task 5.2: Stable appointment serialization (RED → GREEN)**
  - [x] Write serializer tests for stable appointment UID, UTC `DTSTART`/`DTEND`, rescheduling with unchanged UID, RFC 5545 escaping/folding, and safe titles.
  - [x] Confirm RED behavior.
  - [x] Implement appointment event serialization using the existing feed conventions.
  - [x] Preserve existing cache, content-type, rate-limit, and credential secrecy behavior.
  - **RED evidence:** `pnpm vitest run tests/unit/lib/calendar-ics.test.ts` passed the three existing serializer tests and failed the new appointment contract because `DTEND` was not emitted. The test also establishes stable appointment UID and rescheduled UTC start/end expectations.
  - **GREEN evidence:** Serializer tests passed 4/4; the selector, route-security, and serializer regression suites passed 16/16; `pnpm typecheck`, targeted `oxlint`, and `git diff --check` passed. Scoped V8 coverage for `calendar-ics.ts` passed at 100% statements, 90% branches, 100% functions, and 100% lines.
  - **Implementation notes:** Extended the existing optional event end-time contract and emits UTC `DTEND` only for appointment events, preserving CRLF formatting, RFC 5545 escaping/folding, stable UIDs, and all existing route cache/content-type/rate-limit/credential behavior.
  - **Implementation commit:** `d7280db1`.

- [x] **Task 5.3: Calendar route regression/security coverage**
  - [x] Extend route tests for valid/invalid/revoked credentials, generic unauthorized responses, no enumeration, and mixed deadline/appointment feeds.
  - [x] Confirm the regression tests pass without weakening existing feed security.
  - [x] Run the focused calendar suite and relevant integration tests.
  - **GREEN evidence:** Calendar selector, route-security, and serializer suites passed 17/17; the real-PostgreSQL calendar feed lifecycle integration test passed 1/1. Scoped V8 coverage across the route, selector, and serializer passed at 94.59% statements, 89.58% branches, 94.11% functions, and 94.28% lines. `pnpm typecheck`, targeted `oxlint`, and `git diff --check` passed.
  - **Implementation notes:** Added a mixed deadline/appointment route regression while retaining the existing missing/malformed/revoked/inactive credential generic response cases, bearer/query token paths, student ownership rate-limit key, private no-store headers, and token non-disclosure. No route security behavior was weakened or changed.
  - **Implementation commit:** `af33fc73` (test/regression evidence only).

- [x] **Phase 5 Verification & Checkpoint**
  - [x] Run calendar selector/serializer/route tests, typecheck, and lint.
  - [x] Manually subscribe a test student calendar, confirm a booked appointment appears, reschedule it, and confirm the same UID updates.
  - [x] Cancel the appointment and confirm it is absent after refresh; confirm existing deadline events remain intact.
  - [x] Obtain confirmation, attach the verification note, record the checkpoint SHA, and commit the plan update.
  - **Automated verification:** Calendar selector, route-security, and serializer suites passed 17/17; the real-PostgreSQL calendar feed lifecycle integration test passed 1/1. Scoped V8 coverage across the route, selector, and serializer passed at 94.59% statements, 89.58% branches, 94.11% functions, and 94.28% lines. `pnpm typecheck`, targeted `oxlint`, and `git diff --check` passed.
  - **Manual verification:** User confirmed the private feed refresh flow: booked appointment appearance alongside deadline events, stable UID/time update after rescheduling, cancellation removal, and unchanged deadline events on 2026-08-08.
  - **Checkpoint commit:** `2802a4bf`.

## Phase 6: Student appointment experience

- [x] **Task 6.1: Student UI tests (RED/GREEN)**
  - [x] Add component/route tests for available slots, timezone display, booking, conflict feedback, booked appointment details, cancellation, rescheduling, completed/no-show states, and empty/error/loading states.
  - [x] Add tests for the explicit consultation evidence action.
  - [x] Confirm RED behavior.
   - **RED evidence:** `pnpm vitest run tests/unit/components/student/StudentAppointmentPanel.test.tsx` failed before assertions because the planned `StudentAppointmentPanel` component did not exist; `pnpm typecheck` reported the same missing module. The RED contract covers available/booked rendering, timezone labeling, booking/conflict handling, confirmation-gated cancellation, stable-ID rescheduling, terminal outcome display, loading/error/empty states, and explicit consultation recording.
   - **GREEN evidence:** The student appointment panel implementation and route integration now pass the focused component suite together with the existing ConsultationForm suite. The panel covers server-backed list loading and mutations, optional checkpoint selection, timezone labels, lifecycle controls, terminal outcomes, retry/error/empty states, and explicit consultation prefill without automatic evidence creation.
   - **Implementation commit:** `84378837` (with the RED contract commit `1d04a26e`).

- [x] **Task 6.2: Student booking and management UI (GREEN)**
   - [x] Implement responsive assignment-level slot and appointment views using existing UI primitives.
   - [x] Add inline validation, confirmation for cancellation, clear conflict errors, keyboard/focus behavior, and 44px touch targets.
   - [x] Use server data loading/mutations through established TanStack Start patterns.
   - [x] Verify no hardcoded UI strings and no hydration-unsafe timezone rendering.
   - **Implementation notes:** Added `StudentAppointmentPanel`, assignment-route integration, student list handlers with active-context authorization/pagination, and bilingual `appointments.student` keys. The component uses the existing `useStudentTimezone` hydration boundary, starts from UTC, labels the resolved IANA timezone, and wires the explicit record-consultation action to `ConsultationForm`'s checkpoint prefill.
   - **Automated verification:** Student panel/list suites passed 20/20; the assignment route regression suite passed 15/15 and the ConsultationForm suite passed 15/15. Scoped V8 coverage for the new panel/list modules passed at 96.77% statements, 84.41% branches, 96.55% functions, and 98.31% lines; `pnpm check:i18n`, `pnpm typecheck`, targeted `oxlint`, and `git diff --check` passed.
   - **Implementation commit:** `84378837`.

- [x] **Task 6.3: Student timezone and accessibility verification**
   - [x] Add/adjust tests for browser timezone preference, explicit timezone labels, UTC fallback, and DST fixtures.
   - [x] Run component tests, accessibility-oriented assertions, i18n parity, and relevant route tests.
   - **Verification notes:** The panel consumes `useStudentTimezone`, uses UTC until hydration completes, and the shared appointment policy tests cover IANA/DST formatting and invalid-zone UTC fallback. Focused tests assert semantic roles, confirmation behavior, keyboard-reachable controls, and 44px select/button classes; the i18n parity check, typecheck, lint, and diff checks pass. Manual responsive/light-dark/keyboard verification remains for the phase checkpoint.

- [x] **Phase 6 Verification & Checkpoint**
   - [x] Run the exact focused student UI test command and announce it before execution.
   - [x] Manually test at 320px/mobile and desktop widths in light and dark mode.
   - [x] Verify booking, cancel/reschedule, timezone display, empty states, keyboard navigation, and explicit evidence action.
   - [x] Obtain confirmation, attach the verification note, record the checkpoint SHA, and commit the plan update.
   - **Automated verification:** Student panel/list suites passed 20/20; assignment route regression and ConsultationForm suites passed 15/15 each. Scoped V8 coverage for the new panel/list modules passed at 96.77% statements, 84.41% branches, 96.55% functions, and 98.31% lines. `pnpm check:i18n`, `pnpm typecheck`, targeted `oxlint`, and `git diff --check` passed.
   - **Manual verification:** User confirmed the Phase 6 student flow on 2026-08-08: responsive 320px/desktop light-dark presentation, keyboard-reachable 44px controls, booking with optional checkpoint, confirmation-gated cancellation, rescheduling, timezone/UTC fallback display, loading/error/empty and terminal states, and explicit consultation prefill without automatic evidence creation.
   - **Implementation commit:** `84378837`.
   - **Checkpoint commit:** `8dbdffea`.

## Phase 7: Instructor scheduling experience

- [x] **Task 7.1: Instructor UI tests (RED)**
   - [x] Add tests for slot creation, assignment/checkpoint selection, duration/time validation, slot listing, cancellation, rescheduling, completion/no-show, and conflict errors.
   - [x] Add role/ownership and inactive-assignment UI coverage.
   - [x] Confirm RED behavior.
   - **RED evidence:** `pnpm vitest run tests/unit/components/instructor/InstructorAppointmentPanel.test.tsx` failed before assertions because the planned `InstructorAppointmentPanel` component did not exist; `pnpm typecheck` reported the same missing module. The contract covers slot publishing, assignment/checkpoint selection, booked student/status display, confirmation-gated cancellation, replacement-slot rescheduling, completion/no-show actions, timezone labels, empty/loading/error/retry states, and generic unauthorized/inactive-context handling.

- [~] **Task 7.2: Instructor slot and appointment UI (GREEN)**
   - [~] Implement the assignment consultation scheduling surface using existing instructor consultation patterns.
   - [~] Add mobile-friendly list/forms, status presentation, confirmation dialogs, accessible labels, and bilingual messages.
   - [~] Ensure the instructor cannot modify appointments outside server-authorized assignments.

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
