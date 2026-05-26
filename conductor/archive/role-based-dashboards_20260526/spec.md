# Track 7.2 — Role-Based Dashboards

## Overview

Replace the current dashboard stub (`/dashboard`) with dedicated, role-specific dashboard pages. Each role (Student, Instructor, Admin) gets its own dashboard page rendered within its respective role layout (`_student`, `_instructor`, `_admin`). After login, users are redirected to their role's dashboard based on their role.

This track builds on the existing notification system (Track 7.1) and review queue (Track 5.1) to surface the most relevant information and actions on first load for each role.

## Dependencies

- Track 1.3 (Authentication & Authorization) — route guards, session management
- Track 2.1 (User Management) — user data for admin metrics
- Track 2.2 (Assignment Templates) — template type labels
- Track 3.1 (Assignment Creation) — assignment data and student mappings
- Track 3.2 (Student Assignment Viewing) — assignment detail pages for navigation
- Track 4.1 (File Upload & Submission) — submission data for pending reviews
- Track 5.1 (Review Queue & Decision) — review status, SLA badges
- Track 5.2 (Escalation & Deadline Management) — SLA breach detection
- Track 6.1 (Consultation Logging & Verification) — consultation status for student reminders
- Track 7.1 (In-App Notification System) — notification events for admin activity feed

## Functional Requirements

### FR-1: Dashboard Pages

Each role gets a dedicated dashboard page rendered within its role layout:

- **Student Dashboard** (`/student/dashboard`) — Active assignments overview, upcoming deadlines, pending reviews, consultation reminders
- **Instructor Dashboard** (`/instructor/dashboard`) — Pending review queue overview, recent submissions, assignment progress summary
- **Admin Dashboard** (`/admin/dashboard`) — System metrics, recent activity, deadline escalation alerts, quick actions

### FR-2: Student Dashboard Widgets

**Widget 1 — Active Assignments Overview:**

- Display each active assignment as a card
- Each card shows: assignment title, template type, current checkpoint status badge, progress bar (% of checkpoints passed)
- Clicking a card navigates to the assignment detail page (`/student/assignments/$id`)
- Sorted by soonest deadline, then by least progress

**Widget 2 — Upcoming Deadlines:**

- Show the next 5 upcoming due dates across all active assignments
- Each item: assignment title, checkpoint name, due date, relative time
- Color-coded: green (>3 days), yellow (1-3 days), red (today or past)
- Past-due items show "Overdue" badge

**Widget 3 — Pending Reviews:**

- List submissions currently under instructor review
- Each item: assignment title, checkpoint name, submission date, "Under Review" badge
- Show wait time (e.g., "2 days ago")
- Only show submissions from the last 30 days

**Widget 4 — Consultation Reminders:**

- Show checkpoints where the student has logged consultations but they're still pending verification
- Each item: assignment title, checkpoint name, consultation date, "Pending" badge
- Link to consultation log page

### FR-3: Instructor Dashboard Widgets

**Widget 1 — Pending Review Queue:**

- Show count of submissions awaiting review (large number at top)
- List of submissions sorted by wait time (FIFO) — oldest first
- Each item: student name, assignment title, checkpoint name, submission date, wait time
- SLA badges: "On Time" (green), "Approaching SLA" (yellow, <1 day remaining), "SLA Breached" (red)
- Clicking an item navigates to the review detail page (`/instructor/reviews/$submissionId`)

**Widget 2 — Recent Submissions:**

- Show last 5 submissions across all assignments
- Each item: student name, assignment title, checkpoint name, submission date, status badge
- Status badges: "Submitted", "Under Review", "Pass", "Revise"

**Widget 3 — Assignment Overview:**

- List all active assignments created by the instructor
- Each card shows: assignment title, student count, overall completion % (average across students), pending review count
- Clicking navigates to assignment detail page

**Widget 4 — Quick Actions:**

- Two action cards: "Go to Review Queue" (navigates to `/instructor/reviews`) and "Manage Assignments" (navigates to `/instructor/assignments`)
- Styled as prominent CTA buttons with icons

### FR-4: Admin Dashboard Widgets

**Widget 1 — System Metrics:**

- Grid of metric cards: Total Users (with breakdown: X Instructors, Y Students), Active Assignments, Pending Reviews, Active Consultations
- Each card shows the number prominently with a label underneath
- Data sourced from simple aggregate queries

**Widget 2 — Recent Activity Feed:**

- Last 10 system events in chronological order (newest first)
- Each event: type icon, description (e.g., "Student X submitted checkpoint 2 for Assignment Y"), timestamp
- Event types: submission_received, review_completed, revision_requested, consultation_logged, consultation_verified, sla_breach
- Only show events from the last 7 days

**Widget 3 — Deadline Escalation Alerts:**

- List of active SLA breaches (instructors who haven't reviewed within 3 days)
- Each item: instructor name, assignment title, checkpoint name, days overdue, student name
- Red alert styling for items overdue >3 days
- Clicking navigates to the instructor's review queue filtered by that assignment

**Widget 4 — Quick Actions:**

- Two action cards: "Manage Users" (navigates to `/admin/users`) and "Manage Templates" (navigates to `/admin/templates`)
- Styled as prominent CTA buttons with icons

### FR-5: Route Redirects

- Remove the existing `/dashboard` route entirely
- After login (`/auth/login`), redirect users to their role-specific dashboard based on their role:
  - `superadmin` → `/admin/dashboard`
  - `admin` → `/admin/dashboard`
  - `instructor` → `/instructor/dashboard`
  - `student` → `/student/dashboard`
- The `_authenticated` layout should redirect unauthenticated users to `/auth/login` (unchanged)

### FR-6: Dashboard Data Server Functions

Create server functions for each dashboard's data needs:

- `getStudentDashboardData` — Returns assignments overview, upcoming deadlines, pending reviews, consultation reminders
- `getInstructorDashboardData` — Returns pending reviews, recent submissions, assignment overview
- `getAdminDashboardData` — Returns system metrics, recent activity, deadline escalation alerts
- `getRecentActivity` — Generic function to fetch recent system events (used by Admin dashboard)

All server functions must:

- Verify ownership/role via session headers
- Use Zod schemas for validation and response typing
- Follow the existing server function pattern (client stub + server handler)

## Non-Functional Requirements

- **SSR Rendering:** All dashboard pages are SSR-rendered with server functions fetching data on page load
- **Performance:** Each dashboard page should load within 500ms on first render (data-fetching dependent)
- **Responsive:** All dashboard widgets must be responsive (mobile-friendly)
- **i18n:** Full English and Indonesian translations for all dashboard strings
- **Empty States:** Each widget shows an appropriate empty state when no data is available (e.g., "No pending reviews" with a call-to-action)

## Acceptance Criteria

1. [ ] Student dashboard page exists at `/student/dashboard` with all 4 widgets rendering correctly
2. [ ] Instructor dashboard page exists at `/instructor/dashboard` with all 4 widgets rendering correctly
3. [ ] Admin dashboard page exists at `/admin/dashboard` with all 4 widgets rendering correctly
4. [ ] After login, users are redirected to their role-specific dashboard
5. [ ] The old `/dashboard` route is removed
6. [ ] All server functions have Zod schemas and follow the existing pattern
7. [ ] All dashboard strings have i18n translations in EN and ID
8. [ ] Each widget shows an appropriate empty state when no data is available
9. [ ] All dashboard pages are responsive (tested on mobile viewport)
10. [ ] Unit tests cover all server functions (success and failure cases)
11. [ ] Code coverage meets >80% threshold

## Out of Scope

- Dashboard analytics charts or graphs (deferred to v2)
- Real-time WebSocket updates for dashboard data (polling via TanStack Query is sufficient for v1)
- Dashboard customization or widget reordering (users cannot personalize their dashboard layout)
- Email notifications from dashboard data (email delivery is v2)
- Dashboard performance metrics or benchmarking tools
