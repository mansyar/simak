# TRACK-054 — Feedback-to-Revision Action Plans Implementation Plan

This plan follows the approved specification and `conductor/workflow.md`: every implementation task is preceded by failing tests, each phase ends with verification/checkpoint work, and all tasks begin as `[ ]`.

## Phase 1: Database Schema & Migration

**Objective:** Persist immutable, review-owned action items with rubric snapshots and reversible addressed state.

- [x] Task: Re-read the approved `spec.md` and `conductor/workflow.md` [82a671c]
  - [x] Confirm the optional Revise-only lifecycle, 10-item/500-character limits, immutable fields, current-plan rules, and authorization boundaries.
  - [x] Confirm migration, rollback, TDD, coverage, file-size, commit, and git-note requirements.
  - [x] Inspect existing `reviews`, `review_scores`, `rubric_criteria`, audit, and migration conventions before changing schema code.

- [x] Task: Write failing schema tests in `tests/unit/db/schema/revision-action-items.test.ts` [be6c7a3]
  - [x] Verify the `revisionActionItems` table export and required columns.
  - [x] Verify the review ownership foreign key and optional rubric-criterion foreign key.
  - [x] Verify nullable criterion/title snapshot and addressed timestamp fields.
  - [x] Verify stable ordering and indexes supporting review-history/current-plan reads.
  - [x] Verify the schema and relations are re-exported through `src/db/schema/index.ts`.

- [x] Task: Implement the revision action-item schema [be6c7a3]
  - [x] Create `src/db/schema/revision-action-items.ts` using the existing Drizzle conventions.
  - [x] Add the review reference, plain-text item field, stable order, optional criterion link, criterion-title snapshot, addressed timestamp, and timestamps.
  - [x] Add indexes for review/order and current status lookup.
  - [x] Re-export the schema and any required relations from `src/db/schema/index.ts`.
  - [x] Keep historical rows and snapshots valid when rubric definitions are later edited or soft-deleted.

- [x] Task: Generate and apply the database migration [71af589]
  - [x] Run `pnpm db:generate`.
  - [x] Inspect generated SQL for bounded text, foreign keys, nullability, indexes, and non-destructive behavior.
  - [x] Add the matching manual rollback under `drizzle/migrations/rollback/`.
  - [x] Run `pnpm db:push` against the development database.
  - [x] Verify the table and constraints exist in the database.

- [x] Task: Phase Verification & Checkpoint — database schema [71af589]
  - [x] Run the focused schema tests and confirm the Red-to-Green transition.
  - [x] Verify migration application and rollback SQL.
  - [x] Review changed schema files for file limits, formatting, and `git diff --check`.
  - [x] Complete the workflow’s manual verification and attach the required git note after the functional commit.

## Phase 2: Validation, Review Transaction & Server Data

**Objective:** Add validated action-plan submission, atomic persistence, historical reads, audit records, and student status mutation without regressing existing review behavior.

- [x] Task: Write failing server and schema tests [3e6818f]
  - [x] Extend `tests/unit/server/reviews-schemas.test.ts` for optional action items, exact 10-item and 500-character boundaries, empty/over-limit rejection, plain-text input, and Pass rejection.
  - [x] Add `tests/unit/server/revision-action-items.test.ts` for criterion ownership, current-plan checks, addressed/unaddressed transitions, and authorization.
  - [x] Extend review-handler tests for comment-only and feedback-file-only Revise compatibility.
  - [x] Test rubric-linked and no-rubric submissions.
  - [x] Test review/action-item transaction rollback when action-item persistence fails.
  - [x] Test review detail/latest review responses include ordered action items and criterion snapshots.
  - [x] Test repeated revisions preserve old rows without copying or merging.
  - [x] Test notification reuse and audit details that omit full action-item text.
  - [x] Test student, instructor, cross-student, and cross-instructor access boundaries.

- [x] Task: Implement client-safe validation and status-function stubs [59767f9]
  - [x] Extend `SubmitReviewSchema` in `src/server/reviews.ts` with the optional ordered action-item input.
  - [x] Preserve the existing dynamic import and typed server-function pattern.
  - [x] Create `src/server/revision-action-items.ts` with the addressed-status schema and client-safe mutation stub.
  - [x] Apply the project’s appropriate read/mutation rate-limit middleware.

- [x] Task: Implement server-only action-item helpers and addressed-status handler [36ea20d]
  - [x] Create `src/server/revision-action-items.server.ts` for reusable action-item reads, transaction insertion, current-plan resolution, and status mutation.
  - [x] Validate that linked criteria belong to the reviewed checkpoint’s rubric and snapshot the criterion title.
  - [x] Insert items in the caller’s existing review transaction rather than opening a second transaction.
  - [x] For status changes, verify the authenticated student owns the checkpoint and the item belongs to the current non-superseded plan.
  - [x] Lock/recheck the relevant review/checkpoint state before updating `addressedAt` so a superseding review cannot race with a status mutation.
  - [x] Allow only the owning student to mark or unmark; make instructor reads read-only.

- [x] Task: Extend review submission atomically [1558ecb]
  - [x] Update `submitReviewHandler` to validate action-item rules before any write.
  - [x] Insert action items after the review ID is created and alongside rubric scores inside the existing transaction.
  - [x] Reject structured items for Pass while preserving all existing Pass/Revise, deadline, file, score, state-transition, and resubmission behavior.
  - [x] Return the inserted review/action-plan metadata needed for post-commit audit logging.
  - [x] Keep `src/server/reviews.server.ts` under 500 lines; extract action-item logic to the handler-only helper if necessary.

- [x] Task: Extend instructor and student review reads [b586158]
  - [x] Extend `getReviewDetailHandler` to return action items grouped by review in stable order.
  - [x] Extend `getLatestReviewHandler` with current/latest action items and the review-history action-item data needed by the student checkpoint page.
  - [x] Batch-load action items by review IDs to avoid N+1 queries.
  - [x] Preserve all existing response fields for current callers.
  - [x] Preserve criterion/title snapshots when rubric criteria change.

- [x] Task: Add audit records and preserve notification behavior [1558ecb, 36ea20d]
  - [x] Record action-plan creation with review/checkpoint references and item count, without full item text.
  - [x] Record addressed and unaddressed transitions with item/review references and new status.
  - [x] Use advisory audit logging conventions so audit failures do not fail a successful review or status mutation.
  - [x] Continue emitting the existing `revision_requested` notification exactly once for Revise reviews.
  - [x] Do not add a new notification event type or per-item notifications.

- [x] Task: Phase Verification & Checkpoint — server and transaction layer [fce35be]
  - [x] Run focused schema, review-schema, review-handler, action-item, and review-extra tests.
  - [x] Run integration coverage for transaction rollback and authorization paths.
  - [x] Inspect the code graph for accidental client imports of `.server.ts` handlers.
  - [x] Verify file limits, audit redaction, query scoping, and `git diff --check`.
  - [x] Complete manual verification, attach the verification git note, and record the phase checkpoint.

## Phase 3: Instructor Authoring & Review History

**Objective:** Let instructors compose ordered action plans inside the existing ReviewForm and view current/historical statuses without mutating them.

- [x] Task: Write failing instructor UI tests [a9727f3]
  - [x] Add `tests/unit/components/reviews/RevisionActionPlanEditor.test.tsx`.
  - [x] Extend `tests/unit/components/reviews/ReviewForm.test.tsx` for Revise-only visibility, add/remove/reorder, exact limits, validation, criterion selection, and submitted payload ordering.
  - [x] Verify Pass submissions do not send action items and existing comment/file/rubric controls remain unchanged.
  - [x] Extend `tests/unit/components/reviews/review-history.test.tsx` for ordered action items, current-plan labeling, historical status display, and instructor read-only behavior.
  - [x] Extend the instructor review-detail route tests for action-plan data pass-through.

- [x] Task: Implement the ReviewForm action-plan editor [ed9e6c5]
  - [x] Create a focused component under `src/components/reviews/` for action-item editing.
  - [x] Integrate it into `src/components/reviews/ReviewForm.tsx` only when Revise is selected.
  - [x] Support adding, removing, and keyboard-accessible reordering.
  - [x] Support plain-text entry, per-item validation, item count feedback, and optional rubric-criterion selection.
  - [x] Preserve existing feedback snippet insertion, feedback-file upload, revision deadline, rubric scoring, and submit behavior.
  - [x] Ensure user-visible strings use i18n keys and files remain under 500 lines.

- [x] Task: Implement instructor history visibility [ed9e6c5]
  - [x] Extend `src/components/reviews/ReviewHistory.tsx` types and rendering for action items.
  - [x] Display current and historical plan status without providing instructor mutation controls.
  - [x] Keep comments, feedback files, decisions, dates, rubric results, and existing empty states intact.
  - [x] Use stable React keys and escaped plain-text rendering.

- [x] Task: Add instructor translations and accessibility behavior [ed9e6c5]
  - [x] Add English and Indonesian labels, validation messages, count limits, reorder labels, status text, and announcements.
  - [x] Run `pnpm generate:i18n`.
  - [x] Verify `pnpm check:i18n` parity.
  - [x] Verify keyboard operation, focus visibility, semantic labels, live mutation/validation feedback, dark mode, and 320px responsive layout.

- [x] Task: Phase Verification & Checkpoint — instructor experience [1939ec0]
  - [x] Run focused editor, ReviewForm, ReviewHistory, and route tests.
  - [x] Manually verify Pass/Revise switching, ordered submission, rubric/no-rubric behavior, and read-only history.
  - [x] Review i18n, accessibility, file-size, and backward-compatibility requirements.
  - [x] Attach the verification git note and record the phase checkpoint after confirmation.

## Phase 4: Student Current Plan, Status Updates & History

**Objective:** Present the current plan on the authorized checkpoint page and allow only the owning student to toggle current item status.

- [x] Task: Write failing student UI and route tests [6871e47]
  - [x] Add `tests/unit/components/student/RevisionActionPlan.test.tsx`.
  - [x] Verify current-plan rendering in stable order, addressed/unaddressed states, and reversible toggles.
  - [x] Verify superseded plans are read-only and historical statuses remain visible.
  - [x] Verify loading, mutation-pending, success, error, empty, and no-plan states.
  - [x] Extend `tests/unit/routes/_authenticated/student/assignments/$id.checkpoints.$checkpointId.test.tsx` for loader data, current plan, and prior-plan presentation.
  - [x] Verify existing submission upload, review status, rubric result, file history, discussion, and checkpoint gating behavior remains unchanged.

- [x] Task: Implement the student action-plan components and page integration [e66ba16]
  - [x] Create focused student components under `src/components/student/` for the current plan and historical plan display.
  - [x] Extend the checkpoint route loader to retain action-plan and review-history data from the existing review request.
  - [x] Render the current plan in the checkpoint page with progressive disclosure and a clear relationship to the latest Revise feedback.
  - [x] Add addressed-status mutation handling with immediate feedback and safe local/router refresh behavior.
  - [x] Disable mutation controls for superseded plans and during pending requests.
  - [x] Keep item text plain text and escaped.

- [x] Task: Add student translations and accessibility behavior [e66ba16]
  - [x] Add English and Indonesian current-plan, historical-plan, addressed-status, error, and accessibility labels.
  - [x] Regenerate i18n types and run locale parity checks.
  - [x] Verify keyboard and screen-reader operation, focus behavior, semantic checkbox/button state, live announcements, contrast, touch targets, and mobile layout.

- [x] Task: Phase Verification & Checkpoint — student experience [e66ba16]
  - [x] Run focused component and checkpoint-route tests.
  - [x] Manually verify current-plan toggling, reversal, historical read-only behavior, resubmission non-blocking behavior, and no-plan backward compatibility.
  - [x] Verify student authorization is enforced server-side rather than only hidden in the UI.
  - [x] Attach the verification git note and record the phase checkpoint after confirmation.

## Phase 5: TRACK-053 Next Actions Integration

**Objective:** Enrich the existing Revise action with unresolved current-plan context without introducing a second task system or changing waiting-state behavior.

- [x] Task: Write failing resolver and dashboard tests [d5531dc]
  - [x] Extend `tests/unit/lib/student-next-actions.test.ts` for unresolved current-plan data on Revise candidates.
  - [x] Verify addressed items are excluded from unresolved context.
  - [x] Verify only the newest current plan contributes items; historical plans are ignored by the resolver.
  - [x] Verify no-plan and all-addressed behavior preserves the existing Revise action contract.
  - [x] Extend `tests/unit/server/dashboard-student-next-actions.test.ts` for authorized batch loading, repeated revisions, resubmission, and cross-student isolation.
  - [x] Verify submitted and under-review checkpoints remain waiting summaries and do not expose action-plan items as primary actions.
  - [x] Extend `tests/unit/components/dashboard/StudentNextActions.test.tsx` for localized unresolved-plan context, display limits, empty states, and accessible links.

- [x] Task: Extend the resolver contract and dashboard query assembly [4d626fd]
  - [x] Add the smallest action-plan summary needed to `StudentActionCandidate` and `StudentNextAction`.
  - [x] Query unresolved items for current Revise plans in batch, scoped to the authenticated student.
  - [x] Preserve existing priority order, one-action-per-checkpoint deduplication, five-primary cap, waiting-summary cap, and destination links.
  - [x] Avoid per-checkpoint N+1 queries and do not persist dashboard task records.
  - [x] Keep `src/lib/student-next-actions.ts` pure and free of database/client-incompatible imports.

- [x] Task: Implement dashboard presentation [4d626fd]
  - [x] Update `src/components/dashboard/StudentNextActions.tsx` to show concise unresolved-plan context without turning each item into a separate action.
  - [x] Preserve the existing submit, revise, consultation, waiting, and empty-state behavior.
  - [x] Add only translated, accessible UI strings and retain responsive behavior.

- [x] Task: Phase Verification & Checkpoint — Next Actions [4d626fd]
  - [x] Run focused resolver, dashboard-handler, and dashboard-component tests.
  - [x] Manually verify current-plan-only resolution, addressed filtering, repeated revisions, resubmission waiting behavior, and existing priority ordering.
  - [x] Verify no duplicate task surface or notification behavior was introduced.
  - [x] Attach the verification git note and record the phase checkpoint after confirmation.

## Phase 6: Integration, E2E, Accessibility & Regression Coverage

**Objective:** Verify complete instructor-to-student revision cycles and security boundaries against a real database and browser.

- [x] Task: Write failing integration and E2E tests [8ae548f]
  - [x] Add `tests/integration/server/revision-action-plans.test.ts` with the Node test environment.
  - [x] Cover migration-backed insert/read/update behavior, transaction rollback, rubric/no-rubric validation, repeated revisions, supersession, resubmission, and addressed reversal.
  - [x] Cover student/instructor ownership and cross-user denial through real handler calls.
  - [x] Add `tests/e2e/revision-action-plans.spec.ts`.
  - [x] Cover instructor creation of a Revise plan, student visibility/toggling, Next Actions context, resubmission, a later superseding plan, and historical display.
  - [x] Cover comment-only Revise compatibility, Pass rejection, rubric-linked items, no-rubric items, notification compatibility, and audit records.
  - [x] Add focused axe-core checks for instructor ReviewForm/review history and student checkpoint/current plan.
  - [x] Add mobile viewport checks for no horizontal overflow and usable touch targets.

- [x] Task: Add deterministic test fixtures and reset handling [f923875]
  - [x] Add `revision_action_items` cleanup in `tests/e2e/helpers/db-reset.ts` with correct foreign-key ordering.
  - [x] Add only the minimum seeded review, rubric, assignment, student, and instructor data required for independent tests.
  - [x] Ensure tests do not depend on execution order or prior plan status.

- [x] Task: Run focused integration, browser, and accessibility verification [f923875]
  - [x] Run the focused integration test suite.
  - [x] Run the focused Playwright spec on Chromium and the configured mobile project.
  - [x] Run focused axe-core coverage and inspect any serious/critical findings.
  - [x] Document unrelated pre-existing E2E limitations separately from Track-054 failures.

- [x] Task: Phase Verification & Checkpoint — end-to-end behavior [f923875]
  - [x] Confirm the complete review → plan → student status → resubmission → superseding review flow.
  - [x] Confirm authorization isolation and audit/notification outcomes.
  - [x] Confirm English/Indonesian rendering, keyboard operation, responsive behavior, and dark mode.
  - [x] Attach the verification git note and record the phase checkpoint after confirmation.

## Phase 7: Final Quality Gates & Track Readiness

**Objective:** Confirm the entire feature satisfies the approved specification and repository gates before implementation handoff/review.

- [x] Task: Run the complete automated quality gates [2330ee8]
  - [x] Run `pnpm test` — 423 files and 4,201 tests passed when run in isolation.
  - [x] Run `pnpm test:coverage` and confirm all thresholds remain at or above 80% — 87.80% statements, 80.93% branches, 83.79% functions, and 88.64% lines.
  - [x] Run `pnpm test:integration` — Track-054 integration passed 3/3; two unrelated pre-existing suites remain failing (email-queue logger initialization and create-assignment deadline validation).
  - [x] Run `pnpm typecheck`.
  - [x] Run `pnpm lint` — zero errors; four pre-existing warnings remain in unrelated files.
  - [x] Run `pnpm check:i18n` — all 985 used keys exist in both locales.
  - [x] Run the project formatter/check and verify no unintended formatting changes — `pnpm format` completed with no diff.
  - [x] Run `pnpm build`.
  - [x] Confirm no later source changes require another focused Track-054 Playwright/accessibility run.

- [~] Task: Perform final implementation review against the approved specification.
  - [~] Confirm every acceptance criterion is covered by implementation and tests.
  - [~] Confirm all server handlers enforce instructor/student authorization.
  - [~] Confirm action-item text/order/snapshots are immutable after review submission.
  - [~] Confirm current-plan resolution and supersession never copy or merge historical items.
  - [~] Confirm addressed updates cannot block resubmission or alter review decisions.
  - [~] Confirm no new notification type or duplicate task system exists.
  - [~] Confirm audit records omit full feedback text.
  - [~] Confirm all governed files are under 500 lines and generated i18n files were not manually edited.
  - [~] Confirm migrations and rollback artifacts are present and consistent.
  - [~] Review the final diff for secrets, hardcoded UI strings, unsafe rendering, N+1 queries, and `git diff --check`.

- [ ] Task: Phase Verification & Checkpoint — final quality and readiness.
  - [ ] Complete the workflow’s manual verification plan and obtain explicit user confirmation.
  - [ ] Attach the final verification report as a git note to the functional commit.
  - [ ] Record the final phase checkpoint SHA in `plan.md`.
  - [ ] Mark implementation tasks complete only after their corresponding commits and verification are recorded.
  - [ ] Prepare the track for `conductor-review`.
