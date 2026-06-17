import { useI18n } from '../../../routes/__root';
import { CheckpointCard } from './CheckpointCard';
import type { CheckpointData } from './CheckpointCard';

interface CheckpointTimelineProps {
  checkpoints: CheckpointData[];
  assignmentId: number;
}

export function CheckpointTimeline({ checkpoints, assignmentId }: CheckpointTimelineProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <h3 className="font-display text-2xl text-foreground">{t('studentAssignments.timeline')}</h3>
      <div className="space-y-3">
        {checkpoints.map((checkpoint, index) => (
          <div key={checkpoint.id} className="relative pl-6">
            {/* Vertical connector line */}
            {index < checkpoints.length - 1 && (
              <div className="absolute left-[7px] top-4 bottom-0 w-0.5 bg-border" />
            )}
            {/* Dot */}
            <div className="absolute left-0 top-2 h-3.5 w-3.5 rounded-full border-2 border-primary bg-background" />
            <CheckpointCard checkpoint={checkpoint} assignmentId={assignmentId} />
          </div>
        ))}
      </div>
    </div>
  );
}
