import { createFileRoute, Link } from '@tanstack/react-router';
import { getStudentAssignmentDetail } from '@/server/assignments';
import { AssignmentDetailHeader } from '@/components/student/assignments/AssignmentDetailHeader';
import { CheckpointTimeline } from '@/components/student/assignments/CheckpointTimeline';
import { StudentAssignmentLoadingSkeleton } from '@/components/student/assignments/StudentAssignmentLoadingSkeleton';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { useI18n } from '../../../__root';

export const Route = createFileRoute('/_authenticated/student/assignments/$id')({
  loader: async ({ params }) => {
    return (getStudentAssignmentDetail as any)({ data: { id: Number((params as any).id) } });
  },
  pendingComponent: () => (
    <div className="space-y-6">
      <StudentAssignmentLoadingSkeleton count={1} />
    </div>
  ),
  notFoundComponent: () => <AssignmentNotFound />,
  component: AssignmentDetailPage,
});

function AssignmentNotFound() {
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <h2 className="text-xl font-semibold text-foreground mb-2">
        {t('studentAssignments.notFound')}
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        {t('studentAssignments.notFoundDescription')}
      </p>
      <Link to="/student/assignments" className="inline-flex" search={() => ({}) as any}>
        <Button variant="outline" type="button">
          <ChevronLeft className="mr-2 h-4 w-4" />
          {t('common.back')}
        </Button>
      </Link>
    </div>
  );
}

function AssignmentDetailPage() {
  const { t } = useI18n();
  const data = Route.useLoaderData() as any;
  const navigate = Route.useNavigate() as any;

  if (!data) {
    return <AssignmentNotFound />;
  }

  const detail = {
    title: data.title,
    description: data.description,
    finalDeadline: new Date(data.finalDeadline),
    instructorName: data.instructorName,
    templateName: data.templateName,
    templateType: data.templateType,
  };

  const checkpoints = (data.checkpoints ?? []).map((cp: any) => ({
    id: cp.id,
    name: cp.name,
    order: cp.order,
    state: cp.state,
    dueDate: cp.dueDate ? new Date(cp.dueDate) : null,
    minConsultations: cp.minConsultations,
    verifiedConsultationCount: cp.verifiedConsultationCount,
    blockingReasons: cp.blockingReasons,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/student/assignments" search={() => ({}) as any} className="inline-flex">
          <Button variant="ghost" size="sm" type="button">
            <ChevronLeft className="mr-1 h-4 w-4" />
            {t('common.back')}
          </Button>
        </Link>

        {/* Progress summary */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t('studentAssignments.progress')}</span>
          <span className="font-semibold text-foreground">{data.progressPercent ?? 0}%</span>
        </div>
      </div>

      <AssignmentDetailHeader detail={detail} />

      <div className="border-t pt-6">
        <CheckpointTimeline checkpoints={checkpoints} />
      </div>
    </div>
  );
}
