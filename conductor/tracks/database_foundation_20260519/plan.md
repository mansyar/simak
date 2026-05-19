# Implementation Plan: Database Foundation

## Phase 1: Dependencies & Configuration

- [ ] Task: Install Dependencies & Create Drizzle Config
  - [ ] Install `postgres` (runtime) and `drizzle-kit` (dev) via pnpm
  - [ ] Create `drizzle.config.ts` with PostgreSQL dialect, schema path (`src/db/schema/`), migration output (`drizzle/migrations/`)
  - [ ] Add `drizzle-kit` scripts to `package.json`: `"db:generate": "drizzle-kit generate"`, `"db:migrate": "drizzle-kit migrate"`, `"db:push": "drizzle-kit push"`
- [ ] Task: Add Environment Variables & Update Validation
  - [ ] Add `SUPERADMIN_EMAIL` and `SUPERADMIN_PASSWORD` to `src/config/env.ts` Zod schema
  - [ ] Add placeholder values to `.env.example`
- [ ] Task: Write Configuration Tests (Red Phase)
  - [ ] Write tests verifying `SUPERADMIN_EMAIL` and `SUPERADMIN_PASSWORD` env validation (success + missing cases)
  - [ ] Run tests and confirm they fail (no env vars yet)
- [ ] Task: Implement Config & Pass Tests (Green Phase)
  - [ ] Update `src/config/env.ts` to include new env vars
  - [ ] Run tests and confirm they pass
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Dependencies & Configuration' (Protocol in workflow.md)

## Phase 2: Database Client & Migration Runner

- [ ] Task: Write Database Client Tests (Red Phase)
  - [ ] Write tests for `src/db/index.ts` — verify client instantiation, export shape
  - [ ] Run tests and confirm they fail (no db module yet)
- [ ] Task: Implement Database Client & Migration Runner (Green Phase)
  - [ ] Create `src/db/index.ts` — initialize postgres.js client with `DATABASE_URL`, wrap with Drizzle ORM
  - [ ] Create `src/db/migrate.ts` — migration runner using Drizzle's migrate API
  - [ ] Run tests and confirm they pass
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Database Client & Migration Runner' (Protocol in workflow.md)

## Phase 3: User & Auth Schema

- [ ] Task: Write User Schema Tests (Red Phase)
  - [ ] Write tests for `users` table schema — verify columns, types, primary key, unique constraint on email
  - [ ] Write tests for `password_reset_tokens` table — verify columns, FK to users, unique index on token
  - [ ] Run tests and confirm they fail
- [ ] Task: Implement User Schema (Green Phase)
  - [ ] Create `src/db/schema/users.ts` with `users` table (id, name, email, role, locale, timestamps, soft delete)
  - [ ] Create `password_reset_tokens` table with FK to users, unique token, expiresAt, used flag
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
  - [ ] Write tests for `checkpoints` table — verify columns, FK to assignments, state enum
  - [ ] Run tests and confirm they fail
- [ ] Task: Implement Assignment Schema (Green Phase)
  - [ ] Create `src/db/schema/assignments.ts` with all three tables
  - [ ] Run tests and confirm they pass
- [ ] Task: Conductor - User Manual Verification 'Phase 5: Assignment Schema' (Protocol in workflow.md)

## Phase 6: Submission, Review, Consultation & Notification Schema

- [ ] Task: Write Submission/Review/Consultation/Notification Tests (Red Phase)
  - [ ] Write tests for `submissions` table — verify columns, FK to checkpoints/users, version logic
  - [ ] Write tests for `reviews` table — verify columns, FK to submissions/users
  - [ ] Write tests for `consultations` table — verify columns, FK to assignments/checkpoints/users
  - [ ] Write tests for `notifications` table — verify columns, FK to users, jsonb metadata
  - [ ] Run tests and confirm they fail
- [ ] Task: Implement Submission/Review/Consultation/Notification Schema (Green Phase)
  - [ ] Create `src/db/schema/submissions.ts` with submissions + reviews tables
  - [ ] Create `src/db/schema/consultations.ts` with consultations table
  - [ ] Create `src/db/schema/notifications.ts` with notifications table
  - [ ] Run tests and confirm they pass
- [ ] Task: Conductor - User Manual Verification 'Phase 6: Submission, Review, Consultation & Notification Schema' (Protocol in workflow.md)

## Phase 7: Barrel Export, Relations & Indexes

- [ ] Task: Write Relations & Index Tests (Red Phase)
  - [ ] Write tests verifying all 14 Drizzle relations are defined
  - [ ] Write tests verifying all 8 indexes exist (including unique index on password_reset_tokens.token)
  - [ ] Run tests and confirm they fail
- [ ] Task: Implement Barrel Export & Relations (Green Phase)
  - [ ] Create `src/db/schema/index.ts` — re-export all schemas, define Drizzle relations for all FKs
  - [ ] Add all 8 indexes from spec using `index()` and `uniqueIndex()` APIs
  - [ ] Re-run all tests and confirm they pass
- [ ] Task: Conductor - User Manual Verification 'Phase 7: Barrel Export, Relations & Indexes' (Protocol in workflow.md)

## Phase 8: SuperAdmin Seed Script

- [ ] Task: Write Seed Script Tests (Red Phase)
  - [ ] Write tests for `src/db/seed.ts` — verify SuperAdmin creation with correct role, email, hashed password, and env-var-based credentials
  - [ ] Run tests and confirm they fail
- [ ] Task: Implement Seed Script (Green Phase)
  - [ ] Create `src/db/seed.ts` — read SUPERADMIN_EMAIL/PASSWORD from env, hash password, insert user with role `superadmin`
  - [ ] Run tests and confirm they pass
- [ ] Task: Conductor - User Manual Verification 'Phase 8: SuperAdmin Seed Script' (Protocol in workflow.md)

## Phase 9: Migration Generation & End-to-End Verification

- [ ] Task: Generate and Verify Migration SQL
  - [ ] Run `drizzle-kit generate` — confirm exit code 0
  - [ ] Verify migration SQL files created in `drizzle/migrations/`
  - [ ] Verify migration contains all tables, indexes, and foreign keys from schema
- [ ] Task: Run Full Test Suite
  - [ ] Run `pnpm test:coverage` — confirm all tests pass with >80% coverage
  - [ ] Run `pnpm typecheck` — confirm no TypeScript errors
- [ ] Task: Conductor - User Manual Verification 'Phase 9: Migration Generation & End-to-End Verification' (Protocol in workflow.md)
