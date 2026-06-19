# Instructor UI Consistency Audit

**Date:** 2026-06-19
**Scope:** All routes, components, and shared UI consumed by the instructor-facing surface area.
**Auditor:** Conductor (read-only review; no code changes proposed in this report).

---

## 0. Scope surveyed

| Area | Files |
| --- | --- |
| Layout / shell | `src/routes/_authenticated/instructor.tsx`, `src/components/layout/instructor-sidebar.tsx`, `src/components/layout/app-header.tsx` |
| Dashboard | `src/routes/_authenticated/instructor/dashboard.tsx`, `src/components/dashboard/InstructorDashboard.tsx` |
| Assignments list | `src/routes/_authenticated/instructor/assignments/index.tsx`, `AssignmentCard`, `AssignmentFilters`, `AssignmentEmptyState`, `AssignmentLoadingSkeleton` |
| Assignment detail | `src/routes/_authenticated/instructor/assignments/$id.tsx`, `ProgressTable`, `AssignmentDetailsForm`, `ReviewStep`, `AssignmentWizard`, `new.tsx` |
| Reviews | `src/routes/_authenticated/instructor/reviews/index.tsx`, `$submissionId.tsx`, `ReviewQueueTable`, `ReviewQueueItem`, `ReviewQueueFilters`, `ReviewQueueEmptyState`, `ReviewQueueSkeleton`, `ReviewQueuePagination`, `SLABadge`, `ReviewDetailHeader`, `ReviewFilePreview`, `ReviewHistory`, `ReviewForm` |
| Extensions | `PendingExtensionsSection`, `ApproveExtensionDialog`, `RejectExtensionDialog` |
| Consultations (rendered on assignment detail) | `VerificationQueueItem`, `VerificationDialog` |
| Settings | `src/routes/_authenticated/instructor/settings.tsx` (delegates to `src/components/settings/SettingsPage.tsx`) |
| Shared primitives | `src/components/ui/{card,badge,button,empty-state,input,label,select,skeleton,metric-card,status-dot}.tsx` |

---

## 1. Executive summary

The instructor surface is **functional but visibly inconsistent**. The same logical elements — page header, filter row, list card, status badge, pagination, empty state, skeleton, form label, textarea, "back" link, SLA badge, primary CTA — are reimplemented in 2–4 different styles across the instructor surface, with no shared abstraction in `src/components/ui/`.

The most impactful problems:

1. **One real functional bug** masquerading as UI: the review-queue assignment filter is always empty.
2. **The shared "SLA badge" is duplicated and uses different Badge variants** (`destructive` vs `error`) — these are not the same design token.
3. **The `Skeleton` and `Select` primitives exist but are bypassed in multiple instructor components** that reimplement the same styling by hand.
4. **There is no `<PageHeader>` component**, so every page header is rolled by hand and diverges.
5. **Textarea styling is duplicated in 4 files with 3 different class strings**; there is no `Textarea` primitive.
6. **Hardcoded English strings bypass i18n** in the Assignment wizard, ReviewForm, and pagination.

A new "Instructor UI consistency" track is recommended to address these. Most fixes are small (<30 lines per file) and safe; the only structural refactor needed is extracting `PageHeader`, unifying `SLABadge`, and adding a `Textarea` primitive.

---

## 2. Bugs that look like UI issues

| # | Location | Issue | Severity |
| --- | --- | --- | --- |
| B1 | `src/routes/_authenticated/instructor/reviews/index.tsx:85` | `<ReviewQueueFilters assignments={[]} ... />` always passes an empty array. The assignment filter dropdown is always empty. | **Bug** |
| B2 | `src/components/dashboard/InstructorDashboard.tsx:49-58` | Local `SLABadge` re-implementation with `variant="error"`; ignores `state === 'submitted'`; the `Badge` component already defines a different `destructive` token. Two SLA badge sources, two semantics, two variants. | **Bug + design drift** |
| B3 | `src/components/reviews/ReviewQueueTable.tsx:131-140` | The table renders an inline `colSpan` empty state, but the page (`reviews/index.tsx:90`) guards the empty case with `<ReviewQueueEmptyState />` before reaching the table. The colSpan branch is dead code. | Dead code |
| B4 | `src/components/reviews/ReviewHistory.tsx:20` & `src/routes/_authenticated/instructor/reviews/$submissionId.tsx:134` | `ReviewHistory` already returns `null` for empty `reviews`, but the page also guards `reviewHistory && reviewHistory.length > 0 && ...`. One of the two guards is redundant. | Nit |
| B5 | `src/routes/_authenticated/instructor/assignments/index.tsx:95-99` | The "refresh" button uses `setTimeout(..., 1000)` as a fake loading delay; the reviews page (`reviews/index.tsx:72-77`) awaits `navigate` instead. Same UI control, two behaviors. | UX inconsistency |

---

## 3. High-impact inconsistencies (visible to users)

### 3.1 Page header — every page rolls its own

| Page | Class on `<h1>` | Subtitle? | Action? |
| --- | --- | --- | --- |
| `instructor/dashboard.tsx:23` | `font-display text-4xl` (no `text-foreground`) | yes | none |
| `instructor/assignments/index.tsx:84` | `font-display text-4xl text-foreground` | yes | Refresh + New |
| `instructor/assignments/$id.tsx:191` | `font-display text-4xl text-foreground` | description (not `subtitle`) | none |
| `instructor/assignments/new.tsx:29` | `text-3xl font-bold tracking-tight text-foreground` | yes | none |
| `instructor/reviews/index.tsx:65` | `font-display text-4xl` (no `text-foreground`) | yes | Refresh only |
| `instructor/reviews/$submissionId.tsx:31` (inside `ReviewDetailHeader`) | `font-display text-3xl` | inline below | none |
| `instructor/settings.tsx:15` | `text-3xl font-bold tracking-tight text-foreground` | none | none |

Three issues:

- **Two heading scales** in use: `font-display text-4xl` (dashboard, assignments, reviews) and `text-3xl font-bold tracking-tight` (new, settings, detail). Pick one.
- **`text-foreground` is missing on `dashboard` and `reviews/index`** (lines 23 and 65). It will inherit, but it is inconsistent with sibling pages.
- **No shared `<PageHeader title subtitle action />` component** even though every page uses the same structural pattern (heading + optional subtitle + optional right-aligned action group).

### 3.2 "Back" navigation — three different patterns

| Location | Markup | Visual |
| --- | --- | --- |
| `instructor/assignments/$id.tsx:173-181` | `<Link>` with `inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary` + `ArrowLeft` icon + `common.back` text | Plain link |
| `instructor/assignments/new.tsx:17-26` | Identical to above | Plain link |
| `instructor/reviews/$submissionId.tsx:22-27` (inside `ReviewDetailHeader`) | `<Link>` wrapping `<Button variant="ghost" size="sm">` + `ChevronLeft` + `common.back` | Button with hover bg |

Two shapes for the same action. Additionally, the search params baked into the back link differ:
- `ReviewDetailHeader` → `{ page: 1, limit: 20 }`
- `assignments/$id.tsx` and `new.tsx` → `{ page: 1, limit: 20, search: '' }`

The `search` field is optional in `AssignmentSearchSchema` (`z.string().optional().default('')`) so the missing field is OK in practice, but the divergence is a smell — both links should be using the same `Link` pattern with the same default search.

### 3.3 Card vs raw `<div>`

`Card` from `src/components/ui/card.tsx` is the documented primitive, with `px-4` content padding by default. It is used in only some components:

| File | Uses `Card`? | Actual wrapper |
| --- | --- | --- |
| `AssignmentCard.tsx` | yes | `Card` (with custom hover/gradient) |
| `ReviewQueueTable.tsx` | yes | `Card` + `CardContent className="p-0"` |
| `InstructorDashboard.tsx` | yes | `Card` + `CardHeader` + `CardContent` |
| `MetricCard` | no (own primitive) | `relative overflow-hidden rounded-lg border bg-card p-6 ...` |
| `ProgressTable.tsx:117` | **no** | `<div className="rounded-lg border bg-card shadow-sm overflow-hidden">` |
| `ReviewFilePreview.tsx:23` | **no** | `<div className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">` |
| `ReviewHistory.tsx:23` | **no** | identical to `ReviewFilePreview` |
| `ReviewForm.tsx:118` | **no** | identical |
| `PendingExtensionsSection.tsx:49,59` | **no** | `<div className="rounded-lg border bg-card p-5 shadow-sm">` |
| `ReviewStep.tsx:62,101,134` | yes (with `<Card className="p-5 ...">`) | yes but heavily overridden |
| `StudentAssignmentCard.tsx:25` | **no** | `<div className="group relative flex flex-col justify-between overflow-hidden rounded-xl border bg-card p-5 shadow-sm ...">` — **also uses `rounded-xl` not `rounded-lg`/`rounded-md`**, which is the single student-side inconsistency |

Two issues:
- `Card` is bypassed in 6+ instructor components. The wrapper is always the same shape (`rounded-{lg,xl} border bg-card p-N shadow-sm`) so the bypass is gratuitous.
- The student card uses `rounded-xl` while every instructor card uses `rounded-lg` or `rounded-md`. Same conceptual element, different corner radius.

### 3.4 Filter UI — Input vs raw `<select>`

| File | Component used | Status |
| --- | --- | --- |
| `AssignmentFilters.tsx` | `<Input>` + `<Search>` icon, `pl-9` | shadcn Input + icon pattern |
| `ReviewQueueFilters.tsx` | Raw `<select>` with manual `className` and `ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` | Bypasses `src/components/ui/select.tsx` |

`src/components/ui/select.tsx` already exists (Base UI wrapper, 188 lines). `ReviewQueueFilters` should use it. Even better: extract a single `<ListFilters>` wrapper that takes search + filter controls and renders them in a consistent layout.

### 3.5 Empty states

`EmptyState` is a well-defined primitive. It is used in most but not all empty cases:

| File | Uses `EmptyState`? | Notes |
| --- | --- | --- |
| `AssignmentEmptyState.tsx` | yes | adds CTA button via `children` |
| `ReviewQueueEmptyState.tsx` | yes | OK |
| `InstructorDashboard.tsx` | yes | but passes `description=""` for all 3 empty cases — the description slot is being wasted |
| `instructor/assignments/$id.tsx:396-400` (consultations) | yes | **passes the same i18n key for both `title` and `description`**: `title={t('consultations.noPendingConsultations')}` and `description={t('consultations.noPendingConsultations')}` |
| `instructor/assignments/$id.tsx:138-152` (not-found) | **no** | raw `<div className="flex flex-col items-center justify-center py-12 text-center">` + heading + paragraph + back link |
| `instructor/reviews/$submissionId.tsx:83,87` (errors) | yes (one with custom icon, one with `SearchX`) | but both pass `description=""` |
| `PendingExtensionsSection.tsx:48-55` (empty) | **no** | raw `<div className="rounded-lg border bg-card p-5 shadow-sm">` |

The "not found" and "no pending extensions" cases should also use `EmptyState`. The repeated `description=""` pattern suggests the dashboard author wanted to omit the description, but `EmptyState` renders the description unconditionally; a `description?: string` (optional) prop would fix it.

### 3.6 "Template type" pill — duplicated 3 times, bypassed by student

The same class string appears verbatim in three places:

```
text-[10px] font-bold tracking-wider uppercase text-primary bg-primary/10 px-2 py-0.5 rounded-full
```

- `AssignmentCard.tsx:34`
- `instructor/assignments/$id.tsx:187`
- `ReviewStep.tsx:140`

`StudentAssignmentCard.tsx:29` uses `<Badge variant="outline">{templateType}</Badge>` — a totally different visual. This is a single source of truth waiting to be extracted: a `<TemplateTypeBadge>` component used by all three instructor sites and offered to the student side.

### 3.7 SLA badge — two implementations, different variants

- `src/components/reviews/SLABadge.tsx` (shared): `submitted` → `secondary`; elapsed < 2d → `success`; < 3d → `warning`; ≥ 3d → `destructive`. Uses `Date.now() - updatedAt`.
- `src/components/dashboard/InstructorDashboard.tsx:49-58` (local): `waitTimeDays < 2` → `success`; < 3 → `warning`; else → **`error`**.

`Badge` defines both `destructive` (`bg-destructive/10 text-destructive`) and `error` (`bg-error/10 text-error`) — these are two different design tokens, and nothing else in the app uses `variant="error"`. The local `SLABadge` should be deleted and the shared one reused, with `waitTimeDays` converted to a `Date` upstream.

### 3.8 "Pending consultation / extension" pill

| File | Pattern |
| --- | --- |
| `instructor/assignments/$id.tsx:335,351` | `<Badge variant="default" className="ml-1.5">` (count next to tab label) |
| `PendingExtensionsSection.tsx:63-66` | `<span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-full bg-primary text-primary-foreground">` |

Two different counters. The first is a `Badge`, the second is a raw span. Pick one.

### 3.9 Refresh button — duplicated, two behaviors

Same `Button variant="outline" size="icon"` + `RefreshCcw` + `animate-spin` pattern in:

- `instructor/assignments/index.tsx:92-103` (uses 1s `setTimeout` fake delay)
- `instructor/reviews/index.tsx:69-80` (awaits navigate)

Should be a `useRefresh` hook or a `<RefreshButton onClick />` shared component.

### 3.10 Decorative gradient + hardcoded `violet-500`

`AssignmentCard.tsx:28` uses `bg-gradient-to-r from-primary to-violet-500 opacity-80` for the top accent bar. `violet-500` is not a design-system token. Every other "metric accent" pattern in the app uses a `MetricCard color` or a `Badge variant` (which both read from `src/index.css` design tokens). Either:

- Add a `violet` token to the design system if the gradient is intentional, or
- Remove the gradient.

The same file's hover (`hover:-translate-y-1`) is identical to `StudentAssignmentCard.tsx`, but `MetricCard` uses a smaller `-translate-y-0.5` lift. Pick one lift.

### 3.11 Approval button colors

`PendingExtensionsSection.tsx:103-118`:
- Approve → `<Button size="sm" variant="default">` (primary blue)
- Reject → `<Button size="sm" variant="outline">` (gray)

Convention in the rest of the app:
- `ReviewForm.tsx`: Pass = green text (`text-green-600 dark:text-green-400`), Revise = orange text (`text-orange-600 dark:text-orange-400`)
- `ReviewHistory.tsx`: same green/orange

The extensions section uses primary/outline (no semantic color); the review form uses semantic colors directly. There is no shared "approve/reject" button pair, and the color choices are different between the two flows. Consider a shared `<ConfirmRejectButtons />` or at least unify which color carries which meaning.

---

## 4. Medium-impact inconsistencies (design system drift)

### 4.1 Textarea — 4 files, 3 class strings, 0 primitives

`src/components/ui/` has no `Textarea.tsx`. Raw `<textarea>` appears with different class strings in:

| File | Class (key parts) |
| --- | --- |
| `ReviewForm.tsx:160` | `flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` |
| `AssignmentDetailsForm.tsx:80-84` | `flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 min-h-[120px] resize-y ...` |
| `ApproveExtensionDialog.tsx:90` | `mt-1 flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50` |
| `RejectExtensionDialog.tsx:95` | identical to `ApproveExtensionDialog` except `min-h-[80px]` |

Differences: `rounded-lg` vs `rounded-md`; `bg-background` vs `bg-transparent`; `ring-2 ring-offset-2` vs `ring-1`; `shadow-sm` only in the dialog/form. A single `Textarea` primitive (matching the `Input` primitive's pattern) is the right fix.

### 4.2 Form label — 3 different ways

| File | Pattern |
| --- | --- |
| `AssignmentDetailsForm.tsx:51,71,93` | `<Label ... className="text-sm font-semibold text-foreground">` |
| `ReviewForm.tsx:153,166,189` | `<Label htmlFor="...">` (uses default className) |
| `ApproveExtensionDialog.tsx:82,87` | raw `<label htmlFor="..." className="text-sm font-medium text-muted-foreground">` |
| `RejectExtensionDialog.tsx:87` | raw `<label>` (same as approve) |

`Label` is used inconsistently and even bypassed with raw `<label>`. Standardize on `<Label>` (no className) or document the override pattern.

### 4.3 Skeleton — primitive exists, never used

`src/components/ui/skeleton.tsx` exists. **Zero instructor components use it.** All skeleton markup re-implements `bg-muted animate-pulse` divs by hand:

- `AssignmentLoadingSkeleton.tsx` — 6 `data-testid="skeleton"` divs with hand-written `bg-muted animate-pulse` classes
- `ReviewQueueSkeleton.tsx` — 13 `data-testid="skeleton"` divs, same hand-written pattern
- `PendingExtensionsSection.tsx:72` — `<div className="h-16 animate-pulse rounded-md bg-muted" />` (no testid)

Replace with `<Skeleton className="h-X w-Y" />`.

### 4.4 Date / time formatting — two strategies, neither complete

| Pattern | Files |
| --- | --- |
| `format(new Date(x), 'MMM d, yyyy')` (date-fns) | `AssignmentCard.tsx:69`, `instructor/assignments/$id.tsx:257,293`, `StudentAssignmentCard.tsx:58` |
| `format(new Date(x), 'MMMM d, yyyy h:mm a')` | `ReviewStep.tsx:94` |
| `format(new Date(x), 'MMM d, yyyy HH:mm')` | `instructor/assignments/$id.tsx:293` |
| `new Date(x).toLocaleDateString()` (browser locale, no i18n) | `ReviewFilePreview.tsx:38`, `ReviewHistory.tsx:46`, `VerificationQueueItem.tsx:35` |

Three issues:
- Three different date-fns format strings are in use. Pick one default and document it (the `'MMM d, yyyy'` short form is the most common — use that everywhere; introduce a longer format only for the wizard's confirm step which actually shows time).
- `toLocaleDateString()` ignores the user's selected locale. The student picked Indonesian; the page still renders in their browser locale. Replace with a single shared `formatDate()` helper that accepts a locale parameter.
- `ReviewHistory.tsx:46` embeds the date inside a `<Clock>` icon line with `toLocaleDateString()` — the i18n key for "Review history" is present, but the date itself isn't translated.

### 4.5 Hardcoded English strings (bypass i18n)

- `AssignmentWizard.tsx:131,135,138,144,146,151,159,212,216` — 9 hardcoded English validation error messages
- `ReviewForm.tsx:59,66` — `'Failed to upload feedback file'`
- `ReviewQueuePagination.tsx:21` and `TemplatePagination.tsx:21` — `t('common.page')` + hardcoded `' of '` + page number
- `ReviewHistory.tsx:35` — hardcoded `': '` between label and value
- `ApproveExtensionDialog.tsx:77` and `RejectExtensionDialog.tsx:82` — `t('extensions.queue.reason' as TranslationKey)` — `as TranslationKey` cast indicates the key is missing from the typed translation surface

### 4.6 Hardcoded color tokens (bypassing design system)

| File | Line | Value | Should be |
| --- | --- | --- | --- |
| `AssignmentCard.tsx` | 28 | `from-primary to-violet-500` | `from-primary to-secondary` or remove |
| `ReviewForm.tsx` | 132 | `text-green-600 dark:text-green-400` | `text-success` |
| `ReviewForm.tsx` | 145 | `text-orange-600 dark:text-orange-400` | `text-warning` |
| `ReviewHistory.tsx` | 32 | `text-green-500` | `text-success` |
| `ReviewHistory.tsx` | 34 | `text-orange-500` | `text-warning` |
| `instructor/reviews/$submissionId.tsx` | 95 | `text-green-500` | `text-success` |
| `PendingExtensionsSection.tsx` | 29-32 | `bg-blue-100`, `bg-purple-100`, `bg-green-100`, `bg-gray-100` with `dark:` variants | `Badge` variants (`info`, custom, `success`, `outline`) or new design tokens |

`MetricCard` is the only place that reads design tokens cleanly. Every other colored element reaches for raw Tailwind palette.

### 4.7 Page title missing `text-foreground`

Already covered in §3.1, but worth restating: `instructor/dashboard.tsx:23` and `instructor/reviews/index.tsx:65` are missing `text-foreground` on the `<h1>`. Pure inheritance works, but consistency matters.

### 4.8 Section headings within a page

`instructor/assignments/$id.tsx` uses two different section-heading styles:
- Line 267: `<h3 className="text-base font-semibold text-foreground border-b pb-2">`
- Line 303: `<h2 className="font-display text-2xl text-foreground">`
- Line 391: `<h2 className="text-lg font-semibold text-foreground">` (consultations section)

`ReviewStep.tsx:42`, `AssignmentDetailsForm.tsx:40` use `text-xl font-bold tracking-tight text-foreground`. `ReviewFilePreview.tsx`, `ReviewForm.tsx`, `ReviewHistory.tsx` use `text-sm font-semibold text-foreground`.

Five different section heading styles across 6 files. The `<CardHeader><CardTitle>` pattern is well-defined; use it for the larger sections and reserve a single utility class for inline sub-headings.

### 4.9 Hand-rolled tabs

`instructor/assignments/$id.tsx:311-357` is a hand-rolled tab control with `border-b-2 border-primary border-transparent` active indicator. It works, but:
- `shadcn` `Tabs` primitives are not in the project's `ui/`. Confirm whether the project is intentionally avoiding them; if not, either import them or extract this into a small `<Tabs />` wrapper.
- The active/inactive class strings are duplicated 3 times (one per tab). They should be computed from an array.

### 4.10 Avatar circle in sidebar vs header

- `instructor-sidebar.tsx:132` avatar: `bg-sidebar-primary text-sidebar-primary-foreground`
- `app-header.tsx:64` avatar: `bg-primary text-primary-foreground`

Same user identity, different color treatment. In light mode the sidebar avatar may be effectively the same color (sidebar-primary is also primary-derived), but in dark mode or with custom themes the two will diverge. Pick one.

### 4.11 Redundant className on the "primary" CTA

`instructor/assignments/index.tsx:106` and `AssignmentWizard.tsx:355,365` all add `className="bg-primary hover:bg-primary/95 text-primary-foreground font-semibold"` to a `<Button>` (no `variant` → default). The default `Button` already renders exactly that. The className is dead weight, and any future tweak to the default button has to be made in 3 places.

---

## 5. Low-impact / nits

| # | Location | Issue |
| --- | --- | --- |
| N1 | `instructor/assignments/$id.tsx:210,304` | Same i18n key `instructorAssignments.details.studentsProgress` is used for two unrelated things: a stat-card label (total student count) and a section heading (the "Student progress" table title). These need separate keys. |
| N2 | `instructor/assignments/$id.tsx:138-152` | "Not found" state is hand-rolled instead of `EmptyState`. |
| N3 | `instructor/assignments/$id.tsx:84` (unused import) | `import { Card } from '@/components/ui/card'` and `Badge` are imported but not all are used in the visible render path — verify. |
| N4 | `instructor/assignments/$id.tsx` (446 lines) | Single page component exceeds practical readability; mixing data loading, calculations, header, overview cards, tab nav, all tab content. Closer to the 500-line AGENTS limit and approaching the threshold where it should be split. |
| N5 | `instructor/assignments/$id.tsx:189` | Pending consultations/extensions counts use `<Badge variant="default">` for both — `default` is `bg-primary`, which is the strongest color in the system. A count badge should be `secondary` or `outline` to avoid stealing attention from the tab label itself. |
| N6 | Every route loader | The `// @ts-expect-error - handler type inference limitation` comment appears in every route. This is a systemic issue with the `createServerFn` type pattern in `src/server/<feature>.ts`, not a per-call problem. Fix in the server function pattern rather than per-route. |
| N7 | `instructor/assignments/index.tsx:54` & `reviews/index.tsx:42` | `(data as unknown as { items?: ... } \| { assignments?: ... })?.items ?? []` — a defensive cast that hides the real type. If the loader is typed, the cast disappears. |
| N8 | `instructor/assignments/$id.tsx:202-262` | The 4 overview cards have repetitive `<div className="relative overflow-hidden rounded-md border bg-card p-5 shadow-sm">` markup. The whole row is a candidate for the `MetricCard` primitive (which already has color variants). |
| N9 | `StudentAssignmentCard.tsx:25` | Uses `rounded-xl` while every instructor card uses `rounded-md/lg`. Same component concept, different radius. |
| N10 | `instructor/dashboard.tsx` (route) | Wraps a single `<InstructorDashboard data={data} />` in a 5-line `space-y-6` div. The page wrapper is unnecessary; the component itself already has a `space-y-6` root. |
| N11 | `InstructorDashboard.tsx:73-84` | The local `getStatusBadgeText` switches on capitalised English status strings (`'Submitted'`, `'Pass'`, `'Under Review'`) — these are not DB values, they're display strings, but they live in TS code, not in i18n keys. The `'default'` case returns the "revise" translation, which is wrong if a new status is added. |
| N12 | `instructor/assignments/new.tsx:39` | Wizard wrapper has a one-off `rounded-xl border bg-card p-6 shadow-sm` wrapper around `<AssignmentWizard />`. The wizard could own its own container. |
| N13 | `instructor/dashboard.tsx:23`, `instructor/reviews/index.tsx:65` | `<h1>` is missing `text-foreground`. (See §3.1, §4.7.) |
| N14 | `VerificationQueueItem.tsx:35` | `new Date(consultation.createdAt).toLocaleDateString()` — same i18n issue as N-date above. |

---

## 6. What is working well

To keep this audit balanced, the following patterns are **already consistent** and should be treated as the model for the rest:

- **`Sidebar` + `AppHeader` shell** is fully shared with proper role-based logic. Mobile overlay, close button, and active-link detection are identical between instructor and (presumably) student/admin. This is the gold standard for the rest of the UI.
- **`EmptyState` primitive** is used in most empty cases and is well-defined.
- **`Badge` variants** are comprehensive (`default`, `secondary`, `destructive`, `success`, `warning`, `error`, `info`, `outline`, `ghost`, `link`, `dot`) — design system is in good shape here.
- **`MetricCard`** uses design tokens cleanly. It is the model for "stat tile".
- **`ApproveExtensionDialog` / `RejectExtensionDialog`** use the proper `Dialog` primitive with `DialogHeader/Footer/Title/Description`. These are the model for confirmation dialogs.
- **`Settings` page** is fully shared across roles.
- **Pending components** are used in every route loader for skeletons.
- **Server function split** (`*.ts` for schemas + stubs, `*.server.ts` for handlers) is uniform.
- **`@tanstack/react-table`** is used in `ProgressTable` and `ReviewQueueTable` consistently.

---

## 7. Recommended approach

The audit found **3 real fixes worth doing as a single Track** plus a long tail of small nits. Proposed Track structure (the user can choose to scope it down or up):

### Track: "Instructor UI consistency" — proposed scope

**Goal:** Remove the high-impact inconsistencies listed in §3, add the missing primitives, unify the SLA badge, fix the review-queue filter bug.

**Must-have (high value, low risk):**

1. Extract `<PageHeader title subtitle action />` primitive; adopt in 7 routes.
2. Extract `<BackLink to search />` primitive; adopt in 3 places.
3. Extract `<TemplateTypeBadge />` primitive; adopt in 3 instructor sites + offer to student.
4. Unify the two SLA badge sources — delete the local one in `InstructorDashboard.tsx` and use the shared one.
5. Fix the `ReviewQueueFilters` empty-array bug (load the instructor's assignments into the filter).
6. Replace `ReviewQueueFilters`'s raw `<select>` with the existing `Select` primitive.
7. Replace all 3 textarea implementations with a new `<Textarea>` primitive matching `Input`.
8. Replace all skeleton markup with the existing `<Skeleton>` primitive.
9. Add `description?: string` to `EmptyState`; drop the `description=""` calls and the raw-div empty cases in `assignments/$id.tsx`, `reviews/$submissionId.tsx`, and `PendingExtensionsSection`.
10. Replace hardcoded colors (`green-500/600`, `orange-500/600`, `violet-500`, `blue-100/purple-100/green-100/gray-100`) with `text-success` / `text-warning` / design tokens or `Badge` variants.
11. Replace all `format(x, '...')` and `toLocaleDateString()` calls with a single `formatDate(date, locale, style)` helper in `src/lib/`.
12. Remove `// @ts-expect-error - handler type inference limitation` and fix the underlying `createServerFn` type pattern so route loaders can use the real type. (This is a real refactor; the comment hides a typing issue at every call site.)
13. Adopt the `Card` primitive in `ProgressTable`, `ReviewFilePreview`, `ReviewHistory`, `ReviewForm`, `PendingExtensionsSection`, and the 4 overview tiles on `instructor/assignments/$id.tsx`.
14. Unify the "pending count" badge/span in tabs and extension section.

**Should-have (medium value):**

15. Split `instructor/assignments/$id.tsx` into a thin route + per-tab subcomponents.
16. Extract a `<RefreshButton />` and a `useRefreshSearch` hook to dedupe refresh behavior.
17. Move the inline "Page X of Y" into a single `<Pagination currentPage totalPages onPageChange />` and dedupe `TemplatePagination` / `ReviewQueuePagination`.
18. Add i18n keys for the 9 hardcoded validation messages in `AssignmentWizard` and the 2 in `ReviewForm`.
19. Add a missing `extensions.queue.reason` key (currently used via `as TranslationKey` cast).
20. Add separate i18n keys for the two "students progress" usages in `instructor/assignments/$id.tsx` (N1).

**Nice-to-have (low value):**

21. Align the student `AssignmentCard` corner radius with the instructor cards.
22. Replace the hand-rolled tabs on `instructor/assignments/$id.tsx` with a shared `<Tabs>` wrapper.
23. Drop the redundant `className="bg-primary ..."` on default-variant buttons.

**Estimated scope:** 1 small package of primitives + 1 round of mechanical adoption across ~15 files + 1 server-function type fix. Coverage thresholds should not regress; existing tests should continue to pass.

---

## 8. What this audit does not cover

- **Cross-role consistency** (instructor vs student vs admin). This audit is scoped to the instructor surface only. The student and admin surfaces likely have similar drift and would benefit from a follow-up audit. Spot checks during this audit suggest the student `AssignmentCard` (`StudentAssignmentCard.tsx`) and the instructor `AssignmentCard` are the most divergent pair.
- **Accessibility (WCAG 2.1 AA)** — only ARIA/aria-label gaps surfaced incidentally (refresh button missing aria-label, pagination aria-labels inconsistent).
- **Responsive behavior** at mobile breakpoints — only the high-level layout shell was inspected.
- **Internationalization completeness** — only the cases of *hardcoded English* and *missing keys* were flagged. The full locale coverage was not verified.
- **Performance** — no profiling, render counts, or memo audit was performed.

---

*Generated by Conductor in read-only audit mode. No code was modified.*
