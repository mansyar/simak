<protect>
# Implementation Plan: Server-Side Guard Consolidation & Env Type Consolidation (TRACK-031)

## Phase 1: Shared Module & Unit Tests [checkpoint: 3d3088b]

**Objective:** Create the shared `src/lib/session-guards.ts` module with 4 type-guard functions using TDD, and verify it in isolation.

- [x] Task: Read `spec.md` and `conductor/workflow.md` to establish full context for Phase 1
    - [x] Read this track's `spec.md` — review scope boundaries, acceptance criteria, and DoD
    - [x] Read `conductor/workflow.md` — review TDD lifecycle, quality gates, and checkpoint protocol
- [x] Task: Create `src/lib/session-guards.ts` with 4 type-guard functions (TDD) [71f2d03]
    - [x] **Red Phase:** Write failing tests in `tests/unit/lib/session-guards.test.ts` — `isAdmin` accepts superadmin+admin, rejects instructor+student+null; `isInstructor` accepts instructor, rejects admin+student+null; `isStudent` accepts student, rejects admin+instructor+null; `isAuthenticated` accepts any non-null session, rejects null
    - [x] Run `pnpm vitest run tests/unit/lib/session-guards.test.ts` — confirm tests fail (module does not exist yet)
    - [x] **Green Phase:** Implement `src/lib/session-guards.ts` — import `NonNullableSession` from `./types`, export `isAdmin`, `isInstructor`, `isStudent`, `isAuthenticated` (all accept `NonNullableSession | null`, return `session is NonNullableSession`)
    - [x] Run `pnpm vitest run tests/unit/lib/session-guards.test.ts` — confirm all tests pass
    - [x] Run `pnpm typecheck` — 0 errors
    - [x] Run `pnpm lint` — 0 warnings, 0 errors
    - [x] Run `pnpm test:coverage` — ≥80% on all thresholds (lines, functions, branches, statements)
    - [x] Commit: `refactor(guards): Create shared session-guards module with 4 type-guard functions`
    - [x] Attach git note with task summary to the commit
    - [x] Update `plan.md`: mark task `[x]` with commit SHA
- [x] Task: Conductor - User Manual Verification 'Phase 1: Shared Module & Unit Tests' (Protocol in workflow.md)

## Phase 2: Guard Migration, requireRole Refactor & Env Consolidation

**Objective:** Replace all 28 duplicate inline guard definitions across 20 `*.server.ts` files with imports from the shared module, refactor `requireRole` to use `isAuthenticated`, and consolidate the `Env` type derivation in `env.ts`.

- [x] Task: Read `spec.md` and `conductor/workflow.md` to establish full context for Phase 2
    - [x] Read this track's `spec.md` — review scope boundaries, acceptance criteria, and DoD
    - [x] Read `conductor/workflow.md` — review TDD lifecycle, quality gates, and checkpoint protocol
- [x] Task: Migrate 20 server files to shared guards, refactor `requireRole`, and consolidate `Env` type
    - [x] Migrate analytics files: `analytics-admin.server.ts`, `analytics-export.server.ts`, `analytics-instructor.server.ts` — remove inline guard definitions, add `import { ... } from '../lib/session-guards'`
    - [x] Migrate assignment files: `assignments.server.ts`, `assignments-extras.server.ts`
    - [x] Migrate `consultations.server.ts`
    - [x] Migrate dashboard files: `dashboard-admin.server.ts`, `dashboard-instructor.server.ts`, `dashboard-student.server.ts`
    - [x] Migrate extension files: `extensions.server.ts`, `extensions-extras.server.ts`
    - [x] Migrate `files.server.ts`
    - [x] Migrate `gradebook.server.ts`
    - [x] Migrate `instructor-assignments-filter.server.ts`
    - [x] Migrate `notifications.server.ts`
    - [x] Migrate review files: `reviews.server.ts`, `reviews-extras.server.ts`
    - [x] Migrate `rubrics.server.ts`
    - [x] Migrate `submissions.server.ts`
    - [x] Migrate `templates.server.ts`
    - [x] Verify: `rg "function (isAdmin|isInstructor|isStudent|isAuthenticated)\(" src/server/` returns zero matches (all 28 inline definitions replaced)
    - [x] Refactor `requireRole` in `src/server/auth.ts`: add `import { isAuthenticated } from '../lib/session-guards'`, replace `if (!session)` with `if (!isAuthenticated(session))` — keep `roles.includes()` and redirect logic unchanged
    - [x] Consolidate `Env` type in `src/config/env.ts`: inline the 6 `baseSchema` fields directly into `envSchema` (preserve validation messages), remove `baseSchema` and `r2Schema` constants, change `export type Env = ...` to `export type Env = z.infer<typeof envSchema>`
    - [x] Run `pnpm typecheck` — 0 errors (verify `Env` type shape is identical: 6 required base fields, 5 optional R2 fields, `MIGRATE_DATABASE_URL` optional, `EMAIL_FROM` required with default)
    - [x] Run `pnpm test:unit` — all existing tests pass unchanged (including `tests/unit/config/env.test.ts`)
    - [x] Run `pnpm test:coverage` — ≥80% on all thresholds
    - [x] Run `pnpm lint` — 0 warnings, 0 errors
    - [x] Verify all modified files are under 500 lines
    - [x] Commit: `refactor(guards): Migrate 20 server files to shared guards, consolidate Env type` [870d927]
    - [x] Attach git note with task summary to the commit
    - [x] Update `plan.md`: mark task `[x]` with commit SHA
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Guard Migration, requireRole Refactor & Env Consolidation' (Protocol in workflow.md)
</protect>
