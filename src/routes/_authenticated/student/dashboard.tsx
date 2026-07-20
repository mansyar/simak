import { createFileRoute } from '@tanstack/react-router';
import { getStudentDashboardData } from '@/server/dashboard';
import { useI18n } from '../../__root';
import {
  StudentDashboard,
  type StudentDashboardData,
} from '@/components/dashboard/StudentDashboard';
import { DashboardSkeleton } from '@/components/skeletons/dashboard-skeleton';

export const Route = createFileRoute('/_authenticated/student/dashboard')({
  loader: async () => {
    return getStudentDashboardData();
  },
  component: StudentDashboardPage,
  pendingComponent: () => <DashboardSkeleton />,
});

function StudentDashboardPage() {
  const { t } = useI18n();
  const data = Route.useLoaderData() as unknown as StudentDashboardData;

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
