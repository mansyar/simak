/**
 * Get the dashboard route for a given role.
 */
export function getRoleDashboard(role) {
  switch (role) {
    case 'student':
      return '/student/dashboard';
    case 'instructor':
      return '/instructor/dashboard';
    case 'superadmin':
    case 'admin':
      return '/admin/dashboard';
    default:
      return '/student/dashboard';
  }
}
