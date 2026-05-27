import { createFileRoute, Link } from '@tanstack/react-router';
import { AssignmentWizard } from '@/components/instructor/assignments/AssignmentWizard';
import { ArrowLeft } from 'lucide-react';
import { useI18n } from '../../../__root';

export const Route = createFileRoute('/_authenticated/instructor/assignments/new')({
  component: NewAssignmentPage,
});

function NewAssignmentPage() {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      {/* Header and Back navigation */}
      <div className="flex flex-col gap-3">
        <div>
          <Link
            to={'/instructor/assignments' as any}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('common.back')}
          </Link>
        </div>

        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {t('instructorAssignments.newAssignment')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('instructorAssignments.newAssignmentSubtitle')}
          </p>
        </div>
      </div>

      {/* Multi-step Wizard wrapper */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <AssignmentWizard />
      </div>
    </div>
  );
}
