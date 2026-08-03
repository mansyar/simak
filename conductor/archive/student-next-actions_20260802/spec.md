# TRACK-053 — Student Next Actions

## Overview

The student dashboard currently presents independent assignment, deadline, review, and consultation widgets, but it does not answer the student’s central question: **what should I do next?** This feature adds a prioritized Next Actions section above the existing widgets while continuing to derive all information from the authoritative assignment, checkpoint, submission, review, consultation, and gating state already used by the application.

The feature extends the existing `getStudentDashboardData` response and `StudentDashboard` component. It does not create a second request, persist a duplicate task system, or replace the current dashboard widgets.

## Strategic Value

Student action prioritization makes the dashboard a decision surface rather than a passive status summary. Precise checkpoint destinations reduce navigation friction, while waiting summaries make submitted and under-review work visible without incorrectly presenting it as an action. The feature establishes the action surface that later revision-action-plan work can enrich without introducing a competing source of truth.

## Context and Problem

- The dashboard currently limits deadline rows before ranking them, which can hide the most important actionable checkpoint.
- Pending reviews are restricted to recent submissions and do not expose assignment/checkpoint identifiers for precise links.
- Deadline and review rows do not consistently expose checkpoint identifiers needed for direct submission navigation.
- A checkpoint can produce multiple signals; rendering each signal independently would create duplicate work for the student.
- Submitted and under-review work is useful context but should not be represented as an actionable task.

## Goals

1. Show the student up to five deterministic, prioritized actions derived from authoritative dashboard data.
2. Render at most one primary action per checkpoint, selecting the highest-priority applicable category.
3. Link submit/revise actions to the precise checkpoint submission route and consultation blockers to the assignment-detail consultation surface.
4. Show all unresolved waiting work in separate Submitted and Under Review groups, with counts and at most three representative assignment/checkpoint links total.
5. Preserve all existing dashboard widgets, authorization, checkpoint gating, reminders, notifications, and response behavior.

## Functional Requirements

### FR-1: Authoritative dashboard data

- Extend the existing student dashboard DTO rather than adding a second request or persisted task table.
- Include the assignment and checkpoint identifiers, relevant submission/review/consultation state, due date, display data, and destination data needed to resolve and render actions.
- Load the complete eligible candidate set before applying the five-primary-action limit.
- Preserve the existing server-side student authorization and checkpoint gating rules.
- Keep the client-safe/server-only server-function split intact.

### FR-2: Primary action categories

Expose only these primary action categories:

1. **Submit checkpoint** — a checkpoint is unlocked for submission and requires student action.
2. **Revise and resubmit** — the latest applicable review requests a revision and the checkpoint is unlocked for resubmission.
3. **Required consultation** — a required consultation blocker remains unresolved.

Submitted and under-review checkpoints are waiting work, not primary actions. Generic discussion prompts and other non-blocking activity are excluded.

### FR-3: Priority and deduplication

- Rank primary actions in this order:
  1. overdue actionable checkpoints;
  2. revise-and-resubmit actions;
  3. required-consultation blockers;
  4. actions due within the next absolute 168 hours;
  5. other dated actions;
  6. undated actions.
- Resolve multiple signals for one checkpoint into one action using the highest-priority applicable category.
- Tie-break deterministically by due date and stable assignment/checkpoint identifiers.
- Apply the maximum of five only after all candidates have been loaded, normalized, deduplicated, and ranked.
- An injected reference time must be supported by the pure resolver tests so the 168-hour and overdue boundaries are deterministic.

### FR-4: Destinations and waiting summary

- Submit and revise actions link to the precise checkpoint submission route.
- Required-consultation actions link to the assignment detail consultation surface.
- Submitted and Under Review waiting groups each expose a count.
- Waiting representatives may include unresolved work of any age and provide assignment/checkpoint links.
- Render no more than three representative waiting links total across both groups.
- Waiting work must not automatically become a primary action, pass a checkpoint, or change the authoritative checkpoint state.

### FR-5: Student dashboard presentation

- Always render the Next Actions section above the existing dashboard widgets.
- When there are no primary actions, show a positive bilingual empty state rather than hiding the section.
- Show waiting work when it exists even if the primary-action list is empty.
- Preserve the existing active assignments, upcoming deadlines, pending reviews, and consultation reminder widgets and their behavior.
- Use accessible headings, lists, links, states, and responsive layouts consistent with existing shadcn/ui patterns.

## Non-Functional Requirements

- Provide complete English and Indonesian translations through the existing locale source files and generated i18n types.
- Meet WCAG 2.1 AA expectations for keyboard navigation, semantics, focus visibility, accessible names, and status presentation.
- Work from 320px through desktop widths without horizontal overflow.
- Keep new source and test files below the project’s 500-line limit.
- Avoid N+1 queries and preserve the existing single dashboard data request.
- Keep all authorization and gating decisions server-side.
- Maintain backward compatibility for existing dashboard consumers and current response fields.
- Add unit, dashboard regression, E2E, mobile, accessibility, and locale coverage with new-code coverage above 80%.

## Acceptance Criteria

1. [ ] An authenticated student sees a Next Actions section above the existing dashboard widgets.
2. [ ] The handler returns complete, authorized candidate data with assignment/checkpoint identifiers and precise destination data.
3. [ ] The resolver loads all candidates before ranking and never renders more than five primary actions.
4. [ ] Each checkpoint renders at most one primary action, selected by the defined priority order and deterministic tie-breakers.
5. [ ] Submit/revise actions open the precise checkpoint submission route; required-consultation actions open the assignment-detail consultation surface.
6. [ ] Submitted and Under Review waiting groups show separate counts and no more than three representative links total, including work older than 30 days.
7. [ ] A bilingual positive empty state is visible whenever there are no primary actions, including when waiting work remains.
8. [ ] Existing dashboard widgets, authorization, gating, reminders, notifications, and checkpoint behavior remain unchanged.
9. [ ] English and Indonesian locale parity, accessible semantics, responsive mobile rendering, and no-overflow behavior are verified.
10. [ ] Unit, regression, E2E, accessibility, and mobile tests pass, and required quality gates remain above 80% coverage.

## Dependencies and Coordination

- Builds on the existing role-based student dashboard and dashboard data handler.
- Coordinates with TRACK-013, TRACK-021, and TRACK-022 for date, deadline, and notification context without changing their scope.
- Establishes the action surface that TRACK-054 may later enrich with structured revision action plans.
- TRACK-055 timezone and calendar work should follow this track operationally but is not required for this implementation.

## Out of Scope

- Student timezone support, localized date planning, calendar feeds, or OAuth.
- Consultation booking or changes to consultation verification workflows.
- A persisted task/action table, duplicate task system, or dedicated Next Actions page.
- Generic discussion prompts, notification/reminder changes, analytics, or action history.
- TRACK-054 structured revision action plans and rubric-linked action items.
