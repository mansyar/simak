# Implementation Plan: Authentication & Authorization

## Phase 1 — Better-Auth Configuration & Core Server Functions

**Objective:** Initialize Better-Auth with database session adapter, implement auth server functions, and set up email integration.

- [ ] Task: Install and configure Better-Auth with database session adapter
  - [ ] Add `better-auth` dependency to `package.json`
  - [ ] Create `src/auth/config.ts` — Better-Auth config with `email` and `database` adapters
  - [ ] Initialize Auth instance with proper CORS and secret settings
- [ ] Task: Create email integration (`src/lib/email.ts`)
  - [ ] Initialize Resend client using validated env vars
  - [ ] Create `sendPasswordSetupEmail` template helper
  - [ ] Create `sendPasswordResetEmail` template helper
- [ ] Task: Implement auth server functions (`src/server/auth.ts`)
  - [ ] Implement `login(email, password)` — authenticate, create session, set cookie
  - [ ] Implement `logout()` — destroy session, clear cookie
  - [ ] Implement `getSession()` — return user + session or null
  - [ ] Implement `setupPassword(token, password)` — validate token, set password, mark used
  - [ ] Implement `requestPasswordReset(email)` — generate token, send email
  - [ ] Implement `resetPassword(token, newPassword)` — validate token, update password
- [ ] Task: Write unit tests for auth server functions
  - [ ] Test `getSession` returns null when no session exists
  - [ ] Test `setupPassword` validates token expiry and single-use
  - [ ] Test `setupPassword` with expired/used token returns error
  - [ ] Test `requestPasswordReset` validates email exists
- [ ] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)

## Phase 2 — Route Guard Layouts

**Objective:** Implement TanStack Router `beforeLoad` guards for unauthenticated, authenticated, and role-specific layout groups.

- [ ] Task: Create `_unauthenticated.tsx` layout
  - [ ] Define layout route file at `src/routes/_unauthenticated.tsx`
  - [ ] Implement `beforeLoad` — redirect to `/dashboard` if session exists
- [ ] Task: Create `_authenticated.tsx` layout
  - [ ] Define layout route file at `src/routes/_authenticated.tsx`
  - [ ] Implement `beforeLoad` — call `getSession()`, redirect to `/auth/login` if no session
- [ ] Task: Create role-specific guard layouts
  - [ ] Create `_student.tsx` — `beforeLoad` guards `role === 'student'`
  - [ ] Create `_instructor.tsx` — `beforeLoad` guards `role === 'instructor'`
  - [ ] Create `_admin.tsx` — `beforeLoad` guards `role === 'admin'` or `'superadmin'`
- [ ] Task: Write unit tests for route guard logic
  - [ ] Test `_unauthenticated` redirects authenticated users to dashboard
  - [ ] Test `_authenticated` redirects unauthenticated users to login
  - [ ] Test `_student` rejects non-student roles
  - [ ] Test `_instructor` rejects non-instructor roles
  - [ ] Test `_admin` accepts admin and superadmin, rejects others
- [ ] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

## Phase 3 — Login Page

**Objective:** Build a custom shadcn/ui login page with email/password form, Zod validation, and language switcher.

- [ ] Task: Create login page route (`src/routes/auth/login.tsx`)
  - [ ] Build email + password form with React Hook Form + Zod validation
  - [ ] Integrate with `login` server function
  - [ ] Show inline error for invalid credentials
  - [ ] Add "Forgot Password?" link
  - [ ] Add language switcher (EN/ID toggle)
  - [ ] Add dark mode support
  - [ ] Add skip-to-content link and WCAG focus management
  - [ ] On success: redirect to `/dashboard`
- [ ] Task: Write unit tests for login page
  - [ ] Test form validation (empty fields, invalid email format)
  - [ ] Test error display on invalid credentials
  - [ ] Test successful login redirect
- [ ] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)

## Phase 4 — Password Setup & Reset Pages

**Objective:** Implement password setup (invitation flow) and forgot password / reset password flows.

- [ ] Task: Create password setup page (`src/routes/auth/setup-password.tsx`)
  - [ ] Read token from URL search params (`?token=xxx`)
  - [ ] Validate token server-side before showing form
  - [ ] Password + confirm password fields with Zod validation
  - [ ] Expired/used token shows "link expired" error view
  - [ ] On success: redirect to `/auth/login` with success message
- [ ] Task: Create forgot password & reset password pages
  - [ ] Add "Forgot Password" form on login page (email input, sends reset email)
  - [ ] Create reset password page (`src/routes/auth/reset-password.tsx`)
  - [ ] Same token validation rules as setup password
- [ ] Task: Write unit tests for password flow
  - [ ] Test token validation logic (valid, expired, used)
  - [ ] Test password confirmation matching
  - [ ] Test error views for invalid tokens
- [ ] Task: Conductor - User Manual Verification 'Phase 4' (Protocol in workflow.md)

## Phase 5 — Dashboard Placeholder

**Objective:** Create a role-aware dashboard page that greets the user by role and provides navigation links.

- [ ] Task: Create dashboard page (`src/routes/dashboard.tsx`)
  - [ ] Fetch current session via `getSession()`
  - [ ] Display role-specific greeting (e.g., "Welcome, Student")
  - [ ] Add navigation links to role-appropriate sections
  - [ ] Add logout button
- [ ] Task: Write unit tests for dashboard
  - [ ] Test role-specific content renders correctly
  - [ ] Test logout action
- [ ] Task: Update route tree and verify all routes work together
- [ ] Task: Conductor - User Manual Verification 'Phase 5' (Protocol in workflow.md)
