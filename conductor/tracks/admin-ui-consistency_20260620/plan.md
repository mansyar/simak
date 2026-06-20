<protect>
# Admin UI Consistency — Implementation Plan

**Track ID:** `admin-ui-consistency_20260620`
**Type:** refactor
**Spec:** [./spec.md](./spec.md)
**Workflow:** TDD per `conductor/workflow.md`. Every task follows Red → Green → Refactor → Commit.
**Status markers:** `[ ]` not started · `[~]` in progress · `[x]` complete (with short SHA)

---

## Phase 1 — Foundation: new primitives, i18n keys, date helper, role config [checkpoint: 86e0cb5]

Goal: establish the building blocks that every later phase depends on. No behavior change in this phase — only additions and one shared config.

- [x] Task: Read track context (spec.md and workflow.md)
    - [x] Read `conductor/tracks/admin-ui-consistency_20260620/spec.md` to confirm scope and acceptance criteria
    - [x] Read `conductor/workflow.md` to confirm TDD protocol, commit format, and phase-completion checkpoint procedure
    - [x] Confirm understanding before starting any task in this phase

- [x] Task: Add missing i18n keys to `locales/en.json` and `locales/id.json` (FR-22.1, FR-22.3)
    - [ ] Add `adminUsers.table.emailVerified` (en + id) — used by UserTable (fixes B7)
    - [ ] Add `adminTemplates.detail.saveError` for the failed-save message (fixes B9)
    - [ ] Add `adminTemplates.studentsCount` (or `{count} students` shape) for the linked-assignment line (fixes B11)
    - [ ] Add `adminDashboard.allOnTrack` for the "All assignments are on track" empty description (fixes part of B12)
    - [ ] Add `common.deleteConfirmationWord` = `DELETE` (en) / Indonesian equivalent (id) — used by DeleteTemplateDialog typed-DELETE check (fixes B10)
    - [ ] Add `adminUsers.setupLink` and confirm `adminUsers.linkCopied` exists for the setup-link Sheet
    - [ ] Run `pnpm generate:i18n` to refresh generated types
    - [ ] Verify: `pnpm typecheck` passes
    - [ ] Commit: `chore(i18n): add admin audit-related i18n keys`

- [x] Task: Extract `src/components/ui/alert-banner.tsx` (FR-11.1)
    - [ ] Write failing test `tests/unit/components/ui/alert-banner.test.tsx` covering: renders each variant (success/error/info/warning), uses design tokens, accepts `title` + optional `description`, accepts `children`
    - [ ] Implement `AlertBanner` with `variant: 'success' | 'error' | 'info' | 'warning'` mapped to design tokens
    - [ ] Verify: test passes; no design-token regression (success uses `bg-success/10 text-success`, etc.)
    - [ ] Commit: `feat(ui): add AlertBanner primitive`

- [x] Task: Extract `src/components/ui/quick-action-card.tsx` (FR-12.1)
    - [ ] Write failing test covering: renders icon, label, description, link target; hover effect
    - [ ] Implement `<QuickActionCard icon label description to />` matching the existing AdminDashboard markup
    - [ ] Verify: test passes
    - [ ] Commit: `feat(ui): add QuickActionCard primitive`

- [x] Task: Extract `src/components/ui/email-queue-stat.tsx` (FR-13.1)
    - [ ] Write failing test covering: renders icon, color, label, value
    - [ ] Implement `<EmailQueueStat icon color label value />` with the 3 bubble variants
    - [ ] Verify: test passes
    - [ ] Commit: `feat(ui): add EmailQueueStat primitive`

- [x] Task: Extract `src/components/ui/list-row.tsx` (FR-15.1)
    - [ ] Write failing test covering: renders left content, optional right content, optional onClick
    - [ ] Implement `<ListRow left right? onClick? />` with the `flex items-center justify-between rounded-md border p-3 text-sm hover:bg-accent` baseline
    - [ ] Verify: test passes
    - [ ] Commit: `feat(ui): add ListRow primitive`

- [x] Task: Add `src/lib/admin/roles.ts` config module (FR-16.1)
    - [ ] Write failing test `tests/unit/lib/admin/roles.test.ts` covering: `ROLES` array contains all 4 roles, each role has `value`, `labelKey`, `badgeVariant`
    - [ ] Implement `ROLES: ReadonlyArray<{ value, labelKey, badgeVariant }>` typed against `TranslationKey` (no more `as` casts)
    - [ ] Add helper `getRoleConfig(value: string)` returning the typed role
    - [ ] Verify: test passes
    - [ ] Commit: `feat(admin): add roles config module`

- [x] Task: Add `src/lib/format-date.ts` helper (FR-21.1)
    - [ ] Write failing test covering: locale-aware short / long / time styles; handles `Date | string | null`
    - [ ] Implement `formatDate(date, locale, style)` using `date-fns` (or `Intl.DateTimeFormat` — pick one and document)
    - [ ] Verify: test passes
    - [ ] Commit: `feat(lib): add locale-aware formatDate helper`

- [x] Task: Conductor - User Manual Verification 'Phase 1 — Foundation' (Protocol in workflow.md)
    - [x] Run pre-push gate: `pnpm typecheck && pnpm vitest run --coverage`
    - [x] Manually verify: the 5 new primitives render correctly in a scratch `tests/integration/admin-phase1-smoke.test.tsx` page (or a Storybook-like render); `ROLES` config is consumable; `formatDate` produces locale-aware output for `id` and `en`
    - [x] Create checkpoint commit, attach git note, update plan with checkpoint SHA

---

## Phase 2 — Page header, refresh, back link, skeleton, empty state adoptions

Goal: the highest-leverage UX changes — every admin page uses the shared header / refresh / back / skeleton / empty-state primitives.

- [x] Task: Read track context (spec.md and workflow.md) `042bdbc`
    - [x] Read `conductor/tracks/admin-ui-consistency_20260620/spec.md` to confirm scope and acceptance criteria
    - [x] Read `conductor/workflow.md` to confirm TDD protocol, commit format, and phase-completion checkpoint procedure
    - [x] Confirm understanding before starting any task in this phase

- [x] Task: Adopt `<PageHeader>` in `admin/dashboard.tsx` (FR-1.1) `e2e6fc1`
    - [x] Write failing test `tests/unit/routes/admin-dashboard.test.tsx` covering: page title from `t('adminDashboard.title')`, subtitle from `t('adminDashboard.subtitle')`
    - [x] Replace inline header with `<PageHeader title={t('adminDashboard.title')} subtitle={t('adminDashboard.subtitle')} />`
    - [x] Verify: test passes; visual scale matches instructor dashboard
    - [x] Commit: `refactor(admin): adopt PageHeader on admin dashboard`

- [x] Task: Adopt `<PageHeader>` in `admin/settings.tsx` (FR-1.1) `860569a`
    - [x] Write failing test covering: page title from `t('settings.title')`
    - [x] Replace inline header; settings title is shared across roles — confirm no role-specific subtitle
    - [x] Verify: test passes
    - [x] Commit: `refactor(admin): adopt PageHeader on admin settings`

- [x] Task: Adopt `<PageHeader>` + `<RefreshButton>` in `admin/audit-log.tsx` (FR-1.1, FR-2.1, FR-2.2, FR-2.3) `afce208`
    - [x] Write failing test covering: page title, subtitle, refresh button calls `router.invalidate` (no `setTimeout`)
    - [x] Replace inline header with `<PageHeader title={...} subtitle={...} action={<RefreshButton isRefreshing onClick={handleRefresh} />} />`
    - [x] Replace inline refresh `<Button variant="outline" size="sm">` with `<RefreshButton>` (icon-only; shared primitive standard)
    - [x] Verify: test passes; no `setTimeout` in the file
    - [x] Commit: `refactor(admin): adopt PageHeader and RefreshButton on audit log`

- [x] Task: Adopt `<PageHeader>` + `<RefreshButton>` in `admin/users/index.tsx` (FR-1.1, FR-2.1, FR-2.2, FR-2.3) — fixes B5 [eaa855a]
    - [x] Write failing test covering: page title, subtitle, refresh button uses `router.invalidate` not `setTimeout`
    - [x] Replace inline header with `<PageHeader>`; replace inline refresh with `<RefreshButton>` (and fix the fake delay)
    - [x] Verify: test passes; no `setTimeout` in the file
    - [x] Commit: `refactor(admin): adopt PageHeader and RefreshButton on users list (B5)`

- [x] Task: Adopt `<PageHeader>` + `<RefreshButton>` in `admin/templates/index.tsx` (FR-1.1, FR-2.1, FR-2.2, FR-2.3) — fixes B5 [713df2c]
    - [x] Write failing test covering: page title, subtitle, refresh uses `router.invalidate`
    - [x] Replace inline header; replace inline refresh; remove `setTimeout`
    - [x] Verify: test passes
    - [x] Commit: `refactor(admin): adopt PageHeader and RefreshButton on templates list (B5)`

- [x] Task: Adopt `<BackLink>` in `TemplateDetailPage.tsx` (FR-3.1, FR-3.2) [commit: bcc6b51]
    - [x] Write failing test covering: back link points to `/admin/templates` with the correct search params
    - [x] Replace inline `<Link className="inline-flex items-center gap-1.5 ...">` with `<BackLink to="/admin/templates" label={t('adminTemplates.detail.back')} search={{ page: 1, limit: 20, search: '', type: '' }} />`
    - [x] Verify: test passes
    - [x] Commit: `refactor(admin): adopt BackLink in template detail`

- [x] Task: Adopt `<BackLink>` in `TemplateNotFound.tsx` (FR-3.1) — commit `658bd3b`
    - [x] Write failing test covering: not-found page shows the back link
    - [x] Replace inline `<Link to="..."><Button variant="outline">` with `<BackLink>`
    - [x] Verify: test passes
    - [x] Commit: `refactor(admin): adopt BackLink in template not-found`

- [x] Task: Adopt `<Skeleton>` in `TemplateLoadingSkeleton.tsx` (FR-4.1, FR-4.2) — commit `715f605`
    - [x] Write failing test covering: 6 cards render with skeleton placeholders
    - [x] Replace 3 hand-rolled `bg-muted animate-pulse` divs per card with `<Skeleton className="h-X w-Y" />`
    - [x] Verify: test passes; `bg-muted animate-pulse` is gone from the file
    - [x] Commit: `refactor(admin): adopt Skeleton in templates list skeleton`

- [x] Task: Adopt `<Skeleton>` in `TemplateDetailSkeleton.tsx` (FR-4.1, FR-4.2) — commit `3363382`
    - [x] Write failing test covering: back/metadata/checkpoint skeletons render
    - [x] Replace 18 hand-rolled divs with `<Skeleton>`
    - [x] Verify: test passes; `bg-muted animate-pulse` is gone from the file
    - [x] Commit: `refactor(admin): adopt Skeleton in template detail skeleton`

- [x] Task: Adopt `<Skeleton>` in `TemplateDetailPage.tsx` inline loading (FR-4.1, FR-4.2) — commit `598cd80`
    - [x] Write failing test covering: linked-assignments loading state uses Skeleton
    - [x] Replace 2 inline `<div className="h-10 rounded bg-muted animate-pulse" />` with `<Skeleton className="h-10" />`
    - [x] Verify: test passes
    - [x] Commit: `refactor(admin): adopt Skeleton for inline loading state`

- [x] Task: Adopt `<EmptyState>` in `TemplateNotFound.tsx` (FR-5.1, FR-5.2) — commit `1b7fba5`
    - [x] Write failing test covering: not-found uses EmptyState with the right icon + title
    - [x] Replace hand-rolled div + icon + h2 + p with `<EmptyState icon={SearchX} title={t('error.notFound')} description={t('error.templateNotFound')} children={<Link><Button>{t('adminTemplates.detail.back')}</Button></Link>} />`
    - [x] Verify: test passes
    - [x] Commit: `refactor(admin): adopt EmptyState in template not-found`

- [x] Task: Adopt `<EmptyState>` for dashboard error state (FR-5.1, FR-5.2) — fixes B12 partially — commit `eb11e76`
    - [x] Write failing test covering: dashboard error uses EmptyState
    - [x] Replace `<div className="flex items-center justify-center py-12" aria-live="polite">` with `<EmptyState icon={AlertCircle} title={t('common.error')} />`
    - [x] Verify: test passes
    - [x] Commit: `refactor(admin): adopt EmptyState for dashboard error state`

- [x] Task: Conductor - User Manual Verification 'Phase 2 — Header & navigation consistency' (Protocol in workflow.md) — checkpoint: `12a3060`
    - [x] Run pre-push gate (typecheck ✅, tests ✅ 2000 pass, coverage ✅ all thresholds met)
    - [x] Manually verify: navigate to /admin/dashboard, /admin/users, /admin/templates, /admin/templates/123, /admin/audit-log, /admin/settings; confirm the page header scale is uniform, refresh button works (no fake delay), back link is present where expected, skeletons render during loading, not-found uses the empty-state card
    - [x] Create checkpoint commit, attach git note, update plan with checkpoint SHA

---

## Phase 3 — Pagination, Select, Card, hardcoded colors

Goal: the remaining UX adoptions and the visual-style fixes (Card wrapping, design tokens).

- [x] Task: Read track context (spec.md and workflow.md)
    - [x] Read `conductor/tracks/admin-ui-consistency_20260620/spec.md` to confirm scope and acceptance criteria
    - [x] Read `conductor/workflow.md` to confirm TDD protocol, commit format, and phase-completion checkpoint procedure
    - [x] Confirm understanding before starting any task in this phase

- [x] Task: Extend `<Pagination>` primitive with `showPageNumbers` and `showCounter` props (FR-6.1) — commit `04e7ff9`
    - [x] Write failing test covering: default (prev/next only), `showPageNumbers` (up to 5), `showCounter` ("Page X of Y")
    - [x] Extend the existing component
    - [x] Verify: existing tests still pass
    - [x] Commit: `feat(ui): extend Pagination with page numbers and counter`

- [x] Task: Adopt extended `<Pagination>` in `admin/users/index.tsx` (FR-6.2, FR-6.3) — commit `4a7f9e9`
    - [x] Write failing test covering: prev/next buttons use `common.back` / `common.next`; "Showing X of Y" counter
    - [x] Replace hand-rolled pagination with `<Pagination currentPage totalPages onPageChange showCounter />`
    - [x] Verify: test passes
    - [x] Commit: `refactor(admin): adopt Pagination primitive on users list`

- [x] Task: Adopt extended `<Pagination>` in `admin/audit-log.tsx` (FR-6.2, FR-6.3) — commit `80b64d1`
    - [x] Write failing test covering: prev/next, page numbers (up to 5), counter; all use design tokens
    - [x] Replace hand-rolled pagination
    - [x] Verify: test passes
    - [x] Commit: `refactor(admin): adopt Pagination primitive on audit log`

- [x] Task: Adopt `<Select>` in `admin/audit-log.tsx` action filter (FR-7.1) — commit `d634b78`
    - [x] Write failing test covering: action filter uses `Select` with the action list
    - [x] Replace raw `<select>` with `Select`/`SelectTrigger`/`SelectContent`/`SelectItem`
    - [x] Verify: test passes
    - [x] Commit: `refactor(admin): adopt Select primitive in audit log filter`

- [x] Task: Fix `data-slot="select-value"` workaround (FR-7.2) — commit `f0a1046`
    - [x] Write failing test covering: `Select` renders the selected value without the `data-slot` workaround
    - [x] Investigate the `Select` primitive; ensure `SelectValue` renders automatically
    - [x] Remove the `<span data-slot="select-value">` workaround in `UserFilters.tsx:39`, `TemplateFilters.tsx:37`, `CreateUserDialog.tsx:96`
    - [x] Verify: existing tests pass; the workaround is gone
    - [x] Commit: `refactor(ui): fix Select.Value workaround in admin filters`

- [x] Task: Unify search input padding (FR-8.1) — commit `a57fccf`
    - [x] Change `audit-log.tsx:158` from `pl-8` to `pl-9`
    - [x] Verify: all admin search inputs use `pl-9`
    - [x] Commit: `style(admin): unify search input padding to pl-9`

- [x] Task: Adopt `<Card>` in `audit-log.tsx` table wrapper (FR-10.1) — commit `c8d2424`
    - [x] Write failing test covering: the audit-log table is wrapped in a Card
    - [x] Replace `<div className="rounded-lg border bg-card">` with `<Card><CardContent className="p-0">`
    - [x] Verify: test passes
    - [x] Commit: `refactor(admin): wrap audit log table in Card`

- [x] Task: Adopt `<TemplateTypeBadge>` in `TemplateCard.tsx` (FR-14.1, B1) — commit `32ca544`
    - [x] Write failing test covering: template card uses `TemplateTypeBadge`
    - [x] Replace `<Badge variant="secondary">{template.type}</Badge>` with `<TemplateTypeBadge type={template.type} />`
    - [x] Verify: test passes; the visual treatment matches instructor AssignmentCard
    - [x] Commit: `refactor(admin): adopt TemplateTypeBadge in template card (B1)`

- [x] Task: Adopt `<QuickActionCard>` in `AdminDashboard.tsx` (FR-10.2, FR-12.2) — commit `4117cbb`
    - [x] Write failing test covering: two quick-action cards render (Manage Users, Manage Templates)
    - [x] Replace the 2 hand-rolled link blocks
    - [x] Verify: test passes
    - [x] Commit: `refactor(admin): adopt QuickActionCard in dashboard`

- [x] Task: Adopt `<EmailQueueStat>` in `AdminDashboard.tsx` (FR-10.3, FR-13.2) — commit `4883c84`
    - [x] Write failing test covering: 3 email-queue stats (pending, sent, failed)
    - [x] Replace the 3 hand-rolled bubble blocks
    - [x] Verify: test passes
    - [x] Commit: `refactor(admin): adopt EmailQueueStat in dashboard`

- [x] Task: Replace hardcoded colors in `TemplateDetailPage.tsx` (FR-23.1, FR-23.2) — commit `ebc1ca6`
    - [x] Replace `text-amber-500` AlertTriangle with `text-warning` (line 247)
    - [x] Use `<AlertBanner variant="success">` for the success banner (line 191); this is also Phase 4 prep
    - [x] Verify: visual check; design tokens in use
    - [x] Commit: `style(admin): replace hardcoded colors with design tokens in template detail`

- [x] Task: Replace hardcoded colors in `AdminDashboard.tsx` (FR-23.3) — commit `04f2ae4`
    - [x] Replace `bg-error text-white` (line 184) with `bg-error text-foreground` design-token pair
    - [x] Verify: visual check
    - [x] Commit: `style(admin): replace hardcoded colors with design tokens in dashboard`

- [x] Task: Conductor - User Manual Verification 'Phase 3 — Pagination, Select, Card' (Protocol in workflow.md) — checkpoint `c496867`
    - [x] Run pre-push gate (typecheck ✅, tests ✅ 2023/2023 pass)
    - [x] Manually verify: audit-log pagination shows page numbers + counter; users list shows counter; action filter opens as a proper dropdown; template cards show the uppercase primary-color badge; dashboard quick-action cards and email-queue stats look unified
    - [x] Create checkpoint commit, attach git note, update plan with checkpoint SHA

---

## Phase 4 — Native dialogs replaced, type filter fixed, role config adopted, audit event colors unified, form labels fixed

Goal: kill the remaining inline-style code, fix the UI-level bugs, dedupe role config.

- [ ] Task: Read track context (spec.md and workflow.md)
    - [ ] Read `conductor/tracks/admin-ui-consistency_20260620/spec.md` to confirm scope and acceptance criteria
    - [ ] Read `conductor/workflow.md` to confirm TDD protocol, commit format, and phase-completion checkpoint procedure
    - [ ] Confirm understanding before starting any task in this phase

- [x] Task: Adopt `ROLES` config in `UserTable.tsx`, `UserFilters.tsx`, `CreateUserDialog.tsx` (FR-16.2, FR-16.3) — commit `5e0d203`
    - [x] Write failing test covering: each component looks up role label and variant from the central `ROLES` config (no inline maps)
    - [x] Replace inline `roleVariants` and `roleLabels` maps with `ROLES` lookups
    - [x] Remove the `as TranslationKey` casts (`UserTable:91`, `UserFilters:41, 48`, `CreateUserDialog:98`)
    - [x] Move `roleVariants` allocation out of the cell renderer (small perf win)
    - [x] Verify: tests pass; no `as TranslationKey` remains in admin user-management
    - [x] Commit: `refactor(admin): dedupe role config via ROLES module`

- [x] Task: Unify audit-event color helper (FR-17.1, FR-17.2, FR-17.3) — commit `09eeeb2`
    - [x] Add `getActionVisualProps(type)` to `src/lib/admin/audit-actions.ts` (the new module from Phase 4 below) — returns `{ dotVariant, badgeVariant, color }`
    - [x] Write failing test covering: returns the right combo for "created", "passed", "verified", "updated", "extended", "deleted", "rejected", "revised"
    - [x] Replace `getActivityDotColor` in `AdminDashboard.tsx` and `getActionBadgeVariant` in `audit-log.tsx` with the unified helper
    - [x] Verify: tests pass; the dashboard recent-activity dot color matches the audit-log badge color for the same event
    - [x] Commit: `refactor(admin): unify audit event color helper`

- [x] Task: Source-of-truth `ACTION_TYPES` (FR-18.1, FR-18.2, FR-18.3) — commit `0f7952d`
    - [x] Move `ACTION_TYPES` to `src/lib/admin/audit-actions.ts`
    - [x] Add the missing `extensionApproved` and `extensionRejected` entries (closing the gap with the locale file)
    - [x] Import from the central module in `audit-log.tsx`
    - [x] Write failing test covering: all 14 action labels are present and reachable
    - [x] Verify: test passes; the const matches the locale keys
    - [x] Commit: `refactor(admin): source-of-truth ACTION_TYPES in audit-actions module`

- [x] Task: Replace raw `<label>` in `TemplateDetailPage.tsx` with `<Label>` (FR-19.1) — commit `644879e`
    - [x] Write failing test covering: metadata inputs are labeled with `<Label>` (htmlFor association)
    - [x] Replace raw `<label>` elements (lines 211-213, 222-224) with `<Label htmlFor={...}>` (or wrap in `FormField`)
    - [x] Verify: test passes; a11y lint passes
    - [x] Commit: `a11y(admin): use Label primitive in template detail metadata`

- [x] Task: Replace raw move buttons in `CheckpointListEditor.tsx` (FR-20.1) — commit `d1b3d08`
    - [x] Write failing test covering: move-up / move-down use `Button` variant ghost size icon-xs
    - [x] Replace raw `<button>` elements (lines 63-80)
    - [x] Verify: test passes
    - [x] Commit: `refactor(admin): use Button primitive for checkpoint move buttons`

- [x] Task: Use `<Label>` for typed-DELETE input in `DeleteTemplateDialog.tsx` (FR-29.1) — commit `a2be4bd`
    - [x] Write failing test covering: the input has an accessible label
    - [x] Add `<Label>` (or `aria-label`) to the input
    - [x] Verify: test passes
    - [x] Commit: `a11y(admin): label the typed-DELETE input`

- [x] Task: Conductor - User Manual Verification 'Phase 4 — Inline code, role config, bug fixes' (Protocol in workflow.md) — checkpoint: `56c42dd`
    - [x] Run pre-push gate (typecheck ✅, tests ✅ 2042/2042 pass)
    - [x] Manually verify: role labels render in the user table, filters, and create dialog; the recent-activity dot color on the dashboard matches the audit-log badge color; template detail metadata inputs have proper labels; checkpoint move buttons look consistent with the X button
    - [x] Create checkpoint commit, attach git note, update plan with checkpoint SHA

---

## Phase 5 — Native dialogs replaced in users page, type-filter fix, i18n adoption

Goal: replace `window.confirm` / `window.alert` with proper `Dialog` / `Sheet`; fix the type-filter server contract; complete i18n adoption.

- [x] Task: Read track context (spec.md and workflow.md)
    - [x] Read `conductor/tracks/admin-ui-consistency_20260620/spec.md` to confirm scope and acceptance criteria
    - [x] Read `conductor/workflow.md` to confirm TDD protocol, commit format, and phase-completion checkpoint procedure
    - [x] Confirm understanding before starting any task in this phase

- [x] Task: Create `<DeleteUserDialog>` in `src/components/admin/users/` (FR-9.1) — fixes B2 — commit `d0b3a3d`
    - [x] Write failing test covering: dialog shows the user name, requires confirmation
    - [x] Implement the dialog mirroring `DeleteTemplateDialog` (no typed-DELETE for users — they're not blocking other users)
    - [x] Verify: test passes
    - [x] Commit: `feat(admin): add DeleteUserDialog`

- [x] Task: Create `<SetupLinkSheet>` in `src/components/admin/users/` (FR-9.3, FR-26.1, FR-26.2) — fixes B3 — commit `c8e958c`
    - [x] Write failing test covering: the sheet renders the URL, the copy button shows `t('adminUsers.linkCopied')` feedback
    - [x] Implement the sheet with a copy-to-clipboard button
    - [x] Verify: test passes
    - [x] Commit: `feat(admin): add SetupLinkSheet for password setup links (B3)`

- [x] Task: Refactor `users/index.tsx` to use `DeleteUserDialog` and `SetupLinkSheet` (FR-9.1, FR-9.3) — fixes B2, B3, B4 — commit `ad3ab9a`
    - [x] Write failing test covering: delete uses `DeleteUserDialog`; setup-link uses `SetupLinkSheet`; create/update errors are surfaced inline
    - [x] Replace `confirm(...)` with `DeleteUserDialog` open/close
    - [x] Replace `alert(\`Setup Link: ${url}\`)` with `SetupLinkSheet` open/close
    - [x] Replace `alert(\`Error: ${err}\`)` calls with inline error UI
    - [x] Verify: tests pass; no `window.confirm` / `window.alert` in the file
    - [x] Commit: `refactor(admin): replace native dialogs in users page (B2, B3, B4)`

- [ ] Task: Update `listTemplates` server function to return all types (FR-27.1) — fixes B6
    - [ ] Write failing test (in `tests/unit/server/templates.test.ts`) covering: server returns `{ templates, total, allTypes }`
    - [ ] Modify the server function to return the full distinct type list
    - [ ] Verify: test passes
    - [ ] Commit: `fix(server): listTemplates returns full type list (B6)`

- [ ] Task: Adopt the type list in `admin/templates/index.tsx` (FR-27.2, FR-27.3)
    - [ ] Write failing test covering: the route loader returns the full type list; `TemplateFilters` shows all types
    - [ ] Update the loader to pass `allTypes` to `TemplateFilters`
    - [ ] Remove the in-page `const allTypes = [...new Set(templates.map(t => t.type))]` (line 138)
    - [ ] Verify: test passes
    - [ ] Commit: `fix(admin): type filter shows all template types (B6)`

- [ ] Task: Adopt i18n for hardcoded strings (FR-22.4) — fixes B7, B9, B11
    - [ ] `UserTable.tsx:98` — use `t('adminUsers.table.emailVerified')` (B7)
    - [ ] `TemplateDetailPage.tsx:157` — use `t('adminTemplates.detail.saveError')` (B9)
    - [ ] `TemplateDetailPage.tsx:313` — use `t('adminTemplates.studentsCount', { count })` (B11)
    - [ ] `AdminDashboard.tsx:184` — use `t('adminDashboard.allOnTrack')` (B12 part 1)
    - [ ] `AdminDashboard.tsx:238` — use a new i18n key (or fall through) (B12 part 2)
    - [ ] `DeleteTemplateDialog.tsx:32` — use `t('common.deleteConfirmationWord')` (B10)
    - [ ] Verify: tests pass; `pnpm generate:i18n` and `pnpm typecheck` pass
    - [ ] Commit: `i18n(admin): adopt i18n for previously hardcoded strings (B7, B9, B10, B11, B12)`

- [ ] Task: Use `formatDate` in admin components (FR-21.2, FR-21.3, FR-21.4)
    - [ ] `UserTable.tsx`, `TemplateCard.tsx`, `TemplateDetailPage.tsx` (×2), `AdminDashboard.tsx`, `audit-log.tsx` — replace date-fns / `toLocaleDateString` with the helper
    - [ ] Verify: tests pass; `AdminDashboard.tsx:254` no longer uses `toLocaleDateString`
    - [ ] Commit: `refactor(admin): use formatDate helper consistently`

- [ ] Task: Conductor - User Manual Verification 'Phase 5 — Native dialogs, type filter, i18n' (Protocol in workflow.md)
    - [ ] Run pre-push gate
    - [ ] Manually verify: deleting a user shows a proper dialog; generating a setup link opens a sheet with a copy button; create/update errors are inline; the type filter on /admin/templates shows all types (try paging + filter); all hardcoded English strings are gone
    - [ ] Create checkpoint commit, attach git note, update plan with checkpoint SHA

---

## Phase 6 — TemplateDetailPage restructure, TypeScript types, CountBadge, a11y polish, final gate

Goal: the deep structural refactor; the type-system cleanup; the final accessibility passes; pre-push gate.

- [ ] Task: Read track context (spec.md and workflow.md)
    - [ ] Read `conductor/tracks/admin-ui-consistency_20260620/spec.md` to confirm scope and acceptance criteria
    - [ ] Read `conductor/workflow.md` to confirm TDD protocol, commit format, and phase-completion checkpoint procedure
    - [ ] Confirm understanding before starting any task in this phase

- [ ] Task: Migrate `listTemplateAssignments` to the route loader (FR-25.2) — fixes B8
    - [ ] Write failing test covering: the route loader returns `{ template, assignments }`
    - [ ] Update the loader at `routes/_authenticated/admin/templates/$templateId.tsx` to call `listTemplateAssignments` and return both
    - [ ] Remove the `useEffect` in `TemplateDetailPage` (lines 67-84)
    - [ ] Verify: tests pass; no `useEffect`-based fetch
    - [ ] Commit: `refactor(admin): move linked-assignments fetch to route loader (B8)`

- [ ] Task: Split `TemplateDetailPage.tsx` into subcomponents (FR-25.1, FR-25.3, FR-25.4)
    - [ ] Write failing tests for each subcomponent (`TemplateMetadata`, `TemplateCheckpointSection`, `TemplateLinkedAssignments`, `TemplateDangerZone`)
    - [ ] Move each card into its own file under `src/components/admin/templates/`
    - [ ] The route uses `TemplateDetailPage` as a thin orchestrator (well under 500 lines)
    - [ ] Use `FormField`/`FormLabel`/`FormMessage` in `TemplateMetadata`
    - [ ] Use `<AlertBanner>` for the success/error banners
    - [ ] Use `<ListRow>` for the linked-assignment list
    - [ ] Verify: tests pass; `TemplateDetailPage.tsx` is under 500 lines
    - [ ] Commit: `refactor(admin): split TemplateDetailPage into subcomponents`

- [ ] Task: Adopt `<CountBadge>` in `TemplateDetailPage.tsx` (FR-28.1, FR-28.2)
    - [ ] Write failing test covering: the in-use banner shows the count via `<CountBadge>`
    - [ ] Replace the inline count with `<CountBadge count={template.assignmentCount} />`
    - [ ] Verify: test passes
    - [ ] Commit: `refactor(admin): use CountBadge in template detail`

- [ ] Task: Fix `createServerFn` stub pattern (FR-24.1) — cross-cutting
    - [ ] Identify the root cause: `src/server/<feature>.ts` declares `createServerFn` stubs that don't infer handler types
    - [ ] Update the pattern in `src/server/users.ts`, `src/server/templates.ts`, `src/server/audit-logs.ts` (and any other affected) so the handler return type is propagated
    - [ ] Verify: `pnpm typecheck` passes
    - [ ] Commit: `refactor(server): fix createServerFn type inference`

- [ ] Task: Remove all `// @ts-expect-error` in admin routes (FR-24.2) — fixes the systemic type issue
    - [ ] Remove 12 `// @ts-expect-error - handler type inference limitation` comments in `admin/audit-log.tsx`, `admin/users/index.tsx`, `admin/templates/index.tsx`, `admin/templates/$templateId.tsx`
    - [ ] Verify: `pnpm typecheck` passes with no `// @ts-expect-error` in admin routes
    - [ ] Commit: `refactor(admin): remove // @ts-expect-error from admin routes`

- [ ] Task: Remove ad-hoc `as { ... }` result-shape casts (FR-24.3)
    - [ ] `admin/templates/index.tsx` (lines 112, 121-123, 132) and `TemplateDetailPage.tsx` (lines 71, 144, 166) — replace with proper types
    - [ ] Verify: `pnpm typecheck` passes
    - [ ] Commit: `refactor(admin): remove ad-hoc result-shape casts`

- [ ] Task: Accessibility polish (FR-29.1 through FR-29.5) — completes A1–A6
    - [ ] A1: Refresh buttons in users/templates pages get `aria-label` (subsumed by `<RefreshButton>` adoption in Phase 2)
    - [ ] A2: `DeleteTemplateDialog.tsx` typed-DELETE input has a Label (FR-29.1 — done in Phase 4)
    - [ ] A3: `TemplateDetailPage.tsx` raw `<label>` have `htmlFor` (FR-19.1 — done in Phase 4)
    - [ ] A4: Decorative icons (AlertTriangle, Mail, MailCheck, MailX, etc.) get `aria-hidden="true"`
    - [ ] A5: `CheckpointListEditor.tsx` column headers get screen-reader-friendly structure
    - [ ] A6: `audit-log.tsx` view/hide button gets `aria-expanded` and `aria-controls`
    - [ ] Verify: manual a11y check on /admin/dashboard, /admin/users, /admin/templates, /admin/templates/123, /admin/audit-log
    - [ ] Commit: `a11y(admin): close audit-flagged accessibility gaps (A1–A6)`

- [ ] Task: Final test coverage + pre-push gate
    - [ ] Run `pnpm typecheck` — must pass
    - [ ] Run `pnpm vitest run --coverage` — must meet thresholds (80/80/72/79)
    - [ ] Run `pnpm lint` — must pass
    - [ ] Run `node scripts/check-modularity.js` — no file > 500 lines in scope
    - [ ] Run pre-push gate: `pnpm typecheck && pnpm vitest run --coverage`
    - [ ] Final manual visual check on all 6 admin pages
    - [ ] Commit: `chore(admin): final coverage and gate pass`

- [ ] Task: Conductor - User Manual Verification 'Phase 6 — Structural, types, a11y, final gate' (Protocol in workflow.md)
    - [ ] Run pre-push gate one final time
    - [ ] Manual verification: end-to-end admin flows (CRUD user, create template, edit template, delete template, view audit log, change role); all keyboard-navigable; all strings i18n'd
    - [ ] Create final checkpoint commit, attach git note, update plan with checkpoint SHA
    - [ ] Move track to `completed` status; archive per the workflow

---

## Out-of-scope reminders (from spec §5)

- Student UI consistency — separate track
- Full WCAG 2.1 AA audit — only the audit-flagged items (A1–A6) are addressed
- Mobile breakpoint refinement — out of scope
- Server-side pagination/optimization — only the B6 data-shape change is in scope
- Audit action extensibility — the source-of-truth work centralizes existing actions but does not add new ones
- Visual regression testing infrastructure — no new packages; manual visual review only
- Translation of `template.type` — out of scope

---

**Coverage note:** each phase ends with a Phase Completion Checkpoint per `conductor/workflow.md` §103-171. Between phases, the plan status will be updated with short SHAs from the checkpoint commits.

</protect>
