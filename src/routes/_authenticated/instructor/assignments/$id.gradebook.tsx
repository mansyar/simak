import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { getAssignmentGradebook } from '@/server/gradebook';
import { GradebookTable } from '@/components/gradebook/GradebookTable';
import { GradeConfigSummary } from '@/components/gradebook/GradeConfigSummary';
import { RecomputeGradesButton } from '@/components/gradebook/RecomputeGradesButton';
import { GradebookExportButtons } from '@/components/gradebook/GradebookExportButtons';
import { useI18n } from '../../../__root';
import { isServerError } from '@/lib/errors';

export const Route = createFileRoute('/_authenticated/instructor/assignments/$id/gradebook')({
  loader: async ({ params }) => {
    return getAssignmentGradebook({ data: { assignmentId: Number(params.id) } });
  },
  component: GradebookPage,
  pendingComponent: GradebookLoading,
});

function GradebookLoading() {
  const { t } = useI18n();
  return <p className="text-sm text-muted-foreground p-4">{t('gradebook.loading')}</p>;
}

function GradebookPage() {
  const { t } = useI18n();
  const loaderData = Route.useLoaderData();
  const data = loaderData && !isServerError(loaderData) ? loaderData : null;
  const { id } = Route.useParams();

  if (!data) {
    return (
      <div className="space-y-4">
        <Link
          to="/instructor/assignments/$id"
          params={{ id }}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('common.back')}
        </Link>
        <p className="text-sm text-muted-foreground">{t('gradebook.loadError')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link
        to="/instructor/assignments/$id"
        params={{ id }}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t('common.back')}
      </Link>
      <h1 className="text-2xl font-bold">{t('gradebook.title')}</h1>
      <GradeConfigSummary config={data.config} />
      <div className="flex gap-2">
        <GradebookExportButtons assignmentId={Number(id)} />
        <RecomputeGradesButton assignmentId={Number(id)} isAdmin={data.isAdmin} />
      </div>
      <GradebookTable students={data.students} config={data.config} />
    </div>
  );
}
