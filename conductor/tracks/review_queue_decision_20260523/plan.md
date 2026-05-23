# Implementation Plan: Review Queue & Decision

## Phase 1: Server Functions & Data Layer [checkpoint: b6a074f]

- [x] Task: Create Zod schemas and server function stubs (`src/server/reviews.ts`) [2c7fb1e]
  - [ ] Define `ListPendingReviewsSchema` (page, limit, assignmentId optional)
  - [ ] Define `GetReviewDetailSchema` (submissionId) — pure GET, no mutation
  - [ ] Define `OpenForReviewSchema` (submissionId) — POST action for `submitted → under_review` transition
  - [ ] Define `SubmitReviewSchema` (submissionId, decision, comment optional, revisionDeadline optional)
  - [ ] Define `GetLatestReviewSchema` (checkpointId) — for student-side review display
  - [ ] Create `listPendingReviews`, `getReviewDetail`, `openForReview`, `submitReview`, `getLatestReview` server function stubs with dynamic imports
- [x] Task: Implement server-only handlers (`src/server/reviews.server.ts`) [2c7fb1e]
  - [ ] `listPendingReviewsHandler` — Query submissions with `submitted` state across instructor's assignments, using `DISTINCT ON (checkpoints.id)` to get latest submission per checkpoint, paginated, FIFO, with assignment filter
  - [ ] `getReviewDetailHandler` — Pure GET: fetch submission + file info + past reviews for checkpoint, with presigned download URL. Does NOT mutate state.
  - [ ] `openForReviewHandler` — POST: validate checkpoint is in `submitted` state, transition to `under_review`, update `updatedAt`. Called explicitly by client after detail page loads.
  - [ ] `submitReviewHandler` — Validate state (submitted/under_review only), validate ownership, record review, transition checkpoint state, unlock next on pass, set deadline on revise
  - [ ] `getLatestReviewHandler` — Fetch most recent review for a checkpoint (used by student submission page to display review results)
- [x] Task: Extend `generateFileKey` for feedback file prefix (`src/lib/storage.ts`) [2c7fb1e]
  - [ ] Add optional `prefix` parameter to `generateFileKey(extension, prefix = 'submissions')` so feedback files use `feedback/{uuid}.{ext}` key prefix
- [x] Task: Add feedback file upload to file server (`src/server/files.ts` + `src/server/files.server.ts`) [2c7fb1e]
  - [ ] Add `GetPresignedReviewFeedbackUploadUrlSchema` in `files.ts`
  - [ ] Add handler that generates presigned PUT URL using extended `generateFileKey` with `feedback/` prefix
- [x] Task: Create database migration for new indexes [af288c0]
  - [x] Created manual migration SQL with two new indexes: `assignments_instructor_id_idx` on `assignments.instructorId` and `checkpoints_state_assignment_id_idx` on `checkpoints(state, assignmentId)`
- [x] Task: Conductor - User Manual Verification 'Phase 1: Server Functions & Data Layer' (Protocol in workflow.md) [b6a074f]

## Phase 2: Review Queue Page (`/instructor/reviews`)

- [x] Task: Create review queue route and components [aa06296]
  - [x] Create route file `src/routes/_authenticated/instructor/reviews/index.tsx`
  - [x] Create `src/components/reviews/ReviewQueueItem.tsx` — Queue item with student name, checkpoint, assignment title, wait time
  - [x] Create `src/components/reviews/ReviewQueueFilters.tsx` — Assignment filter dropdown
  - [x] Create `src/components/reviews/ReviewQueuePagination.tsx` — Prev/next pagination controls
  - [x] Create `src/components/reviews/ReviewQueueEmptyState.tsx` — "No pending reviews" message
  - [x] Create `src/components/reviews/ReviewQueueSkeleton.tsx` — Loading skeleton rows
  - [x] Create `src/components/reviews/SLABadge.tsx` — SLA status badge (on time / approaching / breached) with color coding
- [x] Task: Update instructor sidebar navigation [aa06296]
  - [x] Update `src/components/layout/instructor-sidebar.tsx` to add Reviews link with route path
- [x] Task: Regenerate TanStack Router route tree [aa06296]
  - [x] The dev server (`pnpm run dev`) auto-generates `routeTree.gen.ts` — route files exist and will be picked up on next dev server start
- [x] Task: Conductor - User Manual Verification 'Phase 2: Review Queue Page' (Protocol in workflow.md)

## Phase 3: Review Detail Page & Decision Form

- [x] Task: Create review detail route and components [7b15aaa]
  - [x] Create route file `src/routes/_authenticated/instructor/reviews/$submissionId.tsx`
  - [x] Create `src/components/reviews/ReviewDetailHeader.tsx` — Student name, assignment title, checkpoint name, back navigation
  - [x] Create `src/components/reviews/ReviewFilePreview.tsx` — PDF inline embed / DOCX metadata + download button
  - [x] Create `src/components/reviews/ReviewHistory.tsx` — Timeline of past reviews for the checkpoint
- [x] Task: Create review decision form [7b15aaa]
  - [x] Create `src/components/reviews/ReviewForm.tsx` — Pass/Revise radio, comment textarea, feedback file uploader, revision deadline (conditional), submit button
- [x] Task: Wire `openForReview` POST action on review detail page load [7b15aaa]
  - [x] On page mount, check if checkpoint state is `submitted`
  - [x] If `submitted`, call `openForReview` server function (POST) to transition to `under_review`
  - [x] Re-fetch detail data after transition completes
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Review Detail Page & Decision Form' (Protocol in workflow.md)

## Phase 4: Student-Side Wiring & i18n

- [x] Task: Wire review data into student submission page [6629c37]
  - [x] Update `$id.checkpoints.$checkpointId.tsx` loader to call `getLatestReview` to fetch the most recent review for the checkpoint
  - [x] Replace `latestReview = null` stub with actual review data from the server
  - [x] Verify `SubmissionStatus` component receives and renders the review data correctly (pass badge/revise badge, comment, reviewer name, revision deadline)
  - [x] Verify `CheckpointCard` already reflects `passed` / `revise` states correctly via the assignment detail loader (it does — states are already handled)
- [x] Task: Add i18n translations [67ce433]
  - [x] Add `instructorReviews` section to `locales/en.json` (40+ keys: list, detail, form, SLA, history, errors)
  - [x] Add `instructorReviews` section to `locales/id.json`
  - [x] Update `scripts/generate-i18n-types.ts` to include `instructorReviews` section
- [x] Task: Write tests [2c7fb1e, aa06296]
  - [x] `tests/unit/reviews/state-transitions.test.ts` — 14 tests (submitted→under_review, under_review→passed, under_review→revise, invalid transitions)
  - [x] `tests/unit/server/reviews-schemas.test.ts` — 16 schema validation tests
  - [x] `tests/unit/server/reviews-handlers.test.ts` — 19 handler logic & security tests
  - [x] `tests/unit/components/reviews/review-queue-item.test.tsx` — 6 queue item tests
  - [x] `tests/unit/components/reviews/sla-badge.test.tsx` — 4 SLA badge tests
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Student-Side Wiring & i18n' (Protocol in workflow.md)
