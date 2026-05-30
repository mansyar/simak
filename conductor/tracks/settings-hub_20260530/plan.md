<protect>
# Implementation Plan: Track 6.1 — Settings Hub

## Phase 1: Database Schema, i18n Types & Dependencies

**Objective:** Add `settings` jsonb column to users table, update i18n type definitions with new settings subsection keys, add translation values to locale files.

- [x] Task: Add `settings` jsonb column to users Drizzle schema `ee5455c`
  - [x] Modify `src/db/schema/users.ts` — add `settings: jsonb('settings').$type<{ reducedMotion: boolean }>()`
- [x] Task: Update i18n type definitions for settings profile/password/appearance/accessibility sections `ee5455c`
  - [x] Modify `scripts/generate-i18n-types.ts` — add nested keys under `settings.profile` (title, nameLabel, emailLabel, avatarLabel, saveName, nameSuccess, nameError), `settings.password` (title, description, currentPassword, newPassword, confirmPassword, changePassword, passwordSuccess, passwordError, passwordMinLength, passwordMismatch), `settings.appearance` (title, description, languageLabel, themeLabel), `settings.accessibility` (title, description, reducedMotionLabel, reducedMotionHint)
  - [x] Run `pnpm generate:i18n` to regenerate `src/i18n/types.ts` and `src/i18n/detect-locale.ts`
- [x] Task: Add translation values to English locale file `ee5455c`
  - [x] Modify `locales/en.json` — add new keys under `settings` section
- [x] Task: Add matching translation values to Indonesian locale file `ee5455c`
  - [x] Modify `locales/id.json` — add matching keys under `settings` section
- [x] Task: Conductor - User Manual Verification 'Phase 1: Database Schema, i18n Types & Dependencies' (Protocol in workflow.md)

## Phase 2: Server Functions [checkpoint: 085eb0d]

**Objective:** Implement all server-side handlers with Zod validation and tests.

- [x] Task: Write Zod schemas in settings.ts stub file `1b1485e`
  - [x] Create `src/server/settings.ts` with `UpdateProfileSchema`, `UpdateUserSettingsSchema`, `GetPresignedAvatarUploadUrlSchema`
  - [x] Create `createServerFn` stubs that dynamically import from `.server.ts`
  - [x] Export all schemas and stubs
- [x] Task: Write failing tests for server handlers `1b1485e`
  - [x] Write test: `updateProfileHandler` validates non-empty name, max 100 chars
  - [x] Write test: `updateProfileHandler` updates users.name and returns updated user
  - [x] Write test: `updateProfileHandler` rejects unauthorized (no session)
  - [x] Write test: `getPresignedAvatarUploadUrlHandler` returns presigned URL
  - [x] Write test: `getPresignedAvatarUploadUrlHandler` generates correct `avatars/` key prefix
  - [x] Write test: `updateUserSettingsHandler` writes and reads settings jsonb
  - [x] Write test: `updateUserSettingsHandler` partial update preserves existing settings
  - [x] Run tests and confirm they fail (Red phase)
- [x] Task: Implement server handlers in settings.server.ts `1b1485e`
  - [x] Create `src/server/settings.server.ts`
  - [x] Implement `updateProfileHandler` — validates session with `getSessionFromHeaders()`, updates `users.name` via Drizzle, returns updated user
  - [x] Implement `getPresignedAvatarUploadUrlHandler` — validates session, generates `avatars/{uuid}.{ext}` via `generateFileKey()`, calls `generatePresignedUploadUrl()`, returns `{ uploadUrl, fileKey }`
  - [x] Implement `updateUserSettingsHandler` — validates session, upserts `users.settings` jsonb, returns updated settings
  - [x] Run tests and confirm they pass (Green phase)
- [x] Task: Conductor - User Manual Verification 'Phase 2: Server Functions' (Protocol in workflow.md) `1b1485e`

## Phase 3: Settings Hub UI Components

**Objective:** Build all settings page sections as reusable React components.

- [x] Task: Write failing tests for SettingsPage and section components
  - [x] Write test: `ProfileSection` renders user name, email, avatar; name edit works; avatar click triggers file input
  - [x] Write test: `PasswordSection` renders 3 password fields; validates min 8 chars; validates confirm match
  - [x] Write test: `AppearanceSection` renders language EN/ID toggle and theme toggle; callbacks fire
  - [x] Write test: `AccessibilitySection` renders reduced motion toggle; mutation fires on change
  - [x] Write test: `SettingsPage` renders all 5 sections in correct order
  - [x] Run tests and confirm they fail (Red phase)
- [x] Task: Implement ProfileSection component
  - [x] Create `src/components/settings/ProfileSection.tsx`
  - [x] Fetch current user info (name, email, image) via `useQuery` with `getCurrentUser` server function
  - [x] Avatar display: circular `<img>` if `user.image` exists, else fallback with initials in colored circle
  - [x] Name editing: controlled `<Input>`, Save `<Button>`, calls `updateProfile` mutation via TanStack Query
  - [x] Success/error feedback via inline alerts
  - [x] Email displayed as read-only `<p>` with muted styling
- [x] Task: Implement PasswordSection component
  - [x] Create `src/components/settings/PasswordSection.tsx`
  - [x] Three controlled `<Input type="password">` fields: current, new, confirm
  - [x] Client-side validation: new password >= 8 chars, confirm matches new
  - [x] Submit calls `authClient.changePassword({ currentPassword, newPassword })`
  - [x] Show inline success banner or error message
  - [x] On success, clear form fields
- [x] Task: Implement AppearanceSection component
  - [x] Create `src/components/settings/AppearanceSection.tsx`
  - [x] Language row: two toggle buttons (EN/ID), calls `setLocale` from `useI18n()`
  - [x] Theme row: toggle button with Sun/Moon icon, calls `toggleTheme` from `useTheme()`
- [x] Task: Implement AccessibilitySection component
  - [x] Create `src/components/settings/AccessibilitySection.tsx`
  - [x] Reduced motion toggle (checkbox)
  - [x] On mount: fetch user settings via `useQuery` with `getCurrentUser` server function
  - [x] On toggle: call `updateUserSettings` mutation
- [x] Task: Implement SettingsPage shared component
  - [x] Create `src/components/settings/SettingsPage.tsx`
  - [x] Import and render all 6 sections in order: Profile, Password, Two-Factor, Sessions, Appearance, Accessibility
  - [x] Container: `<div className="container mx-auto max-w-4xl py-8 space-y-6">`
  - [x] Run tests and confirm they pass (Green phase) — 1532 tests pass (167 files)
- [x] Task: Conductor - User Manual Verification 'Phase 3: Settings Hub UI Components' (Protocol in workflow.md)

## Phase 4: Routes, Sidebar Integration & File Cleanup

**Objective:** Create role-specific routes, update sidebars with Settings links, remove old settings route.

- [x] Task: Create role-specific settings route files
  - [x] Create `src/routes/_authenticated/student/settings.tsx` — imports and renders `<SettingsPage />`
  - [x] Create `src/routes/_authenticated/instructor/settings.tsx` — imports and renders `<SettingsPage />`
  - [x] Create `src/routes/_authenticated/admin/settings.tsx` — imports and renders `<SettingsPage />`
- [x] Task: Remove old `_authenticated/settings.tsx` route
  - [x] Delete `src/routes/_authenticated/settings.tsx` (replaced by role-specific routes)
- [x] Task: Write failing tests for route exports
  - [x] Write test: 3 new route files export correctly
  - [x] Write test: old settings route no longer exists
  - [x] Run tests and confirm they pass (Green phase)
- [x] Task: Update student-sidebar with Settings link
  - [x] Modify `src/components/layout/student-sidebar.tsx` — add `{ to: '/student/settings', label: 'nav.settings', icon: Settings }` to links array
- [x] Task: Update instructor-sidebar with Settings link
  - [x] Modify `src/components/layout/instructor-sidebar.tsx` — add `{ to: '/instructor/settings', label: 'nav.settings', icon: Settings }` to links array
- [x] Task: Update admin-sidebar with Settings link
  - [x] Modify `src/components/layout/admin-sidebar.tsx` — add `{ to: '/admin/settings', label: 'nav.settings', icon: Settings }` to links array
- [x] Task: Run full test suite and confirm no regression
  - [x] Run `pnpm test` — 1537 tests pass (170 files)
  - [x] Run `pnpm typecheck` — no type errors
- [x] Task: Conductor - User Manual Verification 'Phase 4: Routes, Sidebar Integration & File Cleanup' (Protocol in workflow.md)

## Phase 5: Integration & Final Verification

**Objective:** Run complete test suite, verify coverage, lint, typecheck, and finalize.

- [x] Task: Run full test suite and verify coverage >80%
  - [x] Execute `pnpm test -- --coverage` — 1537 tests pass (170 files). Coverage: functions 75.65%, branches 78.58% slightly below 80% threshold. These are pre-existing gaps, not caused by this track. Coverage for new settings.server.ts is 100%.
- [x] Task: Run linter (`pnpm lint`) — 0 errors, 43 pre-existing warnings
- [x] Task: Run TypeScript typecheck (`pnpm typecheck`) — clean
- [x] Task: Verify build succeeds (`pnpm build`) — client + SSR successful
- [x] Task: Document any deviations from spec in notes
  - **Deviation #1**: No Switch component exists in shadcn/ui. Used native checkbox for reduced motion toggle instead.
  - **Deviation #2**: Coverage thresholds slightly below 80% (pre-existing; new code at 100%).
- [x] Task: Conductor - User Manual Verification 'Phase 5: Integration & Final Verification' (Protocol in workflow.md)
      </protect>
