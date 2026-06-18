# Plan: Template Editor Route

## Phase 1: Server — Add `listTemplateAssignments` handler

- [ ] Task: Create server stub + Zod schema for `listTemplateAssignments`
  - [ ] Add `ListTemplateAssignmentsSchema` with `templateId` param in `src/server/templates.ts`
  - [ ] Add `createServerFn` stub with dynamic import
  - [ ] Write unit tests for Zod schema validation
- [ ] Task: Implement `listTemplateAssignmentsHandler` in `templates.server.ts`
  - [ ] Query: join assignments → users (instructor), count assignment_students per assignment
  - [ ] Filter by `templateId`, exclude soft-deleted, return title, instructor name, student count, created date
  - [ ] Guard: admin/superadmin role check
  - [ ] Write unit tests for handler (mocked DB, auth check, result shape)
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Server Changes' (Protocol in workflow.md)

## Phase 2: Route — `/admin/templates/$id` page

- [ ] Task: Create route file `src/routes/_authenticated/admin/templates/$id.tsx`
  - [ ] SSR `loader`: call `getTemplate` with route param `$id`, return template data
  - [ ] `pendingComponent`: loading skeleton
  - [ ] `notFoundComponent`: template not found page
  - [ ] Write unit tests: route exports, loader params, pending state
- [ ] Task: Build TemplateEditorPage component (inline in route file or separate)
  - [ ] **Metadata section**: editable name + type inputs, read-only created date + creator name
  - [ ] **In-use banner**: if assignmentCount > 0, show warning
  - [ ] **Checkpoint editor**: full-width `CheckpointListEditor` with Save/Cancel buttons
  - [ ] **Linked assignments section**: fetch `listTemplateAssignments` client-side, display as linked list
  - [ ] **Delete section**: "Delete Template" button → `DeleteTemplateDialog` → navigate to `/admin/templates` on success
  - [ ] Save button: calls `updateTemplate`, shows success toast on completion
  - [ ] Write unit tests: renders all sections, edit interactions, save mutation, delete flow
- [ ] Task: Add i18n translation keys
  - [ ] Add `adminTemplates.detail.*` keys to `locales/en.json` and `locales/id.json`
  - [ ] Run `pnpm generate:i18n`
  - [ ] Write unit test: translation keys exist in both locales
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Route Page' (Protocol in workflow.md)

## Phase 3: Update list page — remove sheet, wire navigation

- [ ] Task: Update `TemplateCard` to navigate instead of call onEdit callback
  - [ ] Change Edit action from `onEdit(template)` to navigate to `/admin/templates/$id`
  - [ ] Remove `onEdit` prop from `TemplateCardProps` interface
  - [ ] Update usages of TemplateCard in index.tsx
  - [ ] Update existing tests for TemplateCard
- [ ] Task: Update `/admin/templates/index.tsx`
  - [ ] Remove `EditTemplateSheet` import and usage
  - [ ] Remove `editingTemplate` state and `isEditSheetOpen` state
  - [ ] Change Create flow: after successful createDialog, navigate to `/admin/templates/$id` with returned template ID
  - [ ] Write unit tests: Edit button navigates to route, Create dialog navigates on success
- [ ] Task: Conductor - User Manual Verification 'Phase 3: List Page Updates' (Protocol in workflow.md)

## Phase 4: Cleanup

- [ ] Task: Remove `EditTemplateSheet.tsx` component file
  - [ ] Delete `src/components/admin/templates/EditTemplateSheet.tsx`
  - [ ] Check no remaining imports reference it
  - [ ] Delete `EditTemplateSheet` test files
  - [ ] Run full test suite to confirm nothing breaks
- [ ] Task: Run full quality gate
  - [ ] `pnpm typecheck` — no type errors
  - [ ] `pnpm lint` — no lint errors
  - [ ] `pnpm test -- --coverage` — all tests pass, coverage thresholds met
  - [ ] `pnpm format` — formatting clean
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Cleanup' (Protocol in workflow.md)
