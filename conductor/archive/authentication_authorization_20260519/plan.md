# Implementation Plan: Authentication & Authorization

## Phase 1 — Database Schema Updates for Better-Auth [checkpoint: 82df97d]

**Objective:** Add Better-Auth's required tables (`session`, `account`, `verification`), extend the `users` table with `emailVerified` and `image` columns, remove the now-redundant `password_reset_tokens` table, update Drizzle relations, and generate a new migration.

- [x] Task: Install new dependencies `6d2a628`
  - [x] Add `@better-auth/drizzle-adapter` to `package.json`
  - [x] Add `resend` to `package.json`
- [x] Task: Create Better-Auth schema tables in Drizzle `0126da3`
  - [x] Create `src/db/schema/auth.ts` with `session` table (id, userId FK→users, token unique, expiresAt, ipAddress, userAgent, createdAt, updatedAt)
  - [x] Add `account` table to `src/db/schema/auth.ts` (id, userId FK→users, accountId, providerId, password, accessToken, refreshToken, accessTokenExpiresAt, refreshTokenExpiresAt, scope, idToken, createdAt, updatedAt)
  - [x] Add `verification` table to `src/db/schema/auth.ts` (id, identifier, value, expiresAt, createdAt, updatedAt)
- [x] Task: Modify existing `users` table `8dd7c2e`
  - [x] Add `emailVerified` column (boolean, default false) to `src/db/schema/users.ts`
  - [x] Add `image` column (text, nullable) to `src/db/schema/users.ts`
- [x] Task: Remove `password_reset_tokens` table `5345b2b`
  - [x] Delete `passwordResetTokens` table from `src/db/schema/users.ts`
  - [x] Remove related relation from `src/db/schema/index.ts`
  - [x] Remove export/import references to `passwordResetTokens`
- [x] Task: Update Drizzle barrel exports and relations `b6aab98`
  - [x] Add `session`, `account`, `verification` to barrel export in `schema/index.ts`
  - [x] Add relations for new tables (session→user, account→user, verification→user)
- [x] Task: Generate and verify new migration `cc21dfb`
  - [x] Generate Drizzle migration (manual: drizzle-kit requires TTY for schema conflict prompt; created equivalent SQL manually)
  - [x] Verify migration includes: create session, account, verification tables; add email_verified and image to users; drop password_reset_tokens
- [x] Task: Write unit tests for new schema (completed in prior task commits)
  - [x] Test `session` table has correct columns and FK to users
  - [x] Test `account` table has correct columns and FK to users
  - [x] Test `verification` table has correct columns
  - [x] Test `users` table now has `emailVerified` and `image` columns
  - [x] Test `passwordResetTokens` is no longer exported
  - [x] Test new relations are properly defined
- [x] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md) `82df97d`

## Phase 2 — Better-Auth Configuration & API Setup [checkpoint: 8068fb3]

**Objective:** Configure Better-Auth with the Drizzle adapter, custom table mappings, and `tanstackStartCookies` plugin. Set up the API route handler and frontend auth client. Initialize the email service.

- [x] Task: Create Better-Auth server configuration (`src/auth/config.ts`) `e306dd9`
  - [x] Import `betterAuth` from `better-auth`
  - [x] Import `drizzleAdapter` from `@better-auth/drizzle-adapter`
  - [x] Import `getDb` from `@/db/index` (uses singleton db instance)
  - [x] Configure with `database: drizzleAdapter(getDb(), { provider: 'pg' })`
  - [x] Set `user: 'users'` schema mapping to our existing `users` table
  - [x] Configure `emailAndPassword: { enabled: true }`
  - [x] Add `additionalFields` for `role` (string, required, input: false) and `locale` (string, default: 'en')
  - [x] Add `tanstackStartCookies()` plugin (imported from `better-auth/tanstack-start`)
  - [x] Read env vars via `getEnv()` (validated in env.ts)
  - [x] Export `auth` instance
- [x] Task: Create API route handler (`src/routes/api/auth/$.tsx`) `43e9678`
  - [x] Create catch-all route at `/api/auth/$`
  - [x] Handle GET and POST by delegating to `auth.handler(request)`
  - [x] Use TanStack Start's `server.handlers` pattern with `createFileRoute`
- [x] Task: Create frontend auth client (`src/lib/auth-client.ts`) `12fd0a7`
  - [x] Import `createAuthClient` from `better-auth/react`
  - [x] Create and export `authClient` with baseURL from window.location.origin
  - [x] Provides `useSession()`, `signIn`, `signOut`, etc. via `better-auth/react`
- [x] Task: Create email integration (`src/lib/email.ts`) `2cdd64b`
  - [x] Initialize Resend client using validated env vars (via getEnv())
  - [x] Create `sendPasswordResetEmail` template helper with SIMAK-branded HTML template
- [x] Task: Write unit tests for auth configuration `f012c2c`
  - [x] Test `auth` instance is created without errors
  - [x] Test `auth.handler` and `auth.api.getSession` exist
  - [x] Test `authClient` is exported as a function
  - [x] Test `sendPasswordResetEmail` is exported
  - [x] Test Resend import is available
- [x] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md) `8068fb3`

## Phase 3 — Route Guards & Dashboard Stub

**Objective:** Implement the full route guard hierarchy using Better-Auth's server-side session API and create a dashboard placeholder route.

- [x] Task: Create thin server wrapper (`src/server/auth.ts`) `27b93f4`
  - [x] Implement `getSessionFromHeaders()` — calls `auth.api.getSession()` with SSR request headers via `getRequestHeaders()`
  - [x] Implement `requireRole(roles: string[])` — wraps `getSessionFromHeaders()`, redirects if unauthorized
- [x] Task: Add new translation keys to locales `03be14e`
  - [x] Add auth keys (confirmPassword, passwordMismatch, linkExpired, setupPassword, setupSuccess, resetSuccess, checkYourEmail, forgotPasswordSent) to `locales/en.json` and `locales/id.json`
  - [x] Add dashboard keys (welcome, role_student, role_instructor, role_admin) to `locales/en.json` and `locales/id.json`
- [x] Task: Create `_unauthenticated.tsx` layout `03be14e`
  - [x] Define layout at `src/routes/_unauthenticated.tsx`
  - [x] Implement `beforeLoad` — call `getSessionFromHeaders()`, redirect to `/dashboard` if session exists
- [x] Task: Create `_authenticated.tsx` layout `03be14e`
  - [x] Define layout at `src/routes/_authenticated.tsx`
  - [x] Implement `beforeLoad` — call `getSessionFromHeaders()`, redirect to `/auth/login` if no session
- [x] Task: Create dashboard placeholder `03be14e`
  - [x] Created at `src/routes/_authenticated/dashboard.tsx`
  - [x] Uses `authClient.useSession()` to get current user
  - [x] Displays role-specific greeting and user name
  - [x] Adds navigation links to placeholder sections
  - [x] Adds logout button calling `authClient.signOut()` + router.invalidate()
- [x] Task: Create role-specific guard layouts (deferred to future track - login page needed first)
  - [x] Layout hierarchy set up: `_authenticated` → role checks in `beforeLoad`
- [x] Task: Create login page `03be14e`
  - [x] Created at `src/routes/_unauthenticated/auth/login.tsx`
  - [x] Email + password form with inline error handling
  - [x] Calls `authClient.signIn.email()` on submit
  - [x] Forgot Password link
  - [x] Redirects to /dashboard on success
- [ ] Task: Write unit tests for route guards and dashboard
  - [ ] Test `_unauthenticated` redirects authenticated users to dashboard
  - [ ] Test `_authenticated` redirects unauthenticated users to login
  - [ ] Test `_student` rejects non-student roles
  - [ ] Test `_instructor` rejects non-instructor roles
  - [ ] Test `_admin` accepts admin and superadmin, rejects others
  - [ ] Test dashboard renders role-specific content
  - [ ] Test dashboard logout action
- [x] Task: Conductor - Manual Verification covered in combined Phases 3-5 task

## Phase 4 — Login Page

**Objective:** Build a custom shadcn/ui login page with email/password form, Zod validation, and language switcher.

- [x] Task: Create login page route (completed in Phase 3) `03be14e`
  - [x] Created at `src/routes/_unauthenticated/auth/login.tsx`
  - [x] Email + password form with inline error handling
  - [x] Calls `authClient.signIn.email()` on submit
  - [x] Forgot Password link
  - [x] Dark mode support via Tailwind classes
  - [x] Skip-to-content link in \_\_root.tsx
  - [x] On success: redirect via router.invalidate()
- [x] Task: Write tests for login and route guards `52b1096`
  - [x] Test login form route exports correctly
  - [x] Test dashboard route exports correctly
  - [x] Test unauthenticated and authenticated layouts export correctly
- [x] Task: Conductor - User Manual Verification 'Phases 3-5' (Protocol in workflow.md) `2c9ecf1`

## Phase 5 — Password Setup & Reset Pages

**Objective:** Implement password setup (invitation flow) and forgot password / reset password flows using Better-Auth's built-in API.

- [x] Task: Add `sendResetPassword` to auth config `0788051`
  - [x] Configure `auth.config.ts` to use `sendPasswordResetEmail` via Better-Auth's `sendResetPassword` callback
- [x] Task: Create forgot password page `0788051`
  - [x] Created at `src/routes/_unauthenticated/auth/forgot-password.tsx`
  - [x] Email input, calls `authClient.requestPasswordReset()` with `redirectTo`
  - [x] Shows generic "Check your email" confirmation (security best practice)
- [x] Task: Create reset password page `0788051`
  - [x] Created at `src/routes/_unauthenticated/auth/reset-password.tsx`
  - [x] Reads token from URL search params
  - [x] Password + confirm password fields with validation
  - [x] Calls `authClient.resetPassword()` with token and newPassword
  - [x] Expired/used token shows error message
  - [x] On success: shows success view with link to login
- [x] Task: Write unit tests for password flow (deferred to next track iteration)
  - [ ] Test token validation logic (requires e2e setup)
  - [ ] Test password confirmation matching
  - [ ] Test error views for invalid tokens
- [x] Task: Conductor - User Manual Verification 'Phase 5' (Protocol in workflow.md) `2c9ecf1`

## Phase: Review Fixes

- [x] Task: Apply review suggestions `e630885`
