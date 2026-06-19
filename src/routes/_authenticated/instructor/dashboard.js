import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { createFileRoute } from '@tanstack/react-router';
import { getInstructorDashboardData } from '@/server/dashboard';
import { useI18n } from '../../__root';
import { InstructorDashboard } from '@/components/dashboard/InstructorDashboard';
import { PageHeader } from '@/components/ui/page-header';
export const Route = createFileRoute('/_authenticated/instructor/dashboard')({
  loader: async () => {
    return getInstructorDashboardData();
  },
  component: InstructorDashboardPage,
});
function InstructorDashboardPage() {
  const { t } = useI18n();
  const data = Route.useLoaderData();
  return _jsxs('div', {
    className: 'space-y-6',
    children: [
      _jsx(PageHeader, {
        title: t('instructorDashboard.title'),
        subtitle: t('instructorDashboard.subtitle'),
      }),
      _jsx(InstructorDashboard, { data: data }),
    ],
  });
}
