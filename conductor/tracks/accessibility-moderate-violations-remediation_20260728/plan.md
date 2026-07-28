<protect>
# TRACK-037: Accessibility Moderate Violations Remediation — Implementation Plan

## Phase 0: Investigation & Test Baseline [checkpoint: 9f95797]

- [x] Task: Confirm exact `region` violating node and check for duplicate `id="main-content"` [f7a2d12]
    - [x] Check `src/routes/_unauthenticated/auth/setup-password.tsx` for `id="main-content"` (login.tsx already has it on a `<div>` — must avoid duplicate IDs when adding to `<main>`)
    - [x] Inspect `src/routes/_authenticated.tsx` KeyboardCheatSheet integration — understand `isOpen` state management and `isReviewPage` prop passing to determine best relocation strategy
    - [x] Verify landing page (`src/routes/index.tsx`) has no `<main>` landmark (confirmed — only `<section>`, `<footer>`, `<nav>`)
    - [x] Read the 4 heading-order pages to identify exact heading-level skips
- [x] Task: Conductor - User Manual Verification 'Phase 0: Investigation & Test Baseline' (Protocol in workflow.md)

## Phase 1: Fix `landmark-one-main` + `skip-link` (Landmark Structure & Skip Link Targets) [checkpoint: 7592772]

- [x] Task: Read `spec.md` and `workflow.md` to re-establish context and confirm TDD requirements
- [x] Task: Write failing unit tests for landmark structure and skip link targets (Red Phase)
    - [x] Create `tests/unit/routes/layout-a11y.test.tsx` — test that `_unauthenticated.tsx` renders a `<main id="main-content" tabindex="-1">` wrapping the Outlet
    - [x] Add test that role layouts (`student.tsx`, `instructor.tsx`, `admin.tsx`) render `<main id="main-content" tabindex="-1">`
    - [x] Add test that landing page (`index.tsx`) renders a `<main>` landmark
    - [x] Add test that `login.tsx` does NOT have a duplicate `id="main-content"` on a `<div>` (must be removed)
    - [x] Run `pnpm test` — confirm new tests FAIL as expected
- [x] Task: Implement landmark and skip link fixes (Green Phase) [d1e8993]
    - [ ] `src/routes/_unauthenticated.tsx` — wrap `<Outlet />` in `<main id="main-content" tabindex="-1" className="...">`
    - [ ] `src/routes/_authenticated/student.tsx` — add `id="main-content"` and `tabindex="-1"` to existing `<main>`
    - [ ] `src/routes/_authenticated/instructor.tsx` — add `id="main-content"` and `tabindex="-1"` to existing `<main>`
    - [ ] `src/routes/_authenticated/admin.tsx` — add `id="main-content"` and `tabindex="-1"` to existing `<main>`
    - [ ] `src/routes/index.tsx` — wrap content in `<main id="main-content" tabindex="-1">`
    - [ ] `src/routes/_unauthenticated/auth/login.tsx` — remove `id="main-content"` from the `<div>` (line 52) to avoid duplicate ID
    - [ ] Check `setup-password.tsx` — remove `id="main-content"` if present (to avoid duplicate with new `<main>` in `_unauthenticated.tsx`)
    - [ ] Run `pnpm test` — confirm all tests now PASS
- [ ] Task: Verify quality gates
    - [ ] Run `pnpm test:coverage` (≥80% thresholds)
    - [ ] Run `pnpm typecheck`
    - [ ] Run `pnpm lint` (including `simak-i18n/no-hardcoded`)
    - [ ] Run `pnpm check:i18n`
- [x] Task: Conductor - User Manual Verification 'Phase 1: Landmark Structure & Skip Link' (Protocol in workflow.md)

## Phase 2: Fix `region` (Content Outside Landmarks) [checkpoint: 6ff3cb3]

- [x] Task: Read `spec.md` and `workflow.md` to re-establish context and confirm TDD requirements
- [x] Task: Write failing unit tests for content containment in landmarks (Red Phase)
    - [x] Add test to `tests/unit/routes/layout-a11y.test.tsx` — verify `KeyboardCheatSheet` trigger button is rendered inside a landmark (`<main>` or `<header>`)
    - [x] Add test to `tests/unit/components/sonner.test.tsx` (or extend existing) — verify Toaster `<section>` has `aria-label` attribute
    - [x] Run `pnpm test` — confirm new tests FAIL as expected
- [x] Task: Implement `region` fixes (Green Phase) [1fd3035]
    - [x] `src/routes/_authenticated.tsx` — relocate `<KeyboardCheatSheet />` so its trigger button is inside a landmark (options: move into role layout `<main>`, move into `AppHeader` `<header>`, or wrap in a landmark). Determine best approach from Phase 0 investigation.
    - [x] `src/components/ui/sonner.tsx` — add `aria-label` to Toaster `<section>` (use i18n key if lint rule requires — add key to `locales/en.json` and `locales/id.json`, run `pnpm generate:i18n`)
    - [x] Run `pnpm test` — confirm all tests now PASS
- [x] Task: Verify quality gates
    - [x] Run `pnpm test:coverage` (≥80% thresholds)
    - [x] Run `pnpm typecheck`
    - [x] Run `pnpm lint` (including `simak-i18n/no-hardcoded`)
    - [x] Run `pnpm check:i18n`
- [x] Task: Conductor - User Manual Verification 'Phase 2: Region Content Containment' (Protocol in workflow.md)

## Phase 3: Fix `heading-order` (4 Pages)

- [x] Task: Read `spec.md` and `workflow.md` to re-establish context and confirm TDD requirements
- [x] Task: Write failing unit tests for heading hierarchy (Red Phase)
    - [x] Add test to `tests/unit/routes/layout-a11y.test.tsx` — verify heading levels don't skip on each of the 4 pages (render component, query `h1`-`h6` in order, assert no skips)
    - [x] Run `pnpm test` — confirm new tests FAIL as expected
- [x] Task: Implement heading-order fixes (Green Phase) [6d5922e]
    - [ ] `src/routes/_authenticated/student/dashboard.tsx` — fix heading hierarchy (e.g., change `h3` to `h2` if no `h2` exists between `h1` and `h3`)
    - [ ] `src/routes/_authenticated/student/assignments/$id.tsx` — fix heading hierarchy
    - [ ] `src/routes/_authenticated/instructor/reviews/$submissionId.tsx` — fix heading hierarchy
    - [ ] `src/routes/_authenticated/admin/templates/$templateId.tsx` — fix heading hierarchy
    - [ ] Run `pnpm test` — confirm all tests now PASS
- [x] Task: Verify quality gates
    - [x] Run `pnpm test:coverage` (≥80% thresholds)
    - [x] Run `pnpm typecheck`
    - [x] Run `pnpm lint` (including `simak-i18n/no-hardcoded`)
    - [x] Run `pnpm check:i18n`
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Heading Order' (Protocol in workflow.md)

## Phase 4: E2E Tests & Documentation Update

- [ ] Task: Read `spec.md` and `workflow.md` to re-establish context and confirm TDD requirements
- [ ] Task: Update E2E a11y tests to assert zero moderate violations
    - [ ] Read `tests/e2e/a11y.spec.ts` — understand current critical/serious filter
    - [ ] Extend to also assert zero moderate violations (or change filter to include moderate)
    - [ ] If E2E login timeout blocks authenticated-page scans, document the workaround or skip authenticated scans with a note (the E2E login issue is pre-existing and out of scope)
    - [ ] Run E2E a11y tests for login page — confirm zero moderate violations
- [ ] Task: Update `docs/a11y-violations.md`
    - [ ] Mark `landmark-one-main` as remediated
    - [ ] Mark `skip-link` as remediated
    - [ ] Mark `region` as remediated
    - [ ] Mark `heading-order` as remediated
    - [ ] Add remediation date and track reference (TRACK-037)
- [x] Task: Verify quality gates
    - [x] Run `pnpm test:coverage` (≥80% thresholds)
    - [x] Run `pnpm typecheck`
    - [x] Run `pnpm lint` (including `simak-i18n/no-hardcoded`)
    - [x] Run `pnpm check:i18n`
- [ ] Task: Conductor - User Manual Verification 'Phase 4: E2E Tests & Documentation' (Protocol in workflow.md)
</protect>
