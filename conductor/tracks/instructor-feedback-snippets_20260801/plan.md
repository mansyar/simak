<protect>
# Implementation Plan: TRACK-049 — Instructor Feedback Snippets

This plan follows the approved specification and the repository’s TDD workflow. Every implementation task is preceded by failing tests, and every phase ends with a verification/checkpoint task.

## Phase 1: Database Schema & Migration

- [x] Task: Re-read the approved `spec.md` and `conductor/workflow.md` [a1919f9]
  - [x] Confirm the 100/50/2,000 character limits, ownership model, archive/restore lifecycle, and no-hard-delete rule.
  - [x] Confirm the migration, test, commit, and git-note requirements.
- [x] Task: Write failing schema tests in `tests/unit/db/schema/feedback-snippets.test.ts`
  - [x] Verify the `feedbackSnippets` table export and required columns.
  - [x] Verify bounded title, category, and body columns.
  - [x] Verify the instructor foreign key and archive/timestamp columns.
  - [x] Verify the table and relations are re-exported from `src/db/schema/index.ts`.
- [ ] Task: Implement the feedback-snippet schema
  - [ ] Create `src/db/schema/feedback-snippets.ts`.
  - [ ] Add the instructor ownership relation to `usersRelations`.
  - [ ] Add an owner/archive index supporting active and archived list queries.
  - [ ] Re-export the schema and relations from `src/db/schema/index.ts`.
- [ ] Task: Generate and apply the database migration
  - [ ] Run `pnpm db:generate`.
  - [ ] Inspect the generated SQL for bounded columns, the foreign key, and indexes.
  - [ ] Add the corresponding manual rollback SQL under `drizzle/migrations/rollback/`.
  - [ ] Run `pnpm db:push` against the development database.
- [ ] Task: Phase Verification & Checkpoint (Refer to `conductor/workflow.md`)
  - [ ] Run the focused schema tests.
  - [ ] Verify the migration applies cleanly and the table exists.
  - [ ] Review changed files for the 500-line limit and commit the phase with the required git note.

## Phase 2: Server Functions, Validation & Ownership

- [ ] Task: Write failing server-function and handler tests
  - [ ] Create `tests/unit/server/feedback-snippets.test.ts`.
  - [ ] Test title/category/body validation, including exact boundary values and over-limit values.
  - [ ] Test client-safe stub exports and input schemas.
  - [ ] Test instructor-only authorization and cross-instructor access denial.
  - [ ] Test active-by-default listing, archived filtering, title/category search, create, update, archive, and restore behavior.
  - [ ] Test that no hard-delete operation is exposed.
- [ ] Task: Implement client-safe schemas and stubs in `src/server/feedback-snippets.ts`
  - [ ] Add Zod schemas for list/search, create, update, archive, and restore inputs.
  - [ ] Use `typedServerFn` with dynamic imports of the server handlers.
  - [ ] Apply the established read and mutation rate-limit presets.
- [ ] Task: Implement server-only handlers in `src/server/feedback-snippets.server.ts`
  - [ ] Require an authenticated instructor session for every handler.
  - [ ] Scope every query and mutation to `session.user.id`.
  - [ ] Return active snippets by default and support archived filtering plus title/category search.
  - [ ] Trim and persist validated values with correct nullable category handling.
  - [ ] Archive and restore by updating `archivedAt`; do not delete rows.
  - [ ] Preserve archive state when updating content.
  - [ ] Use the project’s `serverError` and structured logging conventions.
- [ ] Task: Add server-handler regression coverage
  - [ ] Verify malformed and unauthorized inputs do not reach mutation queries.
  - [ ] Verify an instructor cannot infer or mutate another instructor’s snippet by ID.
  - [ ] Verify archived snippets are excluded from active results.
- [ ] Task: Phase Verification & Checkpoint (Refer to `conductor/workflow.md`)
  - [ ] Run the focused server/schema tests.
  - [ ] Confirm all handlers stay within the client-safe/server-only split.
  - [ ] Commit the phase and attach the task summary git note.

## Phase 3: Instructor Management Route & Navigation

- [ ] Task: Write failing management UI tests
  - [ ] Extend `tests/unit/components/instructor-sidebar.test.tsx` for the new navigation link and active state.
  - [ ] Add route/component tests covering active and archived filters, title/category search, empty/loading/error states, create/edit forms, archive, and restore.
  - [ ] Test inline validation for required fields and length boundaries.
  - [ ] Test that mutation success refreshes the list and shows translated feedback.
- [ ] Task: Implement the instructor feedback-snippet UI
  - [ ] Add `src/routes/_authenticated/instructor/feedback-snippets.tsx`.
  - [ ] Add focused components under `src/components/instructor/feedback-snippets/` for the page, list, form, and item actions while keeping each file under 500 lines.
  - [ ] Use TanStack Query queries and mutations with a `feedbackSnippetKeys` entry in `src/lib/query-keys.ts`.
  - [ ] Show active snippets by default and provide an Archived filter with Restore actions.
  - [ ] Search title and category.
  - [ ] Preserve form values on validation errors and require confirmation for archive actions.
  - [ ] Add skeleton, empty, error, success, and mutation-pending states.
- [ ] Task: Add instructor navigation
  - [ ] Add a Feedback Snippets link to `src/components/layout/instructor-sidebar.tsx`.
  - [ ] Use an appropriate existing icon and translated label.
  - [ ] Verify the link is role-protected by the existing instructor layout.
- [ ] Task: Add bilingual translations and regenerate types
  - [ ] Add management, validation, archive/restore, picker, and accessibility strings to `locales/en.json` and `locales/id.json`.
  - [ ] Run `pnpm generate:i18n`.
  - [ ] Run `pnpm check:i18n`.
- [ ] Task: Phase Verification & Checkpoint (Refer to `conductor/workflow.md`)
  - [ ] Run focused route/component tests and i18n checks.
  - [ ] Manually verify the active/archived management flows at desktop and mobile widths.
  - [ ] Commit the phase and attach the verification git note.

## Phase 4: Review-Form Snippet Picker & Comment Insertion

- [ ] Task: Write failing review-picker tests
  - [ ] Add tests for the picker’s active-snippet query, search behavior, empty state, and keyboard-accessible controls.
  - [ ] Extend `tests/unit/components/reviews/ReviewForm.test.tsx` to cover insertion into an empty comment.
  - [ ] Test insertion after an existing comment adds exactly one blank-line separator.
  - [ ] Test multiple insertions preserve prior manual text and keep the comment editable.
  - [ ] Test insertion does not call `submitReview`, select a decision, modify rubric scores, or change submission state.
  - [ ] Test archived snippets are not offered by the picker.
- [ ] Task: Implement the searchable picker
  - [ ] Add a review-form picker component under `src/components/reviews/`.
  - [ ] Load only the current instructor’s active snippets through the server function and query-key factory.
  - [ ] Provide title/category search, selected-snippet state, explicit Insert action, and accessible labels/focus behavior.
- [ ] Task: Integrate insertion into `ReviewForm.tsx`
  - [ ] Append the selected plain-text body at the end of the controlled comment value.
  - [ ] Add a blank line only when the existing comment contains non-whitespace text.
  - [ ] Return focus to the comment textarea after insertion.
  - [ ] Leave Pass/Revise, revision deadline, feedback-file upload, rubric scoring, and submit behavior unchanged.
- [ ] Task: Phase Verification & Checkpoint (Refer to `conductor/workflow.md`)
  - [ ] Run the focused picker and review-form tests.
  - [ ] Manually verify insertion, continued editing, keyboard operation, and light/dark rendering.
  - [ ] Commit the phase and attach the verification git note.

## Phase 5: End-to-End Coverage & Test Fixtures

- [ ] Task: Prepare deterministic E2E data isolation
  - [ ] Add `feedback_snippets` to `tests/e2e/helpers/db-reset.ts`.
  - [ ] Confirm the existing seeded instructor accounts are sufficient for cross-instructor ownership tests.
  - [ ] Add only the minimum additional fixture data required for review-form insertion.
- [ ] Task: Add Playwright coverage in `tests/e2e/feedback-snippets.spec.ts`
  - [ ] Verify an instructor can create, search, edit, archive, and restore a snippet.
  - [ ] Verify archived snippets are absent from the active management view and review picker.
  - [ ] Verify a second instructor cannot see or access the first instructor’s snippets.
  - [ ] Verify students and admins cannot use the instructor-only route.
- [ ] Task: Add review-form insertion E2E coverage
  - [ ] Extend the existing instructor review flow or add a focused spec.
  - [ ] Insert a snippet into a review comment.
  - [ ] Verify the appended text remains editable.
  - [ ] Verify the review still requires an explicit decision and submit action.
- [ ] Task: Phase Verification & Checkpoint (Refer to `conductor/workflow.md`)
  - [ ] Run the focused Playwright spec against the test database.
  - [ ] Confirm tests are independently runnable and remain under the file limit.
  - [ ] Commit the phase and attach the verification git note.

## Phase 6: Final Quality Gates & Completion

- [ ] Task: Run the complete automated verification suite
  - [ ] Run `pnpm test`.
  - [ ] Run `pnpm test:coverage` and confirm all thresholds remain at or above 80%.
  - [ ] Run `pnpm typecheck`.
  - [ ] Run `pnpm lint`.
  - [ ] Run `pnpm check:i18n`.
  - [ ] Run `pnpm exec playwright test`.
- [ ] Task: Perform final implementation review
  - [ ] Confirm no hardcoded user-visible strings were introduced.
  - [ ] Confirm all queries enforce instructor ownership server-side.
  - [ ] Confirm no student/admin access path exposes snippets.
  - [ ] Confirm historical review comments are never re-read from or rewritten by snippets.
  - [ ] Confirm migration and rollback files are present and consistent.
  - [ ] Confirm no generated files were edited manually except through their generators.
- [ ] Task: Phase Verification & Checkpoint (Refer to `conductor/workflow.md`)
  - [ ] Complete the manual verification plan for management and review insertion.
  - [ ] Record the final checkpoint SHA in `plan.md`.
  - [ ] Attach the final verification report as a git note.
  - [ ] Mark all completed tasks and phases in `plan.md`.
</protect>
