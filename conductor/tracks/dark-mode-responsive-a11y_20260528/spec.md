# Track: Dark Mode, Responsive UI & Accessibility

## Overview

Conduct a comprehensive audit and fix pass across ALL existing pages and components to ensure proper dark mode styling, responsive layout at 320px–1920px, and WCAG 2.1 AA accessibility compliance. Theme infrastructure (ThemeToggle, use-theme hook, ThemeScript, skip-to-content link, global.css CSS variables) was established in Track 1.1 — this track applies those foundations to every page/component.

## Dependencies

All prior phases (every page needs theme + responsive treatment).

## Functional Requirements

### FR-1: Dark Mode Theme Pass

- Audit ALL existing component files for missing `dark:` Tailwind variants
- Ensure all pages render correctly in dark mode (no invisible text, no contrast failures)
- Fix any pages/components that use hardcoded colors instead of CSS custom properties (`--background`, `--foreground`, `--muted`, `--card`, `--border`, etc.) or semantic color tokens (`bg-card`, `text-muted-foreground`, etc.)
- Verify all semantic color tokens (`--success`, `--warning`, `--error`, `--info`) have corresponding dark mode values and are used consistently
- Ensure all shadcn/ui primitives (Dialog, Sheet, DropdownMenu, Select, Input, Button, Table, Card, etc.) have working `dark:` class variants
- **Already done (Track 1.1):** ThemeToggle component, use-theme hook (localStorage + system preference), ThemeScript (prevents flash), skip-to-content link, global.css CSS variables for both themes, use-theme unit tests

### FR-2: Responsive Layout Pass

- Audit ALL route pages for mobile responsiveness at 320px–1920px viewport widths
- Add responsive grid classes (`sm:`, `md:`, `lg:`) to layouts that are single-column on mobile
- Ensure all tables horizontally scroll on small viewports
- Ensure all dialog/sheet overlays are usable on mobile (full-screen on small screens if needed)
- Ensure touch targets meet minimum 44x44px for all interactive elements
- Verify sidebar collapses/transforms appropriately on mobile
- Fix any horizontal overflow issues

**Pages requiring responsive audit:**

- Auth pages: `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/setup-password`
- Admin: `/admin/dashboard`, `/admin/users`, `/admin/templates`
- Instructor: `/instructor/dashboard`, `/instructor/assignments` (list, new, detail), `/instructor/reviews` (list, detail)
- Student: `/student/dashboard`, `/student/assignments` (list, detail, checkpoint detail)

### FR-3: Accessibility Pass

- Ensure keyboard navigation works for ALL interactive elements (buttons, links, form controls, dropdowns, dialogs)
- Ensure visible focus indicators (`focus-visible:ring-*` classes) on all interactive elements
- Ensure proper heading hierarchy (`h1` → `h2` → `h3`, no skipping levels) on every page
- Add ARIA labels (`aria-label`) to icon-only buttons (theme toggle, language switcher, close/delete actions)
- Add ARIA live regions (`aria-live="polite"`) for dynamic content: form validation errors, submission status updates, notification count changes
- Ensure form validation errors are connected to inputs via `aria-describedby`
- Ensure all images/icons have appropriate `alt` text or `aria-hidden="true"`
- Ensure dialogs and sheets have proper focus trapping on open
- Verify screen reader can navigate page content in logical order
- Verify color contrast meets WCAG 2.1 AA minimum (4.5:1 for normal text, 3:1 for large text)
- **Already done (Track 1.1):** Skip-to-content link in root layout as first focusable element, some shadcn/ui primitives have built-in ARIA

## Non-Functional Requirements

- **No regressions:** All existing tests must continue to pass after changes
- **Smooth transitions:** Theme toggle should use CSS transitions (`transition-colors`) for smooth switching
- **No layout shift:** Responsive changes must not cause layout shift on desktop viewports
- **Coverage:** Maintain >80% code coverage; add a11y-specific unit tests

## Acceptance Criteria

- [ ] Theme toggle switches between light and dark modes with smooth CSS transitions
- [ ] Refreshing the page preserves the theme preference (localStorage)
- [ ] System preference (prefers-color-scheme) is respected on first visit
- [ ] All pages render correctly in dark mode — no invisible text or broken colors
- [ ] Dashboard timeline is readable on a 375px mobile viewport
- [ ] File upload drag zone works on touch devices
- [ ] Tables horizontally scroll on small viewports (no overflow cutoff)
- [ ] Tab key navigates through all form fields, buttons, and links in logical order
- [ ] Focus ring is visible on all interactive elements
- [ ] Skip-to-content link is the first focusable element on page load
- [ ] Screen reader announces form validation errors (`aria-live` region)
- [ ] All icon-only buttons have `aria-label` attributes
- [ ] Color contrast ratios meet WCAG 2.1 AA minimum (test with browser dev tools)
- [ ] All existing tests pass; new a11y unit tests added for ARIA attributes and focus management
- [ ] Code coverage maintained at >80%

## Out of Scope

- E2E accessibility tests with Playwright (deferred to v2)
- Dedicated accessibility settings page (deferred to profile/settings v2)
- Font size scaling controls (browser default respected)
- Redoing theme infrastructure already completed in Track 1.1
