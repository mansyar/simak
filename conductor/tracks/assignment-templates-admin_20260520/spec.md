# Specification: Track 2.2 — Assignment Templates (Admin)

## Overview

Build the admin template management workspace — a full CRUD interface for managing reusable assignment templates with ordered checkpoints within the SIMAK system. Admin can create, edit, duplicate, and soft-delete templates. Each template has a type label (e.g., Thesis, Research Paper) and an ordered list of checkpoints. Deletion is soft-blocked if the template is in use by active assignments.

## Functional Requirements

### 1. Template List Page (`/admin/templates`)

- **Route:** `src/routes/_authenticated/admin/templates.tsx` — pathless layout under `_admin` (inherits admin role guard)
- **Pagination:** 20 templates per page, controlled via `?page=` search param
- **Search:** Text search by template name
- **Type Filter:** Select dropdown (All + unique types derived from existing templates)
- **List View:** Each template shown as a card displaying:
  - Template name
  - Type label (badge)
  - Checkpoint count (e.g., "4 checkpoints")
  - Created date
  - Actions dropdown: Edit, Duplicate, Delete
- **Loading State:** Skeleton cards while fetching
- **Empty State:** "No templates found" message with prompt to create one
- **Actions:**
  - "New Template" button → opens CreateTemplateDialog
  - Edit → opens EditTemplateSheet
  - Duplicate → server creates a copy with "(Copy)" appended to name; shows success message
  - Delete → confirmation dialog with usage warning (count of assignments using this template); if count > 0, require typing "DELETE" to confirm (soft-block)

### 2. Create Template Dialog

- **Trigger:** "New Template" button on list page → opens dialog
- **Form Fields:**
  - Name (text, required, min 1 char)
  - Type (text, required — free-text input for flexibility, e.g., "Thesis", "Research Paper")
  - Checkpoints (dynamic list with add/remove/reorder):
    - Each checkpoint has a name (text, required)
    - Default: 3 empty checkpoint rows
    - "Add Checkpoint" button appends a new row
    - Remove button (X) per row; minimum 1 checkpoint required
    - ▲/▼ buttons per row for reordering
- **Validation (Zod):**
  - Name: required, min 1 char
  - Type: required, min 1 char
  - Checkpoints: required, array min 1 item, each name required
- **On Submit:** Calls `createTemplate` server function; on success closes dialog, refreshes list, shows success message
- **Loading State:** Submit button shows spinner, fields disabled during submission

### 3. Edit Template Sheet

- **Trigger:** Edit action on template card → opens slide-in sheet
- **Form Fields:** Same as create (Name, Type, Checkpoints) — pre-filled with existing data
- **Checkpoint Handling:** Existing checkpoints shown, reorderable via ▲/▼, removable, addable
- **On Submit:** Calls `updateTemplate` server function; on success closes sheet, refreshes list, shows success message
- **Note:** If the template is in use by assignments, show a non-blocking info banner: "This template is used by {n} assignment(s). Changes will affect future assignment creation."

### 4. Server Functions (`src/server/templates.ts` + `src/server/templates.server.ts`)

Follow the same server/client split pattern as `users.ts` / `users.server.ts`:

- `listTemplates(params: { page, limit, search, type })` — Paginated, filtered, searchable template list. Excludes soft-deleted. Returns `{ templates, total }`.
- `getTemplate(id: number)` — Fetches single template by ID with all its checkpoints (ordered by `order`). Returns null if soft-deleted.
- `createTemplate(data: { name, type, checkpoints: string[] })` — Creates template + checkpoint rows. Returns created template with checkpoints.
- `updateTemplate(id: number, data: { name, type, checkpoints: string[] })` — Updates template metadata. Replaces all checkpoint rows (delete old, insert new) in a transaction.
- `deleteTemplate(id: number)` — Soft-deletes template. First checks if any active assignments reference it. If count > 0, returns `{ error: 'in_use', count: n }` (soft-block). Allows the caller to show the confirmation dialog.
- `duplicateTemplate(id: number)` — Creates copy of template with "(Copy)" appended to name. Copies all checkpoints. Returns created template.

### 5. i18n Translation Keys

New translation sections needed in both `locales/en.json` and `locales/id.json`:

```json
{
  "adminTemplates": {
    "title": "Templates",
    "newTemplate": "New Template",
    "searchPlaceholder": "Search templates...",
    "filterByType": "All Types",
    "checkpointCount": "{count} checkpoints",
    "empty": "No templates found",
    "createPrompt": "Create your first template",
    "form": {
      "name": "Template Name",
      "type": "Type",
      "checkpoints": "Checkpoints",
      "checkpointName": "Checkpoint Name",
      "addCheckpoint": "Add Checkpoint",
      "removeCheckpoint": "Remove",
      "moveUp": "Move Up",
      "moveDown": "Move Down"
    },
    "actions": {
      "edit": "Edit",
      "duplicate": "Duplicate",
      "delete": "Delete"
    },
    "createSuccess": "Template created successfully",
    "updateSuccess": "Template updated successfully",
    "duplicateSuccess": "Template duplicated successfully",
    "deleteConfirm": "Delete this template?",
    "deleteInUse": "This template is used by {count} assignment(s). Type DELETE to confirm.",
    "deleteSuccess": "Template deleted successfully",
    "inUseBanner": "This template is used by {count} assignment(s). Changes will affect future assignment creation."
  }
}
```

## Non-Functional Requirements

- Server/client file split: `src/server/templates.ts` (client-safe stubs + Zod schemas) and `src/server/templates.server.ts` (server-only handlers)
- Role guards: all server functions check session role is `admin` or `superadmin`
- Reordering: checkpoint reordering is done via up/down buttons that swap `order` values. No drag-and-drop library needed.
- All list queries exclude soft-deleted templates (`deletedAt IS NULL`)
- `duplicateTemplate` appends "(Copy)" to the name. If name already ends with "(Copy)", append "(Copy 2)", etc.
- Duplicate and soft-delete respect the 500-line modularity limit — handlers under 500 lines each

## Acceptance Criteria

- [ ] Admin can create a template with name, type, and 3+ ordered checkpoints
- [ ] Checkpoints can be reordered with ▲/▼ buttons; order persists on reload
- [ ] Creating a template with 0 checkpoints shows form validation error
- [ ] Duplicating a template creates an identical copy with "(Copy)" appended to name
- [ ] Deleting an unused template succeeds with basic confirmation
- [ ] Deleting a template used by assignments shows usage count and requires typing "DELETE"
- [ ] Template list can be filtered by type and searched by name
- [ ] Template list is paginated (20 per page)
- [ ] Admin editing a template used by assignments sees an info banner
- [ ] Non-admin users cannot access template management (redirected)

## Out of Scope

- Drag-and-drop reordering (use ▲/▼ buttons instead)
- Template categories or grouping
- Template version history
- Import/export templates
- Template sharing between Admins (all admins see all templates)
