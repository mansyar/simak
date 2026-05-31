import { createFileRoute } from '@tanstack/react-router';
import { getInstructorDashboardData } from '@/server/dashboard';
import { useI18n } from '../../__root';
import {
  InstructorDashboard,
  type InstructorDashboardData,
} from '@/components/dashboard/InstructorDashboard';

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
      <div>
        <h1 className="font-display text-4xl">{t('instructorDashboard.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('instructorDashboard.subtitle')}</p>
      </div>
      <InstructorDashboard data={data} />
    </div>
  );
}
