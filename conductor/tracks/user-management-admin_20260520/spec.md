# Specification: Track 2.1 — User Management (Admin)

## Overview

Build the admin user management workspace — a full CRUD interface for managing users within the SIMAK system. This track enables Admins to list, create, edit, and soft-delete users. Invitation emails with password setup links are sent automatically on creation, and manual link generation is available from the user detail page. Role-specific creation rules are enforced (SuperAdmin can create Admin accounts; Admin can create Instructor/Student accounts).

## Functional Requirements

### 1. Admin Sidebar Layout (`_admin.tsx`)

- **Route:** `src/routes/_admin.tsx` — pathless layout route
- **Guard:** `beforeLoad` must call `requireRole(['superadmin', 'admin'])`, redirecting unauthorized users to `/dashboard`
- **Sidebar Navigation:** Include links to:
  - Dashboard (`/dashboard`)
  - Users (`/admin/users`)
  - Templates (`/admin/templates`) — placeholder for Track 2.2
- Sidebar should indicate the currently active route

### 2. User List Page (`/admin/users`)

- **Route:** `src/routes/admin/users.tsx`
- **Pagination:** 20 users per page, controlled via `?page=` search param
- **Search:** Text search by name or email
- **Role Filter:** Dropdown filter (All / SuperAdmin / Admin / Instructor / Student)
- **Columns:** Name, Email, Role, Created At, Actions (Edit, Delete)
- **Actions:**
  - "New User" button → navigates to `/admin/users/new`
  - Edit → navigates to `/admin/users/$id`
  - Delete → confirmation dialog, soft-delete on confirm
- **Loading State:** Skeleton rows while fetching
- **Empty State:** "No users found" message with prompt to create one
- **Soft-deleted users:** Filtered out of the list by default

### 3. Create User Form (`/admin/users/new`)

- **Route:** `src/routes/admin/users/new.tsx`
- **Form Fields:**
  - Name (text, required)
  - Email (email, required, unique validation)
  - Role (dropdown, required) — dynamically filtered:
    - Current user is SuperAdmin → shows [Admin, Instructor, Student]
    - Current user is Admin → shows [Instructor, Student] only
- **Validation:** Zod schema for all inputs
- **On Submit:**
  1. Server creates user record with hashed password (via Better-Auth's verification token flow)
  2. Server sends invitation email via Resend with password setup link
  3. On success, redirect to `/admin/users` with success toast
- **Errors:** Inline form validation errors + server error banner
- **Loading State:** Submit button shows spinner, fields disabled during submission

### 4. User Detail/Edit Page (`/admin/users/$id`)

- **Route:** `src/routes/admin/users/$id.tsx`
- **View Mode (default):**
  - Display user info: Name, Email, Role, Created At, Locale, Email Verified status
  - "Edit" button to switch to edit mode
  - "Generate Setup Link" button → server generates a one-time password setup link, displayed in a copyable text field/modal
  - "Delete User" button with confirmation dialog
- **Edit Mode:**
  - Editable fields: Name, Email (role is NOT editable after creation)
  - Form validation via Zod
  - On save: calls `updateUser` server function
- **Permissions:**
  - A non-SuperAdmin Admin cannot view or navigate to a SuperAdmin user's detail page (404 or forbidden)
  - Users cannot edit themselves to change their own role (role is never editable)

### 5. Server Functions (`src/server/users.ts`)

- `listUsers(params: { page, limit, search, role })` — Paginated, filtered, searchable user list. Excludes soft-deleted users.
- `createUser(data: { name, email, role })` — Creates user + verification token, sends invitation email via Resend, returns user
- `updateUser(id: string, data: { name, email })` — Updates user name and email (role unchanged)
- `deleteUser(id: string)` — Soft-deletes user (sets `deletedAt` timestamp)
- `generateSetupLink(userId: string)` — Creates a new Better-Auth verification token and returns the full setup URL (for manual sharing)
- `getUser(id: string)` — Fetches single user by ID

## Non-Functional Requirements

- Role guards on both route level (sidebar layout) and server function level (admin/superadmin only)
- Email delivery uses existing `sendPasswordResetEmail` from `src/lib/email.ts` (Resend)
- All server functions use `createServerFn` pattern consistent with existing auth flow
- Soft-deleted users remain in the database but are excluded from all list queries
- Page size (20) persisted via TanStack Router search params for shareable URLs

## Acceptance Criteria

- [ ] Admin user table shows 20 users per page with pagination controls
- [ ] Creating a new Instructor sends an invitation email via Resend
- [ ] Admin (non-SuperAdmin) sees "Admin" option disabled/hidden in the role dropdown
- [ ] Generated password setup link works when opened in incognito
- [ ] Soft-deleted user disappears from the list but still exists in DB
- [ ] Student user cannot access `/admin/users` (gets redirected to `/dashboard`)
- [ ] User detail page shows generate setup link button that produces a copyable link
- [ ] Search by name/email filters the user list in real-time (debounced)
- [ ] Role filter dropdown properly scopes the user list
- [ ] Edit user form validates email uniqueness before saving

## Out of Scope

- Bulk user operations (import CSV, batch delete)
- Assigning students to groups or courses
- User profile page for non-admin roles
- Email notification preferences per user
- Audit logging of admin actions (deferred to v2)
