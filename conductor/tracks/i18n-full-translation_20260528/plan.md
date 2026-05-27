# Plan: Track i18n-full-translation_20260528 — Internationalization — Full Translation Pass

## Phase 1: Type Definition Updates

- [ ] Task: Update scripts/generate-i18n-types.ts with missing keys in existing sections
  - [ ] Add missing auth keys: confirmPassword, passwordMismatch, linkExpired, setupPassword, setupSuccess, resetSuccess, checkYourEmail, forgotPasswordSent
  - [ ] Add missing nav keys: welcome, role_student, role_instructor, role_admin
  - [ ] Add missing adminUsers keys: role_superadmin, allRoles, searchPlaceholder
  - [ ] Add missing adminTemplates.form key: minConsultations
  - [ ] Add missing studentAssignments keys: resubmit, viewSubmission, consultations, notFound, notFoundDescription
- [ ] Task: Add entire missing sections to generate-i18n-types.ts
  - [ ] Add instructorAssignments section (all keys from en.json)
  - [ ] Add files section (all keys from en.json)
  - [ ] Add consultations section (all keys from en.json)
- [ ] Task: Regenerate i18n types
  - [ ] Run pnpm generate:i18n
  - [ ] Verify src/i18n/types.ts is updated
- [ ] Task: Update existing test snapshots if needed
  - [ ] Run pnpm test to confirm all tests still pass
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Type Definition Updates' (Protocol in workflow.md)

## Phase 2: Add New Translation Keys to Locale Files

- [ ] Task: Add all new translation keys to locales/en.json
  - [ ] Add keys for each UI component hardcoded string that needs replacement
  - [ ] Organize new keys into appropriate sections or create new sections as needed
- [ ] Task: Add matching translation keys to locales/id.json
  - [ ] Translate all new keys to Indonesian
  - [ ] Ensure key structure matches en.json exactly
- [ ] Task: Regenerate i18n types after locale updates
  - [ ] Run pnpm generate:i18n
- [ ] Task: Run translation coverage test to confirm 100% key coverage
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
