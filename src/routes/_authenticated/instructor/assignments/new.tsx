import { createFileRoute } from '@tanstack/react-router';
import { AssignmentWizard } from '@/components/instructor/assignments/AssignmentWizard';
import type { AssignmentSectionOption } from '@/components/instructor/assignments/AssignmentContextControls';
import { PageHeader } from '@/components/ui/page-header';
import { isServerError } from '@/lib/errors';
import { listInstructorAssignmentSections } from '@/server/instructor-assignment-context';
import { useI18n } from '../../../__root';

export const Route = createFileRoute('/_authenticated/instructor/assignments/new')({
  loader: async () => {
    const result = await listInstructorAssignmentSections();
    if (isServerError(result)) return { sections: [] as AssignmentSectionOption[] };

    return {
      sections: result.sections.map((section) => ({
        id: section.id,
        label: section.label,
        termId: section.termId,
        courseId: section.courseId,
        status: section.status,
        students: section.students,
      })),
    };
  },
  component: NewAssignmentPage,
});

function NewAssignmentPage() {
  const { t } = useI18n();
  const { sections = [] } = Route.useLoaderData();

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
        <AssignmentWizard sections={sections} />
      </div>
    </div>
  );
}
