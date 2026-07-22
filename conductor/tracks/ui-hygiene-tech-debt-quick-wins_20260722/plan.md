<protect>
# Implementation Plan: UI Hygiene & Tech-Debt Quick Wins (TRACK-015)

## Phase 1: Landing Footer Link & Copyright Hygiene (ENH-UX-1)

- [x] Task: Read spec.md and workflow.md to re-ground before Phase 1 implementation
    - [x] Read `conductor/tracks/ui-hygiene-tech-debt-quick-wins_20260722/spec.md` (requirements, acceptance criteria, scope)
    - [x] Read `conductor/workflow.md` (TDD lifecycle, commit/git-notes protocol, checkpoint protocol)
- [x] Task: Write failing tests for footer link targets and dynamic copyright (Red)
    - [x] Add/extend route test asserting no `href="#"` remains in `src/routes/index.tsx` footer
    - [x] Assert the "About" link points to `#how-it-works`
    - [x] Assert the "Contact" link is absent from the footer
    - [x] Assert the copyright renders via the `landing.footer.copyright` i18n key with the current year
    - [x] Run `pnpm test` and confirm the new tests fail as expected
- [x] Task: Implement footer fixes (Green)
    - [x] FR-1.1: Replace the "About" `href="#"` with `<a href="#how-it-works">` in `src/routes/index.tsx`
    - [x] FR-1.2: Remove the "Contact" `<a href="#">` link from the footer
    - [x] FR-1.3: Replace `&copy; 2026 SIMAK` with `t('landing.footer.copyright', { year: new Date().getFullYear() })`
    - [x] FR-1.4: Add `landing.footer.copyright` key to `locales/en.json` and `locales/id.json`
    - [x] FR-1.5: Remove `landing.footer.links.contact` key from `locales/en.json` and `locales/id.json`
    - [x] Run `pnpm generate:i18n` to regenerate `src/i18n/types.ts` and `detect-locale.ts`
    - [x] Run `pnpm test` and confirm all tests now pass
- [x] Task: Verify quality gates for Phase 1
    - [x] Run `pnpm test:coverage` (≥80% on lines, statements, branches, functions)
    - [x] Run `pnpm typecheck`
    - [x] Run `pnpm lint` (includes `simak-i18n/no-hardcoded`)
    - [x] Run `pnpm check:i18n` (EN↔ID parity; no unused keys)
    - [x] NFR-1: Verified zero `href="#"` in `src/routes/`
- [~] Task: Conductor - User Manual Verification 'Phase 1: Landing Footer Link & Copyright Hygiene' (Protocol in workflow.md)

## Phase 2: Resolve eslint-disable via useQuery Conversion (ENH-TD-1)

- [ ] Task: Read spec.md and workflow.md to re-ground before Phase 2 implementation
    - [ ] Read `conductor/tracks/ui-hygiene-tech-debt-quick-wins_20260722/spec.md` (requirements, acceptance criteria, scope)
    - [ ] Read `conductor/workflow.md` (TDD lifecycle, commit/git-notes protocol, checkpoint protocol)
- [ ] Task: Write failing tests for useQuery data loading and error toast (Red)
    - [ ] Test `StudentPicker` loads students via `useQuery` (no `useEffect` data-fetch) and preserves client-side search filtering
    - [ ] Test `TemplatePicker` loads templates via `useQuery` and preserves search filtering
    - [ ] Test `AssignmentWizard` loads students via `useQuery` (mount fetch only); assert `handleSelectTemplate`'s `getTemplate` remains an imperative on-click call
    - [ ] Test that `toast.error(t('errors.fetchFailed'))` fires on query rejection in all 3 components
    - [ ] Test that a `templateKeys` factory exists in `src/lib/query-keys.ts`
    - [ ] Run `pnpm test` and confirm the new tests fail as expected
- [ ] Task: Extend the query-key factory with templateKeys
    - [ ] FR-2.4: Add `templateKeys` factory (`{ all, list }`) to `src/lib/query-keys.ts`
    - [ ] Update the file header comment to reflect 6 domains (templates now touched)
- [ ] Task: Implement useQuery conversion in StudentPicker (Green)
    - [ ] FR-2.1: Replace `useEffect`+`useState` students fetch with `useQuery` using `userKeys.list({ page:1, limit:200, search:'', role:'student' })`
    - [ ] Replace local `loading`/`error`/`students` state with `useQuery` return values (`isLoading`, `isError`, `data`)
    - [ ] Preserve `toast.error(t('errors.fetchFailed'))` failure path; remove the local hardcoded error string
    - [ ] Remove the `eslint-disable-next-line react-hooks/exhaustive-deps` comment
- [ ] Task: Implement useQuery conversion in TemplatePicker (Green)
    - [ ] FR-2.3: Replace `useEffect`+`useState` templates fetch with `useQuery` using `templateKeys.list({ page:1, limit:100, search:'' })`
    - [ ] Replace local `loading`/`error`/`templates` state with `useQuery` return values
    - [ ] Preserve `toast.error(t('errors.fetchFailed'))` failure path; remove the local hardcoded error string
    - [ ] Remove the `eslint-disable-next-line react-hooks/exhaustive-deps` comment
- [ ] Task: Implement useQuery conversion in AssignmentWizard mount fetch (Green)
    - [ ] FR-2.2: Replace the mount-only `loadStudents` `useEffect` with `useQuery` using `userKeys.list(...)`
    - [ ] Replace local `students` state with the query's `data`; leave `handleSelectTemplate` `getTemplate` unchanged
    - [ ] Remove the `eslint-disable-next-line react-hooks/exhaustive-deps` comment
    - [ ] Run `pnpm test` and confirm all tests now pass
- [ ] Task: Verify quality gates for Phase 2
    - [ ] Run `pnpm test:coverage` (≥80% on all four metrics)
    - [ ] Run `pnpm typecheck`
    - [ ] Run `pnpm lint` — confirm zero `react-hooks/exhaustive-deps` suppressions in `src/components/instructor/assignments/`
    - [ ] Run `pnpm check:i18n`
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Resolve eslint-disable via useQuery Conversion' (Protocol in workflow.md)
</protect>
