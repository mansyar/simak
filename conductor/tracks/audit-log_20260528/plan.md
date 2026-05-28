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
- [~] Task: Conductor - User Manual Verification 'Phase 2: Audit Log Helper' (Protocol in workflow.md)

## Phase 3: Wire User Handlers

- [ ] Task: Write user handler audit tests (Red Phase)
  - [ ] Create test file `tests/unit/server/users-audit.test.ts`
  - [ ] Test createUserHandler writes `user.created` audit entry
  - [ ] Test deleteUserHandler writes `user.deleted` audit entry
  - [ ] Run tests and confirm they fail
- [ ] Task: Wire user handlers to audit log (Green Phase)
  - [ ] Import logAuditEvent in `src/server/users.server.ts`
  - [ ] Add audit call in createUserHandler after successful insert
  - [ ] Add audit call in deleteUserHandler after soft-delete
  - [ ] Run tests and confirm they pass
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Wire User Handlers' (Protocol in workflow.md)

## Phase 4: Wire Template Handlers

- [ ] Task: Write template handler audit tests (Red Phase)
  - [ ] Create test file `tests/unit/server/templates-audit.test.ts`
  - [ ] Test createTemplateHandler writes `template.created` audit entry
  - [ ] Test updateTemplateHandler writes `template.updated` audit entry
  - [ ] Test deleteTemplateHandler writes `template.deleted` audit entry
  - [ ] Run tests and confirm they fail
- [ ] Task: Wire template handlers to audit log (Green Phase)
  - [ ] Import logAuditEvent in `src/server/templates.server.ts`
  - [ ] Add audit call in createTemplateHandler after successful insert
  - [ ] Add audit call in updateTemplateHandler after successful update
  - [ ] Add audit call in deleteTemplateHandler after soft-delete
  - [ ] Run tests and confirm they pass
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Wire Template Handlers' (Protocol in workflow.md)

## Phase 5: Wire Assignment & Review Handlers

- [ ] Task: Write assignment & review handler audit tests (Red Phase)
  - [ ] Create test file `tests/unit/server/assignments-audit.test.ts`
  - [ ] Test createAssignmentHandler writes `assignment.created` audit entry
  - [ ] Test submitReviewHandler (pass) writes `review.passed` audit entry
  - [ ] Test submitReviewHandler (revise) writes `review.revised` audit entry
  - [ ] Run tests and confirm they fail
- [ ] Task: Wire assignment & review handlers to audit log (Green Phase)
  - [ ] Import logAuditEvent in `src/server/assignments.server.ts`
  - [ ] Add audit call in createAssignmentHandler after successful transaction
  - [ ] Import logAuditEvent in `src/server/reviews.server.ts`
  - [ ] Add audit call in submitReviewHandler for both pass and revise decisions
  - [ ] Run tests and confirm they pass
- [ ] Task: Conductor - User Manual Verification 'Phase 5: Wire Assignment & Review Handlers' (Protocol in workflow.md)

## Phase 6: Wire Consultation Handlers

- [ ] Task: Write consultation handler audit tests (Red Phase)
  - [ ] Create test file `tests/unit/server/consultations-audit.test.ts`
  - [ ] Test verifyConsultationHandler writes `consultation.verified` audit entry
  - [ ] Test rejectConsultationHandler writes `consultation.rejected` audit entry
  - [ ] Run tests and confirm they fail
- [ ] Task: Wire consultation handlers to audit log (Green Phase)
  - [ ] Import logAuditEvent in `src/server/consultations.server.ts`
  - [ ] Add audit call in verifyConsultationHandler after successful verification
  - [ ] Add audit call in rejectConsultationHandler after successful rejection
  - [ ] Run tests and confirm they pass
- [ ] Task: Conductor - User Manual Verification 'Phase 6: Wire Consultation Handlers' (Protocol in workflow.md)

## Phase 7: Admin Audit Log Viewer

- [ ] Task: Write admin audit log viewer tests (Red Phase)
  - [ ] Create test file `tests/unit/server/audit-logs.test.ts`
  - [ ] Test listAuditLogs returns paginated entries
  - [ ] Test listAuditLogs filters by action type
  - [ ] Test listAuditLogs filters by date range
  - [ ] Test non-admin cannot access (returns empty or error)
  - [ ] Run tests and confirm they fail
- [ ] Task: Implement admin audit log server functions (Green Phase)
  - [ ] Create `src/server/audit-logs.ts` with Zod schemas and createServerFn stubs
  - [ ] Create `src/server/audit-logs.server.ts` with handler implementations
  - [ ] Implement listAuditLogsHandler with pagination and filters
  - [ ] Run tests and confirm they pass
- [ ] Task: Write admin audit log page tests (Red Phase)
  - [ ] Create test file `tests/unit/routes/admin-audit-log.test.tsx`
  - [ ] Test page renders with audit log table
  - [ ] Test pagination works
  - [ ] Test action filter dropdown works
  - [ ] Run tests and confirm they fail
- [ ] Task: Implement admin audit log page (Green Phase)
  - [ ] Create `src/routes/_authenticated/_admin/audit-log.tsx`
  - [ ] Implement AuditLogTable component with columns: Timestamp, Action, Actor, Entity Type, Entity ID, Details
  - [ ] Implement AuditLogFilters component with action type dropdown and date range
  - [ ] Add pagination component
  - [ ] Add role guard (requireRole(['superadmin', 'admin']))
  - [ ] Run tests and confirm they pass
- [ ] Task: Add i18n translations for audit log UI
  - [ ] Add English translations to `locales/en.json`
  - [ ] Add Indonesian translations to `locales/id.json`
  - [ ] Run `pnpm generate:i18n` to update types
- [ ] Task: Add sidebar link to audit log
  - [ ] Update admin sidebar to include Audit Log link
  - [ ] Run `pnpm typecheck` to verify
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
