# Implementation Plan: TRACK-033 — Server-Function Architecture Standardization

## Phase 1: Documentation — Server-Function Split Taxonomy [checkpoint: c9628c5]

- [x] Task: Update AGENTS.md with 4-pattern server-function split taxonomy (0e80240)
    - [ ] Document Standard pair pattern (default `*.ts` + `*.server.ts`) with decision criteria, referencing `src/server/assignments.ts` + `assignments.server.ts` as canonical example
    - [ ] Document Extras variant pattern (`*-extras.server.ts`) with decision criteria (when file would exceed 500-line limit), referencing `assignments-extras.server.ts` and `reviews-extras.server.ts`
    - [ ] Document Multi-handler pattern (multiple `*.server.ts` for role-separated logic) with decision criteria, referencing `dashboard-instructor.server.ts`, `dashboard-student.server.ts`, `dashboard-admin.server.ts`
    - [ ] Document Handler-only pattern (no `*.ts` stub, internal helper) with decision criteria
    - [ ] Document acceptable type-only circular dependency pattern (`import type { Schema }`) with rationale (erased at compile time, no runtime impact)
- [x] Task: Conductor - User Manual Verification 'Phase 1: Documentation' (Protocol in workflow.md)

## Phase 2: setup-password.ts Two-File Split Refactor [checkpoint: bfa0c529]

- [x] Task: Write failing tests for the new two-file split pattern (Red Phase)
    - [ ] Locate existing test file for setup-password (check `tests/unit/server/setup-password.test.ts` or equivalent)
    - [ ] Update/create test file with `/** @vitest-environment node */` header
    - [ ] Mock `@tanstack/react-start` with `typedServerFn` builder chain (matching canonical pattern from `tests/unit/server/submissions.test.ts`)
    - [ ] Mock `@/server/auth` (`getSessionFromHeaders`) and `@/db/index` (`getDb`)
    - [ ] Write tests asserting `serverError()` return type on error cases (invalid token, expired token, user not found)
    - [ ] Write tests asserting success case returns correct shape
    - [ ] Run `pnpm test` and confirm new/updated tests fail as expected
- [x] Task: Implement the two-file split (Green Phase) (5b8d757)
    - [ ] Create `src/server/setup-password.server.ts` with `completePasswordSetupHandler` using `serverError(ErrorCode.X, message)` from `src/lib/errors.ts`
    - [ ] Refactor `src/server/setup-password.ts` to stub-only: Zod schema + `typedServerFn` stub with dynamic import of handler
    - [ ] Add `logError` calls for structured error logging on failure paths
    - [ ] Run `pnpm test` and confirm all tests now pass
- [x] Task: Verify quality gates for Phase 2
    - [x] Run `pnpm typecheck` — 0 errors
    - [x] Run `pnpm test:coverage` — ≥80% on all thresholds (lines, statements, branches, functions)
    - [x] Run `pnpm lint` — 0 warnings, 0 errors
    - [x] Verify `src/server/setup-password.ts` and `src/server/setup-password.server.ts` are each under 500 lines
- [x] Task: Conductor - User Manual Verification 'Phase 2: setup-password Refactor' (Protocol in workflow.md)

## Phase 3: Audit-Log Naming + Circular Dependency Audit

- [x] Task: Rename audit-log server files and update imports
    - [x] Rename `src/server/audit-logs.ts` → `src/server/audit-log.ts` (git mv)
    - [x] Rename `src/server/audit-logs.server.ts` → `src/server/audit-log.server.ts` (git mv)
    - [x] Grep for all import references to `audit-logs` across `src/` and `tests/` (both `@/server/audit-logs` and relative paths)
    - [x] Update all import paths from `audit-logs` to `audit-log`
    - [x] Update test file imports (`tests/unit/server/audit-logs.test.ts` → `audit-log.test.ts` if file rename needed)
    - [x] Run `pnpm typecheck` to verify no broken imports remain
- [x] Task: Write/update tests for renamed audit-log module (Red Phase)
    - [x] Update test imports from `@/server/audit-logs` to `@/server/audit-log`
    - [x] Rename test file if needed (`audit-logs.test.ts` → `audit-log.test.ts`)
    - [x] Run `pnpm test` and confirm all audit-log tests pass
- [x] Task: Audit and address circular dependencies (INFRA-3)
    - [x] Run circular dependency analysis via `codebase_graph_circular` (or equivalent `pnpm` tooling)
    - [x] Classify each of the 34 chains as type-only (`import type`) or runtime value import
    - [x] For type-only cycles: verify erased at compile time, document as acceptable (already covered in Phase 1 AGENTS.md update)
    - [x] For runtime value cycles: extract shared schema/type to a `types.ts` (or `_shared.ts`) file that both modules import from — N/A: no runtime value cycles found in server-function layer
    - [x] Re-run circular dependency check to verify runtime cycles are resolved — N/A: no runtime cycles to resolve
- [ ] Task: Verify quality gates for Phase 3
    - [ ] Run `pnpm typecheck` — 0 errors
    - [ ] Run `pnpm test:coverage` — ≥80% on all thresholds
    - [ ] Run `pnpm lint` — 0 warnings, 0 errors
    - [ ] Run `pnpm check:i18n` — parity maintained
    - [ ] Verify all files under 500 lines
    - [ ] Verify circular dependency chains are all type-only (no runtime value imports remaining)
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Naming + Circular Deps' (Protocol in workflow.md)
