interface PendingConsultation {
  id: number;
  studentName: string;
  checkpointName: string;
  sessionType: string | null;
  externalConsultantName: string | null;
  notes: string | null;
  createdAt: string;
}

interface VerificationQueueItemProps {
  consultation: PendingConsultation;
  onClick: (id: number) => void;
}

export function VerificationQueueItem({ consultation, onClick }: VerificationQueueItemProps) {
  const notesPreview = consultation.notes
    ? consultation.notes.length > 80
      ? consultation.notes.slice(0, 80) + '...'
      : consultation.notes
    : '-';

  return (
    <button
      type="button"
      onClick={() => onClick(consultation.id)}
      className="w-full text-left rounded-lg border bg-card p-4 shadow-sm hover:bg-accent/50 transition-colors space-y-2"
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm text-foreground">
          {consultation.studentName}
        </span>
        <span className="text-xs text-muted-foreground">
          {new Date(consultation.createdAt).toLocaleDateString()}
        </span>
      </div>
      <div className="text-xs text-muted-foreground">
        {consultation.checkpointName}
        {' · '}
        {consultation.sessionType === 'external' && consultation.externalConsultantName
          ? `External: ${consultation.externalConsultantName}`
          : 'Internal'}
      </div>
      <p className="text-sm text-muted-foreground line-clamp-1">{notesPreview}</p>
    </button>
  );
}
