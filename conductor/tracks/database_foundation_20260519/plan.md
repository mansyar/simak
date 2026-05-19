# Implementation Plan: Database Foundation

## Phase 1: Dependencies & Configuration [checkpoint: b3a753a]

- [x] Task: Install Dependencies & Create Drizzle Config
  - [x] Install `postgres` (runtime) and `drizzle-kit` (dev) via pnpm
  - [x] Create `drizzle.config.ts` with PostgreSQL dialect, schema path (`src/db/schema/`), migration output (`drizzle/migrations/`), using **relative imports** (not `@/` path aliases) since Drizzle Kit resolves from project root
  - [x] Add Drizzle Kit scripts to `package.json`: `"db:generate": "drizzle-kit generate"`, `"db:migrate": "tsx src/db/migrate.ts"`, `"db:push": "drizzle-kit push"`
- [x] Task: Add Environment Variables & Update Validation
  - [ ] Add `SUPERADMIN_EMAIL` and `SUPERADMIN_PASSWORD` to `src/config/env.ts` Zod schema (deferred to Green Phase)
  - [x] Add placeholder values to `.env.example`
- [x] Task: Update Existing Tests & Coverage Config (Red Phase) [b2c00ad]
  - [x] Update `tests/unit/config/env.test.ts` — add `SUPERADMIN_EMAIL` and `SUPERADMIN_PASSWORD` to all existing test cases that set valid env vars (5 current test cases need updating)
  - [x] Add `src/db/schema/**` to coverage exclude list in `vite.config.ts`
  - [x] Run all existing tests and confirm they **fail** (env schema will reject missing new vars)
- [x] Task: Implement Config & Pass Tests (Green Phase) [b2c00ad]
  - [x] Add `SUPERADMIN_EMAIL` and `SUPERADMIN_PASSWORD` to the Zod schema in `src/config/env.ts`
  - [x] Run all tests and confirm they pass
- [x] Task: Conductor - User Manual Verification 'Phase 1: Dependencies & Configuration' (Protocol in workflow.md) [b3a753a]

## Phase 2: Database Client & Migration Runner [checkpoint: 9a894e6]

- [x] Task: Create Minimal Client Stub & Write Tests
  - [x] Create minimal `src/db/index.ts` stub with exported type placeholder (so imports resolve)
  - [x] Write tests for `src/db/index.ts` — verify exported shape, types, and that client has expected methods
  - [x] Run tests and confirm they **fail** (stub doesn't implement the interface yet)
- [x] Task: Implement Database Client & Migration Runner (Green Phase) [3f50306]
  - [x] Create `src/db/index.ts` — initialize postgres.js client with `DATABASE_URL`, wrap with Drizzle ORM, export typed `db` instance
  - [x] Create `src/db/migrate.ts` — programmatic runner using Drizzle's `migrate` API from `drizzle-orm/postgres-js/migrator`. This is what `pnpm db:migrate` executes via `tsx`
  - [x] Run tests and confirm they pass
- [x] Task: Conductor - User Manual Verification 'Phase 2: Database Client & Migration Runner' (Protocol in workflow.md) [9a894e6]

## Phase 3: User & Auth Schema [checkpoint: 3b799ed]

- [x] Task: Write User Schema Tests (Red Phase) [8f1f3c0]
  - [x] Write tests for `users` table schema — verify columns, types, primary key, unique constraint on email
  - [x] Write tests for `password_reset_tokens` table — verify columns, FK to users, unique index on `token`
  - [x] Run tests and confirm they fail
- [x] Task: Implement User Schema (Green Phase) [8f1f3c0]
  - [x] Create `src/db/schema/users.ts` with `users` table (id, name, email, role, locale, timestamps, soft delete)
  - [x] Create `password_reset_tokens` table with FK to users, unique **index** on `token`, expiresAt, used flag
  - [x] Run tests and confirm they pass
- [x] Task: Conductor - User Manual Verification 'Phase 3: User & Auth Schema' (Protocol in workflow.md) [3b799ed]

## Phase 4: Template Schema [checkpoint: 297d769]

- [x] Task: Write Template Schema Tests (Red Phase) [297d769]
  - [x] Write tests for `assignment_templates` table — verify columns, FK to users
  - [x] Write tests for `template_checkpoints` table — verify columns, FK to templates, order uniqueness
  - [x] Run tests and confirm they fail
- [x] Task: Implement Template Schema (Green Phase) [297d769]
  - [x] Create `src/db/schema/templates.ts` with both tables
  - [x] Run tests and confirm they pass
- [x] Task: Conductor - User Manual Verification 'Phase 4: Template Schema' (Protocol in workflow.md) [297d769]

## Phase 5: Assignment Schema [checkpoint: 45a22f6]

- [x] Task: Write Assignment Schema Tests (Red Phase) [45a22f6]
  - [x] Write tests for `assignments` table — verify columns, FK to templates and users
  - [x] Write tests for `assignment_students` table — verify columns, FK to assignments and users
  - [x] Write tests for `checkpoints` table — verify columns, FK to assignments, state enum, and **index** on `assignmentId`
  - [x] Run tests and confirm they fail
- [x] Task: Implement Assignment Schema (Green Phase) [45a22f6]
  - [x] Create `src/db/schema/assignments.ts` with all three tables
  - [x] Add **index** on `checkpoints.assignmentId` (inline in the schema file)
  - [x] Run tests and confirm they pass
- [x] Task: Conductor - User Manual Verification 'Phase 5: Assignment Schema' (Protocol in workflow.md) [45a22f6]

## Phase 6: Submission & Review Schema [checkpoint: 45a22f6]

- [x] Task: Write Submission & Review Tests (Red Phase) [45a22f6]
  - [x] Write tests for `submissions` table — verify columns, FK to checkpoints/users, version logic, and **indexes** on `checkpointId` and `uploadedBy`
  - [x] Write tests for `reviews` table — verify columns, FK to submissions/users, and **index** on `submissionId`
  - [x] Run tests and confirm they fail
- [x] Task: Implement Submission & Review Schema (Green Phase) [45a22f6]
  - [x] Create `src/db/schema/submissions.ts` with submissions + reviews tables
  - [x] Add **indexes** on `submissions.checkpointId`, `submissions.uploadedBy`, and `reviews.submissionId` (inline in the schema file)
  - [x] Run tests and confirm they pass
- [x] Task: Conductor - User Manual Verification 'Phase 6: Submission & Review Schema' (Protocol in workflow.md) [45a22f6]

## Phase 7: Consultation & Notification Schema [checkpoint: 45a22f6]

- [x] Task: Write Consultation & Notification Tests (Red Phase) [45a22f6]
  - [x] Write tests for `consultations` table — verify columns, FK to assignments/checkpoints/users, and **indexes** on `checkpointId` and `status`
  - [x] Write tests for `notifications` table — verify columns, FK to users, jsonb metadata, and **composite index** on `(userId, read)`
  - [x] Run tests and confirm they fail
- [x] Task: Implement Consultation & Notification Schema (Green Phase) [45a22f6]
  - [x] Create `src/db/schema/consultations.ts` with consultations table
  - [x] Create `src/db/schema/notifications.ts` with notifications table
  - [x] Add **indexes** on `consultations.checkpointId`, `consultations.status`, and composite index on `notifications.(userId, read)` (inline in their respective schema files)
  - [x] Run tests and confirm they pass
- [x] Task: Conductor - User Manual Verification 'Phase 7: Consultation & Notification Schema' (Protocol in workflow.md) [45a22f6]

## Phase 8: Barrel Export & Relations [checkpoint: 4dc640a]

- [x] Task: Write Relations Tests (Red Phase) [4dc640a]
  - [x] Write tests verifying all 14 Drizzle relations are defined between correct tables
  - [x] Run tests and confirm they fail
- [x] Task: Implement Barrel Export & Relations (Green Phase) [4dc640a]
  - [x] Create `src/db/schema/index.ts` — re-export all schemas, define Drizzle relations for all 14 FK relationships
  - [x] Re-run all schema + relation tests and confirm they pass
- [x] Task: Conductor - User Manual Verification 'Phase 8: Barrel Export & Relations' (Protocol in workflow.md) [4dc640a]

## Phase 9: SuperAdmin Seed Script [checkpoint: 7ac52f9]

- [x] Task: Write Seed Script Tests (Red Phase) [7ac52f9]
  - [x] Write tests for `src/db/seed.ts` — verify SuperAdmin creation with correct role, email, hashed password, and env-var-based credentials
  - [x] Write tests verifying **idempotency** — running seed twice does not throw or duplicate (uses `ON CONFLICT DO NOTHING` or existence check)
  - [x] Run tests and confirm they fail
- [x] Task: Implement Seed Script (Green Phase) [7ac52f9]
  - [x] Create `src/db/seed.ts` — read `SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD` from env, hash password, insert user with role `superadmin`
  - [x] **Idempotency guard** — use `ON CONFLICT (email) DO NOTHING` to handle re-runs safely
  - [x] Run tests and confirm they pass
- [x] Task: Conductor - User Manual Verification 'Phase 9: SuperAdmin Seed Script' (Protocol in workflow.md) [7ac52f9]

## Phase 10: Migration Generation & End-to-End Verification [checkpoint: 6611088]

## Phase: Review Fixes

- [x] Task: Apply review suggestions [7aa6e28]

- [x] Task: Generate Migration SQL Programmatically [6611088]
  - [x] Run `pnpm db:generate` (`drizzle-kit generate`) — confirm exit code 0
  - [x] Verify migration SQL files created in `drizzle/migrations/`
  - [x] Verify migration contains all tables, indexes, and foreign keys from schema
- [x] Task: Run Full Test Suite & Documentation [6611088]
  - [x] Run `pnpm test:coverage` — confirm all tests pass with >80% coverage
  - [x] Run `pnpm typecheck` — confirm no TypeScript errors
  - [x] Update `docs/TDD.md` — add `SUPERADMIN_EMAIL` and `SUPERADMIN_PASSWORD` to the Environment Variables table in section 12
  - [x] Update `docs/ROADMAP.md` — fix test path reference (`tests/unit/env.test.ts` → `tests/unit/config/env.test.ts`)
- [x] Task: Conductor - User Manual Verification 'Phase 10: Migration Generation & End-to-End Verification' (Protocol in workflow.md) [6611088]
