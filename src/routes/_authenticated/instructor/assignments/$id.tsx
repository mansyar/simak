import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { getAssignmentDetail } from '@/server/assignments';
import { AssignmentDetailHeader } from '@/components/instructor/assignments/AssignmentDetailHeader';
import { AssignmentOverviewTab } from '@/components/instructor/assignments/AssignmentOverviewTab';
import { AssignmentConsultationsTab } from '@/components/instructor/assignments/AssignmentConsultationsTab';
import { AssignmentExtensionsTab } from '@/components/instructor/assignments/AssignmentExtensionsTab';
import { AssignmentDetailTabs } from '@/components/instructor/assignments/AssignmentDetailTabs';
import { useAssignmentTabs } from '@/hooks/use-assignment-tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { FileX } from 'lucide-react';
import { useI18n } from '../../../__root';
import { isServerError } from '@/lib/errors';

export const Route = createFileRoute('/_authenticated/instructor/assignments/$id')({
  loader: async ({ params }) => {
    return getAssignmentDetail({ data: { id: Number(params.id) } });
  },
  component: AssignmentDetailPage,
});

function AssignmentDetailPage() {
  const { t } = useI18n();
  const loaderData = Route.useLoaderData();
  const assignment = loaderData && !isServerError(loaderData) ? loaderData : null;

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
  ];

  return (
    <div className="space-y-6">
      <AssignmentDetailHeader
        title={assignment.title}
        templateType={assignment.templateType}
        description={assignment.description}
      />
      <AssignmentDetailTabs tabs={tabList} activeTab={activeTab} onTabChange={setActiveTab} />
      {activeTab === 'overview' && <AssignmentOverviewTab assignment={assignment} />}
      {activeTab === 'consultations' && (
        <AssignmentConsultationsTab
          assignmentId={assignment.id}
          pendingConsultations={tabs.pendingConsultations}
          setPendingConsultations={tabs.setPendingConsultations}
          selectedConsultationId={selectedConsultationId}
          setSelectedConsultationId={setSelectedConsultationId}
          dialogOpen={dialogOpen}
          setDialogOpen={setDialogOpen}
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
    </div>
  );
}
