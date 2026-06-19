import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { createFileRoute } from '@tanstack/react-router';
import { getStudentDashboardData } from '@/server/dashboard';
import { useI18n } from '../../__root';
import { StudentDashboard } from '@/components/dashboard/StudentDashboard';
export const Route = createFileRoute('/_authenticated/student/dashboard')({
  loader: async () => {
    return getStudentDashboardData();
  },
  component: StudentDashboardPage,
});
function StudentDashboardPage() {
  const { t } = useI18n();
  const data = Route.useLoaderData();
  return _jsxs('div', {
    className: 'space-y-6',
    children: [
      _jsxs('div', {
        children: [
          _jsx('h1', {
            className: 'text-3xl font-bold tracking-tight text-foreground',
            children: t('studentDashboard.title'),
          }),
          _jsx('p', {
            className: 'text-sm text-muted-foreground mt-1',
            children: t('studentDashboard.subtitle'),
          }),
        ],
      }),
      _jsx(StudentDashboard, { data: data }),
    ],
  });
}
