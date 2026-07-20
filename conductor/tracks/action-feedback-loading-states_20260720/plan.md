<protect>
# Implementation Plan: Action Feedback & Loading States

**Track ID:** action-feedback-loading-states_20260720
**Spec:** [./spec.md](./spec.md)
**Workflow:** `conductor/workflow.md` (TDD: Red → Green → Refactor → Verify → Commit → Git Note)

Each task below follows the Standard Task Workflow (workflow.md §"Standard Task Workflow"): mark `[~]`, write failing tests (Red), implement (Green), verify quality gates, commit, attach git note, mark `[x]` with commit SHA.

---

## Phase 1: Toast Infrastructure (UX-5, UX-30, UX-31, UX-32)

**Goal:** Establish the `showSuccessToast` helper and wire success toasts into all ~8 action `onSuccess` handlers so no user action completes silently.

- [x] Task: Read spec.md and workflow.md to re-establish context
    - [x] Read `./spec.md` (track specification — requirements, acceptance criteria, decisions)
    - [x] Read `../../workflow.md` (TDD lifecycle, commit format, phase checkpoint protocol)
- [x] Task: Define i18n keys and run codegen [sha: 172a9c9]
    - [x] Add 10 success-toast i18n keys to `locales/en.json` (reused existing `settings.profile.nameSuccess` and `settings.password.passwordSuccess` instead of creating new keys — Decision #4)
    - [x] Add matching Indonesian translations to `locales/id.json`
    - [x] Run `pnpm generate:i18n` to regenerate `src/i18n/types.ts` + `detect-locale.ts`
    - [x] Run `pnpm check:i18n` — 723=723 parity, no unused keys (Phase 3 keys `files.networkError`/`files.serverError` deferred to Phase 3 to avoid unused-key gate failure)
- [x] Task: Write failing tests for `showSuccessToast` + action handlers (Red) [sha: 172a9c9]
    - [x] Update `tests/unit/lib/toast.test.ts` — assert `showSuccessToast(message)` calls `toast.success(message)` (mock `sonner`)
    - [x] Add tests per action component asserting `toast.success` (or `showSuccessToast`) is invoked in the `onSuccess` path: ConsultationForm, CreateUserDialog, EditUserSheet, DeleteUserDialog, DeadlineManager (unlock + extend), VerificationDialog (verify + reject), use-assignment-tabs (approve + reject extension)
    - [x] Add tests asserting ProfileSection and PasswordSection fire a success toast instead of inline success text
    - [x] Run `pnpm test` and confirm new tests fail (Red) — 15 failed, 97 passed
- [x] Task: Implement `showSuccessToast` helper (Green) [sha: 172a9c9]
    - [x] Add `showSuccessToast(message: string)` to `src/lib/toast.ts` mirroring `showErrorToast` (calls `toast.success(message)`)
    - [x] Run `pnpm test` — helper test passes (Green)
- [x] Task: Wire success toasts into all action `onSuccess` handlers (Green) [sha: 172a9c9]
    - [x] ConsultationForm — `toast.success(t('consultations.logSuccess'))` in log mutation `onSuccess`
    - [x] CreateUserDialog — `toast.success(t('adminUsers.createSuccess'))`
    - [x] EditUserSheet — `toast.success(t('adminUsers.updateSuccess'))`
    - [x] DeleteUserDialog — `toast.success(t('adminUsers.deleteSuccess'))`
    - [x] DeadlineManager — unlock: `t('instructorAssignments.deadlineManager.unlockSuccess')`; extend: `t('...extendSuccess')`
    - [x] VerificationDialog — verify: `t('consultations.verifySuccess')`; reject: `t('consultations.rejectSuccess')`
    - [x] use-assignment-tabs — approve: `t('extensions.approveSuccess')`; reject: `t('extensions.rejectSuccess')`
    - [x] ProfileSection — replaced inline success text with `toast.success(t('settings.profile.nameSuccess'))`
    - [x] PasswordSection — replaced inline success text with `toast.success(t('settings.password.passwordSuccess'))`
    - [x] Run `pnpm test` — all action-handler tests pass (Green) — 112/112
- [x] Task: Verify quality gates for Phase 1 [sha: 172a9c9]
    - [x] `pnpm typecheck` passes
    - [x] `pnpm lint` passes (incl. `simak-i18n/no-hardcoded`) — 0 warnings, 0 errors
    - [x] `pnpm check:i18n` passes — 723=723, no unused keys
    - [x] `pnpm test:coverage` ≥80% on lines/stmts/branches/functions — Lines 88.11%, Branches 81.13%, Functions 81.36%, Statements 87.47%
    - [x] No file in `src/`/`tests/` exceeds 500 lines
    - [x] Grep: no `onSuccess` mutation handler lacks `toast.success` (excluding read-only queries)
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Toast Infrastructure' (Protocol in workflow.md)

---

## Phase 2: Loading Skeletons & Spinners (UX-1, UX-2, UX-3, UX-4)

**Goal:** Eliminate blank-screen route loads via `pendingComponent` skeletons, add side-data loading skeletons, and replace plain "Loading..." text with `Loader2` spinners.

- [ ] Task: Read spec.md and workflow.md to re-establish context
    - [ ] Read `./spec.md`
    - [ ] Read `../../workflow.md`
- [ ] Task: Write failing tests for skeleton components and spinners (Red)
    - [ ] `tests/unit/components/skeletons/dashboard-skeleton.test.tsx` — renders card grid layout
    - [ ] `tests/unit/components/skeletons/table-skeleton.test.tsx` — renders header + N rows
    - [ ] `tests/unit/components/skeletons/assignment-detail-skeleton.test.tsx` — renders detail layout
    - [ ] Tests asserting each of the 7 routes exposes a `pendingComponent` that renders a skeleton/spinner
    - [ ] Test asserting ConsultationForm submit button shows `Loader2` spinner when `loading` is true
    - [ ] Tests asserting ProfileSection and VerificationDialog render `Loader2` (not plain "Loading..." text) in loading state
    - [ ] Test asserting `student/assignments/$id.tsx` shows `Skeleton` in consultations/extensions tabs while `loadingConsultations`/`loadingExtensions` is true
    - [ ] Run `pnpm test` and confirm new tests fail (Red)
- [ ] Task: Create 3 reusable skeleton components (Green)
    - [ ] Create `src/components/skeletons/dashboard-skeleton.tsx` — card + grid layout (student/instructor/admin dashboards)
    - [ ] Create `src/components/skeletons/table-skeleton.tsx` — header + rows (admin users + audit log)
    - [ ] Create `src/components/skeletons/assignment-detail-skeleton.tsx` — instructor assignment detail layout
    - [ ] Run `pnpm test` — skeleton component tests pass (Green)
- [ ] Task: Add `pendingComponent` to 7 routes (Green)
    - [ ] `src/routes/_authenticated/student/dashboard.tsx` → `DashboardSkeleton`
    - [ ] `src/routes/_authenticated/instructor/dashboard.tsx` → `DashboardSkeleton`
    - [ ] `src/routes/_authenticated/admin/dashboard.tsx` → `DashboardSkeleton`
    - [ ] `src/routes/_authenticated/admin/users/index.tsx` → `TableSkeleton`
    - [ ] `src/routes/_authenticated/admin/audit-log.tsx` → `TableSkeleton`
    - [ ] `src/routes/_authenticated/admin/users/import.tsx` → simple spinner (session-only fetch)
    - [ ] `src/routes/_authenticated/instructor/assignments/$id.tsx` → `AssignmentDetailSkeleton`
    - [ ] Run `pnpm test` — route pendingComponent tests pass (Green)
- [ ] Task: Add side-data loading skeletons (UX-2)
    - [ ] Add `loadingConsultations`/`loadingExtensions` state to the `useEffect` in `src/routes/_authenticated/student/assignments/$id.tsx`
    - [ ] Render `Skeleton` in consultations and extensions tabs while loading
    - [ ] Run `pnpm test` — side-data loading tests pass (Green)
- [ ] Task: Add `Loader2` spinners (UX-3, UX-4)
    - [ ] ConsultationForm submit button — `<Loader2 className="mr-2 h-4 w-4 animate-spin" />` when `loading` (match `ReviewForm.tsx`)
    - [ ] ProfileSection — replace plain "Loading..." text with `Loader2` spinner (match `TwoFactorSettings.tsx`)
    - [ ] VerificationDialog — replace plain "Loading..." text with `Loader2` spinner
    - [ ] Run `pnpm test` — spinner tests pass (Green)
- [ ] Task: Verify quality gates for Phase 2
    - [ ] `pnpm typecheck` passes
    - [ ] `pnpm lint` passes (incl. `simak-i18n/no-hardcoded`)
    - [ ] `pnpm check:i18n` passes (no new keys this phase unless spinner aria-labels need them)
    - [ ] `pnpm test:coverage` ≥80%
    - [ ] No file in `src/`/`tests/` exceeds 500 lines
    - [ ] All 7 routes have a `pendingComponent`
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Loading Skeletons & Spinners' (Protocol in workflow.md)

---

## Phase 3: Error Handling (UX-6, UX-7, UX-8, UX-9)

**Goal:** Surface real error messages, add retry on side-data fetch failures, prevent the `openForReview` self-navigation loop, and differentiate network vs server upload errors.

- [ ] Task: Read spec.md and workflow.md to re-establish context
    - [ ] Read `./spec.md`
    - [ ] Read `../../workflow.md`
- [ ] Task: Add upload-error i18n keys and run codegen
    - [ ] Add `files.networkError` (en: "Network error, check your connection" / id: "Kesalahan jaringan, periksa koneksi Anda") and `files.serverError` (en: "Server error, try again" / id: "Kesalahan server, coba lagi") to both locale files
    - [ ] Run `pnpm generate:i18n` and `pnpm check:i18n`
- [ ] Task: Write failing tests for error handling (Red)
    - [ ] Test: StudentDashboard renders `data.error` (not `t('common.error')`) when the dashboard query returns an error
    - [ ] Test: AssignmentDetailPage side-data `useEffect` — on fetch rejection, sets `sideDataError` and renders inline error banner with a retry button; retry re-invokes the fetch
    - [ ] Test: ReviewDetailPage auto-`openForReview` — on failure, calls `toast.error()` and does NOT call `navigate({ replace: true })` (no self-navigation loop)
    - [ ] Test: CheckpointSubmissionPage upload — a `TypeError` (network failure) surfaces `t('files.networkError')`; a non-2xx response surfaces `t('files.serverError')`
    - [ ] Run `pnpm test` and confirm new tests fail (Red)
- [ ] Task: Fix StudentDashboard error display (UX-6)
    - [ ] In `StudentDashboard.tsx`, show `data.error` (the actual error message) instead of `t('common.error')` (match `InstructorDashboard.tsx`)
    - [ ] Run `pnpm test` — StudentDashboard error test passes (Green)
- [ ] Task: Add side-data error handling to AssignmentDetailPage (UX-7)
    - [ ] Wrap the side-data `useEffect` in `src/routes/_authenticated/student/assignments/$id.tsx` in try/catch
    - [ ] Add `sideDataError` state; on catch set error and render an inline error banner with a retry button
    - [ ] Run `pnpm test` — side-data error test passes (Green)
- [ ] Task: Fix ReviewDetailPage auto-openForReview (UX-8)
    - [ ] Wrap the `openForReview` call in `src/routes/_authenticated/instructor/reviews/$submissionId.tsx` in try/catch
    - [ ] On failure: call `toast.error()` and prevent the `navigate({ replace: true })` self-navigation; stay on the page with an error banner
    - [ ] Run `pnpm test` — openForReview error test passes (Green)
- [ ] Task: Differentiate upload errors in CheckpointSubmissionPage (UX-9)
    - [ ] In `src/routes/_authenticated/student/assignments/$id.checkpoints.$checkpointId.tsx` (or the upload handler), catch errors; if `instanceof TypeError`, show `t('files.networkError')`; otherwise parse the response and show `t('files.serverError')`
    - [ ] Run `pnpm test` — upload error differentiation tests pass (Green)
- [ ] Task: Verify quality gates for Phase 3
    - [ ] `pnpm typecheck` passes
    - [ ] `pnpm lint` passes (incl. `simak-i18n/no-hardcoded`)
    - [ ] `pnpm check:i18n` passes (2 new keys in both locales)
    - [ ] `pnpm test:coverage` ≥80%
    - [ ] No file in `src/`/`tests/` exceeds 500 lines
    - [ ] `StudentDashboard` shows `data.error` not `t('common.error')`; `ReviewDetailPage` `openForReview` has try/catch; `CheckpointSubmissionPage` distinguishes network vs server errors
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Error Handling' (Protocol in workflow.md)
</protect>
