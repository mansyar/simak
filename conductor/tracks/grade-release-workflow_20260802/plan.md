# TRACK-051: Grade Release Workflow — Implementation Plan

**Status:** In progress
**Specification:** [spec.md](./spec.md)

## Phase 1: Release Schema and Migration

- [x] Task: Re-establish implementation context [39e72d4]
  - [x] Read the approved `spec.md` once created.
  - [x] Re-read `conductor/workflow.md` and confirm TDD, coverage, commit, git-note, and phase-checkpoint requirements.
  - [x] Inspect the existing `assignment_grade_config`, `final_grades`, and assignment-enrollment schema before changing it.

- [x] Task: Write failing release-schema tests (Red Phase) [605bd1, 83906b]
  - [x] Create `tests/unit/db/schema/gradebook-release.test.ts`.
  - [x] Test the `draft`/`published` release-state enum and default state.
  - [x] Test the active release version fields on the grade configuration.
  - [x] Test the immutable snapshot table shape, foreign keys, required grade fields, release version, and publication timestamp.
  - [x] Test uniqueness for `(assignmentId, releaseVersion, studentId)` and indexes needed for assignment/version and student lookups.
  - [x] Run the focused schema test and confirm it fails before implementation.

- [x] Task: Implement release schema and migration (Green Phase) [88d2985]
  - [x] Extend `src/db/schema/gradebook.ts` with release-state metadata.
  - [x] Add the published-grade snapshot table and relations/indexes.
  - [x] Export new schema objects through `src/db/schema/index.ts` if required.
  - [x] Generate the next Drizzle migration with `pnpm db:generate` (`0019_daffy_bulldozer.sql`).
  - [x] Ensure existing grade configurations are backfilled to `draft` with no fabricated snapshots.
  - [x] Confirm the repository uses forward-only Drizzle migrations; no separate rollback file is generated.
  - [x] Apply/verify the migration against the development database with `pnpm db:push`; `pnpm db:migrate` remains blocked by the pre-existing empty migration ledger.
  - [x] Run the focused schema tests and confirm they pass.
  - [x] Run modularity checks and keep every changed source/test file under 500 lines.
  - [x] Commit with a `feat(db): ...` message and attach the required git note.

- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [08a675a]
  - [x] Automated verification: focused schema/relation tests pass (8 tests).
  - [x] Automated verification: `pnpm test` passes (404 test files, 4,045 tests).
  - [x] Automated verification: `pnpm typecheck` passes; staged schema changes pass lint and modularity checks.
  - [x] Manual verification: generated migration `0019_daffy_bulldozer.sql` matches the schema, development DB exposes the release enum/table/columns, and no snapshots were fabricated.
  - [x] Obtain user confirmation to proceed to Phase 2.
  - [x] Checkpoint note: User confirmed the schema/migration results and authorized Phase 2 server lifecycle work.

## Phase 2: Server Release Lifecycle and Student Gating

- [x] Task: Write failing server tests (Red Phase) [33c2c78]
  - [x] Create `tests/unit/server/gradebook-release.test.ts` using the established server-handler mocking pattern.
  - [x] Test preflight classification for complete, incomplete/in-progress, and missing persisted grades.
  - [x] Test that only the current assignment instructor can publish.
  - [x] Test that students, admins, superadmins, and non-owning instructors cannot publish or withdraw.
  - [x] Test publication creates one snapshot per eligible student and no snapshot for ineligible students.
  - [x] Test publication increments the release version and updates release state atomically.
  - [x] Test failed publication does not leave partial snapshots or a published state.
  - [x] Test withdrawal requires a non-empty reason, returns the assignment to draft, and retains prior snapshots.
  - [x] Test republishing creates a new release version while retaining prior snapshots.
  - [x] Test publication and withdrawal audit events contain the required actor, assignment, version, counts, and reason data.
  - [x] Extend student grade handler tests to prove draft grades and live provisional grades are hidden.
  - [x] Test that published student responses come from the active snapshot and remain unchanged after `final_grades` recomputation.
  - [x] Test that students who become complete after publication remain unavailable until a later release.
  - [x] Run the focused server tests and confirm the new tests fail before implementation.

- [x] Task: Add validated release server-function contracts (Green Phase) [ee6aaf7]
  - [x] Extend `src/server/gradebook.ts` with Zod schemas and typed stubs for preflight, publish, and withdraw operations.
  - [x] Apply the appropriate read and mutation rate-limit presets.
  - [x] Add handler implementations in `src/server/gradebook-extras.server.ts` to preserve the server file-size limit.
  - [x] Keep handlers server-only and follow the existing client-safe/server-only dynamic-import split.

- [x] Task: Implement transactional preflight and publication [ee6aaf7]
  - [x] Add ownership-scoped preflight queries against enrolled students and authoritative `final_grades`.
  - [x] Use a transaction/row-lock strategy that keeps eligibility evaluation, snapshot inserts, release-version assignment, and state transition consistent.
  - [x] Insert immutable snapshots containing the numeric score, letter grade, status, and checkpoint breakdown.
  - [x] Prevent publication while another release is already active unless the current release has first been withdrawn.
  - [x] Preserve existing working-grade computation and admin/instructor gradebook responses.

- [x] Task: Implement withdrawal and student visibility gating [ee6aaf7]
  - [x] Add the required-reason withdrawal handler and retain all prior snapshots.
  - [x] Update `getStudentFinalGradeHandler` in `src/server/gradebook.server.ts` to select only the active published snapshot.
  - [x] Return a typed unavailable/not-yet-released result for draft assignments and students without an active snapshot.
  - [x] Extend the instructor gradebook response with release state and current release metadata without removing working-data rows.
  - [x] Ensure all release mutations enforce current assignment ownership server-side.

- [x] Task: Implement audit integration and server hardening [ee6aaf7]
  - [x] Add publication and withdrawal audit action types and details.
  - [x] Follow the existing advisory audit logging pattern so audit persistence errors are logged without corrupting the completed grade transaction.
  - [x] Validate malformed assignment IDs, reasons, invalid release transitions, missing assignments, and database failures with existing error conventions.
  - [x] Run focused server tests, then the related existing gradebook tests, and confirm all pass.
  - [x] Run coverage for the new server/schema modules and refactor only without changing behavior.
  - [x] Commit with a `feat(gradebook): ...` message and attach the required git note.

- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [92c2ddf]
  - [x] Automated verification: release lifecycle tests pass (17 tests).
  - [x] Automated verification: related gradebook/server/UI regression tests pass (42 tests).
  - [x] Automated verification: `pnpm test:coverage` passes (405 files, 4,062 tests; overall thresholds met).
  - [x] Automated verification: `pnpm typecheck` passes; implementation lint and modularity checks pass.
  - [x] Manual verification: publication is instructor-owner scoped, snapshots are complete-only and versioned, withdrawal retains snapshots, and student reads use only the active published snapshot.
  - [x] Obtain user confirmation to proceed to Phase 3.
  - [x] Checkpoint note: User confirmed the server lifecycle results and authorized Phase 3 UI, i18n, and accessibility work.

## Phase 3: Instructor and Student UI, i18n, and Accessibility

- [x] Task: Write failing UI and E2E tests (Red Phase) [16a19c3]
  - [x] Extend `tests/unit/routes/instructor-gradebook.test.tsx` for draft/published state display and role-appropriate release controls.
  - [x] Create `tests/unit/components/gradebook-release-controls.test.tsx` for preflight rendering, explicit publish confirmation, loading/success/error states, and required withdrawal reason validation.
  - [x] Extend `tests/unit/components/student-final-grade-card.test.tsx` for unavailable draft/no-snapshot states and active snapshot rendering.
  - [x] Add `tests/e2e/grade-release.spec.ts` using existing deterministic fixture conventions.
  - [x] Cover instructor publication with eligible and incomplete students, student visibility before/after publication, recomputation immutability, withdrawal, republish, and unauthorized mutation attempts.
  - [x] Run the focused component/route tests and confirm they fail before implementation.

- [x] Task: Add bilingual translation keys [0174d61]
  - [x] Add release-state, preflight, publish, withdrawal, unavailable-state, validation, success, and error keys to `locales/en.json`.
  - [x] Add matching Indonesian keys to `locales/id.json`.
  - [x] Add publication/withdrawal action labels to the shared audit-action translation source if required.
  - [x] Run `pnpm generate:i18n`.
  - [x] Run `pnpm check:i18n` and verify English/Indonesian key parity.
  - [x] Do not edit generated i18n files manually.

- [x] Task: Implement instructor release controls [0174d61]
  - [x] Create a focused gradebook release control component using existing accessible UI primitives.
  - [x] Show the current draft/published state and active release metadata.
  - [x] Add a preflight dialog with eligible, incomplete, and missing-grade summaries.
  - [x] Require explicit confirmation before publishing.
  - [x] Add a withdrawal dialog with a required reason and preserved form input on validation failure.
  - [x] Use TanStack Query mutation/invalidation patterns consistent with the project.
  - [x] Wire the controls into `src/routes/_authenticated/instructor/assignments/$id.gradebook.tsx`.
  - [x] Keep controls hidden from admin/superadmin views and preserve existing staff gradebook/export controls.

- [x] Task: Implement student unavailable and published snapshot presentation [0174d61]
  - [x] Update `src/components/gradebook/StudentFinalGradeCard.tsx` for the typed unavailable state.
  - [x] Ensure draft, withdrawn, incomplete-at-release, and not-yet-released cases never render provisional numeric or letter grades.
  - [x] Preserve the current published grade and checkpoint breakdown presentation from snapshot data.
  - [x] Provide responsive layout, keyboard access, visible focus, accessible labels, and live mutation feedback.

- [x] Task: Complete UI verification
  - [x] Run focused route/component tests and confirm they pass (3 files, 32 tests).
  - [x] Run the focused grade-release Playwright spec in Chromium (2 tests).
  - [x] Run scoped axe-core coverage for the release controls, preflight dialog, and published student snapshot card.
  - [x] Run the broader Chromium accessibility suite; 5 of 6 checks passed, with the unrelated pre-existing admin-template heading-order violation recorded.
  - [x] Commit with `feat(ui): ...` and `test(ui): ...` messages and attach the required git notes (`0174d61d`, `0f4d54d1`).

- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [032c24c]
  - [x] Automated verification: focused route/component tests pass (3 files, 32 tests).
  - [x] Automated verification: grade-release Chromium E2E passes (2 tests), including publication and active student snapshot visibility.
  - [x] Automated verification: scoped axe-core checks pass for release controls, preflight dialog, and published student snapshot card.
  - [x] Automated verification: `pnpm typecheck` and `pnpm check:i18n` pass; implementation lint and modularity hooks pass.
  - [x] Manual verification: owner-only controls, explicit confirmation, withdrawal reason validation, staff-control preservation, unavailable student state, and active snapshot presentation were reviewed.
  - [x] Obtain user confirmation to proceed to Phase 4 regression and quality gates.
  - [x] Checkpoint note: User approved Phase 4. The broader accessibility suite's one unrelated admin-template heading-order failure remains documented; scoped release-surface axe checks pass.

## Phase 4: Regression, Quality Gates, and Final Documentation

- [x] Task: Verify cross-feature compatibility [8330ad5]
  - [x] Confirm existing grade computation and recomputation tests remain green (60 related tests passed).
  - [x] Confirm existing instructor gradebook, export, admin analytics, and student assignment tests remain green through the related gradebook/UI regression suite.
  - [x] Confirm audit-log rendering handles the new publication and withdrawal actions in both locales; registered both actions in the admin filter/label map.
  - [x] Confirm generated route/type artifacts are current; the instructor parent-route change does not require route-tree regeneration and generated i18n types are current.
  - [x] Confirm no notification, transcript, GPA, approval-queue, scheduled-release, or student-release-history behavior was introduced.
  - [x] Run typecheck after the compatibility fix.
  - [x] Attach a git note to the compatibility fix commit.

- [ ] Task: Run repository quality gates
  - [ ] Run `pnpm test`.
  - [ ] Run `pnpm test:coverage` and verify the project thresholds, including at least 80% coverage for new code.
  - [ ] Run `pnpm typecheck`.
  - [ ] Run `pnpm lint`.
  - [ ] Run `pnpm check:i18n`.
  - [ ] Run `pnpm build`.
  - [ ] Run the relevant Playwright E2E and accessibility suites.
  - [ ] Resolve failures with focused fixes and rerun only the checks invalidated by each change.

- [ ] Task: Perform final self-review
  - [ ] Review the diff against the approved specification and this plan.
  - [ ] Confirm all server functions validate session, role, ownership, and input.
  - [ ] Confirm snapshot immutability, release atomicity, and student visibility invariants.
  - [ ] Confirm mobile touch targets, bilingual strings, accessible dialogs, and empty/error/loading states.
  - [ ] Confirm migration and rollback safety.
  - [ ] Record implementation notes and completed task commit SHAs in `plan.md`.
  - [ ] Commit final plan updates using the project’s `conductor(plan): ...` format and attach required git notes where applicable.

- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
