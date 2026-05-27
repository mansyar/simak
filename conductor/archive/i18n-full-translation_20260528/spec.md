# Track: Internationalization — Full Translation Pass

## Overview

The i18n infrastructure was set up in Track 1.1 (typesafe-i18n library, locale resolution engine, translation files with starter keys, language switcher component). However, as features were built in subsequent tracks, new translation keys were added to the JSON locale files but the TypeScript type definition (`scripts/generate-i18n-types.ts`) was not consistently updated to match. Additionally, many UI surfaces contain hardcoded English strings that are not routed through the i18n system.

This track completes the i18n implementation: bring the type definitions up to sync with the actual locale files, audit every UI surface for hardcoded strings, replace them with translation keys, and ensure 100% key coverage between `en.json` and `id.json`.

## Type Definition Gaps (scripts/generate-i18n-types.ts)

The following sections and keys exist in `en.json`/`id.json` but are **missing** from the TypeScript type definition:

### Missing keys in existing sections:

- **auth**: confirmPassword, passwordMismatch, linkExpired, setupPassword, setupSuccess, resetSuccess, checkYourEmail, forgotPasswordSent
- **nav**: welcome, role_student, role_instructor, role_admin
- **adminUsers**: role_superadmin, allRoles, searchPlaceholder
- **adminTemplates.form**: minConsultations
- **studentAssignments**: resubmit, viewSubmission, consultations, notFound, notFoundDescription

### Entire sections missing from type definition:

- **instructorAssignments** (already in `en.json`/`id.json`)
- **files** (already in `en.json`/`id.json`)
- **consultations** (already in `en.json`/`id.json`)

## Hardcoded Strings Audit

~78 hardcoded English UI strings were found across 36 files in `src/routes/` and `src/components/`. Categories include:

1. **Validation/error messages** (19 instances) — e.g., "Title is required", "Password must be at least 8 characters"
2. **Placeholder text** (13 instances) — e.g., "you@example.com", "John Doe", "Search templates..."
3. **Description/subtitle text** (8 instances) — e.g., "Manage your organization's users, roles, and permissions."
4. **Heading/card labels** (8 instances) — e.g., "Average Progress", "Assigned Cohort"
5. **aria-label / sr-only text** (6 instances) — e.g., "Close panel", "View notifications"
6. **Sidebar branding** (3 instances) — "SIMAK Admin", "SIMAK Instructor", "SIMAK Student"
7. **Empty state text** (4 instances) — e.g., "No users found."
8. **Format display strings** (9 instances) — file size formatting, wait time formatting
9. **Hardcoded locale 'en-US'** (1 instance) — `Intl.DateTimeFormat` in `file-list.tsx`

## Functional Requirements

### FR1: Update Type Definitions

- Add all missing keys and sections to `scripts/generate-i18n-types.ts`
- Regenerate `src/i18n/types.ts` and `src/i18n/detect-locale.ts` via `pnpm generate:i18n`

### FR2: Audit and Replace Hardcoded Strings

- Replace all ~78 identified hardcoded English UI strings with proper i18n translation keys
- Add new translation keys to `locales/en.json` (English)
- Add matching translation keys to `locales/id.json` (Indonesian)
- Ensure components use translation functions (`LL` or `t()`)

### FR3: Fix Hardcoded Locale in Date Formatting

- In `src/components/files/file-list.tsx`, replace hardcoded `'en-US'` with dynamic locale from `useI18n()`

### FR4: Ensure 100% Key Coverage

- All keys in `en.json` must have corresponding keys in `id.json`
- Existing translation coverage test must continue to pass

### FR5: i18n Type Generation Passes

- `pnpm generate:i18n` must complete with no errors after type definition updates
- `pnpm typecheck` must pass
- `pnpm build` must succeed

## Non-Functional Requirements

- Language detection strategy: Current implementation is correct (browser detection → localStorage → fallback 'en')
- Language preference setting: **NOT in scope** (no user settings page for this)
- All existing tests must continue to pass
- Code coverage must remain above 80%

## Acceptance Criteria

- [ ] All missing type definition sections/keys are added to `generate-i18n-types.ts`
- [ ] `pnpm generate:i18n` runs successfully and updates `src/i18n/types.ts`
- [ ] All ~78 hardcoded strings are replaced with i18n keys across 36 files
- [ ] `locales/en.json` has all new keys added
- [ ] `locales/id.json` has matching translations for all new keys
- [ ] Translation coverage test passes (all `en.json` keys have `id.json` counterparts)
- [ ] `pnpm typecheck` passes with no errors
- [ ] `pnpm build` succeeds
- [ ] All existing tests pass
- [ ] Hardcoded `'en-US'` locale in `file-list.tsx` replaced with dynamic locale

## Out of Scope

- Language preference setting on user settings page (not requested)
- Adding new translations for v2 features
- Changing the locale resolution strategy (current implementation is correct)
- Adding translation keys for future features
