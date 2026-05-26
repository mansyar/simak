# Implementation Plan: Track 7.2 — Role-Based Dashboards

## Phase 1: Server Functions [checkpoint: —]

**Objective:** Build all dashboard data server functions with Zod schemas, client-safe stubs, and server-only handlers.

- [ ] Task: Create Zod schemas and client-safe stubs for dashboard server functions (src/server/dashboard.ts)
  - [ ] Define GetStudentDashboardDataSchema (no params — uses session)
  - [ ] Define GetInstructorDashboardDataSchema (no params — uses session)
  - [ ] Define GetAdminDashboardDataSchema (no params — uses session)
  - [ ] Create createServerFn stubs: getStudentDashboardData, getInstructorDashboardData, getAdminDashboardData with dynamic imports to handlers
  - [ ] Ensure all stubs follow the existing pattern
- [ ] Task: Implement server-only dashboard handlers (src/server/dashboard.server.ts)
  - [ ] getStudentDashboardDataHandler — Query assignment_students, assignments, checkpoints, submissions, reviews, consultations for the current student
  - [ ] getInstructorDashboardDataHandler — Query assignments, checkpoints, submissions, reviews, users for the instructor
  - [ ] getAdminDashboardDataHandler — Query users, assignments, submissions, reviews, consultations, notifications for system metrics
  - [ ] All handlers must verify session via getSessionFromHeaders() and check role
  - [ ] All handlers must handle empty data gracefully
- [ ] Task: Write unit tests for dashboard server functions ( ests/unit/server/dashboard.test.ts)
  - [ ] Test schema validation
  - [ ] Test handlers with mocked sessions and database
  - [ ] Test empty data scenarios
  - [ ] Test unauthorized access
- [ ] Task: Conductor — User Manual Verification 'Phase 1: Server Functions' (Protocol in workflow.md)

## Phase 2: Student Dashboard [checkpoint: —]

**Objective:** Build the student dashboard page at /student/dashboard with 4 widgets.

- [ ] Task: Create student dashboard page (src/routes/\_authenticated/student/dashboard.tsx)
  - [ ] SSR route with loader calling getStudentDashboardData
  - [ ] Widget 1 — Active Assignments Overview card grid
  - [ ] Widget 2 — Upcoming Deadlines list with color-coded urgency
  - [ ] Widget 3 — Pending Reviews list
  - [ ] Widget 4 — Consultation Reminders list
  - [ ] Each widget has empty state
  - [ ] Responsive grid layout (1 col mobile, 2 cols desktop)
- [ ] Task: Create reusable dashboard widget components (src/components/dashboard/)
  - [ ] StudentDashboard.tsx, AssignmentProgressCard.tsx, DeadlineItem.tsx
  - [ ] PendingReviewItem.tsx, ConsultationReminderItem.tsx
- [ ] Task: Add i18n translations for student dashboard
  - [ ] Add keys to locales/en.json and locales/id.json
  - [ ] Run pnpm generate:i18n
- [ ] Task: Write unit tests for student dashboard components
- [ ] Task: Conductor — User Manual Verification 'Phase 2: Student Dashboard' (Protocol in workflow.md)

## Phase 3: Instructor Dashboard [checkpoint: —]

**Objective:** Build the instructor dashboard page at /instructor/dashboard with 4 widgets.

- [ ] Task: Create instructor dashboard page (src/routes/\_authenticated/instructor/dashboard.tsx)
  - [ ] SSR route with loader calling getInstructorDashboardData
  - [ ] Widget 1 — Pending Review Queue with SLA badges
  - [ ] Widget 2 — Recent Submissions list
  - [ ] Widget 3 — Assignment Overview cards
  - [ ] Widget 4 — Quick Actions CTA buttons
  - [ ] Each widget has empty state
  - [ ] Responsive grid layout
- [ ] Task: Create reusable dashboard widget components (src/components/dashboard/)
  - [ ] InstructorDashboard.tsx, AssignmentOverviewCard.tsx, QuickActions.tsx
- [ ] Task: Add i18n translations for instructor dashboard
  - [ ] Add keys to locales/en.json and locales/id.json
  - [ ] Run pnpm generate:i18n
- [ ] Task: Write unit tests for instructor dashboard components
- [ ] Task: Conductor — User Manual Verification 'Phase 3: Instructor Dashboard' (Protocol in workflow.md)

## Phase 4: Admin Dashboard [checkpoint: —]

**Objective:** Build the admin dashboard page at /admin/dashboard with 4 widgets.

- [ ] Task: Create admin dashboard page (src/routes/\_authenticated/admin/dashboard.tsx)
  - [ ] SSR route with loader calling getAdminDashboardData
  - [ ] Widget 1 — System Metrics grid of metric cards
  - [ ] Widget 2 — Recent Activity Feed chronological list
  - [ ] Widget 3 — Deadline Escalation Alerts with red alert styling
  - [ ] Widget 4 — Quick Actions CTA buttons
  - [ ] Each widget has empty state
  - [ ] Responsive grid layout
- [ ] Task: Create reusable dashboard widget components (src/components/dashboard/)
  - [ ] AdminDashboard.tsx, MetricCard.tsx, ActivityFeedItem.tsx, EscalationAlertItem.tsx
- [ ] Task: Add i18n translations for admin dashboard
  - [ ] Add keys to locales/en.json and locales/id.json
  - [ ] Run pnpm generate:i18n
- [ ] Task: Write unit tests for admin dashboard components
- [ ] Task: Conductor — User Manual Verification 'Phase 4: Admin Dashboard' (Protocol in workflow.md)

## Phase 5: Route Redirects & Sidebar Updates [checkpoint: —]

**Objective:** Remove old /dashboard route, update login redirect, update sidebar navigation.

- [ ] Task: Update login page redirect (src/routes/\_unauthenticated/auth/login.tsx)
  - [ ] Redirect to role-specific dashboard after login
  - [ ] superadmin/admin → /admin/dashboard, instructor → /instructor/dashboard, student → /student/dashboard
- [ ] Task: Update \_unauthenticated layout redirect (src/routes/\_unauthenticated.tsx)
  - [ ] Change redirect to role-based dashboard
- [ ] Task: Update sidebar navigation links
  - [ ] StudentSidebar: /dashboard → /student/dashboard
  - [ ] InstructorSidebar: /dashboard → /instructor/dashboard
  - [ ] AdminSidebar: /dashboard → /admin/dashboard
- [ ] Task: Remove old dashboard route
  - [ ] Delete src/routes/\_authenticated/dashboard.tsx
  - [ ] Update corresponding test file
- [ ] Task: Write tests for redirect logic
- [ ] Task: Conductor — User Manual Verification 'Phase 5: Route Redirects & Sidebar Updates' (Protocol in workflow.md)

## Phase 6: Integration Testing & Manual Verification [checkpoint: —]

**Objective:** Run full test suite, verify code coverage, prepare manual verification plan.

- [ ] Task: Run full test suite and verify coverage
  - [ ] Run CI=true pnpm test — all tests pass
  - [ ] Coverage meets thresholds (lines 80%, functions 80%, branches 72%, statements 79%)
- [ ] Task: Run typecheck and lint
  - [ ] pnpm typecheck — zero errors
  - [ ] pnpm lint — zero warnings/errors
- [ ] Task: Conductor — User Manual Verification 'Phase 6: Integration Testing & Manual Verification' (Protocol in workflow.md)
