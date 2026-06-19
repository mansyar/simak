import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { createFileRoute } from '@tanstack/react-router';
import { getAdminDashboardData } from '@/server/dashboard';
import { useI18n } from '../../__root';
import { AdminDashboard } from '@/components/dashboard/AdminDashboard';
export const Route = createFileRoute('/_authenticated/admin/dashboard')({
  loader: async () => {
    return getAdminDashboardData();
  },
  component: AdminDashboardPage,
});
function AdminDashboardPage() {
  const { t } = useI18n();
  const data = Route.useLoaderData();
  return _jsxs('div', {
    className: 'space-y-6',
    children: [
      _jsxs('div', {
        children: [
          _jsx('h1', {
            className: 'font-display text-4xl font-bold tracking-tight text-foreground',
            children: t('adminDashboard.title'),
          }),
          _jsx('p', {
            className: 'text-sm text-muted-foreground mt-1',
            children: t('adminDashboard.subtitle'),
          }),
        ],
      }),
      _jsx(AdminDashboard, { data: data }),
    ],
  });
}
