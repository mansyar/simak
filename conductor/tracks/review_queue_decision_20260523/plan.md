# Implementation Plan: Review Queue & Decision

## Phase 1: Server Functions & Data Layer

- [ ] Task: Create Zod schemas and server function stubs (`src/server/reviews.ts`)
  - [ ] Define `ListPendingReviewsSchema` (page, limit, assignmentId optional)
  - [ ] Define `GetReviewDetailSchema` (submissionId) — pure GET, no mutation
  - [ ] Define `OpenForReviewSchema` (submissionId) — POST action for `submitted → under_review` transition
  - [ ] Define `SubmitReviewSchema` (submissionId, decision, comment optional, revisionDeadline optional)
  - [ ] Define `GetLatestReviewSchema` (checkpointId) — for student-side review display
  - [ ] Create `listPendingReviews`, `getReviewDetail`, `openForReview`, `submitReview`, `getLatestReview` server function stubs with dynamic imports
- [ ] Task: Implement server-only handlers (`src/server/reviews.server.ts`)
  - [ ] `listPendingReviewsHandler` — Query submissions with `submitted` state across instructor's assignments, using `DISTINCT ON (checkpoints.id)` to get latest submission per checkpoint, paginated, FIFO, with assignment filter
  - [ ] `getReviewDetailHandler` — Pure GET: fetch submission + file info + past reviews for checkpoint, with presigned download URL. Does NOT mutate state.
  - [ ] `openForReviewHandler` — POST: validate checkpoint is in `submitted` state, transition to `under_review`, update `updatedAt`. Called explicitly by client after detail page loads.
  - [ ] `submitReviewHandler` — Validate state (submitted/under_review only), validate ownership, record review, transition checkpoint state, unlock next on pass, set deadline on revise
  - [ ] `getLatestReviewHandler` — Fetch most recent review for a checkpoint (used by student submission page to display review results)
- [ ] Task: Extend `generateFileKey` for feedback file prefix (`src/lib/storage.ts`)
  - [ ] Add optional `prefix` parameter to `generateFileKey(extension, prefix = 'submissions')` so feedback files use `feedback/{uuid}.{ext}` key prefix
- [ ] Task: Add feedback file upload to file server (`src/server/files.ts` + `src/server/files.server.ts`)
  - [ ] Add `GetPresignedReviewFeedbackUploadUrlSchema` in `files.ts`
  - [ ] Add handler that generates presigned PUT URL using extended `generateFileKey` with `feedback/` prefix
- [ ] Task: Create database migration for new indexes
  - [ ] Run `drizzle-kit generate` to create migration with two new indexes: `assignments_instructor_id_idx` on `assignments.instructorId` and `checkpoints_state_assignment_id_idx` on `checkpoints(state, assignmentId)`
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Server Functions & Data Layer' (Protocol in workflow.md)

## Phase 2: Review Queue Page (`/instructor/reviews`)

- [ ] Task: Create review queue route and components
  - [ ] Create route file `src/routes/_authenticated/instructor/reviews/index.tsx`
  - [ ] Create `src/components/reviews/ReviewQueueItem.tsx` — Queue item with student name, checkpoint, assignment title, wait time
  - [ ] Create `src/components/reviews/ReviewQueueFilters.tsx` — Assignment filter dropdown
  - [ ] Create `src/components/reviews/ReviewQueuePagination.tsx` — Prev/next pagination controls
  - [ ] Create `src/components/reviews/ReviewQueueEmptyState.tsx` — "No pending reviews" message
  - [ ] Create `src/components/reviews/ReviewQueueSkeleton.tsx` — Loading skeleton rows
  - [ ] Create `src/components/reviews/SLABadge.tsx` — SLA status badge (on time / approaching / breached) with color coding
- [ ] Task: Update instructor sidebar navigation
  - [ ] Update `src/components/layout/instructor-sidebar.tsx` to add Reviews link with route path
- [ ] Task: Regenerate TanStack Router route tree
  - [ ] The dev server (`pnpm run dev`) auto-generates `routeTree.gen.ts` — verify it picks up the new `/instructor/reviews` route files
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Review Queue Page' (Protocol in workflow.md)

## Phase 3: Review Detail Page & Decision Form

- [ ] Task: Create review detail route and components
  - [ ] Create route file `src/routes/_authenticated/instructor/reviews/$submissionId.tsx`
  - [ ] Create `src/components/reviews/ReviewDetailHeader.tsx` — Student name, assignment title, checkpoint name, back navigation
  - [ ] Create `src/components/reviews/ReviewFilePreview.tsx` — PDF inline embed / DOCX metadata + download button
  - [ ] Create `src/components/reviews/ReviewHistory.tsx` — Timeline of past reviews for the checkpoint
- [ ] Task: Create review decision form
  - [ ] Create `src/components/reviews/ReviewForm.tsx` — Pass/Revise radio, comment textarea, feedback file uploader, revision deadline (conditional), submit button
- [ ] Task: Wire `openForReview` POST action on review detail page load
  - [ ] On page mount, check if checkpoint state is `submitted`
  - [ ] If `submitted`, call `openForReview` server function (POST) to transition to `under_review`
  - [ ] Re-fetch detail data after transition completes
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Review Detail Page & Decision Form' (Protocol in workflow.md)

## Phase 4: Student-Side Wiring & i18n

- [ ] Task: Wire review data into student submission page
  - [ ] Update `$id.checkpoints.$checkpointId.tsx` loader to call `getLatestReview` (or extend `getSubmissionDetail`) to fetch the most recent review for the checkpoint
  - [ ] Replace `latestReview = null` stub with actual review data from the server
  - [ ] Verify `SubmissionStatus` component receives and renders the review data correctly (pass badge/revise badge, comment, reviewer name, revision deadline)
  - [ ] Verify `CheckpointCard` already reflects `passed` / `revise` states correctly via the assignment detail loader (it does — states are already handled)
- [ ] Task: Add i18n translations
  - [ ] Add `instructorReviews` section to `locales/en.json` (40+ keys: list, detail, form, SLA, history, errors)
  - [ ] Add `instructorReviews` section to `locales/id.json`
  - [ ] Update `scripts/generate-i18n-types.ts` to include `instructorReviews` section
- [ ] Task: Write tests
  - [ ] `tests/unit/reviews/state-transitions.test.ts` — Verify valid/invalid checkpoint state transitions for review flow (submitted→under_review, under_review→passed, under_review→revise, and invalid transitions)
  - [ ] `tests/unit/reviews/open-for-review.test.ts` — Verify `openForReview` POST action (submitted→under_review transition, idempotent if already under_review)
  - [ ] `tests/unit/components/reviews/review-queue-item.test.tsx` — Queue item rendering
  - [ ] `tests/unit/components/reviews/review-form.test.tsx` — Form rendering and validation
  - [ ] `tests/unit/components/reviews/sla-badge.test.tsx` — SLA badge states (not started, on time, approaching, breached)
  - [ ] `tests/unit/components/reviews/review-history.test.tsx` — History timeline
  - [ ] `tests/unit/server/reviews.test.ts` — Zod schema validation, auth guards, state transitions, ownership checks
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Student-Side Wiring & i18n' (Protocol in workflow.md)
