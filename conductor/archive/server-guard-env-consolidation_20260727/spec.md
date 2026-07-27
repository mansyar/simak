<protect>
# Track: Server-Side Guard Consolidation & Env Type Consolidation (TRACK-031)

## Overview

Infrastructure refactor to eliminate duplicated role-check helper functions across 20 `*.server.ts` files and consolidate the redundant `Env` type reconstruction in `src/config/env.ts`. No product impact, no behavioral changes — identical logic centralized into a single shared module.

**Audit IDs:** INFRA-1 (role-check helper duplication), INFRA-7 (redundant Env type reconstruction in `env.ts`)

**Track Type:** Refactor

## Context Anchors (Traceability)

- **PRD Reference:** N/A (infrastructure refactor, no product impact)
- **TDD Reference:** `AGENTS.md` → "Server function split" (handlers in `*.server.ts`); `src/lib/types.ts` (already exports `NonNullableSession` type used by all guards); `src/lib/errors.ts` (centralized error infrastructure pattern — guards should follow the same single-source principle)
- **Roadmap Reference:** `docs/roadmap.md` → TRACK-031 (Milestone 10 — Infrastructure Consistency & Tech Debt Remediation)

## Track Tech Stack

- TypeScript (shared module creation — no new dependencies)
- `src/lib/types.ts` (existing — `NonNullableSession` type already defined here, 33 lines)
- `src/lib/session-guards.ts` (NEW — 4 guard functions, client-safe, no server-only imports)
- `src/server/*.server.ts` (20 files with 28 duplicate guard definitions to refactor)
- `src/server/auth.ts` (existing — `requireRole` function to refactor null-check via `isAuthenticated`)
- `src/config/env.ts` (existing, 56 lines — Env type consolidation, remove redundant `r2Schema` and `baseSchema`)
- `tests/unit/config/env.test.ts` (existing — must pass unchanged after Env type consolidation)

## Scope Boundaries

### In Scope

1. **Create shared `src/lib/session-guards.ts` module** exporting 4 type-guard functions:
   - `isAdmin(session: NonNullableSession | null): session is NonNullableSession` — returns `!!session && (session.user.role === 'superadmin' || session.user.role === 'admin')`
   - `isInstructor(session: NonNullableSession | null): session is NonNullableSession` — returns `!!session && session.user.role === 'instructor'`
   - `isStudent(session: NonNullableSession | null): session is NonNullableSession` — returns `!!session && session.user.role === 'student'`
   - `isAuthenticated(session: NonNullableSession | null): session is NonNullableSession` — returns `!!session`
   - All accept `NonNullableSession | null` (imported from `src/lib/types.ts`) and return `session is NonNullableSession`
   - Module is client-safe (no server-only imports — no drizzle, no DB, no auth config)

2. **Replace 28 duplicate inline guard definitions** across 20 `*.server.ts` files with imports from the shared module:
   - `analytics-admin.server.ts`, `analytics-export.server.ts`, `analytics-instructor.server.ts`
   - `assignments.server.ts`, `assignments-extras.server.ts`
   - `consultations.server.ts`
   - `dashboard-admin.server.ts`, `dashboard-instructor.server.ts`, `dashboard-student.server.ts`
   - `extensions.server.ts`, `extensions-extras.server.ts`
   - `files.server.ts`
   - `gradebook.server.ts`
   - `instructor-assignments-filter.server.ts`
   - `notifications.server.ts`
   - `reviews.server.ts`, `reviews-extras.server.ts`
   - `rubrics.server.ts`
   - `submissions.server.ts`
   - `templates.server.ts`
   - Remove the local `function isAdmin/isInstructor/isStudent/isAuthenticated(...)` definitions and add `import { ... } from '../lib/session-guards'`

3. **Refactor `requireRole` in `src/server/auth.ts`** to use the shared `isAuthenticated` guard:
   - Replace `if (!session)` null-check with `if (!isAuthenticated(session))` — centralizes the null-check pattern through the shared module
   - Keep `roles.includes(session.user.role)` array-membership check unchanged (different concern — accepts arbitrary role arrays, not single-role checks)
   - Keep redirect side-effects unchanged
   - Import `isAuthenticated` from `../lib/session-guards` (client-safe import — `auth.ts` is the client-safe stub)

4. **Consolidate `Env` type derivation in `src/config/env.ts`:**
   - Replace the manual type reconstruction `export type Env = z.infer<typeof baseSchema> & Partial<z.infer<typeof r2Schema>> & { MIGRATE_DATABASE_URL?: string; EMAIL_FROM: string }` with `export type Env = z.infer<typeof envSchema>`
   - Remove the now-redundant `r2Schema` constant (5 fields redefined in `envSchema` with plain `.optional()`)
   - Remove the now-redundant `baseSchema` constant (6 fields extended into `envSchema`)
   - The detailed validation messages in `baseSchema`/`r2Schema` were never surfaced separately — `envSchema` redefined those fields with plain `.optional()` (R2 fields) or the same validation (`baseSchema` fields are extended, so their messages are preserved via `.extend()`)
   - **Resulting `Env` type shape must be identical:** all 6 base fields required, all 5 R2 fields optional, `MIGRATE_DATABASE_URL` optional, `EMAIL_FROM` required with default

5. **Unit tests for `src/lib/session-guards.ts`:**
   - Each guard: accepts the correct role (returns `true`, narrows type)
   - Each guard: rejects wrong role (returns `false`)
   - Each guard: handles `null` input (returns `false`)
   - `isAdmin`: accepts both `superadmin` and `admin`, rejects `instructor` and `student`
   - `isAuthenticated`: accepts any non-null session, rejects `null`

### Out of Scope

- Refactoring the `createServerFn` type system (deferred to TRACK-032 — Type-Safety Restoration)
- Changes to `NonNullableSession` type itself (already correct in `src/lib/types.ts`)
- Any behavioral change to the guards (identical logic, just centralized)
- Adding new guard functions not already duplicated in the codebase
- Adding a `hasRole(session, roles[])` helper (the `roles.includes()` pattern in `requireRole` is a different concern — array membership, not single-role type narrowing)
- Changes to route guard layouts (`_authenticated.tsx`, `_authenticated/admin.tsx`, etc.) — they call `requireRole` and benefit indirectly
- Changes to `auth.server.ts` (session handler with caching — no guard logic there)

## Acceptance Criteria / Definition of Done

### Manual Checkpoint
- [ ] Run `pnpm dev` — app starts, login works for all roles (superadmin, admin, instructor, student), role-guarded routes redirect correctly (e.g., student accessing `/admin` → redirect to student dashboard)
- [ ] Run `pnpm typecheck` — 0 errors (the `Env` type shape must match — all R2 fields optional, `MIGRATE_DATABASE_URL` optional, `EMAIL_FROM` required with default)
- [ ] Verify `src/config/env.ts` no longer contains `r2Schema` or `baseSchema` constants — `Env` type is `z.infer<typeof envSchema>` (single source of truth)
- [ ] Verify `src/lib/session-guards.ts` exists with 4 exported functions

### Automated Tests
- [ ] `pnpm test:unit` — all existing tests pass unchanged
- [ ] New tests for `src/lib/session-guards.ts` pass (each guard: accepts correct role, rejects wrong role, handles null)
- [ ] Existing `tests/unit/config/env.test.ts` passes unchanged (validates the `Env` type shape is identical)
- [ ] `pnpm test:coverage` ≥80% on all thresholds (lines, functions, branches, statements)
- [ ] `pnpm typecheck` clean
- [ ] `pnpm lint` — 0 warnings, 0 errors

### Conductor Review
- [ ] `src/lib/session-guards.ts` exists with 4 exported functions (`isAdmin`, `isInstructor`, `isStudent`, `isAuthenticated`)
- [ ] Grep `function (isAdmin|isInstructor|isStudent|isAuthenticated)\(` in `src/server/` returns zero matches (all replaced with imports)
- [ ] `requireRole` in `src/server/auth.ts` uses `isAuthenticated` from `../lib/session-guards`
- [ ] `src/config/env.ts` has no `r2Schema` or `baseSchema` constants (grep returns zero matches)
- [ ] `Env` type is `z.infer<typeof envSchema>` (single source of truth)
- [ ] All files under 500 lines
- [ ] Pre-push gate passes
</protect>
