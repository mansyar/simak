# Implementation Plan: Database Foundation

## Phase 1: Dependencies & Configuration

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
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Dependencies & Configuration' (Protocol in workflow.md)

## Phase 2: Database Client & Migration Runner

- [ ] Task: Create Minimal Client Stub & Write Tests
  - [ ] Create minimal `src/db/index.ts` stub with exported type placeholder (so imports resolve)
  - [ ] Write tests for `src/db/index.ts` — verify exported shape, types, and that client has expected methods
  - [ ] Run tests and confirm they **fail** (stub doesn't implement the interface yet)
- [ ] Task: Implement Database Client & Migration Runner (Green Phase)
  - [ ] Create `src/db/index.ts` — initialize postgres.js client with `DATABASE_URL`, wrap with Drizzle ORM, export typed `db` instance
  - [ ] Create `src/db/migrate.ts` — programmatic runner using Drizzle's `migrate` API from `drizzle-orm/postgres-js/migrator`. This is what `pnpm db:migrate` executes via `tsx`
  - [ ] Run tests and confirm they pass
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Database Client & Migration Runner' (Protocol in workflow.md)

## Phase 3: User & Auth Schema

- [ ] Task: Write User Schema Tests (Red Phase)
  - [ ] Write tests for `users` table schema — verify columns, types, primary key, unique constraint on email
  - [ ] Write tests for `password_reset_tokens` table — verify columns, FK to users, unique index on `token`
  - [ ] Run tests and confirm they fail
- [ ] Task: Implement User Schema (Green Phase)
  - [ ] Create `src/db/schema/users.ts` with `users` table (id, name, email, role, locale, timestamps, soft delete)
  - [ ] Create `password_reset_tokens` table with FK to users, unique **index** on `token`, expiresAt, used flag
  - [ ] Run tests and confirm they pass
- [ ] Task: Conductor - User Manual Verification 'Phase 3: User & Auth Schema' (Protocol in workflow.md)

## Phase 4: Template Schema

- [ ] Task: Write Template Schema Tests (Red Phase)
  - [ ] Write tests for `assignment_templates` table — verify columns, FK to users
  - [ ] Write tests for `template_checkpoints` table — verify columns, FK to templates, order uniqueness
  - [ ] Run tests and confirm they fail
- [ ] Task: Implement Template Schema (Green Phase)
  - [ ] Create `src/db/schema/templates.ts` with both tables
  - [ ] Run tests and confirm they pass
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Template Schema' (Protocol in workflow.md)

## Phase 5: Assignment Schema

- [ ] Task: Write Assignment Schema Tests (Red Phase)
  - [ ] Write tests for `assignments` table — verify columns, FK to templates and users
  - [ ] Write tests for `assignment_students` table — verify columns, FK to assignments and users
  - [ ] Write tests for `checkpoints` table — verify columns, FK to assignments, state enum, and **index** on `assignmentId`
  - [ ] Run tests and confirm they fail
- [ ] Task: Implement Assignment Schema (Green Phase)
  - [ ] Create `src/db/schema/assignments.ts` with all three tables
  - [ ] Add **index** on `checkpoints.assignmentId` (inline in the schema file)
  - [ ] Run tests and confirm they pass
- [ ] Task: Conductor - User Manual Verification 'Phase 5: Assignment Schema' (Protocol in workflow.md)

## Phase 6: Submission & Review Schema

- [ ] Task: Write Submission & Review Tests (Red Phase)
  - [ ] Write tests for `submissions` table — verify columns, FK to checkpoints/users, version logic, and **indexes** on `checkpointId` and `uploadedBy`
  - [ ] Write tests for `reviews` table — verify columns, FK to submissions/users, and **index** on `submissionId`
  - [ ] Run tests and confirm they fail
- [ ] Task: Implement Submission & Review Schema (Green Phase)
  - [ ] Create `src/db/schema/submissions.ts` with submissions + reviews tables
  - [ ] Add **indexes** on `submissions.checkpointId`, `submissions.uploadedBy`, and `reviews.submissionId` (inline in the schema file)
  - [ ] Run tests and confirm they pass
- [ ] Task: Conductor - User Manual Verification 'Phase 6: Submission & Review Schema' (Protocol in workflow.md)

## Phase 7: Consultation & Notification Schema

- [ ] Task: Write Consultation & Notification Tests (Red Phase)
  - [ ] Write tests for `consultations` table — verify columns, FK to assignments/checkpoints/users, and **indexes** on `checkpointId` and `status`
  - [ ] Write tests for `notifications` table — verify columns, FK to users, jsonb metadata, and **composite index** on `(userId, read)`
  - [ ] Run tests and confirm they fail
- [ ] Task: Implement Consultation & Notification Schema (Green Phase)
  - [ ] Create `src/db/schema/consultations.ts` with consultations table
  - [ ] Create `src/db/schema/notifications.ts` with notifications table
  - [ ] Add **indexes** on `consultations.checkpointId`, `consultations.status`, and composite index on `notifications.(userId, read)` (inline in their respective schema files)
  - [ ] Run tests and confirm they pass
- [ ] Task: Conductor - User Manual Verification 'Phase 7: Consultation & Notification Schema' (Protocol in workflow.md)

## Phase 8: Barrel Export & Relations

- [ ] Task: Write Relations Tests (Red Phase)
  - [ ] Write tests verifying all 14 Drizzle relations are defined between correct tables
  - [ ] Run tests and confirm they fail
- [ ] Task: Implement Barrel Export & Relations (Green Phase)
  - [ ] Create `src/db/schema/index.ts` — re-export all schemas, define Drizzle relations for all 14 FK relationships
  - [ ] Re-run all schema + relation tests and confirm they pass
- [ ] Task: Conductor - User Manual Verification 'Phase 8: Barrel Export & Relations' (Protocol in workflow.md)

## Phase 9: SuperAdmin Seed Script

- [ ] Task: Write Seed Script Tests (Red Phase)
  - [ ] Write tests for `src/db/seed.ts` — verify SuperAdmin creation with correct role, email, hashed password, and env-var-based credentials
  - [ ] Write tests verifying **idempotency** — running seed twice does not throw or duplicate (uses `ON CONFLICT DO NOTHING` or existence check)
  - [ ] Run tests and confirm they fail
- [ ] Task: Implement Seed Script (Green Phase)
  - [ ] Create `src/db/seed.ts` — read `SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD` from env, hash password, insert user with role `superadmin`
  - [ ] **Idempotency guard** — use `ON CONFLICT (email) DO NOTHING` to handle re-runs safely
  - [ ] Run tests and confirm they pass
- [ ] Task: Conductor - User Manual Verification 'Phase 9: SuperAdmin Seed Script' (Protocol in workflow.md)

## Phase 10: Migration Generation & End-to-End Verification

- [ ] Task: Generate Migration SQL Programmatically
  - [ ] Run `pnpm db:generate` (`drizzle-kit generate`) — confirm exit code 0
  - [ ] Verify migration SQL files created in `drizzle/migrations/`
  - [ ] Verify migration contains all tables, indexes, and foreign keys from schema
- [ ] Task: Run Full Test Suite & Documentation
  - [ ] Run `pnpm test:coverage` — confirm all tests pass with >80% coverage
  - [ ] Run `pnpm typecheck` — confirm no TypeScript errors
  - [ ] Update `docs/TDD.md` — add `SUPERADMIN_EMAIL` and `SUPERADMIN_PASSWORD` to the Environment Variables table in section 12
  - [ ] Update `docs/ROADMAP.md` — fix test path reference (`tests/unit/env.test.ts` → `tests/unit/config/env.test.ts`)
- [ ] Task: Conductor - User Manual Verification 'Phase 10: Migration Generation & End-to-End Verification' (Protocol in workflow.md)
