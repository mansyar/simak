import { createFileRoute } from '@tanstack/react-router';
import { getStudentDashboardData } from '@/server/dashboard';
import { useI18n } from '../../__root';
import { StudentDashboard } from '@/components/dashboard/StudentDashboard';
import { DashboardSkeleton } from '@/components/skeletons/dashboard-skeleton';
import { getErrorTranslationKey, isServerError } from '@/lib/errors';
import { ErrorState } from '@/components/ui/error-state';

export const Route = createFileRoute('/_authenticated/student/dashboard')({
  loader: async () => {
    return getStudentDashboardData();
  },
  component: StudentDashboardPage,
  pendingComponent: () => <DashboardSkeleton />,
});

function StudentDashboardPage() {
  const { t } = useI18n();
  const data = Route.useLoaderData();
  const navigate = Route.useNavigate();

  if (isServerError(data)) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {t('studentDashboard.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('studentDashboard.subtitle')}</p>
        </div>
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {t('studentDashboard.title')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t('studentDashboard.subtitle')}</p>
      </div>
      <StudentDashboard data={data} />
    </div>
  );
}
