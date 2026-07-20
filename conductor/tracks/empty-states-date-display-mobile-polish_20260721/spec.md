# Track Specification: Empty States, Date Display & Mobile Polish

## Overview

TRACK-013 is a UX-enhancement track addressing empty-state gaps, relative-date context, and mobile layout polish across the SIMAK application. It resolves 8 audit findings (UX-10, UX-11, UX-12, UX-34, UX-35, UX-36, UX-43, UX-45) from the three-way audit documented in `docs/roadmap.md`.

The track eliminates `return null` patterns that hide entire UI sections when data is absent, adds locale-aware relative date context where deadlines matter most, and makes the deadline-management / template-editing / progress-review flows usable on small (375px) screens.

**Track Type:** Feature
**Dependencies:** Coordinate with TRACK-010 (i18n date fixes — both touch `formatDate` usage and locale-aware formatting). TRACK-010 is archived/complete; coordination is conflict-avoidance only.

## Context Anchors

- **PRD Reference:** `docs/PRD.md` (dashboard displays, deadline management, template editing, mobile support)
- **TDD Reference:** `docs/TDD.md` (component patterns, responsive design, date formatting utilities)
- **Audit Source:** `docs/roadmap.md` (TRACK-013 section, lines 765–821)

## Functional Requirements

### FR-1: Empty States (UX-10, UX-11, UX-12)

Replace plain text / `return null` patterns with the existing `EmptyState` component so users always see a section exists even when empty.

- **UX-10 (ConsultationList):** Replace the plain-text `<div>` with `<EmptyState icon={MessageSquare} title={t('consultations.noConsultations')} />`.
- **UX-11 (ReviewHistory):** Render the `Card` with an `<EmptyState>` inside instead of `return null`. Add i18n key `instructorReviews.noReviewsYet` (en: "No previous reviews" / id: "Belum ada ulasan sebelumnya").
- **UX-12 (ConsultationProgress):** Render the `Card` with a "No consultations required" message instead of `return null`. Add i18n key `consultations.noConsultationsRequired` (en: "No consultations required for this assignment" / id: "Tidak ada konsultasi yang diperlukan untuk tugas ini").

### FR-2: Relative Dates (UX-43, UX-45)

Add locale-aware relative date context in key places where deadline urgency matters. Uses `formatDistanceToNow` from `date-fns` (already a dependency, v4.2.1) with locale via `localeMap` in `src/lib/format.ts`.

- **UX-43 (key places only):** Append relative time in parentheses after the absolute date — e.g., "Mar 5, 2026 (in 3 days)" or "Mar 5, 2026 (3 days ago)". Applied to:
  - `CheckpointCard` due date
  - `StudentDashboard` upcoming deadlines
  - NOT applied to consultation log dates or review history dates (no deadline urgency benefit).
  - Format: `formatDistanceToNow(date, { addSuffix: true, locale: localeMap[locale] })`. No new i18n keys needed for relative text (date-fns handles locale).
- **UX-45 (SLABadge time remaining):** Add a `title` attribute to each SLA Badge variant with `formatDistanceToNow(updatedAt, { addSuffix: true, locale })` — e.g., "3 days ago" / "1 day left". Badge text (On Time / Approaching / Breached) stays unchanged; tooltip provides time context without cluttering the badge.

### FR-3: Mobile Layout Polish (UX-34, UX-35, UX-36)

Make deadline-management and progress-review flows usable on 375px viewports.

- **UX-34 (CheckpointListEditor mobile):** Change the checkpoint row from `flex items-start gap-2` to `flex flex-col sm:flex-row sm:items-start gap-2`. Column headers hidden on mobile (`hidden sm:flex`). Reorder buttons, name input, min consultations, duration, and remove button flow vertically on small screens.
- **UX-35 (AssignmentWizard step labels):** Add a `<p className="sm:hidden ...">{steps[currentStep].label}</p>` above the form content to show the current step name on mobile (replacing the hidden `hidden md:block` labels). Desktop keeps existing labels. Step numbers remain visible.
- **UX-36 (ProgressTable mobile):** Add a card-based layout for mobile (`flex sm:hidden` / `hidden sm:block` pattern). Each student becomes a card showing name, progress bar, and percentage. Desktop keeps the table layout.

## Non-Functional Requirements

- **i18n:** All new user-visible strings added to both `locales/en.json` and `locales/id.json`; run `pnpm generate:i18n`. No hardcoded UI strings (`simak-i18n/no-hardcoded` lint rule).
- **Accessibility:** Empty states use the existing `EmptyState` component (icon + title — screen-reader friendly). Mobile card layouts must remain keyboard-navigable. Relative date tooltips use `title` (acceptable for supplementary context).
- **Responsive:** Layouts verified at 375px (mobile), 768px (tablet), 1280px (desktop).
- **File limits:** No file in `src/`, `tests/`, `scripts/` exceeds 500 lines.
- **Test coverage:** ≥80% on lines, statements, branches, and functions.
- **No new dependencies:** `date-fns` already present; `EmptyState` component already exists.

## Acceptance Criteria

- [ ] AC-1: `ConsultationList` renders `<EmptyState>` with `MessageSquare` icon (not plain text) when there are no consultations.
- [ ] AC-2: `ReviewHistory` renders a `Card` with `<EmptyState>` (title `instructorReviews.noReviewsYet`) instead of `return null`.
- [ ] AC-3: `ConsultationProgress` renders a `Card` with a message (`consultations.noConsultationsRequired`) instead of `return null` when `totalRequired === 0`.
- [ ] AC-4: `CheckpointCard` due date displays absolute date + parenthesized relative time (e.g., "Mar 5, 2026 (in 3 days)") in the active locale.
- [ ] AC-5: `StudentDashboard` upcoming deadlines display absolute date + parenthesized relative time in the active locale.
- [ ] AC-6: `SLABadge` has a `title` attribute with locale-aware relative time; badge text unchanged.
- [ ] AC-7: `CheckpointListEditor` checkpoint rows stack vertically on mobile (`flex-col sm:flex-row`); usable at 375px.
- [ ] AC-8: `AssignmentWizard` shows the current step name above the form on mobile; desktop labels unchanged.
- [ ] AC-9: `ProgressTable` renders a card-based layout on mobile; desktop table unchanged.
- [ ] AC-10: 2 new i18n keys (`instructorReviews.noReviewsYet`, `consultations.noConsultationsRequired`) exist in both `en.json` and `id.json`; `pnpm check:i18n` passes.
- [ ] AC-11: No component returns `null` for an empty state (grep for `return null` in touched component files confirms none are empty-state returns).
- [ ] AC-12: `pnpm test`, `pnpm test:coverage` (≥80%), `pnpm typecheck`, `pnpm lint`, `pnpm check:i18n` all pass.

## Out of Scope

- **UX-44 (timezone display):** Dropped — all users are in Indonesia (WIB/UTC+7); timezone ambiguity is minimal for a single-timezone user base. Defer until multi-timezone support is needed.
- **UX-37 (bulk-import preview table responsive):** Left as-is — horizontal scroll is acceptable for admin-only usage.
- **Other table mobile layouts:** UserTable, FileList, ExtensionHistoryList, audit-log keep horizontal scroll (admin/instructor-only usage, acceptable).
- **i18n date fixes:** Tracked in TRACK-010 (archived/complete) — coordinate to avoid conflicts; no rework of TRACK-010 changes.
- **Notification empty states:** Tracked in TRACK-012 (archived/complete).
- **Undo functionality / new features:** Not UX fixes; deferred to future feature tracks.

## Track Tech Stack

- shadcn/ui `EmptyState` component (`src/components/ui/empty-state.tsx` — icon + title + description + compact props; already exists).
- `date-fns` `formatDistanceToNow` (v4.2.1, already a dependency; locale-aware via `localeMap` in `src/lib/format.ts`).
- Tailwind v4 responsive utilities (`flex-col`, `sm:flex-row`, `flex sm:hidden` / `hidden sm:block`).
- shadcn/ui `Card` (ProgressTable mobile card layout; ReviewHistory/ConsultationProgress Card wrappers).
- TanStack Start two-file server-function split (no server-function changes expected in this track — all client-side).
