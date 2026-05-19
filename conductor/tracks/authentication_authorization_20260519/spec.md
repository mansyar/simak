# Track Specification: Authentication & Authorization

## Overview

Implement a complete authentication and authorization system using **Better-Auth** with email/password authentication, the **Drizzle ORM adapter** (`@better-auth/drizzle-adapter`), and database-backed sessions. This track adds the required database tables for Better-Auth (`session`, `account`, `verification`), configures Better-Auth to work with our existing `users` schema via custom table mapping, sets up the TanStack Start API route handler, and implements role-based route guards (`_authenticated`, `_unauthenticated`, `_student`, `_instructor`, `_admin` layout groups).

**Dependencies:** Track 1.2 (existing `users` table + Drizzle ORM setup).

---

## Database Schema Changes

Better-Auth requires 4 tables (`user`, `session`, `account`, `verification`) plus additional columns on the `user` table. We map these onto our schema as follows:

### Modified: `users` table (add 2 columns)

| Column           | Type                       | Notes                      |
| ---------------- | -------------------------- | -------------------------- |
| `email_verified` | `boolean`, default `false` | Required by Better-Auth    |
| `image`          | `text`, nullable           | User avatar URL (optional) |

Our custom columns `role` and `locale` remain on `users` — they will be exposed via Better-Auth's `additionalFields` mechanism.

### New: `session` table

| Column       | Type                     | Notes          |
| ------------ | ------------------------ | -------------- |
| `id`         | `text`, PK               | UUID           |
| `user_id`    | `text`, FK → users       | Cascade delete |
| `token`      | `text`, not null, unique | Session token  |
| `expires_at` | `timestamp`, not null    | Session expiry |
| `ip_address` | `text`, nullable         |                |
| `user_agent` | `text`, nullable         |                |
| `created_at` | `timestamp`              |                |
| `updated_at` | `timestamp`              |                |

### New: `account` table

| Column                     | Type                  | Notes                                     |
| -------------------------- | --------------------- | ----------------------------------------- |
| `id`                       | `text`, PK            | UUID                                      |
| `user_id`                  | `text`, FK → users    | Cascade delete                            |
| `account_id`               | `text`, not null      | Same as userId for credential accounts    |
| `provider_id`              | `text`, not null      | e.g. `"credential"`                       |
| `password`                 | `text`, nullable      | Hashed password (for credential provider) |
| `access_token`             | `text`, nullable      |                                           |
| `refresh_token`            | `text`, nullable      |                                           |
| `access_token_expires_at`  | `timestamp`, nullable |                                           |
| `refresh_token_expires_at` | `timestamp`, nullable |                                           |
| `scope`                    | `text`, nullable      |                                           |
| `id_token`                 | `text`, nullable      |                                           |
| `created_at`               | `timestamp`           |                                           |
| `updated_at`               | `timestamp`           |                                           |

### New: `verification` table

| Column       | Type                  | Notes              |
| ------------ | --------------------- | ------------------ |
| `id`         | `text`, PK            | UUID               |
| `identifier` | `text`, not null      | e.g. email address |
| `value`      | `text`, not null      | Token value        |
| `expires_at` | `timestamp`, not null | 1-hour expiry      |
| `created_at` | `timestamp`           |                    |
| `updated_at` | `timestamp`           |                    |

### Removed: `password_reset_tokens` table

This table is **removed** — Better-Auth manages password reset and verification tokens internally via the `verification` table.

### New Migration

Generate a new Drizzle migration (`drizzle-kit generate`) after schema changes.

---

## Functional Requirements

### FR1: Better-Auth Configuration (`src/auth/config.ts`)

- Initialize Better-Auth with the **Drizzle adapter** (`@better-auth/drizzle-adapter`)
- Map Better-Auth's internal models to our Drizzle tables:
  - `user` → `users` (via `modelName: "users"`)
  - `session` → `session`
  - `account` → `account`
  - `verification` → `verification`
- Enable **email/password** authentication
- Add the **`tanstackStartCookies()`** plugin (handles cookie setting for TanStack Start)
- Configure `additionalFields` to expose our custom columns:
  - `role` — string, required, not user-settable
  - `locale` — string, optional, default `"en"`
- Uses `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` from validated env vars
- Pass the existing `getDb()` drizzle instance as the database client

### FR2: API Route Handler (`src/routes/api/auth/$.ts`)

- TanStack Start catch-all API route at `/api/auth/*`
- Handles `GET` and `POST` by delegating to `auth.handler(request)`
- This is the server-side entry point for all Better-Auth endpoints (sign-in, sign-out, session, password reset, etc.)

### FR3: Auth Client (`src/lib/auth-client.ts`)

- Create client-side auth client via `createAuthClient()` from `better-auth/react`
- Used by all frontend components for `signIn.email()`, `signOut()`, `useSession()`, `forgetPassword()`, `resetPassword()`

### FR4: Thin Server Wrappers (`src/server/auth.ts`)

Minimal server functions that wrap Better-Auth's API for route guards and server-side checks:

- **`getSessionFromHeaders()`** — Calls `auth.api.getSession()` with the request headers from the SSR context. Returns `{ user, session }` or `null`.
- **`requireRole(roles)`** — Higher-order helper that wraps `getSessionFromHeaders()` and throws/redirects if the user's role isn't in the allowed set.

### FR5: Route Guards (TanStack Router `beforeLoad`)

**`_unauthenticated.tsx`** — Layout for public pages (login, setup-password, reset-password). Calls `getSessionFromHeaders()`. Redirects to `/dashboard` if a valid session exists.

**`_authenticated.tsx`** — Layout for all authenticated pages. Calls `getSessionFromHeaders()`. Redirects to `/auth/login` if no session exists.

**`_student.tsx`** — Inherits `_authenticated`. `beforeLoad` uses `requireRole(['student'])`.

**`_instructor.tsx`** — Inherits `_authenticated`. `beforeLoad` uses `requireRole(['instructor'])`.

**`_admin.tsx`** — Inherits `_authenticated`. `beforeLoad` uses `requireRole(['admin', 'superadmin'])`.

### FR6: Login Page (`/auth/login`)

- Email + password form with Zod validation
- Calls `authClient.signIn.email()` on submit
- Inline error message on invalid credentials
- "Forgot Password?" link
- Language switcher (EN/ID) visible on the page
- Dark mode support
- Skip-to-content link + WCAG 2.1 AA form compliance
- On success: redirect to `/dashboard`

### FR7: Password Setup Page (`/auth/setup-password`)

- Accessible via one-time token in URL: `/auth/setup-password?token=xxx`
- Password + confirm password fields with Zod validation
- Uses Better-Auth's `authClient.resetPassword()` with the token
- Expired/used token shows "link expired" error message
- On success: redirect to `/auth/login` with success message

### FR8: Forgot Password & Reset Password

- **Forgot password** form on login page (email input, calls `authClient.forgetPassword()`)
- **Reset password** page (`/auth/reset-password`) accessible via email link
- Uses Better-Auth's built-in `forgetPassword` / `resetPassword` flow
- Same token validation (1-hour expiry, single-use via Better-Auth's `verification` table)

### FR9: Email Integration (`src/lib/email.ts`)

- Resend client initialization using `RESEND_API_KEY`
- Email template helpers for password reset emails
- Templates include user name, app name (SIMAK), and action link

### FR10: Dashboard Placeholder (`/dashboard`)

- Role-aware stub page: displays role-specific greeting and navigation links
- Logout button (calls `authClient.signOut()`)
- Links to role-appropriate sections (placeholders for future tracks)

### FR11: i18n Initialization

- Properly initialize the typesafe-i18n system in `__root.tsx` so that `t('key')` resolves actual translations
- New translation keys added to `locales/en.json` and `locales/id.json`:
  - `auth.confirmPassword` / `auth.passwordMismatch` / `auth.linkExpired`
  - `auth.setupPassword` / `auth.setupSuccess` / `auth.resetSuccess`
  - `auth.checkYourEmail` / `auth.forgotPasswordSent`
  - `dashboard.welcome` / `dashboard.role_student` / `dashboard.role_instructor` / `dashboard.role_admin`

---

## Non-Functional Requirements

- **Session security**: HTTP-only cookies via Better-Auth's `tanstackStartCookies` plugin, server-side session validation on every guarded route
- **Token expiry**: Password reset tokens expire after 1 hour, single-use (managed by Better-Auth)
- **No self-registration**: No `/auth/register` page; accounts created by admins only (Track 2.1)
- **Bilingual**: All UI strings use i18n translation keys (`t('key')`)
- **Accessible**: WCAG 2.1 AA compliant forms with focus management
- **Better-Auth clean-up**: Existing `password_reset_tokens` table removed (replaced by Better-Auth's `verification` table)

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
- [ ] Better-Auth's `/api/auth/*` endpoints respond correctly (sign-in, session, sign-out)
- [ ] Dashboard shows role-appropriate greeting after login

---

## Out of Scope

- User management CRUD (deferred to Track 2.1)
- Custom invitation email for new users (uses Better-Auth's forgot-password flow for v1; deferred to Track 2.1)
- Email delivery beyond password reset (deferred to notification track)
- Two-factor authentication (deferred to v2)
- Profile/settings pages (deferred to v2)
- Rich dashboard widgets (deferred to Track 3.x / Track 7.x)
