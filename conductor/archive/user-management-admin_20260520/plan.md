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

## Phase 2: Server Functions, Invitation Email & Zod Validation [checkpoint: 23d6f9d]

**Objective:** Implement all server-side CRUD functions with proper validation, invitation email flow, and edge case handling.

- [x] Task: Write tests for user server functions (6c9c017)
  - [x] Write unit test for user creation Zod schema (valid/invalid inputs, role restrictions)
  - [x] Write unit test for `createUser` — success path (user insert + verification token insert + email call)
  - [x] Write unit test for `createUser` — duplicate email (same email as active user → error)
  - [x] Write unit test for `createUser` — email collision with soft-deleted user (should also error — unique constraint)
  - [x] Write unit test for `createUser` — email send failure (user created, no rollback, returns warning)
  - [x] Write unit test for `createUser` — Admin cannot create another Admin role (server-side enforcement)
  - [x] Write unit test for `listUsers` — pagination, search filtering by name/email (ILIKE), role filter
  - [x] Write unit test for `listUsers` — excludes soft-deleted users
  - [x] Write unit test for `updateUser` — name and email update (role unchanged)
  - [x] Write unit test for `updateUser` — email uniqueness excludes own current email (`id != ?`)
  - [x] Write unit test for `updateUser` — email uniqueness excludes soft-deleted users
  - [x] Write unit test for `deleteUser` — sets deletedAt timestamp
  - [x] Write unit test for `deleteUser` — prevents deleting own account (current user matches target id)
  - [x] Write unit test for `generateSetupLink` — creates verification token and returns full URL
  - [x] Write unit test for `generateSetupLink` — fails if user is soft-deleted
  - [x] Write unit test for `getUser` — returns user by id
  - [x] Write unit test for `getUser` — non-SuperAdmin requesting SuperAdmin returns null (404)
  - [x] Write unit test for `getUser` — soft-deleted user returns null
  - [x] Write unit test for `sendInvitationEmail` — exported function, calls Resend with correct params
- [x] Task: Implement server functions (6c9c017)
  - [x] Create `src/server/users.ts` with all exported server functions using `createServerFn`
  - [x] Create Zod schemas: `CreateUserSchema`, `UpdateUserSchema`, `ListUsersSchema`, `UserIdParamSchema`
  - [x] Implement `createUser`:
    1. Validate email not already in use (active + soft-deleted users — catches unique constraint early)
    2. Validate role creation rules (non-SuperAdmin cannot create Admin)
    3. Insert into `users` table
    4. Insert into `verification` table (identifier=email, value=crypto.randomUUID(), expiresAt=1hr)
    5. Call `sendInvitationEmail()` — catch failure, do NOT rollback user creation
    6. Return user + `{ emailSent: boolean }`
  - [x] Implement `listUsers` — paginated query with ILIKE search on name/email, role filter, exclude `deletedAt IS NOT NULL`, return `{ users, total }`
  - [x] Implement `updateUser` — validate email uniqueness with `AND id != ? AND deletedAt IS NULL`, update only name + email
  - [x] Implement `deleteUser` — set `deletedAt = now()`, prevent self-deletion (compare with session user id)
  - [x] Implement `generateSetupLink` — insert verification token, construct URL, return full URL; fail if user soft-deleted
  - [x] Implement `getUser` — fetch by id, if session user is non-SuperAdmin and target is SuperAdmin → return null
  - [x] Create `src/lib/email.ts` — add `sendInvitationEmail(params: { email, name, token })` with SIMAK-branded "Welcome" template (separate from `sendPasswordResetEmail`)
- [x] Task: Conductor - User Manual Verification 'Phase 2: Server Functions, Invitation Email & Zod Validation' (Protocol in workflow.md)

## Phase 3: User List Page

**Objective:** Build the paginated, searchable, filterable user list page with table component.

- [x] Task: Write tests for user list page and table component (f581bb9)
  - [x] Write unit test for user-table component rendering (columns, data display)
  - [x] Write unit test for pagination controls (next/prev page, current page indication)
  - [x] Write unit test for search input debounce behavior
  - [x] Write unit test for role filter dropdown interaction
  - [x] Write unit test for empty state rendering
  - [x] Write unit test for loading skeleton state
  - [x] Write unit test for delete confirmation and success feedback
- [x] Task: Implement user list page (f581bb9)
  - [x] Create `src/routes/_authenticated/admin/users/index.tsx` — page route with search params for page, search, role
  - [x] Create `src/components/admin/users/UserTable.tsx` — table with Name, Email, Role (as badge), Created At, Actions columns
  - [x] Implement pagination component (previous/next, page indicator) using ?page= search param
  - [x] Implement search input (no debounce requirement) linked to search param
  - [x] Implement role filter select dropdown (All / SuperAdmin / Admin / Instructor / Student)
  - [x] Implement delete confirmation (using dropdown menu + `window.confirm()`) calling `deleteUser`
  - [x] Add "New User" button opening CreateUserDialog
  - [x] Add i18n translation keys for table headers, empty state, delete confirmation, success/error messages
- [ ] Task: Conductor - User Manual Verification 'Phase 3: User List Page' (Protocol in workflow.md)

## Phase 4: Create User Page

**Objective:** Build the create user form with dynamic role dropdown and invitation email flow.

- [x] Task: Write tests for create user form and page (a1336bf)
  - [x] Write unit test for dialog rendering (open/closed states)
  - [x] Write unit test for form fields (name, email, role select)
  - [x] Write unit test for role options (admin, instructor, student)
  - [x] Write unit test for Zod schema validation (valid/invalid inputs)
  - [x] Write unit test for submit button rendering
- [x] Task: Implement create user page (a1336bf)
  - [x] Create `src/components/admin/users/CreateUserDialog.tsx` — dialog-based create user form (Name, Email, Role select)
  - [x] Implement role select dropdown with admin/instructor/student options
  - [x] Wire form submit to `createUser` server function via parent handler
  - [x] Use React Hook Form with Zod resolver for validation
  - [x] Add i18n translation keys for form labels and button text
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Create User Page' (Protocol in workflow.md)

## Phase 5: User Detail/Edit Page

**Objective:** Build the user detail view with edit capability, delete action, and setup link generation.

- [x] Task: Write tests for user detail/edit page (5c46381)
  - [x] Write unit test for sheet open/closed states
  - [x] Write unit test for form fields (name, email)
  - [x] Write unit test for submit button rendering
  - [x] Write unit test for rendering without user data (empty form)
- [x] Task: Implement user detail/edit page (5c46381)
  - [x] Create `src/components/admin/users/EditUserSheet.tsx` — slide-in sheet for editing name/email
  - [x] Implement edit mode: inline form with Name and Email fields (role not editable)
  - [x] Add i18n translation keys for edit form labels and button
- [ ] Task: Conductor - User Manual Verification 'Phase 5: User Detail/Edit Page' (Protocol in workflow.md)

## Phase: Review Fixes
- [x] Task: Apply review suggestions (383d948)
