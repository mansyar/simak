<protect>
# Track: Search Debounce & Form Validation

**Track ID:** search-debounce-form-validation
**Type:** Feature
**Audit IDs:** UX-25, UX-26, UX-27, UX-28, UX-54, UX-56
**Dependencies:** None
**Estimated Effort:** 3 Days / 1.5 Sprint Loops

## Overview

This track addresses 6 UX audit findings related to search input behavior, form validation, and file upload feedback. It introduces a custom debounce hook for server-side search inputs, migrates three forms to `react-hook-form` + Zod with inline validation, and adds upload progress tracking via `XMLHttpRequest`. All work is frontend-only — no server handler or schema changes.

## Context Anchors

- **PRD Reference:** `docs/PRD.md` (assignment/user/audit-log search, consultation logging, extension requests, password change, file upload)
- **TDD Reference:** `docs/TDD.md` (form patterns, react-hook-form usage, search/filter architecture)
- **Reference Pattern:** `EditUserSheet` (existing `useForm` + `zodResolver` + `FormField` + `FormMessage` pattern to match)
- **Roadmap Source:** `docs/roadmap.md` → TRACK-011 (lines 649-700)

## Functional Requirements

### FR-1: Debounce Hook (UX-54)

- Create `src/hooks/use-debounced-callback.ts` — a generic `useDebouncedCallback<T>(callback: T, delay: number)` hook using the `setTimeout`/`clearTimeout` pattern (~15 lines). No new dependency.
- Apply with **300ms delay** to the `onSearchChange`/`handleSearchChange` handlers in exactly **4 server-side search inputs**:
  1. `StudentAssignmentFilters`
  2. `UserFilters`
  3. `AssignmentFilters`
  4. `audit-log.tsx`
- `StudentPicker` and `TemplatePicker` are **NOT modified** — they filter client-side in-memory data (no server fetch, no debounce needed).

### FR-2: Clear Filters Button (UX-56)

- Add a conditional X icon button (lucide-react `X` icon) inside the search input wrapper for all **4 server-side search inputs** (same set as FR-1).
- Positioned `absolute right-2.5 top-2.5`.
- Visible **only when `search !== ''`**.
- Clicking calls `onSearchChange('')` (the debounced equivalent) — clears the search immediately.
- StudentPicker and TemplatePicker do **NOT** get clear buttons (scope boundary).

### FR-3: ConsultationForm Migration (UX-25)

- Replace raw `useState` with `useForm` + `zodResolver(Schema)`.
- Reuse the existing server-side `LogConsultationSchema` where possible.
- Fields:
  - `checkpointId` — required
  - `sessionType` — default `'internal'`
  - `externalConsultantName` — required when `sessionType === 'external'`
  - `notes` — required, min length enforced
- Add `FormField` + `FormItem` + `FormLabel` + `FormControl` + `FormMessage` for each field.
- Validation trigger: **onBlur + onSubmit** (errors appear when a field loses focus; all remaining errors show on submit attempt).
- Keep the existing `logConsultation` server function call unchanged.

### FR-4: ExtensionRequestForm Migration (UX-26)

- Replace raw `useState` with `useForm` + `zodResolver(Schema)`.
- Reuse the existing server-side `RequestExtensionSchema` where possible.
- Fields:
  - `category` — required
  - `reason` — required, min 10 characters
  - `duration` — required, min 1, max `maxExtensionDays`
  - `checkpointId` — optional
- Add `FormField` + `FormItem` + `FormLabel` + `FormControl` + `FormMessage` for each field.
- Validation trigger: **onBlur + onSubmit**.
- Keep the existing `requestExtension` server function call unchanged.

### FR-5: PasswordSection Migration (UX-27)

- Replace raw `useState` with `useForm` + `zodResolver(Schema)`.
- Create a **local Zod schema** (Better Auth handles the actual password change server-side):
  - `currentPassword` — required
  - `newPassword` — required, min 8 characters
  - `confirmPassword` — required, must match `newPassword` (`.refine` for match)
- Add `FormField` + `FormItem` + `FormLabel` + `FormControl` + `FormMessage` for each field.
- Validation trigger: **onBlur + onSubmit**.
- Keep the existing `authClient.changePassword` call unchanged.

### FR-6: Upload Progress (UX-28)

- In `CheckpointSubmissionPage` (`$id.checkpoints.$checkpointId.tsx`), replace the `fetch(uploadUrl, { method: 'PUT', body: file })` call with `XMLHttpRequest`.
- Add `xhr.upload.onprogress` handler computing `Math.round((loaded / total) * 100)`.
- Store progress (0-100) in component state.
- Pass `uploadProgress: number` as a new prop to `FileUploader`.
- In `FileUploader`, add a `Progress` bar component (from `@/components/ui/progress`) when `isUploading` is true and `uploadProgress` is available.
- Keep the existing `Loader2` spinner as fallback for browsers that don't support progress events.

## Non-Functional Requirements

### NFR-1: Testing (TDD)
- Follow TDD per `conductor/workflow.md`: write failing tests first, then implement to pass.
- Coverage ≥80% on lines, statements, branches, **and** functions.
- Tests live in `tests/unit/` mirroring `src/` structure.
- Default test environment is `happy-dom` (no Node override needed — all changes are client-side).

### NFR-2: i18n
- All new user-visible strings (form error messages, labels, progress text) must be added to both `locales/en.json` and `locales/id.json`.
- Run `pnpm generate:i18n` after adding keys.
- `pnpm check:i18n` must pass (EN↔ID parity).
- No hardcoded English UI strings (enforced by `simak-i18n/no-hardcoded` lint rule).
- Zod error messages must use i18n keys (not hardcoded strings) — match the `EditUserSheet` pattern.

### NFR-3: No New Dependencies
- `react-hook-form` and `@hookform/resolvers/zod` are already in `package.json`.
- The debounce hook is custom (no `use-debounce` or similar package).
- `XMLHttpRequest` is a browser API (no package needed).
- `Progress` component from `@/components/ui/progress` — verify it exists; if not, add via shadcn/ui CLI (not a new runtime dependency).

### NFR-4: File Limits & Modularity
- No file in `src/`, `tests/`, or `scripts/` exceeds 500 lines (enforced by `scripts/check-modularity.js`).
- Match existing code style (oxfmt: semi, singleQuote, trailingComma all, printWidth 100, tabWidth 2).

### NFR-5: Accessibility
- Form fields must have associated labels (`FormLabel` + `htmlFor`).
- Error messages must be announced to screen readers (shadcn `FormMessage` uses `role="alert"` by default — verify).
- Clear (X) button must have `aria-label` (i18n'd).
- Progress bar must have appropriate `aria-valuenow`/`aria-valuemax`/`aria-valuemin`.

## Acceptance Criteria

### AC-1: Debounce (UX-54)
- [ ] Typing "algorithm" rapidly (9 keystrokes) in any of the 4 server-side search fields fires exactly **1** `navigate()` call (after 300ms debounce), not 9.
- [ ] `StudentPicker` and `TemplatePicker` are unchanged (no debounce applied).
- [ ] `src/hooks/use-debounced-callback.ts` exists and is ~15 lines.
- [ ] No `use-debounce` dependency added to `package.json`.

### AC-2: Clear Filters (UX-56)
- [ ] All 4 server-side search inputs show an X button when `search !== ''`.
- [ ] Clicking the X clears the search immediately.
- [ ] X button is hidden when search is empty.
- [ ] X button has an i18n'd `aria-label`.
- [ ] StudentPicker and TemplatePicker do NOT have clear buttons.

### AC-3: ConsultationForm (UX-25)
- [ ] Form uses `useForm` + `zodResolver` (no raw `useState` for field values).
- [ ] Submitting with empty `notes` shows an inline error on blur.
- [ ] Submitting with `sessionType: 'external'` and empty `externalConsultantName` shows an error.
- [ ] Valid submission calls `logConsultation` successfully.
- [ ] All error messages use i18n keys.

### AC-4: ExtensionRequestForm (UX-26)
- [ ] Form uses `useForm` + `zodResolver`.
- [ ] Submitting with a 5-character `reason` shows "min 10 characters" error on blur.
- [ ] Submitting with `duration` > `maxExtensionDays` shows an error.
- [ ] Valid submission calls `requestExtension` successfully.
- [ ] All error messages use i18n keys.

### AC-5: PasswordSection (UX-27)
- [ ] Form uses `useForm` + `zodResolver`.
- [ ] Submitting with mismatched `newPassword`/`confirmPassword` shows "passwords do not match" error on blur.
- [ ] Submitting with a `newPassword` shorter than 8 characters shows an error.
- [ ] Valid submission calls `authClient.changePassword` successfully.
- [ ] All error messages use i18n keys.

### AC-6: Upload Progress (UX-28)
- [ ] `CheckpointSubmissionPage` uses `XMLHttpRequest` (not `fetch`) for the R2 PUT.
- [ ] `xhr.upload.onprogress` updates a progress value (0-100).
- [ ] `FileUploader` shows a determinate `Progress` bar when `isUploading` is true.
- [ ] `Loader2` spinner remains as fallback when progress events are unavailable.
- [ ] Uploading a 10MB file shows progress from 0 to 100.

### AC-7: Quality Gates
- [ ] `pnpm test:coverage` ≥80% on all four metrics.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm lint` passes (including `simak-i18n/no-hardcoded`).
- [ ] `pnpm check:i18n` passes (EN↔ID parity, no new unused keys).
- [ ] No file exceeds 500 lines.

## Out of Scope

- `ReviewForm` comment validation (low priority — server validates).
- Search result quality/relevance tuning.
- Form auto-save functionality.
- Debouncing `StudentPicker`/`TemplatePicker` (client-side filtering, no server fetch).
- Clear buttons on `StudentPicker`/`TemplatePicker`.
- Server handler or database schema changes.
- Notification navigation (TRACK-012).
- NotificationCenter a11y refactor (TRACK-010).
</protect>
