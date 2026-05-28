# Implementation Plan: Track 1.1 — Comprehensive Audit Log

## Phase 1: Database Schema & Migration [checkpoint: 60c674c]

- [x] Task: Write audit_log schema tests (Red Phase) a8a23f8
  - [x] Create test file `tests/unit/db/audit-log-schema.test.ts`
  - [x] Test table exists with correct columns (id, actorId, action, entityType, entityId, details, createdAt)
  - [x] Test foreign key constraint on actorId → users.id
  - [x] Test indexes exist (created_at, action, entity_type+entity_id)
  - [x] Run tests and confirm they fail
- [x] Task: Implement audit_log schema (Green Phase) a8a23f8
  - [x] Create `src/db/schema/audit-log.ts` with Drizzle table definition
  - [x] Add indexes using Drizzle's index() API
  - [x] Export from `src/db/schema/index.ts`
  - [x] Run tests and confirm they pass
- [x] Task: Generate and run migration a8a23f8
  - [x] Run `pnpm db:generate` to create migration SQL
  - [x] Run `pnpm db:push` to apply to dev database
  - [x] Verify table exists in database
- [x] Task: Conductor - User Manual Verification 'Phase 1: Database Schema & Migration' (Protocol in workflow.md)

## Phase 2: Audit Log Helper [checkpoint: 1658fc6]

- [x] Task: Write logAuditEvent helper tests (Red Phase) 505bf15
  - [x] Create test file `tests/unit/lib/audit.test.ts`
  - [x] Test writes correct row to audit_log table with all fields
  - [x] Test handles missing details gracefully (null)
  - [x] Test actorId is required (throws on missing)
  - [x] Run tests and confirm they fail
- [x] Task: Implement logAuditEvent helper (Green Phase) 505bf15
  - [x] Create `src/lib/audit.ts` with logAuditEvent function
  - [x] Import getDb and auditLog schema
  - [x] Insert row with provided fields
  - [x] Run tests and confirm they pass
- [x] Task: Conductor - User Manual Verification 'Phase 2: Audit Log Helper' (Protocol in workflow.md)

## Phase 3: Wire User Handlers [checkpoint: 595127d]

- [x] Task: Write user handler audit tests (Red Phase) 0e0c447
  - [x] Create test file `tests/unit/server/users-audit.test.ts`
  - [x] Test createUserHandler writes `user.created` audit entry
  - [x] Test deleteUserHandler writes `user.deleted` audit entry
  - [x] Run tests and confirm they fail
- [x] Task: Wire user handlers to audit log (Green Phase) 0e0c447
  - [x] Import logAuditEvent in `src/server/users.server.ts`
  - [x] Add audit call in createUserHandler after successful insert
  - [x] Add audit call in deleteUserHandler after soft-delete
  - [x] Run tests and confirm they pass
- [x] Task: Conductor - User Manual Verification 'Phase 3: Wire User Handlers' (Protocol in workflow.md)

## Phase 4: Wire Template Handlers [checkpoint: 12922e0]

- [x] Task: Write template handler audit tests (Red Phase) c162496
  - [x] Create test file `tests/unit/server/templates-audit.test.ts`
  - [x] Test createTemplateHandler writes `template.created` audit entry
  - [x] Test updateTemplateHandler writes `template.updated` audit entry
  - [x] Test deleteTemplateHandler writes `template.deleted` audit entry
  - [x] Run tests and confirm they fail
- [x] Task: Wire template handlers to audit log (Green Phase) c162496
  - [x] Import logAuditEvent in `src/server/templates.server.ts`
  - [x] Add audit call in createTemplateHandler after successful insert
  - [x] Add audit call in updateTemplateHandler after successful update
  - [x] Add audit call in deleteTemplateHandler after soft-delete
  - [x] Run tests and confirm they pass
- [x] Task: Conductor - User Manual Verification 'Phase 4: Wire Template Handlers' (Protocol in workflow.md)

## Phase 5: Wire Assignment & Review Handlers [checkpoint: ce7e8d4]

- [x] Task: Write assignment & review handler audit tests (Red Phase) 39ac3c2
  - [x] Create test file `tests/unit/server/assignments-audit.test.ts`
  - [x] Test createAssignmentHandler writes `assignment.created` audit entry
  - [x] Test submitReviewHandler (pass) writes `review.passed` audit entry
  - [x] Test submitReviewHandler (revise) writes `review.revised` audit entry
  - [x] Run tests and confirm they fail
- [x] Task: Wire assignment & review handlers to audit log (Green Phase) 39ac3c2
  - [x] Import logAuditEvent in `src/server/assignments.server.ts`
  - [x] Add audit call in createAssignmentHandler after successful transaction
  - [x] Import logAuditEvent in `src/server/reviews.server.ts`
  - [x] Add audit call in submitReviewHandler for both pass and revise decisions
  - [x] Run tests and confirm they pass
- [x] Task: Conductor - User Manual Verification 'Phase 5: Wire Assignment & Review Handlers' (Protocol in workflow.md)

## Phase 6: Wire Consultation Handlers [checkpoint: a3fd86c]

- [x] Task: Write consultation handler audit tests (Red Phase) b897a23
  - [x] Create test file `tests/unit/server/consultations-audit.test.ts`
  - [x] Test verifyConsultationHandler writes `consultation.verified` audit entry
  - [x] Test rejectConsultationHandler writes `consultation.rejected` audit entry
  - [x] Run tests and confirm they fail
- [x] Task: Wire consultation handlers to audit log (Green Phase) b897a23
  - [x] Import logAuditEvent in `src/server/consultations.server.ts`
  - [x] Add audit call in verifyConsultationHandler after successful verification
  - [x] Add audit call in rejectConsultationHandler after successful rejection
  - [x] Run tests and confirm they pass
- [x] Task: Conductor - User Manual Verification 'Phase 6: Wire Consultation Handlers' (Protocol in workflow.md)

## Phase 7: Admin Audit Log Viewer

- [x] Task: Write admin audit log viewer tests (Red Phase) 2f13562
  - [x] Create test file `tests/unit/server/audit-logs.test.ts`
  - [x] Test listAuditLogs returns paginated entries
  - [x] Test listAuditLogs filters by action type
  - [x] Test listAuditLogs filters by date range
  - [x] Test non-admin cannot access (returns empty or error)
  - [x] Run tests and confirm they fail
- [x] Task: Implement admin audit log server functions (Green Phase) 2f13562
  - [x] Create `src/server/audit-logs.ts` with Zod schemas and createServerFn stubs
  - [x] Create `src/server/audit-logs.server.ts` with handler implementations
  - [x] Implement listAuditLogsHandler with pagination and filters
  - [x] Run tests and confirm they pass
- [x] Task: Write admin audit log page tests (Red Phase) e1c0afe
  - [x] Create test file `tests/unit/routes/admin-audit-log.test.tsx`
  - [x] Test page renders with audit log table
  - [x] Test pagination works
  - [x] Test action filter dropdown works
  - [x] Run tests and confirm they fail
- [x] Task: Implement admin audit log page (Green Phase) e1c0afe
  - [x] Create `src/routes/_authenticated/admin/audit-log.tsx`
  - [x] Implement AuditLogTable component with columns: Timestamp, Action, Actor, Entity Type, Entity ID, Details
  - [x] Implement AuditLogFilters component with action type dropdown and date range
  - [x] Add pagination component
  - [x] Add role guard (route under /\_authenticated/admin)
  - [x] Run tests and confirm they pass
- [x] Task: Add i18n translations for audit log UI e1c0afe
  - [x] Add English translations to `locales/en.json`
  - [x] Add Indonesian translations to `locales/id.json`
  - [x] Run `pnpm generate:i18n` to update types
- [x] Task: Add sidebar link to audit log e1c0afe
  - [x] Update admin sidebar to include Audit Log link
  - [x] Run `pnpm typecheck` to verify
- [ ] Task: Conductor - User Manual Verification 'Phase 7: Admin Audit Log Viewer' (Protocol in workflow.md)

## Phase 8: Final Verification & Checkpoint

- [ ] Task: Run full test suite
  - [ ] Run `pnpm test` and confirm all tests pass
  - [ ] Run `pnpm typecheck` and confirm no errors
  - [ ] Run `pnpm lint` and confirm no errors
- [ ] Task: Verify coverage thresholds
  - [ ] Run `pnpm test -- --coverage`
  - [ ] Confirm lines ≥80%, functions ≥80%, branches ≥72%, statements ≥79%
- [ ] Task: Manual verification
  - [ ] Start dev server with `pnpm dev`
  - [ ] Login as admin
  - [ ] Navigate to `/admin/audit-log`
  - [ ] Verify audit log table loads with entries
  - [ ] Test filtering by action type
  - [ ] Test date range filtering
  - [ ] Test pagination
  - [ ] Verify non-admin users are redirected
- [ ] Task: Conductor - User Manual Verification 'Phase 8: Final Verification & Checkpoint' (Protocol in workflow.md)
