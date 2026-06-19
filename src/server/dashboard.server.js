// Server-only handlers for dashboard data
// Re-exports from per-role handler files to stay under 500-line limit
export { getStudentDashboardDataHandler } from './dashboard-student.server';
export { getInstructorDashboardDataHandler } from './dashboard-instructor.server';
export { getAdminDashboardDataHandler } from './dashboard-admin.server';
