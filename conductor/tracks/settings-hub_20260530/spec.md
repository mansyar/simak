# Track 6.1 — Settings Hub

## Overview

A unified settings page accessible from the sidebar for all roles (student, instructor, admin). Uses role-specific routes inheriting sidebar layouts (same as dashboards). Expands from the existing 2FA+Sessions page into a comprehensive hub with Profile, Password, Security, Appearance, and Accessibility sections.

**Dependencies:** V1 auth, V1 theme/language infrastructure, V1 R2 storage client, Track 3.1 (2FA & Session Management components), V1 sidebar layouts.

---

## Functional Requirements

### FR1: Route Structure

Three role-specific routes sharing a common `SettingsPage` component:

- `/student/settings` — inherits `_student` layout (student sidebar)
- `/instructor/settings` — inherits `_instructor` layout (instructor sidebar)
- `/admin/settings` — inherits `_admin` layout (admin sidebar)

Each route file is minimal (≈5 lines) — just imports and renders `SettingsPage`.

The existing `/settings` route at `/_authenticated/settings.tsx` is **removed** (replaced by role-specific routes).

Sections on the page (stacked vertically in this order):

1. Profile (name editing, avatar upload, read-only email)
2. Password (inline change password form via Better Auth)
3. Security (existing TwoFactorSettings + SessionManagement components)
4. Appearance (language EN/ID switcher + theme light/dark toggle)
5. Accessibility (reduced motion toggle)

### FR2: Profile Section

- Display current user's name, email (read-only), and avatar
- **Name editing**: Text input pre-filled with current name, Save button
- **Avatar upload**: Click-to-upload (JPEG, PNG, GIF, WebP ≤5MB) via R2 `avatars/` prefix + presigned URLs
- Circular avatar display with initials fallback
- **Server**: `updateProfile` + `getPresignedAvatarUploadUrl`

### FR3: Password Section

- Inline form: Current, New, Confirm New Password
- Uses `authClient.changePassword()`
- Validation: min 8 chars, confirm match, inline feedback

### FR4: Security Section

- Reuses `TwoFactorSettings` and `SessionManagement` unchanged

### FR5: Appearance Section

- Language EN/ID toggle + Theme light/dark toggle
- Reuses existing `useI18n().setLocale` and `useTheme()` hook

### FR6: Accessibility Section

- Reduced motion toggle → stored in `users.settings` jsonb
- Persisted via `updateUserSettings` server function
- CSS class applied on client when enabled

### FR7: Sidebar Integration

- Settings link with `Settings` icon added to all 3 sidebars
- Student → `/student/settings`, Instructor → `/instructor/settings`, Admin → `/admin/settings`
- Positioned second from bottom (above Logout)
- Uses existing `nav.settings` i18n key

---

## Non-Functional Requirements

- **Consistent UI**: Follow existing card-based settings layout pattern (TwoFactorSettings, SessionManagement)
- **Responsive**: Settings page must be usable on mobile (stack cards vertically, full width)
- **i18n**: All new UI strings translated in both EN and ID locale files
- **No regression**: Existing settings features (2FA, Session Management) must continue working unchanged

---

## Database Schema Changes

**Modified: `users`** — add `settings` jsonb column (nullable, structure: `{"reducedMotion": boolean}`)

---

## Server Functions

### `src/server/settings.ts` (Zod schemas + stubs)

- `UpdateProfileSchema`: `{ name: string (1-100) }`
- `UpdateUserSettingsSchema`: `{ reducedMotion: boolean }`
- `GetPresignedAvatarUploadUrlSchema`: `{ extension: string }`

### `src/server/settings.server.ts` (handlers)

- `updateProfileHandler` — validates session, updates `users.name`
- `updateUserSettingsHandler` — validates session, upserts `users.settings`
- `getPresignedAvatarUploadUrlHandler` — validates session, generates `avatars/{uuid}.{ext}` key, returns presigned PUT URL

---

## Files to Create/Modify

| File                                               | Action                                        |
| -------------------------------------------------- | --------------------------------------------- |
| `src/db/schema/users.ts`                           | Modify — add `settings` jsonb                 |
| `src/server/settings.ts`                           | **New** — Zod schemas + stubs                 |
| `src/server/settings.server.ts`                    | **New** — server handlers                     |
| `src/routes/_authenticated/settings.tsx`           | **Remove** — replaced by role routes          |
| `src/routes/_student/settings.tsx`                 | **New** — minimal route, imports SettingsPage |
| `src/routes/_instructor/settings.tsx`              | **New** — minimal route, imports SettingsPage |
| `src/routes/_admin/settings.tsx`                   | **New** — minimal route, imports SettingsPage |
| `src/components/settings/SettingsPage.tsx`         | **New** — shared settings hub component       |
| `src/components/settings/ProfileSection.tsx`       | **New**                                       |
| `src/components/settings/PasswordSection.tsx`      | **New**                                       |
| `src/components/settings/AppearanceSection.tsx`    | **New**                                       |
| `src/components/settings/AccessibilitySection.tsx` | **New**                                       |
| `src/components/layout/student-sidebar.tsx`        | Modify — add Settings link                    |
| `src/components/layout/instructor-sidebar.tsx`     | Modify — add Settings link                    |
| `src/components/layout/admin-sidebar.tsx`          | Modify — add Settings link                    |
| `locales/en.json`                                  | Modify — add new keys                         |
| `locales/id.json`                                  | Modify — add ID translations                  |
| `scripts/generate-i18n-types.ts`                   | Modify — add new types                        |

---

## Acceptance Criteria

- [ ] Settings accessible from sidebar for all roles → `/student/settings`, `/instructor/settings`, `/admin/settings`
- [ ] Profile name editing saves with validation (non-empty, max 100)
- [ ] Avatar upload via presigned URL → R2 `avatars/` prefix → `users.image` updated
- [ ] Current avatar shown as circle; initials fallback when none
- [ ] Email displayed read-only
- [ ] Password change via Better Auth with validation (min 8 chars, confirm match)
- [ ] Language switcher and theme toggle work on settings page
- [ ] Reduced motion toggle persists via `settings` jsonb
- [ ] 2FA and Session Management remain functional unchanged
- [ ] All new UI strings translated in EN and ID
- [ ] Migration adds `settings` column to `users`
- [ ] No regression — all existing tests pass

---

## Out of Scope

- Email editing (read-only)
- Avatar cropping/resizing
- Notification preferences (Track 6.2)
- Advanced accessibility features beyond reduced motion
- System configuration settings (admin-only)

---

## Test Plan

| Area                        | Approach                                    |
| --------------------------- | ------------------------------------------- |
| updateProfile handler       | Validate name, update DB, return user       |
| getPresignedAvatarUploadUrl | Correct `avatars/` prefix, returns URL      |
| updateUserSettings          | Read/write settings jsonb                   |
| Route exports               | 3 role routes export correctly              |
| ProfileSection              | Renders user info, name edit, avatar upload |
| PasswordSection             | Form validation, calls authClient           |
| AppearanceSection           | Language + theme toggles render             |
| AccessibilitySection        | Toggle renders, mutation fires              |
| Sidebar links               | All 3 sidebars render Settings link         |
