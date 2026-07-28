<protect>
# TRACK-037: Accessibility Moderate Violations Remediation

## Overview

Remediate 4 moderate axe-core accessibility violations documented in `docs/a11y-violations.md`: `region`, `skip-link`, `heading-order`, and `landmark-one-main`. These violations affect nearly every page in the SIMAK application.

## Background — Investigation Findings

Axe-core scan and code analysis identified the following root causes:

| Violation | Impact | Pages Affected | Root Cause |
|---|---|---|---|
| `landmark-one-main` | moderate | Login page only | `_unauthenticated.tsx` renders bare `<Outlet />` with no `<main>` landmark |
| `skip-link` | moderate | All authenticated pages | Skip link targets `#main-content` but no element has that `id` |
| `region` | moderate | All authenticated pages | Content outside landmarks — most likely the `KeyboardCheatSheet` trigger `<button>` rendered in `_authenticated.tsx` outside the role layout's `<main>`; secondary: sonner `<Toaster>` `<section>` without `aria-label` |
| `heading-order` | moderate | 4 specific pages | Heading levels skip (e.g., h1 → h3 without h2) |

**Note:** E2E axe-core scans of authenticated pages timed out due to a pre-existing TanStack Router login issue in this worktree. Login page scan confirmed `landmark-one-main`. Code analysis confirmed root causes for all 4 violations. Phase 0 of the plan will confirm the exact `region` node.

## Functional Requirements

### FR1 — Landmark Structure (`landmark-one-main` + `region`)
1. Every page must have exactly one `<main>` landmark.
2. The login page (`_unauthenticated.tsx`) must wrap its `<Outlet />` in a `<main>` element.
3. All page content must be contained within landmarks — no interactive elements or perceivable content outside `<main>`, `<header>`, `<aside>`, or `<nav>`.
4. The `KeyboardCheatSheet` trigger button must be moved inside a landmark (either inside `<main>` or into the `<header>`).
5. The sonner `<Toaster>` `<section>` must have an `aria-label` to qualify as a landmark.

### FR2 — Skip Link Target (`skip-link`)
1. The skip link (`<a href="#main-content">`) in `__root.tsx` must target a valid, existing element.
2. The `<main>` element in all three role layouts (`student.tsx`, `instructor.tsx`, `admin.tsx`) must have `id="main-content"` and `tabindex="-1"` (to be programmatically focusable).

### FR3 — Heading Order (`heading-order`)
1. Heading levels must not skip. No `h1` → `h3` without an intervening `h2`.
2. Pages to fix (identified in `docs/a11y-violations.md`):
   - Student dashboard (`student/dashboard.tsx`)
   - Student assignment detail (`student/assignments/$id.tsx`)
   - Instructor review detail (`instructor/reviews/$submissionId.tsx`)
   - Admin template editor (`admin/templates/$templateId.tsx`)

### FR4 — Test Coverage
1. Unit tests must verify the correct DOM structure for modified layout components (presence of `<main>`, `id`, `tabindex`, `aria-label`).
2. E2E axe-core tests (`tests/e2e/a11y.spec.ts`) must be extended to assert **zero moderate violations** (currently only checks critical/serious).

## Non-Functional Requirements

- **WCAG 2.1 AA compliance** maintained or improved.
- No new i18n keys needed unless `aria-label` values are user-visible (toaster label may need i18n).
- No regressions in existing unit tests, typecheck, or lint.
- All files remain under the 500-line limit.

## Acceptance Criteria

- [ ] AC1: `landmark-one-main` violation resolved on login page — `<main>` present in `_unauthenticated.tsx`.
- [ ] AC2: `skip-link` violation resolved — `#main-content` target exists and is focusable on all authenticated pages.
- [ ] AC3: `region` violation resolved — no perceivable content outside landmarks on authenticated pages.
- [ ] AC4: `heading-order` violation resolved on all 4 identified pages.
- [ ] AC5: E2E a11y tests assert zero moderate violations (test updated, passes for login page at minimum; authenticated-page scans depend on pre-existing E2E login issue being resolved or worked around).
- [ ] AC6: All quality gates pass — `pnpm test:coverage` ≥80%, `pnpm typecheck`, `pnpm lint`, `pnpm check:i18n`.
- [ ] AC7: `docs/a11y-violations.md` updated to mark all 4 violations as remediated.

## Out of Scope

- Fixing the pre-existing E2E `loginAsRole` timeout issue (unless it blocks E2E verification — will be assessed in Phase 0).
- Critical and serious axe-core violations (already remediated in prior tracks).
- New accessibility features beyond fixing the 4 documented moderate violations.
- Screen reader testing beyond what axe-core covers.
</protect>
