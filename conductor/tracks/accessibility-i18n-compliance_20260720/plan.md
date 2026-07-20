<protect>
# Implementation Plan: Accessibility (a11y) & i18n Compliance (TRACK-010)

**Spec:** `./spec.md` | **Workflow:** `conductor/workflow.md` (TDD lifecycle + Phase Completion Verification Protocol)

**Audit IDs covered:** UX-13, UX-14, UX-15, UX-16, UX-17, UX-18, UX-19, UX-20, UX-21, UX-22, UX-23, UX-24, UX-50

---

## Phase 1: Notification Center a11y Refactor [checkpoint: 947ba9b]

- [x] Task: Read `./spec.md` and `conductor/workflow.md` before starting phase implementation
- [x] Task: Add Phase 1 i18n keys (`notifications.unreadCount`, `adminDashboard.noRecentActivityDescription`) [4d34366]
    - [ ] Add `notifications.unreadCount` (en: "{count} unread notifications", id: "{count} notifikasi belum dibaca") with `{count}` param to both `locales/en.json` and `locales/id.json`
    - [ ] Add `adminDashboard.noRecentActivityDescription` (en: "No recent activity to display", id: "Tidak ada aktivitas terbaru untuk ditampilkan") to both locale files
    - [ ] Run `pnpm generate:i18n` to regenerate `src/i18n/types.ts` and `src/i18n/detect-locale.ts`
    - [ ] Run `pnpm check:i18n` — verify key parity between EN and ID

- [x] Task: Refactor NotificationCenter to use shadcn Sheet (UX-15) [66276e8]
    - [x] Write failing tests: assert `NotificationCenter` renders `<Sheet>` / `<SheetContent side="right">`, no custom backdrop div or panel div remains, Escape key closes the panel, focus is trapped within the panel (Tab cycles inside)
    - [x] Implement: refactor `src/components/notifications/NotificationCenter.tsx` — wrap content in `<Sheet open={isOpen} onOpenChange={onClose}><SheetContent side="right">`, move header/content into `SheetHeader`/`SheetContent`, remove custom backdrop div, panel div, and manual X button (Sheet provides built-in close + focus management)
    - [x] Run `pnpm test` — confirm new tests pass
    - [x] Run `pnpm typecheck` and `pnpm lint` — no errors
    - [x] Commit: `refactor(notifications): Replace custom notification panel with shadcn Sheet (UX-15)`

- [x] Task: Convert NotificationItem to native button (UX-14) [424857d]
    - [x] Write failing tests: assert `NotificationItem` renders a `<button type="button">` with `text-left` and `w-full` classes, Tab focuses it, Enter and Space keys activate the `onClick` handler
    - [x] Implement: change `<div onClick={handleClick}>` to `<button type="button" onClick={handleClick}>` in `src/components/notifications/NotificationItem.tsx`, add `text-left w-full` to className
    - [x] Run `pnpm test` — confirm new tests pass
    - [x] Run `pnpm typecheck` and `pnpm lint` — no errors
    - [x] Commit: `fix(a11y): Convert NotificationItem to native button for keyboard access (UX-14)`

- [x] Task: Make NotificationBadge aria-label dynamic and add aria-live (UX-23, UX-50) [a69968e]
    - [x] Write failing tests: assert badge button `aria-label` includes unread count when `hasUnread` is true (uses `t('notifications.unreadCount', { count })`), shows `t('notifications.viewNotifications')` when no unread, count span no longer has `role="status"`, badge container has `aria-live="polite"`
    - [x] Implement: in `src/components/notifications/NotificationBadge.tsx`, set dynamic `aria-label` on button, remove `role="status"` from count span, add `aria-live="polite"` to badge container
    - [x] Run `pnpm test` — confirm new tests pass
    - [x] Run `pnpm typecheck` and `pnpm lint` — no errors
    - [x] Commit: `fix(a11y): Dynamic aria-label and aria-live on NotificationBadge (UX-23, UX-50)`

- [x] Task: Replace AdminDashboard hardcoded string (UX-13) [f21d2cc]
    - [x] Write failing tests: assert `AdminDashboard` renders `t('adminDashboard.noRecentActivityDescription')` as the empty-state description, no hardcoded `"No recent activity to display"` string
    - [x] Implement: replace `description="No recent activity to display"` with `description={t('adminDashboard.noRecentActivityDescription')}` in `AdminDashboard`
    - [x] Run `pnpm test` — confirm new tests pass
    - [x] Run `pnpm lint` — no `simak-i18n/no-hardcoded` warnings
    - [x] Commit: `fix(i18n): Replace hardcoded AdminDashboard string with i18n key (UX-13)`

- [x] Task: Conductor - User Manual Verification 'Notification Center a11y Refactor' (Protocol in workflow.md)

---

## Phase 2: i18n Hardcoded String & Date Formatting Fixes [checkpoint: 7cf3880]

- [x] Task: Read `./spec.md` and `conductor/workflow.md` before starting phase implementation
- [x] Task: Add Phase 2 i18n keys (`adminUsers.table.status`, `extensions.daysCount`) [5cbc7c8]
    - [x] Add `adminUsers.table.status` (en: "Status", id: "Status") to both locale files
    - [x] Add `extensions.daysCount` (en: "{count} days", id: "{count} hari") with `{count}` param to both locale files
    - [x] Run `pnpm generate:i18n`
    - [x] Run `pnpm check:i18n` — verify key parity

- [x] Task: Replace UserTable hardcoded "Status" header (UX-17) [65da9b7]
    - [x] Write failing tests: assert `UserTable` column header uses `t('adminUsers.table.status')`, no hardcoded `'Status'` string
    - [x] Implement: replace `header: 'Status'` with `header: t('adminUsers.table.status')` in `UserTable`
    - [x] Run `pnpm test` — confirm new tests pass
    - [x] Run `pnpm lint` — no `simak-i18n/no-hardcoded` warnings
    - [x] Commit: `fix(i18n): Replace hardcoded UserTable Status header with i18n key (UX-17)`

- [x] Task: Replace ExtensionHistoryList hardcoded "days" suffix (UX-18) [c1f02ca]
    - [x] Write failing tests: assert `ExtensionHistoryList` renders `t('extensions.daysCount', { count: String(item.extensionDays) })`, no hardcoded `"days"` suffix
    - [x] Implement: replace `{item.extensionDays} days` with `t('extensions.daysCount', { count: String(item.extensionDays) })` in `ExtensionHistoryList`
    - [x] Run `pnpm test` — confirm new tests pass
    - [x] Run `pnpm lint` — no `simak-i18n/no-hardcoded` warnings
    - [x] Commit: `fix(i18n): Replace hardcoded days suffix in ExtensionHistoryList (UX-18)`

- [x] Task: Replace ExtensionHistoryList toLocaleDateString with shared formatDate (UX-19) [d01c4a5]
    - [x] Write failing tests: assert component uses `formatDate` imported from `@/lib/format-date` with `locale` and `'short'` format, local `formatDate` function is removed
    - [x] Implement: remove local `formatDate` function (lines 44-51), import `formatDate` from `@/lib/format-date`, use `formatDate(item.createdAt, locale, 'short')`, obtain `locale` from `useI18n()`
    - [x] Run `pnpm test` — confirm new tests pass
    - [x] Run `pnpm typecheck` and `pnpm lint` — no errors
    - [x] Commit: `fix(i18n): Use shared formatDate in ExtensionHistoryList (UX-19)`

- [x] Task: Replace StudentDashboard and ConsultationList toLocaleDateString (UX-20) [f40c78d]
    - [x] Write failing tests: assert both `StudentDashboard` and `ConsultationList` use `formatDate(date, locale, 'short')` from `@/lib/format-date`, no `toLocaleDateString()` calls remain
    - [x] Implement: replace `new Date(date).toLocaleDateString()` with `formatDate(date, locale, 'short')` in both components, obtain `locale` from `useI18n()`
    - [x] Run `pnpm test` — confirm new tests pass
    - [x] Run `pnpm typecheck` and `pnpm lint` — no errors
    - [x] Commit: `fix(i18n): Use shared formatDate in StudentDashboard and ConsultationList (UX-20)`

- [x] Task: Conductor - User Manual Verification 'i18n Hardcoded String & Date Formatting Fixes' (Protocol in workflow.md)

---

## Phase 3: ARIA Attributes

- [x] Task: Read `./spec.md` and `conductor/workflow.md` before starting phase implementation
- [~] Task: Add aria-label to FileList download button (UX-16)
    - [ ] Write failing tests: assert download `<Button>` in `FileList` has `aria-label={t('files.download')}`
    - [ ] Implement: add `aria-label={t('files.download')}` to the download Button in `src/components/files/FileList.tsx`
    - [ ] Run `pnpm test` — confirm new tests pass
    - [ ] Run `pnpm lint` — no `simak-i18n/no-hardcoded` warnings
    - [ ] Commit: `fix(a11y): Add aria-label to FileList download button (UX-16)`

- [ ] Task: Add progressbar ARIA to ProgressTable (UX-21)
    - [ ] Write failing tests: assert progress bar container divs have `role="progressbar"`, `aria-valuenow={value}`, `aria-valuemin={0}`, `aria-valuemax={100}`, `aria-label={t('instructorAssignments.table.progress')}`
    - [ ] Implement: add ARIA attributes to progress bar container divs in `src/components/instructor/ProgressTable.tsx` (~line 78)
    - [ ] Run `pnpm test` — confirm new tests pass
    - [ ] Run `pnpm typecheck` and `pnpm lint` — no errors
    - [ ] Commit: `fix(a11y): Add progressbar ARIA attributes to ProgressTable (UX-21)`

- [ ] Task: Add progressbar ARIA to ConsultationProgress (UX-21)
    - [ ] Write failing tests: assert summary progress bar has `role="progressbar"`, `aria-valuenow={totalVerified}`, `aria-valuemin={0}`, `aria-valuemax={totalRequired}`, `aria-label={t('consultations.consultationProgress')}`; per-checkpoint bars have similar ARIA
    - [ ] Implement: add ARIA attributes to summary and per-checkpoint progress bars in `src/components/consultations/ConsultationProgress.tsx` (~line 34)
    - [ ] Run `pnpm test` — confirm new tests pass
    - [ ] Run `pnpm typecheck` and `pnpm lint` — no errors
    - [ ] Commit: `fix(a11y): Add progressbar ARIA attributes to ConsultationProgress (UX-21)`

- [ ] Task: Add aria-expanded and aria-controls to DeadlineManager (UX-22)
    - [ ] Write failing tests: assert toggle button has `aria-expanded={isExpanded}` and `aria-controls` matching the content div's `id`; expandable content div has `id={`student-${student.id}-details`}`
    - [ ] Implement: add `aria-expanded={isExpanded}` and `aria-controls={`student-${student.id}-details`}` to toggle button (~line 206), add matching `id` to expandable content div (~line 228) in `src/components/instructor/DeadlineManager.tsx`
    - [ ] Run `pnpm test` — confirm new tests pass
    - [ ] Run `pnpm typecheck` and `pnpm lint` — no errors
    - [ ] Commit: `fix(a11y): Add aria-expanded/aria-controls to DeadlineManager toggle (UX-22)`

- [ ] Task: Add aria-hidden to CheckpointTimeline decorative elements (UX-24)
    - [ ] Write failing tests: assert decorative connector line div and dot div have `aria-hidden="true"`
    - [ ] Implement: add `aria-hidden="true"` to connector line div (~line 21) and dot div (~line 24) in `src/components/student/CheckpointTimeline.tsx`
    - [ ] Run `pnpm test` — confirm new tests pass
    - [ ] Run `pnpm typecheck` and `pnpm lint` — no errors
    - [ ] Commit: `fix(a11y): Add aria-hidden to CheckpointTimeline decorative elements (UX-24)`

- [ ] Task: Conductor - User Manual Verification 'ARIA Attributes' (Protocol in workflow.md)

</protect>
