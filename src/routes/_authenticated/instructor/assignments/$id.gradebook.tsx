import { useState, useMemo } from 'react';
import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { ArrowLeft, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { getAssignmentGradebook, saveGradeConfig } from '@/server/gradebook';
import { GradebookTable } from '@/components/gradebook/GradebookTable';
import { GradeConfigSummary } from '@/components/gradebook/GradeConfigSummary';
import { RecomputeGradesButton } from '@/components/gradebook/RecomputeGradesButton';
import { GradebookExportButtons } from '@/components/gradebook/GradebookExportButtons';
import { GradeSettingsDialog } from '@/components/gradebook/GradeSettingsDialog';
import { Button } from '@/components/ui/button';
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
  const router = useRouter();
  const loaderData = Route.useLoaderData();
  const data = loaderData && !isServerError(loaderData) ? loaderData : null;
  const { id } = Route.useParams();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const templateCheckpoints = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, string>();
    for (const student of data.students) {
      if (!student.checkpoints) continue;
      for (const cp of student.checkpoints) {
        const tcId = cp.templateCheckpointId ? String(cp.templateCheckpointId) : null;
        if (tcId && !map.has(tcId)) {
          map.set(tcId, cp.checkpointName);
        }
      }
    }
    return Array.from(map, ([cpId, name]) => ({ id: cpId, name }));
  }, [data]);

  const handleSaveConfig = async (values: Parameters<typeof saveGradeConfig>[0]['data']) => {
    const result = await saveGradeConfig({ data: values });
    if (isServerError(result)) {
      toast.error(t('gradebook.settings.saveError'));
      throw new Error('Failed to save grade config');
    }
    router.invalidate();
  };

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
        {data.isAdmin && (
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
            <Settings className="h-3.5 w-3.5 mr-1" />
            {t('gradebook.settings.title')}
          </Button>
        )}
      </div>
      <GradebookTable students={data.students} config={data.config} />
      {data.isAdmin && (
        <GradeSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          assignmentId={Number(id)}
          config={data.config}
          checkpoints={templateCheckpoints}
          onSubmit={handleSaveConfig}
        />
      )}
    </div>
  );
}
