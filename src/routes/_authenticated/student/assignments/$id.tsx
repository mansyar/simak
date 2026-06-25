import { useState, useEffect } from 'react';
import { createFileRoute, Link, Outlet, useMatchRoute } from '@tanstack/react-router';
import { getStudentAssignmentDetail } from '@/server/assignments';
import { listConsultations, listVerifiedCounts } from '@/server/consultations';
import { listMyExtensionRequests } from '@/server/extensions';
import { AssignmentDetailHeader } from '@/components/student/assignments/AssignmentDetailHeader';
import { CheckpointTimeline } from '@/components/student/assignments/CheckpointTimeline';
import { StudentAssignmentLoadingSkeleton } from '@/components/student/assignments/StudentAssignmentLoadingSkeleton';
import { ConsultationForm } from '@/components/consultations/ConsultationForm';
import { ConsultationList } from '@/components/consultations/ConsultationList';
import { ConsultationProgress } from '@/components/consultations/ConsultationProgress';
import { ExtensionRequestForm } from '@/components/student/extensions/ExtensionRequestForm';
import { ExtensionHistoryList } from '@/components/student/extensions/ExtensionHistoryList';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { useI18n } from '../../../__root';
import { isServerError } from '@/lib/errors';

export const Route = createFileRoute('/_authenticated/student/assignments/$id')({
  loader: async ({ params }) => {
    return getStudentAssignmentDetail({ data: { id: Number(params.id) } });
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
      <Link
        to="/student/assignments"
        className="inline-flex"
        search={() => ({ page: 1, limit: 20, search: '' })}
      >
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
  const data = Route.useLoaderData();
  const assignment = data && !isServerError(data) ? data : null;
  const matchRoute = useMatchRoute();
  const [consultations, setConsultations] = useState<
    {
      id: number;
      checkpointName: string;
      sessionType: string | null;
      externalConsultantName: string | null;
      notes: string | null;
      status: string;
      createdAt: string;
    }[]
  >([]);
  const [verifiedCounts, setVerifiedCounts] = useState<
    {
      checkpointId: number;
      checkpointName: string;
      verifiedCount: number;
      minConsultations: number;
    }[]
  >([]);
  const [activeTab, setActiveTab] = useState<'timeline' | 'consultations' | 'extensions'>(
    'timeline',
  );
  const [extensionItems, setExtensionItems] = useState<
    {
      id: number;
      category: string;
      extensionDays: number;
      status: 'pending' | 'approved' | 'rejected';
      reason: string | null;
      createdAt: string;
      resolvedAt: string | null;
      resolutionReason: string | null;
      checkpointName: string | null;
    }[]
  >([]);

  // Load consultation data on mount
  useEffect(() => {
    if (assignment) {
      const loadConsultations = async () => {
        const listConsFn = listConsultations as unknown as (args: {
          data: { assignmentId: number };
        }) => Promise<unknown>;
        const listCountsFn = listVerifiedCounts as unknown as (args: {
          data: { assignmentId: number };
        }) => Promise<unknown>;
        const consResult = await listConsFn({
          data: { assignmentId: assignment.id },
        });
        if (
          consResult &&
          typeof consResult === 'object' &&
          'consultations' in (consResult as Record<string, unknown>)
        ) {
          setConsultations((consResult as { consultations: typeof consultations }).consultations);
        }

        const countsResult = await listCountsFn({
          data: { assignmentId: assignment.id },
        });
        if (
          countsResult &&
          typeof countsResult === 'object' &&
          'counts' in (countsResult as Record<string, unknown>)
        ) {
          setVerifiedCounts((countsResult as { counts: typeof verifiedCounts }).counts);
        }

        // Load extension requests
        const listExtFn = listMyExtensionRequests as unknown as (args: {
          data: { assignmentId: number };
        }) => Promise<unknown>;
        const extResult = await listExtFn({
          data: { assignmentId: assignment.id },
        });
        if (
          extResult &&
          typeof extResult === 'object' &&
          'items' in (extResult as Record<string, unknown>)
        ) {
          setExtensionItems((extResult as { items: typeof extensionItems }).items);
        }
      };
      loadConsultations();
    }
  }, [assignment]);

  // If a child route is active (e.g., /checkpoints/:checkpointId), render it via Outlet
  // The child route (submission page) has its own full layout and back navigation
  const isOnCheckpointChild = matchRoute({
    to: '/student/assignments/$id/checkpoints/$checkpointId',
  } as never);
  if (isOnCheckpointChild) {
    return <Outlet />;
  }

  if (!assignment) {
    return <AssignmentNotFound />;
  }

  const detail = {
    title: assignment.title,
    description: assignment.description,
    finalDeadline: new Date(assignment.finalDeadline),
    instructorName: assignment.instructorName,
    templateName: assignment.templateName,
    templateType: assignment.templateType,
  };

  const checkpoints = (
    (assignment.checkpoints as {
      id: number;
      name: string;
      order: number;
      state: 'locked' | 'unlocked' | 'submitted' | 'under_review' | 'passed' | 'revise';
      dueDate: string | null;
      minConsultations: number;
      verifiedConsultationCount: number;
      blockingReasons: string[];
    }[]) ?? []
  ).map((cp) => ({
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
    const listConsFn = listConsultations as unknown as (args: {
      data: { assignmentId: number };
    }) => Promise<unknown>;
    const listCountsFn = listVerifiedCounts as unknown as (args: {
      data: { assignmentId: number };
    }) => Promise<unknown>;
    const consResult = await listConsFn({
      data: { assignmentId: assignment.id },
    });
    if (
      consResult &&
      typeof consResult === 'object' &&
      'consultations' in (consResult as Record<string, unknown>)
    ) {
      setConsultations((consResult as { consultations: typeof consultations }).consultations);
    }

    const countsResult = await listCountsFn({
      data: { assignmentId: assignment.id },
    });
    if (
      countsResult &&
      typeof countsResult === 'object' &&
      'counts' in (countsResult as Record<string, unknown>)
    ) {
      setVerifiedCounts((countsResult as { counts: typeof verifiedCounts }).counts);
    }
  };

  const handleExtensionSuccess = async () => {
    // Refresh extension data
    const listExtFn = listMyExtensionRequests as unknown as (args: {
      data: { assignmentId: number };
    }) => Promise<unknown>;
    const extResult = await listExtFn({
      data: { assignmentId: assignment.id },
    });
    if (
      extResult &&
      typeof extResult === 'object' &&
      'items' in (extResult as Record<string, unknown>)
    ) {
      setExtensionItems((extResult as { items: typeof extensionItems }).items);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          to="/student/assignments"
          search={() => ({ page: 1, limit: 20, search: '' })}
          className="inline-flex"
        >
          <Button variant="ghost" size="sm" type="button">
            <ChevronLeft className="mr-1 h-4 w-4" />
            {t('common.back')}
          </Button>
        </Link>

        {/* Progress summary */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t('studentAssignments.progress')}</span>
          <span className="font-semibold text-foreground">{assignment.progressPercent ?? 0}%</span>
        </div>
      </div>

      <AssignmentDetailHeader detail={detail} />

      {/* Tab Navigation */}
      <div className="border-b border-border">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            data-state={activeTab === 'timeline' ? 'active' : 'inactive'}
            className={`px-3 py-2 text-sm font-medium border-b-2 rounded-t-md transition-colors ${
              activeTab === 'timeline'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            {t('studentAssignments.checkpointTimeline')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('consultations')}
            data-state={activeTab === 'consultations' ? 'active' : 'inactive'}
            className={`px-3 py-2 text-sm font-medium border-b-2 rounded-t-md transition-colors ${
              activeTab === 'consultations'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            {t('consultations.title')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('extensions')}
            data-state={activeTab === 'extensions' ? 'active' : 'inactive'}
            className={`px-3 py-2 text-sm font-medium border-b-2 rounded-t-md transition-colors ${
              activeTab === 'extensions'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            {t('extensions.requestTitle')}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'timeline' && (
        <div className="border-t pt-6">
          <CheckpointTimeline checkpoints={checkpoints} assignmentId={assignment.id} />
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
              assignmentId={assignment.id}
              checkpoints={checkpoints.map((cp) => ({ id: cp.id, name: cp.name }))}
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

      {activeTab === 'extensions' && (
        <div className="space-y-6">
          <div className="rounded-lg border bg-card p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              {t('extensions.requestTitle')}
            </h3>
            <ExtensionRequestForm
              assignmentId={assignment.id}
              maxExtensionDays={assignment.maxExtensionDays ?? 7}
              maxTotalExtensions={assignment.maxTotalExtensions ?? 3}
              checkpoints={checkpoints.map((cp) => ({ id: cp.id, name: cp.name }))}
              onSuccess={handleExtensionSuccess}
            />
          </div>

          <ExtensionHistoryList items={extensionItems} />
        </div>
      )}
    </div>
  );
}
