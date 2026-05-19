# Track Specification: Authentication & Authorization

## Overview

Implement a complete authentication and authorization system using Better-Auth with email/password authentication and database-backed sessions. This track enables user login, password setup (for invitation-only registration), password reset flows, and TanStack Router role-based route guards (`_authenticated`, `_unauthenticated`, `_student`, `_instructor`, `_admin` layout groups).

**Dependencies:** Track 1.2 (database schema with `users` and `password_reset_tokens` tables).

---

## Functional Requirements

### FR1: Better-Auth Configuration

- Initialize Better-Auth with the `email` and `database` (PostgreSQL session adapter) adapters
- Configuration lives in a dedicated `src/auth/config.ts` file
- Uses `BETTER_AUTH_SECRET` (signing secret) and `BETTER_AUTH_URL` (app public URL) from validated env vars

### FR2: Server Functions (`src/server/auth.ts`)

Implement the following server-side functions:

- **`login(email, password)`** — Authenticate user, create session, set HTTP-only cookie
- **`logout()`** — Destroy session, clear cookie
- **`getSession()`** — Return current user + session if valid, null otherwise
- **`setupPassword(token, password)`** — Validate one-time token from `password_reset_tokens`, set password, mark token as used
- **`requestPasswordReset(email)`** — Generate `password_reset_token` (1hr expiry), send email via Resend with reset link
- **`resetPassword(token, newPassword)`** — Validate token, update password, mark token as used

### FR3: Route Guards (TanStack Router `beforeLoad`)

**`_unauthenticated.tsx`** — Layout group for public pages (login, setup-password). Redirects to `/dashboard` if a valid session exists.

**`_authenticated.tsx`** — Layout group for all authenticated pages. Checks session via `getSession()`. Redirects to `/auth/login` if no session exists.

**`_student.tsx`** — Inherits `_authenticated`. `beforeLoad` verifies `user.role === 'student'`. Redirects non-students to their own dashboard.

**`_instructor.tsx`** — Inherits `_authenticated`. `beforeLoad` verifies `user.role === 'instructor'`. Redirects non-instructors.

**`_admin.tsx`** — Inherits `_authenticated`. `beforeLoad` verifies `user.role === 'admin'` or `superadmin`. Redirects non-admins.

### FR4: Login Page (`/auth/login`)

- Email + password form with Zod validation
- Inline error message on invalid credentials
- "Forgot Password?" link
- Language switcher (EN/ID) visible on the page
- Dark mode support
- Skip-to-content link
- On success: redirect to `/dashboard`

### FR5: Password Setup Page (`/auth/setup-password`)

- Accessible via one-time token in URL: `/auth/setup-password?token=xxx`
- Password + confirm password fields
- Validates token server-side before showing form
- Expired/used token shows "link expired" error message
- On success: redirect to `/auth/login` with success message

### FR6: Forgot Password / Reset Password (`/auth/reset-password`)

- Forgot password form on login page (email input, sends email)
- Reset password page accessible via email link: `/auth/reset-password?token=xxx`
- Same token validation rules as password setup

### FR7: Email Integration (`src/lib/email.ts`)

- Resend client initialization using `RESEND_API_KEY`
- Email template helpers: `sendPasswordSetupEmail`, `sendPasswordResetEmail`
- Templates include user name, app name (SIMAK), and action link

---

## Non-Functional Requirements

- **Session security**: HTTP-only cookies, server-side session validation on every guarded route
- **Token expiry**: Password setup/reset tokens expire after 1 hour, single-use
- **No self-registration**: No `/auth/register` page; accounts created by admins only
- **Bilingual**: All UI strings use i18n translation keys (`t('key')`)
- **Accessible**: WCAG 2.1 AA compliant forms with focus management

---

## Acceptance Criteria

- [ ] Login with correct credentials redirects to `/dashboard` with session cookie set
- [ ] Login with incorrect credentials shows inline error (no redirect)
- [ ] Password setup page with valid token allows setting a password
- [ ] Password setup with expired/used token shows "link expired" error
- [ ] Accessing `/student/*` while logged in as instructor redirects to instructor dashboard
- [ ] Unauthenticated user accessing any guarded route redirects to `/auth/login`
- [ ] Authenticated user visiting `/auth/login` redirects to `/dashboard`
- [ ] Language switcher visible on login page and changes UI language
- [ ] All role-specific guards reject unauthorized roles

---

## Out of Scope

- User management CRUD (deferred to Track 2.1)
- Dashboard page (placeholder widget layout only — actual widgets deferred)
- Email delivery beyond invitation/password reset (deferred to notification track)
- Two-factor authentication (deferred to v2)
- Profile/settings pages (deferred to v2)
