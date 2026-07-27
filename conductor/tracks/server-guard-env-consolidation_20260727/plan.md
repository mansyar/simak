<protect>
# Implementation Plan: Server-Side Guard Consolidation & Env Type Consolidation (TRACK-031)

## Phase 1: Shared Module & Unit Tests

**Objective:** Create the shared `src/lib/session-guards.ts` module with 4 type-guard functions using TDD, and verify it in isolation.

- [ ] Task: Read `spec.md` and `conductor/workflow.md` to establish full context for Phase 1
    - [ ] Read this track's `spec.md` — review scope boundaries, acceptance criteria, and DoD
    - [ ] Read `conductor/workflow.md` — review TDD lifecycle, quality gates, and checkpoint protocol
- [ ] Task: Create `src/lib/session-guards.ts` with 4 type-guard functions (TDD)
    - [ ] **Red Phase:** Write failing tests in `tests/unit/lib/session-guards.test.ts` — `isAdmin` accepts superadmin+admin, rejects instructor+student+null; `isInstructor` accepts instructor, rejects admin+student+null; `isStudent` accepts student, rejects admin+instructor+null; `isAuthenticated` accepts any non-null session, rejects null
    - [ ] Run `pnpm vitest run tests/unit/lib/session-guards.test.ts` — confirm tests fail (module does not exist yet)
    - [ ] **Green Phase:** Implement `src/lib/session-guards.ts` — import `NonNullableSession` from `./types`, export `isAdmin`, `isInstructor`, `isStudent`, `isAuthenticated` (all accept `NonNullableSession | null`, return `session is NonNullableSession`)
    - [ ] Run `pnpm vitest run tests/unit/lib/session-guards.test.ts` — confirm all tests pass
    - [ ] Run `pnpm typecheck` — 0 errors
    - [ ] Run `pnpm lint` — 0 warnings, 0 errors
    - [ ] Run `pnpm test:coverage` — ≥80% on all thresholds (lines, functions, branches, statements)
    - [ ] Commit: `refactor(guards): Create shared session-guards module with 4 type-guard functions`
    - [ ] Attach git note with task summary to the commit
    - [ ] Update `plan.md`: mark task `[x]` with commit SHA
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Shared Module & Unit Tests' (Protocol in workflow.md)

## Phase 2: Guard Migration, requireRole Refactor & Env Consolidation

**Objective:** Replace all 28 duplicate inline guard definitions across 20 `*.server.ts` files with imports from the shared module, refactor `requireRole` to use `isAuthenticated`, and consolidate the `Env` type derivation in `env.ts`.

- [ ] Task: Read `spec.md` and `conductor/workflow.md` to establish full context for Phase 2
    - [ ] Read this track's `spec.md` — review scope boundaries, acceptance criteria, and DoD
    - [ ] Read `conductor/workflow.md` — review TDD lifecycle, quality gates, and checkpoint protocol
- [ ] Task: Migrate 20 server files to shared guards, refactor `requireRole`, and consolidate `Env` type
    - [ ] Migrate analytics files: `analytics-admin.server.ts`, `analytics-export.server.ts`, `analytics-instructor.server.ts` — remove inline guard definitions, add `import { ... } from '../lib/session-guards'`
    - [ ] Migrate assignment files: `assignments.server.ts`, `assignments-extras.server.ts`
    - [ ] Migrate `consultations.server.ts`
    - [ ] Migrate dashboard files: `dashboard-admin.server.ts`, `dashboard-instructor.server.ts`, `dashboard-student.server.ts`
    - [ ] Migrate extension files: `extensions.server.ts`, `extensions-extras.server.ts`
    - [ ] Migrate `files.server.ts`
    - [ ] Migrate `gradebook.server.ts`
    - [ ] Migrate `instructor-assignments-filter.server.ts`
    - [ ] Migrate `notifications.server.ts`
    - [ ] Migrate review files: `reviews.server.ts`, `reviews-extras.server.ts`
    - [ ] Migrate `rubrics.server.ts`
    - [ ] Migrate `submissions.server.ts`
    - [ ] Migrate `templates.server.ts`
    - [ ] Verify: `rg "function (isAdmin|isInstructor|isStudent|isAuthenticated)\(" src/server/` returns zero matches (all 28 inline definitions replaced)
    - [ ] Refactor `requireRole` in `src/server/auth.ts`: add `import { isAuthenticated } from '../lib/session-guards'`, replace `if (!session)` with `if (!isAuthenticated(session))` — keep `roles.includes()` and redirect logic unchanged
    - [ ] Consolidate `Env` type in `src/config/env.ts`: inline the 6 `baseSchema` fields directly into `envSchema` (preserve validation messages), remove `baseSchema` and `r2Schema` constants, change `export type Env = ...` to `export type Env = z.infer<typeof envSchema>`
    - [ ] Run `pnpm typecheck` — 0 errors (verify `Env` type shape is identical: 6 required base fields, 5 optional R2 fields, `MIGRATE_DATABASE_URL` optional, `EMAIL_FROM` required with default)
    - [ ] Run `pnpm test:unit` — all existing tests pass unchanged (including `tests/unit/config/env.test.ts`)
    - [ ] Run `pnpm test:coverage` — ≥80% on all thresholds
    - [ ] Run `pnpm lint` — 0 warnings, 0 errors
    - [ ] Verify all modified files are under 500 lines
    - [ ] Commit: `refactor(guards): Migrate 20 server files to shared guards, consolidate Env type`
    - [ ] Attach git note with task summary to the commit
    - [ ] Update `plan.md`: mark task `[x]` with commit SHA
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Guard Migration, requireRole Refactor & Env Consolidation' (Protocol in workflow.md)
</protect>
