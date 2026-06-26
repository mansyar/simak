import { createFileRoute } from '@tanstack/react-router';
import { getInstructorDashboardData } from '@/server/dashboard';
import { useI18n } from '../../__root';
import { InstructorDashboard } from '@/components/dashboard/InstructorDashboard';
import { PageHeader } from '@/components/ui/page-header';
import { isServerError } from '@/lib/errors';

export const Route = createFileRoute('/_authenticated/instructor/dashboard')({
  loader: async () => {
    return getInstructorDashboardData();
  },
  component: InstructorDashboardPage,
});

function InstructorDashboardPage() {
  const { t } = useI18n();
  const data = Route.useLoaderData();

  if (isServerError(data)) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t('instructorDashboard.title')}
          subtitle={t('instructorDashboard.subtitle')}
        />
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          {data.error.message}
        </div>
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
