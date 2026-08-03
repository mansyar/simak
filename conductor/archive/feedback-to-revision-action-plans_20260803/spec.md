# TRACK-054 — Feedback-to-Revision Action Plans

## Track Type

Feature

## Overview

The review workflow currently stores pass/revise decisions, free-text comments, optional feedback files, revision deadlines, rubric scores, and review history. This track adds optional, structured revision action items so instructors can turn feedback into a shared checklist and students can track which issues they have addressed.

A revision plan belongs to a specific `revise` review. It is not a second task system and does not replace comments, feedback files, rubric scores, checkpoint state, or the authoritative review decision.

**Dependencies:** TRACK-020 (rubric snapshots), TRACK-053 (Student Next Actions)
**Coordination:** TRACK-049 (review-form feedback context)
**Roles:** Instructors author and view plans; students view plans and update their own addressed status.

## Functional Requirements

### FR-1: Revision action-item data model

Add a `revision_action_items` table with:

- Stable item identifier
- Owning `reviewId`
- Plain-text item content
- Stable display order
- Optional rubric `criterionId`
- Denormalized `criterionTitle` snapshot
- Nullable `addressedAt` timestamp
- Creation/update timestamps

Each submitted Revise review may contain zero or more items. A non-empty item set represents that review’s revision plan; no separate persisted task or plan table is required.

Items must be retained as immutable review history. Item text, ordering, and rubric snapshots cannot be edited after review submission. Only the addressed timestamp may change, and only under FR-6.

### FR-2: Action-item validation

Extend review input validation with an optional action-item list:

- Maximum 10 items per plan
- Each item must be non-empty plain text of no more than 500 characters
- Items preserve their submitted order
- A rubric criterion link is optional per item
- A linked criterion must belong to the reviewed checkpoint’s rubric
- Criterion title is copied into the item snapshot at submission time
- Action items supplied with a `pass` decision are rejected
- Existing comment-only and feedback-file-only Revise submissions remain valid
- HTML, rich text, placeholders, and automatic generated content are unsupported

### FR-3: Atomic review submission

Persist action items in the existing review and rubric-score transaction:

- Validate the review, decision, checkpoint state, authorization, and rubric data first
- Insert the review and its action items atomically
- Roll back the complete transaction if action-item or rubric-score persistence fails
- Reuse the existing `revision_requested` notification for Revise decisions
- Do not add a new notification event type
- Record plan creation in the audit log without copying full item text or feedback content

Existing review semantics remain unchanged: Pass/Revise still controls checkpoint transitions, deadlines, rubric scores, and resubmission behavior.

### FR-4: Instructor authoring

Extend the existing instructor `ReviewForm`:

- Show an optional action-plan editor when Revise is selected
- Allow adding, removing, and reordering items before submission
- Allow plain-text editing within the 500-character limit
- When a rubric exists, allow selecting a rubric criterion for each item
- Do not show criterion selection for checkpoints without a rubric
- Preserve form input and display inline validation errors
- Do not allow action items to select the decision, submit the review, alter rubric scores, or alter checkpoint state

### FR-5: Student current-plan presentation

On the authorized student checkpoint page:

- Show the newest revision plan associated with the current revision workflow
- Display items in stable instructor-defined order
- Allow the student who owns the assignment to mark an item addressed
- Allow that student to unmark it while the plan remains current
- Provide immediate success/error feedback and accessible state announcements
- Do not block resubmission based on addressed status
- Do not automatically pass a checkpoint when all items are addressed

When the checkpoint is submitted or under review, the existing waiting-summary behavior remains authoritative; the revision plan must not create a second Next Action.

### FR-6: Plan supersession and history

- A later Revise review containing action items becomes the current plan
- The previous plan remains immutable history and is not copied, merged, or deleted
- Existing addressed timestamps on historical items remain unchanged
- Students cannot toggle items from a superseded plan
- Instructors can view current and historical item status but cannot mark or reopen items
- Comment-only or feedback-file-only Revise reviews remain backward-compatible and do not require action items
- If a later plan is created, unresolved items from older plans do not carry forward

### FR-7: Review-history display

Extend student and instructor review-history views:

- Show action items belonging to each review in stable order
- Clearly distinguish the current plan from prior plans
- Show addressed/unaddressed status as read-only for historical plans
- Preserve existing comments, feedback files, rubric results, decision labels, and review dates

### FR-8: Next Actions integration

Extend the TRACK-053 resolver rather than creating a new task surface:

- Enrich the existing Revise action with unresolved items from the current plan
- Do not create a second action for each item
- Do not show revision-plan actions for submitted or under-review checkpoints; those remain in the waiting summary
- Preserve existing priority ordering, deduplication, authorization, destination links, and display caps
- If no current plan exists or all current items are addressed, retain the existing Revise action behavior without inventing a new task

### FR-9: Authorization and data isolation

- Instructors may read plans only for reviews on assignments they own
- Students may read plans only for assignments to which they are assigned
- Only the owning student may update addressed status
- Addressed-status mutations must verify that the plan is still current at mutation time
- Cross-student, cross-instructor, and unauthorized access must be rejected
- Action-plan data must not be exposed through unrelated role views

### FR-10: Audit logging

Create immutable audit records for:

- Revision-plan creation, recording review/checkpoint references and item count
- Item addressed/unaddressed changes, recording item/review references and the new state

Audit details must not duplicate full action-item text, review comments, or feedback-file contents.

### FR-11: Internationalization and accessibility

- Add all user-visible strings to both English and Indonesian locale files
- Regenerate i18n types
- Use accessible labels, keyboard-operable add/remove/reorder controls, visible focus states, and appropriate live announcements
- Use semantic controls for addressed status
- Support light/dark themes and responsive layouts from 320px through 1920px
- Preserve existing WCAG 2.1 AA conventions and loading, empty, validation, and error states

## Non-Functional Requirements

- Follow the client-safe/server-only two-file server-function split.
- Keep all files under the 500-line modularity limit; extract components or handlers when necessary.
- Use ownership-scoped Drizzle queries and transaction-safe status checks.
- Preserve backward compatibility for existing review clients and stored reviews.
- Render action-item content as escaped plain text only.
- Load history/action items without introducing avoidable N+1 queries.
- Add a migration and verified rollback.
- Follow TDD and maintain at least 80% coverage for new code.
- Include unit, integration, E2E, accessibility, mobile, authorization, and regression coverage.

## Acceptance Criteria

1. An instructor can optionally add up to 10 ordered action items to a Revise review.
2. Each item rejects empty, rich-text, or over-500-character input.
3. Pass reviews reject action items.
4. Existing comment-only and feedback-file-only Revise requests remain valid.
5. Rubric-linked items accept only criteria belonging to the reviewed checkpoint’s rubric.
6. Criterion title snapshots remain unchanged after later rubric edits.
7. Review and action items commit atomically, with rollback on persistence failure.
8. Submitted item text and ordering cannot be changed.
9. The student sees the current plan on the authorized checkpoint page.
10. The student can mark and unmark current items addressed.
11. Addressed status never blocks resubmission or automatically changes the review decision.
12. A later Revise plan supersedes the earlier plan without copying, merging, deleting, or mutating historical items.
13. Superseded items are read-only to students; instructors can view their status.
14. Student and instructor review history displays current and prior plans with their statuses.
15. The TRACK-053 Revise action includes unresolved current-plan context without creating a second task system.
16. Submitted and under-review checkpoints remain in the existing waiting summary.
17. Existing `revision_requested` notifications continue to work without a new event type.
18. Audit records exist for plan creation and addressed-status changes without storing full feedback text.
19. Unauthorized users cannot read or mutate another user’s action plans.
20. UI is bilingual, accessible, responsive, and provides appropriate loading, validation, success, and error feedback.
21. Unit, integration, E2E, accessibility, mobile, and regression tests cover validation, transactions, pass/revise behavior, rubric/no-rubric cases, repeated revisions, resubmission, notifications, status changes, and authorization.
22. Typecheck, lint, i18n parity, coverage, modularity, migration/rollback, and build gates pass.

## Out of Scope

- AI-generated feedback or action items
- Automatic grading or Pass/Revise recommendations
- Hard submission gates or required item completion
- Rich text, HTML, templates, or placeholders
- Shared action-plan libraries
- Formal appeals or cross-assignment case files
- Automatic intervention resolution
- New notification event types
- Automatic checkpoint passing
- Instructor confirmation/reopening of student item status
- A separate persisted task system or dedicated action-plan product area
