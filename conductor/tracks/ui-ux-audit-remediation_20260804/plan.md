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

## Phase 2 — Error states, action feedback, and runtime stability [checkpoint: e127c5e]

- [x] Task: Separate loading, empty, not-found, authorization, and server-error states [057e34c]
  - [x] Write failing route/component tests for affected student, instructor, admin, notification, and discussion views. [057e34c]
  - [x] Implement explicit state models without converting failures into empty results. [057e34c]
  - [x] Add localized retry actions. [057e34c]
  - [x] Verify error content does not expose raw server messages. [057e34c]
- [x] Task: Standardize mutation feedback [3a2fcca]
  - [x] Write failing tests for pending, success, failure, disabled, and input-preservation behavior. [3a2fcca]
  - [x] Implement consistent inline status and toast behavior for settings, submissions, reviews, imports, deletes, extensions, and notifications. [3a2fcca]
  - [x] Add `aria-live` announcements where state changes are not otherwise visible. [3a2fcca]
- [x] Task: Harden upload and submission state cleanup [416177a]
  - [x] Write failing tests for failed presigned URL, direct upload, and submission-record operations. [416177a]
  - [x] Ensure all upload paths reset state through `finally`. [416177a]
  - [x] Preserve selected files and expose retry actions. [416177a]
- [x] Task: Resolve SSR hydration mismatch [e127c5e]
  - [x] Write a browser regression check that fails on ThemeScript nonce mismatch. [e127c5e]
  - [x] Trace server/client nonce generation and propagation. [e127c5e]
  - [x] Implement the minimal fix within the existing security-header and router architecture. [e127c5e]
  - [x] Verify no new hydration errors on public and authenticated routes. [e127c5e]
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [checkpoint: e127c5e]

## Phase 3 — Student experience remediation [checkpoint: 0589eb7]

- [x] Task: Improve student dashboard actionability [8340632]
  - [x] Write failing tests for actionable deadline, review, consultation, and waiting-item rows. [8340632]
  - [x] Add destinations and view-all affordances while preserving the five-action/three-waiting caps. [8340632]
  - [x] Verify loading, empty, error, and retry states. [8340632]
- [x] Task: Standardize student date and timezone presentation [a244454]
  - [x] Write failing tests covering dashboard, assignment detail, consultation, submission, review, and extension dates. [a244454]
  - [x] Centralize locale-aware student timezone formatting. [a244454]
  - [x] Verify English and Indonesian output around date boundaries. [a244454]
- [x] Task: Repair student assignment detail and checkpoint UX [e509bff]
  - [x] Write failing tests for mobile tab access, locked-checkpoint guidance, status semantics, and responsive layout. [e509bff]
  - [x] Implement mobile-safe tabs and clear next-step guidance. [e509bff]
  - [x] Improve grade breakdown, consultation progress, and history semantics. [e509bff]
- [x] Task: Improve student discussions and destructive actions [0589eb7]
  - [x] Write failing tests for discussion errors, deletion confirmation, announcements, and empty states. [0589eb7]
  - [x] Implement retryable error states, confirmation, and live feedback. [0589eb7]
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [checkpoint: 0589eb7]

## Phase 4 — Instructor workflow remediation

- [x] Task: Repair instructor dashboard hierarchy and actionability [c5503a2]
  - [x] Write failing tests for dashboard error states, actionable lists, quick-action semantics, and mobile stacking. [c5503a2]
  - [x] Implement direct destinations for important review, risk, submission, and assignment information. [c5503a2]
  - [x] Reduce mobile density through prioritization or progressive disclosure where needed. [c5503a2]
- [x] Task: Fix assignment list, cards, filters, and header actions [9518e1b]
  - [x] Write failing tests for card click affordances, labeled search/clear controls, responsive actions, and pagination. [9518e1b]
  - [x] Implement full-card/title links, accessible filters, larger controls, and wrapping page-header actions. [9518e1b]
- [x] Task: Improve review queue and review detail [b317ba3]
  - [x] Write failing tests for filter naming, mobile queue presentation, localized wait times, error retry, and success announcements. [b317ba3]
  - [x] Implement responsive queue cards or prioritized columns. [b317ba3]
  - [x] Improve review form field grouping, disabled-state explanation, feedback upload, and status feedback. [b317ba3]
  - [x] Verify PDF/DOCX preview fallback and mobile download behavior. [b317ba3]
- [x] Task: Repair assignment wizard semantics [85f9725]
  - [x] Write failing tests for template/student selection keyboard behavior and current-step semantics. [85f9725]
  - [x] Implement buttons/listbox/checkbox semantics as appropriate. [85f9725]
  - [x] Expose current step and total step count. [85f9725]
  - [x] Add inline retry for template and student loading failures. [85f9725]
- [x] Task: Improve instructor discussions and secondary tabs [d45f8eb]
  - [x] Write failing tests for large discussion sets, filtering, disclosure, and error recovery. [d45f8eb]
  - [x] Implement progressive disclosure and useful filtering. [d45f8eb]
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [checkpoint: d45f8eb]

## Phase 5 — Admin, public, settings, and notification remediation

- [x] Task: Repair admin import and preview workflows [ba3bd47]
  - [x] Write failing tests for keyboard upload, parsing errors, retry, expansion semantics, and progress announcements. [ba3bd47]
  - [x] Implement accessible import controls and expandable preview rows. [ba3bd47]
  - [x] Preserve row-level errors and successful-row summaries. [ba3bd47]
- [x] Task: Improve admin tables, filters, and destructive actions [1c0134a]
  - [x] Write failing tests for mobile table presentation, filter labels, cleanup confirmation, delete pending states, and session revoke names. [1c0134a]
  - [x] Implement mobile-priority layouts and accessible detail expansion. [1c0134a]
  - [x] Ensure destructive dialogs remain open until confirmed success. [1c0134a]
- [x] Task: Improve settings information architecture and feedback [45ecb05]
  - [x] Write failing tests for section navigation and mutation outcome announcements. [45ecb05]
  - [x] Group settings into discoverable sections. [45ecb05]
  - [x] Implement consistent pending/success/failure behavior for profile, password, 2FA, sessions, accessibility, notifications, timezone, and calendar settings. [45ecb05]
- [x] Task: Improve notification center [f3ffc9b]
  - [x] Write failing tests for sheet overflow, tab semantics, unread announcements, localized relative time, unknown notification types, and load-more feedback. [f3ffc9b]
  - [x] Implement a mobile-safe notification panel with explicit state announcements. [f3ffc9b]
  - [x] Add a meaningful empty state and non-color unread indicator. [f3ffc9b]
- [x] Task: Improve public and authentication surfaces [1872ed7]
  - [x] Write failing tests for landing navigation, locale/theme access, login field errors, loading feedback, and narrow control sizing. [1872ed7]
  - [x] Implement public navigation controls and localized field-level authentication errors. [1872ed7]
  - [x] Align landing and login controls with the shared visual system. [1872ed7]
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [checkpoint: 1872ed7]

## Phase 6 — Visual system, i18n, motion, and final quality gates

- [x] Task: Complete visual-token consistency pass [4eb1e39]
  - [x] Write regression tests or assertions for changed semantic color and typography usage. [4eb1e39]
  - [x] Replace direct brand/status colors in affected surfaces. [4eb1e39]
  - [x] Remove misleading hover affordances from static cards. [4eb1e39]
  - [x] Verify light/dark contrast for changed states. [4eb1e39]
- [x] Task: Complete localization and terminology pass [f31986c]
  - [x] Write i18n parity and hardcoded-string regression tests for affected surfaces. [f31986c]
  - [x] Localize relative times, technical fallback values, wait durations, raw error codes, and status text. [f31986c]
  - [x] Run generated i18n checks for English/Indonesian parity and unused keys. [f31986c]
- [x] Task: Apply reduced-motion behavior globally [be8c7aa]
  - [x] Write failing tests for reduced-motion behavior on affected transitions and animations. [be8c7aa]
  - [x] Implement a shared reduced-motion state/class or equivalent. [4eb1e39]
  - [x] Verify skeletons, sidebars, progress indicators, hover transitions, and toasts. [be8c7aa]
- [~] Task: Execute complete automated verification
  - [x] Run unit/component tests and coverage. [be8c7aa]
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
