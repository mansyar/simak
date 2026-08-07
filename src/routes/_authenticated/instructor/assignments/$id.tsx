import { useEffect, useState } from 'react';
import { createFileRoute, Link, Outlet, useMatchRoute } from '@tanstack/react-router';
import {
  cloneAssignment,
  getAssignmentDetail,
  rolloverAssignment,
  transitionAssignmentStatus,
} from '@/server/assignments';
import { listInstructorAssignmentSections } from '@/server/instructor-assignment-context';
import { exportStudentProgressCsv, exportReviewHistoryCsv } from '@/server/analytics';
import { AssignmentDetailHeader } from '@/components/instructor/assignments/AssignmentDetailHeader';
import {
  AssignmentCloneDialog,
  type AssignmentCopyOperation,
} from '@/components/instructor/assignments/AssignmentCloneDialog';
import type { AssignmentSectionOption } from '@/components/instructor/assignments/AssignmentContextControls';
import type { AssignmentDetailSuccess } from '@/server/assignments-context-handlers.server';
import { AssignmentOverviewTab } from '@/components/instructor/assignments/AssignmentOverviewTab';
import { AssignmentConsultationsTab } from '@/components/instructor/assignments/AssignmentConsultationsTab';
import { AssignmentExtensionsTab } from '@/components/instructor/assignments/AssignmentExtensionsTab';
import { AssignmentInterventionsTab } from '@/components/instructor/assignments/AssignmentInterventionsTab';
import { AssignmentDetailTabs } from '@/components/instructor/assignments/AssignmentDetailTabs';
import { InstructorDiscussionBrowser } from '@/components/instructor/assignments/InstructorDiscussionBrowser';
import { useAssignmentTabs } from '@/hooks/use-assignment-tabs';
import { useCsvDownload } from '@/hooks/use-csv-download';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, buttonVariants } from '@/components/ui/button';
import { FileX, Download } from 'lucide-react';
import { useI18n } from '../../../__root';
import { ErrorCode, getErrorTranslationKey, isServerError } from '@/lib/errors';
import { AssignmentDetailSkeleton } from '@/components/skeletons/assignment-detail-skeleton';
import { ErrorState } from '@/components/ui/error-state';

export const Route = createFileRoute('/_authenticated/instructor/assignments/$id')({
  loader: async ({ params }) => {
    const [assignmentResult, sectionResult] = await Promise.all([
      getAssignmentDetail({ data: { id: Number(params.id) } }),
      listInstructorAssignmentSections(),
    ]);

    if (isServerError(assignmentResult)) return assignmentResult;
    if (assignmentResult === null) return null;

    return {
      ...assignmentResult,
      availableSections: isServerError(sectionResult) ? [] : sectionResult.sections,
    };
  },
  component: AssignmentDetailPage,
  pendingComponent: () => <AssignmentDetailSkeleton />,
});

const assignmentTabIds = new Set([
  'overview',
  'consultations',
  'extensions',
  'discussions',
  'interventions',
]);

export function getAssignmentTabFromHash(hash: string) {
  const tab = hash.replace(/^#/, '');
  return assignmentTabIds.has(tab) ? tab : null;
}

function AssignmentDetailPage() {
  const { t } = useI18n();
  const loaderData = Route.useLoaderData();
  const assignment = loaderData && !isServerError(loaderData) ? loaderData : null;
  const assignmentError = isServerError(loaderData) ? loaderData : null;
  const navigate = Route.useNavigate();
  const { id } = Route.useParams();
  const { exportCsv, isExporting } = useCsvDownload();

  const [activeTab, setActiveTab] = useState('overview');
  const [selectedConsultationId, setSelectedConsultationId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [copyOperation, setCopyOperation] = useState<AssignmentCopyOperation>('clone');
  const [copySubmitting, setCopySubmitting] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [assignmentStatus, setAssignmentStatus] = useState<'draft' | 'active' | 'archived'>(
    assignment?.status ?? 'draft',
  );
  const tabs = useAssignmentTabs(assignment?.id ?? null);
  const matchRoute = useMatchRoute();

  useEffect(() => {
    const applyHash = () => {
      const tab = getAssignmentTabFromHash(window.location.hash);
      if (tab) setActiveTab(tab);
    };

    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, []);

  if (!assignment) {
    if (assignmentError && assignmentError.error.code !== ErrorCode.NOT_FOUND) {
      return (
        <ErrorState
          title={t(getErrorTranslationKey(assignmentError.error.code))}
          retryLabel={t('common.refresh')}
          onRetry={() =>
            navigate({
              to: '/instructor/assignments/$id',
              params: { id },
            })
          }
        />
      );
    }

    return (
      <EmptyState
        icon={FileX}
        title={t('error.notFound')}
        description={t('error.assignmentNotFound')}
      >
        <Link
          to="/instructor/assignments"
          search={{ page: 1, limit: 20, search: '' }}
          className="text-primary hover:underline text-sm"
        >
          {t('common.back')}
        </Link>
      </EmptyState>
    );
  }

  const assignmentData = assignment as AssignmentDetailSuccess & {
    availableSections?: AssignmentSectionOption[];
  };
  const availableSections = assignmentData.availableSections ?? [];
  const nextStatus = assignmentStatus === 'draft' ? 'active' : 'archived';

  const handleStatusTransition = async () => {
    const confirmation =
      nextStatus === 'active'
        ? t('instructorAssignments.lifecycle.confirmActivate')
        : t('instructorAssignments.lifecycle.confirmArchive');
    if (!window.confirm(confirmation)) return;

    const result = await transitionAssignmentStatus({
      data: { assignmentId: assignmentData.id, status: nextStatus },
    });
    if (isServerError(result)) return;
    setAssignmentStatus(nextStatus);
  };

  const openCopyDialog = (operation: AssignmentCopyOperation) => {
    setCopyOperation(operation);
    setCopyError(false);
    setCopyDialogOpen(true);
  };

  const handleCopy = async (input: {
    targetSectionId: number;
    finalDeadline: Date;
    title?: string;
  }) => {
    setCopySubmitting(true);
    setCopyError(false);

    const copyHandler = copyOperation === 'clone' ? cloneAssignment : rolloverAssignment;
    const result = await copyHandler({
      data: {
        sourceAssignmentId: assignmentData.id,
        targetSectionId: input.targetSectionId,
        finalDeadline: input.finalDeadline,
        title: input.title,
        studentIds: [],
      },
    });

    setCopySubmitting(false);
    if (isServerError(result)) {
      setCopyError(true);
      return;
    }

    setCopyDialogOpen(false);
    navigate({
      to: '/instructor/assignments/$id',
      params: { id: String(result.assignmentId) },
    });
  };

  const isOnGradebookChild = matchRoute({
    to: '/instructor/assignments/$id/gradebook',
  } as never);
  if (isOnGradebookChild) {
    return <Outlet />;
  }

  const tabList = [
    { id: 'overview', label: t('instructorAssignments.details.overview') },
    {
      id: 'consultations',
      label: t('consultations.title'),
      count: tabs.pendingConsultations.length,
    },
    { id: 'extensions', label: t('extensions.queueTitle'), count: tabs.extensionRequests.length },
    { id: 'discussions', label: t('discussions.title') },
    { id: 'interventions', label: t('instructorInterventions.title') },
  ];

  return (
    <div className="space-y-6">
      <AssignmentDetailHeader
        title={assignmentData.title}
        templateType={assignmentData.templateType}
        description={assignmentData.description}
        action={
          <div className="flex items-center gap-2">
            <Link
              to="/instructor/assignments/$id/gradebook"
              params={{ id: String(assignmentData.id) }}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              {t('gradebook.title')}
            </Link>
            <Button
              variant="outline"
              loading={isExporting}
              onClick={() =>
                exportCsv(
                  () =>
                    exportStudentProgressCsv({
                      data: { assignmentId: assignmentData.id },
                    }) as Promise<unknown>,
                  'student-progress.csv',
                )
              }
            >
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('common.exportStudentProgress')}
            </Button>
            <Button
              variant="outline"
              loading={isExporting}
              onClick={() =>
                exportCsv(
                  () =>
                    exportReviewHistoryCsv({
                      data: { assignmentId: assignmentData.id },
                    }) as Promise<unknown>,
                  'review-history.csv',
                )
              }
            >
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('common.exportReviewHistory')}
            </Button>
            {assignmentStatus !== 'archived' && (
              <Button variant="outline" onClick={handleStatusTransition}>
                {nextStatus === 'active'
                  ? t('instructorAssignments.actions.activate')
                  : t('instructorAssignments.actions.archive')}
              </Button>
            )}
            <Button variant="outline" onClick={() => openCopyDialog('clone')}>
              {t('instructorAssignments.actions.clone')}
            </Button>
            <Button variant="outline" onClick={() => openCopyDialog('rollover')}>
              {t('instructorAssignments.actions.rollover')}
            </Button>
          </div>
        }
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
        <span className="font-medium">{t('instructorAssignments.context.section')}:</span>
        <span>{assignmentData.context?.course?.code}</span>
        <span>{assignmentData.context?.section?.code}</span>
        <span>{assignmentData.context?.section?.name}</span>
        <span>{assignmentData.context?.term?.name}</span>
        <span className="rounded-full border px-2 py-0.5">
          {t(`instructorAssignments.status.${assignmentStatus}`)}
        </span>
      </div>
      <AssignmentCloneDialog
        open={copyDialogOpen}
        operation={copyOperation}
        sourceTitle={assignmentData.title}
        sections={availableSections}
        isSubmitting={copySubmitting}
        hasError={copyError}
        onOpenChange={setCopyDialogOpen}
        onSubmit={handleCopy}
      />
      <AssignmentDetailTabs tabs={tabList} activeTab={activeTab} onTabChange={setActiveTab} />
      <div
        id={`assignment-detail-tabpanel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`assignment-detail-tab-${activeTab}`}
        tabIndex={0}
      >
        {activeTab === 'overview' && <AssignmentOverviewTab assignment={assignmentData} />}
        {activeTab === 'consultations' && (
          <AssignmentConsultationsTab
            pendingConsultations={tabs.pendingConsultations}
            selectedConsultationId={selectedConsultationId}
            setSelectedConsultationId={setSelectedConsultationId}
            dialogOpen={dialogOpen}
            setDialogOpen={setDialogOpen}
            pendingPage={tabs.pendingPage}
            pendingTotal={tabs.pendingTotal}
            onPageChange={tabs.setPendingPage}
            onRefresh={tabs.refreshPendingConsultations}
          />
        )}
        {activeTab === 'extensions' && (
          <AssignmentExtensionsTab
            requests={tabs.extensionRequests}
            loading={tabs.extensionsLoading}
            onApprove={tabs.handleApproveExtension}
            onReject={tabs.handleRejectExtension}
          />
        )}
        {activeTab === 'discussions' && (
          <InstructorDiscussionBrowser
            assignmentId={assignmentData.id}
            students={assignmentData.students}
          />
        )}
        {activeTab === 'interventions' && (
          <AssignmentInterventionsTab
            assignmentId={assignmentData.id}
            students={assignmentData.students}
          />
        )}
      </div>
    </div>
  );
}
