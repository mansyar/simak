# Implementation Plan: Empty States, Date Display & Mobile Polish

## Track Metadata

- **Track ID:** empty-states-date-display-mobile-polish_20260721
- **Type:** Feature
- **Spec:** `./spec.md` (approved)
- **Audit IDs:** UX-10, UX-11, UX-12, UX-34, UX-35, UX-36, UX-43, UX-45
- **Dropped:** UX-44 (timezone), UX-37 (bulk-import preview)

## Methodology

TDD per `conductor/workflow.md`. Each task: mark `[~]` → write failing tests (Red) → implement (Green) → run quality gates → commit → attach git note → mark `[x]` with commit SHA. Coverage ≥80% on lines/stmts/branches/funcs.

---

## Phase 1: Empty States (UX-10, UX-11, UX-12)

- [ ] Task: Add empty-state i18n keys
    - [ ] Add `instructorReviews.noReviewsYet` (en: "No previous reviews" / id: "Belum ada ulasan sebelumnya") and `consultations.noConsultationsRequired` (en: "No consultations required for this assignment" / id: "Tidak ada konsultasi yang diperlukan untuk tugas ini") to both `locales/en.json` and `locales/id.json`
    - [ ] Run `pnpm generate:i18n`; verify `pnpm check:i18n` passes (parity)

- [ ] Task: ConsultationList empty state (UX-10)
    - [ ] Write failing test: `ConsultationList` renders `<EmptyState>` with `MessageSquare` icon (not a plain-text `<div>`) when there are no consultations
    - [ ] Implement: replace the plain-text `<div>` with `<EmptyState icon={MessageSquare} title={t('consultations.noConsultations')} />` (reuse existing `consultations.noConsultations` key)
    - [ ] Verify: `pnpm test` passes; component does not return `null` for empty state

- [ ] Task: ReviewHistory empty state (UX-11)
    - [ ] Write failing test: `ReviewHistory` renders a `Card` with `<EmptyState>` (title resolves to `instructorReviews.noReviewsYet`) instead of returning `null`
    - [ ] Implement: render `Card` with `<EmptyState>` inside in place of `return null`
    - [ ] Verify: `pnpm test` passes

- [ ] Task: ConsultationProgress empty state (UX-12)
    - [ ] Write failing test: `ConsultationProgress` renders a `Card` with the `consultations.noConsultationsRequired` message instead of `return null` when `totalRequired === 0`
    - [ ] Implement: render `Card` with message/`<EmptyState>` in place of `return null`
    - [ ] Verify: `pnpm test` passes

- [ ] Task: Conductor - User Manual Verification 'Phase 1: Empty States' (Protocol in workflow.md)

---

## Phase 2: Relative Dates & SLABadge (UX-43, UX-45)

- [ ] Task: Add `formatRelativeTime` helper to `src/lib/format.ts`
    - [ ] Write failing test: `formatRelativeTime(date, locale)` returns "in 3 days" (future, en) / "3 days ago" (past, en); locale-aware via `localeMap` (e.g., "dalam 3 hari" for id)
    - [ ] Implement: add `formatRelativeTime(date: Date | string, locale: 'en' | 'id' = 'en')` using `formatDistanceToNow(toDate(date), { addSuffix: true, locale: localeMap[locale] })` from `date-fns` (already a dependency, v4.2.1)
    - [ ] Verify: `pnpm test` passes

- [ ] Task: CheckpointCard relative date (UX-43)
    - [ ] Write failing test: `CheckpointCard` due date displays absolute date + parenthesized relative time (e.g., "Mar 5, 2026 (in 3 days)") in the active locale
    - [ ] Implement: append `(${formatRelativeTime(date, locale)})` to the formatted absolute date
    - [ ] Verify: `pnpm test` passes

- [ ] Task: StudentDashboard relative date (UX-43)
    - [ ] Write failing test: upcoming deadlines display absolute date + parenthesized relative time in the active locale
    - [ ] Implement: append relative time to the formatted date in the upcoming-deadlines list
    - [ ] Verify: `pnpm test` passes

- [ ] Task: SLABadge time-remaining tooltip (UX-45)
    - [ ] Write failing test: each `SLABadge` variant has a `title` attribute with locale-aware relative time (e.g., "3 days ago"); badge text (On Time / Approaching / Breached) unchanged
    - [ ] Implement: add `title={formatRelativeTime(updatedAt, locale)}` to each badge variant
    - [ ] Verify: `pnpm test` passes; no `simak-i18n/no-hardcoded` warning on the `title`

- [ ] Task: Conductor - User Manual Verification 'Phase 2: Relative Dates & SLABadge' (Protocol in workflow.md)

---

## Phase 3: Mobile Layout (UX-34, UX-35, UX-36)

- [ ] Task: CheckpointListEditor mobile stacking (UX-34)
    - [ ] Write failing test: checkpoint row uses `flex-col sm:flex-row` responsive classes; column headers use `hidden sm:flex`
    - [ ] Implement: change row from `flex items-start gap-2` → `flex flex-col sm:flex-row sm:items-start gap-2`; hide column headers on mobile (`hidden sm:flex`); reorder/remove buttons and inputs reflow vertically
    - [ ] Verify: `pnpm test` passes; usable at 375px viewport

- [ ] Task: AssignmentWizard mobile step label (UX-35)
    - [ ] Write failing test: current step name renders above form content on mobile (`sm:hidden`); desktop labels (`hidden md:block`) unchanged; step numbers remain visible
    - [ ] Implement: add `<p className="sm:hidden ...">{steps[currentStep].label}</p>` above form content
    - [ ] Verify: `pnpm test` passes

- [ ] Task: ProgressTable mobile card layout (UX-36)
    - [ ] Write failing test: mobile renders card-based layout (`flex sm:hidden`) with each student as a card (name, progress bar, percentage); desktop renders table (`hidden sm:block`)
    - [ ] Implement: add card-based mobile layout using `flex sm:hidden` / `hidden sm:block` pattern; desktop table unchanged
    - [ ] Verify: `pnpm test` passes; layout verified at 375px

- [ ] Task: Conductor - User Manual Verification 'Phase 3: Mobile Layout' (Protocol in workflow.md)

---

## Phase 4: Final Conductor Review & Quality Gates

- [ ] Task: Run full quality gate suite
    - [ ] `pnpm test` (unit tests pass)
    - [ ] `pnpm test:coverage` — ≥80% on lines, statements, branches, functions
    - [ ] `pnpm typecheck` (tsc --noEmit --incremental)
    - [ ] `pnpm lint` (oxlint . — including `simak-i18n/no-hardcoded`)
    - [ ] `pnpm check:i18n` (EN↔ID parity)
    - [ ] Verify no file in `src/`, `tests/`, `scripts/` exceeds 500 lines (`scripts/check-modularity.js`)
    - [ ] Grep verification: no `return null` empty-state patterns remain in touched component files; `formatRelativeTime` used in CheckpointCard + StudentDashboard + SLABadge; `CheckpointListEditor` uses `flex-col sm:flex-row`; `ProgressTable` has mobile card layout; `AssignmentWizard` shows step name on mobile
    - [ ] Confirm UX-44 (timezone) and UX-37 (bulk-import) are documented as dropped/out-of-scope in `spec.md`

- [ ] Task: Conductor - User Manual Verification 'Phase 4: Final Conductor Review & Quality Gates' (Protocol in workflow.md)
