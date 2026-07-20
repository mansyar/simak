<protect>
# Track Specification: Accessibility (a11y) & i18n Compliance (TRACK-010)

## Overview

Remediate 12 UX accessibility findings (UX-13 through UX-24) plus UX-50 (moved from TRACK-012) identified in the three-way audit. The track brings the SIMAK UI closer to WCAG 2.1 AA compliance by refactoring the NotificationCenter to use the accessible shadcn `Sheet` primitive, converting non-semantic interactive elements to native `<button>`s, adding ARIA attributes to progress bars / collapsibles / icon buttons / decorative elements, and replacing hardcoded English strings and locale-unaware date formatting with i18n keys and the shared `formatDate` helper.

- **Type:** Refactor (a11y + i18n compliance)
- **Roadmap Reference:** `docs/roadmap.md` → TRACK-010 (lines 583-643)
- **Dependencies:** None
- **Estimated Effort:** 3 Days / 1.5 Sprint Loops
- **Audit IDs:** UX-13, UX-14, UX-15, UX-16, UX-17, UX-18, UX-19, UX-20, UX-21, UX-22, UX-23, UX-24, UX-50

## Context Anchors (Traceability)

- **PRD Reference:** `docs/PRD.md` (notification center, file management, user tables, progress displays)
- **TDD Reference:** `docs/TDD.md` (component patterns, shadcn/ui primitives, i18n implementation)
- **Guidelines:** `AGENTS.md` → "Custom lint rule — no hardcoded UI strings"; `conductor/workflow.md` → i18n Workflow, Responsive & Accessibility Testing

## Track Tech Stack

All prerequisites confirmed present in the codebase — no new dependencies:

- shadcn/ui `Sheet` component (`src/components/ui/sheet.tsx` — uses `@base-ui/react/dialog`; handles Escape, focus trapping, backdrop click)
- ARIA attributes (`role="progressbar"`, `aria-label`, `aria-expanded`, `aria-controls`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-hidden`, `aria-live`)
- `@/lib/format-date` (`formatDate(date, locale, 'short')` — replaces `toLocaleDateString('en-US')` and `toLocaleDateString()`)
- `locales/en.json`, `locales/id.json` (4 new i18n keys)
- `lint-plugin.js` (custom `simak-i18n/no-hardcoded` rule — existing)
- `@testing-library/react` + `@testing-library/user-event` (existing — for keyboard/ARIA assertions; no new deps)

## Functional Requirements

### FR-1: Notification Center a11y Refactor (UX-15, UX-14, UX-23, UX-50)

- **FR-1.1 (UX-15):** Refactor `NotificationCenter` (`src/components/notifications/NotificationCenter.tsx`) to use the shadcn `Sheet` component: `<Sheet open={isOpen} onOpenChange={onClose}><SheetContent side="right">...</SheetContent></Sheet>`. Remove the custom backdrop div and panel div. The Sheet's built-in close button and focus management replace the manual X button and the missing focus trap.
- **FR-1.2 (UX-14):** Convert `NotificationItem` (`src/components/notifications/NotificationItem.tsx`) from `<div onClick={handleClick}>` to `<button type="button" onClick={handleClick}>`. Add `text-left` and `w-full` to the className to maintain the current block-level layout. No `role` / `tabIndex` / `onKeyDown` needed — the native button handles Tab focus and Enter/Space activation.
- **FR-1.3 (UX-23):** Make the `NotificationBadge` button's `aria-label` dynamic: `aria-label={hasUnread ? t('notifications.unreadCount', { count: String(count) }) : t('notifications.viewNotifications')}`. Remove `role="status"` from the count span (the button's dynamic `aria-label` now conveys the count).
- **FR-1.4 (UX-50):** Add `aria-live="polite"` to the notification badge container so screen readers announce unread-count changes without stealing focus.

### FR-2: i18n Hardcoded String Fixes (UX-13, UX-17, UX-18)

- **FR-2.1 (UX-13):** Add i18n key `adminDashboard.noRecentActivityDescription` to both locales (en: "No recent activity to display", id: "Tidak ada aktivitas terbaru untuk ditampilkan"). Replace the hardcoded `description="No recent activity to display"` in `AdminDashboard` with `description={t('adminDashboard.noRecentActivityDescription')}`.
- **FR-2.2 (UX-17):** Add i18n key `adminUsers.table.status` to both locales (en: "Status", id: "Status"). Replace `header: 'Status'` in `UserTable` with `header: t('adminUsers.table.status')}`.
- **FR-2.3 (UX-18):** Add i18n key `extensions.daysCount` with `{count}` interpolation param to both locales (en: "{count} days", id: "{count} hari"). Replace `{item.extensionDays} days` in `ExtensionHistoryList` with `t('extensions.daysCount', { count: String(item.extensionDays) })}`.

### FR-3: Locale-Aware Date Formatting (UX-19, UX-20)

- **FR-3.1 (UX-19):** In `ExtensionHistoryList`, remove the local `formatDate` function (lines 44-51). Import `formatDate` from `@/lib/format-date`. Use `formatDate(item.createdAt, locale, 'short')`. Obtain `locale` from `useI18n()` (already available in the component but not currently used for dates).
- **FR-3.2 (UX-20):** In `StudentDashboard` and `ConsultationList`, replace `new Date(date).toLocaleDateString()` calls with `formatDate(date, locale, 'short')` from `@/lib/format-date`. Obtain `locale` from `useI18n()` in both components.

### FR-4: Icon Button a11y (UX-16)

- **FR-4.1 (UX-16):** Add `aria-label={t('files.download')}` to the download `<Button>` in `FileList`. The `title` attribute is a tooltip, not a reliable accessible name. Reuse the existing `files.download` i18n key.

### FR-5: Progress Bar a11y (UX-21)

- **FR-5.1 (UX-21):** In `ProgressTable.tsx` (~line 78), add `role="progressbar"`, `aria-valuenow={value}`, `aria-valuemin={0}`, `aria-valuemax={100}`, `aria-label={t('instructorAssignments.table.progress')}` to the progress bar container divs.
- **FR-5.2 (UX-21):** In `ConsultationProgress.tsx` (~line 34), add `role="progressbar"`, `aria-valuenow={totalVerified}`, `aria-valuemin={0}`, `aria-valuemax={totalRequired}`, `aria-label={t('consultations.consultationProgress')}` to the summary progress bar. Add similar ARIA to per-checkpoint bars.

### FR-6: Collapsible a11y (UX-22)

- **FR-6.1 (UX-22):** In `DeadlineManager.tsx`, add `aria-expanded={isExpanded}` and `aria-controls={`student-${student.id}-details`}` to the toggle `<button>` (~line 206). Add `id={`student-${student.id}-details`}` to the expandable content div (~line 228).

### FR-7: Decorative Element a11y (UX-24)

- **FR-7.1 (UX-24):** In `CheckpointTimeline.tsx`, add `aria-hidden="true"` to the decorative connector line div (~line 21) and the dot div (~line 24). These are purely visual — the `CheckpointCard` inside is the accessible content.

## Non-Functional Requirements

- **NFR-1 (Test coverage):** ≥80% on lines, statements, branches, and functions (enforced by `vitest.config.ts` thresholds). Maintained or improved from the current baseline.
- **NFR-2 (Quality gates):** All changes must pass `pnpm test`, `pnpm typecheck`, `pnpm lint` (including `simak-i18n/no-hardcoded`), and `pnpm check:i18n`.
- **NFR-3 (No new dependencies):** All required primitives (`Sheet`, `formatDate`, `@testing-library`) already exist. Zero additions to `package.json`.
- **NFR-4 (WCAG 2.1 AA):** Keyboard navigation (Tab/Enter/Space/Escape), focus trapping in the notification panel, ARIA presence on progress bars / collapsibles / icon buttons, screen-reader announcement of count changes.
- **NFR-5 (File limits):** No file in `src/`, `tests/`, or `scripts/` exceeds 500 lines.
- **NFR-6 (Surgical changes):** Touch only the components listed in FR-1 through FR-7. Match existing code style. Do not refactor adjacent code.

## i18n Keys (4 new)

| Key | en.json | id.json | Param |
|-----|---------|---------|-------|
| `adminDashboard.noRecentActivityDescription` | No recent activity to display | Tidak ada aktivitas terbaru untuk ditampilkan | — |
| `adminUsers.table.status` | Status | Status | — |
| `extensions.daysCount` | {count} days | {count} hari | `{count}` |
| `notifications.unreadCount` | {count} unread notifications | {count} notifikasi belum dibaca | `{count}` |

After adding keys: run `pnpm generate:i18n` → validate with `pnpm check:i18n`.

## Acceptance Criteria

- **AC-1:** `NotificationCenter` renders using `<Sheet>` / `<SheetContent side="right">` — no custom backdrop div or panel div remains (UX-15).
- **AC-2:** `NotificationItem` renders a native `<button type="button">` with `text-left w-full` — Tab focuses it, Enter/Space activates it (UX-14).
- **AC-3:** `NotificationBadge` button `aria-label` includes the unread count when `hasUnread` is true (UX-23). The count span no longer has `role="status"`.
- **AC-4:** The notification badge container has `aria-live="polite"` (UX-50).
- **AC-5:** `AdminDashboard` uses `t('adminDashboard.noRecentActivityDescription')` — no hardcoded `"No recent activity to display"` (UX-13).
- **AC-6:** `UserTable` uses `t('adminUsers.table.status')` — no hardcoded `'Status'` header (UX-17).
- **AC-7:** `ExtensionHistoryList` uses `t('extensions.daysCount', { count })` — no hardcoded `"days"` suffix (UX-18).
- **AC-8:** `ExtensionHistoryList`, `StudentDashboard`, and `ConsultationList` use `formatDate(date, locale, 'short')` — no `toLocaleDateString('en-US')` or `toLocaleDateString()` calls remain (UX-19, UX-20).
- **AC-9:** `FileList` download button has `aria-label={t('files.download')}` (UX-16).
- **AC-10:** `ProgressTable` and `ConsultationProgress` progress bars have `role="progressbar"`, `aria-valuenow`, `aria-valuemin={0}`, `aria-valuemax`, and `aria-label` (UX-21).
- **AC-11:** `DeadlineManager` toggle button has `aria-expanded` and `aria-controls`; the expandable content div has the matching `id` (UX-22).
- **AC-12:** `CheckpointTimeline` decorative connector line and dot divs have `aria-hidden="true"` (UX-24).
- **AC-13:** `pnpm check:i18n` passes — 4 new keys exist in both `en.json` and `id.json`.
- **AC-14:** `pnpm lint` passes — no `simak-i18n/no-hardcoded` warnings in the touched files.
- **AC-15:** `pnpm test:coverage` meets thresholds (≥80% lines/statements/branches/functions).
- **AC-16:** Unit tests verify: keyboard interaction in `NotificationCenter` (Escape closes, Tab traps within panel via Sheet), `NotificationItem` is a `<button>` (focusable, Enter/Space activates), ARIA attribute presence on progress bars / collapsible / icon button, i18n key usage (no hardcoded strings in touched files).

## Out of Scope

- Notification navigation links (TRACK-012)
- Search input debounce (TRACK-011)
- Mobile layout changes (TRACK-013)
- Form validation a11y (TRACK-011)
- File upload progress percentage (TRACK-013)
- Adding `jest-axe` or any new a11y-testing dependency
- Refactoring components not listed in FR-1 through FR-7
- Pre-existing a11y issues outside the 12 audit IDs

## High-Level Execution Vectors (from roadmap)

- **Phase 1 (Notification Refactor):** Refactor `NotificationCenter` to `<Sheet>`/`<SheetContent side="right">`. Convert `NotificationItem` to `<button>`. Make `NotificationBadge` `aria-label` dynamic. Add `aria-live="polite"`. Add 2 new i18n keys (`notifications.unreadCount`, `adminDashboard.noRecentActivityDescription`). Run `pnpm generate:i18n`. Write tests for keyboard navigation.
- **Phase 2 (i18n Fixes):** Add remaining 2 i18n keys (`adminUsers.table.status`, `extensions.daysCount`). Run `pnpm generate:i18n`. Replace hardcoded strings. Replace `toLocaleDateString` calls with `formatDate`. Run `pnpm check:i18n` and `pnpm lint`.
- **Phase 3 (ARIA Attributes):** Add `aria-label` to `FileList` download button. Add `role="progressbar"` + ARIA to `ProgressTable` and `ConsultationProgress`. Add `aria-expanded` + `aria-controls` to `DeadlineManager`. Add `aria-hidden` to `CheckpointTimeline`. Write tests for ARIA presence.
</protect>
