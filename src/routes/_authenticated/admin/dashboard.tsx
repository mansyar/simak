import { createFileRoute } from '@tanstack/react-router';
import { getAdminDashboardData } from '@/server/dashboard';
import { useI18n } from '../../__root';
import { AdminDashboard } from '@/components/dashboard/AdminDashboard';
import { PageHeader } from '@/components/ui/page-header';
import { DashboardSkeleton } from '@/components/skeletons/dashboard-skeleton';
import { getErrorTranslationKey, isServerError } from '@/lib/errors';
import { ErrorState } from '@/components/ui/error-state';

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
  const navigate = Route.useNavigate();

  if (isServerError(data)) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('adminDashboard.title')} subtitle={t('adminDashboard.subtitle')} />
        <ErrorState
          title={t(getErrorTranslationKey(data.error.code))}
          retryLabel={t('common.refresh')}
          onRetry={() => navigate({} as never)}
        />
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
