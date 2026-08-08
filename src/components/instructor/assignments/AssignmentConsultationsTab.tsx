import { MessageSquare } from 'lucide-react';
import { VerificationQueueItem } from '@/components/consultations/VerificationQueueItem';
import { VerificationDialog } from '@/components/consultations/VerificationDialog';
import { InstructorAppointmentPanel } from '@/components/instructor/assignments/InstructorAppointmentPanel';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { useI18n } from '@/routes/__root';

export interface PendingConsultation {
  id: number;
  studentName: string;
  checkpointName: string;
  sessionType: string | null;
  externalConsultantName: string | null;
  notes: string | null;
  createdAt: string;
}

interface AssignmentConsultationsTabProps {
  assignmentId: number;
  checkpoints: { id: number; name: string }[];
  pendingConsultations: PendingConsultation[];
  selectedConsultationId: number | null;
  setSelectedConsultationId: (id: number | null) => void;
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  pendingPage: number;
  pendingTotal: number;
  onPageChange: (page: number) => void;
  onRefresh: () => Promise<void>;
}

export function AssignmentConsultationsTab({
  assignmentId,
  checkpoints,
  pendingConsultations,
  selectedConsultationId,
  setSelectedConsultationId,
  dialogOpen,
  setDialogOpen,
  pendingPage,
  pendingTotal,
  onPageChange,
  onRefresh,
}: AssignmentConsultationsTabProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <InstructorAppointmentPanel assignmentId={assignmentId} checkpoints={checkpoints} />

      <div className="space-y-4 border-t pt-5">
        <h2 className="text-lg font-semibold text-foreground">
          {t('consultations.pendingVerification')}
        </h2>

        {pendingConsultations.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title={t('consultations.noPendingConsultations')}
            description={t('consultations.noPendingConsultationsDescription')}
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

        <Pagination
          currentPage={pendingPage}
          totalPages={Math.max(1, Math.ceil(pendingTotal / 20))}
          onPageChange={onPageChange}
        />

        <VerificationDialog
          consultationId={selectedConsultationId}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onActionComplete={onRefresh}
        />
      </div>
    </div>
  );
}
