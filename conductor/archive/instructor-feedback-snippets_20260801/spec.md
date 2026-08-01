<protect>
# Specification: TRACK-049 — Instructor Feedback Snippets

## Track Type

Feature

## Overview

Instructors frequently reuse similar review comments but currently must retype them for every submission. This feature provides a private, searchable library of reusable plain-text feedback snippets and allows instructors to append a selected snippet to an editable review comment without affecting the review decision or submission workflow.

**Dependencies:** None

**Roles:** Instructor only

## Functional Requirements

### FR-1: Feedback snippet data model

Create an instructor-owned `feedback_snippets` table with:

- `id`
- `instructor_id` foreign key to `users`
- `title` — required, maximum 100 characters
- `category` — optional, maximum 50 characters
- `body` — required plain text, maximum 2,000 characters
- `archived_at` — nullable timestamp
- `created_at`
- `updated_at`

Snippets must be private to their owner. No shared, department-wide, or admin-managed snippets are included.

### FR-2: Validation and plain-text behavior

- Validate title, category, and body with Zod on the client/server boundary.
- Trim input where appropriate and reject empty required values.
- Store and render the body as plain text.
- Do not support HTML, rich text, or dynamic placeholders.
- Enforce equivalent database column bounds.

### FR-3: Instructor server functions

Implement client-safe stubs and server-only handlers using the established two-file server-function pattern:

- List/search the current instructor’s snippets.
- Create a snippet.
- Update an owned snippet.
- Archive an owned snippet.
- Restore an owned snippet.

All handlers must verify the authenticated instructor session and ownership. Cross-instructor access must be rejected. There is no hard-delete operation.

### FR-4: Snippet management route

Add the instructor-only route:

`/instructor/feedback-snippets`

The page must support:

- Listing active snippets by default.
- Switching to an Archived filter.
- Searching title and category.
- Creating snippets.
- Editing owned snippets.
- Archiving active snippets.
- Restoring archived snippets.
- Clear loading, empty, validation, success, and error states.

Archived snippets remain retained for management and are excluded from the default active list.

### FR-5: Review-form insertion

Add a searchable active-snippet combobox to the instructor review form.

- Only the current instructor’s active snippets are available.
- Search matches title and category.
- Insertion requires an explicit action.
- Insertion appends the snippet body to the end of the comment.
- If the comment already contains non-whitespace text, insert one blank line before the snippet.
- The comment remains editable, and focus returns to the comment field.
- Multiple snippets may be inserted during one review.
- Insertion must not select Pass or Revise, alter rubric scores, change checkpoint state, or submit the review.
- Later snippet edits, archival, or restoration must not modify existing review comments.

### FR-6: Internationalization and accessibility

- Add all user-visible strings to both English and Indonesian locale files.
- Regenerate i18n types.
- Use accessible labels, keyboard-operable controls, visible focus states, and appropriate announcements for mutation results.
- Support light/dark themes and responsive layouts.

## Non-Functional Requirements

- Follow the server-function split and 500-line file limit.
- Use Drizzle migration conventions and ownership-scoped queries.
- Preserve existing review and rubric behavior.
- Do not expose snippet data to students or admins.
- Maintain at least 80% coverage for new code.
- Do not introduce HTML injection or unescaped rich-text rendering.

## Acceptance Criteria

1. An instructor can create a valid snippet with a title, optional category, and body.
2. Invalid, empty, or over-limit values are rejected consistently by client and server validation.
3. An instructor can list, search, edit, archive, and restore only their own snippets.
4. Archived snippets are hidden from the default list and review picker.
5. A second instructor cannot read or mutate another instructor’s snippets.
6. The review picker searches active snippets by title/category and appends the selected body with the defined separator.
7. The review comment remains editable after insertion.
8. Insertion cannot change the decision, rubric scores, checkpoint state, or submission status.
9. Existing review comments remain unchanged after snippet updates or archival.
10. The management route and picker are bilingual, accessible, responsive, and provide loading/empty/error feedback.
11. Unit and E2E tests cover validation boundaries, ownership, lifecycle behavior, archival filtering, and review-form insertion.
12. Typecheck, lint, i18n checks, tests, and coverage gates pass.

## Out of Scope

- Shared or department-wide libraries.
- Admin approval or moderation workflows.
- AI-generated feedback or quality analytics.
- Dynamic placeholders or variable substitution.
- HTML/rich-text snippets.
- Automatic Pass/Revise recommendations.
- Automatic review submission.
- Hard deletion of snippets.
- Student-facing snippet access.
</protect>
