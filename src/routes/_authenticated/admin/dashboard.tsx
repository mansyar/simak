import { createFileRoute } from '@tanstack/react-router';
import { getAdminDashboardData } from '@/server/dashboard';
import { useI18n } from '../../__root';
import { AdminDashboard, type AdminDashboardData } from '@/components/dashboard/AdminDashboard';

export const Route = createFileRoute('/_authenticated/admin/dashboard')({
  loader: async () => {
    return getAdminDashboardData();
  },
  component: AdminDashboardPage,
});

function AdminDashboardPage() {
  const { t } = useI18n();
  const data = Route.useLoaderData() as unknown as AdminDashboardData;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-bold tracking-tight text-foreground">
          {t('adminDashboard.title')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t('adminDashboard.subtitle')}</p>
      </div>
      <AdminDashboard data={data} />
    </div>
  );
}
