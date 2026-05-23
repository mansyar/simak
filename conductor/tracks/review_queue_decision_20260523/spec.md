# Track: Review Queue & Decision

## Description

Instructor reviews submissions from a dedicated review queue, views submitted files, and makes pass/revise decisions with comments and optional feedback files. This completes the core submit → review → resubmit loop.

## Dependencies

- Track 4.1 (File Upload & Submission) — submissions must exist before they can be reviewed.

## Overview

The Instructor accesses a dedicated review queue at `/instructor/reviews` showing all pending submissions across their assignments, ordered FIFO (oldest-first). Opening a submission triggers a separate `openForReview` POST action that transitions the checkpoint to `under_review` (not a side effect of the GET load). The instructor sees the submitted file (PDF inline preview / DOCX download), can view past review history, and submits a pass or revise decision with comments and optional feedback file. On pass, the checkpoint transitions to `passed` and the next checkpoint unlocks. On revise, the checkpoint transitions to `revise` with a revision deadline. The student sees the result on their checkpoint detail page immediately via a dedicated `getLatestReview` fetch.

## Functional Requirements

### FR1: Review Queue Page (`/instructor/reviews`)

- Paginated list of all pending (submitted state) submissions across all assignments belonging to the instructor.
- Uses `DISTINCT ON (checkpoints.id)` or subquery to get the **latest submission** (max version) per checkpoint — a checkpoint may have multiple submission versions after resubmissions.
- Sorted oldest-first (FIFO) by the latest submission's `uploaded_at`.
- Each queue item shows: student name, checkpoint name, assignment title, **wait time** (time elapsed since `uploaded_at`).
- Assignment filter dropdown to narrow by assignment.
- **SLA badge** per item:
  - For items that have entered `under_review`: status based on elapsed time since `checkpoints.updatedAt` vs 3-day SLA.
  - For items still in `submitted` (not yet opened): badge shows neutral "Not reviewed" — SLA timer hasn't started yet per TDD 3-day rule.
- Pagination: 20 items per page, page state in search params.
- Loading state: skeleton rows.

### FR2: Review Detail Page (`/instructor/reviews/$submissionId`)

- On page load, if the checkpoint state is `submitted`, the page calls a **separate `openForReview` POST action** that transitions the checkpoint to `under_review` and returns success. This keeps the GET data load pure (no mutation side-effects in read handlers).
- Displays:
  - Student name, assignment title, checkpoint name.
  - Submitted file metadata: name, size, version, upload date.
  - PDF inline preview (`<embed>` or `<iframe>`) for PDF files; DOCX metadata + download button.
  - Download link for the submitted file.
  - Past review history timeline (if any prior reviews exist for the same checkpoint).
- Back navigation to the review queue.
- Loading state.

### FR3: Review Decision Form

- **Pass/Revise radio buttons** (required, default: unselected).
- **Comment textarea** (optional).
- **Feedback file uploader** (optional, `.docx`/`.pdf`, max 25MB) — uses the same R2 presigned URL flow from Track 4.1.
- **Revision deadline** date picker (only shown when `revise` is selected, required in that case).

### FR4: Submit Review Server Function

- Validates the instructor owns the submission's assignment (`assignments.instructorId` matches session user).
- Validates checkpoint is in `submitted` or `under_review` state (cannot review already reviewed/passed/revise).
- If `pass`:
  - Sets checkpoint state to `passed`.
  - Sets `updatedAt` to now.
  - Unlocks the next sequential checkpoint for this student (sets to `unlocked`).
- If `revise`:
  - Sets checkpoint state to `revise`.
  - Sets `revisionDeadline` on the review record.
  - Sets `reviewedAt` to now.
- Attaches the feedback file key (if uploaded).
- Records `instructorId`, `decision`, `comment` in the `reviews` table.
- Returns the created review.

### FR5: Server Functions

- `listPendingReviews` — Paginated, assignment-filterable, sorted oldest-first. Uses `DISTINCT ON (checkpoints.id)` to get the latest submission per checkpoint. Returns queue items with student name, checkpoint name, assignment title, wait time.
- `getReviewDetail` — Pure GET. Submission detail with file info, presigned download URL, and past review history. Does NOT mutate state.
- `openForReview` — POST action. Transitions checkpoint from `submitted` to `under_review` (sets `state` and `updatedAt`). Called by the client after loading review detail when checkpoint is still `submitted`.
- `submitReview` — Validates state (`submitted`/`under_review` only), validates ownership, records review, transitions checkpoint, unlocks next if pass.
- `getLatestReview` — Fetches the most recent review for a given checkpoint/submission. Used by the student submission page to display review results.
- `getReviewFeedbackUploadUrl` — Generates a presigned PUT URL for the feedback file. Lives in `src/server/files.ts` (consistent with existing file operations). Reuses R2 flow; `generateFileKey` is extended to accept an optional prefix parameter for `feedback/` key prefix.

### FR6: Review Queue Sub-Route Guard

- The `/instructor/reviews` route inherits the `_authenticated/instructor` layout guard (`requireRole(['instructor'])`).
- Additionally, every server function verifies the instructor's ownership of the submission's assignment.

### FR7: Review History

- The review detail page shows a timeline of all prior reviews for the same checkpoint.
- Each history entry includes: decision (pass/revise), comment, reviewer name, review date.
- Useful when a checkpoint has been revised multiple times — instructor sees the full context.

### FR8: Student Review Display

- The student submission page (`/student/assignments/$id/checkpoints/$checkpointId`) currently stubs `latestReview = null` — this track wires in real data.
- On page load, call `getLatestReview` (or extend `getSubmissionDetail`) to fetch the most recent review for the checkpoint's latest submission.
- The existing `SubmissionStatus` component already renders the review result — it just needs the data wired in.
- `CheckpointCard` already reflects all 6 checkpoint states — no changes needed.

## Data Model

No new tables. Uses existing `reviews` table with the following columns:

| Column           | Type                       | Notes                                               |
| ---------------- | -------------------------- | --------------------------------------------------- |
| id               | serial (PK)                |                                                     |
| submissionId     | integer (FK → submissions) |                                                     |
| instructorId     | text (FK → users)          |                                                     |
| decision         | text, not null             | `pass` \| `revise`                                  |
| comment          | text                       |                                                     |
| feedbackFileKey  | text                       | R2 key for optional feedback file                   |
| revisionDeadline | timestamp                  | Required if `revise`                                |
| createdAt        | timestamp                  |                                                     |
| reviewedAt       | timestamp                  | When instructor submitted the review (for SLA calc) |

The existing `reviews` table already has a `submissionId` index (`reviews_submission_id_idx`).

### New Database Indexes

The review queue query needs efficient access patterns. Add the following indexes in a new migration:

| Table         | Column(s)               | Type             | Purpose                                           |
| ------------- | ----------------------- | ---------------- | ------------------------------------------------- |
| `assignments` | `instructorId`          | b-tree           | Filter assignments by instructor for review queue |
| `checkpoints` | `state`, `assignmentId` | composite b-tree | Filter checkpoints by state and assignment        |

## State Transitions

```
CHECKPOINT:
  submitted → under_review (via openForReview POST action on page load)
  under_review → passed (via submitReview; next checkpoint unlocks)
  under_review → revise (via submitReview; revision deadline set)
```

## Acceptance Criteria

- [ ] Instructor sees a queue of submissions pending review across all their assignments
- [ ] Queue is sorted oldest-first (FIFO) with 20 items per page
- [ ] Queue can be filtered by assignment via a dropdown
- [ ] SLA badge shows on-time/approaching/breached status per item
- [ ] Opening a submission auto-transitions its checkpoint to `under_review`
- [ ] Instructor can view the submitted file (PDF inline, DOCX metadata + download)
- [ ] Pass decision: checkpoint state = `passed`, next checkpoint = `unlocked`
- [ ] Revise decision: checkpoint state = `revise`, revision deadline must be set
- [ ] Instructor can upload a feedback file with the review
- [ ] Review history shows all prior reviews for the checkpoint
- [ ] Student immediately sees the review result on their checkpoint page
- [ ] Instructor cannot review a submission twice (already-reviewed submissions filtered from queue)

## Future Considerations (Out of Scope for This Track)

- SLA breach notifications (Track 5.2)
- Automatic deadline adjustments for late reviews (Track 5.2)
- Manual checkpoint unlock by instructor (Track 5.2)
- 3-revision escalation notification (PRD: >3 revise decisions on same checkpoint triggers advisory notification to instructor + admin; deferred to Track 7.1 or 5.2)
