import { createFileRoute, redirect, Outlet } from '@tanstack/react-router';
import { getSessionFromHeaders } from '../server/auth';

export const Route = createFileRoute('/_unauthenticated')({
  beforeLoad: async () => {
    const session = await getSessionFromHeaders();
    if (session) {
      throw redirect({ to: '/dashboard' as unknown as '.' });
    }
  },
  component: () => <Outlet />,
});
