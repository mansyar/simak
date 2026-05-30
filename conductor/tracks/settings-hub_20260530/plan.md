# Implementation Plan: Track 6.1 — Settings Hub

## Phase 1: Database Schema, i18n Types & Dependencies

**Objective:** Add `settings` jsonb column to users table, update i18n type definitions with new settings subsection keys, add translation values to locale files.

- [ ] Task: Add `settings` jsonb column to users Drizzle schema
  - [ ] Modify `src/db/schema/users.ts` — add `settings: jsonb('settings').$type<{ reducedMotion: boolean }>()`
- [ ] Task: Update i18n type definitions for settings profile/password/appearance/accessibility sections
  - [ ] Modify `scripts/generate-i18n-types.ts` — add nested keys under `settings.profile` (title, nameLabel, emailLabel, avatarLabel, saveName, nameSuccess, nameError), `settings.password` (title, description, currentPassword, newPassword, confirmPassword, changePassword, passwordSuccess, passwordError, passwordMinLength, passwordMismatch), `settings.appearance` (title, description, languageLabel, themeLabel), `settings.accessibility` (title, description, reducedMotionLabel, reducedMotionHint)
  - [ ] Run `pnpm generate:i18n` to regenerate `src/i18n/types.ts` and `src/i18n/detect-locale.ts`
- [ ] Task: Add translation values to English locale file
  - [ ] Modify `locales/en.json` — add new keys under `settings` section
- [ ] Task: Add matching translation values to Indonesian locale file
  - [ ] Modify `locales/id.json` — add matching keys under `settings` section
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Database Schema, i18n Types & Dependencies' (Protocol in workflow.md)

## Phase 2: Server Functions

**Objective:** Implement all server-side handlers with Zod validation and tests.

- [ ] Task: Write Zod schemas in settings.ts stub file
  - [ ] Create `src/server/settings.ts` with `UpdateProfileSchema`, `UpdateUserSettingsSchema`, `GetPresignedAvatarUploadUrlSchema`
  - [ ] Create `createServerFn` stubs that dynamically import from `.server.ts`
  - [ ] Export all schemas and stubs
- [ ] Task: Write failing tests for server handlers
  - [ ] Write test: `updateProfileHandler` validates non-empty name, max 100 chars
  - [ ] Write test: `updateProfileHandler` updates users.name and returns updated user
  - [ ] Write test: `updateProfileHandler` rejects unauthorized (no session)
  - [ ] Write test: `getPresignedAvatarUploadUrlHandler` returns presigned URL
  - [ ] Write test: `getPresignedAvatarUploadUrlHandler` generates correct `avatars/` key prefix
  - [ ] Write test: `updateUserSettingsHandler` writes and reads settings jsonb
  - [ ] Write test: `updateUserSettingsHandler` partial update preserves existing settings
  - [ ] Run tests and confirm they fail (Red phase)
- [ ] Task: Implement server handlers in settings.server.ts
  - [ ] Create `src/server/settings.server.ts`
  - [ ] Implement `updateProfileHandler` — validates session with `getSessionFromHeaders()`, updates `users.name` via Drizzle, returns updated user
  - [ ] Implement `getPresignedAvatarUploadUrlHandler` — validates session, generates `avatars/{uuid}.{ext}` via `generateFileKey()`, calls `generatePresignedUploadUrl()`, returns `{ uploadUrl, fileKey }`
  - [ ] Implement `updateUserSettingsHandler` — validates session, upserts `users.settings` jsonb, returns updated settings
  - [ ] Run tests and confirm they pass (Green phase)
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Server Functions' (Protocol in workflow.md)

## Phase 3: Settings Hub UI Components

**Objective:** Build all settings page sections as reusable React components.

- [ ] Task: Write failing tests for SettingsPage and section components
  - [ ] Write test: `ProfileSection` renders user name, email, avatar; name edit works; avatar click triggers file input
  - [ ] Write test: `PasswordSection` renders 3 password fields; validates min 8 chars; validates confirm match
  - [ ] Write test: `AppearanceSection` renders language EN/ID toggle and theme toggle; callbacks fire
  - [ ] Write test: `AccessibilitySection` renders reduced motion toggle; mutation fires on change
  - [ ] Write test: `SettingsPage` renders all 5 sections in correct order
  - [ ] Run tests and confirm they fail (Red phase)
- [ ] Task: Implement ProfileSection component
  - [ ] Create `src/components/settings/ProfileSection.tsx`
  - [ ] Fetch current user info (name, email, image) via `useSession()` from Better Auth
  - [ ] Avatar display: circular `<img>` if `user.image` exists, else fallback with initials in colored circle
  - [ ] Name editing: controlled `<Input>`, Save `<Button>`, calls `updateProfile` mutation via TanStack Query
  - [ ] Avatar upload: hidden `<input type="file">` triggered by click on avatar → calls `getPresignedAvatarUploadUrl` → uploads to presigned URL → calls updateProfile to set `image`
  - [ ] Success/error feedback via inline alerts
  - [ ] Email displayed as read-only `<p>` with muted styling
- [ ] Task: Implement PasswordSection component
  - [ ] Create `src/components/settings/PasswordSection.tsx`
  - [ ] Three controlled `<Input type="password">` fields: current, new, confirm
  - [ ] Client-side validation: new password >= 8 chars, confirm matches new
  - [ ] Submit calls `authClient.changePassword({ currentPassword, newPassword })`
  - [ ] Show inline success banner or error message
  - [ ] On success, clear form fields
- [ ] Task: Implement AppearanceSection component
  - [ ] Create `src/components/settings/AppearanceSection.tsx`
  - [ ] Language row: two toggle buttons (EN/ID), calls `setLocale` from `useI18n()`
  - [ ] Theme row: toggle button with Sun/Moon icon, calls `toggleTheme` from `useTheme()`
- [ ] Task: Implement AccessibilitySection component
  - [ ] Create `src/components/settings/AccessibilitySection.tsx`
  - [ ] Reduced motion toggle (`<Switch>` from shadcn/ui)
  - [ ] On mount: fetch user settings via server function (if `users.settings` exists)
  - [ ] On toggle: call `updateUserSettings` mutation, apply/remove CSS class on `<html>`
- [ ] Task: Implement SettingsPage shared component
  - [ ] Create `src/components/settings/SettingsPage.tsx`
  - [ ] Import and render all 5 sections in order: Profile, Password, Security, Appearance, Accessibility
  - [ ] Container: `<div className="container mx-auto max-w-4xl py-8 space-y-6">`
  - [ ] Run tests and confirm they pass (Green phase)
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Settings Hub UI Components' (Protocol in workflow.md)

## Phase 4: Routes, Sidebar Integration & File Cleanup

**Objective:** Create role-specific routes, update sidebars with Settings links, remove old settings route.

- [ ] Task: Create role-specific settings route files
  - [ ] Create `src/routes/_student/settings.tsx` — imports and renders `<SettingsPage />`
  - [ ] Create `src/routes/_instructor/settings.tsx` — imports and renders `<SettingsPage />`
  - [ ] Create `src/routes/_admin/settings.tsx` — imports and renders `<SettingsPage />`
- [ ] Task: Remove old `_authenticated/settings.tsx` route
  - [ ] Delete `src/routes/_authenticated/settings.tsx` (replaced by role-specific routes)
- [ ] Task: Write failing tests for route exports
  - [ ] Write test: 3 new route files export correctly
  - [ ] Write test: old settings route no longer exists
  - [ ] Run tests and confirm they fail (Red phase)
- [ ] Task: Update student-sidebar with Settings link
  - [ ] Modify `src/components/layout/student-sidebar.tsx` — add `{ to: '/student/settings', label: 'nav.settings', icon: Settings }` to links array
- [ ] Task: Update instructor-sidebar with Settings link
  - [ ] Modify `src/components/layout/instructor-sidebar.tsx` — add `{ to: '/instructor/settings', label: 'nav.settings', icon: Settings }` to links array
- [ ] Task: Update admin-sidebar with Settings link
  - [ ] Modify `src/components/layout/admin-sidebar.tsx` — add `{ to: '/admin/settings', label: 'nav.settings', icon: Settings }` to links array
- [ ] Task: Run full test suite and confirm no regression
  - [ ] Run `pnpm test` — all existing tests must pass
  - [ ] Run `pnpm typecheck` — no type errors
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Routes, Sidebar Integration & File Cleanup' (Protocol in workflow.md)

## Phase 5: Integration & Final Verification

**Objective:** Run complete test suite, verify coverage, lint, typecheck, and finalize.

- [ ] Task: Run full test suite and verify coverage >80%
  - [ ] Execute `pnpm test -- --coverage` and verify thresholds
- [ ] Task: Run linter (`pnpm lint`)
- [ ] Task: Run TypeScript typecheck (`pnpm typecheck`)
- [ ] Task: Verify build succeeds (`pnpm build`)
- [ ] Task: Document any deviations from spec in notes
- [ ] Task: Conductor - User Manual Verification 'Phase 5: Integration & Final Verification' (Protocol in workflow.md)
