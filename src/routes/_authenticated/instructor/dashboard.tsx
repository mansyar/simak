import { createFileRoute } from '@tanstack/react-router';
import { getInstructorDashboardData } from '@/server/dashboard';
import { useI18n } from '../../__root';
import {
  InstructorDashboard,
  type InstructorDashboardData,
} from '@/components/dashboard/InstructorDashboard';
import { PageHeader } from '@/components/ui/page-header';

export const Route = createFileRoute('/_authenticated/instructor/dashboard')({
  loader: async () => {
    return getInstructorDashboardData();
  },
  component: InstructorDashboardPage,
});

function InstructorDashboardPage() {
  const { t } = useI18n();
  const data = Route.useLoaderData() as unknown as InstructorDashboardData;

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
