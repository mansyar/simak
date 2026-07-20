# Track: Critical UX Fixes (Broken Functionality)

## Overview

This track addresses 4 critical UX bugs where functionality is broken or misleading, degrading the user experience. Each fix is surgical and minimal — no refactors beyond what's needed to restore correct behavior.

**Audit IDs:** UX-29, UX-38, UX-39, UX-57  
**Track Type:** Bugfix  
**Estimated Effort:** 1 Day / 0.5 Sprint Loops  
**Dependencies:** None

## Context Anchors

- **PRD Reference:** `docs/PRD.md` (file upload, error pages, user list)
- **TDD Reference:** `docs/TDD.md` (routing, 404 handling, component state management)
- **Roadmap Reference:** `docs/roadmap.md` → TRACK-008

## Functional Requirements

### FR-1: FileUploader "Upload Another" reset (UX-29)

**Problem:** After a successful file upload, clicking "Upload Another" clears the FileUploader's internal state but does NOT reset the parent's `uploadSuccess` state. The dropzone reappears but the success view persists or the flow is broken — the user cannot cleanly upload a replacement file.

**Fix:** Add an `onResetSuccess?: () => void` callback prop to `FileUploaderProps`. Call `onResetSuccess?.()` inside `handleReset()` (after clearing internal state). The parent `CheckpointSubmissionPage` passes `() => setUploadSuccess(false)` as the callback.

- **Files:**
  - `src/components/files/file-uploader.tsx` — add `onResetSuccess` prop, call in `handleReset()`
  - `src/routes/_authenticated/student/assignments/$id.checkpoints.$checkpointId.tsx` — pass `onResetSuccess={() => setUploadSuccess(false)}`

### FR-2: 404 page dead link (UX-38)

**Problem:** The `NotFoundComponent` in `__root.tsx` links to `/dashboard`, a route that no longer exists (removed in Track 7.2 when role-based dashboards were introduced). Clicking the link lands the user on another 404.

**Fix:** Change `href="/dashboard"` to `href="/"`. Change the label from `t('common.goToDashboard')` to `t('common.goHome')`. Add new i18n key `common.goHome` = "Go Home" (en) / "Ke Beranda" (id) to both locale files. Run `pnpm generate:i18n`.

- **Files:**
  - `src/routes/__root.tsx` — change `href` and label
  - `locales/en.json` — add `common.goHome`
  - `locales/id.json` — add `common.goHome`

### FR-3: ErrorBoundary misleading label (UX-39)

**Problem:** The `RootErrorComponent` in `error-boundary.tsx` uses the label `t('common.goToDashboard')` but the link already points to `/`. The label is misleading.

**Fix:** Change the label from `t('common.goToDashboard')` to `t('common.goHome')` (same new i18n key as FR-2). No link change needed — it already goes to `/`.

- **Files:**
  - `src/components/error-boundary.tsx` — change label

### FR-4: Empty list pagination (UX-57)

**Problem:** The admin users list page renders `<Pagination>` controls even when the user list is empty, showing confusing page navigation for zero results.

**Fix:** Wrap `<Pagination>` in `{users.length > 0 && (...)}` in `admin/users/index.tsx`. Matches the existing pattern in `student/assignments/index.tsx`.

- **Files:**
  - `src/routes/_authenticated/admin/users/index.tsx` — conditional render

## Non-Functional Requirements

- **i18n compliance:** All new user-visible strings (`common.goHome`) must be added to both `locales/en.json` and `locales/id.json`, then `pnpm generate:i18n` run. The custom lint rule `simak-i18n/no-hardcoded` must pass.
- **No new dependencies:** All fixes use existing components, hooks, and patterns.
- **Surgical changes:** Each fix touches only the files listed above. No adjacent refactoring.
- **Test coverage:** ≥80% on lines, statements, branches, and functions.

## Acceptance Criteria

- [ ] **AC-1 (UX-29):** Upload a file → success view shows → click "Upload Another" → dropzone reappears and a new file can be selected and uploaded. The `onResetSuccess` callback is invoked in `handleReset()`.
- [ ] **AC-2 (UX-38):** Navigate to a non-existent route → click "Go Home" → lands on the landing page (`/`), not another 404. The `common.goHome` key exists in both `en.json` and `id.json`.
- [ ] **AC-3 (UX-39):** Trigger an error boundary → click "Go Home" → lands on the landing page (`/`). Label reads `t('common.goHome')`.
- [ ] **AC-4 (UX-57):** View an empty user list (no users match the filter) → no pagination controls rendered. View a populated user list → pagination controls render normally.
- [ ] **AC-5:** `pnpm test:unit` passes with new tests for all 4 fixes.
- [ ] **AC-6:** `pnpm check:i18n` passes (new `common.goHome` key in both locales).
- [ ] **AC-7:** `pnpm typecheck`, `pnpm lint`, `pnpm test:coverage` (≥80%) all pass.
- [ ] **AC-8:** No broken links remain — `grep -r 'href="/dashboard"' src/` returns zero matches.

## Out of Scope

- Adding `toast.success` calls (TRACK-009)
- Adding `pendingComponent` to routes (TRACK-009)
- File upload progress percentage (TRACK-013)
- Client-side auth check for role-specific dashboard links on the 404 page (defer — current fix is simple and honest; an authenticated user on `/` can click "Login" which redirects to their role dashboard via the `_unauthenticated` layout)
- Refactoring FileUploader to own its success state internally (the callback prop is the minimal fix)
- Separate i18n keys for 404 vs ErrorBoundary (single `common.goHome` key is sufficient)
