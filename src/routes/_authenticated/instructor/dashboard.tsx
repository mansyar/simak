import { createFileRoute } from '@tanstack/react-router';
import { getInstructorDashboardData } from '@/server/dashboard';
import { useI18n } from '../../__root';
import { InstructorDashboard } from '@/components/dashboard/InstructorDashboard';

export const Route = createFileRoute('/_authenticated/instructor/dashboard')({
  loader: async () => {
    return (getInstructorDashboardData as any)();
  },
  component: InstructorDashboardPage,
});

function InstructorDashboardPage() {
  const { t } = useI18n();
  const data = Route.useLoaderData() as any;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {t('instructorDashboard.title')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t('instructorDashboard.subtitle')}</p>
      </div>
      <InstructorDashboard data={data} />
    </div>
  );
}
