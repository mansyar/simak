<protect>
# Admin UI Consistency — Specification

**Track ID:** `admin-ui-consistency_20260620`
**Type:** refactor
**Status:** new
**Created:** 2026-06-20
**Audit source:** inline audit delivered in chat (mirroring `conductor/audits/instructor-ui-consistency-2026-06-19.md` style). All 31 findings + 12 bugs from that audit are in scope.

---

## 1. Overview

The admin surface of SIMAK is functional but the most inconsistent surface in the project. Six shared UI primitives (`PageHeader`, `BackLink`, `RefreshButton`, `Skeleton`, `EmptyState`, `Pagination`) exist in `src/components/ui/` and are bypassed in every admin page that could use them. Page headers, refresh buttons, loading skeletons, empty states, and pagination controls are each reimplemented inline in 2–4 different styles. Two real functional bugs surfaced in the audit: a type filter that omits types not on the current page, and a sensitive setup-password-link displayed in a native `alert()` dialog.

This track resolves the entire audit: every inconsistency is removed, every bypassed primitive is adopted, every bug is fixed, and new shared primitives are extracted where the audit identified duplication. Net result: the admin surface uses the same visual language as the instructor and student surfaces, with a smaller code surface and a tighter test footprint.

The track does **not** add new user-facing features; it is a code-quality / consistency refactor plus bug fixes that the audit identified.

---

## 2. Functional Requirements

Each requirement references the audit finding (B = bug, §X.Y = section in the audit).

### 2.1 Page header unification (audit §3.1)

- **FR-1.1** All five admin pages (`admin/dashboard.tsx`, `admin/settings.tsx`, `admin/audit-log.tsx`, `admin/users/index.tsx`, `admin/templates/index.tsx`) render their page header via `<PageHeader title subtitle action back? />` from `src/components/ui/page-header.tsx`.
- **FR-1.2** All admin pages use the `text-3xl` heading scale of the existing `PageHeader` primitive; no admin page renders a `text-4xl` `<h1>`.
- **FR-1.3** All subtitles render as `text-sm text-muted-foreground mt-1` via the primitive.
- **FR-1.4** Right-aligned action groups (Refresh, New, etc.) are passed via the `action` prop.

### 2.2 Refresh button unification (audit §3.2, B5)

- **FR-2.1** All three places that reinvent the refresh control adopt `<RefreshButton>` (or a `<RefreshButton>` + text sibling for the audit-log's labeled variant).
- **FR-2.2** No refresh handler uses `setTimeout` as a fake loading delay; every refresh awaits `router.invalidate()` (or a shared `useRefreshSearch` hook that does so).
- **FR-2.3** All icon-only refresh buttons expose an `aria-label`.

### 2.3 Back link unification (audit §3.3)

- **FR-3.1** `TemplateDetailPage` and `TemplateNotFound` use `<BackLink>` from `src/components/ui/back-link.tsx` instead of inline `<Link className="inline-flex items-center gap-1.5 ...">`.
- **FR-3.2** The back link in the template detail page is placed via `<PageHeader back={...} />`, not as a free-floating element above the metadata card.

### 2.4 Skeleton unification (audit §3.4)

- **FR-4.1** `TemplateLoadingSkeleton.tsx`, `TemplateDetailSkeleton.tsx`, and the inline assignment-list loading state in `TemplateDetailPage.tsx` use `<Skeleton className="h-X w-Y" />` from `src/components/ui/skeleton.tsx`.
- **FR-4.2** No hand-rolled `bg-muted animate-pulse` divs remain in the admin surface.

### 2.5 Empty state unification (audit §3.5)

- **FR-5.1** `TemplateNotFound.tsx` and the dashboard error state in `AdminDashboard.tsx:76-82` use `<EmptyState>` instead of a hand-rolled div + icon + h2 + p layout.
- **FR-5.2** The `description?` optional prop is used; no `description=""` placeholders remain.

### 2.6 Pagination unification (audit §3.6)

- **FR-6.1** The `<Pagination>` primitive is extended to accept optional `showPageNumbers` and `showCounter` props, with a `labelFormatter?` escape hatch for the "Showing X-Y of Z" wording.
- **FR-6.2** The extended primitive is adopted in `admin/users/index.tsx` (prev/next + counter) and `admin/audit-log.tsx` (prev/next + page numbers + counter).
- **FR-6.3** The "previous" i18n key is consistent across all admin pages: the existing primitive uses `common.back`; if the key is changed, all callers move together.

### 2.7 Select primitive adoption (audit §3.7, §3.14)

- **FR-7.1** `admin/audit-log.tsx` action filter uses `<Select>` (with `SelectTrigger`/`SelectContent`/`SelectItem`) instead of a raw `<select>`.
- **FR-7.2** The `data-slot="select-value"` workaround in `UserFilters.tsx:39`, `TemplateFilters.tsx:37`, and `CreateUserDialog.tsx:96` is removed; the underlying `Select` primitive is fixed so `SelectValue` renders automatically.

### 2.8 Search input padding (audit §3.8)

- **FR-8.1** All admin search inputs with a leading icon use `pl-9`; the audit-log outlier (`pl-8`) is corrected.

### 2.9 Native dialog replacement (audit §3.9, B2, B4)

- **FR-9.1** `admin/users/index.tsx` delete confirmation uses a proper `Dialog` (mirroring the `DeleteTemplateDialog` pattern) instead of `window.confirm()`.
- **FR-9.2** `admin/users/index.tsx` create/update error reporting uses inline error UI (consistent with `TemplateDetailPage:198` and `CreateTemplateDialog:165`) instead of `window.alert()`.
- **FR-9.3** `admin/users/index.tsx` setup-link display uses a `Sheet` (or `Dialog`) with a copy-to-clipboard button. The existing i18n key `adminUsers.linkCopied` is used.

### 2.10 Card primitive adoption (audit §3.10)

- **FR-10.1** `admin/audit-log.tsx` table wrapper uses `<Card><CardContent className="p-0">` (matching the `UserTable.tsx:170-171` pattern).
- **FR-10.2** `AdminDashboard.tsx` quick-action links use `<QuickActionCard icon label description to />` (extracted per §2.12).
- **FR-10.3** `AdminDashboard.tsx` email-queue mini-stats use `<EmailQueueStat icon color label value />` (extracted per §2.13).
- **FR-10.4** `AdminDashboard.tsx` escalation-alert list items use `<Card>` (or a small list-item primitive) instead of the raw `<li>` with hand-rolled severity backgrounds.
- **FR-10.5** `TemplateDetailPage.tsx` linked-assignment list items use a shared `<ListRow>` primitive (extracted per §2.15).

### 2.11 Alert/banner extraction (audit §3.11)

- **FR-11.1** A new `<AlertBanner variant="success" | "error" | "info" | "warning">` primitive is added to `src/components/ui/`.
- **FR-11.2** The primitive is adopted in `TemplateDetailPage.tsx` (success and error) and `CreateTemplateDialog.tsx` (error).
- **FR-11.3** The success variant uses design tokens (`bg-success/10 text-success`); the previous hardcoded `bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400` is removed.

### 2.12 QuickActionCard extraction (audit §3.12)

- **FR-12.1** A new `<QuickActionCard icon label description to />` primitive is added.
- **FR-12.2** The two near-identical quick-action blocks in `AdminDashboard.tsx:271-302` are replaced.

### 2.13 EmailQueueStat extraction (audit §3.13)

- **FR-13.1** A new `<EmailQueueStat icon color label value />` primitive is added.
- **FR-13.2** The three near-identical email-queue blocks in `AdminDashboard.tsx:137-170` are replaced.

### 2.14 TemplateTypeBadge adoption (audit §4.1, B1)

- **FR-14.1** `TemplateCard.tsx:39` renders `<TemplateTypeBadge type={template.type} />` instead of `<Badge variant="secondary">`.

### 2.15 Linked-assignment list item (audit §3.15)

- **FR-15.1** A new `<ListRow left right? onClick? />` primitive (or local component) is used in `TemplateDetailPage.tsx` for each linked assignment. The wrapper class string `flex items-center justify-between rounded-md border p-3 text-sm hover:bg-accent transition-colors` is the baseline.

### 2.16 Role config deduplication (audit §4.2)

- **FR-16.1** A single `src/lib/admin/roles.ts` module exports `ROLES: Array<{ value, labelKey, badgeVariant }>`.
- **FR-16.2** `UserTable.tsx`, `UserFilters.tsx`, and `CreateUserDialog.tsx` consume `ROLES`; the inline `roleVariants` and `roleLabels` map declarations are removed.
- **FR-16.3** The `as TranslationKey` cast on `t(('adminUsers.role_' + field.value) as TranslationKey)` (CreateUserDialog:98) is replaced with a typed lookup that does not need a cast.

### 2.17 Audit-event color helper unification (audit §4.3)

- **FR-17.1** A single `getActionVisualProps(type)` helper returns `{ dotVariant, badgeVariant, color }` for an action type, used by both `AdminDashboard.tsx:66-71` (`getActivityDotColor`) and `admin/audit-log.tsx:70-84` (`getActionBadgeVariant`).
- **FR-17.2** The two ad-hoc helpers are removed.
- **FR-17.3** The audit-log table and the dashboard recent-activity list produce visually consistent colors for the same conceptual event.

### 2.18 ACTION_TYPES source-of-truth (audit §4.10)

- **FR-18.1** The `ACTION_TYPES` const is moved to `src/lib/admin/audit-actions.ts`.
- **FR-18.2** The module imports action keys from a shared constants file (or generates them from the i18n keys) so the const cannot drift from the locale file.
- **FR-18.3** All 14 `actionLabels` keys in `locales/en.json` and `locales/id.json` are reachable from the const (the current `extensionApproved` / `extensionRejected` gap is closed).

### 2.19 Form label (audit §4.4)

- **FR-19.1** The raw `<label>` elements in `TemplateDetailPage.tsx:211-213, 222-224` are replaced with `<Label htmlFor={...}>` (or wrapped in `FormField` for consistency with the other admin forms).
- **FR-19.2** All other form fields in admin pages use `<Label>`, `<FormLabel>`, or `FormField`.

### 2.20 CheckpointListEditor move buttons (audit §4.5)

- **FR-20.1** The raw `<button>` move-up/down elements in `CheckpointListEditor.tsx:63-80` are replaced with `<Button variant="ghost" size="icon-xs">` (matching the X remove button on the same row).

### 2.21 Date formatting helper (audit §4.6)

- **FR-21.1** A `formatDate(date: Date | string | null, locale: string, style: 'short' | 'long' | 'time')` helper is added to `src/lib/`.
- **FR-21.2** All admin date displays (`UserTable`, `TemplateCard`, `TemplateDetailPage` ×2, `AdminDashboard`, `audit-log`) use this helper.
- **FR-21.3** `AdminDashboard.tsx:254` no longer uses `toLocaleDateString()` (locale-ignoring).
- **FR-21.4** `TemplateDetailPage.tsx:236` and `:317` use the same format string for the same kind of data.

### 2.22 i18n gaps (audit §5)

- **FR-22.1** `adminUsers.table.emailVerified` is added to `locales/en.json` and `locales/id.json`.
- **FR-22.2** `UserTable.tsx:98` uses the new key.
- **FR-22.3** New i18n keys are added for: failed-save error message (`adminTemplates.detail.saveError`), "students" count suffix (`adminTemplates.studentsCount` or similar), the empty-state description "All assignments are on track" (`adminDashboard.allOnTrack`), the empty-state description "No recent activity to display" (use existing `noRecentActivity` or add a description key), and the typed-DELETE confirmation word (`common.typeDeleteToConfirm` already exists; add a `common.deleteConfirmationWord` key whose value is `DELETE` and is replaced per locale).
- **FR-22.4** All hardcoded English strings in the audit (§5 I1–I9) are replaced with i18n calls. The `as TranslationKey` casts in `UserTable.tsx:91`, `UserFilters.tsx:41, 48`, and `CreateUserDialog.tsx:98` are removed by using the typed `ROLES` config.

### 2.23 Hardcoded colors (audit §4.7)

- **FR-23.1** `TemplateDetailPage.tsx:191` (success banner) uses design tokens via the new `<AlertBanner variant="success">`.
- **FR-23.2** `TemplateDetailPage.tsx:247` (`AlertTriangle` `text-amber-500`) uses `text-warning`.
- **FR-23.3** `AdminDashboard.tsx:197` (alert icon circle `bg-error text-white`) uses the design-token pair (`bg-error text-error-foreground` or equivalent).

### 2.24 TypeScript type fixes (audit N6 in instructor audit; same here)

- **FR-24.1** The `createServerFn` stub pattern in `src/server/<feature>.ts` is fixed so handler return types are correctly inferred.
- **FR-24.2** All 12 `// @ts-expect-error - handler type inference limitation` comments in admin routes are removed.
- **FR-24.3** All `as { success?: boolean; error?: string }` and similar ad-hoc result-shape casts in `admin/templates/index.tsx` and `TemplateDetailPage.tsx` are removed.

### 2.25 TemplateDetailPage structure (audit §4.11, B8)

- **FR-25.1** `TemplateDetailPage.tsx` (356 lines) is split into a thin route + per-card subcomponents (`TemplateMetadata`, `TemplateCheckpointSection`, `TemplateLinkedAssignments`, `TemplateDangerZone`). Each subcomponent is a separate file.
- **FR-25.2** The `useEffect` + `useServerFn(listTemplateAssignments)` call (lines 67-84) is removed; the route loader at `templates/$templateId.tsx` includes the linked assignments and passes them down.
- **FR-25.3** The metadata inputs use `FormField` / `FormLabel` / `FormMessage` (per FR-19.1).
- **FR-25.4** The page does not exceed 500 lines (AGENTS.md constraint).

### 2.26 Setup-link alert (security) (audit B3)

- **FR-26.1** The setup-link display in `users/index.tsx:90-92` does not use `window.alert()`.
- **FR-26.2** A `Sheet` (or `Dialog`) renders the URL with a copy-to-clipboard button. The existing i18n key `adminUsers.linkCopied` is shown on copy.

### 2.27 Type-filter fix (audit B6)

- **FR-27.1** The `listTemplates` server function returns `{ templates, total, allTypes }` (or the type list is loaded via a separate query).
- **FR-27.2** The route loader passes the full type list to `TemplateFilters`.
- **FR-27.3** Types not on the current page are filterable.

### 2.28 CountBadge adoption (audit §4.8)

- **FR-28.1** The in-use banner in `TemplateDetailPage.tsx:245-252` includes the count via `<CountBadge>` (or the count is part of the new `<AlertBanner>` if FR-11.2 is satisfied that way).
- **FR-28.2** All count-display sites in admin use `<CountBadge>` where appropriate.

### 2.29 Accessibility gaps (audit §6)

- **FR-29.1** `DeleteTemplateDialog.tsx:70-75` "type DELETE" input has a `<Label>` (or `aria-label`) linked to its description.
- **FR-29.2** `admin/audit-log.tsx:228-233` view/hide button has `aria-expanded` and `aria-controls` pointing at the `<pre>` panel.
- **FR-29.3** `CheckpointListEditor.tsx` column headers are wrapped in a `<thead>` row (or each header gets a screen-reader-friendly structure).
- **FR-29.4** `TemplateDetailPage.tsx` raw `<label>` elements have `htmlFor` association.
- **FR-29.5** Decorative icons (`<AlertTriangle>`, etc.) have `aria-hidden="true"`.

---

## 3. Non-Functional Requirements

- **NFR-1 Test coverage** — New and modified code maintains >80% line coverage per `vitest.config.ts` thresholds. New primitives (`AlertBanner`, `QuickActionCard`, `EmailQueueStat`, `ListRow`, `ROLES` config) have component-render tests.
- **NFR-2 No regressions** — The existing test suite passes; visual consistency with the instructor surface is achieved. Manual visual check on the 6 admin pages confirms the new visual language matches the rest of the app.
- **NFR-3 i18n parity** — `locales/en.json` and `locales/id.json` have the same keys. No English strings remain in admin UI.
- **NFR-4 Accessibility** — WCAG 2.1 AA: all interactive elements have accessible names, all form fields are properly labeled, decorative elements are hidden from screen readers. The audit's §6 a11y gaps (A1–A6) are closed.
- **NFR-5 Modularity** — No file exceeds 500 lines (per AGENTS.md). The split of `TemplateDetailPage` brings it well under the limit.
- **NFR-6 Performance** — No new memoization regressions. The `roleVariants` map moved out of the cell renderer is a small but real win.
- **NFR-7 No new dependencies** — No new npm packages. The new primitives are composed from existing `Card`, `Badge`, `Button`, etc.

---

## 4. Acceptance Criteria

- **AC-1** All 31 audit findings (sections 3, 4, 5, 6 of the audit) are resolved.
- **AC-2** All 12 audit-identified bugs (B1–B12) are fixed.
- **AC-3** Component tests for each refactored page render successfully under `pnpm vitest run`.
- **AC-4** The full pre-push gate passes: `pnpm typecheck && pnpm vitest run --coverage`.
- **AC-5** Coverage thresholds are met: 80% lines, 80% functions, 72% branches, 79% statements.
- **AC-6** `pnpm lint` passes (oxlint).
- **AC-7** `pnpm typecheck` passes with no `// @ts-expect-error` in admin routes.
- **AC-8** Manual visual check: admin pages (`/admin/dashboard`, `/admin/users`, `/admin/templates`, `/admin/templates/$id`, `/admin/audit-log`, `/admin/settings`) render with the same visual language as instructor pages. PageHeader scale, Refresh button, Skeleton, EmptyState, and Pagination are visually identical.
- **AC-9** Setup-password-link is never displayed via native `alert`; it is shown in a Sheet/Dialog with a copy-to-clipboard button.
- **AC-10** The type filter on `/admin/templates` shows all template types, not just those on the current page.
- **AC-11** No file in `src/components/admin/`, `src/components/dashboard/AdminDashboard.tsx`, or `src/routes/_authenticated/admin/` exceeds 500 lines.

---

## 5. Out of Scope

- **Student UI consistency** — Separate track. This track is admin-only.
- **Full WCAG 2.1 AA audit** — Only the a11y issues surfaced incidentally in the audit (A1–A6) are addressed. A complete accessibility review is its own track.
- **Mobile breakpoint refinement** — Only the high-level layout shell was inspected. Responsive behavior at mobile breakpoints is not systematically re-tested.
- **Server-side pagination/optimization** — The type-filter fix (B6) changes the data shape returned by `listTemplates`; deeper server performance work (caching, query optimization) is not in scope.
- **Audit action extensibility** — The `ACTION_TYPES` source-of-truth work centralizes the data but does not add a new audit action. Adding new actions is a separate product decision.
- **Visual regression testing infrastructure** — No Percy / Chromatic / Playwright added. Verification is RTL component tests + manual visual review.
- **Translation of the `template.type` field** — The type filter currently displays raw user-defined type strings. Translating the type values is a product decision and is not in scope.
- **Generic cross-role UI consistency** — The audit surfaced that the student and admin sides have drifted; the instructor side is being addressed in a separate (existing) track. A cross-role track would be redundant work.

---

## 6. References

- Audit findings (inline in chat, 2026-06-20): the source of truth for all 31 findings + 12 bugs.
- `conductor/audits/instructor-ui-consistency-2026-06-19.md`: the sibling audit; the recommendations and structure of this spec mirror it.
- `src/components/ui/{page-header, back-link, empty-state, skeleton, refresh-button, card, badge, button, table, pagination, status-dot, count-badge, template-type-badge, select, form, input, label, dialog, sheet, dropdown-menu, metric-card}.tsx`: the existing primitives this track adopts.
- `conductor/workflow.md`: TDD protocol, phase-completion checkpointing, commit format.
- `AGENTS.md`: 500-line file limit, server function split, no new dependencies.

</protect>
