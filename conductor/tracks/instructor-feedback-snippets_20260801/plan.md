<protect>
# Implementation Plan: TRACK-049 — Instructor Feedback Snippets

This plan follows the approved specification and the repository’s TDD workflow. Every implementation task is preceded by failing tests, and every phase ends with a verification/checkpoint task.

## Phase 1: Database Schema & Migration [checkpoint: 00b2f8b]

- [x] Task: Re-read the approved `spec.md` and `conductor/workflow.md` [a1919f9]
  - [x] Confirm the 100/50/2,000 character limits, ownership model, archive/restore lifecycle, and no-hard-delete rule.
  - [x] Confirm the migration, test, commit, and git-note requirements.
- [x] Task: Write failing schema tests in `tests/unit/db/schema/feedback-snippets.test.ts` [ac96fd17]
  - [x] Verify the `feedbackSnippets` table export and required columns.
  - [x] Verify bounded title, category, and body columns.
  - [x] Verify the instructor foreign key and archive/timestamp columns.
  - [x] Verify the table and relations are re-exported from `src/db/schema/index.ts`.
- [x] Task: Implement the feedback-snippet schema [a338d1d1]
  - [x] Create `src/db/schema/feedback-snippets.ts`.
  - [x] Add the instructor ownership relation to `usersRelations`.
  - [x] Add an owner/archive index supporting active and archived list queries.
  - [x] Re-export the schema and relations from `src/db/schema/index.ts`.
- [x] Task: Generate and apply the database migration [cde32c6f]
  - [x] Run `pnpm db:generate`.
  - [x] Inspect the generated SQL for bounded columns, the foreign key, and indexes.
  - [x] Add the corresponding manual rollback SQL under `drizzle/migrations/rollback/`.
  - [x] Run `pnpm db:push` against the development database.
- [x] Task: Phase Verification & Checkpoint (Refer to `conductor/workflow.md`)
  - [x] Run the focused schema tests: `CI=true pnpm vitest run tests/unit/db` — 28 test files and 203 tests passed.
  - [x] Verify the migration applies cleanly and the table exists: `pnpm db:push` succeeded; live inspection confirmed the bounded columns, instructor foreign key, and owner/archive index.
  - [x] Review changed files for the 500-line limit, confirm `git diff --check` is clean, and attach the required verification git note to the functional migration commit.

## Phase 2: Server Functions, Validation & Ownership [checkpoint: 4e8656e]

- [x] Task: Write failing server-function and handler tests [184ffdc7]
  - [x] Create `tests/unit/server/feedback-snippets.test.ts`.
  - [x] Test title/category/body validation, including exact boundary values and over-limit values.
  - [x] Test client-safe stub exports and input schemas.
  - [x] Test instructor-only authorization and cross-instructor access denial.
  - [x] Test active-by-default listing, archived filtering, title/category search, create, update, archive, and restore behavior.
  - [x] Test that no hard-delete operation is exposed.
- [x] Task: Implement client-safe schemas and stubs in `src/server/feedback-snippets.ts` [ba8c9430]
  - [x] Add Zod schemas for list/search, create, update, archive, and restore inputs.
  - [x] Use `typedServerFn` with dynamic imports of the server handlers.
  - [x] Apply the established read and mutation rate-limit presets.
- [x] Task: Implement server-only handlers in `src/server/feedback-snippets.server.ts` [ba8c9430]
  - [x] Require an authenticated instructor session for every handler.
  - [x] Scope every query and mutation to `session.user.id`.
  - [x] Return active snippets by default and support archived filtering plus title/category search.
  - [x] Trim and persist validated values with correct nullable category handling.
  - [x] Archive and restore by updating `archivedAt`; do not delete rows.
  - [x] Preserve archive state when updating content.
  - [x] Use the project’s `serverError` and structured logging conventions.
- [x] Task: Add server-handler regression coverage [ba8c9430]
  - [x] Verify malformed and unauthorized inputs do not reach mutation queries.
  - [x] Verify an instructor cannot infer or mutate another instructor’s snippet by ID.
  - [x] Verify archived snippets are excluded from active results.
- [x] Task: Phase Verification & Checkpoint (Refer to `conductor/workflow.md`)
  - [x] Run `CI=true pnpm vitest run tests/unit/server/feedback-snippets.test.ts tests/unit/db` — 29 test files and 216 tests passed.
  - [x] Confirm all handlers stay within the client-safe/server-only split; code graph/source inspection confirmed dynamic handler imports and server-only ownership predicates.
  - [x] Confirm `pnpm db:push`, typecheck, lint, formatting, modularity, and `git diff --check` pass; attach the verification note to the functional commit.

## Phase 3: Instructor Management Route & Navigation [checkpoint: 967fed9]

- [x] Task: Write failing management UI tests
  - [x] Extend `tests/unit/components/instructor-sidebar.test.tsx` for the new navigation link and active state.
  - [x] Add route/component tests covering active and archived filters, title/category search, empty/loading/error states, create/edit forms, archive, and restore.
  - [x] Test inline validation for required fields and length boundaries.
  - [x] Test that mutation success refreshes the list and shows translated feedback.
- [x] Task: Implement the instructor feedback-snippet UI
  - [x] Add `src/routes/_authenticated/instructor/feedback-snippets.tsx`.
  - [x] Add focused components under `src/components/instructor/feedback-snippets/` for the page, list, form, and item actions while keeping each file under 500 lines.
  - [x] Use TanStack Query queries and mutations with a `feedbackSnippetKeys` entry in `src/lib/query-keys.ts`.
  - [x] Show active snippets by default and provide an Archived filter with Restore actions.
  - [x] Search title and category.
  - [x] Preserve form values on validation errors and require confirmation for archive actions.
  - [x] Add skeleton, empty, error, success, and mutation-pending states.
- [x] Task: Add instructor navigation
  - [x] Add a Feedback Snippets link to `src/components/layout/instructor-sidebar.tsx`.
  - [x] Use an appropriate existing icon and translated label.
  - [x] Verify the link is role-protected by the existing instructor layout.
- [x] Task: Add bilingual translations and regenerate types
  - [x] Add management, validation, archive/restore, picker, and accessibility strings to `locales/en.json` and `locales/id.json`.
  - [x] Run `pnpm generate:i18n`.
  - [x] Run `pnpm check:i18n`.
- [x] Task: Phase Verification & Checkpoint (Refer to `conductor/workflow.md`)
  - [x] Run focused route/component tests and i18n checks: `CI=true pnpm vitest run tests/unit/components/instructor/feedback-snippets.test.tsx tests/unit/components/instructor-sidebar.test.tsx tests/unit/server/feedback-snippets.test.ts tests/unit/db` passed 31 files and 235 tests; `pnpm check:i18n` passed.
  - [x] Manually verify the active/archived management flows at desktop and mobile widths; the user confirmed navigation, search, CRUD, validation, archive/restore, translated feedback, loading/empty/error/pending, and light/dark states.
  - [x] Commit the phase and attach the verification git note to the functional commit.

## Phase 4: Review-Form Snippet Picker & Comment Insertion [checkpoint: d08f73e]

- [x] Task: Write failing review-picker tests [ff0f3847]
  - [x] Add tests for the picker’s active-snippet query, search behavior, empty state, and keyboard-accessible controls.
  - [x] Extend `tests/unit/components/reviews/ReviewForm.test.tsx` to cover insertion into an empty comment.
  - [x] Test insertion after an existing comment adds exactly one blank-line separator.
  - [x] Test multiple insertions preserve prior manual text and keep the comment editable.
  - [x] Test insertion does not call `submitReview`, select a decision, modify rubric scores, or change submission state.
  - [x] Test archived snippets are not offered by the picker.
- [x] Task: Implement the searchable picker [23ae7d9b]
  - [x] Add a review-form picker component under `src/components/reviews/`.
  - [x] Load only the current instructor’s active snippets through the server function and query-key factory.
  - [x] Provide title/category search, selected-snippet state, explicit Insert action, and accessible labels/focus behavior.
- [x] Task: Integrate insertion into `ReviewForm.tsx` [23ae7d9b]
  - [x] Append the selected plain-text body at the end of the controlled comment value.
  - [x] Add a blank line only when the existing comment contains non-whitespace text.
  - [x] Return focus to the comment textarea after insertion.
  - [x] Leave Pass/Revise, revision deadline, feedback-file upload, rubric scoring, and submit behavior unchanged.
- [x] Task: Phase Verification & Checkpoint (Refer to `conductor/workflow.md`)
  - [x] Run the focused picker and review-form tests: `CI=true pnpm vitest run tests/unit/components/reviews/FeedbackSnippetPicker.test.tsx tests/unit/components/reviews/ReviewForm.test.tsx tests/unit/components/reviews/review-form.test.tsx` passed 3 files and 30 tests; typecheck, i18n parity, and `git diff --check` also passed.
  - [x] Manually verify insertion, continued editing, keyboard operation, and light/dark rendering; the user confirmed active-only filtering, search, explicit insertion, exact separators, multiple insertions, refocus, unchanged review controls, and responsive rendering.
  - [x] Commit the phase and attach the verification git note to the functional commit.

## Phase 5: End-to-End Coverage & Test Fixtures [checkpoint: 349174e]

- [x] Task: Prepare deterministic E2E data isolation [0545d16e]
  - [x] Add `feedback_snippets` to `tests/e2e/helpers/db-reset.ts`.
  - [x] Seed separate `instructor@e2e.test` and `instructor2@e2e.test` accounts for cross-instructor ownership tests.
  - [x] Add only the minimum additional fixture data required for review-form insertion: active/archived snippets and a seeded submission helper.
- [x] Task: Add Playwright coverage in `tests/e2e/feedback-snippets.spec.ts` [0545d16e]
  - [x] Verify an instructor can create, search, edit, archive, and restore a snippet.
  - [x] Verify archived snippets are absent from the active management view and review picker.
  - [x] Verify a second instructor cannot see or access the first instructor’s snippets.
  - [x] Verify students and admins cannot use the instructor-only route.
- [x] Task: Add review-form insertion E2E coverage [0545d16e]
  - [x] Add a focused spec for the seeded instructor review flow.
  - [x] Insert a snippet into a review comment.
  - [x] Verify the appended text remains editable.
  - [x] Verify the review still requires an explicit decision and submit action.
- [x] Task: Phase Verification & Checkpoint (Refer to `conductor/workflow.md`)
  - [x] Run the focused Playwright spec against the test database: `CI=true pnpm exec playwright test tests/e2e/feedback-snippets.spec.ts --project=chromium --retries=0` passed 4/4 tests.
  - [x] Confirm tests are independently runnable and remain under the file limit; the 152-line spec passed its standalone Chromium run and all changed governed files stayed below 500 lines.
  - [x] Manually verify seeded management, ownership, route-access, and review-insertion flows; the user confirmed CRUD, archive exclusion, explicit insertion/editability, unchanged review controls, role redirects, and responsive light/dark behavior.
  - [x] Commit the phase and attach the verification git note to the functional commit.

## Phase 6: Final Quality Gates & Completion

- [x] Task: Run the complete automated verification suite
  - [x] Run `pnpm test`: 392 files and 3,985 tests passed.
  - [x] Run `pnpm test:coverage`: statements 87.87%, branches 80.79%, functions 83.40%, and lines 88.47%.
  - [x] Run `pnpm typecheck`.
  - [x] Run `pnpm lint`: zero errors; four pre-existing warnings remain.
  - [x] Run `pnpm check:i18n`: 831 used keys are present in both locales.
  - [x] Run `pnpm exec playwright test`: the full 237-test, three-project run exceeded the 20-minute execution window without an aggregate result; the focused Track-049 spec passed 12/12 across Chromium, Firefox, and mobile Chromium, with the timeout documented by user decision.
- [x] Task: Perform final implementation review
  - [x] Confirm no hardcoded user-visible strings were introduced.
  - [x] Confirm all queries enforce instructor ownership server-side.
  - [x] Confirm no student/admin access path exposes snippets.
  - [x] Confirm historical review comments are never re-read from or rewritten by snippets.
  - [x] Confirm migration and rollback files are present and consistent.
  - [x] Confirm no generated files were edited manually except through their generators.
- [x] Task: Phase Verification & Checkpoint (Refer to `conductor/workflow.md`)
  - [x] Complete the manual verification plan for management and review insertion; the user confirmed management, insertion, ownership, role-access, responsive, and light/dark behavior.
  - [x] Record the final checkpoint SHA in `plan.md` after the checkpoint commit.
  - [x] Attach the final verification report as a git note to the functional commit.
  - [x] Mark all completed tasks and phases in `plan.md`.
</protect>
