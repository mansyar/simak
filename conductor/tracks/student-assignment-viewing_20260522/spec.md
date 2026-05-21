# Specification: Track 3.2 — Student Assignment Viewing

**Track ID:** `student-assignment-viewing_20260522`
**Type:** Feature
**Dependencies:** Track 1.3 (auth), Track 3.1 (assignments must be creatable)

## Overview

Enable students to view their assigned assignments and check progress through a checkpoint timeline. After an Instructor creates assignments (Track 3.1), students need to see what's assigned to them, track their checkpoint statuses, and understand what's blocking locked checkpoints.

## Functional Requirements

### FR1 — Student Sidebar Layout

- A pathless `_student` layout route (`/student`) with `requireRole(['student'])` guard
- Student sidebar matching the instructor pattern: SIMAK branding, navigation links (Dashboard, Assignments)
- Language switcher (EN/ID) in the top-right corner
- Unauthenticated users redirected to login; non-students redirected to their dashboard

### FR2 — Student Assignment List (`/student/assignments`)

- Paginated list of assignments assigned to the logged-in student (20 per page)
- Each assignment card shows: title, template type badge, final deadline, progress percentage
- Search by assignment title via a filter/search input component
- Loading state with animated skeleton cards
- Empty state with "No assignments yet" message
- Page state persisted in URL search params (`?page=2`)
- Assignment cards link to `/student/assignments/$id`

### FR3 — Student Assignment Detail (`/student/assignments/$id`)

- SSR-rendered assignment details (title, description, template info, final deadline, instructor name)
- Vertical checkpoint timeline showing all checkpoints in order
- Student cannot see other students' checkpoints or submissions (authorization check)

### FR4 — Checkpoint Timeline & Status Display

- Each checkpoint card shows: name, state badge (colored), due date, consultation progress
- State badges with semantic colors:
  - **Passed** — Green
  - **Submitted** — Blue
  - **Under Review** — Amber
  - **Revise** — Orange
  - **Unlocked** — Teal
  - **Locked** — Gray
- Locked checkpoints show the blocking reasons:
  - "Previous checkpoint not passed" (if applicable)
  - "Insufficient consultations: X/Y verified" (if `minConsultations > 0` and not met)
- Unlocked checkpoints show a "Submit" action button (placeholder for Track 4.1)
- Overdue checkpoints visually indicated (red text, overdue badge)

### FR5 — Server Functions

- `listStudentAssignments` — Paginated, searchable list of assignments for the current student (via `assignmentStudents` join)
- `getStudentAssignmentDetail` — Single assignment detail with checkpoints and progress, verified against student ownership. **Must include per-checkpoint verified consultation count** (query `consultations` table where `status = 'verified'` and group by `checkpoint_id`) to support the "Insufficient consultations: X/Y verified" gating display.
- Both follow the `.ts` / `.server.ts` split pattern (Zod stubs in `assignments.ts`, handlers in `assignments.server.ts`)

### FR6 — i18n Translation Keys

- Translation keys for the `studentSidebar` section must be added in Phase 1 alongside the sidebar component
- Translation keys for `studentAssignments` list and detail sections must be added in Phases 2–3 alongside their respective components
- i18n TypeScript type definitions in `scripts/generate-i18n-types.ts` must be updated to include the new `studentAssignments` section

## Non-Functional Requirements

- **SSR for initial data** on assignment detail page, client hydration for interactivity
- **TanStack Query** for client-side data fetching (stale time: 30s for checkpoint list)
- **Skeleton loading states** for both list and detail pages
- **All user-facing strings** use i18n translation keys (EN/ID)
- **Responsive** — functional at 320px–1920px viewport widths
- **Dark mode** — all new components use Tailwind `dark:` variants

## Acceptance Criteria

1. Student sees only their assigned assignments in the list (not all assignments in the system)
2. Assignment list is paginated (20/page) with search by title
3. Assignment detail page shows all checkpoints in order with status badges
4. Locked checkpoints display both blocking reasons (previous checkpoint + consultation requirements)
5. Due dates are displayed; overdue checkpoints show in red
6. Navigating to another student's assignment ID returns null/forbidden
7. All text uses translation keys — no hardcoded strings
8. Loading states show skeleton components
9. Empty list shows helpful empty state

## Out of Scope

- File submission (covered in Track 4.1)
- Consultation logging (covered in Track 6.1)
- Review display (covered in Track 5.1)
- Real-time progress updates via polling
