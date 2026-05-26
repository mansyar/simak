# Implementation Plan: Track 7.2 — Role-Based Dashboards

## Phase 1: Server Functions [checkpoint: a667217]

**Objective:** Build all dashboard data server functions with Zod schemas, client-safe stubs, and server-only handlers.

- [x] Task: Create Zod schemas and client-safe stubs for dashboard server functions (src/server/dashboard.ts) [1e0402c]
  - [ ] Define GetStudentDashboardDataSchema (no params — uses session)
  - [ ] Define GetInstructorDashboardDataSchema (no params — uses session)
  - [ ] Define GetAdminDashboardDataSchema (no params — uses session)
  - [ ] Create createServerFn stubs: getStudentDashboardData, getInstructorDashboardData, getAdminDashboardData with dynamic imports to handlers
  - [ ] Ensure all stubs follow the existing pattern
- [x] Task: Implement server-only dashboard handlers (src/server/dashboard.server.ts) [0cb102d]
  - [ ] getStudentDashboardDataHandler — Query assignment_students, assignments, checkpoints, submissions, reviews, consultations for the current student
  - [ ] getInstructorDashboardDataHandler — Query assignments, checkpoints, submissions, reviews, users for the instructor
  - [ ] getAdminDashboardDataHandler — Query users, assignments, submissions, reviews, consultations, notifications for system metrics
  - [ ] All handlers must verify session via getSessionFromHeaders() and check role
  - [ ] All handlers must handle empty data gracefully
- [x] Task: Write unit tests for dashboard server functions (tests/unit/server/dashboard.test.ts) [0cb102d]
  - [x] Test schema validation
  - [x] Test handlers with mocked sessions and database
  - [x] Test empty data scenarios
  - [x] Test unauthorized access
- [ ] Task: Conductor — User Manual Verification 'Phase 1: Server Functions' (Protocol in workflow.md)

## Phase 2: Student Dashboard [checkpoint: c0e134e]

**Objective:** Build the student dashboard page at /student/dashboard with 4 widgets.

- [x] Task: Create student dashboard page (src/routes/\_authenticated/student/dashboard.tsx) [a4898df]
  - [x] SSR route with loader calling getStudentDashboardData
  - [x] Widget 1 — Active Assignments Overview card grid
  - [x] Widget 2 — Upcoming Deadlines list with color-coded urgency
  - [x] Widget 3 — Pending Reviews list
  - [x] Widget 4 — Consultation Reminders list
  - [x] Each widget has empty state
  - [x] Responsive grid layout (1 col mobile, 2 cols desktop)
- [x] Task: Create reusable dashboard widget components (src/components/dashboard/) [a4898df]
  - [x] StudentDashboard.tsx (all widgets inlined for simplicity)
  - [x] WidgetCard, EmptyState shared sub-components
- [x] Task: Add i18n translations for student dashboard [3ee5c44]
  - [x] Add keys to locales/en.json and locales/id.json
  - [x] Run pnpm generate:i18n
- [x] Task: Write unit tests for student dashboard components [97ba452]
- [ ] Task: Conductor — User Manual Verification 'Phase 2: Student Dashboard' (Protocol in workflow.md)

## Phase 3: Instructor Dashboard [checkpoint: 31ecbb9]

**Objective:** Build the instructor dashboard page at /instructor/dashboard with 4 widgets.

- [x] Task: Create instructor dashboard page (src/routes/\_authenticated/instructor/dashboard.tsx) [a1758d8]
  - [x] SSR route with loader calling getInstructorDashboardData
  - [x] Widget 1 — Pending Review Queue with SLA badges
  - [x] Widget 2 — Recent Submissions list
  - [x] Widget 3 — Assignment Overview cards
  - [x] Widget 4 — Quick Actions CTA buttons
  - [x] Each widget has empty state
  - [x] Responsive grid layout
- [x] Task: Create reusable dashboard widget components (src/components/dashboard/) [a1758d8]
  - [x] InstructorDashboard.tsx with all widgets inlined
- [x] Task: Add i18n translations for instructor dashboard [a1758d8]
  - [x] Add keys to locales/en.json and locales/id.json
  - [x] Run pnpm generate:i18n
- [x] Task: Write unit tests for instructor dashboard components [a1758d8]
- [ ] Task: Conductor — User Manual Verification 'Phase 3: Instructor Dashboard' (Protocol in workflow.md)

## Phase 4: Admin Dashboard [checkpoint: 31ecbb9]

**Objective:** Build the admin dashboard page at /admin/dashboard with 4 widgets.

- [x] Task: Create admin dashboard page (src/routes/\_authenticated/admin/dashboard.tsx) [91eea42]
  - [x] SSR route with loader calling getAdminDashboardData
  - [x] Widget 1 — System Metrics grid of metric cards
  - [x] Widget 2 — Recent Activity Feed chronological list
  - [x] Widget 3 — Deadline Escalation Alerts with red alert styling
  - [x] Widget 4 — Quick Actions CTA buttons
  - [x] Each widget has empty state
  - [x] Responsive grid layout
- [x] Task: Create reusable dashboard widget components (src/components/dashboard/) [91eea42]
  - [x] AdminDashboard.tsx with all widgets inlined
- [x] Task: Add i18n translations for admin dashboard [91eea42]
  - [x] Add keys to locales/en.json and locales/id.json
  - [x] Run pnpm generate:i18n
- [x] Task: Write unit tests for admin dashboard components [91eea42]
- [x] Task: Conductor — User Manual Verification 'Phase 4: Admin Dashboard' (Protocol in workflow.md)

## Phase 5: Route Redirects & Sidebar Updates [checkpoint: 31ecbb9]

**Objective:** Remove old /dashboard route, update login redirect, update sidebar navigation.

- [x] Task: Update login page redirect [46c7bc0]
  - [x] Login page redirects via \_unauthenticated.tsx which now uses getRoleDashboard()
  - [x] superadmin/admin → /admin/dashboard, instructor → /instructor/dashboard, student → /student/dashboard
- [x] Task: Update \_unauthenticated layout redirect [46c7bc0]
  - [x] Changed redirect from /dashboard to role-based dashboard via getRoleDashboard()
- [x] Task: Update sidebar navigation links [46c7bc0]
  - [x] StudentSidebar: /dashboard → /student/dashboard
  - [x] InstructorSidebar: /dashboard → /instructor/dashboard
  - [x] AdminSidebar: /dashboard → /admin/dashboard
- [x] Task: Remove old dashboard route [46c7bc0]
  - [x] Deleted src/routes/\_authenticated/dashboard.tsx
  - [x] Updated dashboard test file
- [x] Task: Write tests for redirect logic [46c7bc0]
  - [x] Created getRoleDashboard utility with tests
  - [x] Updated sidebar tests with new dashboard paths
- [x] Task: Conductor — User Manual Verification 'Phase 5: Route Redirects & Sidebar Updates' (Protocol in workflow.md)

## Phase 6: Integration Testing & Manual Verification [checkpoint: 20b1236]

**Objective:** Run full test suite, verify code coverage, prepare manual verification plan.

- [x] Task: Run full test suite and verify coverage [20b1236]
  - [x] Run CI=true pnpm test — 794 tests pass
  - [x] Coverage meets thresholds (lines 82.83%, functions 84.54%, branches 75.45%, statements 81%)
- [x] Task: Run typecheck and lint [20b1236]
  - [x] pnpm typecheck — zero errors
  - [x] pnpm lint — zero errors
- [ ] Task: Conductor — User Manual Verification 'Phase 6: Integration Testing & Manual Verification' (Protocol in workflow.md)
