# Implementation Plan: TRACK-057 — Academic Context & Semester Foundation

## Phase 1: Academic Context Schema & Prelaunch Migration [checkpoint: 86d4ce9]

**Objective:** Establish the normalized academic model and a safe prelaunch migration boundary without fabricating legacy facts.

- [x] Task: Re-read `spec.md`, `workflow.md`, `docs/PRD.md`, and `docs/TDD.md` before implementation [commit: 5def3f6]
  - [x] Confirm the course + term + section model and individual-assignment compatibility requirements
  - [x] Confirm migration, transaction, testing, i18n, and file-size constraints
- [x] Task: Write failing database schema and migration tests (Red) [commit: 0629d14]
  - [x] Add `tests/unit/db/academic-context.test.ts`
  - [x] Assert academic term, course, section, and section-enrollment table contracts
  - [x] Assert unique course/term/section identity and membership constraints
  - [x] Assert assignment context and explicit individual/group mode columns
  - [x] Add migration/preflight coverage proving unexpected existing production assignment rows are rejected
  - [x] Add fixture-reset coverage for development and test data
- [x] Task: Implement the academic-context schema (Green) [commit: 6bab1f5]
  - [x] Add the smallest normalized schema for `academic_terms`, `courses`, `course_sections`, and role-aware section enrollments
  - [x] Add lifecycle/status columns and foreign keys with history-safe delete behavior
  - [x] Add assignment `sectionId`/academic-context association and explicit `mode` defaulting to `individual`
  - [x] Register schema exports and Drizzle relations
  - [x] Add only justified indexes for term/section lookup, active membership, and assignment context filters
- [x] Task: Implement and review the next Drizzle migration plus rollback [commits: 86d4ce9, cb42855]
  - [x] Generate or author the forward migration using the repository’s migration conventions
  - [x] Add the matching rollback migration
  - [x] Make the prelaunch empty-production assumption explicit and non-destructive
  - [x] Update development, integration, and E2E fixture setup to recreate classified context data
- [x] Task: Run Phase 1 Red/Green and database verification [commit: 86d4ce9]
  - [x] Run focused schema tests and confirm they pass
  - [x] Apply the migration to a disposable database
  - [x] Verify forward, rollback, and re-apply behavior
- [x] Task: Phase Verification & Checkpoint (Refer to `workflow.md`) [checkpoint: 86d4ce9]

## Phase 2: Academic Context Administration Server Functions [checkpoint: 5e3c1bb]

**Objective:** Provide typed, role-protected admin operations for terms, courses, sections, and enrollments.

- [x] Task: Write failing server-function tests (Red) [commit: a66b3cf]
  - [x] Add `tests/unit/server/academic-context.test.ts`
  - [x] Test Zod validation for term, course, section, and enrollment inputs
  - [x] Test admin/superadmin authorization and rejection of instructor/student access
  - [x] Test duplicate, invalid-date, inactive-user, wrong-role, and cross-section cases
  - [x] Test pagination, filtering, and explicit response projections
  - [x] Add integration tests for context CRUD and enrollment persistence/rollback
- [x] Task: Implement client-safe academic-context stubs [commit: a6b5684]
  - [x] Add `src/server/academic-context.ts`
  - [x] Define schemas and `typedServerFn` stubs with appropriate read/destructive rate limits
  - [x] Keep handlers out of the client bundle through dynamic imports
- [x] Task: Implement server-only academic-context handlers [commit: 5e3c1bb]
  - [x] Add `src/server/academic-context.server.ts`
  - [x] Implement term, course, and section list/detail/create/update/archive operations
  - [x] Implement section enrollment add/remove/update operations
  - [x] Enforce active, non-deleted user role checks server-side
  - [x] Enforce admin-managed context ownership and history-safe archive rules
  - [x] Wrap multi-row writes in transactions and use lock/re-check patterns for mutable state
  - [x] Emit auditable context and enrollment events without sensitive payloads
  - [x] Split handler-only extras if the 500-line limit requires it
- [x] Task: Run Phase 2 Green verification
  - [x] Run focused unit and integration server tests
  - [x] Confirm all new handlers return typed serializable DTOs
  - [x] Confirm authorization tests do not query protected data before rejection
- [x] Task: Phase Verification & Checkpoint (Refer to `workflow.md`) [checkpoint: 5e3c1bb]

## Phase 3: Assignment Context Association & Lifecycle [checkpoint: c39cd2d]

**Objective:** Integrate academic context into existing assignment creation, authorization, listing, dashboards, and lifecycle transitions without changing individual checkpoint semantics.

- [x] Task: Write failing assignment integration and regression tests (Red) [commit: 5496392]
  - [x] Extend assignment server tests for required section selection and individual default mode
  - [x] Test instructor authorization through section membership
  - [x] Test student selection is limited to active students in the selected section
  - [x] Test unauthorized cross-section list/detail access
  - [x] Test draft visibility, activation, archival, and archived mutation rejection
  - [x] Test existing deadline, submission, review, grade-release, notification, and calendar behavior remains unchanged
  - [x] Add transaction/concurrency tests for lifecycle transitions and enrollment races
- [x] Task: Extend assignment server contracts [commit: 0471256]
  - [x] Update `src/server/assignments.ts` schemas and response types
  - [x] Add context filters and lifecycle inputs while preserving existing callers
  - [x] Add lifecycle/administrative stubs in the existing assignment split or a dedicated handler-only extras file as required
- [x] Task: Implement assignment context enforcement [commit: c39cd2d]
  - [x] Update `src/server/assignments.server.ts` and related assignment handlers with section ownership and enrollment checks
  - [x] Keep explicit `assignment_students` participation for individual assignments
  - [x] Reject invalid section, term, instructor, student, and mode combinations before mutation
  - [x] Return explicit course/term/section projections rather than broad row spreads
- [x] Task: Implement lifecycle transitions [commit: c39cd2d]
  - [x] Add server-validated `draft`, `active`, and `archived` transitions
  - [x] Use `db.transaction` plus `FOR UPDATE` and a post-lock status re-check
  - [x] Prevent student visibility and workflow writes for drafts/archived assignments as specified
  - [x] Preserve `deletedAt` as a separate destructive soft-delete concept
  - [x] Write assignment lifecycle audit events
- [x] Task: Update assignment list/detail/dashboard data paths [commit: c39cd2d]
  - [x] Add authorized context filters to instructor and student assignment queries
  - [x] Include context and lifecycle fields in existing DTOs
  - [x] Preserve pagination, effective deadlines, authorization, and existing dashboard behavior
  - [x] Add query-key factory entries for new context filters where client caching is used
- [x] Task: Run Phase 3 Green and regression verification [commit: c39cd2d]
  - [x] Run assignment unit and integration tests
  - [x] Run affected dashboard, calendar, gradebook, notification, submission, and review tests
  - [x] Confirm no existing individual-assignment state transition changed
- [x] Task: Phase Verification & Checkpoint (Refer to `workflow.md`) [checkpoint: c39cd2d]

## Phase 4: Clone & Semester Rollover

**Objective:** Add atomic, auditable, history-safe creation of independent assignments from existing configuration.

- [x] Task: Write failing clone/rollover tests (Red) [commit: 2c78620]
  - [x] Add `tests/unit/server/assignment-clone-rollover.test.ts`
  - [x] Test source ownership and target-section authorization
  - [x] Test configuration-only copying and explicit target context
  - [x] Test no automatic student copying
  - [x] Test fresh checkpoint identity/state and absence of submissions, reviews, audit history, and released grades
  - [x] Test source assignment remains unchanged
  - [x] Test invalid target terms/sections and archived/draft source behavior
  - [x] Add integration tests for rollback and concurrent clone requests
- [x] Task: Implement clone and rollover server contracts [commit: ea679f3]
  - [x] Add validated inputs and typed stubs using the established assignment server split
  - [x] Define explicit deadline/configuration input rules without relative-date inference
- [x] Task: Implement transactional clone/rollover handlers [commit: 9f883b7]
  - [x] Lock and re-check the source and target context inside a transaction
  - [x] Create a new draft assignment with fresh configuration/checkpoint records
  - [x] Require explicit student selection after creation
  - [x] Preserve the source assignment and all historical records
  - [x] Record source/target identifiers in audit details without copying academic content
- [x] Task: Run Phase 4 Green verification [commit: d8a6ddf, 1637ba3]
  - [x] Run focused unit and database integration tests
  - [x] Verify rollback leaves no partial assignment, enrollment, or checkpoint rows
  - [x] Verify clone output is independently mutable
- [x] Task: Phase Verification & Checkpoint (Refer to `workflow.md`) [checkpoint: 1637ba3]

## Phase 5: Bilingual Admin, Instructor, and Student UI

**Objective:** Make academic context, lifecycle, filters, and clone/rollover usable through accessible responsive surfaces.

- [x] Task: Write failing UI and route tests (Red) [commit: 5dfdcf6]
  - [x] Add admin academic-context route/component tests for terms, courses, sections, and enrollment management
  - [x] Add instructor assignment-form tests for context selection, authorized students, mode, lifecycle, and clone/rollover
  - [x] Add student/instructor list and detail tests for context visibility and lifecycle states
  - [x] Add tests for loading, empty, validation, authorization, server-error, and confirmation states
  - [x] Add i18n parity/source-contract tests for all new keys
- [x] Task: Add bilingual translation keys and generated types [commit: ab876a5]
  - [x] Add English and Indonesian keys for academic context, lifecycle, filters, forms, clone/rollover, and errors
  - [x] Run `pnpm generate:i18n`
  - [x] Run `pnpm check:i18n` and `pnpm check:i18n:unused`
- [x] Task: Implement admin context-management UI
  - [x] Add routes/components following existing admin users/templates patterns [commit: bc2004e]
  - [x] Provide responsive list/detail/forms for terms, courses, sections, and enrollments [commit: bc2004e]
  - [x] Add accessible archive and enrollment confirmation flows [commit: bc2004e]
   - [x] Use TanStack Query factories and mutation invalidation consistently [commit: c37da29]
- [x] Task: Integrate context into instructor assignment surfaces [commit: 6b9c4df, b1817ad]
  - [x] Add section selection and authorized student filtering to the assignment wizard [commit: 6b9c4df]
  - [x] Add lifecycle controls and status feedback [commit: b1817ad]
  - [x] Add clone/rollover flow with explicit target section and configuration review [commit: b1817ad]
  - [x] Display course, term, and section context on assignment list/detail surfaces [commit: b1817ad]
- [x] Task: Update student and shared surfaces [commit: 5234ed5]
  - [x] Display authorized academic context on student assignments and relevant dashboard cards [commit: 5234ed5]
  - [x] Add context-aware empty and archived states [commit: 5234ed5]
  - [x] Preserve mobile layouts, keyboard navigation, focus states, semantic labels, and reduced-motion behavior [commit: 5234ed5]
- [x] Task: Run Phase 5 Green verification [commit: 5234ed5, bd6c076]
  - [x] Run focused route/component tests
  - [x] Run i18n checks and accessibility-focused component tests
  - [x] Verify no hardcoded user-visible strings or raw server errors were introduced
- [x] Task: Phase Verification & Checkpoint (Refer to `workflow.md`) [checkpoint: 5234ed5]

## Phase 6: End-to-End Coverage, Documentation & Quality Gates

**Objective:** Verify cross-role behavior, migration safety, and complete repository quality gates.

- [x] Task: Write failing E2E coverage (Red) [commit pending]
  - [x] Add an academic-context E2E spec covering admin setup, enrollment, instructor assignment creation, and student visibility
  - [x] Cover draft/active/archive transitions and unauthorized access
  - [x] Cover clone and semester rollover with source-history preservation
  - [x] Add mobile and axe-core checks for new surfaces
- [ ] Task: Implement and stabilize E2E fixtures
  - [ ] Extend isolated test database seed/reset helpers with terms, courses, sections, and memberships
  - [ ] Keep test data deterministic and role-specific
  - [ ] Add negative fixtures for cross-section and inactive-user authorization
- [ ] Task: Update project documentation
  - [ ] Update `docs/TDD.md` with the final schema, relations, indexes, and server-function boundaries
  - [ ] Update relevant `docs/PRD.md` data-model and assignment-context sections
  - [ ] Document the prelaunch migration/reset assumption and future legacy-import requirement
  - [ ] Record implementation outcomes and downstream coordination in `docs/roadmap.md`
- [ ] Task: Run complete verification
  - [ ] Run `pnpm test`
  - [ ] Run `pnpm test:integration`
  - [ ] Run `pnpm test:coverage` and confirm all thresholds remain at least 80%
  - [ ] Run `pnpm typecheck`
  - [ ] Run `pnpm lint`
  - [ ] Run `pnpm check:i18n`
  - [ ] Run `pnpm build`
  - [ ] Run focused and full applicable Playwright projects, including accessibility checks
  - [ ] Run modularity validation on all changed source, test, and script files
- [ ] Task: Phase Verification & Checkpoint (Refer to `workflow.md`)
