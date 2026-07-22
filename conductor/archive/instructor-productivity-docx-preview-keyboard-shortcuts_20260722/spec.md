<protect>
# Track TRACK-017: Instructor Productivity: DOCX Preview & Keyboard Shortcuts

## Overview

Enhance instructor review productivity with three improvements: (1) inline DOCX file preview on the review detail page using `mammoth.js` for client-side conversion, eliminating the download round-trip; (2) a two-layer keyboard shortcut architecture (global + review-specific) for faster navigation and data refresh; and (3) route-level prefetching on sidebar navigation links to reduce page-load latency.

**Audit IDs:** ENH-UX-2, ENH-UX-3, ENH-PERF-2
**Dependencies:** None
**Estimated Effort:** 3 Days / 1.5 Sprint Loops

## Functional Requirements

### FR-1: DOCX Inline Preview (ENH-UX-2)

1. The `ReviewFilePreview` component on the instructor review detail page (`/instructor/reviews/$submissionId`) must render an inline HTML preview for `.docx` files instead of the current "Preview not available — download to view" card.
2. Conversion uses `mammoth.js` (~30KB gzipped), loaded via dynamic `import('mammoth')` only on the review detail route (lazy-loaded, not in the main client bundle).
3. The `.docx` file is fetched via the existing presigned download URL; conversion is performed client-side via `mammoth.convertToHtml({ arrayBuffer })`.
4. The resulting HTML is rendered in a sandboxed `<iframe srcDoc={html} sandbox="" />` with NO `allow-scripts` — preventing any script execution from untrusted document content.
5. **Size guard:** Conversion is attempted only when `fileSize < 10MB`. For files >= 10MB, show a localized "file too large for inline preview" message (new i18n key) alongside the existing download button.
6. A loading state (e.g., `Loader2` spinner) is shown while fetching and converting.
7. On conversion failure, fall back to the existing "Preview not available" card with the download button.
8. PDF preview (existing inline `<embed>`) remains unchanged.
9. This feature is **instructor-only** (review detail page). Student submission pages are unchanged.

### FR-2: Keyboard Shortcuts — Two-Layer Architecture (ENH-UX-3)

#### FR-2a: Global Shortcuts (mounted in `_authenticated.tsx`)

1. **R** — Refresh: triggers `queryClient.invalidateQueries()` to refetch all active queries.
2. **?** — Toggle a cheat-sheet `Popover` that displays all available shortcuts.
3. The cheat-sheet popover shows all shortcuts (R, ?, J, K) but **greys out** J/K when the user is not on a review detail page.
4. The popover animation respects the `prefers-reduced-motion` media query.

#### FR-2b: Review-Specific Shortcuts (mounted in `$submissionId.tsx`)

1. **J** — Navigate to the next pending review in the queue.
2. **K** — Navigate to the previous pending review in the queue.
3. On review detail page mount, preload `listPendingReviews({ page: 1, limit: 100 })`, find the current `submissionId`'s index in the result, and track it in state.
4. `J` navigates to the next pending submission ID; `K` to the previous. This works before AND after review submission.
5. Makes the existing "Next Review" button instant (no post-review server call needed — the list is already preloaded).
6. Edge case: if the current submission is not in the pending list (already opened/transitioned), J/K start from index 0.

#### FR-2c: Input Suppression

1. All shortcuts are disabled when focus is in an `<input>`, `<textarea>`, or `[contenteditable]` element.
2. Shortcut event listeners are properly cleaned up on component unmount (no memory leak).

### FR-3: Route Prefetch (ENH-PERF-2)

1. Add `preload="intent"` to sidebar `<Link>` components in all three role layouts (admin, instructor, student): Dashboard, Assignments, Reviews, Templates, Users, Audit Log, Email Queue (where applicable per role).
2. Hovering a sidebar link prefetches the route's data/loader.
3. Keep `defaultPreload` at the router level as `false` (opt-in per-link) to avoid over-prefetching on the landing page.
4. TanStack Router handles deduplication automatically.

## Non-Functional Requirements

1. **Bundle safety:** `mammoth` must be dynamically imported (`import('mammoth')`) — it must NOT appear in the main client bundle. Verify via build output inspection.
2. **Security:** The sandboxed iframe must use `sandbox=""` (no `allow-scripts`, no `allow-same-origin`). Untrusted `.docx` content cannot execute scripts.
3. **i18n:** All new user-visible strings (cheat-sheet labels, "file too large" message, loading text) must be added to both `locales/en.json` and `locales/id.json`, then `pnpm generate:i18n`.
4. **Performance:** The 10MB size guard prevents browser freezes on large DOCX files. The preload limit of 100 keeps the initial fetch lightweight.
5. **Accessibility:** Shortcuts must not interfere with keyboard navigation (Tab/Enter/Space). The cheat-sheet popover must be keyboard-accessible (focus trapping, Escape to close).
6. **Tech stack update:** `mammoth` must be added to `conductor/tech-stack.md` before implementation begins.

## Acceptance Criteria

1. **AC-1 (DOCX Preview):** Open a review with a `.docx` submission (< 10MB) — inline HTML preview renders in a sandboxed iframe without downloading. A `.docx` with macros shows the preview without executing scripts (sandbox). A `.docx` >= 10MB shows "file too large for inline preview" with a download button. Conversion errors fall back to the existing "Preview not available" card.
2. **AC-2 (Keyboard Shortcuts):** On the review page, press `J` — navigates to next pending review (instant, no server call). Press `K` — navigates to previous. Press `R` — active queries refetch. Press `?` — cheat-sheet popover appears (J/K greyed out when not on a review page). Type in a textarea — shortcuts are suppressed.
3. **AC-3 (Route Prefetch):** Hover a sidebar link — the network tab shows the route prefetch firing. The landing page does not over-prefetch (`defaultPreload: false`).
4. **AC-4 (Tests):** `pnpm test:unit` includes new tests for: mammoth conversion (success, error fallback, sandbox attribute, 10MB size guard), keyboard shortcut layer (global R/? firing, review-specific J/K firing, input suppression, cheat-sheet toggle, greyed-out state when not on review page), pending-list preload + index tracking, `preload="intent"` attribute presence on sidebar links. Coverage >= 80%.
5. **AC-5 (Quality Gates):** `pnpm typecheck`, `pnpm lint` (including `simak-i18n/no-hardcoded`), `pnpm check:i18n` all pass. All files <= 500 lines. `mammoth` is dynamically imported (not in main bundle).

## Out of Scope

- PDF preview changes (existing inline embed is sufficient)
- Student-facing DOCX preview (instructor review page only — confirmed)
- Keyboard shortcuts for non-review pages (focus on instructor review flow first)
- Customizable/remappable shortcuts (fixed bindings: R, ?, J, K)
- Prefetching on the public landing page
- Customizable size guard threshold (fixed at 10MB)
</protect>
