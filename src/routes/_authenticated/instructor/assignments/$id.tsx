import { useState, useEffect } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { getAssignmentDetail } from '@/server/assignments';
import { listPendingConsultations } from '@/server/consultations';
import { listExtensionRequests, approveExtension, rejectExtension } from '@/server/extensions';
import { ProgressTable } from '@/components/instructor/assignments/ProgressTable';
import type { StudentProgress } from '@/components/instructor/assignments/ProgressTable';
import { DeadlineManager } from '@/components/reviews/DeadlineManager';
import { VerificationQueueItem } from '@/components/consultations/VerificationQueueItem';
import { VerificationDialog } from '@/components/consultations/VerificationDialog';
import { PendingExtensionsSection } from '@/components/instructor/extensions/PendingExtensionsSection';
import type { ExtensionRequestItem } from '@/components/instructor/extensions/PendingExtensionsSection';
import {
  Calendar,
  Users,
  Clipboard,
  ArrowLeft,
  Percent,
  CheckCircle2,
  MessageSquare,
} from 'lucide-react';
import { format } from 'date-fns/format';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
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
  interface PendingConsultation {
    id: number;
    studentName: string;
    checkpointName: string;
    sessionType: string | null;
    externalConsultantName: string | null;
    notes: string | null;
    createdAt: string;
  }
  const [pendingConsultations, setPendingConsultations] = useState<PendingConsultation[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'consultations' | 'extensions'>(
    'overview',
  );
  const [selectedConsultationId, setSelectedConsultationId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [extensionRequests, setExtensionRequests] = useState<ExtensionRequestItem[]>([]);
  const [extensionsLoading, setExtensionsLoading] = useState(false);

  // Load pending consultations and extension requests
  useEffect(() => {
    if (assignment) {
      const listPendingFn = listPendingConsultations as unknown as (args: {
        data: { assignmentId: number };
      }) => Promise<{ consultations: PendingConsultation[] }>;
      const listExtensionsFn = listExtensionRequests as unknown as (args: {
        data: { assignmentId: number; status: string; page: number; limit: number };
      }) => Promise<{ items: ExtensionRequestItem[] }>;
      const load = async () => {
        const [consultResult, extResult] = await Promise.all([
          listPendingFn({ data: { assignmentId: assignment.id } }),
          listExtensionsFn({
            data: { assignmentId: assignment.id, status: 'pending', page: 1, limit: 50 },
          }),
        ]);
        if (consultResult.consultations) {
          setPendingConsultations(consultResult.consultations);
        }
        if ('items' in extResult) {
          setExtensionRequests(extResult.items);
        }
        setExtensionsLoading(false);
      };
      setExtensionsLoading(true);
      load();
    }
  }, [assignment]);

  // Handle extension approval
  const handleApproveExtension = async (requestId: number, comment?: string) => {
    const approveFn = approveExtension as unknown as (args: {
      data: { requestId: number; resolutionReason?: string };
    }) => Promise<{ error?: string }>;
    const result = await approveFn({
      data: { requestId, resolutionReason: comment },
    });
    if (result.error) return;
    // Refresh list
    const listExtensionsFn = listExtensionRequests as unknown as (args: {
      data: { assignmentId: number; status: string; page: number; limit: number };
    }) => Promise<{ items: ExtensionRequestItem[] }>;
    const extResult = await listExtensionsFn({
      data: { assignmentId: assignment!.id, status: 'pending', page: 1, limit: 50 },
    });
    if ('items' in extResult) {
      setExtensionRequests(extResult.items);
    }
  };

  // Handle extension rejection
  const handleRejectExtension = async (requestId: number, reason: string) => {
    const rejectFn = rejectExtension as unknown as (args: {
      data: { requestId: number; resolutionReason: string };
    }) => Promise<{ error?: string }>;
    const result = await rejectFn({
      data: { requestId, resolutionReason: reason },
    });
    if (result.error) return;
    // Refresh list
    const listExtensionsFn = listExtensionRequests as unknown as (args: {
      data: { assignmentId: number; status: string; page: number; limit: number };
    }) => Promise<{ items: ExtensionRequestItem[] }>;
    const extResult = await listExtensionsFn({
      data: { assignmentId: assignment!.id, status: 'pending', page: 1, limit: 50 },
    });
    if ('items' in extResult) {
      setExtensionRequests(extResult.items);
    }
  };

  if (!assignment) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <h2 className="text-xl font-semibold mb-2">{t('error.notFound')}</h2>
        <p className="text-muted-foreground mb-4">
          This assignment could not be found or you do not have permission to view it.
        </p>
        <Link
          to="/instructor/assignments"
          search={{ page: 1, limit: 20, search: '' }}
          className="text-primary hover:underline"
        >
          {t('common.back')}
        </Link>
      </div>
    );
  }

  // Calculate statistics
  const totalStudents = assignment.students.length;
  const avgProgress =
    totalStudents > 0
      ? Math.round(
          assignment.students.reduce(
            (sum: number, s: StudentProgress) => sum + s.progressPercent,
            0,
          ) / totalStudents,
        )
      : 0;
  const completedStudents = assignment.students.filter(
    (s: StudentProgress) => s.progressPercent === 100,
  ).length;

  return (
    <div className="space-y-6">
      {/* Header and Back Link */}
      <div className="flex flex-col gap-4">
        <div>
          <Link
            to="/instructor/assignments"
            search={{ page: 1, limit: 20, search: '' }}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('common.back')}
          </Link>
        </div>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-wider uppercase text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {assignment.templateType}
              </span>
            </div>
            <h1 className="font-display text-4xl text-foreground mt-2">{assignment.title}</h1>
            {assignment.description && (
              <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
                {assignment.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative overflow-hidden rounded-md border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t('instructorAssignments.details.studentsProgress')}
              </p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{totalStudents}</h3>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-md border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
              <Percent className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t('instructorAssignments.averageProgress')}
              </p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{avgProgress}%</h3>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-md border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-emerald-500/10 p-2.5 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Completed Cohort
              </p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                {completedStudents} / {totalStudents}
              </h3>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-md border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t('instructorAssignments.details.deadline')}
              </p>
              <h3 className="text-sm font-bold text-foreground mt-1.5">
                {format(new Date(assignment.finalDeadline), 'MMM d, yyyy')}
              </h3>
            </div>
          </div>
        </div>
      </div>

      {/* Details Meta Block */}
      <Card>
        <div className="p-5 space-y-4">
          <h3 className="text-base font-semibold text-foreground border-b pb-2">
            {t('instructorAssignments.details.overview')}
          </h3>
          <div className="grid gap-4 sm:grid-cols-3 text-sm">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                {t('instructorAssignments.details.template')}
              </span>
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Clipboard className="h-4 w-4 text-primary/60" />
                {assignment.templateName}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                {t('instructorAssignments.details.type')}
              </span>
              <div className="font-medium text-foreground">{assignment.templateType}</div>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                {t('instructorAssignments.details.created')}
              </span>
              <div className="font-medium text-foreground">
                {format(new Date(assignment.createdAt), 'MMM d, yyyy HH:mm')}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Progress Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-foreground">
            {t('instructorAssignments.details.studentsProgress')}
          </h2>
        </div>
        <ProgressTable students={assignment.students} />
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-border">
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('instructorAssignments.details.overview')}
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
            {pendingConsultations.length > 0 && (
              <Badge variant="default" className="ml-1.5">
                {pendingConsultations.length}
              </Badge>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('extensions')}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'extensions'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('extensions.queueTitle')}
            {extensionRequests.length > 0 && (
              <Badge variant="default" className="ml-1.5">
                {extensionRequests.length}
              </Badge>
            )}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <>
          {/* Deadline Manager */}
          <DeadlineManager
            students={
              assignment.students as unknown as {
                id: string;
                name: string;
                email: string;
                progressPercent: number;
                passedCount: number;
                totalCheckpointsCount: number;
                activeCheckpoint: { id: number; name: string; state: string } | null;
                checkpoints: {
                  id: number;
                  name: string;
                  order: number;
                  state: 'locked' | 'unlocked' | 'submitted' | 'under_review' | 'passed' | 'revise';
                  studentId: string;
                  dueDate: Date | null;
                  minConsultations: number | null;
                }[];
              }[]
            }
            assignmentId={assignment.id}
          />
        </>
      )}

      {activeTab === 'consultations' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            {t('consultations.pendingVerification')}
          </h2>

          {pendingConsultations.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title={t('consultations.noPendingConsultations')}
              description={t('consultations.noPendingConsultations')}
            />
          ) : (
            <div className="space-y-3">
              {pendingConsultations.map((item: PendingConsultation) => (
                <VerificationQueueItem
                  key={item.id}
                  consultation={item}
                  onClick={(id) => {
                    setSelectedConsultationId(id);
                    setDialogOpen(true);
                  }}
                />
              ))}
            </div>
          )}

          <VerificationDialog
            consultationId={selectedConsultationId}
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            onActionComplete={async () => {
              // Refresh pending queue
              const listPendingFn = listPendingConsultations as unknown as (args: {
                data: { assignmentId: number };
              }) => Promise<{ consultations: PendingConsultation[] }>;
              const result = await listPendingFn({
                data: { assignmentId: assignment.id },
              });
              if (result.consultations) {
                setPendingConsultations(result.consultations);
              }
            }}
          />
        </div>
      )}

      {activeTab === 'extensions' && (
        <PendingExtensionsSection
          requests={extensionRequests}
          loading={extensionsLoading}
          onApprove={handleApproveExtension}
          onReject={handleRejectExtension}
        />
      )}
    </div>
  );
}
