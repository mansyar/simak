import { useState, useEffect } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { getAssignmentDetail } from '@/server/assignments';
import { listPendingConsultations } from '@/server/consultations';
import { listExtensionRequests, approveExtension, rejectExtension } from '@/server/extensions';
import { AssignmentDetailHeader } from '@/components/instructor/assignments/AssignmentDetailHeader';
import { AssignmentOverviewTab } from '@/components/instructor/assignments/AssignmentOverviewTab';
import { AssignmentConsultationsTab } from '@/components/instructor/assignments/AssignmentConsultationsTab';
import type { PendingConsultation } from '@/components/instructor/assignments/AssignmentConsultationsTab';
import { AssignmentExtensionsTab } from '@/components/instructor/assignments/AssignmentExtensionsTab';
import { AssignmentDetailTabs } from '@/components/instructor/assignments/AssignmentDetailTabs';
import type { ExtensionRequestItem } from '@/components/instructor/extensions/PendingExtensionsSection';
import type { StudentProgress } from '@/components/instructor/assignments/ProgressTable';
import { EmptyState } from '@/components/ui/empty-state';
import { FileX } from 'lucide-react';
import { useI18n } from '../../../__root';

export const Route = createFileRoute('/_authenticated/instructor/assignments/$id')({
  loader: async ({ params }) => {
    // @ts-expect-error - handler type inference limitation
    return getAssignmentDetail({ data: { id: Number(params.id) } });
  },
  component: AssignmentDetailPage,
});

function AssignmentDetailPage() {
  const { t } = useI18n();
  const assignment = Route.useLoaderData() as unknown as {
    id: number;
    title: string;
    description: string | null;
    finalDeadline: Date;
    createdAt: Date;
    templateName: string;
    templateType: string;
    instructorId: number;
    students: StudentProgress[];
  } | null;

  const [pendingConsultations, setPendingConsultations] = useState<PendingConsultation[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedConsultationId, setSelectedConsultationId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [extensionRequests, setExtensionRequests] = useState<ExtensionRequestItem[]>([]);
  const [extensionsLoading, setExtensionsLoading] = useState(false);

  useEffect(() => {
    if (!assignment) return;
    const load = async () => {
      const listPendingFn = listPendingConsultations as unknown as (args: {
        data: { assignmentId: number };
      }) => Promise<{ consultations: PendingConsultation[] }>;
      const listExtensionsFn = listExtensionRequests as unknown as (args: {
        data: { assignmentId: number; status: string; page: number; limit: number };
      }) => Promise<{ items: ExtensionRequestItem[] }>;
      const [consultResult, extResult] = await Promise.all([
        listPendingFn({ data: { assignmentId: assignment.id } }),
        listExtensionsFn({ data: { assignmentId: assignment.id, status: 'pending', page: 1, limit: 50 } }),
      ]);
      if (consultResult.consultations) setPendingConsultations(consultResult.consultations);
      if ('items' in extResult) setExtensionRequests(extResult.items);
      setExtensionsLoading(false);
    };
    setExtensionsLoading(true);
    load();
  }, [assignment]);

  const refreshExtensions = async () => {
    if (!assignment) return;
    const listExtensionsFn = listExtensionRequests as unknown as (args: {
      data: { assignmentId: number; status: string; page: number; limit: number };
    }) => Promise<{ items: ExtensionRequestItem[] }>;
    const extResult = await listExtensionsFn({
      data: { assignmentId: assignment.id, status: 'pending', page: 1, limit: 50 },
    });
    if ('items' in extResult) setExtensionRequests(extResult.items);
  };

  const handleApproveExtension = async (requestId: number, comment?: string) => {
    const approveFn = approveExtension as unknown as (args: {
      data: { requestId: number; resolutionReason?: string };
    }) => Promise<{ error?: string }>;
    const result = await approveFn({ data: { requestId, resolutionReason: comment } });
    if (!result.error) await refreshExtensions();
  };

  const handleRejectExtension = async (requestId: number, reason: string) => {
    const rejectFn = rejectExtension as unknown as (args: {
      data: { requestId: number; resolutionReason: string };
    }) => Promise<{ error?: string }>;
    const result = await rejectFn({ data: { requestId, resolutionReason: reason } });
    if (!result.error) await refreshExtensions();
  };

  if (!assignment) {
    return (
      <EmptyState icon={FileX} title={t('error.notFound')} description={t('error.assignmentNotFound')}>
        <Link to="/instructor/assignments" search={{ page: 1, limit: 20, search: '' }} className="text-primary hover:underline text-sm">
          {t('common.back')}
        </Link>
      </EmptyState>
    );
  }

  const tabs = [
    { id: 'overview', label: t('instructorAssignments.details.overview') },
    { id: 'consultations', label: t('consultations.title'), count: pendingConsultations.length },
    { id: 'extensions', label: t('extensions.queueTitle'), count: extensionRequests.length },
  ];

  return (
    <div className="space-y-6">
      <AssignmentDetailHeader
        title={assignment.title}
        templateType={assignment.templateType}
        description={assignment.description}
      />

      <AssignmentDetailTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'overview' && <AssignmentOverviewTab assignment={assignment} />}

      {activeTab === 'consultations' && (
        <AssignmentConsultationsTab
          assignmentId={assignment.id}
          pendingConsultations={pendingConsultations}
          setPendingConsultations={setPendingConsultations}
          selectedConsultationId={selectedConsultationId}
          setSelectedConsultationId={setSelectedConsultationId}
          dialogOpen={dialogOpen}
          setDialogOpen={setDialogOpen}
        />
      )}

      {activeTab === 'extensions' && (
        <AssignmentExtensionsTab
          requests={extensionRequests}
          loading={extensionsLoading}
          onApprove={handleApproveExtension}
          onReject={handleRejectExtension}
        />
      )}
    </div>
  );
}
