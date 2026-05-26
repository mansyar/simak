import { createFileRoute, redirect, Outlet } from '@tanstack/react-router';
import { getSessionFromHeaders } from '../server/auth';
import { getRoleDashboard } from '../lib/route-utils';

export const Route = createFileRoute('/_unauthenticated')({
  beforeLoad: async () => {
    const session = await getSessionFromHeaders();
    if (session) {
      throw redirect({ to: getRoleDashboard(session.user.role) as unknown as '.' });
    }
  },
  component: () => <Outlet />,
});
