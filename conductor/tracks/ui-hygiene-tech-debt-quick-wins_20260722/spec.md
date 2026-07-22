<protect>
# Track: UI Hygiene & Tech-Debt Quick Wins (TRACK-015)

## Overview

A small, surgical maintenance track that cleans up two tech-debt findings surfaced by the post-audit enhancement review. **ENH-UX-1** fixes two dead `href="#"` footer links and a hardcoded copyright year on the public landing page. **ENH-TD-1** removes three `eslint-disable-next-line react-hooks/exhaustive-deps` suppressions in the assignment-creation wizard by converting their mount-only `useEffect`+`useState` data fetches to TanStack `useQuery` — aligning with the React Query migration introduced by TRACK-014 and consuming its typed query-key factory.

- **Type:** chore
- **Audit IDs:** ENH-UX-1, ENH-TD-1
- **Dependencies:** TRACK-014 (`src/lib/query-keys.ts` — query-key factory; dependency resolved/complete)
- **Estimated Effort:** 1 Day / 0.5 Sprint Loops
- **Note:** ENH-TD-2 was REMOVED during roadmap triage as an invalid finding — all three files already call `toast.error(t('errors.fetchFailed'))` alongside `console.error`; no work needed.

## Context & Traceability

- **PRD Reference:** `docs/PRD.md` (landing page footer links, assignment creation wizard, template/student selection)
- **TDD Reference:** `docs/TDD.md` (landing page structure, react-hook-form + useEffect patterns, error feedback convention; §259 notes the query-key factory is consumed by TRACK-015)
- **Prior Track:** TRACK-014 (optimistic-ui-updates) — introduced `src/lib/query-keys.ts` with 5 typed factories (notifications, consultations, extensions, assignments, users)

## Functional Requirements

### FR-1: Landing Footer Link & Copyright Hygiene (ENH-UX-1)

File: `src/routes/index.tsx` (footer, lines ~106–126).

- **FR-1.1:** Replace the "About" dead link (`<a href="#">` at line 118) with a real in-page anchor: `<a href="#how-it-works">` (the `id="how-it-works"` section already exists at line 82). Clicking scrolls to the "How It Works" section instead of being a no-op.
- **FR-1.2:** Remove the "Contact" dead link (`<a href="#">` at line 121) entirely — no contact page/route or support email exists in the project.
- **FR-1.3:** Replace the hardcoded `&copy; 2026 SIMAK` (line 112) with an i18n key using interpolation: `t('landing.footer.copyright', { year: new Date().getFullYear() })` so the year is always current.
- **FR-1.4:** Add the `landing.footer.copyright` key to both `locales/en.json` and `locales/id.json` (e.g., EN: `"© {year} SIMAK"`, ID: `"© {year} SIMAK"`). Run `pnpm generate:i18n`.
- **FR-1.5:** Remove the now-orphaned `landing.footer.links.contact` key from both `locales/en.json` and `locales/id.json` (the Contact link is removed in FR-1.2; an unused key fails the `pnpm check:i18n:unused` pre-push gate).

### FR-2: Resolve eslint-disable via useQuery Conversion (ENH-TD-1)

Convert the three mount-only `useEffect`+`useState` data fetches to `useQuery`, removing the `eslint-disable-next-line react-hooks/exhaustive-deps` comments. Each component's existing `toast.error(t('errors.fetchFailed'))` on rejection MUST be preserved (existing behavior).

- **FR-2.1 — `src/components/instructor/assignments/StudentPicker.tsx` (eslint-disable at line 61):** Replace the `useEffect`+`useState` students fetch (`listUsers({ data: { page:1, limit:200, search:'', role:'student' } })`) with `useQuery`. Use the `userKeys.list({ page:1, limit:200, search:'', role:'student' })` factory key. Replace local `loading`/`error`/`students` state with `useQuery` return values (`isLoading`, `isError`, `data`). Preserve client-side `search` filtering state. Remove the `eslint-disable` comment and the local hardcoded error string.
- **FR-2.2 — `src/components/instructor/assignments/AssignmentWizard.tsx` (eslint-disable at line 82):** Replace the mount-only `loadStudents` `useEffect` (`listUsers`, same params as StudentPicker) with `useQuery` using `userKeys.list(...)`. Replace local `students` state with the query's `data`. **Do NOT convert the `handleSelectTemplate` on-click `getTemplate` fetch** (it is an event handler, not a mount-only effect — out of scope). Remove the `eslint-disable` comment.
- **FR-2.3 — `src/components/instructor/assignments/TemplatePicker.tsx` (eslint-disable at line 53):** Replace the mount-only `useEffect` templates fetch (`listTemplates({ data: { page:1, limit:100, search:'' } })`) with `useQuery`. Replace local `loading`/`error`/`templates` state with `useQuery` return values. Preserve client-side `search` filtering. Remove the `eslint-disable` comment and the local hardcoded error string.
- **FR-2.4 — Extend the query-key factory:** Add a `templateKeys` factory to `src/lib/query-keys.ts` (e.g., `{ all: () => ['templates'], list: (filters?) => ['templates','list', filters ?? {}] }`) and use `templateKeys.list({ page:1, limit:100, search:'' })` in TemplatePicker. The file's documented philosophy is "other features keep inline keys until touched" — templates is now being touched. Update the file header comment to reflect 6 domains.
- **FR-2.5:** Use the existing `toast.error(t('errors.fetchFailed'))` in each component's query failure path (e.g., `useQuery` `onError`/rendered error branch, or via the existing `console.error` + toast in the queryFn). The `errors.fetchFailed` key already exists in both locales — no new i18n keys for errors.

## Non-Functional Requirements

- **NFR-1 (Lint cleanliness):** Zero `eslint-disable-next-line react-hooks/exhaustive-deps` comments in `src/components/instructor/assignments/`. Zero `href="#"` in `src/routes/`.
- **NFR-2 (i18n parity):** `pnpm check:i18n` passes (EN↔ID parity). No new unused keys (`pnpm check:i18n:unused` clean) — the removed `landing.footer.links.contact` key must not remain.
- **NFR-3 (Coverage):** ≥80% on lines, statements, branches, and functions (`pnpm test:coverage`).
- **NFR-4 (No behavior change):** The useQuery conversion must preserve identical user-visible behavior — data loads on mount, loading skeletons show, and a toast fires on fetch failure. Cache deduplication between StudentPicker and AssignmentWizard (same `userKeys.list` key) is an acceptable side benefit.
- **NFR-5 (File limits):** No file exceeds 500 lines. All server-function two-file splits and import boundaries respected (no new server code introduced).

## Acceptance Criteria

- [ ] **AC-1:** Clicking "About" in the landing footer scrolls to the "How It Works" section; the "Contact" link no longer appears in the footer.
- [ ] **AC-2:** The footer copyright displays the current year via an i18n key (`landing.footer.copyright` with `{year}` interpolation) in both EN and ID.
- [ ] **AC-3:** `landing.footer.links.contact` is removed from both `locales/en.json` and `locales/id.json`; `landing.footer.copyright` is added to both.
- [ ] **AC-4:** `grep -r "eslint-disable" src/components/instructor/assignments/` returns zero matches.
- [ ] **AC-5:** `grep -r 'href="#"' src/routes/` returns zero matches.
- [ ] **AC-6:** `templateKeys` factory exists in `src/lib/query-keys.ts` and is used by TemplatePicker; `userKeys.list` is used by StudentPicker and AssignmentWizard's mount fetch.
- [ ] **AC-7:** StudentPicker, TemplatePicker, and AssignmentWizard load their data via `useQuery` (no `useEffect` data-fetch); loading skeletons and the `toast.error(t('errors.fetchFailed'))` failure path are preserved.
- [ ] **AC-8:** `AssignmentWizard.handleSelectTemplate`'s on-click `getTemplate` fetch remains an imperative call (unchanged).
- [ ] **AC-9:** `pnpm test:coverage`, `pnpm typecheck`, `pnpm lint`, `pnpm check:i18n` all pass.

## Out of Scope

- Building a dedicated `/about` or `/contact` page ("About" scrolls to an existing section instead).
- Converting any fetches beyond the 3 listed mount-only effects — including `AssignmentWizard.handleSelectTemplate`'s on-click `getTemplate` call and any other component fetches (broader React Query migration was TRACK-014's scope).
- ENH-TD-2 (invalid finding — already resolved; the 3 files already call `toast.error`).
- `console.error` instances in `.server.ts` advisory work and `seed.ts` (intentional server-side diagnostics).
- Per-user email notification preferences or any backend/server-function changes (this track is frontend-only plus i18n keys).
</protect>
