<protect>
# Track: UI Consistency for Student-Facing UI

## Overview

Conduct a focused visual consistency pass across all student-facing routes and components. The existing Tailwind v4 design system (CSS variables, semantic colors, Fraunces/DM Sans typography, dark mode) is already in place, but its execution is inconsistent across the student dashboard, assignments list, assignment detail, submission pages, consultations, extensions, settings, and shared layout components. This track cleans up those inconsistencies without adding new features or changing business logic.

## Type

Refactor / Chore (frontend-only UI cleanup)

## Dependencies

- Track 3.2 — Student Assignment Viewing
- Track 4.1 — File Upload & Submission
- Track 5.1 — Review Queue & Decision
- Track 6.1 — Consultation Logging & Verification
- Track 1.3 — Deadline Extension Workflow
- Track 7.2 — Role-Based Dashboards
- Existing design tokens in `src/app/global.css`

## Functional Requirements

### FR-1 — Unify Template-Type Badge

Every occurrence of the assignment/template type label must use the same shared `Badge` component and variant.

- `AssignmentDetailHeader.tsx`: replace `Badge variant="default"` with the chosen category variant.
- `StudentAssignmentCard.tsx`: replace the inline `text-[10px] ... uppercase` span with the shared `Badge`.
- `StudentDashboard.tsx`: replace the inline `text-xs ... uppercase` span in active-assignment cards with the shared `Badge`.
- Add i18n keys if needed for the badge label.

### FR-2 — Replace Hardcoded Colors with Semantic Tokens

`CheckpointCard.tsx` currently uses literal Tailwind colors (`green-500`, `red-600`, etc.). These must be replaced with the existing CSS semantic tokens so dark mode and theming work correctly.

- Passed state: use `--success` tokens (`border-l-success`, `bg-success/10`, etc.).
- Submitted state: use `--info` tokens.
- Under Review state: use `--warning` tokens.
- Revise state: use `--error` tokens.
- Unlocked state: use `--primary` tokens.
- Locked state: use `--muted` / `--border` tokens.
- Blocking reasons and overdue gating text must use `--warning` (not `--error`), because they describe expected gating logic, not system errors.

### FR-3 — Fix Progress Percentage Display

The progress label must never render as a bare `%` when the value is missing.

- In `StudentAssignmentCard.tsx`, render `{assignment.progressPercent ?? 0}%`.
- In `/student/assignments/$id.tsx`, render `{data.progressPercent ?? 0}%`.
- Extract a small shared `Progress` component (or use the existing shadcn primitive if available) and use it in both the assignment card and the dashboard active-assignment card for visual consistency.

### FR-4 — Tighten Empty States Inside Cards

The shared `EmptyState` component adds excessive vertical padding when used inside dashboard cards, creating large areas of dead space.

- Add an optional `compact` prop (or equivalent sizing variant) to `EmptyState`.
- Use the compact variant for all dashboard widget empty states (`StudentDashboard.tsx`).
- Keep the default padded variant for full-page empty states.

### FR-5 — Improve Assignment Detail Tabs

The custom underline tabs on `/student/assignments/$id.tsx` are too subtle and do not clearly indicate the active state.

- Use the project shadcn `Tabs` primitive if available, or strengthen the custom tabs with clearer active styling (e.g., `px-3`, stronger bottom border, muted background on hover).
- Ensure the active tab meets WCAG 2.1 AA contrast requirements in both light and dark modes.

### FR-6 — Refine Sidebar Active State

The active item in the student sidebar uses a rounded pill with a 3px left border, which looks visually "indented" rather than highlighted.

- In `student-sidebar.tsx`, remove the left border accent or make the active background full-width.
- Ensure hover and focus-visible states remain accessible.
- Apply the same treatment to `instructor-sidebar.tsx` and `admin-sidebar.tsx` if the same pattern exists and is within scope.

### FR-7 — Remove Rogue Gradient Accent

`StudentAssignmentCard.tsx` uses a hardcoded `violet-500` gradient on the top bar and progress bar. No other component uses this accent.

- Remove the `to-violet-500` gradient.
- Use `bg-primary` / `from-primary to-primary` consistently, or introduce a documented brand-gradient token if the gradient is intentionally desired.

### FR-8 — Typography Clarification

`CardTitle` currently renders in Fraunces (serif), which competes with the sans-serif body text in card-dense UIs.

- Change `CardTitle` to use the sans-serif font stack (`font-sans`) while keeping page headings (`h1–h2`) in Fraunces.
- Verify no unintended side effects on non-student pages.

## Non-Functional Requirements

- **i18n:** All new labels must support English and Indonesian via `typesafe-i18n`.
- **Accessibility:** All changes must maintain or improve WCAG 2.1 AA contrast and focus states.
- **Dark mode:** All color changes must be verified in both light and dark themes.
- **Responsiveness:** Layouts must remain usable at 320px–1920px.
- **Test-Driven Development:** Write or update tests before implementing changes.

## Acceptance Criteria

1. The template-type label looks identical in the dashboard card, assignment card, and assignment detail header.
2. `CheckpointCard` uses only semantic color tokens; no literal Tailwind colors remain for state styling.
3. Progress percentage always renders a numeric value followed by `%`, never bare `%`.
4. Dashboard widget empty states are compact and no longer dominate the card height.
5. Assignment detail tabs have a clearly distinguishable active state.
6. Sidebar active item is highlighted without an awkward left-border indentation.
7. Assignment card no longer uses a rogue `violet-500` gradient.
8. Card titles use sans-serif; page headings remain serif.
9. All existing tests pass and new component tests cover the changed UI behavior.
10. `pnpm typecheck`, `pnpm lint`, and `pnpm test` pass without errors.

## Out of Scope

- New features or workflows (e.g., new pages, new user roles, new server functions).
- Instructor or admin functionality beyond shared components and sidebar styling.
- Changes to the design token values themselves (only how components use existing tokens).
- Landing page or auth pages.
</protect>
