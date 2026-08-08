# TRACK-060: Academic Records — Transcript & GPA — Implementation Plan

## Plan Rules

- Execute tasks sequentially and mark the selected task `[~]` before starting it.
- Follow the project’s red/green/refactor TDD workflow: failing tests precede implementation.
- Keep client-safe server-function stubs separate from `.server.ts` handlers.
- Add English and Indonesian translations for every new user-facing string.
- Keep all files under the project’s 500-line modularity limit.
- After each completed task, commit the related changes, attach the required git note, and record the first seven commit characters here.
- Complete the phase verification and checkpoint protocol described in `conductor/workflow.md`.

## Phase 0: Policy and Data Contract

- [x] Task: Confirm the academic-record policy contract [deccce5]
  - [x] Document the configured default grade-to-point mapping and rounding behavior.
  - [x] Define course-credit ownership, policy activation, and effective-version rules.
  - [x] Define complete, incomplete, withdrawn, unavailable, and GPA-excluded states.
  - [x] Define deterministic ordering for repeated attempts and active-record selection.
- [x] Task: Write policy-contract tests before implementation [a44f96e]
  - [x] Test valid and invalid grade mappings, credits, and rounding configurations.
  - [x] Test term GPA and cumulative GPA calculations, including no-eligible-record states.
  - [x] Test repeat selection, incomplete exclusion, and withdrawn exclusion.
- [x] Task: Phase Verification & Checkpoint (Refer to `conductor/workflow.md`) [48e166f]

## Phase 1: Schema and Immutable Academic Records

- [x] Task: Write failing persistence and constraint tests [a96c9ac]
  - [x] Test academic-record fields and source-release/policy references.
  - [x] Test immutable historical rows and active-version uniqueness.
  - [x] Test the single transcript-source assignment rule for a section.
  - [x] Test indexes and foreign-key behavior for student, section, term, assignment, and policy lookups.
- [x] Task: Implement the academic-record data model [a97a9ce]
  - [x] Add course-credit and versioned grading-policy persistence using approved Drizzle patterns.
  - [x] Add the explicit section transcript-source association with safe validation.
  - [x] Add immutable academic-record tables, enums, constraints, indexes, and migration.
  - [x] Add migration preflight/rollback handling consistent with TRACK-057.
- [x] Task: Write failing persistence-service tests [b451154]
  - [x] Test creation from an eligible published snapshot.
  - [x] Test creation of a new immutable version when a later release supersedes a prior one.
  - [x] Test rejection of missing, ambiguous, draft, unpublished, and ineligible sources.
- [x] Task: Implement record persistence services [584d7d5]
  - [x] Implement transactional academic-record creation and active-version selection.
  - [x] Persist source assignment, release version, policy version, status, credits, and calculated values.
  - [x] Ensure existing grade snapshots remain unchanged.
- [x] Task: Phase Verification & Checkpoint (Refer to `conductor/workflow.md`) [584d7d5]

## Phase 2: Grade Release and Enrollment Integration

- [x] Task: Write failing integration tests for official record creation [e0ac5f3]
  - [x] Test publishing a designated assignment creates records only for eligible enrolled students.
  - [x] Test draft and unpublished grades remain unavailable.
  - [x] Test later release versions preserve history and switch the active official result.
  - [x] Test authorized withdrawal creates a visible, GPA-excluded record without fabricating a grade.
- [x] Task: Integrate academic records with grade release [2de7786]
  - [x] Extend the existing release transaction at the server boundary without changing grade formulas.
  - [x] Add release preflight validation for missing, ambiguous, and incomplete source data.
  - [x] Add explicit withdrawal/status provenance and preserve enrollment history.
  - [x] Add relevant audit events and structured error handling.
- [x] Task: Write compatibility tests [8628eff]
  - [x] Verify gradebook recomputation does not mutate official records.
  - [x] Verify existing student grade visibility still uses published snapshots.
  - [x] Verify existing analytics and grade-release flows remain compatible.
- [~] Task: Phase Verification & Checkpoint (Refer to `conductor/workflow.md`)

## Phase 3: Policy Engine and Role-Scoped Server Functions

- [ ] Task: Write failing server-function tests
  - [ ] Test student self-access and denial of another student’s records.
  - [ ] Test instructor access limited to authorized sections.
  - [ ] Test admin/superadmin access and policy/source metadata visibility.
  - [ ] Test term and cumulative GPA responses and transparent calculation inputs.
- [ ] Task: Implement academic-record policy services
  - [ ] Implement grade-point mapping, configured rounding, credits, and status eligibility.
  - [ ] Implement term GPA and cumulative GPA using immutable records.
  - [ ] Implement latest-eligible-repeat selection with deterministic ordering.
- [ ] Task: Implement client-safe server-function stubs and handlers
  - [ ] Add Zod input/output schemas and `typedServerFn` stubs.
  - [ ] Add server-only handlers with session, role, and academic-context authorization.
  - [ ] Add paginated/filterable transcript queries without N+1 database access.
  - [ ] Add rate-limit tiers appropriate to reads and administrative mutations.
- [ ] Task: Phase Verification & Checkpoint (Refer to `conductor/workflow.md`)

## Phase 4: Role-Based Academic Record UI

- [ ] Task: Write failing component and route tests
  - [ ] Test student transcript, term filter, GPA summary, and empty/unavailable states.
  - [ ] Test admin policy/source metadata and record-detail states.
  - [ ] Test instructor section-scoped record view and unauthorized states.
  - [ ] Test incomplete, withdrawn, repeated, and GPA-excluded visual states.
- [ ] Task: Implement student academic-record experience
  - [ ] Add the student route and responsive transcript layout.
  - [ ] Add term filtering, term GPA, cumulative GPA, record details, and calculation summary.
  - [ ] Add loading, error, empty, unavailable, and retry states.
- [ ] Task: Implement admin and instructor academic-record experiences
  - [ ] Add authorized administrative record/policy-source views.
  - [ ] Add instructor section-scoped record access.
  - [ ] Surface ambiguous source assignments and policy validation errors through existing patterns.
- [ ] Task: Add localization and accessibility coverage
  - [ ] Add English and Indonesian locale keys and regenerate i18n types.
  - [ ] Use approved accessible primitives, semantic status colors, focus states, and keyboard behavior.
  - [ ] Verify responsive layouts from 320px through desktop and both color schemes.
- [ ] Task: Phase Verification & Checkpoint (Refer to `conductor/workflow.md`)

## Phase 5: End-to-End Verification and Handoff

- [ ] Task: Write and run end-to-end academic-record scenarios
  - [ ] Verify publish-to-transcript flow for a complete eligible student.
  - [ ] Verify draft, unpublished, incomplete, withdrawn, and repeat-course behavior.
  - [ ] Verify student, instructor, and admin authorization boundaries.
  - [ ] Verify mobile and accessibility behavior for the primary student flow.
- [ ] Task: Run project quality gates
  - [ ] Run `pnpm test` and targeted integration tests where applicable.
  - [ ] Run `pnpm test:coverage` and confirm required thresholds.
  - [ ] Run `pnpm typecheck`.
  - [ ] Run `pnpm lint` and `pnpm format`.
  - [ ] Run `pnpm check:i18n` and confirm no unused or missing keys.
- [ ] Task: Update project documentation
  - [ ] Update the roadmap/product completion references after implementation is complete.
  - [ ] Document any approved deviation in `tech-stack.md` before implementation resumes.
  - [ ] Record migration, authorization, and transcript-source operational notes.
- [ ] Task: Phase Verification & Checkpoint (Refer to `conductor/workflow.md`)
