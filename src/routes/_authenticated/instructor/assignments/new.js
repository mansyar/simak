import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { createFileRoute } from '@tanstack/react-router';
import { AssignmentWizard } from '@/components/instructor/assignments/AssignmentWizard';
import { PageHeader } from '@/components/ui/page-header';
import { useI18n } from '../../../__root';
export const Route = createFileRoute('/_authenticated/instructor/assignments/new')({
  component: NewAssignmentPage,
});
function NewAssignmentPage() {
  const { t } = useI18n();
  return _jsxs('div', {
    className: 'space-y-6',
    children: [
      _jsx(PageHeader, {
        title: t('instructorAssignments.newAssignment'),
        subtitle: t('instructorAssignments.newAssignmentSubtitle'),
        back: {
          to: '/instructor/assignments',
          label: t('common.back'),
          search: { page: 1, limit: 20, search: '' },
        },
      }),
      _jsx('div', {
        className: 'rounded-xl border bg-card p-6 shadow-sm',
        children: _jsx(AssignmentWizard, {}),
      }),
    ],
  });
}
