<protect>
# Track: Instructor UI Consistency — Implementation Plan

**Type:** refactor
**Source spec:** `spec.md`
**Audit reference:** `conductor/audits/instructor-ui-consistency-2026-06-19.md`

> **TDD reminder:** every task follows the lifecycle in `conductor/workflow.md` §"Standard Task Workflow":
> select task → mark `[~]` → red phase (failing tests) → green phase (implement) → refactor → verify coverage → commit → attach git note → mark `[x]` → commit plan update.
>
> **Phase completion:** each phase ends with `- [ ] Task: Conductor - User Manual Verification '<Phase Name>' (Protocol in workflow.md)` which triggers the Phase Completion Verification & Checkpointing Protocol.

---

## Phase 1 — Foundational primitives (extraction only)

Goal: add the new primitives (`Textarea`, `PageHeader`, `BackLink`, `TemplateTypeBadge`, `formatDate`, `CountBadge`) and a non-breaking change to `EmptyState` so Phases 2–7 can adopt them. **No instructor page is modified in this phase.**

- [x] Task: Read spec.md and workflow.md
    - [x] Read `spec.md` to confirm scope, requirements, and acceptance criteria for this phase
    - [x] Read `workflow.md` to confirm TDD lifecycle, quality gates, and git-notes protocol
- [x] Task: Add `Textarea` primitive (2117062)
    - [x] Write failing test in `tests/unit/components/ui/textarea.test.tsx` covering: renders, `size` variant, focus-visible ring, disabled state, `aria-invalid` styling, controlled value/onChange, default height.
    - [x] Implement `src/components/ui/textarea.tsx` (Base UI wrapper, `data-slot="textarea"`, `size: 'default' | 'sm'`, focus ring, invalid ring — model on `src/components/ui/input.tsx`).
    - [x] Refactor if needed; verify coverage ≥ 80%.
    - [x] Commit `feat(ui): Add Textarea primitive`.

- [x] Task: Add `PageHeader` primitive (e0409a3)
    - [x] Write failing test in `tests/unit/components/ui/page-header.test.tsx` covering: title renders with canonical class, optional subtitle, optional action slot, optional back link.
    - [x] Implement `src/components/ui/page-header.tsx`. Renders `<h1 className="font-display text-3xl text-foreground">` and an action slot on the right; when `back` prop is provided, renders `<BackLink>` above the title.
    - [x] Verify coverage ≥ 80%; commit `feat(ui): Add PageHeader primitive`.

- [x] Task: Add `BackLink` primitive (a3ade1a)
    - [x] Write failing test in `tests/unit/components/ui/back-link.test.tsx` covering: renders with `ArrowLeft` + label, navigates via `Link`, accepts `search` prop, hover colour change.
    - [x] Implement `src/components/ui/back-link.tsx`. Class: `inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors`.
    - [x] Verify coverage ≥ 80%; commit `feat(ui): Add BackLink primitive`.

- [x] Task: Add `TemplateTypeBadge` primitive (1bad6af)
    - [x] Write failing test in `tests/unit/components/ui/template-type-badge.test.tsx` covering: renders the type string, applies the canonical pill class string.
    - [x] Implement `src/components/ui/template-type-badge.tsx`. Canonical class: `text-[10px] font-bold tracking-wider uppercase text-primary bg-primary/10 px-2 py-0.5 rounded-full`.
    - [x] Verify coverage ≥ 80%; commit `feat(ui): Add TemplateTypeBadge primitive`.

- [x] Task: Add `formatDate` helper (10b788a)
    - [x] Write failing tests in `tests/unit/lib/format.test.ts` covering: `formatDateShort` (EN, ID), `formatDateLong` (EN, ID), `formatDateTimeShort` (EN, ID); accepts `Date` and ISO string; handles invalid input gracefully.
    - [x] Implement `src/lib/format.ts` using `date-fns/format` with `date-fns/locale/{en,id}`.
    - [x] Verify coverage ≥ 80%; commit `feat(lib): Add formatDate helpers with locale support`.

- [x] Task: Add `CountBadge` primitive (6cdba6b)
    - [x] Write failing test in `tests/unit/components/ui/count-badge.test.tsx` covering: renders count, hides at 0 (when `hideWhenZero` prop), default colour uses design token.
    - [x] Implement `src/components/ui/count-badge.tsx`. Canonical: `inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-full bg-primary text-primary-foreground`.
    - [x] Verify coverage ≥ 80%; commit `feat(ui): Add CountBadge primitive`.

- [x] Task: Make `EmptyState.description` optional (1fbeda9)
    - [x] Update `src/components/ui/empty-state.tsx`: change `description: string` to `description?: string`; render the `<p>` only when `description` is a non-empty string.
    - [x] Add a regression test in `tests/unit/components/empty-state.test.tsx` asserting that omitting `description` does not render an empty `<p>`.
    - [x] Verify existing empty-state tests still pass.
    - [x] Commit `refactor(ui): Make EmptyState description prop optional`.

- [ ] Task: Conductor - User Manual Verification 'Phase 1 — Foundational primitives' (Protocol in workflow.md)

---

## Phase 2 — Functional bug fixes

Goal: fix the only real user-visible bugs in the instructor surface and clean up small dead/redundant code.

- [~] Task: Read spec.md and workflow.md
    - [x] Read `spec.md` to confirm scope, requirements, and acceptance criteria for this phase
    - [x] Read `workflow.md` to confirm TDD lifecycle, quality gates, and git-notes protocol
- [x] Task: Fix review-queue filter dropdown (4ebfb25)
    - [x] Write failing server test in `tests/unit/server/instructor-assignments-filter.test.ts` for new `listInstructorAssignmentsForFilter` (returns `{ id: number; title: string }[]` for the current instructor; respects ownership).
    - [x] Add the server function: `src/server/instructor-assignments-filter.ts` (Zod schema + client stub) and `src/server/instructor-assignments-filter.server.ts` (handler, ownership-verified).
    - [x] Write failing route test asserting `<ReviewQueueFilters>` receives a non-empty `assignments` prop.
    - [x] Update `src/routes/_authenticated/instructor/reviews/index.tsx`: load `listInstructorAssignmentsForFilter()` in the loader; pass to `<ReviewQueueFilters>`.
    - [x] Verify all tests pass; commit `fix(reviews): Populate review-queue assignment filter dropdown`.

- [ ] Task: Unify the SLA badge
    - [ ] Write failing test in `tests/unit/components/dashboard/instructor-dashboard.test.tsx` (extend existing) asserting that the "Pending Review Queue" widget renders the shared `SLABadge` with the correct variant for each wait time bucket.
    - [ ] Update `src/components/dashboard/InstructorDashboard.tsx`: delete the local `SLABadge` (lines 49-58); convert `waitTimeDays` to a `Date` in the data shape (`submittedAt ?? new Date(...)`); use the shared `SLABadge` from `@/components/reviews/SLABadge`. Remove the `getStatusBadgeVariant` function's `case 'Submitted': return 'info'` mapping if it is no longer needed.
    - [ ] Update any callers that depended on the local SLABadge's `variant="error"` to use `variant="destructive"` (verify no other instructor file still imports the deleted symbol).
    - [ ] Verify all tests pass; commit `refactor(dashboard): Unify SLA badge with shared component`.

- [ ] Task: Split the duplicated `instructorAssignments.details.studentsProgress` i18n key
    - [ ] Add `instructorAssignments.details.totalStudents` to `locales/en.json` and `locales/id.json`.
    - [ ] Update `src/routes/_authenticated/instructor/assignments/$id.tsx:210` to use the new key.
    - [ ] Update i18n codegen: `pnpm generate:i18n`; commit the regenerated files as part of this task.
    - [ ] Verify `pnpm typecheck` and tests pass; commit `refactor(i18n): Split duplicated studentsProgress i18n key`.

- [ ] Task: Remove dead/redundant code in review components
    - [ ] Delete the inline colSpan empty-state branch in `src/components/reviews/ReviewQueueTable.tsx` (lines 131-140).
    - [ ] Remove the redundant outer guard `reviewHistory && reviewHistory.length > 0 && ...` in `src/routes/_authenticated/instructor/reviews/$submissionId.tsx:134` (the inner `<ReviewHistory>` already returns `null` for empty).
    - [ ] Add a regression test for `ReviewQueueTable` asserting that an empty `data` array still renders the header but no body rows.
    - [ ] Commit `refactor(reviews): Remove dead colSpan branch and redundant guard`.

- [ ] Task: Conductor - User Manual Verification 'Phase 2 — Functional bug fixes' (Protocol in workflow.md)

---

## Phase 3 — Instructor surface migration to primitives

Goal: replace every inlined page-header, back-link, template-type pill, textarea, skeleton, raw `<select>`, hand-rolled `bg-card` wrapper, and hand-rolled empty state in the instructor surface with the corresponding primitive. No behavioural changes.

- [ ] Task: Read spec.md and workflow.md
    - [ ] Read `spec.md` to confirm scope, requirements, and acceptance criteria for this phase
    - [ ] Read `workflow.md` to confirm TDD lifecycle, quality gates, and git-notes protocol
- [ ] Task: Migrate 7 instructor pages to `<PageHeader>`
    - [ ] Write/extend a smoke test in `tests/unit/routes/instructor-page-headers.test.tsx` asserting that each of the 7 pages renders an `<h1>` with the canonical class string `font-display text-3xl text-foreground`.
    - [ ] Update each of the 7 files listed in `spec.md` §3.1 to use `<PageHeader>`; remove the inlined `<h1>` markup; remove redundant `text-foreground` ad-hoc adds.
    - [ ] Verify all tests pass; commit `refactor(instructor): Adopt PageHeader primitive across 7 pages`.

- [ ] Task: Migrate back-links to `<BackLink>`
    - [ ] Update `src/routes/_authenticated/instructor/assignments/$id.tsx:173-181` and `src/routes/_authenticated/instructor/assignments/new.tsx:17-26` to use `<BackLink>`.
    - [ ] Update `src/components/reviews/ReviewDetailHeader.tsx:22-27` to use `<BackLink>` (or pass the `back` prop to the new `<PageHeader>` if 3.4 changes the structure).
    - [ ] Verify all tests pass; commit `refactor(instructor): Adopt BackLink primitive in 3 sites`.

- [ ] Task: Migrate template-type pills to `<TemplateTypeBadge>`
    - [ ] Update `src/components/instructor/assignments/AssignmentCard.tsx:34`, `src/routes/_authenticated/instructor/assignments/$id.tsx:187`, and `src/components/instructor/assignments/ReviewStep.tsx:140` to use `<TemplateTypeBadge>`.
    - [ ] Verify all tests pass; commit `refactor(instructor): Adopt TemplateTypeBadge primitive in 3 sites`.

- [ ] Task: Migrate textareas to `<Textarea>`
    - [ ] Update `src/components/reviews/ReviewForm.tsx:154-161`, `src/components/instructor/assignments/AssignmentDetailsForm.tsx:74-85`, `src/components/instructor/extensions/ApproveExtensionDialog.tsx:85-93`, and `src/components/instructor/extensions/RejectExtensionDialog.tsx:90-97` to use `<Textarea>` (with appropriate `size` and `minHeight` overrides).
    - [ ] Verify all tests pass; commit `refactor(instructor): Adopt Textarea primitive in 4 sites`.

- [ ] Task: Migrate skeletons to `<Skeleton>`
    - [ ] Update `src/components/instructor/assignments/AssignmentLoadingSkeleton.tsx`, `src/components/reviews/ReviewQueueSkeleton.tsx`, and `src/components/instructor/extensions/PendingExtensionsSection.tsx:72` to use `<Skeleton>`.
    - [ ] Verify all tests pass; commit `refactor(instructor): Adopt Skeleton primitive in 3 files`.

- [ ] Task: Migrate `ReviewQueueFilters` to `<Select>`
    - [ ] Update `src/components/reviews/ReviewQueueFilters.tsx` to render `<Select>` (from `src/components/ui/select.tsx`) with the loaded assignments. Add a unit test that the trigger renders the correct count and that selecting an option fires `onAssignmentChange`.
    - [ ] Verify all tests pass; commit `refactor(reviews): Adopt Select primitive in ReviewQueueFilters`.

- [ ] Task: Migrate hand-rolled card wrappers to `<Card>`
    - [ ] Update `src/components/instructor/assignments/ProgressTable.tsx:117`, `src/components/reviews/ReviewFilePreview.tsx:23`, `src/components/reviews/ReviewHistory.tsx:23`, `src/components/reviews/ReviewForm.tsx:118`, and `src/components/instructor/extensions/PendingExtensionsSection.tsx:49, 59` to use `<Card>` + `<CardHeader>` + `<CardContent>` as appropriate.
    - [ ] Verify all tests pass; commit `refactor(instructor): Adopt Card primitive across 6 files`.

- [ ] Task: Replace 4 overview cards with `<MetricCard>`
    - [ ] Update `src/routes/_authenticated/instructor/assignments/$id.tsx:202-262` to render `<MetricCard>` for total students, average progress, completed cohort, and deadline.
    - [ ] Update the "Details Meta Block" (lines 265-298) to use `<Card>` + `<CardHeader>` + `<CardContent>`.
    - [ ] Verify all tests pass; commit `refactor(assignments): Replace 4 overview tiles with MetricCard`.

- [ ] Task: Migrate hand-rolled empty-states to `<EmptyState>`
    - [ ] Update `src/routes/_authenticated/instructor/assignments/$id.tsx:138-152` (not-found) and `src/components/instructor/extensions/PendingExtensionsSection.tsx:48-55` (empty queue) to use `<EmptyState>`.
    - [ ] Fix the duplicate i18n-key bug on `src/routes/_authenticated/instructor/assignments/$id.tsx:396-400` (currently uses `t('consultations.noPendingConsultations')` for both `title` and `description`).
    - [ ] Add `consultations.noPendingConsultationsDescription` to `locales/en.json` and `locales/id.json`; run `pnpm generate:i18n`.
    - [ ] Verify all tests pass; commit `refactor(instructor): Migrate hand-rolled empty states to EmptyState`.

- [ ] Task: Migrate date formatting to `formatDate*`
    - [ ] Update `src/components/instructor/assignments/AssignmentCard.tsx:69`, `src/components/instructor/assignments/ReviewStep.tsx:94`, `src/routes/_authenticated/instructor/assignments/$id.tsx:257, 293`, `src/components/reviews/ReviewFilePreview.tsx:38`, `src/components/reviews/ReviewHistory.tsx:46`, and `src/components/consultations/VerificationQueueItem.tsx:35` to use the new helpers.
    - [ ] Verify all tests pass; commit `refactor(instructor): Use formatDate helpers for locale-aware dates`.

- [ ] Task: Unify count badges
    - [ ] Update `src/routes/_authenticated/instructor/assignments/$id.tsx:335,351` and `src/components/instructor/extensions/PendingExtensionsSection.tsx:63-66` to use `<CountBadge>`.
    - [ ] Verify all tests pass; commit `refactor(instructor): Unify count badges with CountBadge primitive`.

- [ ] Task: Conductor - User Manual Verification 'Phase 3 — Instructor surface migration' (Protocol in workflow.md)

---

## Phase 4 — Design system and i18n cleanup

Goal: replace hardcoded Tailwind palette colours with design tokens, remove redundant className on default-variant buttons, and translate all hardcoded English strings.

- [ ] Task: Read spec.md and workflow.md
    - [ ] Read `spec.md` to confirm scope, requirements, and acceptance criteria for this phase
    - [ ] Read `workflow.md` to confirm TDD lifecycle, quality gates, and git-notes protocol
- [ ] Task: Replace hardcoded colours with design tokens
    - [ ] Update `src/components/instructor/assignments/AssignmentCard.tsx:28` — drop the `to-violet-500` gradient (keep the 1px accent bar as `border-t-[3px] border-primary` to match `<MetricCard>`).
    - [ ] Update `src/components/reviews/ReviewForm.tsx:132, 145` — `text-green-600 dark:text-green-400` → `text-success`; `text-orange-600 dark:text-orange-400` → `text-warning`.
    - [ ] Update `src/components/reviews/ReviewHistory.tsx:32, 34` — `text-green-500` → `text-success`; `text-orange-500` → `text-warning`.
    - [ ] Update `src/routes/_authenticated/instructor/reviews/$submissionId.tsx:95` — `text-green-500` → `text-success`.
    - [ ] Update `src/components/instructor/extensions/PendingExtensionsSection.tsx:29-32` — replace the 4 hand-rolled category-colour pairs with `Badge variant="info" | "secondary" | "success" | "outline"` (or new design tokens if product wants distinct category colours).
    - [ ] Verify all tests pass; commit `refactor(design-tokens): Replace hardcoded Tailwind palette with design tokens in instructor surface`.

- [ ] Task: Add oxlint rule for raw palette colours (optional but recommended)
    - [ ] Evaluate if `oxlint` supports a no-restricted-syntax rule for class strings matching the palette regex. If yes, add the rule scoped to `src/components/instructor/**` and `src/components/dashboard/InstructorDashboard.tsx`. If no, document the recommendation in the audit follow-up.
    - [ ] Commit `chore(lint): Forbid raw Tailwind palette in instructor surface` (only if the rule is implementable).

- [ ] Task: Remove redundant className on default-variant buttons
    - [ ] Update `src/routes/_authenticated/instructor/assignments/index.tsx:106` and `src/components/instructor/assignments/AssignmentWizard.tsx:355, 365` — remove the `className="bg-primary hover:bg-primary/95 text-primary-foreground font-semibold"` overrides.
    - [ ] Verify all tests pass; commit `refactor(instructor): Remove redundant className on default-variant buttons`.

- [ ] Task: i18n the 9 hardcoded validation messages in `AssignmentWizard`
    - [ ] Add new keys: `instructorAssignments.wizard.errors.templateRequired`, `errors.titleRequired`, `errors.titleMinLength`, `errors.deadlineRequired`, `errors.deadlineInvalid`, `errors.deadlineInPast`, `errors.studentsRequired`, `errors.dueDatesInPast`, `errors.submitFailed`, `errors.networkError` to `locales/en.json` and `locales/id.json`.
    - [ ] Update `src/components/instructor/assignments/AssignmentWizard.tsx:131-159, 212, 216` to use the new keys.
    - [ ] Run `pnpm generate:i18n`; verify `src/i18n/types.ts` accepts the new keys.
    - [ ] Add a unit test asserting each wizard step's validation error message is translated.
    - [ ] Commit `refactor(i18n): Translate AssignmentWizard validation messages (EN+ID)`.

- [ ] Task: i18n the 2 hardcoded `ReviewForm` upload errors
    - [ ] Add `instructorReviews.errors.feedbackUploadFailed` to both locales.
    - [ ] Update `src/components/reviews/ReviewForm.tsx:59, 66`.
    - [ ] Run `pnpm generate:i18n`; verify and commit.

- [ ] Task: i18n the page-of-total pagination label
    - [ ] Add `common.pagination.pageOf` (with `current` and `total` interpolators) to both locales.
    - [ ] Update the new shared `<Pagination>` primitive (created in Phase 5) to use it.
    - [ ] Commit `refactor(i18n): Translate pagination page-of-total label`.

- [ ] Task: i18n the `ReviewHistory` labelled date
    - [ ] Add `instructorReviews.reviewHistoryItem` (or similar) key with the colon-separated format.
    - [ ] Update `src/components/reviews/ReviewHistory.tsx:35`.
    - [ ] Commit `refactor(i18n): Translate ReviewHistory labelled date`.

- [ ] Task: Add the missing `extensions.queue.reason` key
    - [ ] Add `extensions.queue.reason` to `locales/en.json` and `locales/id.json`.
    - [ ] Remove the `as TranslationKey` cast in `src/components/instructor/extensions/ApproveExtensionDialog.tsx:77` and `RejectExtensionDialog.tsx:82`.
    - [ ] Run `pnpm generate:i18n`.
    - [ ] Commit `fix(i18n): Add missing extensions.queue.reason translation key`.

- [ ] Task: Add i18n regression test
    - [ ] Add `tests/unit/i18n/instructor-keys.test.ts` that asserts every new i18n key added by this track is present in both `locales/en.json` and `locales/id.json`.
    - [ ] Commit `test(i18n): Add regression test for new instructor translation keys`.

- [ ] Task: Conductor - User Manual Verification 'Phase 4 — Design system and i18n cleanup' (Protocol in workflow.md)

---

## Phase 5 — Structural cleanups

Goal: split the 446-line assignment detail page, dedupe pagination and refresh-button, and replace the hand-rolled section heading styles.

- [ ] Task: Read spec.md and workflow.md
    - [ ] Read `spec.md` to confirm scope, requirements, and acceptance criteria for this phase
    - [ ] Read `workflow.md` to confirm TDD lifecycle, quality gates, and git-notes protocol
- [ ] Task: Split `instructor/assignments/$id.tsx` into thin route + subcomponents
    - [ ] Create `src/components/instructor/assignments/AssignmentDetailHeader.tsx` (uses `<PageHeader>` with back link, title, description, `<TemplateTypeBadge>`).
    - [ ] Create `src/components/instructor/assignments/AssignmentOverviewTab.tsx` (the 4 `<MetricCard>` tiles + the meta block + the `<DeadlineManager>`).
    - [ ] Create `src/components/instructor/assignments/AssignmentConsultationsTab.tsx` (the verification queue and dialog).
    - [ ] Create `src/components/instructor/assignments/AssignmentExtensionsTab.tsx` (wraps `<PendingExtensionsSection>`).
    - [ ] Create `src/components/instructor/assignments/AssignmentDetailTabs.tsx` (the 3-tab navigation; uses `<CountBadge>` for counts).
    - [ ] Rewrite `src/routes/_authenticated/instructor/assignments/$id.tsx` to ≤120 lines: imports, route declaration, loader, tab state, composition only.
    - [ ] Verify all tests pass; commit `refactor(assignments): Split detail page into thin route and 5 subcomponents`.

- [ ] Task: Extract `<Pagination>` primitive and dedupe
    - [ ] Write failing test in `tests/unit/components/ui/pagination.test.tsx` covering: renders current/total label, prev/next buttons, disabled state, `aria-label`s (`common.previousPage`, `common.nextPage`), `onPageChange` fires with correct page.
    - [ ] Implement `src/components/ui/pagination.tsx` (use the `TemplatePagination` body — it already has the `aria-label`s).
    - [ ] Delete `src/components/admin/templates/TemplatePagination.tsx` and `src/components/reviews/ReviewQueuePagination.tsx`.
    - [ ] Update `src/routes/_authenticated/admin/templates/index.tsx` to use `<Pagination>` (mechanical change in scope per spec §5 §5.3).
    - [ ] Update `src/routes/_authenticated/instructor/assignments/index.tsx` and `src/routes/_authenticated/instructor/reviews/index.tsx` to use `<Pagination>`.
    - [ ] Verify all tests pass; commit `refactor(ui): Extract shared Pagination primitive and dedupe 2 implementations`.

- [ ] Task: Extract `<RefreshButton>` and `useRefreshSearch` hook
    - [ ] Write failing tests in `tests/unit/components/ui/refresh-button.test.tsx` and `tests/unit/hooks/use-refresh-search.test.ts` covering: button click, disabled state, `aria-label`, navigate behaviour, no fake `setTimeout`.
    - [ ] Implement `src/components/ui/refresh-button.tsx` and `src/hooks/use-refresh-search.ts`.
    - [ ] Update `src/routes/_authenticated/instructor/assignments/index.tsx:91-103` and `src/routes/_authenticated/instructor/reviews/index.tsx:68-80` to use the new components.
    - [ ] Verify all tests pass; commit `refactor(instructor): Extract RefreshButton and useRefreshSearch`.

- [ ] Task: Adopt `<PageHeader>` in `ReviewDetailHeader`
    - [ ] Update `src/components/reviews/ReviewDetailHeader.tsx` to render `<PageHeader>` with back link, title (`studentName`), and inline subtitle (`assignmentTitle — checkpointName`).
    - [ ] Verify all tests pass; commit `refactor(reviews): Use PageHeader in ReviewDetailHeader`.

- [ ] Task: Add `<Tabs>` primitive (or adopt from existing)
    - [ ] Check if a `<Tabs>` primitive exists in `src/components/ui/`. If yes, use it. If no, create `src/components/ui/tabs.tsx` based on the current `instructor/assignments/$id.tsx:311-357` markup; the active/inactive class strings are computed from an active index.
    - [ ] Update `src/components/instructor/assignments/AssignmentDetailTabs.tsx` (from 5.1) to use the new `<Tabs>`.
    - [ ] Verify all tests pass; commit `refactor(ui): Adopt Tabs primitive in assignment detail`.

- [ ] Task: Conductor - User Manual Verification 'Phase 5 — Structural cleanups' (Protocol in workflow.md)

---

## Phase 6 — Systemic type fix (highest risk, gated on no regression)

Goal: remove `// @ts-expect-error - handler type inference limitation` from every route loader without introducing any regression.

- [ ] Task: Read spec.md and workflow.md
    - [ ] Read `spec.md` to confirm scope, requirements, and acceptance criteria for this phase
    - [ ] Read `workflow.md` to confirm TDD lifecycle, quality gates, and git-notes protocol
- [ ] Task: Investigate root cause
    - [ ] Read `src/server/<feature>.ts` and `src/server/<feature>.server.ts` for at least 3 features to identify the common typing gap. Document the root cause in this task's git note (a one-paragraph description: where in the chain the type is lost).
    - [ ] Read `conductor/workflow.md` to confirm the server-function pattern requirements.
    - [ ] Identify the minimal typing change that closes the gap. Options to evaluate (in order of preference): (a) tighten the `createServerFn` wrapper generic, (b) adjust the `data` argument type in client stubs, (c) change the loader's `loaderDeps` to derive the search type from `validateSearch` (currently Zod-validated but the `loaderDeps` function may not narrow it correctly).
    - [ ] No code change in this task; commit the investigation as `docs(conductor): Document createServerFn type-gap root cause`.

- [ ] Task: Apply the type fix in the server-function plumbing
    - [ ] Write a failing type-level test in `tests/unit/types/server-fn-types.test-d.ts` (a `tsd`-style test or a Vitest test that asserts the inferred return type of one of the existing server functions) demonstrating the gap.
    - [ ] Apply the typing change identified in the previous task.
    - [ ] Verify the type-level test now passes and `pnpm typecheck` still returns 0 errors.
    - [ ] Verify all existing server and route tests still pass.
    - [ ] Commit `fix(types): Close createServerFn type gap so route loaders get typed handlers`.

- [ ] Task: Remove `// @ts-expect-error` from all instructor route loaders
    - [ ] Remove the directive and the accompanying `// @ts-expect-error - handler type inference limitation` comment from:
        - `src/routes/_authenticated/instructor/dashboard.tsx`
        - `src/routes/_authenticated/instructor/assignments/index.tsx`
        - `src/routes/_authenticated/instructor/assignments/$id.tsx`
        - `src/routes/_authenticated/instructor/reviews/index.tsx`
        - `src/routes/_authenticated/instructor/reviews/$submissionId.tsx`
    - [ ] Also remove the `as unknown as ...` casts in route loaders where the typed return no longer requires them (e.g. `instructor/assignments/index.tsx:54`, `reviews/index.tsx:42`).
    - [ ] Verify `pnpm typecheck` returns 0 errors.
    - [ ] Verify all tests pass.
    - [ ] Commit `refactor(instructor): Remove @ts-expect-error from route loaders (type fix lands)`.

- [ ] Task: No-regression gate
    - [ ] Run `pnpm typecheck` — must return 0 errors.
    - [ ] Run `pnpm test -- --coverage` — coverage must meet or exceed the pre-track thresholds (lines 80%, functions 80%, branches 72%, statements 79%) and all tests must pass.
    - [ ] Run `pnpm lint` — must return 0 errors.
    - [ ] Boot the dev server (`pnpm dev`); visit each modified route in a browser; confirm the page renders without console errors:
        - `/instructor/dashboard`
        - `/instructor/assignments` (with and without search/filter)
        - `/instructor/assignments/$id` (with at least one assignment, exercising all 3 tabs)
        - `/instructor/assignments/new` (wizard all 5 steps)
        - `/instructor/reviews` (with and without filter)
        - `/instructor/reviews/$submissionId` (one with a real submission)
    - [ ] If any check fails, halt and report. Maximum 2 fix attempts; if still failing, roll back the type-fix commit, document the blocker, and ship Phases 1–5 without Phase 6 (per spec §6.5).
    - [ ] Commit `chore(conductor): Phase 6 no-regression gate passed` (an empty commit if needed for the checkpoint).

- [ ] Task: Conductor - User Manual Verification 'Phase 6 — Systemic type fix' (Protocol in workflow.md)

---

## Phase 7 — Nice-to-haves

Goal: small polish that closes the audit's §5 low-impact list.

- [ ] Task: Read spec.md and workflow.md
    - [ ] Read `spec.md` to confirm scope, requirements, and acceptance criteria for this phase
    - [ ] Read `workflow.md` to confirm TDD lifecycle, quality gates, and git-notes protocol
- [ ] Task: Adopt `<Tabs>` in `AssignmentDetailTabs.tsx`
    - [ ] Already partially addressed in Phase 5 §5.5; verify the visual matches the audit's spec and the active/inactive class strings are now computed from the active index.
    - [ ] If a shared `<Tabs>` primitive was added in Phase 5, this task is a no-op confirmation. If not, complete it now.
    - [ ] Commit `refactor(instructor): Confirm Tabs primitive adoption`.

- [ ] Task: Conductor - User Manual Verification 'Phase 7 — Nice-to-haves' (Protocol in workflow.md)

---

## Final track-closure tasks

- [ ] Task: Conductor - Track closure — verify acceptance criteria
    - [ ] Walk through every checkbox in `spec.md` §4 "Acceptance Criteria" and confirm each one is satisfied.
    - [ ] Update `conductor/product.md` "Completed Tracks" section with a new "Track X.Y" entry summarising the work (template: copy the most recent entry from the file and replace the track number, date, and bullet list).
    - [ ] Commit `docs(conductor): Mark Instructor UI Consistency track complete`.
- [ ] Task: Conductor - User Manual Verification 'Track closure' (Protocol in workflow.md)
</protect>
