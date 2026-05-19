# Implementation Plan: Track 2.1 — User Management (Admin)

## Phase 1: Dependencies, i18n Types & Admin Layout [checkpoint: a14c5ae]

**Objective:** Set up dependencies, update i18n type definitions, then create the admin layout shell with role guard and sidebar.

- [x] Task: Install new shadcn/ui component dependencies (fbf55e0)
  - [x] Run `pnpm dlx shadcn@latest add select table skeleton badge` to install required primitives
  - [x] Install `sonner` (toast) or `alert-dialog` if desired (optional — inline banners and `window.confirm()` are acceptable fallbacks)
- [x] Task: Update i18n type definitions to support admin sections (8f04492)
  - [x] Update `scripts/generate-i18n-types.ts` — add `adminSidebar` and `adminUsers` sections to the static `Translation` type template
  - [x] Run `pnpm generate:i18n` to regenerate `src/i18n/types.ts` and `src/i18n/detect-locale.ts`
- [x] Task: Write tests for admin layout guard and sidebar (4effc7f)
  - [x] Write unit test for `_admin.tsx` route export and `beforeLoad` guard (`requireRole` call with [superadmin, admin])
  - [x] Write unit test for sidebar navigation links render
  - [x] Write unit test for redirect behavior when non-admin user accesses layout
- [x] Task: Implement admin layout and sidebar (4effc7f)
  - [x] Create `src/routes/_authenticated/_admin.tsx` — pathless layout nested under \_authenticated, with `beforeLoad` calling `requireRole(['superadmin', 'admin'])`
  - [x] Create `src/components/layout/admin-sidebar.tsx` — sidebar with links to Dashboard, Users, Templates
  - [x] Style sidebar with active route indication using TanStack Router's `useLocation`
  - [x] Add i18n translation keys for admin sidebar labels and update `locales/en.json` / `locales/id.json`
- [x] Task: Conductor - User Manual Verification 'Phase 1: Dependencies, i18n Types & Admin Layout' (Protocol in workflow.md)

## Phase 2: Server Functions, Invitation Email & Zod Validation

**Objective:** Implement all server-side CRUD functions with proper validation, invitation email flow, and edge case handling.

- [ ] Task: Write tests for user server functions
  - [ ] Write unit test for user creation Zod schema (valid/invalid inputs, role restrictions)
  - [ ] Write unit test for `createUser` — success path (user insert + verification token insert + email call)
  - [ ] Write unit test for `createUser` — duplicate email (same email as active user → error)
  - [ ] Write unit test for `createUser` — email collision with soft-deleted user (should also error — unique constraint)
  - [ ] Write unit test for `createUser` — email send failure (user created, no rollback, returns warning)
  - [ ] Write unit test for `createUser` — Admin cannot create another Admin role (server-side enforcement)
  - [ ] Write unit test for `listUsers` — pagination, search filtering by name/email (ILIKE), role filter
  - [ ] Write unit test for `listUsers` — excludes soft-deleted users
  - [ ] Write unit test for `updateUser` — name and email update (role unchanged)
  - [ ] Write unit test for `updateUser` — email uniqueness excludes own current email (`id != ?`)
  - [ ] Write unit test for `updateUser` — email uniqueness excludes soft-deleted users
  - [ ] Write unit test for `deleteUser` — sets deletedAt timestamp
  - [ ] Write unit test for `deleteUser` — prevents deleting own account (current user matches target id)
  - [ ] Write unit test for `generateSetupLink` — creates verification token and returns full URL
  - [ ] Write unit test for `generateSetupLink` — fails if user is soft-deleted
  - [ ] Write unit test for `getUser` — returns user by id
  - [ ] Write unit test for `getUser` — non-SuperAdmin requesting SuperAdmin returns null (404)
  - [ ] Write unit test for `getUser` — soft-deleted user returns null
  - [ ] Write unit test for `sendInvitationEmail` — exported function, calls Resend with correct params
- [ ] Task: Implement server functions
  - [ ] Create `src/server/users.ts` with all exported server functions using `createServerFn`
  - [ ] Create Zod schemas: `CreateUserSchema`, `UpdateUserSchema`, `ListUsersSchema`, `UserIdParamSchema`
  - [ ] Implement `createUser`:
    1. Validate email not already in use (active + soft-deleted users — catches unique constraint early)
    2. Validate role creation rules (non-SuperAdmin cannot create Admin)
    3. Insert into `users` table
    4. Insert into `verification` table (identifier=email, value=crypto.randomUUID(), expiresAt=1hr)
    5. Call `sendInvitationEmail()` — catch failure, do NOT rollback user creation
    6. Return user + `{ emailSent: boolean }`
  - [ ] Implement `listUsers` — paginated query with ILIKE search on name/email, role filter, exclude `deletedAt IS NOT NULL`, return `{ users, total }`
  - [ ] Implement `updateUser` — validate email uniqueness with `AND id != ? AND deletedAt IS NULL`, update only name + email
  - [ ] Implement `deleteUser` — set `deletedAt = now()`, prevent self-deletion (compare with session user id)
  - [ ] Implement `generateSetupLink` — insert verification token, construct URL, return full URL; fail if user soft-deleted
  - [ ] Implement `getUser` — fetch by id, if session user is non-SuperAdmin and target is SuperAdmin → return null
  - [ ] Create `src/lib/email.ts` — add `sendInvitationEmail(params: { email, name, token })` with SIMAK-branded "Welcome" template (separate from `sendPasswordResetEmail`)
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Server Functions, Invitation Email & Zod Validation' (Protocol in workflow.md)

## Phase 3: User List Page

**Objective:** Build the paginated, searchable, filterable user list page with table component.

- [ ] Task: Write tests for user list page and table component
  - [ ] Write unit test for user-table component rendering (columns, data display)
  - [ ] Write unit test for pagination controls (next/prev page, current page indication)
  - [ ] Write unit test for search input debounce behavior
  - [ ] Write unit test for role filter dropdown interaction
  - [ ] Write unit test for empty state rendering
  - [ ] Write unit test for loading skeleton state
  - [ ] Write unit test for delete confirmation and success feedback
- [ ] Task: Implement user list page
  - [ ] Create `src/routes/_authenticated/_admin/users.tsx` — page route with search params for page, search, role
  - [ ] Create `src/components/admin/user-table.tsx` — table with Name, Email, Role (as badge), Created At, Actions columns
  - [ ] Implement pagination component (previous/next, page indicator) using ?page= search param
  - [ ] Implement search input with debounce (300ms) hooked to search param
  - [ ] Implement role filter select dropdown (All / SuperAdmin / Admin / Instructor / Student)
  - [ ] Implement delete confirmation (shadcn AlertDialog or `window.confirm()`) calling `deleteUser`
  - [ ] Add "New User" button linking to `/admin/users/new`
  - [ ] Add i18n translation keys for table headers, empty state, delete confirmation, success/error messages
- [ ] Task: Conductor - User Manual Verification 'Phase 3: User List Page' (Protocol in workflow.md)

## Phase 4: Create User Page

**Objective:** Build the create user form with dynamic role dropdown and invitation email flow.

- [ ] Task: Write tests for create user form and page
  - [ ] Write unit test for dynamic role dropdown (SuperAdmin sees Admin option, Admin doesn't)
  - [ ] Write unit test for form validation (empty name, invalid email, missing role)
  - [ ] Write unit test for form submission success flow (redirect + success message)
  - [ ] Write unit test for email-send-failure flow (redirect + warning message, user still created)
  - [ ] Write unit test for form submission server error display (error banner)
- [ ] Task: Implement create user page
  - [ ] Create `src/routes/_authenticated/_admin/users/new.tsx` — create user page route
  - [ ] Create `src/components/admin/user-form.tsx` — reusable form component (Name, Email, Role select)
  - [ ] Implement dynamic role dropdown based on current session user role (use `authClient.useSession()`)
  - [ ] Wire form submit to `createUser` server function
  - [ ] On success with `emailSent: true`: redirect to `/admin/users` with success toast/message
  - [ ] On success with `emailSent: false`: redirect to `/admin/users` with warning message ("User created but email failed...")
  - [ ] Show inline validation errors + server error banner on failure
  - [ ] Add i18n translation keys for form labels, placeholders, errors, success/warning messages
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Create User Page' (Protocol in workflow.md)

## Phase 5: User Detail/Edit Page

**Objective:** Build the user detail view with edit capability, delete action, and setup link generation.

- [ ] Task: Write tests for user detail/edit page
  - [ ] Write unit test for view mode display (user info rendering)
  - [ ] Write unit test for edit mode toggle and form pre-fill with existing data
  - [ ] Write unit test for generate setup link button and copyable link display
  - [ ] Write unit test for delete user confirmation and success flow
  - [ ] Write unit test for non-SuperAdmin access to SuperAdmin user profile (404)
  - [ ] Write unit test for email uniqueness validation on edit (excludes own email)
- [ ] Task: Implement user detail/edit page
  - [ ] Create `src/routes/_authenticated/_admin/users/$id.tsx` — dynamic route for user detail/edit
  - [ ] Implement view mode: display Name, Email, Role, Created At, Locale, Email Verified status
  - [ ] Implement edit mode: toggle inline form with Name and Email fields (role not editable, never shown in edit)
  - [ ] Implement "Generate Setup Link" — calls `generateSetupLink` server function, shows copyable link in a modal/text field
  - [ ] Implement "Delete User" with confirmation dialog (shadcn AlertDialog or `window.confirm()`)
  - [ ] Handle permissions: non-SuperAdmin gets 404 for SuperAdmin user profiles
  - [ ] Success message on update/delete/link generation
  - [ ] Add i18n translation keys for detail page labels, buttons, confirmations, error messages
- [ ] Task: Conductor - User Manual Verification 'Phase 5: User Detail/Edit Page' (Protocol in workflow.md)
