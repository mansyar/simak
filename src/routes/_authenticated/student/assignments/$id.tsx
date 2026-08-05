import { useState, useEffect } from 'react';
import { createFileRoute, Link, Outlet, useMatchRoute } from '@tanstack/react-router';
import { getStudentAssignmentDetail } from '@/server/assignments';
import { listConsultations, listVerifiedCounts } from '@/server/consultations';
import { listMyExtensionRequests } from '@/server/extensions';
import { StudentFinalGradeCard } from '@/components/gradebook/StudentFinalGradeCard';
import { AssignmentDetailHeader } from '@/components/student/assignments/AssignmentDetailHeader';
import { CheckpointTimeline } from '@/components/student/assignments/CheckpointTimeline';
import { StudentAssignmentLoadingSkeleton } from '@/components/student/assignments/StudentAssignmentLoadingSkeleton';
import { ConsultationForm } from '@/components/consultations/ConsultationForm';
import { ConsultationList } from '@/components/consultations/ConsultationList';
import { ConsultationProgress } from '@/components/consultations/ConsultationProgress';
import { Pagination } from '@/components/ui/pagination';
import { Tabs } from '@/components/ui/tabs';
import { ExtensionRequestForm } from '@/components/student/extensions/ExtensionRequestForm';
import { ExtensionHistoryList } from '@/components/student/extensions/ExtensionHistoryList';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft } from 'lucide-react';
import { useI18n } from '../../../__root';
import { getErrorTranslationKey, isServerError } from '@/lib/errors';
import { ErrorState } from '@/components/ui/error-state';

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
  const navigate = Route.useNavigate();
  const matchRoute = useMatchRoute();
  const [consultations, setConsultations] = useState<
    {
      id: number;
      checkpointName: string;
      sessionType: string | null;
      externalConsultantName: string | null;
      notes: string | null;
      status: string;
      createdAt: Date | null;
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
  const [loadingConsultations, setLoadingConsultations] = useState(true);
  const [loadingExtensions, setLoadingExtensions] = useState(true);
  const [sideDataError, setSideDataError] = useState<'consultations' | 'extensions' | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const [consultationPage, setConsultationPage] = useState(1);
  const [consultationTotal, setConsultationTotal] = useState(0);
  const [extensionPage, setExtensionPage] = useState(1);
  const [extensionTotal, setExtensionTotal] = useState(0);
  const [extensionItems, setExtensionItems] = useState<
    {
      id: number;
      category: string;
      extensionDays: number;
      status: 'pending' | 'approved' | 'rejected';
      reason: string | null;
      createdAt: Date | null;
      resolvedAt: Date | null;
      resolutionReason: string | null;
      checkpointName: string | null;
    }[]
  >([]);

  // Load consultation data on mount
  useEffect(() => {
    if (assignment) {
      const loadConsultations = async () => {
        setLoadingConsultations(true);
        setLoadingExtensions(true);
        setSideDataError(null);
        let failedSide: 'consultations' | 'extensions' = 'consultations';
        try {
          const consResult = await listConsultations({
            data: { assignmentId: assignment.id, page: consultationPage, limit: 20 },
          });
          if (!isServerError(consResult)) {
            setConsultations(consResult.consultations);
            setConsultationTotal(consResult.total);
          } else {
            setSideDataError('consultations');
          }

          const countsResult = await listVerifiedCounts({
            data: { assignmentId: assignment.id },
          });
          if (!isServerError(countsResult)) {
            setVerifiedCounts(countsResult.counts);
          } else {
            setSideDataError('consultations');
          }
          setLoadingConsultations(false);

          // Load extension requests
          failedSide = 'extensions';
          const extResult = await listMyExtensionRequests({
            data: { assignmentId: assignment.id, page: extensionPage, limit: 20 },
          });
          if (!isServerError(extResult)) {
            setExtensionItems(extResult.items);
            setExtensionTotal(extResult.total);
          } else {
            setSideDataError('extensions');
          }
          setLoadingExtensions(false);
        } catch {
          setSideDataError(failedSide);
          setLoadingConsultations(false);
          setLoadingExtensions(false);
        }
      };
      loadConsultations();
    }
  }, [assignment, consultationPage, extensionPage, retryTrigger]);

  // If a child route is active (e.g., /checkpoints/:checkpointId), render it via Outlet
  // The child route (submission page) has its own full layout and back navigation
  const isOnCheckpointChild = matchRoute({
    to: '/student/assignments/$id/checkpoints/$checkpointId',
  } as never);
  if (isOnCheckpointChild) {
    return <Outlet />;
  }

  if (!assignment) {
    if (isServerError(data)) {
      return (
        <ErrorState
          title={t(getErrorTranslationKey(data.error.code))}
          retryLabel={t('common.refresh')}
          onRetry={() => navigate({} as never)}
        />
      );
    }
    return <AssignmentNotFound />;
  }

  const detail = {
    title: assignment.title,
    description: assignment.description,
    finalDeadline: new Date(assignment.finalDeadline),
    effectiveDeadline: assignment.effectiveDeadline ? new Date(assignment.effectiveDeadline) : null,
    instructorName: assignment.instructorName,
    templateName: assignment.templateName,
    templateType: assignment.templateType,
  };

  const assignmentTabs = [
    { id: 'timeline', label: t('studentAssignments.checkpointTimeline') },
    { id: 'consultations', label: t('consultations.title') },
    { id: 'extensions', label: t('extensions.requestTitle') },
  ];

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
    setLoadingConsultations(true);
    // Refresh consultation data
    const consResult = await listConsultations({
      data: { assignmentId: assignment.id, page: consultationPage, limit: 20 },
    });
    if (!isServerError(consResult)) {
      setConsultations(consResult.consultations);
      setConsultationTotal(consResult.total);
    }

    const countsResult = await listVerifiedCounts({
      data: { assignmentId: assignment.id },
    });
    if (!isServerError(countsResult)) {
      setVerifiedCounts(countsResult.counts);
    }
    setLoadingConsultations(false);
  };

  const handleExtensionSuccess = async () => {
    setLoadingExtensions(true);
    // Refresh extension data
    const extResult = await listMyExtensionRequests({
      data: { assignmentId: assignment.id, page: extensionPage, limit: 20 },
    });
    if (!isServerError(extResult)) {
      setExtensionItems(extResult.items);
      setExtensionTotal(extResult.total);
    }
    setLoadingExtensions(false);
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

      <StudentFinalGradeCard assignmentId={assignment.id} />

      <Tabs
        tabs={assignmentTabs}
        activeTab={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId as typeof activeTab)}
        idPrefix="student-assignment"
        ariaLabel={t('studentAssignments.sectionsLabel')}
      />

      <div
        id={`student-assignment-tabpanel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`student-assignment-tab-${activeTab}`}
        tabIndex={0}
        className="min-w-0 pt-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {activeTab === 'timeline' && (
          <CheckpointTimeline checkpoints={checkpoints} assignmentId={assignment.id} />
        )}

        {activeTab === 'consultations' && (
          <div className="space-y-6">
            {sideDataError === 'consultations' ? (
              <ErrorState
                title={t('errors.fetchFailed')}
                retryLabel={t('common.refresh')}
                onRetry={() => {
                  setSideDataError(null);
                  setRetryTrigger((c) => c + 1);
                }}
              />
            ) : loadingConsultations ? (
              <div className="space-y-6">
                <div className="rounded-lg border bg-card p-5 shadow-sm">
                  <Skeleton data-testid="skeleton" className="h-6 w-48" />
                  <Skeleton data-testid="skeleton" className="mt-4 h-4 w-full" />
                </div>
                <div className="rounded-lg border bg-card p-5 shadow-sm">
                  <Skeleton data-testid="skeleton" className="h-6 w-48" />
                  <Skeleton data-testid="skeleton" className="mt-4 h-4 w-full" />
                </div>
              </div>
            ) : (
              <>
                <ConsultationProgress counts={verifiedCounts} />

                <div className="rounded-lg border bg-card p-5 shadow-sm">
                  <h2 className="text-lg font-semibold text-foreground mb-4">
                    {t('consultations.logConsultation')}
                  </h2>
                  <ConsultationForm
                    assignmentId={assignment.id}
                    checkpoints={checkpoints.map((cp) => ({ id: cp.id, name: cp.name }))}
                    onSuccess={handleConsultationSuccess}
                  />
                </div>

                <div className="rounded-lg border bg-card p-5 shadow-sm">
                  <h2 className="text-lg font-semibold text-foreground mb-4">
                    {t('consultations.previousSessions')}
                  </h2>
                  <ConsultationList consultations={consultations} />
                  <Pagination
                    currentPage={consultationPage}
                    totalPages={Math.max(1, Math.ceil(consultationTotal / 20))}
                    onPageChange={setConsultationPage}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'extensions' && (
          <div className="space-y-6">
            {sideDataError === 'extensions' ? (
              <ErrorState
                title={t('errors.fetchFailed')}
                retryLabel={t('common.refresh')}
                onRetry={() => {
                  setSideDataError(null);
                  setRetryTrigger((c) => c + 1);
                }}
              />
            ) : loadingExtensions ? (
              <div className="space-y-6">
                <div className="rounded-lg border bg-card p-5 shadow-sm">
                  <Skeleton data-testid="skeleton" className="h-6 w-48" />
                  <Skeleton data-testid="skeleton" className="mt-4 h-4 w-full" />
                </div>
                <div className="rounded-lg border bg-card p-5 shadow-sm">
                  <Skeleton data-testid="skeleton" className="h-6 w-48" />
                  <Skeleton data-testid="skeleton" className="mt-4 h-4 w-full" />
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-lg border bg-card p-5 shadow-sm">
                  <h2 className="text-lg font-semibold text-foreground mb-4">
                    {t('extensions.requestTitle')}
                  </h2>
                  <ExtensionRequestForm
                    assignmentId={assignment.id}
                    maxExtensionDays={assignment.maxExtensionDays ?? 7}
                    maxTotalExtensions={assignment.maxTotalExtensions ?? 3}
                    checkpoints={checkpoints.map((cp) => ({ id: cp.id, name: cp.name }))}
                    onSuccess={handleExtensionSuccess}
                  />
                </div>

                <ExtensionHistoryList items={extensionItems} />
                <Pagination
                  currentPage={extensionPage}
                  totalPages={Math.max(1, Math.ceil(extensionTotal / 20))}
                  onPageChange={setExtensionPage}
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
