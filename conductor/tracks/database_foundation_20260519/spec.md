# Specification: Database Foundation

## Overview

Define all Drizzle ORM schema files for the SIMAK database, set up the database client with connection pooling, create migration infrastructure with Drizzle Kit, and write a SuperAdmin seed script. This track establishes every table needed for MVP (v1) and v2 features, even if unused in early tracks, to avoid disruptive schema migrations later.

## Driver & Tooling

- **Database Driver:** `postgres` (postgres.js) — native ESM, lightweight, recommended by Drizzle for modern setups
- **Migration Directory:** `drizzle/migrations/`
- **ORM:** Drizzle ORM with PostgreSQL dialect

## Files to Create

| File                             | Purpose                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------- |
| `drizzle.config.ts`              | Drizzle Kit config (dialect: postgresql, schema path, output dir for migrations) |
| `src/db/index.ts`                | Database client initialization using postgres.js + Drizzle                       |
| `src/db/migrate.ts`              | Migration runner script (runs on startup)                                        |
| `src/db/schema/users.ts`         | `users` table + `password_reset_tokens` table                                    |
| `src/db/schema/templates.ts`     | `assignment_templates` table + `template_checkpoints` table                      |
| `src/db/schema/assignments.ts`   | `assignments` table + `assignment_students` table + `checkpoints` table          |
| `src/db/schema/submissions.ts`   | `submissions` table + `reviews` table                                            |
| `src/db/schema/consultations.ts` | `consultations` table                                                            |
| `src/db/schema/notifications.ts` | `notifications` table                                                            |
| `src/db/schema/index.ts`         | Barrel export — re-exports all schema files and relations                        |
| `src/db/seed.ts`                 | Seed script: create SuperAdmin user with env-based credentials                   |

## Dependencies to Add

- `postgres` (runtime dependency)
- `drizzle-kit` (dev dependency)

## Environment Variables to Add

- `SUPERADMIN_EMAIL` — Email for the seeded SuperAdmin account
- `SUPERADMIN_PASSWORD` — Password for the seeded SuperAdmin account

## Tables (v1)

### users

| Column    | Type                   | Notes                                                                               |
| --------- | ---------------------- | ----------------------------------------------------------------------------------- |
| id        | text (PK)              | UUID                                                                                |
| name      | text, not null         | Full name                                                                           |
| email     | text, unique, not null | Login identifier                                                                    |
| role      | enum, not null         | superadmin \| admin \| instructor \| student                                        |
| locale    | text, default 'en'     | Language preference: 'en' \| 'id'. Used for UI, notifications, and email templates. |
| createdAt | timestamp              |                                                                                     |
| updatedAt | timestamp              |                                                                                     |
| deletedAt | timestamp              | Soft delete                                                                         |

### password_reset_tokens

| Column    | Type                   | Notes                  |
| --------- | ---------------------- | ---------------------- |
| id        | serial (PK)            |                        |
| userId    | text (FK → users)      |                        |
| token     | text, unique, not null | Cryptographic random   |
| expiresAt | timestamp, not null    | 1 hour from creation   |
| used      | boolean, default false | Single-use enforcement |
| createdAt | timestamp              |                        |

### assignment_templates

| Column    | Type              | Notes                           |
| --------- | ----------------- | ------------------------------- |
| id        | serial (PK)       |                                 |
| type      | text, not null    | e.g. "Thesis", "Research Paper" |
| name      | text, not null    | Display name                    |
| createdBy | text (FK → users) | Admin who created it            |
| createdAt | timestamp         |                                 |
| updatedAt | timestamp         |                                 |
| deletedAt | timestamp         | Soft delete                     |

### template_checkpoints

| Column     | Type                                | Notes                           |
| ---------- | ----------------------------------- | ------------------------------- |
| id         | serial (PK)                         |                                 |
| templateId | integer (FK → assignment_templates) |                                 |
| name       | text, not null                      | e.g. "Abstract", "Introduction" |
| order      | integer, not null                   | Position in sequence            |
| createdAt  | timestamp                           |                                 |

### assignments

| Column        | Type                                | Notes                                                                                                   |
| ------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------- |
| id            | serial (PK)                         |                                                                                                         |
| templateId    | integer (FK → assignment_templates) | Template used                                                                                           |
| title         | text, not null                      |                                                                                                         |
| description   | text                                |                                                                                                         |
| finalDeadline | timestamp, not null                 | Soft target deadline — individual checkpoint dueDates enforce locking; finalDeadline is a display/guide |
| instructorId  | text (FK → users)                   |                                                                                                         |
| createdAt     | timestamp                           |                                                                                                         |
| updatedAt     | timestamp                           |                                                                                                         |
| deletedAt     | timestamp                           | Soft delete                                                                                             |

### assignment_students

| Column       | Type                       | Notes |
| ------------ | -------------------------- | ----- |
| id           | serial (PK)                |       |
| assignmentId | integer (FK → assignments) |       |
| studentId    | text (FK → users)          |       |
| createdAt    | timestamp                  |       |

### checkpoints

| Column           | Type                       | Notes                                                               |
| ---------------- | -------------------------- | ------------------------------------------------------------------- |
| id               | serial (PK)                |                                                                     |
| assignmentId     | integer (FK → assignments) |                                                                     |
| name             | text, not null             | Copied from template                                                |
| order            | integer, not null          |                                                                     |
| dueDate          | timestamp                  | Per-checkpoint deadline (optional)                                  |
| minConsultations | integer, default 0         | Required for submission unlock                                      |
| state            | enum, not null             | locked \| unlocked \| submitted \| under_review \| passed \| revise |
| createdAt        | timestamp                  |                                                                     |
| updatedAt        | timestamp                  |                                                                     |

### submissions

| Column       | Type                       | Notes                                                                                          |
| ------------ | -------------------------- | ---------------------------------------------------------------------------------------------- |
| id           | serial (PK)                |                                                                                                |
| checkpointId | integer (FK → checkpoints) |                                                                                                |
| uploadedBy   | text (FK → users)          | User who uploaded (future-proof for group assignments)                                         |
| fileKey      | text, not null             | R2 object key (UUID-based)                                                                     |
| fileName     | text, not null             | Original filename                                                                              |
| fileSize     | integer, not null          | Size in bytes (Max 25MB)                                                                       |
| version      | integer, default 1         | Auto-calculated at insert. Each resubmission creates a new row with version = previous max + 1 |
| uploadedAt   | timestamp                  |                                                                                                |

### reviews

| Column           | Type                       | Notes                                                      |
| ---------------- | -------------------------- | ---------------------------------------------------------- |
| id               | serial (PK)                |                                                            |
| submissionId     | integer (FK → submissions) |                                                            |
| instructorId     | text (FK → users)          |                                                            |
| decision         | text, not null             | pass \| revise                                             |
| comment          | text                       |                                                            |
| feedbackFileKey  | text                       | R2 key for optional feedback file                          |
| revisionDeadline | timestamp                  | Deadline for resubmission (if revise)                      |
| createdAt        | timestamp                  |                                                            |
| reviewedAt       | timestamp                  | When instructor submitted the review (for SLA calculation) |

### consultations

| Column                 | Type                       | Notes                                        |
| ---------------------- | -------------------------- | -------------------------------------------- |
| id                     | serial (PK)                |                                              |
| assignmentId           | integer (FK → assignments) |                                              |
| checkpointId           | integer (FK → checkpoints) | Which stage this consultation supports       |
| studentId              | text (FK → users)          |                                              |
| verifiedById           | text (FK → users)          | Internal instructor who verified the log     |
| status                 | enum, not null             | pending \| verified \| rejected              |
| notes                  | text                       | Session notes from student                   |
| externalConsultantName | text                       | Name if session was with external supervisor |
| sessionType            | text                       | internal \| external                         |
| verifiedAt             | timestamp                  | When instructor verified                     |
| createdAt              | timestamp                  |                                              |

### notifications

| Column    | Type                   | Notes                                   |
| --------- | ---------------------- | --------------------------------------- |
| id        | serial (PK)            |                                         |
| userId    | text (FK → users)      | Recipient                               |
| type      | text, not null         | Event type identifier                   |
| title     | text, not null         | Short summary                           |
| message   | text                   | Body                                    |
| read      | boolean, default false |                                         |
| channel   | text, not null         | in_app \| email                         |
| metadata  | jsonb                  | Event-specific data (e.g. assignmentId) |
| createdAt | timestamp              |                                         |

## Database Indexes

| Table                   | Column(s)        | Type             | Purpose                                      |
| ----------------------- | ---------------- | ---------------- | -------------------------------------------- |
| `checkpoints`           | `assignmentId`   | b-tree           | Fetch checkpoints when loading an assignment |
| `submissions`           | `checkpointId`   | b-tree           | Fetch submissions for a checkpoint           |
| `submissions`           | `uploadedBy`     | b-tree           | Student's submission history                 |
| `reviews`               | `submissionId`   | b-tree           | Fetch review for a submission                |
| `consultations`         | `checkpointId`   | b-tree           | Count consultations for gating logic         |
| `consultations`         | `status`         | b-tree           | Filter pending verifications                 |
| `notifications`         | `userId`, `read` | composite b-tree | Notification center filtering                |
| `password_reset_tokens` | `token`          | unique b-tree    | Token lookup on password setup               |

## Relations

- `users` → `password_reset_tokens` (1:N via userId)
- `users` → `assignments` (1:N via instructorId)
- `users` → `assignment_students` (1:N via studentId)
- `users` → `submissions` (1:N via uploadedBy)
- `users` → `reviews` (1:N via instructorId)
- `users` → `consultations` (1:N via studentId / verifiedById)
- `assignment_templates` → `template_checkpoints` (1:N via templateId)
- `assignment_templates` → `assignments` (1:N via templateId)
- `assignments` → `assignment_students` (1:N via assignmentId)
- `assignments` → `checkpoints` (1:N via assignmentId)
- `assignments` → `consultations` (1:N via assignmentId)
- `checkpoints` → `submissions` (1:N via checkpointId)
- `submissions` → `reviews` (1:N via submissionId)

## Functional Requirements

1. **Drizzle Kit Configuration** — `drizzle.config.ts` must specify PostgreSQL dialect, schema path (`src/db/schema/`), and migration output directory (`drizzle/migrations/`).
2. **Database Client** — `src/db/index.ts` initializes the postgres.js client with `DATABASE_URL` and wraps it with Drizzle ORM.
3. **Migration Runner** — `src/db/migrate.ts` programmatically runs Drizzle migrations using the Drizzle migration runner API.
4. **Schema Definitions** — All 10 tables defined above with proper types, primary keys, foreign keys, defaults, and enums.
5. **Relations** — Drizzle relations defined for all foreign key relationships listed above.
6. **Indexes** — All 8 indexes from the table above defined using Drizzle's `index()` and `uniqueIndex()` APIs.
7. **SuperAdmin Seed** — `src/db/seed.ts` creates a SuperAdmin user with email/password from `SUPERADMIN_EMAIL` and `SUPERADMIN_PASSWORD` env vars, using a cryptographically hashed password.

## Acceptance Criteria

- [ ] `drizzle-kit generate` exits with status 0 and creates migration SQL in `drizzle/migrations/`
- [ ] `drizzle-kit migrate` applies migrations without errors to a running PostgreSQL instance
- [ ] Seed script creates a SuperAdmin user with role `superadmin` using env-based credentials
- [ ] `password_reset_tokens.token` column has a unique index
- [ ] Foreign key relationships are defined between all related tables
- [ ] All 8 indexes from the spec are present in the schema
- [ ] Drizzle relations are defined for all foreign key relationships
- [ ] postgres.js driver is used (not pg)
- [ ] `SUPERADMIN_EMAIL` and `SUPERADMIN_PASSWORD` env vars are added to `.env.example`

## Out of Scope

- Better-Auth integration (deferred to Track 1.3)
- Notification preferences table runtime usage (v2)
- Email queue, audit logs, extension requests tables (v2 — schema defined in code for future use)
- Integration tests requiring a live database (unit tests only for env validation and schema shape)
