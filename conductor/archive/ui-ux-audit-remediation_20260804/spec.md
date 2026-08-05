# Specification: UI/UX Audit Remediation

## Overview

Remediate the confirmed UI/UX defects identified through static review and authenticated browser testing across SIMAK's public, authentication, shared-shell, student, instructor, admin, settings, notification, and assignment workflows.

The work must preserve SIMAK's existing Warm Academic visual direction, role-based architecture, bilingual behavior, and sequential checkpoint model. It should improve accessibility, responsive behavior, feedback reliability, error recovery, localization, and visual consistency without introducing unrelated product capabilities.

## Goals

- Make every core workflow usable with keyboard, touch, and assistive technology.
- Ensure layouts work from 320px through 1920px without clipped or unreachable controls.
- Distinguish loading, empty, not-found, unauthorized, and server-error states.
- Provide immediate, localized feedback for mutations and failures.
- Eliminate hydration mismatch errors from the application shell.
- Bring public and authenticated surfaces back into alignment with product guidelines.
- Preserve existing role boundaries and business rules.

## Functional Requirements

### 1. Shared shell and navigation

- Implement an accessible mobile navigation drawer with:
  - `aria-expanded`
  - `aria-controls`
  - focus transfer into the drawer
  - Escape-to-close
  - focus return to the trigger
  - inert/hidden background content while open
  - labeled navigation landmarks
- Expose the active route with `aria-current="page"`.
- Ensure sidebar, header, logout, avatar, notification, theme, and language controls have accessible names and states.
- Make page-header titles and action groups wrap or stack at narrow widths.

### 2. Shared controls and interaction semantics

- Ensure primary and frequently used interactive controls have at least 44px touch targets.
- Preserve compact visual styling where appropriate without reducing the clickable area.
- Replace custom tabs with a correct accessible tab pattern or an equivalent mobile-safe control.
- Ensure dialogs and sheets:
  - have correctly labeled close controls
  - constrain long content with scrolling
  - remain usable at 320px
- Make expandable rows, clickable cards, picker items, and selection controls keyboard-operable and semantically stateful.
- Add visible focus states consistently.

### 3. File upload and import workflows

- Make student, instructor feedback, user-import, and template-import file controls keyboard-accessible.
- Use native labels or equivalent accessible button/input relationships.
- Preserve selected files after recoverable failures.
- Always reset upload state after success or failure.
- Provide localized inline validation, progress, success, failure, and retry feedback.

### 4. Loading, error, empty, and mutation states

- Distinguish successful empty results from server, network, authorization, and not-found states.
- Add localized retry actions to major data-loading surfaces.
- Do not convert server errors into empty lists or not-found states.
- Announce dynamic loading, success, and failure states through appropriate live regions.
- Ensure mutation controls expose pending, success, and failure states.
- Preserve form input after validation or server failure.
- Do not expose raw server error strings directly to users.

### 5. Student experience

- Make important dashboard rows actionable:
  - deadlines
  - pending reviews
  - consultations
  - waiting items
- Provide a view-all path when lists are capped.
- Standardize student-facing date and timezone formatting.
- Ensure assignment detail tabs and checkpoint actions work at mobile widths.
- Keep locked-checkpoint explanations clear and actionable.
- Improve discussion errors, deletion confirmation, and message announcements.
- Add appropriate semantics to grade breakdowns, consultation lists, and disclosure controls.

### 6. Instructor experience

- Make assignment cards' click affordance match their actual behavior.
- Fix mobile assignment-header action clipping.
- Label search and filter controls programmatically and visibly where appropriate.
- Make review queue tables usable on mobile.
- Improve review form semantics:
  - fieldset/legend for decisions
  - accessible feedback upload
  - explanatory disabled state
  - retryable errors
  - announced success
- Make assignment wizard selection controls keyboard-operable.
- Expose current wizard step and step count.
- Add progressive disclosure/filtering for large discussion views.

### 7. Admin experience

- Make user and template import dropzones accessible.
- Make import preview expansion controls keyboard-operable.
- Add clear failure and retry states for users, templates, audit log, email queue, and analytics.
- Add confirmation and pending feedback for destructive queue cleanup and deletion actions.
- Improve mobile presentation of wide admin tables.
- Ensure session revoke and other icon-only controls have accessible names.
- Prevent action groups and filters from clipping at narrow widths.

### 8. Notifications and settings

- Improve notification sheet sizing and overflow behavior.
- Add correct tab semantics to All/Unread controls.
- Localize relative timestamps and fallback notification content.
- Ensure unread status is not communicated by color alone.
- Provide a notification-specific empty state.
- Make unknown notification types render safely instead of disappearing.
- Add consistent mutation feedback throughout settings.
- Organize the long settings page with meaningful grouping or in-page navigation.
- Apply reduced-motion preferences to all nonessential transitions and animations.

### 9. Visual system and localization

- Replace direct brand/status colors with semantic design tokens.
- Standardize heading, card-title, metadata, and status typography.
- Remove misleading hover affordances from static cards.
- Verify light and dark contrast for all updated surfaces.
- Remove hardcoded user-facing strings and raw technical values.
- Ensure all new or changed strings exist in English and Indonesian.
- Keep terminology consistent with Assignment, Checkpoint, Submission, Review, Consultation, and Template.

### 10. Hydration and runtime stability

- Resolve the server/client ThemeScript nonce mismatch.
- Verify that tested public and authenticated pages produce no new hydration errors.
- Investigate the HomePage code-splitting warning only if it affects the affected UI surfaces; otherwise document it separately.

## Non-Functional Requirements

- Follow the existing TanStack Start, shadcn/Base UI, Tailwind v4, typesafe-i18n, and TanStack Query architecture.
- Do not bypass `typedServerFn` or the client/server handler split.
- Do not introduce a new UI framework or styling system.
- Keep source files within the project's 500-line modularity limit.
- Maintain WCAG 2.1 AA intent.
- Preserve existing authorization and sequential checkpoint rules.
- Avoid database schema changes unless implementation proves one is unavoidable.

## Acceptance Criteria

- At 320px, all affected public, student, instructor, and admin pages have no clipped primary actions or unreachable controls.
- Every affected interactive element is keyboard reachable, visibly focused, and semantically identifiable.
- Mobile navigation opens, closes, manages focus correctly, and exposes its state.
- File upload and import controls work through keyboard and pointer interaction.
- Tabs, dialogs, sheets, filters, expansion controls, and selection controls expose correct accessible semantics.
- Server failures never masquerade as successful empty states or not-found results.
- Affected mutations show localized pending, success, and failure feedback.
- Student dates consistently respect the configured student timezone.
- English and Indonesian UI strings remain complete and parity-checked.
- Reduced-motion behavior applies to nonessential application animation.
- Tested routes have no hydration mismatch errors.
- Automated tests, typecheck, lint, coverage, Playwright browser checks, keyboard checks, and axe checks pass at the agreed viewport sizes.
- No unrelated product behavior is changed.

## Out of Scope

- Replacing the existing visual identity with a new design system.
- Implementing SSE or changing notification transport architecture.
- Adding new academic workflow capabilities.
- Changing role permissions or checkpoint business rules.
- Replacing TanStack Start, Base UI/shadcn, Tailwind, or typesafe-i18n.
- Production deployment, database backup, or infrastructure changes unrelated to the hydration/UI fixes.
