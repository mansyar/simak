import { createFileRoute } from '@tanstack/react-router';
import { AssignmentWizard } from '@/components/instructor/assignments/AssignmentWizard';
import { PageHeader } from '@/components/ui/page-header';
import { useI18n } from '../../../__root';

export const Route = createFileRoute('/_authenticated/instructor/assignments/new')({
  component: NewAssignmentPage,
});

function NewAssignmentPage() {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('instructorAssignments.newAssignment')}
        subtitle={t('instructorAssignments.newAssignmentSubtitle')}
        back={{
          to: '/instructor/assignments',
          label: t('common.back'),
          search: { page: 1, limit: 20, search: '' },
        }}
      />

      {/* Multi-step Wizard wrapper */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <AssignmentWizard />
      </div>
    </div>
  );
}
