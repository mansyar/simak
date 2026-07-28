# TRACK-033: Server-Function Architecture Standardization

## Overview

This track standardizes the server-function architecture across the SIMAK codebase. It addresses four infrastructure audit findings (INFRA-2, INFRA-3, INFRA-5, INFRA-9) related to inconsistent file-split patterns, circular dependency chains, error-handling inconsistency in `setup-password.ts`, and audit-log file naming mismatch with the DB schema.

The work is purely structural and naming-focused — no new product features, no handler logic changes, no API contract changes, and no database schema changes. TRACK-032 (Type-Safety Restoration) is complete and migrated all 23 server stub files to `typedServerFn`; this track builds on that typed foundation to enforce structural consistency.

## Audit IDs

| ID | Finding |
|----|---------|
| INFRA-2 | Inconsistent server-function split patterns (some files violate the two-file split, no documented taxonomy for valid variants) |
| INFRA-3 | 17 circular dependency chains in the server-function layer |
| INFRA-5 | `setup-password.ts` error handling inconsistency (uses `{ error: string }` instead of canonical `serverError()` + `ErrorCode` pattern) |
| INFRA-9 | Audit-log server file naming inconsistency (`audit-logs.ts` vs schema file `audit-log.ts` and DB table `audit_log`) |

## Context Anchors (Traceability)

- **PRD Reference:** N/A (architecture standardization, no product impact)
- **TDD Reference:** `AGENTS.md` → "Server function split" (documents two calling patterns but not the structural file layout); `conductor/workflow.md` → "Quality Gates" (enforces two-file split: `*.ts` + `*.server.ts`)
- **Code References:**
  - `src/server/assignments.ts` + `assignments.server.ts` + `assignments-extras.server.ts` — canonical Extras variant pattern
  - `src/server/dashboard.ts` + `dashboard-*.server.ts` — canonical Multi-handler pattern
  - `src/server/setup-password.ts` — violates two-file split (schemas + handler + stub in one file)
  - `src/lib/errors.ts` — canonical `serverError()` + `ErrorCode` pattern that setup-password.ts doesn't use
  - `src/lib/server-fn.ts` — `typedServerFn` wrapper introduced by TRACK-032
  - `src/server/audit-logs.ts` + `audit-logs.server.ts` — naming mismatch with `src/db/schema/audit-log.ts`
  - `src/lib/session-guards.ts` — shared guard module (TRACK-031), canonical shared-module pattern

## Track Tech Stack

- TypeScript (architecture refactor — no new dependencies)
- `src/server/*.ts` and `src/server/*.server.ts` (all server function files)
- `src/db/schema/audit-log.ts` → `src/server/audit-logs.ts` (naming inconsistency to fix)
- `src/server/setup-password.ts` (refactor to two-file split)
- `AGENTS.md` (documentation update for split-pattern rules)

## Functional Requirements

### FR-1: Document Server-Function Split Taxonomy (INFRA-2)

Update `AGENTS.md` "Server function split" section with explicit decision criteria for 4 structural patterns. Documentation will include **criteria only** (when to use each pattern), referencing existing files as canonical examples (no inline code snippets):

1. **Standard pair** (default) — `*.ts` (Zod schemas + `typedServerFn` stub with dynamic import) + `*.server.ts` (handler implementation). Example: `src/server/assignments.ts` + `assignments.server.ts`
2. **Extras variant** — `*-extras.server.ts` added when a feature has handlers that would exceed the 500-line limit. Example: `assignments-extras.server.ts`, `reviews-extras.server.ts`
3. **Multi-handler** — Multiple `*.server.ts` files when a feature serves multiple roles with distinct query logic. Example: `dashboard-instructor.server.ts`, `dashboard-student.server.ts`, `dashboard-admin.server.ts`
4. **Handler-only** — No `*.ts` stub file; internal helper never called from client. Example: `*-extras.server.ts` helper functions

### FR-2: Refactor `setup-password.ts` to Two-File Split (INFRA-5)

Split `src/server/setup-password.ts` (currently a single file with schemas + handler + stub) into:

- `src/server/setup-password.ts` — Zod schema + `typedServerFn` stub with dynamic import (consistent with TRACK-032's migration of all 23 server stubs to `typedServerFn`)
- `src/server/setup-password.server.ts` — handler implementation using `serverError(ErrorCode.X, message)` + `ServerError` type from `src/lib/errors.ts` (replacing the current `{ error: string }` return pattern)

Error handling migration:
- Replace `{ error: string }` returns with `serverError(ErrorCode.X, message)` calls
- Add `logError` calls for structured error logging
- Update tests to mock the new two-file pattern (matching the canonical mock pattern from `tests/unit/server/submissions.test.ts`)

### FR-3: Address Circular Dependencies (INFRA-3)

Audit the 17 circular dependency chains:

- **Type-only cycles** (`import type { Schema } from './feature'`): Verify they are erased at compile time (no runtime impact). Document them as acceptable with rationale in `AGENTS.md`.
- **Runtime value import cycles**: Refactor to break the cycle by moving the shared schema/type to a separate `types.ts` (or `_shared.ts`) file that both modules import from. This is the preferred resolution strategy — static, clean, no runtime overhead, consistent with the roadmap guidance.

### FR-4: Fix Audit-Log Naming (INFRA-9)

Rename server files to match the schema file and DB table naming:

- `src/server/audit-logs.ts` → `src/server/audit-log.ts`
- `src/server/audit-logs.server.ts` → `src/server/audit-log.server.ts`

This aligns with `src/db/schema/audit-log.ts` (schema file) and the `audit_log` DB table. Update all import paths across the codebase.

## Non-Functional Requirements

### NFR-1: Zero Behavioral Changes
All changes are purely structural/naming. No handler logic changes, no API contract changes, no database schema changes. Existing tests must pass unchanged (except test files that mock the refactored `setup-password.ts` pattern or import `audit-logs` by old path).

### NFR-2: All Quality Gates Pass
- `pnpm typecheck` — 0 errors
- `pnpm test:unit` — all tests pass
- `pnpm test:coverage` — ≥80% on all thresholds
- `pnpm lint` — 0 warnings, 0 errors
- `pnpm check:i18n` — parity maintained
- All files under 500 lines

### NFR-3: Type Safety Preserved
The `typedServerFn` wrapper (TRACK-032) must be preserved in the new `setup-password.ts` stub. No `as unknown as` casts introduced.

## Acceptance Criteria

1. **AC-1:** `AGENTS.md` documents 4 split patterns with decision criteria, referencing existing files as canonical examples.
2. **AC-2:** `src/server/setup-password.ts` contains only Zod schema + `typedServerFn` stub with dynamic import.
3. **AC-3:** `src/server/setup-password.server.ts` contains the handler using `serverError()` from `src/lib/errors.ts`.
4. **AC-4:** `src/server/audit-log.ts` and `src/server/audit-log.server.ts` exist (renamed from `audit-logs.*`), matching the schema file naming.
5. **AC-5:** All import paths referencing `audit-logs` are updated to `audit-log` across the codebase.
6. **AC-6:** All 17 circular dependency chains are verified — type-only cycles documented as acceptable, any runtime value cycles resolved via shared `types.ts` extraction.
7. **AC-7:** `pnpm typecheck`, `pnpm test:unit`, `pnpm test:coverage`, `pnpm lint`, `pnpm check:i18n` all pass.
8. **AC-8:** Password setup flow works end-to-end (manual verification via `/auth/setup-password?token=...`).
9. **AC-9:** Admin audit log viewer loads correctly after the file rename (manual verification).

## Out of Scope

- Consolidating `*-extras.server.ts` files into main `.server.ts` files (the extras pattern is valid for file-size management — just needs documentation)
- Merging multi-handler `.server.ts` files (the pattern is valid for role-separated logic — just needs documentation)
- Changes to handler logic or API contracts (purely structural/naming)
- Database schema changes (table name stays `audit_log`)
- Refactoring circular dependencies that are type-only and erased at compile time (documented as acceptable)
- Client-side error handling changes beyond what's required by the `serverError()` migration in `setup-password.ts`
