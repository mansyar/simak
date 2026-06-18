# Track: Template Editor Route

## Overview

Replace the slide-over `EditTemplateSheet` with a dedicated route at `/admin/templates/$id`. Provides a richer editing experience: full-page layout with template metadata, editable checkpoint list, linked assignments overview, and delete capability. Create flow stays as dialog but navigates to the new route after success.

## Functional Requirements

### 1. Route — `/admin/templates/$id`

- **File:** `src/routes/_authenticated/admin/templates/$id.tsx`
- Inherits admin layout + role guard (`_admin` pathless layout)
- Loads template data via SSR `loader` function (reuses existing `getTemplate` server function)
- URL-addressable: template ID in route params, page refreshes preserve state

### 2. Page Layout

**Metadata Card (top):**

- Template name (editable text input)
- Type label (editable text input)
- Created date (read-only, formatted)
- Creator admin name (read-only)
- "In use by N assignment(s)" warning banner (read-only, if assignments exist)

**Checkpoint Editor (middle):**

- Full-width `CheckpointListEditor` (reuse existing component)
- Fields per checkpoint: name, minConsultations, estimatedDuration
- Add/Remove/Reorder via ▲▼ buttons
- Save button → calls `updateTemplate`
- Cancel button → navigates back to `/admin/templates`

**Linked Assignments (bottom):**

- Section heading: "Assignments using this template"
- List of assignments with: title, instructor name, student count, creation date
- Each assignment links to `/instructor/assignments/$id`
- Empty state: "No assignments yet" message
- Data loaded client-side via separate server function (template loaded first via SSR)

**Delete Action:**

- "Delete Template" button with danger styling at bottom of page
- Opens existing `DeleteTemplateDialog` with usage count
- On successful delete → navigate to `/admin/templates`

### 3. Changes to Existing List Page (`/admin/templates/index.tsx`)

- **Remove `EditTemplateSheet`** and related state (`editingTemplate`, `isEditSheetOpen`)
- **Change Edit action** on `TemplateCard` from opening sheet to navigating to `/admin/templates/$id`
- **Change Create flow** — after successful create in dialog, navigate to `/admin/templates/$newId`
- **Remove `EditTemplateSheet.tsx`** component file
- Keep `CreateTemplateDialog`, `DeleteTemplateDialog`, `TemplateCard` unchanged

### 4. Server Changes

- **New server function:** `listTemplateAssignments` — returns assignments linked to a template with student count, instructor name. Stub in `templates.ts`, handler in `templates.server.ts`
- Reuse existing: `getTemplate`, `updateTemplate`, `deleteTemplate`

### 5. New Translations

- `adminTemplates.detail.title` — "Template Detail"
- `adminTemplates.detail.metadata` — "Template Information"
- `adminTemplates.detail.checkpoints` — "Checkpoints"
- `adminTemplates.detail.assignments` — "Assignments using this template"
- `adminTemplates.detail.noAssignments` — "No assignments yet"
- `adminTemplates.detail.saveSuccess` — "Template saved"
- `adminTemplates.detail.back` — "Back to Templates"
- `adminTemplates.detail.createdBy` — "Created by {name}"

## Non-Functional Requirements

- SSR for main template data (loader function)
- Client-side fetch for linked assignments (separate query, not blocking page render)
- All role guards maintained (admin/superadmin only)
- 500-line file limit respected
- URL-based navigation — no modal/sheet state management

## Acceptance Criteria

- [ ] Navigating to `/admin/templates/5` shows template detail with editable fields
- [ ] Template metadata (name, type, creator, date) displayed correctly
- [ ] Checkpoint list editable with add/remove/reorder
- [ ] Save persists changes and shows success feedback
- [ ] Linked assignments section shows assignments using this template
- [ ] Clicking "Edit" on list page navigates to route instead of opening sheet
- [ ] After creating template in dialog, navigates to new route
- [ ] Delete button with confirmation works and redirects on success
- [ ] All existing template CRUD tests still pass
- [ ] New tests for route component, server function

## Out of Scope

- Drag-and-drop checkpoint reordering
- Template preview (what assignments look like with these checkpoints)
- Batch operations on checkpoints
