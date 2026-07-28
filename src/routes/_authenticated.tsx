import { createFileRoute, redirect, Outlet } from '@tanstack/react-router';
import { getSessionFromHeaders } from '../server/auth';

function AuthenticatedLayout() {
  return <Outlet />;
}

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async () => {
    const session = await getSessionFromHeaders();
    if (!session) {
      throw redirect({ to: '/auth/login' as unknown as '.' });
    }
  },
  component: AuthenticatedLayout,
});
