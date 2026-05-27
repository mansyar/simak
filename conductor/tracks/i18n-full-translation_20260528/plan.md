# Plan: Track i18n-full-translation_20260528 — Internationalization — Full Translation Pass

## Phase 1: Type Definition Updates [checkpoint: 0639b94]

- [x] Task: Update scripts/generate-i18n-types.ts with missing keys in existing sections (35ea09e)
  - [x] Add missing auth keys: confirmPassword, passwordMismatch, linkExpired, setupPassword, setupSuccess, resetSuccess, checkYourEmail, forgotPasswordSent — already present in first occurrence; no change needed
  - [x] Add missing nav keys: welcome, role_student, role_instructor, role_admin — already present; no change needed
  - [x] Add missing adminUsers keys: role_superadmin, allRoles, searchPlaceholder — already present; no change needed
  - [x] Add missing adminTemplates.form key: minConsultations — already present; no change needed
  - [x] Add missing studentAssignments keys: resubmit, viewSubmission, consultations, notFound, notFoundDescription — resubmit/viewSubmission were missing from first occurrence, added; others already present
- [x] Task: Add entire missing sections to generate-i18n-types.ts (35ea09e)
  - [x] Add instructorAssignments section (all keys from en.json) — already present in first occurrence; cleaned up duplicates
  - [x] Add files section (all keys from en.json) — already present; cleaned up duplicates
  - [x] Add consultations section (all keys from en.json) — already present; cleaned up duplicates
- [x] Task: Regenerate i18n types (35ea09e)
  - [x] Run pnpm generate:i18n
  - [x] Verify src/i18n/types.ts is updated
- [x] Task: Update existing test snapshots if needed (35ea09e)
  - [x] Run pnpm test to confirm all tests still pass
- [x] Task: Conductor - User Manual Verification 'Phase 1: Type Definition Updates' (0639b94)

## Phase 2: Add New Translation Keys to Locale Files

- [x] Task: Add all new translation keys to locales/en.json
  - [x] Add keys for each UI component hardcoded string that needs replacement
  - [x] Organize new keys into appropriate sections or create new sections as needed
  - [x] Added common keys (openMenu, close, skipToContent, goToDashboard, emailPlaceholder, namePlaceholder, searchByName, noSearchResults, typeDeleteToConfirm, templateNamePlaceholder, templateTypePlaceholder)
  - [x] Added adminUsers.subtitle
  - [x] Added adminTemplates.subtitle and form placeholders (namePlaceholder, typePlaceholder, minConsPlaceholder)
  - [x] Added instructorAssignments subtitle, newAssignmentSubtitle, averageProgress
  - [x] Added language switchToEnglish, switchToIndonesian
  - [x] Added notifications closePanel, viewNotifications
  - [x] Added consultations sessionInternal, sessionExternal
- [x] Task: Add matching translation keys to locales/id.json
  - [x] Translate all new keys to Indonesian
  - [x] Ensure key structure matches en.json exactly
- [x] Task: Regenerate i18n types after locale updates
  - [x] Run pnpm generate:i18n
- [x] Task: Run translation coverage test to confirm 100% key coverage
  - [x] All 127 test files (1139 tests) pass
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Add New Translation Keys to Locale Files' (Protocol in workflow.md)

## Phase 3: Replace Hardcoded Strings — Routes & Layouts

- [ ] Task: Write failing test verifying i18n key presence for route hardcoded strings
  - [ ] Write test that checks all routes use translation keys for displayed text
- [ ] Task: Replace hardcoded strings in route files
  - [ ] src/routes/index.tsx — SIMAK heading, subtitle, loading text
  - [ ] src/routes/\_\_root.tsx — 404 heading/title/metadata/skip-to-content
  - [ ] src/routes/\_authenticated/instructor/assignments/index.tsx — subtitle
  - [ ] src/routes/\_authenticated/instructor/assignments/new.tsx — subtitle
  - [ ] src/routes/\_authenticated/instructor/assignments/$id.tsx — not found message
  - [ ] src/routes/\_authenticated/admin/users/index.tsx — subtitle, pagination info
  - [ ] src/routes/\_authenticated/admin/templates/index.tsx — subtitle
  - [ ] src/routes/\_unauthenticated/auth/login.tsx — placeholder
  - [ ] src/routes/\_unauthenticated/auth/forgot-password.tsx — placeholder
  - [ ] src/routes/\_unauthenticated/auth/setup-password.tsx — validation error
  - [ ] src/routes/\_unauthenticated/auth/reset-password.tsx — validation error
- [ ] Task: Implement to pass tests
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Routes & Layouts' (Protocol in workflow.md)

## Phase 4: Replace Hardcoded Strings — Components

- [ ] Task: Write failing tests for component hardcoded strings
  - [ ] Write tests verifying i18n key usage in sidebar, theme toggle, language switcher, notification components
- [ ] Task: Replace hardcoded strings in layout components
  - [ ] admin-sidebar.tsx — branding "SIMAK Admin"
  - [ ] instructor-sidebar.tsx — branding "SIMAK Instructor"
  - [ ] student-sidebar.tsx — branding "SIMAK Student"
  - [ ] theme-toggle.tsx — aria-labels
  - [ ] language-switcher.tsx — aria-labels
  - [ ] NotificationCenter.tsx — aria-label
  - [ ] NotificationBadge.tsx — aria-label
- [ ] Task: Replace hardcoded strings in admin components
  - [ ] UserTable.tsx — Status column, Open menu sr-only, empty state
  - [ ] CreateUserDialog.tsx — placeholders
  - [ ] EditUserSheet.tsx — description, placeholders
  - [ ] CreateTemplateDialog.tsx — placeholders
  - [ ] EditTemplateSheet.tsx — description, placeholders
  - [ ] TemplateCard.tsx — sr-only text
  - [ ] DeleteTemplateDialog.tsx — placeholder
- [ ] Task: Replace hardcoded strings in instructor components
  - [ ] AssignmentWizard.tsx — validation errors, error messages, section headings
  - [ ] TemplatePicker.tsx — error messages, placeholder, empty state, labels
  - [ ] StudentPicker.tsx — error messages, empty state, button text
  - [ ] ProgressTable.tsx — empty state
- [ ] Task: Replace hardcoded strings in review components
  - [ ] ReviewQueueItem.tsx — wait time display format
  - [ ] ReviewFilePreview.tsx — file size display format
  - [ ] ReviewForm.tsx — error messages
- [ ] Task: Fix hardcoded locale in file-list.tsx
  - [ ] Replace 'en-US' with dynamic locale from useI18n()
  - [ ] Replace hardcoded file size format strings
- [ ] Task: Replace hardcoded strings in consultation components
  - [ ] VerificationQueueItem.tsx — "External:" / "Internal" labels
  - [ ] VerificationDialog.tsx — error message
- [ ] Task: Implement to pass tests
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Components' (Protocol in workflow.md)

## Phase 5: Final Verification & Commit

- [ ] Task: Run full test suite and verify coverage >80%
- [ ] Task: Run pnpm typecheck (tsc --noEmit)
- [ ] Task: Run pnpm lint
- [ ] Task: Run pnpm build to verify production build succeeds
- [ ] Task: Regenerate i18n types (pnpm generate:i18n) as final check
- [ ] Task: Document any deviations from spec in plan.md notes
- [ ] Task: Conductor - User Manual Verification 'Phase 5: Final Verification & Commit' (Protocol in workflow.md)
