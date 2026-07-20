<protect>
# Track TRACK-009: Action Feedback & Loading States

## Overview

UX remediation track addressing 12 audit findings (UX-1 through UX-9, UX-30, UX-31, UX-32) spanning three themes: (1) missing success feedback on user actions (no toasts after create/delete/approve/reject/unlock/submit), (2) missing loading states (blank screens during route data fetches, missing spinners on submit buttons), and (3) swallowed or misleading error displays (generic "Error" text instead of the actual message, self-navigation loops on failure, undifferentiated upload errors).

The track establishes a consistent feedback layer across all mutation surfaces so that no user action completes silently and no route renders a blank screen while fetching.

## Context & Traceability

- **Audit IDs:** UX-1, UX-2, UX-3, UX-4, UX-5, UX-6, UX-7, UX-8, UX-9, UX-30, UX-31, UX-32
- **Roadmap source:** `docs/roadmap.md` → "TRACK-009: Action Feedback & Loading States"
- **PRD Reference:** `docs/PRD.md` (all user actions: delete, approve, reject, unlock, submit, review)
- **TDD Reference:** `docs/TDD.md` (toast infrastructure, loading skeletons, error boundary patterns)
- **Dependencies:** None (declared independent in roadmap dependency matrix). Note: TRACK-008's UX-29 (FileUploader `onResetSuccess`) and TRACK-009's UX-9 (upload error differentiation) both touch `CheckpointSubmissionPage`/`FileUploader` — overlap is minimal and declared acceptable.

## Decisions (Confirmed)

1. **Scope adherence — follow roadmap exactly.** All 12 audit findings implemented as the roadmap specifies. UX-33 (undo) explicitly deferred to a future feature track.
2. **Skeleton strategy — 3 shared reusable components.** `DashboardSkeleton`, `TableSkeleton`, `AssignmentDetailSkeleton`, matching the repo's shared-primitive pattern (Track 6.4).
3. **Toast approach — `showSuccessToast` helper.** New `showSuccessToast(message)` in `toast.ts`, mirroring `showErrorToast`; called from ~8 action `onSuccess` handlers.
4. **UX-5:** Add `toast.success()` to ALL action `onSuccess` handlers: ConsultationForm (log), CreateUserDialog (create), EditUserSheet (update), DeleteUserDialog (delete), DeadlineManager (unlock + extend), VerificationDialog (verify + reject), use-assignment-tabs (approve + reject extension). Replace inline success text in ProfileSection and PasswordSection with toasts.
5. **UX-1:** Add `pendingComponent` to 7 routes. `admin/users/import.tsx` uses a simple spinner (fast session-only fetch).
6. **UX-2:** Add `loadingConsultations`/`loadingExtensions` state to `useEffect` in `student/assignments/$id.tsx`; show `Skeleton` in consultations/extensions tabs while loading.
7. **UX-3:** Add `Loader2` spinner to ConsultationForm submit button when `loading` (match `ReviewForm.tsx`).
8. **UX-4:** Replace plain "Loading..." text with `Loader2` spinner in ProfileSection and VerificationDialog (match `TwoFactorSettings.tsx`).
9. **UX-6:** Show `data.error` instead of `t('common.error')` in StudentDashboard (match `InstructorDashboard.tsx`).
10. **UX-7:** Add try/catch to AssignmentDetailPage side-data `useEffect`; set `sideDataError` state; inline error banner with retry button.
11. **UX-8:** Add try/catch to ReviewDetailPage auto-`openForReview` effect; `toast.error()` on failure; prevent self-navigation loop (stay on page with error banner).
12. **UX-9:** Differentiate upload errors in CheckpointSubmissionPage — network (`TypeError`) vs server (parsed response); 2 new i18n keys (`files.networkError`, `files.serverError`).
13. **UX-30/31/32:** Subsumed by UX-5 — DeadlineManager, VerificationDialog, use-assignment-tabs all get `toast.success()` in success handlers.
14. **UX-33 (undo):** Skip. Success toasts added instead. Undo is a feature, not a bug fix. Deferred.

## Functional Requirements

### FR-1: Toast Infrastructure (UX-5, UX-30, UX-31, UX-32)
- Create `showSuccessToast(message: string)` helper in `toast.ts` (mirrors `showErrorToast`).
- Add `toast.success(t('...'))` to all action `onSuccess` handlers: ConsultationForm, CreateUserDialog, EditUserSheet, DeleteUserDialog, DeadlineManager (unlock + extend), VerificationDialog (verify + reject), use-assignment-tabs (approve + reject extension).
- Replace inline success text in ProfileSection and PasswordSection with toasts.
- ~12 new success i18n keys in both `locales/en.json` and `locales/id.json`.

### FR-2: Loading Skeletons (UX-1)
- Create 3 reusable skeleton components: `DashboardSkeleton` (all 3 dashboards), `TableSkeleton` (admin users + audit log), `AssignmentDetailSkeleton` (instructor assignment detail).
- Add `pendingComponent` to 7 routes: `student/dashboard.tsx`, `instructor/dashboard.tsx`, `admin/dashboard.tsx`, `admin/users/index.tsx`, `admin/audit-log.tsx`, `admin/users/import.tsx` (simple spinner), `instructor/assignments/$id.tsx`.

### FR-3: Side-Data Loading (UX-2)
- Add `loadingConsultations`/`loadingExtensions` state to `useEffect` in `student/assignments/$id.tsx`; show `Skeleton` in consultations/extensions tabs while loading.

### FR-4: Submit/Button Spinners (UX-3, UX-4)
- Add `Loader2` spinner to ConsultationForm submit button when `loading`.
- Replace plain "Loading..." text with `Loader2` spinner in ProfileSection and VerificationDialog loading states.

### FR-5: Error Handling (UX-6, UX-7, UX-8, UX-9)
- **UX-6:** StudentDashboard shows `data.error` instead of `t('common.error')`.
- **UX-7:** AssignmentDetailPage side-data `useEffect` wrapped in try/catch; `sideDataError` state; inline error banner with retry.
- **UX-8:** ReviewDetailPage auto-`openForReview` wrapped in try/catch; `toast.error()` on failure; prevent self-navigation loop.
- **UX-9:** CheckpointSubmissionPage distinguishes network (`TypeError`) vs server (parsed response) upload errors; 2 new i18n keys.

## Non-Functional Requirements

- **Testing (TDD):** Write failing unit tests first per FR, then implement to pass. Tests in `tests/unit/` mirroring `src/` structure.
- **Coverage:** ≥80% on lines, statements, branches, and functions.
- **i18n:** ~14 new keys in both `locales/en.json` and `locales/id.json`; `pnpm generate:i18n`; `pnpm check:i18n` passes; no new unused keys.
- **Lint:** `pnpm lint` passes (incl. `simak-i18n/no-hardcoded` rule).
- **Typecheck:** `pnpm typecheck` passes.
- **File limit:** No file in `src/`, `tests/`, `scripts/` exceeds 500 lines.
- **No new dependencies:** Uses existing `sonner`, shadcn `Skeleton`, `Loader2` (lucide-react), TanStack Query.

## Acceptance Criteria

1. Deleting a user → success toast appears.
2. Unlocking a checkpoint → success toast appears.
3. Verifying a consultation → success toast appears.
4. Approving an extension → success toast appears.
5. Loading admin dashboard → skeleton shows during fetch, not a blank screen.
6. Loading student assignment detail → consultations tab shows skeleton while loading.
7. Triggering a side-data fetch error → inline error banner with retry appears.
8. Triggering `openForReview` failure → error toast appears, no navigation loop.
9. Uploading a file with network disconnected → "Network error" message shown.
10. No action completes silently (grep for `onSuccess` handlers without `toast.success` returns none).
11. All 7 routes with loaders have `pendingComponent`.
12. `showSuccessToast` helper exists in `toast.ts`.
13. `StudentDashboard` shows `data.error`, not `t('common.error')`.
14. `ReviewDetailPage` `openForReview` has try/catch.
15. `CheckpointSubmissionPage` distinguishes network vs server errors.
16. UX-33 (undo) explicitly documented as deferred.
17. `pnpm test:unit`, `pnpm typecheck`, `pnpm lint`, `pnpm check:i18n` all pass; coverage ≥80%.

## Out of Scope

- **Undo functionality for destructive actions (UX-33)** — dropped; defer to future feature track. Success toasts added instead.
- Accessibility improvements for notification components (TRACK-010).
- Form validation improvements (TRACK-011).
- Empty state improvements (TRACK-013).
- Search debounce (TRACK-011).
- Notification navigation links (TRACK-012).
- File upload progress percentage (TRACK-013 / UX-28 in TRACK-011).
</protect>
