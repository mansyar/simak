<protect>
# Track: UI Consistency for Student-Facing UI — Implementation Plan

## Phase 1: Shared Component Foundation

- [ ] Task: Read `spec.md` for this track to confirm scope and acceptance criteria before starting implementation.
- [ ] Task: Audit existing shadcn/ui primitives for reusability (`Progress`, `Tabs`, `Badge` variants).
  - [ ] Check if `src/components/ui/progress.tsx` exists; if not, scaffold a minimal `Progress` component.
  - [ ] Check if `src/components/ui/tabs.tsx` exists and is suitable for assignment detail tabs.
  - [ ] Verify `Badge` variants support a category-style treatment (info/outline) or add a dedicated variant.
- [ ] Task: Update `EmptyState` component to support a compact layout.
  - [ ] Add `compact?: boolean` prop (or `size` variant) that reduces padding and icon size.
  - [ ] Write/update unit tests for `EmptyState` default and compact states.
  - [ ] Implement the prop and verify className output.
- [ ] Task: Update `CardTitle` to use sans-serif typography.
  - [ ] Change `font-heading` to `font-sans` in `src/components/ui/card.tsx`.
  - [ ] Write/update unit test asserting `CardTitle` does not use a serif font class.
  - [ ] Implement the change and verify no regressions in page headings.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Shared Component Foundation' (Protocol in workflow.md)

## Phase 2: Assignment Card & Dashboard Cleanup

- [ ] Task: Read `spec.md` for this track to confirm scope and acceptance criteria before starting implementation.
- [ ] Task: Unify the template-type badge across student assignment surfaces.
  - [ ] Write failing tests for `StudentAssignmentCard`, `StudentDashboard`, and `AssignmentDetailHeader` asserting the badge uses a shared `Badge` variant.
  - [ ] Replace inline template-type spans with the shared `Badge` variant in all three components.
  - [ ] Add or update i18n keys if badge labels need translation.
- [ ] Task: Fix progress percentage display and standardize the progress bar.
  - [ ] Write failing tests asserting progress renders as `<number>%` even when the value is missing.
  - [ ] Update `StudentAssignmentCard.tsx` to use `{assignment.progressPercent ?? 0}%`.
  - [ ] Update `/student/assignments/$id.tsx` to use `{data.progressPercent ?? 0}%`.
  - [ ] Replace inline progress bars with the shared `Progress` component in `StudentAssignmentCard.tsx` and `StudentDashboard.tsx`.
- [ ] Task: Remove the rogue `violet-500` gradient accent.
  - [ ] Write failing test asserting `StudentAssignmentCard` does not contain `violet-500` or `to-violet-500` classes.
  - [ ] Replace gradient top bar and progress bar with `bg-primary` / `from-primary to-primary`.
  - [ ] Implement the change.
- [ ] Task: Apply compact `EmptyState` to dashboard widgets.
  - [ ] Update `StudentDashboard.tsx` to pass the compact prop to all four `EmptyState` usages.
  - [ ] Verify visually that empty dashboard widgets no longer dominate card height.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Assignment Card & Dashboard Cleanup' (Protocol in workflow.md)

## Phase 3: Assignment Detail & Checkpoint Timeline

- [ ] Task: Read `spec.md` for this track to confirm scope and acceptance criteria before starting implementation.
- [ ] Task: Replace hardcoded colors in `CheckpointCard.tsx` with semantic tokens.
  - [ ] Write failing tests asserting `CheckpointCard` state containers use semantic color classes (`border-l-success`, `bg-success/10`, etc.) and not literal Tailwind colors (`green-500`, `red-600`, etc.).
  - [ ] Update `stateConfig` to use semantic tokens for all six checkpoint states.
  - [ ] Verify dark mode contrast for each state.
- [ ] Task: Fix blocking-reason color semantics.
  - [ ] Write failing test asserting blocking reasons use `text-warning` (or `text-warning/90`) instead of `text-red-600`.
  - [ ] Replace red text on blocking reasons and consultation insufficiency with warning-colored text.
  - [ ] Keep overdue badge as `destructive` because it represents an actual problem state.
- [ ] Task: Improve assignment detail tab visual hierarchy.
  - [ ] Write failing tests asserting active tab has stronger visual indicators.
  - [ ] Replace custom underline tabs with the shadcn `Tabs` primitive if available; otherwise strengthen custom tabs with `px-3`, stronger bottom border, and hover background.
  - [ ] Ensure active tab meets WCAG 2.1 AA contrast in both themes.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Assignment Detail & Checkpoint Timeline' (Protocol in workflow.md)

## Phase 4: Layout & Cross-Cutting Student Routes

- [ ] Task: Read `spec.md` for this track to confirm scope and acceptance criteria before starting implementation.
- [ ] Task: Refine sidebar active-state styling.
  - [ ] Write failing tests asserting active nav item does not rely on a left border indent.
  - [ ] Update `student-sidebar.tsx` active item to use full-width background highlight without `border-l-[3px]`.
  - [ ] Apply the same pattern to `instructor-sidebar.tsx` and `admin-sidebar.tsx` if the identical style exists.
  - [ ] Ensure hover and focus-visible states remain accessible.
- [ ] Task: Audit remaining student routes for hardcoded colors and token misuse.
  - [ ] Scan `/student/settings`, submission pages, consultation forms, extension request UI, and empty states.
  - [ ] Replace any remaining literal colors (e.g., `red-600`, `green-500`) with semantic tokens.
  - [ ] Replace any remaining inline badge spans with the shared `Badge` component.
- [ ] Task: Regenerate i18n types and verify translations.
  - [ ] Run `pnpm generate:i18n`.
  - [ ] Add EN and ID translations for any new keys introduced.
  - [ ] Run `pnpm typecheck`.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Layout & Cross-Cutting Student Routes' (Protocol in workflow.md)

## Phase 5: Testing & Quality Gates

- [ ] Task: Read `spec.md` for this track to confirm scope and acceptance criteria before starting implementation.
- [ ] Task: Write/update component tests for all changed components.
  - [ ] `StudentAssignmentCard`
  - [ ] `StudentDashboard`
  - [ ] `AssignmentDetailHeader`
  - [ ] `CheckpointCard`
  - [ ] `CheckpointTimeline` (if changed)
  - [ ] `EmptyState`
  - [ ] `CardTitle`
  - [ ] Sidebar active-state logic
- [ ] Task: Run automated quality gates.
  - [ ] `pnpm typecheck`
  - [ ] `pnpm lint`
  - [ ] `pnpm test`
  - [ ] `pnpm test -- --coverage` (verify coverage thresholds)
- [ ] Task: Manual visual verification.
  - [ ] Verify student dashboard in light and dark modes.
  - [ ] Verify assignment list in light and dark modes.
  - [ ] Verify assignment detail tabs, checkpoint timeline, and empty states in both modes.
  - [ ] Verify sidebar active state on desktop and mobile.
  - [ ] Check responsive behavior at 320px, 768px, and 1920px.
- [ ] Task: Conductor - User Manual Verification 'Phase 5: Testing & Quality Gates' (Protocol in workflow.md)
</protect>
