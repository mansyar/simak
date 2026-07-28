import { createFileRoute } from '@tanstack/react-router';
import { getAdminDashboardData } from '@/server/dashboard';
import { useI18n } from '../../__root';
import { AdminDashboard } from '@/components/dashboard/AdminDashboard';
import { PageHeader } from '@/components/ui/page-header';
import { DashboardSkeleton } from '@/components/skeletons/dashboard-skeleton';
import { isServerError } from '@/lib/errors';

export const Route = createFileRoute('/_authenticated/admin/dashboard')({
  loader: async () => {
    return getAdminDashboardData();
  },
  component: AdminDashboardPage,
  pendingComponent: () => <DashboardSkeleton />,
});

function AdminDashboardPage() {
  const { t } = useI18n();
  const data = Route.useLoaderData();

  if (isServerError(data)) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('adminDashboard.title')} subtitle={t('adminDashboard.subtitle')} />
        <p className="text-destructive">{data.error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('adminDashboard.title')} subtitle={t('adminDashboard.subtitle')} />
      <AdminDashboard data={data} />
    </div>
  );
}
