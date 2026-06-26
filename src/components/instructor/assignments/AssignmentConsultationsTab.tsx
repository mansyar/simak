import { MessageSquare } from 'lucide-react';
import { VerificationQueueItem } from '@/components/consultations/VerificationQueueItem';
import { VerificationDialog } from '@/components/consultations/VerificationDialog';
import { EmptyState } from '@/components/ui/empty-state';
import { listPendingConsultations } from '@/server/consultations';
import { isServerError } from '@/lib/errors';
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
  pendingConsultations: PendingConsultation[];
  setPendingConsultations: (consultations: PendingConsultation[]) => void;
  selectedConsultationId: number | null;
  setSelectedConsultationId: (id: number | null) => void;
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
}

export function AssignmentConsultationsTab({
  assignmentId,
  pendingConsultations,
  setPendingConsultations,
  selectedConsultationId,
  setSelectedConsultationId,
  dialogOpen,
  setDialogOpen,
}: AssignmentConsultationsTabProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
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

      <VerificationDialog
        consultationId={selectedConsultationId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onActionComplete={async () => {
          const result = await listPendingConsultations({ data: { assignmentId } });
          if (!isServerError(result) && result.consultations) {
            setPendingConsultations(result.consultations);
          }
        }}
      />
    </div>
  );
}
