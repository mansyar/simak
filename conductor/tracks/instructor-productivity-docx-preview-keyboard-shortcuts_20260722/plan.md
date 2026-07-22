<protect>
# Implementation Plan: TRACK-017 — Instructor Productivity: DOCX Preview & Keyboard Shortcuts

## Phase 0: Tech Stack Update & Dependency Setup

- [x] Task: Read `spec.md` and `conductor/workflow.md` before starting phase implementation
    - [x] Re-read the track specification for phase-specific requirements
    - [x] Re-read workflow rules (TDD, commit format, coverage thresholds)
- [x] Task: Add `mammoth` to `conductor/tech-stack.md`
    - [x] Add entry under Frontend table: `mammoth` — `.docx` -> HTML conversion, ~30KB gzipped, lazy-loaded via dynamic `import()`
    - [x] Add dated note explaining the new dependency
- [x] Task: Install `mammoth` dependency `784fcd3`
    - [x] Run `pnpm add mammoth`
    - [x] Verify it has TypeScript type definitions
- [x] Task: Conductor - User Manual Verification 'Tech Stack Update & Dependency Setup' (Protocol in workflow.md)

## Phase 1: DOCX Inline Preview (ENH-UX-2) [checkpoint: ab79364]

- [x] Task: Read `spec.md` and `conductor/workflow.md` before starting phase implementation
    - [x] Re-read the track specification for phase-specific requirements
    - [x] Re-read workflow rules (TDD, commit format, coverage thresholds)
- [x] Task: Write failing tests for DOCX preview in `ReviewFilePreview` `fe787e7`
    - [x] Create/update `tests/unit/components/reviews/review-file-preview.test.tsx`
    - [x] Test: `.docx` file < 10MB triggers `mammoth.convertToHtml` with the fetched arrayBuffer
    - [x] Test: rendered output is a sandboxed `<iframe>` with `sandbox=""` (no `allow-scripts`)
    - [x] Test: `.docx` file >= 10MB shows localized "file too large" message (no conversion attempted)
    - [x] Test: conversion failure falls back to existing "Preview not available" card
    - [x] Test: loading state (`Loader2` spinner) shown while fetching/converting
    - [x] Test: PDF preview path remains unchanged (existing `<embed>` still renders)
- [x] Task: Add i18n keys for DOCX preview to both `locales/en.json` and `locales/id.json` `fe787e7`
    - [x] `files.tooLargeForPreview` — "File is too large for inline preview. Download to view."
    - [x] `files.convertingDocx` — "Converting document for preview..."
- [x] Task: Implement DOCX preview in `ReviewFilePreview` (`src/components/reviews/ReviewFilePreview.tsx`) `fe787e7`
    - [x] Detect `.docx` extension (case-insensitive) alongside existing `isPdf` check
    - [x] Size guard: if `fileSize >= 10MB` (10 * 1024 * 1024), show "file too large" message with download button — skip conversion
    - [x] Dynamic `import('mammoth')` -> fetch file via `downloadUrl` -> `mammoth.convertToHtml({ arrayBuffer })`
    - [x] Render converted HTML in `<iframe srcDoc={html} sandbox="" />`
    - [x] Show `Loader2` spinner during fetch/convert
    - [x] On conversion error, fall back to existing "Preview not available" card
    - [x] Keep PDF `<embed>` path and download button unchanged
- [x] Task: Run `pnpm generate:i18n` to regenerate i18n types `fe787e7`
- [x] Task: Conductor - User Manual Verification 'DOCX Inline Preview' (Protocol in workflow.md)

## Phase 2: Keyboard Shortcuts — Two-Layer Architecture (ENH-UX-3)

- [ ] Task: Read `spec.md` and `conductor/workflow.md` before starting phase implementation
    - [ ] Re-read the track specification for phase-specific requirements
    - [ ] Re-read workflow rules (TDD, commit format, coverage thresholds)
- [ ] Task: Write failing tests for `useKeyboardShortcuts` global hook
    - [ ] Create `tests/unit/hooks/use-keyboard-shortcuts.test.tsx`
    - [ ] Test: pressing `R` calls `queryClient.invalidateQueries()`
    - [ ] Test: pressing `?` toggles cheat-sheet popover open/closed
    - [ ] Test: shortcuts suppressed when focus is in `<input>`, `<textarea>`, or `[contenteditable]`
    - [ ] Test: event listener removed on unmount (no leak)
- [ ] Task: Write failing tests for `useReviewNav` review-specific hook
    - [ ] Create `tests/unit/hooks/use-review-nav.test.tsx`
    - [ ] Test: calls `listPendingReviews({ data: { page: 1, limit: 100 } })` on mount
    - [ ] Test: `J` key navigates to next pending submissionId in the preloaded list
    - [ ] Test: `K` key navigates to previous pending submissionId
    - [ ] Test: edge case — current submissionId not in list -> J/K start from index 0
    - [ ] Test: J/K suppressed when focus is in input/textarea/contenteditable
    - [ ] Test: listener removed on unmount
- [ ] Task: Write failing tests for `KeyboardCheatSheet` popover component
    - [ ] Create `tests/unit/components/keyboard-cheat-sheet.test.tsx`
    - [ ] Test: displays all 4 shortcuts (R, ?, J, K) with labels
    - [ ] Test: J/K entries greyed out (disabled styling) when `isReviewPage` prop is false
    - [ ] Test: R and ? are always enabled regardless of `isReviewPage`
- [ ] Task: Add i18n keys for cheat-sheet to both `locales/en.json` and `locales/id.json`
    - [ ] `shortcuts.cheatSheet.title` — "Keyboard Shortcuts"
    - [ ] `shortcuts.cheatSheet.refresh` — "Refresh data"
    - [ ] `shortcuts.cheatSheet.help` — "Toggle this help"
    - [ ] `shortcuts.cheatSheet.nextReview` — "Next pending review"
    - [ ] `shortcuts.cheatSheet.prevReview` — "Previous pending review"
    - [ ] `shortcuts.cheatSheet.notOnReviewPage` — "(available on review pages only)"
- [ ] Task: Create `src/components/ui/popover.tsx` (shadcn Popover primitive via Radix)
    - [ ] Wrap `@radix-ui/react-popover` with shadcn-style exports (`Popover`, `PopoverTrigger`, `PopoverContent`)
    - [ ] Run `pnpm add @radix-ui/react-popover` if not already installed
- [ ] Task: Implement `src/hooks/use-keyboard-shortcuts.ts` (global hook)
    - [ ] Use `useQueryClient()` from `@tanstack/react-query` for `R` -> `invalidateQueries()`
    - [ ] `?` toggles a boolean state for cheat-sheet visibility
    - [ ] Guard: check `document.activeElement` tag/contenteditable before firing
    - [ ] `useEffect` with `window.addEventListener('keydown', handler)` and cleanup in return
    - [ ] Export cheat-sheet open state + a `KeyboardCheatSheet` component
- [ ] Task: Implement `src/hooks/use-review-nav.ts` (review-specific hook)
    - [ ] On mount: `listPendingReviews({ data: { page: 1, limit: 100 } })` via server fn call
    - [ ] Find current `submissionId` index in result items; store list + index in state
    - [ ] `J` -> `navigate({ to: '/instructor/reviews/$submissionId', params: { submissionId: nextId } })`
    - [ ] `K` -> same navigate with previous ID
    - [ ] Guard: same input/textarea/contenteditable suppression
    - [ ] `useEffect` cleanup removes listener
- [ ] Task: Implement `src/components/keyboard-cheat-sheet.tsx` (cheat-sheet popover)
    - [ ] Use `Popover` + `PopoverTrigger` + `PopoverContent` primitives
    - [ ] Accept `isOpen`, `onClose`, `isReviewPage` props
    - [ ] Render shortcut rows: R (Refresh), ? (Help), J (Next Review), K (Prev Review)
    - [ ] Grey out J/K rows with muted text + `shortcuts.cheatSheet.notOnReviewPage` label when `!isReviewPage`
    - [ ] Respect `prefers-reduced-motion` for animation (CSS or conditional class)
- [ ] Task: Mount global shortcuts in `src/routes/_authenticated.tsx`
    - [ ] Call `useKeyboardShortcuts()` inside the layout component
    - [ ] Render `<KeyboardCheatSheet>` with `isReviewPage={false}` (global level — J/K always greyed)
- [ ] Task: Mount review-nav hook in `src/routes/_authenticated/instructor/reviews/$submissionId.tsx`
    - [ ] Call `useReviewNav(submissionId)` inside `ReviewDetailPage`
    - [ ] Override cheat-sheet `isReviewPage={true}` when on review detail route (so J/K are active in the popover)
- [ ] Task: Refactor "Next Review" button to use preloaded list
    - [ ] Replace the post-success `listPendingReviews({ limit: 1 })` fetch with index lookup from the preloaded list
    - [ ] "Next Review" button navigates instantly (no server call)
- [ ] Task: Run `pnpm generate:i18n` to regenerate i18n types
- [ ] Task: Conductor - User Manual Verification 'Keyboard Shortcuts' (Protocol in workflow.md)

## Phase 3: Route Prefetch (ENH-PERF-2)

- [ ] Task: Read `spec.md` and `conductor/workflow.md` before starting phase implementation
    - [ ] Re-read the track specification for phase-specific requirements
    - [ ] Re-read workflow rules (TDD, commit format, coverage thresholds)
- [ ] Task: Write failing tests for `preload="intent"` on sidebar links
    - [ ] Create/update `tests/unit/components/layout/admin-sidebar.test.tsx`
    - [ ] Create/update `tests/unit/components/layout/instructor-sidebar.test.tsx`
    - [ ] Create/update `tests/unit/components/layout/student-sidebar.test.tsx`
    - [ ] Test: each `<Link>` in `mainLinks` and `preferenceLinks` has `preload="intent"` attribute
- [ ] Task: Add `preload="intent"` to all `<Link>` components in `src/components/layout/admin-sidebar.tsx`
    - [ ] Add `preload="intent"` to both the `mainLinks` map and `preferenceLinks` map `<Link>` elements
- [ ] Task: Add `preload="intent"` to all `<Link>` components in `src/components/layout/instructor-sidebar.tsx`
    - [ ] Add `preload="intent"` to both the `mainLinks` map and `preferenceLinks` map `<Link>` elements
- [ ] Task: Add `preload="intent"` to all `<Link>` components in `src/components/layout/student-sidebar.tsx`
    - [ ] Add `preload="intent"` to both the `mainLinks` map and `preferenceLinks` map `<Link>` elements
- [ ] Task: Explicitly set `defaultPreload: false` in `src/router.tsx` router config
    - [ ] Add `defaultPreload: false` to the `createRouter({ ... })` options for clarity (prevents over-prefetching on the landing page)
- [ ] Task: Conductor - User Manual Verification 'Route Prefetch' (Protocol in workflow.md)

## Phase 4: Final Verification & Quality Gates

- [ ] Task: Read `spec.md` and `conductor/workflow.md` before starting phase implementation
    - [ ] Re-read the track specification for phase-specific requirements
    - [ ] Re-read workflow rules (TDD, commit format, coverage thresholds)
- [ ] Task: Run full quality gate suite and verify all pass
    - [ ] `pnpm test:coverage` — all tests pass, coverage >= 80% on lines/statements/branches/functions
    - [ ] `pnpm typecheck` — `tsc --noEmit --incremental` passes
    - [ ] `pnpm lint` — `oxlint .` passes (including `simak-i18n/no-hardcoded` rule)
    - [ ] `pnpm check:i18n` — EN<->ID key parity, no new unused keys
    - [ ] Verify no file in `src/`, `tests/`, or `scripts/` exceeds 500 lines
    - [ ] Verify `mammoth` is dynamically imported (grep build output for `mammoth` in main client chunk -> should only appear in a lazy-loaded chunk)
- [ ] Task: Conductor - User Manual Verification 'Final Verification & Quality Gates' (Protocol in workflow.md)
</protect>
