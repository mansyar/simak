import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { getAssignmentDetail } from '@/server/assignments';
import { exportStudentProgressCsv, exportReviewHistoryCsv } from '@/server/analytics';
import { AssignmentDetailHeader } from '@/components/instructor/assignments/AssignmentDetailHeader';
import { AssignmentOverviewTab } from '@/components/instructor/assignments/AssignmentOverviewTab';
import { AssignmentConsultationsTab } from '@/components/instructor/assignments/AssignmentConsultationsTab';
import { AssignmentExtensionsTab } from '@/components/instructor/assignments/AssignmentExtensionsTab';
import { AssignmentDetailTabs } from '@/components/instructor/assignments/AssignmentDetailTabs';
import { DiscussionPanel } from '@/components/discussions/discussion-panel';
import { useAssignmentTabs } from '@/hooks/use-assignment-tabs';
import { useCsvDownload } from '@/hooks/use-csv-download';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { FileX, Download } from 'lucide-react';
import { useI18n } from '../../../__root';
import { isServerError } from '@/lib/errors';
import { AssignmentDetailSkeleton } from '@/components/skeletons/assignment-detail-skeleton';

export const Route = createFileRoute('/_authenticated/instructor/assignments/$id')({
  loader: async ({ params }) => {
    return getAssignmentDetail({ data: { id: Number(params.id) } });
  },
  component: AssignmentDetailPage,
  pendingComponent: () => <AssignmentDetailSkeleton />,
});

function AssignmentDetailPage() {
  const { t } = useI18n();
  const loaderData = Route.useLoaderData();
  const assignment = loaderData && !isServerError(loaderData) ? loaderData : null;
  const { exportCsv, isExporting } = useCsvDownload();

  const [activeTab, setActiveTab] = useState('overview');
  const [selectedConsultationId, setSelectedConsultationId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const tabs = useAssignmentTabs(assignment?.id ?? null);

  if (!assignment) {
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

  const tabList = [
    { id: 'overview', label: t('instructorAssignments.details.overview') },
    {
      id: 'consultations',
      label: t('consultations.title'),
      count: tabs.pendingConsultations.length,
    },
    { id: 'extensions', label: t('extensions.queueTitle'), count: tabs.extensionRequests.length },
    { id: 'discussions', label: t('discussions.title') },
  ];

  return (
    <div className="space-y-6">
      <AssignmentDetailHeader
        title={assignment.title}
        templateType={assignment.templateType}
        description={assignment.description}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              loading={isExporting}
              onClick={() =>
                exportCsv(
                  () =>
                    exportStudentProgressCsv({
                      data: { assignmentId: assignment.id },
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
                      data: { assignmentId: assignment.id },
                    }) as Promise<unknown>,
                  'review-history.csv',
                )
              }
            >
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('common.exportReviewHistory')}
            </Button>
          </div>
        }
      />
      <AssignmentDetailTabs tabs={tabList} activeTab={activeTab} onTabChange={setActiveTab} />
      {activeTab === 'overview' && <AssignmentOverviewTab assignment={assignment} />}
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
        <div className="space-y-6">
          {assignment.students.map((student) =>
            student.checkpoints.map((cp) => (
              <div key={cp.id} className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  {student.name} — {cp.name}
                </h3>
                <DiscussionPanel checkpointId={cp.id} assignmentId={assignment.id} instructorView />
              </div>
            )),
          )}
        </div>
      )}
    </div>
  );
}
