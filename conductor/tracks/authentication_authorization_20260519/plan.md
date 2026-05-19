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

## Phase 2 — Better-Auth Configuration & API Setup

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
- [~] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

## Phase 3 — Route Guards & Dashboard Stub

**Objective:** Implement the full route guard hierarchy using Better-Auth's server-side session API and create a dashboard placeholder route.

- [ ] Task: Create thin server wrapper (`src/server/auth.ts`)
  - [ ] Implement `getSessionFromHeaders()` — calls `auth.api.getSession()` with request headers from SSR context
  - [ ] Implement `requireRole(roles: string[])` — wraps `getSessionFromHeaders()`, throws if role not in allowed set
- [ ] Task: Properly initialize i18n in root layout
  - [ ] Update `src/routes/__root.tsx` to initialize typesafe-i18n properly
  - [ ] Implement `setLocale()` that persists to localStorage and updates context
  - [ ] Add new translation keys to `locales/en.json` and `locales/id.json` (see spec section FR11)
- [ ] Task: Create `_unauthenticated.tsx` layout
  - [ ] Define layout at `src/routes/_unauthenticated.tsx`
  - [ ] Implement `beforeLoad` — call `getSessionFromHeaders()`, redirect to `/dashboard` if session exists
- [ ] Task: Create `_authenticated.tsx` layout
  - [ ] Define layout at `src/routes/_authenticated.tsx`
  - [ ] Implement `beforeLoad` — call `getSessionFromHeaders()`, redirect to `/auth/login` if no session
- [ ] Task: Create role-specific guard layouts
  - [ ] Create `src/routes/_student.tsx` — `requireRole(['student'])`
  - [ ] Create `src/routes/_instructor.tsx` — `requireRole(['instructor'])`
  - [ ] Create `src/routes/_admin.tsx` — `requireRole(['admin', 'superadmin'])`
- [ ] Task: Create dashboard placeholder (`src/routes/dashboard.tsx`)
  - [ ] Use `authClient.useSession()` to get current user
  - [ ] Display role-specific greeting ("Welcome, Student/Instructor/Admin")
  - [ ] Add navigation links to role-appropriate sections (placeholder links)
  - [ ] Add logout button calling `authClient.signOut()`
- [ ] Task: Write unit tests for route guards and dashboard
  - [ ] Test `_unauthenticated` redirects authenticated users to dashboard
  - [ ] Test `_authenticated` redirects unauthenticated users to login
  - [ ] Test `_student` rejects non-student roles
  - [ ] Test `_instructor` rejects non-instructor roles
  - [ ] Test `_admin` accepts admin and superadmin, rejects others
  - [ ] Test dashboard renders role-specific content
  - [ ] Test dashboard logout action
- [ ] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)

## Phase 4 — Login Page

**Objective:** Build a custom shadcn/ui login page with email/password form, Zod validation, and language switcher.

- [ ] Task: Create login page route (`src/routes/auth/login.tsx`)
  - [ ] Build email + password form with React Hook Form + Zod validation
  - [ ] Call `authClient.signIn.email()` on form submit
  - [ ] Show inline error for invalid credentials
  - [ ] Add "Forgot Password?" link pointing to forgot password section
  - [ ] Add language switcher (EN/ID toggle) using i18n context
  - [ ] Ensure dark mode support via Tailwind classes
  - [ ] Add skip-to-content link and WCAG focus management
  - [ ] On success: redirect to `/dashboard`
- [ ] Task: Write unit tests for login page
  - [ ] Test form validation (empty fields, invalid email format)
  - [ ] Test error display on invalid credentials
  - [ ] Test successful login redirect
- [ ] Task: Conductor - User Manual Verification 'Phase 4' (Protocol in workflow.md)

## Phase 5 — Password Setup & Reset Pages

**Objective:** Implement password setup (invitation flow) and forgot password / reset password flows using Better-Auth's built-in API.

- [ ] Task: Create password setup page (`src/routes/auth/setup-password.tsx`)
  - [ ] Read token from URL search params (`?token=xxx`)
  - [ ] Password + confirm password fields with Zod validation
  - [ ] Call `authClient.resetPassword()` with token and new password
  - [ ] Expired/used token shows "link expired" error view
  - [ ] On success: redirect to `/auth/login` with success message
- [ ] Task: Create forgot password & reset password pages
  - [ ] Add "Forgot Password" form on login page (email input, calls `authClient.forgetPassword()`)
  - [ ] Show confirmation message: "Check your email for the reset link"
  - [ ] Create reset password page (`src/routes/auth/reset-password.tsx`)
  - [ ] Same token validation as setup password page
- [ ] Task: Write unit tests for password flow
  - [ ] Test token validation logic (valid, expired, used)
  - [ ] Test password confirmation matching
  - [ ] Test error views for invalid tokens
- [ ] Task: Conductor - User Manual Verification 'Phase 5' (Protocol in workflow.md)
