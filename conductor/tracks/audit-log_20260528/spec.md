# Specification: Track 1.1 — Comprehensive Audit Log

## Overview

Build a system-wide audit log infrastructure. An `audit_log` table records every meaningful action: extension approvals, deadline changes, manual unlocks, user creation/deletion, template CRUD, assignment creation, review decisions, and consultation verifications. Server-side helpers make logging a one-liner from any handler. An admin-facing audit log viewer provides search, filter by action type / actor / entity, and date range filtering.

This track goes first so all subsequent tracks can write to the audit log from day one.

## Dependencies

V1 database foundation (Drizzle schema, DB client).

## Database Schema Changes

### New Table: `audit_log`

| Column      | Type              | Notes                                                                                                                                                                                                                                                                                                           |
| ----------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id          | serial (PK)       |                                                                                                                                                                                                                                                                                                                 |
| actor_id    | text (FK → users) | NOT NULL — who performed the action                                                                                                                                                                                                                                                                             |
| action      | text, not null    | `user.created`, `user.deleted`, `template.created`, `template.updated`, `template.deleted`, `assignment.created`, `review.passed`, `review.revised`, `checkpoint.unlocked`, `deadline.extended`, `deadline.extension_approved`, `deadline.extension_rejected`, `consultation.verified`, `consultation.rejected` |
| entity_type | text, not null    | `user` \| `template` \| `assignment` \| `checkpoint` \| `submission` \| `review` \| `consultation`                                                                                                                                                                                                              |
| entity_id   | text, not null    | Stringified ID of affected entity                                                                                                                                                                                                                                                                               |
| details     | jsonb             | NULLABLE — arbitrary context (previous value, new value, reason, etc.)                                                                                                                                                                                                                                          |
| created_at  | timestamp         | DEFAULT NOW()                                                                                                                                                                                                                                                                                                   |

### Indexes

- Index on `(created_at DESC)` for time-ordered queries
- Index on `(action)` for type filtering
- Index on `(entity_type, entity_id)` for entity-specific history

## New Server Helper: `src/lib/audit.ts`

```typescript
export async function logAuditEvent(event: {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
}): Promise<void>;
```

Single-import helper used across all handlers. Writes to `audit_log` table. No complex setup needed.

## Modified Existing Handlers

Wire `logAuditEvent` into:

| Handler                        | Action logged           | Details                            |
| ------------------------------ | ----------------------- | ---------------------------------- |
| `createUserHandler`            | `user.created`          | role, email                        |
| `deleteUserHandler`            | `user.deleted`          | soft-delete marker                 |
| `createTemplateHandler`        | `template.created`      | name, type, checkpoint count       |
| `updateTemplateHandler`        | `template.updated`      | name, type changes                 |
| `deleteTemplateHandler`        | `template.deleted`      | soft-delete marker                 |
| `createAssignmentHandler`      | `assignment.created`    | template, student count, deadline  |
| `submitReviewHandler` (pass)   | `review.passed`         | checkpoint name, comment snippet   |
| `submitReviewHandler` (revise) | `review.revised`        | checkpoint name, revision deadline |
| `verifyConsultationHandler`    | `consultation.verified` | checkpoint, student                |
| `rejectConsultationHandler`    | `consultation.rejected` | checkpoint, student, reason        |

## Admin Viewer

### New Route: `/admin/audit-log`

- Paginated table with columns: Timestamp, Action (badge), Actor, Entity Type, Entity ID, Details (expandable JSON)
- Filters: action type dropdown, date range picker, free-text search on details
- Role guard: `requireRole(['superadmin', 'admin'])`

### Server Functions

1. `listAuditLogs` — Paginated query with filters (action, date range, search)
2. `getAuditLogDetail` — Single entry with full details (if needed for expandable row)

## Acceptance Criteria

- [ ] `audit_log` table created with proper indexes
- [ ] `logAuditEvent` helper exists and is importable from any handler
- [ ] All existing handlers listed above write an audit log entry on execution
- [ ] Admin audit log page at `/admin/audit-log` loads with paginated entries
- [ ] Admin can filter by action type (dropdown derived from distinct values)
- [ ] Admin can filter by date range
- [ ] Non-admin users cannot access the audit log page (redirected)
- [ ] Audit log entries are immutable (no update/delete endpoint)
- [ ] i18n translations for audit log UI

## Test Plan

| Area                   | Approach                                                         |
| ---------------------- | ---------------------------------------------------------------- |
| `audit_log` schema     | Unit test — column types, foreign keys, indexes                  |
| `logAuditEvent` helper | Unit test — writes correct row to DB                             |
| Handler wiring         | Unit test — each handler produces expected audit entry           |
| Admin viewer           | Unit test — page renders, pagination works, filters update query |
| Role guard             | Unit test — non-admin redirected                                 |

## Out of Scope

- Extension request workflow (Track 1.3)
- Estimated duration & auto-calculated due dates (Track 1.2)
- Email queue integration (Track 4.1)
- Real-time audit log streaming
- Audit log export (CSV/PDF)
