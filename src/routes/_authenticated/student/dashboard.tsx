import { createFileRoute } from '@tanstack/react-router';
import { getStudentDashboardData } from '@/server/dashboard';
import { useI18n } from '../../__root';
import { StudentDashboard } from '@/components/dashboard/StudentDashboard';

export const Route = createFileRoute('/_authenticated/student/dashboard')({
  loader: async () => {
    return (getStudentDashboardData as any)();
  },
  component: StudentDashboardPage,
});

function StudentDashboardPage() {
  const { t } = useI18n();
  const data = Route.useLoaderData() as any;

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
