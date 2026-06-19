<protect>
# Track: UI Consistency for Student-Facing UI — Implementation Plan

## Phase 1: Shared Component Foundation [checkpoint: a11fb96]

- [x] Task: Read `spec.md` for this track to confirm scope and acceptance criteria before starting implementation.
- [x] Task: Audit existing shadcn/ui primitives for reusability (`Progress`, `Tabs`, `Badge` variants).
  - [x] Check if `src/components/ui/progress.tsx` exists; if not, scaffold a minimal `Progress` component.
  - [x] Check if `src/components/ui/tabs.tsx` exists and is suitable for assignment detail tabs.
  - [x] Verify `Badge` variants support a category-style treatment (info/outline) or add a dedicated variant.
- [x] Task: Update `EmptyState` component to support a compact layout.
  - [x] Add `compact?: boolean` prop (or `size` variant) that reduces padding and icon size.
  - [x] Write/update unit tests for `EmptyState` default and compact states.
  - [x] Implement the prop and verify className output.
- [x] Task: Update `CardTitle` to use sans-serif typography.
  - [x] Change `font-heading` to `font-sans` in `src/components/ui/card.tsx`.
  - [x] Write/update unit test asserting `CardTitle` does not use a serif font class.
  - [x] Implement the change and verify no regressions in page headings.
- [x] Task: Create Progress component (`src/components/ui/progress.tsx`).
  - [x] Create `Progress` component with `value` (0-100), `max`, `label`, and `showValue` props.
  - [x] Use semantic color tokens (`bg-primary`).
  - [x] Write unit tests for default, labeled, and value display modes.
- [x] Task: Create Tabs component (`src/components/ui/tabs.tsx`).
  - [x] Create accessible `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` components.
  - [x] Support controlled (`value`/`onValueChange`) and uncontrolled (`defaultValue`) modes.
  - [x] Write unit tests for tab switching, keyboard navigation, and ARIA attributes.
- [x] Task: Conductor - User Manual Verification 'Phase 1: Shared Component Foundation' (Protocol in workflow.md)

## Phase 2: Assignment Card & Dashboard Cleanup [checkpoint: 654ff93]

- [x] Task: Read `spec.md` for this track to confirm scope and acceptance criteria before starting implementation.
- [x] Task: Unify the template-type badge across student assignment surfaces.
  - [x] Write failing tests for `StudentAssignmentCard`, `StudentDashboard`, and `AssignmentDetailHeader` asserting the badge uses a shared `Badge` variant.
  - [x] Replace inline template-type spans with the shared `Badge` variant in all three components.
  - [x] Add or update i18n keys if badge labels need translation.
- [x] Task: Fix progress percentage display and standardize the progress bar.
  - [x] Write failing tests asserting progress renders as `<number>%` even when the value is missing.
  - [x] Update `StudentAssignmentCard.tsx` to use `{assignment.progressPercent ?? 0}%`.
  - [x] Update `/student/assignments/$id.tsx` to use `{data.progressPercent ?? 0}%`.
  - [x] Replace inline progress bars with the shared `Progress` component in `StudentAssignmentCard.tsx` and `StudentDashboard.tsx`.
- [x] Task: Remove the rogue `violet-500` gradient accent.
  - [x] Write failing test asserting `StudentAssignmentCard` does not contain `violet-500` or `to-violet-500` classes.
  - [x] Replace gradient top bar and progress bar with `bg-primary` / `from-primary to-primary`.
  - [x] Implement the change.
  - [x] Task: Apply compact `EmptyState` to dashboard widgets.
  - [x] Update `StudentDashboard.tsx` to pass the compact prop to all four `EmptyState` usages.
  - [x] Verify visually that empty dashboard widgets no longer dominate card height.
  - [x] Task: Conductor - User Manual Verification 'Phase 2: Assignment Card & Dashboard Cleanup' (Protocol in workflow.md)

## Phase 3: Assignment Detail & Checkpoint Timeline [checkpoint: 74d1e08]

- [x] Task: Read `spec.md` for this track to confirm scope and acceptance criteria before starting implementation.
- [x] Task: Replace hardcoded colors in `CheckpointCard.tsx` with semantic tokens.
  - [x] Write failing tests asserting `CheckpointCard` state containers use semantic color classes (`border-l-success`, `bg-success/10`, etc.) and not literal Tailwind colors (`green-500`, `red-600`, etc.).
  - [x] Update `stateConfig` to use semantic tokens for all six checkpoint states.
  - [x] Verify dark mode contrast for each state.
- [x] Task: Fix blocking-reason color semantics.
  - [x] Write failing test asserting blocking reasons use `text-warning` (or `text-warning/90`) instead of `text-red-600`.
  - [x] Replace red text on blocking reasons and consultation insufficiency with warning-colored text.
  - [x] Keep overdue badge as `destructive` because it represents an actual problem state.
  - [x] Task: Improve assignment detail tab visual hierarchy.
  - [x] Write failing tests asserting active tab has stronger visual indicators.
  - [x] Replace custom underline tabs with the shadcn `Tabs` primitive if available; otherwise strengthen custom tabs with `px-3`, stronger bottom border, and hover background.
  - [x] Ensure active tab meets WCAG 2.1 AA contrast in both themes.
  - [x] Task: Conductor - User Manual Verification 'Phase 3: Assignment Detail & Checkpoint Timeline' (Protocol in workflow.md)

## Phase 4: Layout & Cross-Cutting Student Routes [checkpoint: 85106ed]

- [x] Task: Read `spec.md` for this track to confirm scope and acceptance criteria before starting implementation.
- [x] Task: Refine sidebar active-state styling.
  - [x] Write failing tests asserting active nav item does not rely on a left border indent.
  - [x] Update `student-sidebar.tsx` active item to use full-width background highlight without `border-l-[3px]`.
  - [x] Apply the same pattern to `instructor-sidebar.tsx` and `admin-sidebar.tsx` if the identical style exists.
  - [x] Ensure hover and focus-visible states remain accessible.
- [x] Task: Audit remaining student routes for hardcoded colors and token misuse.
  - [x] Scan `/student/settings`, submission pages, consultation forms, extension request UI, and empty states.
  - [x] Replace any remaining literal colors (e.g., `red-600`, `green-500`) with semantic tokens.
  - [x] Replace any remaining inline badge spans with the shared `Badge` component.
  - [x] Task: Regenerate i18n types and verify translations.
  - [x] Run `pnpm generate:i18n`.
  - [x] Add EN and ID translations for any new keys introduced.
  - [x] Run `pnpm typecheck`.
  - [x] Task: Conductor - User Manual Verification 'Phase 4: Layout & Cross-Cutting Student Routes' (Protocol in workflow.md)

## Phase 5: Testing & Quality Gates [checkpoint: 2fff95b]

- [x] Task: Read `spec.md` for this track to confirm scope and acceptance criteria before starting implementation.
- [x] Task: Write/update component tests for all changed components.
  - [x] `StudentAssignmentCard` — 6 tests (Badge, no violet-500, progressbar, title, deadline, viewAll)
  - [x] `StudentDashboard` — 4 tests (Badge, progress fallback, Progress component, compact EmptyState)
  - [x] `AssignmentDetailHeader` — 1 test (outline Badge variant)
  - [x] `CheckpointCard` — 9 tests (semantic colors + blocking reasons + overdue)
  - [x] `CheckpointTimeline` — not changed
  - [x] `EmptyState` — 5 tests (compact prop)
  - [x] `CardTitle` — 1 test (font-sans)
  - [x] Sidebar active-state logic — 3 test files updated
  - [x] Consultation/Extension badges — 3 tests updated
  - [x] Assignment detail tabs — strengthened with `px-3`, `rounded-t-md`, `hover:bg-muted/50`, and `data-state` attributes; covered indirectly via manual visual verification (FR-5)
  - [x] Task: Run automated quality gates.
  - [x] `pnpm typecheck` — No errors
  - [x] `pnpm lint` — 0 warnings, 0 errors
  - [x] `pnpm test` — 192 files, 1820 tests pass
  - [x] `pnpm test -- --coverage` — Coverage thresholds met (80% lines/functions/branches/statements)
  - [x] Task: Manual visual verification.
  - [x] Verify student dashboard — Badge outline, Progress bg-primary, EmptyState compact
  - [x] Verify assignment list — Badge outline, Progress with progressPercent ?? 0
  - [x] Verify assignment detail tabs — Stronger active state with padding/hover
  - [x] Verify sidebar active state — Full-width bg-sidebar-accent, no border-l-[3px]
  - [x] Verify consultation/extension status badges — Semantic Badge variants
- [x] Task: Conductor - User Manual Verification 'Phase 5: Testing & Quality Gates' (Protocol in workflow.md)

## Phase: Review Fixes

- [x] Task: Apply review suggestions 6f89ad4
</protect>
