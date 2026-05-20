# Implementation Plan: Track 2.2 — Assignment Templates (Admin)

## Phase 1: Dependencies, i18n Types & UI Component Shells [checkpoint: d4ce44b]

**Objective:** Set up i18n types, then build the UI component shells (TemplateCard, TemplateFilters, pagination) with tests using mock data. Route creation and data wiring come in Phase 2 after server functions exist.

- [x] Task: Update i18n type definitions for admin template sections (665b005)
  - [ ] Update `scripts/generate-i18n-types.ts` — add `adminTemplates` section to the static `Translation` type template
  - [ ] Run `pnpm generate:i18n` to regenerate `src/i18n/types.ts` and `src/i18n/detect-locale.ts`
- [x] Task: Write tests for UI component shells (using mock data) (7c7ebb6)
  - [ ] Write unit test for template card component rendering (name, type badge, checkpoint count, created date, actions dropdown)
  - [ ] Write unit test for search input debounce behavior
  - [ ] Write unit test for type filter dropdown (All + unique types)
  - [ ] Write unit test for pagination controls (next/prev, page indicator)
  - [ ] Write unit test for empty state rendering
  - [ ] Write unit test for loading skeleton state
- [x] Task: Implement UI component shells (7c7ebb6)
  - [ ] Add i18n translation keys for template list to `locales/en.json` / `locales/id.json`
  - [ ] Create `src/components/admin/templates/TemplateCard.tsx` — card component with name, type badge, checkpoint count, created date, dropdown actions (Edit, Duplicate, Delete)
  - [ ] Create `src/components/admin/templates/TemplateFilters.tsx` — search input + type filter select
  - [ ] Implement pagination component with prev/next controls
- [x] Task: Conductor - User Manual Verification 'Phase 1: Dependencies, i18n Types & UI Component Shells' (Protocol in workflow.md)

## Phase 2: Server Functions, Zod Validation & Template Route

**Objective:** Implement all server-side CRUD functions with Zod validation, checkpoint handling, duplicate logic, and soft-delete with usage checking. Then create the template list route that wires the UI components to server data.

**Note on ID types:** Template IDs are `serial` (integer), unlike user IDs (text UUIDs). The `TemplateIdParamSchema` must use `z.coerce.number()` (route/search params arrive as strings), and all handlers must treat IDs as numbers.

- [x] Task: Write tests for template server functions (43ba305)
  - [ ] Write unit test for template creation Zod schema (valid inputs, empty name, missing type, 0 checkpoints, empty checkpoint name)
  - [ ] Write unit test for `createTemplate` — success path (template insert + checkpoint inserts, `createdBy` set from session)
  - [ ] Write unit test for `createTemplate` — authorization check (non-admin returns error)
  - [ ] Write unit test for `listTemplates` — pagination, search by name, type filter
  - [ ] Write unit test for `listTemplates` — excludes soft-deleted templates
  - [ ] Write unit test for `getTemplate` — returns template with checkpoints ordered by `order`
  - [ ] Write unit test for `getTemplate` — soft-deleted returns null
  - [ ] Write unit test for `updateTemplate` — replaces checkpoints in a transaction
  - [ ] Write unit test for `deleteTemplate` — sets deletedAt, not in use case
  - [ ] Write unit test for `deleteTemplate` — returns in_use error with count when assignments reference it
  - [ ] Write unit test for `duplicateTemplate` — copies template + checkpoints, appends "(Copy)"
- [x] Task: Implement server functions (43ba305)
  - [ ] Create `src/server/templates.ts` — client-safe `createServerFn` stubs + Zod schemas (`CreateTemplateSchema`, `UpdateTemplateSchema`, `ListTemplatesSchema`, `TemplateIdParamSchema`)
  - [ ] Create `src/server/templates.server.ts` — server-only handler implementations
  - [ ] Implement `createTemplateHandler` — insert template (with `createdBy` set from session user ID), bulk-insert checkpoints with sequential order, return template with checkpoints
  - [ ] Implement `listTemplatesHandler` — paginated query with ILIKE name search, type filter, exclude `deletedAt IS NOT NULL`, return `{ templates, total }`
  - [ ] Implement `getTemplateHandler` — fetch by id with checkpoints ordered by `order`, join template_checkpoints table
  - [ ] Implement `updateTemplateHandler` — update template metadata, delete all existing checkpoints, bulk-insert new ones (transactional)
  - [ ] Implement `deleteTemplateHandler` — check assignment count via `SELECT COUNT(*) FROM assignments WHERE template_id = ? AND deletedAt IS NULL`; if > 0 return `{ error: 'in_use', count }`; else set `deletedAt = now()`
  - [ ] Implement `duplicateTemplateHandler` — fetch original template + checkpoints, insert with "(Copy)" name, insert copied checkpoints with same order
- [x] Task: Create template list route with data wiring (107be79)
  - [ ] Create `src/routes/_authenticated/admin/templates.tsx` — template list page route with search params for page, search, type, and a `loader` that calls `listTemplates`
  - [ ] Wire TemplateCard, TemplateFilters, and pagination components with real data from the route loader
  - [ ] Add "New Template" button that opens CreateTemplateDialog (wired in Phase 3)
  - [ ] Verify route is detected: run `pnpm typecheck` to confirm the route tree compiles without errors
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Server Functions, Zod Validation & Template Route' (Protocol in workflow.md)

## Phase 3: Create Template Dialog

**Objective:** Build the create template dialog with dynamic checkpoint list (add/remove/reorder via ▲/▼ buttons).

- [ ] Task: Write tests for create template dialog
  - [ ] Write unit test for dialog open/closed state
  - [ ] Write unit test for form fields (name, type, checkpoint rows)
  - [ ] Write unit test for add/remove checkpoint row functionality (min 1 enforced)
  - [ ] Write unit test for ▲/▼ reorder buttons (swap order values)
  - [ ] Write unit test for form validation (empty name, empty type, zero checkpoints, empty checkpoint name)
  - [ ] Write unit test for form submission success (dialog closes, refresh triggered)
  - [ ] Write unit test for form submission server error display (error banner)
  - [ ] Write unit test for loading state (submit spinner, fields disabled)
- [ ] Task: Implement create template dialog
  - [ ] Create `src/components/admin/templates/CreateTemplateDialog.tsx` — dialog with form
  - [ ] Create `src/components/admin/templates/CheckpointListEditor.tsx` — dynamic list with add/remove/▲/▼ buttons
  - [ ] Implement checkpoint row management: add (appends empty row), remove (removes row, enforces min 1), move up/down (swaps positions)
  - [ ] Wire form submit to `createTemplate` server function
  - [ ] On success: close dialog, refresh template list, show success message (inline banner or alert)
  - [ ] Show inline validation errors + server error banner on failure
  - [ ] Add i18n translation keys for form labels, placeholders, errors, success messages
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Create Template Dialog' (Protocol in workflow.md)

## Phase 4: Edit Template Sheet

**Objective:** Build the edit template sheet with pre-filled data, checkpoint list editing, and in-use banner.

- [ ] Task: Write tests for edit template sheet
  - [ ] Write unit test for sheet open/closed state
  - [ ] Write unit test for form pre-filled with existing template data
  - [ ] Write unit test for add/remove/reorder checkpoint rows
  - [ ] Write unit test for submit success (sheet closes, list refreshes)
  - [ ] Write unit test for in-use banner display (when template has assignment count > 0)
  - [ ] Write unit test for server error display
- [ ] Task: Implement edit template sheet
  - [ ] Create `src/components/admin/templates/EditTemplateSheet.tsx` — slide-in sheet with pre-filled form
  - [ ] Reuse `CheckpointListEditor.tsx` for checkpoint editing
  - [ ] Fetch template data via `getTemplate` server function (or pass from list data)
  - [ ] Implement in-use banner: check if template has active assignment count; if > 0, show info banner with count
  - [ ] Wire submit to `updateTemplate` server function
  - [ ] On success: close sheet, refresh list, show success message
  - [ ] Add i18n translation keys for sheet labels, in-use banner, success messages
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Edit Template Sheet' (Protocol in workflow.md)

## Phase 5: Duplicate & Delete Actions

**Objective:** Wire up duplicate action and implement soft-blocked delete with usage count warning.

- [ ] Task: Write tests for duplicate and delete actions
  - [ ] Write unit test for duplicate action — calls `duplicateTemplate`, shows success message, refreshes list
  - [ ] Write unit test for delete action — unused template — basic confirmation, calls `deleteTemplate`, success
  - [ ] Write unit test for delete action — used template — shows "in_use" warning with count, requires typing "DELETE", then calls `deleteTemplate`
  - [ ] Write unit test for delete action — used template — user cancels (closes dialog without deleting)
  - [ ] Write unit test for duplicate server error handling
- [ ] Task: Implement duplicate and delete on template list page
  - [ ] Wire duplicate action in TemplateCard dropdown to `duplicateTemplate` server function
  - [ ] On duplicate success: show success message and refresh list
  - [ ] Implement delete confirmation with conditional behavior:
    - Check if template is in use via server (or frontend tracks a `_assignmentCount` field on the template)
    - If not in use: basic `confirm()` dialog → call `deleteTemplate` → refresh
    - If in use: custom dialog showing usage count + text input requiring "DELETE" → call `deleteTemplate` → refresh
  - [ ] Add i18n translation keys for delete dialogs, confirmations, success/error messages
- [ ] Task: Conductor - User Manual Verification 'Phase 5: Duplicate & Delete Actions' (Protocol in workflow.md)

**Note:** The admin sidebar `/admin/templates` link and i18n key `adminSidebar.templates` were already added in Track 2.1 as a placeholder. No sidebar changes needed.
