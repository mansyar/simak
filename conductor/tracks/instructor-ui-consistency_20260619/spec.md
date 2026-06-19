# Track: Instructor UI Consistency

**Type:** refactor
**Created:** 2026-06-19
**Audit reference:** `conductor/audits/instructor-ui-consistency-2026-06-19.md`

---

## 1. Overview

The instructor-facing surface of SIMAK is functional but visibly inconsistent. The same logical elements — page header, filter row, list card, status badge, pagination, empty state, skeleton, form label, textarea, "back" link, SLA badge, primary CTA — are reimplemented in 2–4 different styles across the instructor surface with no shared abstraction. A handful of shared primitives (`Skeleton`, `Select`, `Card`) already exist in `src/components/ui/` but are bypassed in multiple instructor files. One functional bug is bundled in: the review-queue assignment filter dropdown is permanently empty.

This track is a **refactor pass** that:

1. Extracts the missing primitives (`Textarea`, `PageHeader`, `BackLink`, `TemplateTypeBadge`) and a `formatDate` helper.
2. Fixes the review-queue filter bug and unifies the two `SLABadge` implementations.
3. Migrates every instructor page and component to use the new and existing primitives.
4. Replaces hardcoded colors, hardcoded English strings, and the systemic `// @ts-expect-error - handler type inference limitation` typing hack in route loaders.
5. Splits the 446-line `instructor/assignments/$id.tsx` into a thin route plus per-tab subcomponents.

**Scope discipline:** changes are confined to the **instructor surface** (`src/routes/_authenticated/instructor/**`, `src/components/instructor/**`, `src/components/dashboard/InstructorDashboard.tsx`, and any new shared primitives under `src/components/ui/` or `src/lib/`). Student and admin surfaces are **not** modified. New primitives are written so the student and admin surfaces can adopt them in a follow-up track; the existing shared components (`Card`, `Skeleton`, `Select`, `EmptyState`, `MetricCard`) already used by student and admin are not changed.

**i18n:** every new translation key ships with both `en` and `id` translations in `locales/en.json` and `locales/id.json`, and is verified to render correctly in both languages via component tests.

**Risk control on the type-system fix:** the `// @ts-expect-error` removal is the highest-risk change in this track because it touches the server-function pattern itself. It is the last implementation phase and is gated on:
- all existing unit, integration, and component tests still passing,
- `pnpm typecheck` returning 0 errors,
- every route loader resolved manually,
- no runtime regressions observed in the dev server before the phase is marked complete.

---

## 2. Functional Requirements

The work is organised into 7 phases. Each phase ships a coherent, committable, independently-testable unit of work.

### Phase 1 — Foundational primitives (extraction only)

1.1. Add `Textarea` to `src/components/ui/textarea.tsx`, modelled on the existing `Input` primitive (Base UI wrapper, `data-slot`, `size` variant, focus-visible ring, disabled state, invalid state). Default height 80px; `size="sm"` for inline use. The existing `src/components/ui/input.tsx` is the reference implementation.

1.2. Add `PageHeader` to `src/components/ui/page-header.tsx`. Props: `title: string`, `subtitle?: string`, `action?: ReactNode`, `back?: { to: ...; search?: ...; label: string }`. Renders the page-level `<h1>` with `font-display text-3xl text-foreground` (single canonical heading scale — see §3.1) and a right-aligned action slot. When `back` is provided, renders a back link above the title using the new `BackLink` primitive.

1.3. Add `BackLink` to `src/components/ui/back-link.tsx`. Props: `to: string`, `search?: object`, `label: string`. Renders an `inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors` link with `ArrowLeft` icon. Used wherever the current "back" navigation appears.

1.4. Add `TemplateTypeBadge` to `src/components/ui/template-type-badge.tsx`. Props: `type: string`. Renders the canonical instructor pill: `text-[10px] font-bold tracking-wider uppercase text-primary bg-primary/10 px-2 py-0.5 rounded-full`. The class string is currently inlined in three places — this component centralises it.

1.5. Add `formatDate` helper to `src/lib/format.ts`. Exports:
- `formatDateShort(date: Date | string, locale: 'en' | 'id'): string` → `"Mar 5, 2026"` / `"5 Mar 2026"` via `date-fns/format` with `'MMM d, yyyy'` and Indonesian month names from `date-fns/locale/id`.
- `formatDateTimeShort(date: Date | string, locale: 'en' | 'id'): string` → `"Mar 5, 2026 14:30"` (24h, Indonesian) / `"Mar 5, 2026 2:30 PM"` (12h, English).
- `formatDateLong(date: Date | string, locale: 'en' | 'id'): string` → `"March 5, 2026"` / `"5 Maret 2026"`.

1.6. Make `EmptyState.description` optional in `src/components/ui/empty-state.tsx`. When omitted, the description `<p>` is not rendered (currently always rendered, forcing `description=""` workarounds in `InstructorDashboard.tsx`).

### Phase 2 — Functional bug fixes

2.1. **Fix review-queue filter dropdown** in `src/routes/_authenticated/instructor/reviews/index.tsx`. Load the instructor's assignments (a new lightweight server function `listInstructorAssignmentsForFilter` that returns `{ id: number; title: string }[]`) in the route loader and pass the result to `<ReviewQueueFilters>`. The dropdown must show all of the instructor's assignments. Add a unit test for the new server function and a route test for the populated filter.

2.2. **Unify the SLA badge**. Delete the local `SLABadge` in `src/components/dashboard/InstructorDashboard.tsx` (lines 49–58). Reuse the shared `src/components/reviews/SLABadge.tsx` by converting `waitTimeDays` to a `Date` in the dashboard data shape and passing it as `updatedAt`. The shared component already handles the `submitted` state (which the local copy ignores). Ensure the "On Time / Approaching / Breached" semantics match exactly. Update the dashboard's `Badge variant="error"` usage to `Badge variant="destructive"` everywhere it was called from the removed local component.

2.3. **Split the duplicated i18n key** `instructorAssignments.details.studentsProgress` in `locales/en.json` and `locales/id.json`. Create two distinct keys:
- `instructorAssignments.details.totalStudents` — for the stat-card label on `instructor/assignments/$id.tsx:210`.
- `instructorAssignments.details.studentsProgress` — keep for the section heading on `instructor/assignments/$id.tsx:304`.
Re-type the call sites in `src/routes/_authenticated/instructor/assignments/$id.tsx`.

2.4. **Delete the dead colSpan empty-state branch** in `src/components/reviews/ReviewQueueTable.tsx` (lines 131–140). The page-level guard at `reviews/index.tsx:90` renders `<ReviewQueueEmptyState />` before reaching the table, so the inline `<TableCell colSpan>` empty branch is unreachable.

2.5. **Remove the redundant guard** in `src/routes/_authenticated/instructor/reviews/$submissionId.tsx:134`. `<ReviewHistory>` already returns `null` for empty `reviews`; the outer `reviewHistory && reviewHistory.length > 0 && ...` guard is duplicate defensive code.

### Phase 3 — Instructor surface migration to primitives

3.1. Replace the inlined page-heading markup in **7 files** with `<PageHeader>`:
- `src/routes/_authenticated/instructor/dashboard.tsx`
- `src/routes/_authenticated/instructor/assignments/index.tsx`
- `src/routes/_authenticated/instructor/assignments/$id.tsx`
- `src/routes/_authenticated/instructor/assignments/new.tsx`
- `src/routes/_authenticated/instructor/reviews/index.tsx`
- `src/routes/_authenticated/instructor/reviews/$submissionId.tsx` (via `ReviewDetailHeader`, see 3.2)
- `src/routes/_authenticated/instructor/settings.tsx`

All seven pages must end up using the same heading scale (`font-display text-3xl text-foreground`). The "settings" page title currently uses `text-3xl font-bold tracking-tight` and must be normalised to the canonical style.

3.2. Replace the two distinct "back" patterns with `<BackLink>`:
- The plain-link variant in `src/routes/_authenticated/instructor/assignments/$id.tsx:173-181` and `src/routes/_authenticated/instructor/assignments/new.tsx:17-26`.
- The `Button variant="ghost"` variant in `src/components/reviews/ReviewDetailHeader.tsx:22-27`. (This component is small enough that its back-link can be a child of `<PageHeader>` via the `back` prop, or it can keep its current shape but switch to `<BackLink>`.)

3.3. Replace inlined template-type pill markup with `<TemplateTypeBadge>` in three files:
- `src/components/instructor/assignments/AssignmentCard.tsx:34`
- `src/routes/_authenticated/instructor/assignments/$id.tsx:187`
- `src/components/instructor/assignments/ReviewStep.tsx:140`

3.4. Replace raw `<textarea>` with `<Textarea>` in **4 files** (and unify the class strings into the new primitive):
- `src/components/reviews/ReviewForm.tsx:154-161` (size="default")
- `src/components/instructor/assignments/AssignmentDetailsForm.tsx:74-85` (size="default" with `min-h-[120px]` override)
- `src/components/instructor/extensions/ApproveExtensionDialog.tsx:85-93` (size="sm" with `min-h-[60px]`)
- `src/components/instructor/extensions/RejectExtensionDialog.tsx:90-97` (size="sm" with `min-h-[80px]`)

3.5. Replace hand-rolled `bg-muted animate-pulse` skeletons with the existing `<Skeleton>` primitive in **3 files**:
- `src/components/instructor/assignments/AssignmentLoadingSkeleton.tsx`
- `src/components/reviews/ReviewQueueSkeleton.tsx`
- `src/components/instructor/extensions/PendingExtensionsSection.tsx:72`

3.6. Replace the raw `<select>` in `src/components/reviews/ReviewQueueFilters.tsx` with the existing `<Select>` primitive from `src/components/ui/select.tsx`. Pass the loaded assignments list (from §2.1) through the component.

3.7. Replace hand-rolled `bg-card rounded-{lg,md} border shadow-sm p-{N}` wrappers with the existing `<Card>` primitive (and `<CardHeader>`, `<CardTitle>`, `<CardContent>`, `<CardFooter>` where applicable) in **6+ files**:
- `src/components/instructor/assignments/ProgressTable.tsx:117`
- `src/components/reviews/ReviewFilePreview.tsx:23`
- `src/components/reviews/ReviewHistory.tsx:23`
- `src/components/reviews/ReviewForm.tsx:118`
- `src/components/instructor/extensions/PendingExtensionsSection.tsx:49, 59`
- `src/routes/_authenticated/instructor/assignments/$id.tsx:265-298` (the 4 overview cards and the "Details Meta Block" Card)

The 4 overview cards on the assignment detail page (lines 202-262) should be replaced with `<MetricCard>` (which already exists in `src/components/ui/metric-card.tsx` and reads design tokens cleanly).

3.8. Replace hand-rolled empty-state markup with `<EmptyState>` in **2 files**:
- `src/routes/_authenticated/instructor/assignments/$id.tsx:138-152` (not-found state)
- `src/components/instructor/extensions/PendingExtensionsSection.tsx:48-55` (empty queue)
- Also: `src/routes/_authenticated/instructor/assignments/$id.tsx:396-400` — fix the bug where the same i18n key is used for both `title` and `description`.

3.9. Replace `new Date(x).toLocaleDateString()` and `format(new Date(x), '...')` calls in the instructor surface with `formatDateShort` / `formatDateLong` / `formatDateTimeShort` from `src/lib/format.ts`. Files affected:
- `src/components/instructor/assignments/AssignmentCard.tsx:69`
- `src/components/instructor/assignments/ReviewStep.tsx:94`
- `src/routes/_authenticated/instructor/assignments/$id.tsx:257, 293`
- `src/components/reviews/ReviewFilePreview.tsx:38`
- `src/components/reviews/ReviewHistory.tsx:46`
- `src/components/consultations/VerificationQueueItem.tsx:35`

3.10. Unify the "pending count" badge/span on `src/routes/_authenticated/instructor/assignments/$id.tsx:335,351` and `src/components/instructor/extensions/PendingExtensionsSection.tsx:63-66` to a single pattern (recommended: a small `CountBadge` primitive in `src/components/ui/count-badge.tsx`).

### Phase 4 — Design system and i18n cleanup

4.1. Replace hardcoded Tailwind palette colors with design tokens in **7 locations**:
- `src/components/instructor/assignments/AssignmentCard.tsx:28` — `to-violet-500` removed (drop the gradient; use `<Card>`'s default border, or replace with `border-t-primary` matching `MetricCard`).
- `src/components/reviews/ReviewForm.tsx:132, 145` — `text-green-600 dark:text-green-400` → `text-success`; `text-orange-600 dark:text-orange-400` → `text-warning`.
- `src/components/reviews/ReviewHistory.tsx:32, 34` — `text-green-500` → `text-success`; `text-orange-500` → `text-warning`.
- `src/routes/_authenticated/instructor/reviews/$submissionId.tsx:95` — `text-green-500` → `text-success`.
- `src/components/instructor/extensions/PendingExtensionsSection.tsx:29-32` — replace the 4 hand-rolled category-colour pairs with `Badge variant="info" | "secondary" | "success" | "outline"` or extend the design system with semantic category tokens.

4.2. Remove the redundant `className="bg-primary hover:bg-primary/95 text-primary-foreground font-semibold"` from `<Button variant="default">` in **3 files**:
- `src/routes/_authenticated/instructor/assignments/index.tsx:106`
- `src/components/instructor/assignments/AssignmentWizard.tsx:355, 365`

4.3. Add i18n keys for hardcoded English strings and fill both `locales/en.json` and `locales/id.json` translations:
- `AssignmentWizard.tsx:131, 135, 138, 144, 146, 151, 159, 212, 216` — 9 validation/submit error messages.
- `ReviewForm.tsx:59, 66` — 2 file-upload error messages.
- `ReviewQueuePagination.tsx:21` and `TemplatePagination.tsx:21` — currently `t('common.page')` + hardcoded `' of '`; introduce `common.pageOf(currentPage, totalPages)` (or a `common.pagination` group with `current`/`total`/`of` keys) and use the i18n interpolator.
- `ReviewHistory.tsx:35` — replace the hardcoded `': '` with a labelled i18n key.
- `extensions.queue.reason` — currently cast via `as TranslationKey` in `ApproveExtensionDialog.tsx:77` and `RejectExtensionDialog.tsx:82` because the key is missing from the typed surface. Add the key to `locales/en.json` and `locales/id.json` and remove the cast.

4.4. After every new key, run `pnpm generate:i18n` and verify the generated `src/i18n/types.ts` accepts the new key (compile-time check). Add a small unit test that imports every new key via `t(...)` to guard against missing translations.

4.5. Audit §6 notes the student and admin surfaces also have i18n gaps, but **those are out of scope** for this track. They are tracked in the audit but addressed in a future track.

### Phase 5 — Structural cleanups

5.1. **Split `src/routes/_authenticated/instructor/assignments/$id.tsx`** (446 lines) into a thin route plus per-tab subcomponents. New files:
- `src/components/instructor/assignments/AssignmentOverviewTab.tsx` (the 4 metric cards + the meta block + the `<DeadlineManager>` — used when `activeTab === 'overview'`)
- `src/components/instructor/assignments/AssignmentConsultationsTab.tsx` (the verification queue and dialog — used when `activeTab === 'consultations'`)
- `src/components/instructor/assignments/AssignmentExtensionsTab.tsx` (wraps `<PendingExtensionsSection>`)
- `src/components/instructor/assignments/AssignmentDetailTabs.tsx` (the 3-tab navigation with count badges)
- `src/components/instructor/assignments/AssignmentDetailHeader.tsx` (the new `<PageHeader>` with back link, title, description, type badge)

The route file shrinks to ≤120 lines: imports, route declaration, loader, tab state, and `<Outlet>`-like composition of the 4 subcomponents.

5.2. **Extract `<RefreshButton>`** to `src/components/ui/refresh-button.tsx` and a `useRefreshSearch` hook to `src/hooks/use-refresh-search.ts`. Behaviour: awaits `navigate({ search: prev })` (no fake `setTimeout`); shows the `RefreshCcw` icon with `animate-spin` while refreshing. Adopt in **2 files**:
- `src/routes/_authenticated/instructor/assignments/index.tsx:91-103`
- `src/routes/_authenticated/instructor/reviews/index.tsx:68-80`

5.3. **Dedupe pagination**. Extract `<Pagination>` to `src/components/ui/pagination.tsx` with the shape used by `TemplatePagination` and `ReviewQueuePagination`. It includes the `previousPage` / `nextPage` aria-labels (the current `ReviewQueuePagination` is missing them — that's a fix). Delete the two per-feature files and adopt `<Pagination>` in:
- `src/routes/_authenticated/admin/templates/index.tsx`
- `src/routes/_authenticated/instructor/assignments/index.tsx`
- `src/routes/_authenticated/instructor/reviews/index.tsx`

The admin templates change is in scope because the deduped primitive is used in both surfaces and the only way to delete the admin-side copy is to update its call site. The change is mechanical (one prop interface).

5.4. **Adopt `<PageHeader>` in `ReviewDetailHeader.tsx`**. The detail header at `src/components/reviews/ReviewDetailHeader.tsx` rolls its own back link + heading. Migrate to use the canonical back link (or a `<PageHeader back={...}>` instance).

5.5. **Tab navigation** in `src/components/instructor/assignments/AssignmentDetailTabs.tsx` (the new component from 5.1) uses a small shared `<Tabs>` primitive. If a `<Tabs>` primitive already exists in the project's `ui/`, use it. If not, create a minimal one in `src/components/ui/tabs.tsx` based on the current `instructor/assignments/$id.tsx:311-357` markup (3 active/inactive class strings become a single computed string driven by the active index).

### Phase 6 — Systemic type fix

6.1. **Investigate** why every route loader requires `// @ts-expect-error - handler type inference limitation`. Read `src/server/<feature>.ts` and `src/server/<feature>.server.ts` (the dual-file split documented in `AGENTS.md`) to determine whether the issue is:
- the `createServerFn({ method: 'GET' }).handler(...)` chain not propagating types,
- the `data` argument typing in client stubs,
- the Zod `validateSearch` schema not narrowing `search` in `loaderDeps`,
- or a combination.

Document the root cause in the `plan.md` task before implementing.

6.2. **Fix the underlying type pattern** so `// @ts-expect-error` is no longer required. The fix is **not** a per-call `@ts-expect-error` suppression; it is a typing change in the server-function plumbing (most likely in `src/lib/server.ts` or in the `createServerFn` wrapper) that lets the route loader call the handler with its real type and receive a typed return.

6.3. **Remove the directive** from every route loader in the instructor surface and verify the build still passes:
- `src/routes/_authenticated/instructor/dashboard.tsx`
- `src/routes/_authenticated/instructor/assignments/index.tsx`
- `src/routes/_authenticated/instructor/assignments/$id.tsx`
- `src/routes/_authenticated/instructor/reviews/index.tsx`
- `src/routes/_authenticated/instructor/reviews/$submissionId.tsx`

6.4. **No-regression gate** for Phase 6:
- `pnpm typecheck` returns 0 errors.
- `pnpm test -- --coverage` reports ≥ pre-track coverage thresholds (lines 80%, functions 80%, branches 72%, statements 79%) on every file in scope.
- Every modified route loader is manually exercised in the dev server (`pnpm dev`) and the page renders without runtime errors.
- The `as unknown as ...` defensive casts in route loaders (e.g. `instructor/assignments/index.tsx:54`, `reviews/index.tsx:42`) are no longer required and are removed.

6.5. **Roll-back plan**: if Phase 6 surfaces a deeper type-system issue that cannot be resolved without restructuring `src/server/**.ts` in a way that risks other surfaces, halt Phase 6, document the blocker in `plan.md`, and leave the `@ts-expect-error` directives in place. The other 5 phases ship without Phase 6 if necessary.

### Phase 7 — Nice-to-haves

7.1. **Replace the hand-rolled tabs** in the new `AssignmentDetailTabs.tsx` (from 5.1) with a small `<Tabs>` primitive from `src/components/ui/tabs.tsx`.

7.2. **Remove redundant className on default-variant buttons** (already covered in §4.2).

---

## 3. Non-Functional Requirements

### 3.1 Single canonical heading scale
All instructor page `<h1>`s end on the same class string: `font-display text-3xl text-foreground` (set by `<PageHeader>`). Section headings inside pages (`<h2>`, `<h3>`) follow two rules:
- Section heading on its own: `font-display text-2xl text-foreground` (mirrors current detail-page usage).
- Card-level title: use `<CardTitle>` from the existing `Card` primitive.

The `text-xl font-bold tracking-tight`, `text-lg font-semibold`, `text-base font-semibold border-b`, and `text-sm font-semibold` variants currently scattered across `ReviewFilePreview`, `ReviewForm`, `ReviewHistory`, `AssignmentDetailsForm`, `ReviewStep`, and the assignment detail page are unified through `<CardTitle>` and the new heading rules.

### 3.2 Single canonical corner radius for cards
Instructor cards use `rounded-md` (the `Card` primitive's default). Decorative bars (the 1px accent at the top of `AssignmentCard` and `AssignmentLoadingSkeleton`) are dropped in favour of `Card`'s default border, or kept as `border-t-[3px] colors.border` matching `MetricCard`. No `rounded-xl` is used in the instructor surface.

### 3.3 Single canonical hover lift
Decide between `-translate-y-1` (current `AssignmentCard` / `StudentAssignmentCard`) and `-translate-y-0.5` (current `MetricCard` / dashboard quick-action links). Recommended: **drop the lift on cards** (use only `hover:shadow-md hover:border-primary/30`) and keep `-translate-y-0.5` only on the dashboard's quick-action tiles, where the lift is a stronger affordance. The decision is documented in the `<Card>` JSDoc.

### 3.4 No hardcoded Tailwind palette
After this track, the only color classes used in `src/components/instructor/**` and `src/components/dashboard/InstructorDashboard.tsx` are the design tokens (foreground, background, primary, success, warning, error, info, muted, border, ring, etc.) and `current` / `inherit`. The `colorTokens` map in `src/index.css` is the single source of truth. Verified by `pnpm lint` with a new oxlint rule (added if necessary) that fails on raw `text-(red|green|blue|orange|violet|...)`, `bg-(red|green|blue|...)`, or `border-(red|green|blue|...)` palette classes in instructor files.

### 3.5 Single canonical i18n locale for dates
All dates in the instructor surface are formatted via `formatDateShort` / `formatDateLong` / `formatDateTimeShort` from `src/lib/format.ts`. No raw `format(...)` or `toLocaleDateString()` calls remain in instructor files. The helper uses `date-fns/format` with `date-fns/locale/{en,id}` based on the user's `useI18n().locale`.

### 3.6 Coverage thresholds
- Lines 80%, functions 80%, branches 72%, statements 79% — same thresholds as the rest of the project.
- Every new primitive (`Textarea`, `PageHeader`, `BackLink`, `TemplateTypeBadge`, `CountBadge`, `Pagination`, `RefreshButton`, `Tabs`) has ≥ 80% line coverage in `tests/unit/components/ui/...` and `tests/unit/lib/format.test.ts`.
- Every new i18n key has a unit test that imports it via `t(...)` to prevent missing-translation regressions.
- Coverage is **non-regressive** — every existing test must continue to pass.

### 3.7 Accessibility
- `<RefreshButton>` gets an `aria-label={t('common.refresh')}` (currently the icon-only button has no label).
- `<Pagination>` includes the missing `aria-label={t('common.previousPage')}` and `aria-label={t('common.nextPage')}` (currently only on `TemplatePagination`).
- All new interactive primitives pass keyboard navigation (Tab / Shift+Tab / Enter / Space) and screen reader smoke tests (smoke test = manual verification by the user during the Phase Completion protocol).

### 3.8 File size
No new or modified file under `src/components/`, `src/routes/`, `tests/`, or `scripts/` exceeds **500 lines** (per `AGENTS.md` modularity rule). The split in Phase 5 §5.1 is the only file that started near the limit.

### 3.9 TypeScript hygiene
After Phase 6, no `// @ts-expect-error` remains in any route loader. No `as unknown as` casts remain in route loaders or component prop destructuring unless justified in code (justification = a comment explaining why the cast is unavoidable in this exact location). `pnpm typecheck` returns 0 errors.

---

## 4. Acceptance Criteria

This track is **complete** when **all** of the following are true:

**Functional**
- [ ] The instructor review-queue page shows a populated assignment dropdown, and the filter actually narrows the queue.
- [ ] The instructor dashboard's "Pending Review Queue" widget and the review queue's "Status" column render identical SLA badges (same variant, same label, same colours) for the same `waitTimeDays` and `state`.
- [ ] All 7 instructor pages use `<PageHeader>` and render the same heading style.
- [ ] All 3 inlined template-type pills use `<TemplateTypeBadge>`.
- [ ] All 4 raw `<textarea>` instances use `<Textarea>`.
- [ ] All 3 hand-rolled skeleton files use `<Skeleton>`.
- [ ] `ReviewQueueFilters` uses `<Select>` and is populated with the instructor's assignments.
- [ ] All 6+ hand-rolled `bg-card` wrappers in the instructor surface use `<Card>`.
- [ ] The 4 overview cards on the assignment detail page use `<MetricCard>`.
- [ ] All date strings in the instructor surface are formatted via `formatDate*` helpers using the user's locale.
- [ ] The duplicated `instructorAssignments.details.studentsProgress` key is split into two distinct keys.
- [ ] The dead colSpan branch in `ReviewQueueTable` is removed.
- [ ] The redundant guard in `$submissionId.tsx:134` is removed.
- [ ] The local `SLABadge` in `InstructorDashboard.tsx` is deleted; the shared `SLABadge` is reused.
- [ ] `instructor/assignments/$id.tsx` is ≤120 lines and is composed of `<PageHeader>` + 4 tab subcomponents.
- [ ] The two refresh buttons use `<RefreshButton>` and `useRefreshSearch`.
- [ ] The two paginations (admin templates, instructor reviews) use the shared `<Pagination>`.
- [ ] All hardcoded Tailwind palette colours in the instructor surface are replaced with design tokens.
- [ ] All 9 hardcoded English validation messages in `AssignmentWizard` and 2 in `ReviewForm` are replaced with i18n keys.
- [ ] The `as TranslationKey` cast in the extension dialogs is gone (the missing `extensions.queue.reason` key is added).
- [ ] `pnpm generate:i18n` succeeds; every new key exists in both `locales/en.json` and `locales/id.json`.

**Type-safety**
- [ ] No `// @ts-expect-error` remains in any route loader.
- [ ] No `as unknown as` casts remain in route loaders or in the destructuring of loader data in components (unless individually justified by an inline comment).
- [ ] `pnpm typecheck` returns 0 errors.

**Quality gates (per `conductor/workflow.md`)**
- [ ] All unit, integration, and component tests pass.
- [ ] Coverage thresholds met (lines 80%, functions 80%, branches 72%, statements 79%).
- [ ] `pnpm lint` returns 0 errors.
- [ ] `pnpm format` applied; no diff.
- [ ] Each task carries an attached git note summarising changes.
- [ ] Each phase has a checkpoint commit with a verification report attached as a git note.

**Visual verification (per the Phase Completion Protocol)**
- [ ] The user has manually verified the instructor surface on the dev server (`pnpm dev`) and confirmed the audit's §3 high-impact inconsistencies are resolved.

---

## 5. Out of Scope

- **Student surface** (`src/routes/_authenticated/student/**`, `src/components/student/**`).
- **Admin surface** (`src/routes/_authenticated/admin/**`, `src/components/admin/**`) — except for the single mechanical change to adopt the deduped `<Pagination>` primitive in `admin/templates/index.tsx` (Phase 5 §5.3), which is required to delete the duplicate.
- **Auth surface** (`src/routes/_unauthenticated/**`).
- **Shared primitives outside the instructor file scope** (e.g. the audit notes that `StudentAssignmentCard` uses `rounded-xl` instead of `rounded-md`; that divergence is acknowledged in the audit but not addressed here).
- **Cross-locale UI audit** (full coverage of `locales/id.json` for keys that already exist) — only the new keys introduced by this track are translated.
- **Accessibility beyond keyboard + screen-reader smoke tests** — no full WCAG 2.1 AA audit. The audit notes a few specific ARIA gaps (refresh button missing `aria-label`, pagination missing `aria-label` on the new shared component); these are fixed, but no broader audit is performed.
- **Mobile-first responsive redesign** — pages already use Tailwind responsive utilities; this track does not change breakpoints.
- **Performance profiling** — no render-count or bundle-size audit.
- **Migration of every instructor page to a complete design system** — the track is bounded by the audit's 23 items. Future consistency work (e.g. unifying the `Sidebar` and `AppHeader` avatar colours, replacing the hand-rolled section-heading styles with `<SectionHeader>`) can be a follow-up track.

---

## 6. References

- Audit: `conductor/audits/instructor-ui-consistency-2026-06-19.md` (full 23-item list with file:line references).
- Conductor workflow: `conductor/workflow.md` (TDD + Phase Completion protocol + quality gates).
- Tech stack: `conductor/tech-stack.md` (TanStack Start, shadcn/ui, Tailwind v4, Vitest).
- i18n codegen: `pnpm generate:i18n` (per `AGENTS.md`).
- File size rule: `AGENTS.md` — max 500 lines per file in `src/`, `tests/`, `scripts/`.
- Existing primitives: `src/components/ui/{card,badge,button,empty-state,input,label,select,skeleton,metric-card,status-dot,dialog,dropdown-menu,sheet,form,table,progress}.tsx`.
