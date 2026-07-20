<protect>
# Implementation Plan: Critical UX Fixes (Broken Functionality)

## Phase 1: FileUploader Fix (UX-29)

- [x] Task: Read spec.md and workflow.md to refresh context
    - [x] Read `conductor/tracks/critical-ux-fixes_20260720/spec.md`
    - [x] Read `conductor/workflow.md`

- [x] Task: Write failing tests for FileUploader reset flow (Red Phase)
    - [x] Create test file `tests/unit/components/files/file-uploader.test.tsx` mirroring `src/components/files/file-uploader.tsx`
    - [x] Write test: `onResetSuccess` callback is invoked when `handleReset()` is called
    - [x] Write test: after reset, the dropzone reappears (internal state cleared)
    - [x] Write test: `onResetSuccess` is optional (component renders without it)
    - [x] Run `pnpm test` and confirm the new tests fail as expected

- [x] Task: Implement `onResetSuccess` callback prop (Green Phase)
    - [x] Add `onResetSuccess?: () => void` to `FileUploaderProps` interface in `src/components/files/file-uploader.tsx`
    - [x] Call `onResetSuccess?.()` inside `handleReset()` (after clearing internal state)
    - [x] Pass `onResetSuccess={() => setUploadSuccess(false)}` from `CheckpointSubmissionPage` in `src/routes/_authenticated/student/assignments/$id.checkpoints.$checkpointId.tsx`
    - [x] Run `pnpm test` and confirm all tests now pass

- [x] Task: Verify quality gates and commit [f74641c]
    - [x] Run `pnpm test:coverage` (≥80% on all thresholds)
    - [x] Run `pnpm typecheck`
    - [x] Run `pnpm lint`
    - [x] Stage changes and commit with message `fix(files): Add onResetSuccess callback to FileUploader for Upload Another reset (UX-29)`
    - [x] Attach git note with task summary to the commit
    - [x] Update `plan.md`: mark Phase 1 tasks complete with commit SHA

- [ ] Task: Conductor - User Manual Verification 'Phase 1: FileUploader Fix' (Protocol in workflow.md)

## Phase 2: Navigation & Pagination Fixes (UX-38, UX-39, UX-57)

- [ ] Task: Read spec.md and workflow.md to refresh context
    - [ ] Read `conductor/tracks/critical-ux-fixes_20260720/spec.md`
    - [ ] Read `conductor/workflow.md`

- [ ] Task: Add `common.goHome` i18n key and regenerate types
    - [ ] Add `"goHome": "Go Home"` to `common` object in `locales/en.json`
    - [ ] Add `"goHome": "Ke Beranda"` to `common` object in `locales/id.json`
    - [ ] Run `pnpm generate:i18n` to regenerate `src/i18n/types.ts` and `src/i18n/detect-locale.ts`
    - [ ] Run `pnpm check:i18n` to verify EN↔ID parity

- [ ] Task: Write failing tests for navigation and pagination fixes (Red Phase)
    - [ ] Create/update test for `NotFoundComponent` in `__root.tsx`: assert link `href="/"` (not `/dashboard`) and label uses `t('common.goHome')`
    - [ ] Create/update test for `RootErrorComponent` in `src/components/error-boundary.tsx`: assert label uses `t('common.goHome')`
    - [ ] Create/update test for `UsersPage` in `src/routes/_authenticated/admin/users/index.tsx`: assert `<Pagination>` is NOT rendered when `users.length === 0`, and IS rendered when `users.length > 0`
    - [ ] Run `pnpm test` and confirm the new tests fail as expected

- [ ] Task: Implement navigation and pagination fixes (Green Phase)
    - [ ] In `src/routes/__root.tsx` `NotFoundComponent`: change `href="/dashboard"` to `href="/"` and label from `t('common.goToDashboard')` to `t('common.goHome')`
    - [ ] In `src/components/error-boundary.tsx` `RootErrorComponent`: change label from `t('common.goToDashboard')` to `t('common.goHome')` (link already goes to `/`)
    - [ ] In `src/routes/_authenticated/admin/users/index.tsx`: wrap `<Pagination>` in `{users.length > 0 && (...)}`
    - [ ] Run `pnpm test` and confirm all tests now pass

- [ ] Task: Verify quality gates and commit
    - [ ] Run `pnpm test:coverage` (≥80% on all thresholds)
    - [ ] Run `pnpm typecheck`
    - [ ] Run `pnpm lint` (including `simak-i18n/no-hardcoded` rule)
    - [ ] Run `pnpm check:i18n`
    - [ ] Verify no broken links remain: `grep -r 'href="/dashboard"' src/` returns zero matches
    - [ ] Stage changes and commit with message `fix(ui): Fix 404 dead link, ErrorBoundary label, and empty-list pagination (UX-38, UX-39, UX-57)`
    - [ ] Attach git note with task summary to the commit
    - [ ] Update `plan.md`: mark Phase 2 tasks complete with commit SHA

- [ ] Task: Conductor - User Manual Verification 'Phase 2: Navigation & Pagination Fixes' (Protocol in workflow.md)
</protect>
