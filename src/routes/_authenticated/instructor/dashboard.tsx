import { createFileRoute } from '@tanstack/react-router';
import { getInstructorDashboardData } from '@/server/dashboard';
import { useI18n } from '../../__root';
import { InstructorDashboard } from '@/components/dashboard/InstructorDashboard';
import { PageHeader } from '@/components/ui/page-header';
import { getErrorTranslationKey, isServerError } from '@/lib/errors';
import { DashboardSkeleton } from '@/components/skeletons/dashboard-skeleton';
import { ErrorState } from '@/components/ui/error-state';

export const Route = createFileRoute('/_authenticated/instructor/dashboard')({
  loader: async () => {
    return getInstructorDashboardData();
  },
  component: InstructorDashboardPage,
  pendingComponent: () => <DashboardSkeleton />,
});

function InstructorDashboardPage() {
  const { t } = useI18n();
  const data = Route.useLoaderData();
  const navigate = Route.useNavigate();

  if (isServerError(data)) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t('instructorDashboard.title')}
          subtitle={t('instructorDashboard.subtitle')}
        />
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
      <PageHeader
        title={t('instructorDashboard.title')}
        subtitle={t('instructorDashboard.subtitle')}
      />
      <InstructorDashboard data={data} />
    </div>
  );
}
