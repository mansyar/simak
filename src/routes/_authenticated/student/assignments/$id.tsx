import { useState } from 'react';
import { createFileRoute, Link, Outlet, useMatchRoute } from '@tanstack/react-router';
import { getStudentAssignmentDetail } from '@/server/assignments';
import { listConsultations, listVerifiedCounts } from '@/server/consultations';
import { AssignmentDetailHeader } from '@/components/student/assignments/AssignmentDetailHeader';
import { CheckpointTimeline } from '@/components/student/assignments/CheckpointTimeline';
import { StudentAssignmentLoadingSkeleton } from '@/components/student/assignments/StudentAssignmentLoadingSkeleton';
import { ConsultationForm } from '@/components/consultations/ConsultationForm';
import { ConsultationList } from '@/components/consultations/ConsultationList';
import { ConsultationProgress } from '@/components/consultations/ConsultationProgress';
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
  const matchRoute = useMatchRoute();
  const [consultations, setConsultations] = useState<any[]>([]);
  const [verifiedCounts, setVerifiedCounts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'timeline' | 'consultations'>('timeline');

  // Load consultation data on mount
  useState(() => {
    if (data) {
      const loadConsultations = async () => {
        const consResult = await (listConsultations as any)({
          data: { assignmentId: data.id },
        });
        if (consResult.consultations) {
          setConsultations(consResult.consultations);
        }

        const countsResult = await (listVerifiedCounts as any)({
          data: { assignmentId: data.id },
        });
        if (countsResult.counts) {
          setVerifiedCounts(countsResult.counts);
        }
      };
      loadConsultations();
    }
  });

  // If a child route is active (e.g., /checkpoints/:checkpointId), render it via Outlet
  // The child route (submission page) has its own full layout and back navigation
  const isOnCheckpointChild = matchRoute({
    to: '/student/assignments/$id/checkpoints/$checkpointId',
  } as any);
  if (isOnCheckpointChild) {
    return <Outlet />;
  }

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

  const handleConsultationSuccess = async () => {
    // Refresh consultation data
    const consResult = await (listConsultations as any)({
      data: { assignmentId: data.id },
    });
    if (consResult.consultations) {
      setConsultations(consResult.consultations);
    }

    const countsResult = await (listVerifiedCounts as any)({
      data: { assignmentId: data.id },
    });
    if (countsResult.counts) {
      setVerifiedCounts(countsResult.counts);
    }
  };

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

      {/* Tab Navigation */}
      <div className="border-b border-border">
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'timeline'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('studentAssignments.checkpointTimeline')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('consultations')}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'consultations'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('consultations.title')}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'timeline' && (
        <div className="border-t pt-6">
          <CheckpointTimeline checkpoints={checkpoints} assignmentId={data.id} />
        </div>
      )}

      {activeTab === 'consultations' && (
        <div className="space-y-6">
          <ConsultationProgress counts={verifiedCounts} />

          <div className="rounded-lg border bg-card p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              {t('consultations.logConsultation')}
            </h3>
            <ConsultationForm
              assignmentId={data.id}
              checkpoints={checkpoints.map((cp: any) => ({ id: cp.id, name: cp.name }))}
              onSuccess={handleConsultationSuccess}
            />
          </div>

          <div className="rounded-lg border bg-card p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              {t('consultations.previousSessions')}
            </h3>
            <ConsultationList consultations={consultations} />
          </div>
        </div>
      )}
    </div>
  );
}
