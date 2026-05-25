import { useI18n } from '../../routes/__root';

interface CheckpointProgress {
  checkpointId: number;
  checkpointName: string;
  verifiedCount: number;
  minConsultations: number;
}

interface ConsultationProgressProps {
  counts: CheckpointProgress[];
}

export function ConsultationProgress({ counts }: ConsultationProgressProps) {
  const { t } = useI18n();

  const totalRequired = counts.reduce((sum, c) => sum + c.minConsultations, 0);
  const totalVerified = counts.reduce((sum, c) => sum + c.verifiedCount, 0);

  if (totalRequired === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Assignment-level summary */}
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <h4 className="text-sm font-semibold text-foreground mb-2">
          {t('consultations.consultationProgress')}
        </h4>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{
                width: `${Math.min(100, (totalVerified / Math.max(1, totalRequired)) * 100)}%`,
              }}
            />
          </div>
          <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
            {totalVerified}/{totalRequired} {t('consultations.verified')}
          </span>
        </div>
      </div>

      {/* Per-checkpoint breakdown */}
      {counts.map((cp) => {
        if (cp.minConsultations === 0) return null;

        const progress = cp.minConsultations > 0
          ? Math.min(100, (cp.verifiedCount / cp.minConsultations) * 100)
          : 0;
        const barColor = cp.verifiedCount >= cp.minConsultations
          ? 'bg-green-500'
          : cp.verifiedCount > 0
            ? 'bg-yellow-500'
            : 'bg-gray-300 dark:bg-gray-600';

        return (
          <div key={cp.checkpointId} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-foreground font-medium">{cp.checkpointName}</span>
              <span className="text-muted-foreground">
                {cp.verifiedCount}/{cp.minConsultations} {t('consultations.verified')}
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
