# Implementation Plan: UI/UX Audit Remediation

## Phase 0 — Baseline, fixtures, and regression matrix [checkpoint: 3a71472]

- [x] Task: Establish the audit regression baseline [7722e22]
  - [x] Document affected routes and components by role.
  - [x] Confirm available student, instructor, admin, and public test fixtures.
  - [x] Record current Playwright viewport, hydration-console, and axe failures.
  - [x] Identify existing tests that should be extended rather than duplicated.
- [x] Task: Define shared test helpers [3a71472]
  - [x] Add or extend authenticated browser helpers for each available role.
  - [x] Add viewport helpers for 320px, 768px, and 1280px.
  - [x] Add reusable assertions for keyboard focus, accessible names, clipping, and live regions.
  - [x] Keep fixture setup isolated from production seed behavior.
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [checkpoint: 3a71472]

## Phase 1 — Shared accessibility and responsive foundations [checkpoint: c82d3f7]

- [x] Task: Repair file-input and dropzone interaction semantics [9005149]
  - [x] Write failing component tests for keyboard focus and file selection.
  - [x] Write failing tests for student, feedback, user-import, and template-import upload states.
  - [x] Implement native label/button semantics and accessible input associations.
  - [x] Implement keyboard activation, focus styling, and drag-and-drop enhancement behavior.
  - [x] Verify upload validation and retry behavior remains bilingual.
- [x] Task: Repair mobile navigation drawer behavior [a08f5ca]
  - [x] Write failing tests for expanded state, controlled drawer, Escape, focus transfer, focus return, and inert background.
  - [x] Implement semantic drawer behavior for all role sidebars.
  - [x] Add navigation landmark labels and active-route semantics.
  - [x] Verify desktop sidebar behavior is unchanged.
- [x] Task: Standardize shared control hit areas [b1ba0c0]
  - [x] Write failing tests for button, input, icon-button, pagination, close, refresh, filter, and notification controls.
  - [x] Implement a 44px interaction baseline while preserving compact visual variants where appropriate.
  - [x] Add visible focus states to shared and app-level controls.
  - [x] Verify no affected controls regress at 320px.
- [x] Task: Replace or repair tab and disclosure primitives [3fc938e]
  - [x] Write failing accessibility tests for tabs, tab panels, expansion buttons, and clickable rows/cards.
  - [x] Implement correct ARIA tab semantics and keyboard navigation.
  - [x] Implement accessible expansion controls for admin imports and other disclosure surfaces.
  - [x] Provide mobile overflow or alternative selection behavior.
- [x] Task: Make dialog and sheet primitives mobile-safe [c82d3f7]
  - [x] Write failing tests for close-button names, max-height, scrolling, and narrow viewport behavior.
  - [x] Implement constrained content regions and accessible close controls.
  - [x] Verify notification, confirmation, and settings sheets.
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [checkpoint: c82d3f7]

## Phase 2 — Error states, action feedback, and runtime stability

- [~] Task: Separate loading, empty, not-found, authorization, and server-error states
  - [ ] Write failing route/component tests for affected student, instructor, admin, notification, and discussion views.
  - [ ] Implement explicit state models without converting failures into empty results.
  - [ ] Add localized retry actions.
  - [ ] Verify error content does not expose raw server messages.
- [ ] Task: Standardize mutation feedback
  - [ ] Write failing tests for pending, success, failure, disabled, and input-preservation behavior.
  - [ ] Implement consistent inline status and toast behavior for settings, submissions, reviews, imports, deletes, extensions, and notifications.
  - [ ] Add `aria-live` announcements where state changes are not otherwise visible.
- [ ] Task: Harden upload and submission state cleanup
  - [ ] Write failing tests for failed presigned URL, direct upload, and submission-record operations.
  - [ ] Ensure all upload paths reset state through `finally`.
  - [ ] Preserve selected files and expose retry actions.
- [ ] Task: Resolve SSR hydration mismatch
  - [ ] Write a browser regression check that fails on ThemeScript nonce mismatch.
  - [ ] Trace server/client nonce generation and propagation.
  - [ ] Implement the minimal fix within the existing security-header and router architecture.
  - [ ] Verify no new hydration errors on public and authenticated routes.
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3 — Student experience remediation

- [ ] Task: Improve student dashboard actionability
  - [ ] Write failing tests for actionable deadline, review, consultation, and waiting-item rows.
  - [ ] Add destinations and view-all affordances while preserving the five-action/three-waiting caps.
  - [ ] Verify loading, empty, error, and retry states.
- [ ] Task: Standardize student date and timezone presentation
  - [ ] Write failing tests covering dashboard, assignment detail, consultation, submission, review, and extension dates.
  - [ ] Centralize locale-aware student timezone formatting.
  - [ ] Verify English and Indonesian output around date boundaries.
- [ ] Task: Repair student assignment detail and checkpoint UX
  - [ ] Write failing tests for mobile tab access, locked-checkpoint guidance, status semantics, and responsive layout.
  - [ ] Implement mobile-safe tabs and clear next-step guidance.
  - [ ] Improve grade breakdown, consultation progress, and history semantics.
- [ ] Task: Improve student discussions and destructive actions
  - [ ] Write failing tests for discussion errors, deletion confirmation, announcements, and empty states.
  - [ ] Implement retryable error states, confirmation, and live feedback.
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4 — Instructor workflow remediation

- [ ] Task: Repair instructor dashboard hierarchy and actionability
  - [ ] Write failing tests for dashboard error states, actionable lists, quick-action semantics, and mobile stacking.
  - [ ] Implement direct destinations for important review, risk, submission, and assignment information.
  - [ ] Reduce mobile density through prioritization or progressive disclosure where needed.
- [ ] Task: Fix assignment list, cards, filters, and header actions
  - [ ] Write failing tests for card click affordances, labeled search/clear controls, responsive actions, and pagination.
  - [ ] Implement full-card/title links, accessible filters, larger controls, and wrapping page-header actions.
- [ ] Task: Improve review queue and review detail
  - [ ] Write failing tests for filter naming, mobile queue presentation, localized wait times, error retry, and success announcements.
  - [ ] Implement responsive queue cards or prioritized columns.
  - [ ] Improve review form field grouping, disabled-state explanation, feedback upload, and status feedback.
  - [ ] Verify PDF/DOCX preview fallback and mobile download behavior.
- [ ] Task: Repair assignment wizard semantics
  - [ ] Write failing tests for template/student selection keyboard behavior and current-step semantics.
  - [ ] Implement buttons/listbox/checkbox semantics as appropriate.
  - [ ] Expose current step and total step count.
  - [ ] Add inline retry for template and student loading failures.
- [ ] Task: Improve instructor discussions and secondary tabs
  - [ ] Write failing tests for large discussion sets, filtering, disclosure, and error recovery.
  - [ ] Implement progressive disclosure and useful filtering.
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 5 — Admin, public, settings, and notification remediation

- [ ] Task: Repair admin import and preview workflows
  - [ ] Write failing tests for keyboard upload, parsing errors, retry, expansion semantics, and progress announcements.
  - [ ] Implement accessible import controls and expandable preview rows.
  - [ ] Preserve row-level errors and successful-row summaries.
- [ ] Task: Improve admin tables, filters, and destructive actions
  - [ ] Write failing tests for mobile table presentation, filter labels, cleanup confirmation, delete pending states, and session revoke names.
  - [ ] Implement mobile-priority layouts and accessible detail expansion.
  - [ ] Ensure destructive dialogs remain open until confirmed success.
- [ ] Task: Improve settings information architecture and feedback
  - [ ] Write failing tests for section navigation and mutation outcome announcements.
  - [ ] Group settings into discoverable sections.
  - [ ] Implement consistent pending/success/failure behavior for profile, password, 2FA, sessions, accessibility, notifications, timezone, and calendar settings.
- [ ] Task: Improve notification center
  - [ ] Write failing tests for sheet overflow, tab semantics, unread announcements, localized relative time, unknown notification types, and load-more feedback.
  - [ ] Implement a mobile-safe notification panel with explicit state announcements.
  - [ ] Add a meaningful empty state and non-color unread indicator.
- [ ] Task: Improve public and authentication surfaces
  - [ ] Write failing tests for landing navigation, locale/theme access, login field errors, loading feedback, and narrow control sizing.
  - [ ] Implement public navigation controls and localized field-level authentication errors.
  - [ ] Align landing and login controls with the shared visual system.
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 6 — Visual system, i18n, motion, and final quality gates

- [ ] Task: Complete visual-token consistency pass
  - [ ] Write regression tests or assertions for changed semantic color and typography usage.
  - [ ] Replace direct brand/status colors in affected surfaces.
  - [ ] Remove misleading hover affordances from static cards.
  - [ ] Verify light/dark contrast for changed states.
- [ ] Task: Complete localization and terminology pass
  - [ ] Write i18n parity and hardcoded-string regression tests for affected surfaces.
  - [ ] Localize relative times, technical fallback values, wait durations, raw error codes, and status text.
  - [ ] Run generated i18n checks for English/Indonesian parity and unused keys.
- [ ] Task: Apply reduced-motion behavior globally
  - [ ] Write failing tests for reduced-motion behavior on affected transitions and animations.
  - [ ] Implement a shared reduced-motion state/class or equivalent.
  - [ ] Verify skeletons, sidebars, progress indicators, hover transitions, and toasts.
- [ ] Task: Execute complete automated verification
  - [ ] Run unit/component tests and coverage.
  - [ ] Run typecheck, lint, format validation, and modularity checks.
  - [ ] Run authenticated Playwright checks for public, student, instructor, and admin routes.
  - [ ] Run keyboard interaction checks at 320px, 768px, and 1280px.
  - [ ] Run axe checks and confirm no new serious/critical violations.
  - [ ] Confirm no hydration or unexpected console errors.
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Final Definition of Done

- [ ] All plan tasks are complete and linked to commits.
- [ ] Tests and coverage meet project thresholds.
- [ ] Public and authenticated browser checks pass at all agreed viewport sizes.
- [ ] Keyboard, focus, screen-reader semantics, bilingual behavior, and reduced-motion behavior are verified.
- [ ] No unresolved P0/P1 audit findings remain.
- [ ] Conductor review is completed.
