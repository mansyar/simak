# Implementation Plan: Authentication & Authorization

## Phase 1 — Database Schema Updates for Better-Auth

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
- [ ] Task: Update Drizzle barrel exports and relations
  - [ ] Add `session`, `account`, `verification` to barrel export in `schema/index.ts`
  - [ ] Add relations for new tables (session→user, account→user, verification→user)
- [ ] Task: Generate and verify new migration
  - [ ] Run `drizzle-kit generate` and confirm valid SQL output
- [ ] Task: Write unit tests for new schema
  - [ ] Test `session` table has correct columns and FK to users
  - [ ] Test `account` table has correct columns and FK to users
  - [ ] Test `verification` table has correct columns
  - [ ] Test `users` table now has `emailVerified` and `image` columns
  - [ ] Test `passwordResetTokens` is no longer exported
  - [ ] Test new relations are properly defined
- [ ] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)

## Phase 2 — Better-Auth Configuration & API Setup

**Objective:** Configure Better-Auth with the Drizzle adapter, custom table mappings, and `tanstackStartCookies` plugin. Set up the API route handler and frontend auth client. Initialize the email service.

- [ ] Task: Create Better-Auth server configuration (`src/auth/config.ts`)
  - [ ] Import `betterAuth` from `better-auth`
  - [ ] Import `drizzleAdapter` from `@better-auth/drizzle-adapter`
  - [ ] Import `db` from `@/db/index`
  - [ ] Configure with `database: drizzleAdapter(db, { provider: 'pg' })`
  - [ ] Set `user.modelName: 'users'` to map to our existing `users` table
  - [ ] Configure `emailAndPassword: { enabled: true }`
  - [ ] Add `additionalFields` for `role` (string, required, input: false) and `locale` (string, default: 'en')
  - [ ] Add `tanstackStartCookies()` plugin (must be last plugin)
  - [ ] Read `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` from env
  - [ ] Export `auth` instance
- [ ] Task: Create API route handler (`src/routes/api/auth/$.ts`)
  - [ ] Create catch-all route at `/api/auth/*`
  - [ ] Handle GET and POST by delegating to `auth.handler(request)`
  - [ ] Use TanStack Start's server handlers pattern
- [ ] Task: Create frontend auth client (`src/lib/auth-client.ts`)
  - [ ] Import `createAuthClient` from `better-auth/react`
  - [ ] Create and export `authClient` with baseURL
  - [ ] Export convenience methods: `signIn`, `signOut`, `useSession`, etc.
- [ ] Task: Create email integration (`src/lib/email.ts`)
  - [ ] Initialize Resend client using validated env vars
  - [ ] Create `sendPasswordResetEmail` template helper
- [ ] Task: Write unit tests for auth configuration
  - [ ] Test `auth` instance is created without errors
  - [ ] Test `authClient` is created without errors
  - [ ] Test email client initialization
- [ ] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

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
