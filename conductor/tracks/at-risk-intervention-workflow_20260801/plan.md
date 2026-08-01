<protect>
# Implementation Plan: TRACK-050 — At-Risk Intervention Workflow

## Architecture decisions

- Add a dedicated `interventions` table with `assignmentId` and `studentId`; authorization derives from the assignment's current `instructorId`, so reassignment automatically transfers access without stale owner data.
- Enforce one active (`open`/`monitoring`) intervention per student-assignment pair with a PostgreSQL partial unique index.
- Add the standard client-safe/server-only pair:
  - `src/server/interventions.ts`
  - `src/server/interventions.server.ts`
- Reuse the existing `computeStudentRisk` engine through a server-only live-risk context helper shared by intervention handlers and the instructor dashboard.
- Add `/instructor/interventions`, an assignment-detail interventions tab, and dashboard summary/context links.
- Use existing audit logging; do not create notification records for follow-up dates.
- Keep all source, test, and script files under the 500-line limit. Split handler extras only if the implementation requires it.

## Phase 1 — Data model and live-risk context

- [x] Task: Define intervention contracts and database model
  - [x] Write failing schema tests for action types, statuses, closure-reason validation, filters, and pagination inputs.
  - [x] Run the schema tests and confirm the Red phase.
  - [x] Implement Zod schemas and `typedServerFn` stubs in `src/server/interventions.ts`.
  - [x] Implement intervention enums, columns, foreign keys, indexes, timestamps, and the active-pair partial unique index in `src/db/schema/interventions.ts`.
  - [x] Export the schema and add Drizzle relations in `src/db/schema/index.ts`.
  - [x] Generate the migration with `pnpm db:generate` and verify the SQL contains the required constraints and partial unique index.
  - [x] Run the schema tests and confirm the Green phase.
  - [x] Verify the changed files remain within the modularity limit.
  - [x] Commit with `feat(interventions): add intervention data model and contracts` and attach the required task git note (`fbc423e`).

- [x] Task: Share live student-risk context without changing risk semantics
  - [x] Write failing unit tests for assembling checkpoint context, preserving all five existing risk signals, and distinguishing `student_inaction` from `pending_review`.
  - [x] Run the new risk-context tests and the existing risk-scoring tests to confirm the Red phase.
  - [x] Implement a server-only risk-context helper that accepts the current database connection, fetches checkpoint/consultation/submission/revision data, and delegates scoring to `computeStudentRisk`.
  - [x] Refactor `dashboard-instructor.server.ts` to use the helper while preserving its current dashboard response.
  - [x] Run risk-scoring and instructor-dashboard tests and confirm the Green phase.
  - [x] Commit with `refactor(risk): share live student risk context` and attach the required task git note (`2607976`).

- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)
  - [x] Confirm changed implementation files have corresponding unit-test coverage.
  - [x] Run `pnpm vitest run tests/unit/server/student-risk-context.test.ts tests/unit/server/dashboard-instructor.test.ts tests/unit/lib/risk-scoring.test.ts` — 3 files and 40 tests passed.
  - [x] Attempt manual instructor-dashboard verification; local login/data seeding was unavailable because configured and test credentials were rejected and the existing seed entrypoint fails on `import.meta.env.PROD` under direct Node execution.
  - [x] Record the automated-only verification report and phase checkpoint at `2607976`.

## Phase 2 — Instructor-only server workflow

- [x] Task: Implement creation, listing, and live-context handlers
  - [x] Write failing server-handler tests for instructor authorization, assignment/student ownership, eligible `student_inaction` risk, pending-review-only rejection, active duplicate rejection, list status filters, overdue follow-up filtering, and privacy against students/admins/other instructors.
  - [x] Run the handler tests and confirm the Red phase.
  - [x] Implement `createInterventionHandler`, `listInterventionsHandler`, and the live context/detail handler in `src/server/interventions.server.ts`.
  - [x] Validate ownership and student membership on the server; never expose intervention data through student/admin handlers.
  - [x] Use the shared live-risk helper at creation and detail/context time; do not persist risk assessments or auto-resolve records.
  - [x] Use transactions and row locks for creation; rely on the database unique index as the final duplicate-prevention guard.
  - [x] Record creation events with the existing safe audit helper and do not enqueue notifications.
  - [x] Run the handler tests and confirm the Green phase.
  - [x] Commit with `feat(interventions): add instructor intervention handlers` and attach the required task git note (`e3704a6`).

- [x] Task: Implement locked status and record updates
  - [x] Write failing tests for allowed transitions, terminal resolved/dismissed states, required resolution/dismissal reasons, note/action/follow-up updates, row locking, and immutable audit-event details.
  - [x] Run the update tests and confirm the Red phase.
  - [x] Implement `updateInterventionHandler` with a transaction that locks the intervention row and verifies the current assignment owner before changing state.
  - [x] Reject unauthorized access, invalid transitions, empty closure reasons, and updates to terminal records.
  - [x] Record status changes and closure/dismissal reasons without altering historical audit actors.
  - [x] Run the lifecycle and transaction tests and confirm the Green phase.
  - [x] Extend reassignment regression coverage to prove the replacement instructor can access the record and the former instructor cannot.
  - [x] Commit with `feat(interventions): add locked lifecycle updates` and attach the required task git note (`cebd15e`).

- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)
  - [x] Confirm changed server files have corresponding handler and lifecycle tests.
  - [x] Run `pnpm vitest run tests/unit/server/interventions-schemas.test.ts tests/unit/db/interventions-schema.test.ts tests/unit/db/schema-index.test.ts tests/unit/server/interventions-handlers.test.ts tests/unit/server/interventions-lifecycle.test.ts tests/unit/server/student-risk-context.test.ts tests/unit/server/dashboard-instructor.test.ts tests/unit/lib/risk-scoring.test.ts` — 8 files and 79 tests passed.
  - [x] Manual request-harness verification was unavailable because local authenticated instructor data is still unavailable; automated-only verification was explicitly approved.
  - [x] Attach the verification report and record the phase checkpoint at `cebd15e`.

## Phase 3 — Dedicated intervention UI

- [x] Task: Build the intervention list, filters, and form (commit `d2bb3dd`)
  - [x] Write failing component and route tests for loading, empty, error, status/overdue filters, action types, conditional closure reason, validation errors, status actions, and bilingual labels.
  - [x] Run the UI tests and confirm the Red phase.
  - [x] Add `src/routes/_authenticated/instructor/interventions/index.tsx` with validated search parameters for status, overdue, assignment, student, page, and limit.
  - [x] Add focused components under `src/components/instructor/interventions/` for the list, form, detail/context, loading, and empty states.
  - [x] Use React Hook Form/Zod and existing shadcn/Base UI primitives; provide keyboard access, visible focus, ARIA labels, live feedback, and 44px touch targets.
  - [x] Show current live risk factors as read-only context and make overdue follow-up state explicit.
  - [x] Add the instructor sidebar link and all new English/Indonesian keys in `locales/en.json` and `locales/id.json`.
  - [x] Run `pnpm generate:i18n` and `pnpm check:i18n`; do not edit generated i18n files manually.
  - [x] Run the component and route tests and confirm the Green phase.
  - [x] Commit with `feat(ui): add instructor intervention management page` and attach the required task git note.

- [x] Task: Add assignment-context intervention management (commit `7c29134`)
  - [x] Write failing route/component tests for the assignment interventions tab, per-student context, eligible create entry point, existing-record management, and links to consultation/extension/discussion workflows.
  - [x] Run the assignment-context tests and confirm the Red phase.
  - [x] Add the interventions tab/panel to the instructor assignment detail route without exposing it in student assignment views.
  - [x] Reuse the intervention server functions and preserve existing assignment tabs and loaders.
  - [x] Run route and component tests and confirm the Green phase.
  - [x] Commit with `feat(ui): add assignment intervention context` and attach the required task git note.

- [~] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4 — Dashboard and reassignment integration

- [ ] Task: Surface intervention state in the instructor dashboard
  - [ ] Write failing server and component tests for open/overdue counts, active intervention status on at-risk entries, empty states, and links to create/manage interventions.
  - [ ] Run the dashboard tests and confirm the Red phase.
  - [ ] Extend the instructor dashboard response with current-owner open and overdue intervention summaries.
  - [ ] Add dashboard cards/context actions without changing live risk scoring or adding notifications.
  - [ ] Update `InstructorDashboard.tsx` and its existing tests with bilingual, accessible UI behavior.
  - [ ] Run dashboard server/component tests and confirm the Green phase.
  - [ ] Commit with `feat(dashboard): surface instructor intervention status` and attach the required task git note.

- [ ] Task: Verify reassignment-aware privacy end to end
  - [ ] Write failing tests covering access before reassignment, access by the replacement instructor after reassignment, and denial for the former instructor, student, admin, and unrelated instructor.
  - [ ] Run the authorization tests and confirm the Red phase.
  - [ ] Verify the existing row-locked assignment reassignment transaction remains the single source of current ownership; modify it only if the new tests identify a required integration change.
  - [ ] Confirm reassignment preserves immutable intervention audit actors and does not copy stale ownership into intervention records.
  - [ ] Run the reassignment and authorization tests and confirm the Green phase.
  - [ ] Commit with `test(interventions): verify reassignment privacy boundaries` and attach the required task git note.

- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 5 — Integration, quality, and completion

- [ ] Task: Add database-backed and browser acceptance coverage
  - [ ] Write integration tests for the partial unique active-pair constraint, transactional status transitions, closure audit data, and reassignment visibility.
  - [ ] Add Playwright coverage for instructor creation, pending-review rejection, status changes, overdue display, contextual entry points, and student/admin privacy.
  - [ ] Run the new integration/browser tests and record any environment prerequisites.
  - [ ] Commit with `test(interventions): cover workflow acceptance paths` and attach the required task git note.

- [ ] Task: Complete quality gates and documentation
  - [ ] Confirm all new user-visible strings exist in both locale files and generated i18n types are current.
  - [ ] Run `pnpm typecheck`.
  - [ ] Run `pnpm lint` and `pnpm format`.
  - [ ] Run `pnpm test:coverage` and confirm new code meets the project's 80% coverage threshold.
  - [ ] Run `pnpm test:integration` with the configured database and the relevant Playwright command.
  - [ ] Run `pnpm build`.
  - [ ] Review responsive behavior, dark-mode tokens, keyboard/focus behavior, privacy boundaries, and server-side validation.
  - [ ] Update documentation only where the implementation changes an existing project contract.
  - [ ] Commit with `chore(interventions): complete quality gates` and attach the required task git note.

- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Expected primary files

- `src/db/schema/interventions.ts`
- `src/db/schema/index.ts`
- `src/server/interventions.ts`
- `src/server/interventions.server.ts`
- shared server-only risk-context helper
- `src/server/dashboard-instructor.server.ts`
- `src/components/instructor/interventions/*`
- `src/routes/_authenticated/instructor/interventions/index.tsx`
- `src/routes/_authenticated/instructor/assignments/$id.tsx`
- `src/components/dashboard/InstructorDashboard.tsx`
- `src/components/layout/instructor-sidebar.tsx`
- matching unit/integration/Playwright tests
- both locale source files and generated i18n output
- generated Drizzle migration
</protect>
