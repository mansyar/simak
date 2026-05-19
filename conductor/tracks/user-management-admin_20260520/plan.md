# Implementation Plan: Track 2.1 — User Management (Admin)

## Phase 1: Admin Sidebar Layout & Route Guard

**Objective:** Create the admin layout shell with role-based access guard and sidebar navigation.

- [ ] Task: Write tests for admin layout guard and sidebar
  - [ ] Write unit test for `_admin.tsx` route guard (`requireRole` call with [superadmin, admin])
  - [ ] Write unit test for sidebar navigation links render
  - [ ] Write unit test for redirect behavior when non-admin user accesses layout
- [ ] Task: Implement admin layout and sidebar
  - [ ] Create `src/routes/_admin.tsx` — pathless layout with `beforeLoad` calling `requireRole(['superadmin', 'admin'])`
  - [ ] Create `src/components/layout/admin-sidebar.tsx` — sidebar with links to Dashboard, Users, Templates
  - [ ] Style sidebar with active route indication using TanStack Router's `useLocation`
  - [ ] Add i18n translation keys for admin sidebar labels (nav.adminSidebar.users, nav.adminSidebar.templates)
  - [ ] Update `locales/en.json` and `locales/id.json` with new keys
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Admin Sidebar Layout & Route Guard' (Protocol in workflow.md)

## Phase 2: Server Functions & Zod Validation

**Objective:** Implement all server-side CRUD functions for user management with validation.

- [ ] Task: Write tests for user server functions
  - [ ] Write unit test for user creation Zod schema (valid/invalid inputs, role restrictions)
  - [ ] Write unit test for `createUser` — success path (user + account + verification token creation)
  - [ ] Write unit test for `createUser` — duplicate email handling
  - [ ] Write unit test for `createUser` — Admin cannot create another Admin role
  - [ ] Write unit test for `listUsers` — pagination, search filtering by name/email, role filter
  - [ ] Write unit test for `listUsers` — excludes soft-deleted users
  - [ ] Write unit test for `updateUser` — name and email update
  - [ ] Write unit test for `updateUser` — role not editable
  - [ ] Write unit test for `deleteUser` — sets deletedAt timestamp
  - [ ] Write unit test for `generateSetupLink` — creates verification token and returns URL
  - [ ] Write unit test for `getUser` — returns single user by id
  - [ ] Write integration test for `user-crud.test.ts` — full create → list → update → delete lifecycle
- [ ] Task: Implement server functions
  - [ ] Create `src/server/users.ts` with all exported server functions
  - [ ] Implement `createUser` — insert user row, create account with temp password, generate verification token for setup link, send invitation email via existing email service
  - [ ] Implement `listUsers` — paginated query with search (ILIKE name/email), role filter, exclude deletedAt IS NOT NULL
  - [ ] Implement `updateUser` — update name, email (validate uniqueness); role stays unchanged
  - [ ] Implement `deleteUser` — set `deletedAt` to now()
  - [ ] Implement `generateSetupLink` — create Better-Auth verification token, return full setup URL
  - [ ] Implement `getUser` — simple fetch by id
  - [ ] Create Zod schemas for input validation (CreateUserSchema, UpdateUserSchema, ListUsersSchema)
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Server Functions & Zod Validation' (Protocol in workflow.md)

## Phase 3: User List Page

**Objective:** Build the paginated, searchable, filterable user list page with table component.

- [ ] Task: Write tests for user list page and table component
  - [ ] Write unit test for user-table component rendering (columns, data display)
  - [ ] Write unit test for pagination controls (next/prev page, current page indication)
  - [ ] Write unit test for search input debounce behavior
  - [ ] Write unit test for role filter dropdown interaction
  - [ ] Write unit test for empty state rendering
  - [ ] Write unit test for loading skeleton state
- [ ] Task: Implement user list page
  - [ ] Create `src/routes/admin/users.tsx` — page route with search params for page, search, role
  - [ ] Create `src/components/admin/user-table.tsx` — table with Name, Email, Role, Created At, Actions columns
  - [ ] Implement pagination component (previous/next, page indicator)
  - [ ] Implement search input with debounce (300ms) hooked to search param
  - [ ] Implement role filter dropdown (All / SuperAdmin / Admin / Instructor / Student)
  - [ ] Implement delete confirmation dialog with soft-delete
  - [ ] Add "New User" button linking to `/admin/users/new`
  - [ ] Add i18n translation keys for table headers, empty state, etc.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: User List Page' (Protocol in workflow.md)

## Phase 4: Create User Page

**Objective:** Build the create user form with dynamic role dropdown and invitation email flow.

- [ ] Task: Write tests for create user form and page
  - [ ] Write unit test for dynamic role dropdown (SuperAdmin sees Admin option, Admin doesn't)
  - [ ] Write unit test for form validation (empty name, invalid email, missing role)
  - [ ] Write unit test for form submission success flow (redirect, toast)
  - [ ] Write unit test for form submission error display (server error banner)
- [ ] Task: Implement create user page
  - [ ] Create `src/routes/admin/users/new.tsx` — create user page route
  - [ ] Create `src/components/admin/user-form.tsx` — reusable form component (Name, Email, Role)
  - [ ] Implement dynamic role dropdown based on current session user role
  - [ ] Wire form submit to `createUser` server function
  - [ ] Show success toast and redirect to `/admin/users` on success
  - [ ] Show inline validation errors + server error banner on failure
  - [ ] Add i18n translation keys for form labels, placeholders, errors, success message
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Create User Page' (Protocol in workflow.md)

## Phase 5: User Detail/Edit Page

**Objective:** Build the user detail view with edit capability, delete action, and setup link generation.

- [ ] Task: Write tests for user detail/edit page
  - [ ] Write unit test for view mode display (user info rendering)
  - [ ] Write unit test for edit mode toggle and form pre-fill
  - [ ] Write unit test for generate setup link button and copyable link display
  - [ ] Write unit test for delete user confirmation and success flow
  - [ ] Write unit test for non-SuperAdmin access to SuperAdmin user profile (404/forbidden)
- [ ] Task: Implement user detail/edit page
  - [ ] Create `src/routes/admin/users/$id.tsx` — dynamic route for user detail/edit
  - [ ] Implement view mode: display Name, Email, Role, Created At, Locale, Email Verified
  - [ ] Implement edit mode: toggle inline form with Name and Email fields (role not editable)
  - [ ] Implement "Generate Setup Link" — calls `generateSetupLink` server function, shows copyable link in modal
  - [ ] Implement "Delete User" with confirmation dialog
  - [ ] Handle permissions: non-SuperAdmin gets 404 for SuperAdmin profiles
  - [ ] Success toast on update/delete/link generation
  - [ ] Add i18n translation keys for detail page labels, buttons, confirmations
- [ ] Task: Conductor - User Manual Verification 'Phase 5: User Detail/Edit Page' (Protocol in workflow.md)
