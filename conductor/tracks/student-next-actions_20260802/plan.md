# Implementation Plan: TRACK-053 — Student Next Actions

## Phase 1: Action Resolver Contract and Server Data [checkpoint: 127ca61]

**Objective:** Define and implement the deterministic, pure action resolver and extend the student dashboard handler with the authoritative data it needs.

- [x] Task: Confirm the approved specification and workflow constraints before implementation. [cb92ef3]
  - [x] Review `spec.md` for action eligibility, priority, deduplication, waiting groups, and destination rules.
  - [x] Review `conductor/workflow.md` for Red/Green TDD order, task states, coverage, file limits, and checkpoint protocol.
- [x] Task: Write failing resolver tests in `tests/unit/lib/student-next-actions.test.ts`. [19d82127]
  - [x] Cover submit, revise, and required-consultation eligibility.
  - [x] Cover overdue, revision, consultation, absolute 168-hour, other-dated, and undated priority buckets.
  - [x] Cover injected reference time, null due dates, deterministic tie-breaking, and one-action-per-checkpoint deduplication.
  - [x] Cover loading all candidates before limiting to five primary actions.
  - [x] Cover exclusion of passed/locked work and separation of submitted/under-review waiting work.
  - [x] Cover all-age waiting counts and the three-representative-link limit.
- [x] Task: Implement the pure resolver and shared DTO types in `src/lib/student-next-actions.ts`. [19d82127]
  - [x] Keep the resolver free of database and client-incompatible imports.
  - [x] Normalize candidates, select one action per checkpoint, rank deterministically, and produce waiting groups.
- [x] Task: Run the focused resolver tests and confirm the Red-to-Green transition. [19d82127]
- [x] Task: Phase Verification & Checkpoint — manually verify the resolver against the approved priority and deduplication rules, record the workflow checkpoint, and attach the required git note. [127ca61]

## Phase 2: Student Dashboard Handler

**Objective:** Return complete, authorized Next Actions and waiting-summary data through the existing dashboard request without regressing the current widgets.

- [x] Task: Write failing handler tests in `tests/unit/server/dashboard-student-next-actions.test.ts`. [127ca612]
  - [x] Verify unauthenticated and non-student requests remain unauthorized.
  - [x] Verify assignment, checkpoint, submission, review, consultation, state, due-date, and destination identifiers are returned.
  - [x] Verify all eligible candidates reach the resolver before the five-item display limit.
  - [x] Verify unresolved submitted/under-review items older than 30 days are included in the waiting summary.
  - [x] Verify existing authorization, assignment ownership, gating, and four existing dashboard datasets remain intact.
  - [x] Verify empty results return stable empty action and waiting structures.
- [x] Task: Extend query assembly in `src/server/dashboard-student.server.ts`. [127ca612]
  - [x] Add the identifiers and authoritative state needed for precise action resolution.
  - [x] Load consultation requirements and verified consultation state using existing schema relationships.
  - [x] Preserve existing limits for current widgets while avoiding a five-row limit on Next Actions candidates.
  - [x] Avoid per-candidate N+1 queries and scope all data to the authenticated student.
- [x] Task: Integrate the resolver into `getStudentDashboardDataHandler` and return the new DTO fields while preserving existing response fields. [127ca612]
- [x] Task: Keep `src/server/dashboard.ts` client-safe and retain the dynamic import into the server-only handler. [127ca612]
- [x] Task: Run focused server/dashboard tests and confirm the Green transition. [127ca612]
- [ ] Task: Phase Verification & Checkpoint — manually verify authorization, candidate completeness, stale waiting records, and backward compatibility, record the workflow checkpoint, and attach the required git note.

## Phase 3: Dashboard UI and Bilingual UX

**Objective:** Present prioritized actions and waiting work accessibly above the existing student dashboard widgets.

- [ ] Task: Write failing component tests in `tests/unit/components/dashboard/StudentNextActions.test.tsx` and update dashboard regression tests.
  - [ ] Verify the section appears above the existing widgets.
  - [ ] Verify primary action labels, assignment/checkpoint context, due/overdue presentation, and direct destination links.
  - [ ] Verify one rendered card per resolved action and a maximum of five cards.
  - [ ] Verify separate Submitted and Under Review waiting groups, counts, and no more than three representative links total.
  - [ ] Verify the always-visible localized empty state.
  - [ ] Verify semantic headings, links, keyboard-accessible interaction, and accessible names.
- [ ] Task: Add Next Actions translation keys to `locales/en.json` and matching Indonesian keys to `locales/id.json`.
  - [ ] Add section, action, state, priority, waiting-summary, count, empty-state, and accessibility-label translations.
  - [ ] Run `pnpm generate:i18n`.
  - [ ] Run `pnpm check:i18n` and verify locale parity.
- [ ] Task: Implement `src/components/dashboard/StudentNextActions.tsx` and integrate it into `StudentDashboard`.
  - [ ] Use existing shadcn/ui, Radix, Link, badge, and empty-state patterns.
  - [ ] Link submit/revise actions to checkpoint routes and consultation actions to assignment detail.
  - [ ] Preserve responsive behavior from 320px through desktop widths.
  - [ ] Keep user-visible strings localized and all files under 500 lines.
- [ ] Task: Run focused component and i18n tests and confirm the Green transition.
- [ ] Task: Phase Verification & Checkpoint — manually verify English/Indonesian rendering, empty/waiting states, link destinations, keyboard access, and mobile layout, record the workflow checkpoint, and attach the required git note.

## Phase 4: E2E, Accessibility, and Regression Gates

**Objective:** Verify the complete student workflow and satisfy project quality gates.

- [ ] Task: Write failing Playwright coverage for student Next Actions using the existing dashboard auth and database-reset helpers.
  - [ ] Verify the section, primary action links, priority ordering, five-item cap, and waiting summary.
  - [ ] Verify old unresolved waiting work is visible and no duplicate checkpoint action is rendered.
  - [ ] Add only the minimal deterministic fixture data needed for states absent from the existing E2E seed.
  - [ ] Verify the mobile dashboard has no horizontal overflow.
- [ ] Task: Add or extend student dashboard axe-core coverage for critical and serious accessibility violations.
- [ ] Task: Run focused unit, component, and E2E tests, then run the full required gates.
  - [ ] Run `pnpm test`.
  - [ ] Run `pnpm test:coverage`.
  - [ ] Run `pnpm typecheck`.
  - [ ] Run `pnpm lint`.
  - [ ] Run `pnpm check:i18n`.
  - [ ] Run `pnpm test:e2e`.
  - [ ] Run `pnpm build`.
- [ ] Task: Review the final diff for authorization, file-size, i18n, accessibility, and backward-compatibility compliance.
- [ ] Task: Phase Verification & Checkpoint — complete the workflow manual verification, update plan checkpoint data, attach the verification git note, and confirm all acceptance criteria.
- [ ] Task: Prepare conventional commits following `conductor/workflow.md`.
