# Specification: Track 2.1 — User Management (Admin)

## Overview

Build the admin user management workspace — a full CRUD interface for managing users within the SIMAK system. This track enables Admins to list, create, edit, and soft-delete users. Invitation emails with password setup links are sent automatically on creation, and manual link generation is available from the user detail page. Role-specific creation rules are enforced (SuperAdmin can create Admin accounts; Admin can create Instructor/Student accounts).

## Functional Requirements

### 1. Admin Sidebar Layout (`_admin.tsx`)

- **Route:** `src/routes/_authenticated/_admin.tsx` — pathless layout nested under `_authenticated` (inherits the auth guard)
- **Guard:** `beforeLoad` must call `requireRole(['superadmin', 'admin'])`, redirecting unauthorized users to `/dashboard`
- **Layout:** Wraps content with an admin sidebar + `<Outlet />`
- **Sidebar Navigation:** Include links to:
  - Dashboard (`/dashboard`)
  - Users (`/admin/users`)
  - Templates (`/admin/templates`) — placeholder for Track 2.2
- Sidebar should indicate the currently active route using `useLocation()`

### 2. User List Page (`/admin/users`)

- **Route:** `src/routes/_authenticated/_admin/users.tsx`
- **Pagination:** 20 users per page, controlled via `?page=` search param
- **Search:** Text search by name or email
- **Role Filter:** Select dropdown (All / SuperAdmin / Admin / Instructor / Student)
- **Columns:** Name, Email, Role, Created At, Actions (Edit, Delete)
- **Actions:**
  - "New User" button → navigates to `/admin/users/new`
  - Edit → navigates to `/admin/users/$id`
  - Delete → confirmation dialog (via browser `confirm()` or shadcn AlertDialog), soft-delete on confirm
- **Loading State:** Skeleton rows while fetching
- **Empty State:** "No users found" message with prompt to create one
- **Soft-deleted users:** Filtered out of the list by default

### 3. Create User Form (`/admin/users/new`)

- **Route:** `src/routes/_authenticated/_admin/users/new.tsx`
- **Form Fields:**
  - Name (text, required)
  - Email (email, required, unique validation — also checks against soft-deleted users to avoid unique constraint violation)
  - Role (select/dropdown, required) — dynamically filtered:
    - Current user is SuperAdmin → shows [Admin, Instructor, Student]
    - Current user is Admin → shows [Instructor, Student] only
- **Validation:** Zod schema for all inputs (name min 1 char, email format, role in allowed set)
- **On Submit:**
  1. Server inserts user row directly into `users` table (no `account` row yet — password not set)
  2. Server inserts a row into `verification` table (identifier=email, value=UUID token, expiresAt=1 hour)
  3. Server constructs setup URL: `${BETTER_AUTH_URL}/auth/setup-password?token=<token>`
  4. Server calls `sendInvitationEmail()` (new function — NOT `sendPasswordResetEmail`) with the setup URL
  5. On success, redirect to `/admin/users` with success message
- **Errors:** Inline form validation errors + server error banner
- **Loading State:** Submit button shows spinner, fields disabled during submission
- **Email failure handling:** If Resend call fails, the user record creation is NOT rolled back (account exists but no email sent). An inline warning is shown: "User created but invitation email failed to send. You can generate a setup link from the user's detail page."

### 4. User Detail/Edit Page (`/admin/users/$id`)

- **Route:** `src/routes/_authenticated/_admin/users/$id.tsx`
- **View Mode (default):**
  - Display user info: Name, Email, Role, Created At, Locale, Email Verified status
  - "Edit" button to switch to edit mode
  - "Generate Setup Link" button → server creates a `verification` table token, returns the full setup URL `${BETTER_AUTH_URL}/auth/setup-password?token=<token>`, displayed in a copyable text field or modal
  - "Delete User" button with confirmation dialog
- **Edit Mode:**
  - Editable fields: Name, Email (role is NEVER editable after creation)
  - Email uniqueness validation: server checks `WHERE email = ? AND id != ? AND deletedAt IS NULL`
  - Form validation via Zod
  - On save: calls `updateUser` server function
- **Permissions:**
  - A non-SuperAdmin Admin cannot view or navigate to a SuperAdmin user's detail page (returns 404)
  - Users cannot edit themselves to change their own role (role is never editable)

### 5. Server Functions (`src/server/users.ts`)

- `listUsers(params: { page, limit, search, role })` — Paginated, filtered, searchable user list. Excludes soft-deleted users (`deletedAt IS NULL`). Returns `{ users, total }`.
- `getUser(id: string)` — Fetches single user by ID (returns null if soft-deleted). Non-SuperAdmin requesting a SuperAdmin user returns null (404).
- `createUser(data: { name, email, role })` — Creates user + verification token. Does NOT hash a password. Constructs setup URL manually. Sends invitation email via `sendInvitationEmail`. Handles email-send failure gracefully.
- `updateUser(id: string, data: { name, email })` — Updates user name and email (role unchanged). Validates email uniqueness against other active users (`id != ? AND deletedAt IS NULL`).
- `deleteUser(id: string)` — Soft-deletes user (sets `deletedAt` to `now()`). Prevents deleting own account.
- `generateSetupLink(userId: string)` — Creates a new `verification` table entry (1-hour expiry) and returns the full setup URL for manual sharing.

### 6. Invitation Email (`src/lib/email.ts` — new function)

- Create `sendInvitationEmail(params: { email, name, token })` — separate from `sendPasswordResetEmail`
- Subject: "Welcome to SIMAK — Set up your password"
- Template copy communicates invitation, not password reset:
  - "An account has been created for you on SIMAK."
  - CTA: "Set Up Password"
  - Same SIMAK-branded HTML design as existing template

### 7. i18n Translation Keys

New translation sections needed:

```json
{
  "adminSidebar": {
    "users": "Users",
    "templates": "Templates",
    "dashboard": "Dashboard"
  },
  "adminUsers": {
    "title": "Users",
    "newUser": "New User",
    "table": {
      "name": "Name",
      "email": "Email",
      "role": "Role",
      "createdAt": "Created At",
      "actions": "Actions"
    },
    "empty": "No users found",
    "createPrompt": "Create your first user",
    "deleteConfirm": "Are you sure you want to delete {name}?",
    "deleteSuccess": "User deleted successfully",
    "createSuccess": "User created successfully. Invitation email sent.",
    "createSuccessNoEmail": "User created but invitation email failed to send.",
    "updateSuccess": "User updated successfully",
    "linkGenerated": "Password setup link generated",
    "linkCopied": "Link copied to clipboard",
    "generateLink": "Generate Setup Link",
    "edit": "Edit User",
    "role_admin": "Admin",
    "role_instructor": "Instructor",
    "role_student": "Student",
    "emailVerified": "Email Verified",
    "notVerified": "Not Verified",
    "createdAt": "Created"
  }
}
```

The auto-generated type definitions in `scripts/generate-i18n-types.ts` must be updated to include these new keys.

## Non-Functional Requirements

- Role guards on both route level (sidebar layout) and server function level (admin/superadmin only)
- Invitation email uses a new `sendInvitationEmail` function (NOT reusing `sendPasswordResetEmail` — template copy is different)
- All server functions use `createServerFn` pattern consistent with existing auth flow
- Soft-deleted users remain in the database but are excluded from all list queries
- Page size (20) persisted via TanStack Router search params for shareable URLs
- `updateUser` email uniqueness check must exclude the current user and soft-deleted users
- `createUser` must check for email collision with active (non-deleted) users to avoid PK violation
- All new UI components use existing controlled-input pattern (no React Hook Form dependency for v1) to maintain consistency with existing auth pages

## UI Components Required

The following shadcn/ui components need to be installed (add to Phase 1 prep task):

- `select` — for role dropdown and role filter
- `table` — for user list
- `skeleton` — for loading states
- `badge` — for role chips
- `alert-dialog` or `dialog` — for delete confirmation (optional; `window.confirm()` is acceptable fallback)
- `sonner` — for toast notifications (optional; inline banners are acceptable fallback)

## Acceptance Criteria

- [ ] Admin user table shows 20 users per page with pagination controls
- [ ] Creating a new Instructor sends an invitation email via Resend with "Welcome" copy
- [ ] Admin (non-SuperAdmin) sees "Admin" option hidden in the role dropdown
- [ ] Generated password setup link works when opened in incognito
- [ ] Soft-deleted user disappears from the list but still exists in DB
- [ ] Student user cannot access `/admin/users` (gets redirected to `/dashboard`)
- [ ] User detail page shows generate setup link button that produces a copyable link
- [ ] Search by name/email filters the user list in real-time (debounced)
- [ ] Role filter dropdown properly scopes the user list
- [ ] Edit user form validates email uniqueness before saving (excludes own current email)
- [ ] Creating a user with the same email as a soft-deleted user shows a clear validation error
- [ ] Invitation email uses "Set Up Password" language (not "Reset Password")
- [ ] Deleting own account is prevented (validation error)
- [ ] Non-SuperAdmin Admin gets 404 when accessing a SuperAdmin user's detail page

## Out of Scope

- Bulk user operations (import CSV, batch delete)
- Assigning students to groups or courses
- User profile page for non-admin roles
- Email notification preferences per user
- Audit logging of admin actions (deferred to v2)
- React Hook Form integration (uses plain controlled inputs matching existing auth pages)
