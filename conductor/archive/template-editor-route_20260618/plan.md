<protect>
# Plan: Template Editor Route

## Phase 1: Server — Add `listTemplateAssignments` handler

- [x] Task: Read spec.md to understand requirements before implementation
- [x] Task: Create server stub + Zod schema for `listTemplateAssignments`
  - [x] Add `ListTemplateAssignmentsSchema` with `templateId` param in `src/server/templates.ts`
  - [x] Add `createServerFn` stub with dynamic import
  - [x] Write unit tests for Zod schema validation
- [x] Task: Implement `listTemplateAssignmentsHandler` in `templates.server.ts`
  - [x] Query: join assignments → users (instructor), count assignment_students per assignment
  - [x] Filter by `templateId`, exclude soft-deleted, return title, instructor name, student count, created date
  - [x] Guard: admin/superadmin role check
  - [x] Write unit tests for handler (mocked DB, auth check, result shape)
- [x] Task: Conductor - User Manual Verification 'Phase 1: Server Changes' (Protocol in workflow.md)

## Phase 2: Route — `/admin/templates/$id` page

- [x] Task: Read spec.md to understand requirements before implementation
- [x] Task: Create route file `src/routes/_authenticated/admin/templates/$templateId.tsx`
  - [x] SSR `loader`: call `getTemplate` with route param `$templateId`, return template data
  - [x] `pendingComponent`: loading skeleton
  - [x] `notFoundComponent`: template not found page
  - [x] Write unit tests: route exports, loader params, pending state
- [x] Task: Build TemplateDetailPage component (inline in route file or separate)
  - [x] **Metadata section**: editable name + type inputs, read-only created date + creator name
  - [x] **In-use banner**: if assignmentCount > 0, show warning
  - [x] **Checkpoint editor**: full-width `CheckpointListEditor` with Save/Cancel buttons
  - [x] **Linked assignments section**: fetch `listTemplateAssignments` client-side, display as linked list
  - [x] **Delete section**: "Delete Template" button → `DeleteTemplateDialog` → navigate to `/admin/templates` on success
  - [x] Save button: calls `updateTemplate`, shows success banner on completion
  - [x] Write unit tests: renders all sections, edit interactions, save mutation, delete flow
- [x] Task: Add i18n translation keys
  - [x] Add `adminTemplates.detail.*` keys to `locales/en.json` and `locales/id.json`
  - [x] Run `pnpm generate:i18n`
- [x] Task: Conductor - User Manual Verification 'Phase 2: Route Page' (Protocol in workflow.md)

## Phase 3: Update list page — remove sheet, wire navigation

- [x] Task: Read spec.md to understand requirements before implementation
- [x] Task: Update `TemplateCard` onEdit to navigate
  - [x] TemplateCard kept `onEdit` prop; parent index.tsx now passes navigate-based handler
  - [x] Updated existing tests (no TemplateCard changes needed)
- [x] Task: Update `/admin/templates/index.tsx`
  - [x] Remove `EditTemplateSheet` import and usage
  - [x] Remove `editingTemplate` state and `isEditSheetOpen` state
  - [x] `handleEdit` now navigates to `/admin/templates/$templateId`
  - [x] `handleCreateSuccess` receives templateId and navigates to new route
  - [x] `CreateTemplateDialog.onSuccess` updated to accept optional `templateId`
- [x] Task: Conductor - User Manual Verification 'Phase 3: List Page Updates' (Protocol in workflow.md)

## Phase 4: Cleanup

- [x] Task: Read spec.md to understand requirements before implementation
- [x] Task: Remove `EditTemplateSheet.tsx` component file
  - [x] Deleted `src/components/admin/templates/EditTemplateSheet.tsx`
  - [x] Verified no remaining imports reference it
  - [x] Deleted 3 `EditTemplateSheet` test files
  - [x] Ran full test suite to confirm nothing breaks
- [x] Task: Run full quality gate
  - [x] `pnpm typecheck` — no type errors
  - [x] `pnpm lint` — no lint errors
  - [x] `pnpm test` — all tests pass (1771 tests, 187 files)
  - [x] `pnpm format` — formatting clean
- [x] Task: Conductor - User Manual Verification 'Phase 4: Cleanup' (Protocol in workflow.md)

## Phase: Review Fixes

- [x] Task: Apply review suggestions 6347af0
      </protect>
