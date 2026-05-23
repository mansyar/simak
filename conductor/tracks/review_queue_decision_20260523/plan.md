# Implementation Plan: Review Queue & Decision

## Phase 1: Server Functions & Data Layer

- [ ] Task: Create Zod schemas and server function stubs (`src/server/reviews.ts`)
  - [ ] Define `ListPendingReviewsSchema` (page, limit, assignmentId optional)
  - [ ] Define `GetReviewDetailSchema` (submissionId)
  - [ ] Define `SubmitReviewSchema` (submissionId, decision, comment optional, revisionDeadline optional)
  - [ ] Define `GetReviewFeedbackUploadUrlSchema` (contentType, extension)
  - [ ] Create `listPendingReviews`, `getReviewDetail`, `submitReview`, `getReviewFeedbackUploadUrl` server function stubs with dynamic imports
- [ ] Task: Implement server-only handlers (`src/server/reviews.server.ts`)
  - [ ] `listPendingReviewsHandler` — Query submissions with `submitted` state across instructor's assignments, paginated, FIFO, with assignment filter
  - [ ] `getReviewDetailHandler` — Fetch submission + file info + past reviews for checkpoint, with presigned download URL
  - [ ] `submitReviewHandler` — Validate state (submitted/under_review only), validate ownership, record review, transition checkpoint state, unlock next on pass, set deadline on revise
  - [ ] `getReviewFeedbackUploadUrlHandler` — Generate presigned PUT URL for feedback file (reuse R2 flow)
- [ ] Task: Add feedback file upload to file server (`src/server/files.ts` + `src/server/files.server.ts`)
  - [ ] Add `GetPresignedReviewFeedbackUploadUrlSchema` in `files.ts`
  - [ ] Add handler that generates presigned PUT URL for `feedback/{uuid}.{ext}` key prefix
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
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Review Queue Page' (Protocol in workflow.md)

## Phase 3: Review Detail Page & Decision Form

- [ ] Task: Create review detail route and components
  - [ ] Create route file `src/routes/_authenticated/instructor/reviews/$submissionId.tsx`
  - [ ] Create `src/components/reviews/ReviewDetailHeader.tsx` — Student name, assignment title, checkpoint name, back navigation
  - [ ] Create `src/components/reviews/ReviewFilePreview.tsx` — PDF inline embed / DOCX metadata + download button
  - [ ] Create `src/components/reviews/ReviewHistory.tsx` — Timeline of past reviews for the checkpoint
- [ ] Task: Create review decision form
  - [ ] Create `src/components/reviews/ReviewForm.tsx` — Pass/Revise radio, comment textarea, feedback file uploader, revision deadline (conditional), submit button
- [ ] Task: Wire auto-transition to `under_review` on review detail page load
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Review Detail Page & Decision Form' (Protocol in workflow.md)

## Phase 4: Student-Side Wiring & i18n

- [ ] Task: Update student submission page to show review results
  - [ ] Verify `SubmissionStatus` component in `src/components/files/submission-status.tsx` already handles pass/revise display
  - [ ] Verify CheckpointCard reflects `passed` / `revise` states correctly
- [ ] Task: Add i18n translations
  - [ ] Add `instructorReviews` section to `locales/en.json` (40+ keys: list, detail, form, SLA, history, errors)
  - [ ] Add `instructorReviews` section to `locales/id.json`
  - [ ] Update `scripts/generate-i18n-types.ts` to include `instructorReviews` section
- [ ] Task: Write tests
  - [ ] `tests/unit/reviews/state-transitions.test.ts` — Verify valid/invalid checkpoint state transitions for review flow
  - [ ] `tests/unit/components/reviews/review-queue-item.test.tsx` — Queue item rendering
  - [ ] `tests/unit/components/reviews/review-form.test.tsx` — Form rendering and validation
  - [ ] `tests/unit/components/reviews/sla-badge.test.tsx` — SLA badge states
  - [ ] `tests/unit/components/reviews/review-history.test.tsx` — History timeline
  - [ ] `tests/unit/server/reviews.test.ts` — Zod schema validation, auth guards, state transitions, ownership checks
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Student-Side Wiring & i18n' (Protocol in workflow.md)
