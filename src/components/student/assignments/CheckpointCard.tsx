import { format, isPast } from 'date-fns';
import { useI18n } from '../../../routes/__root';
import { Button } from '@/components/ui/button';
import { Clock, AlertCircle, Users } from 'lucide-react';

export interface CheckpointData {
  id: number;
  name: string;
  order: number;
  state: 'locked' | 'unlocked' | 'submitted' | 'under_review' | 'passed' | 'revise';
  dueDate: Date | null;
  minConsultations: number | null;
  verifiedConsultationCount: number;
  blockingReasons?: string[];
}

interface CheckpointCardProps {
  checkpoint: CheckpointData;
}

const stateConfig: Record<string, { label: string; containerClass: string; badgeClass: string }> = {
  passed: {
    label: 'studentAssignments.status.passed',
    containerClass: 'border-l-green-500 bg-green-50 dark:bg-green-950/20',
    badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  },
  submitted: {
    label: 'studentAssignments.status.submitted',
    containerClass: 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/20',
    badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  },
  under_review: {
    label: 'studentAssignments.status.under_review',
    containerClass: 'border-l-amber-500 bg-amber-50 dark:bg-amber-950/20',
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  },
  revise: {
    label: 'studentAssignments.status.revise',
    containerClass: 'border-l-orange-500 bg-orange-50 dark:bg-orange-950/20',
    badgeClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  },
  unlocked: {
    label: 'studentAssignments.status.unlocked',
    containerClass: 'border-l-teal-500 bg-teal-50 dark:bg-teal-950/20',
    badgeClass: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300',
  },
  locked: {
    label: 'studentAssignments.status.locked',
    containerClass: 'border-l-gray-400 bg-gray-50 dark:bg-gray-900/20',
    badgeClass: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  },
};

export function CheckpointCard({ checkpoint }: CheckpointCardProps) {
  const { t } = useI18n();
  const config = stateConfig[checkpoint.state] ?? stateConfig.locked;
  const isOverdue =
    checkpoint.dueDate && isPast(new Date(checkpoint.dueDate)) && checkpoint.state !== 'passed';
  const minConsults = checkpoint.minConsultations ?? 0;
  const isSatisfied = minConsults === 0 || checkpoint.verifiedConsultationCount >= minConsults;

  return (
    <div className={`relative rounded-lg border-l-4 p-4 shadow-sm ${config.containerClass}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-foreground">{checkpoint.name}</h4>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${config.badgeClass}`}
            >
              {t(config.label)}
            </span>
            {isOverdue && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 dark:text-red-400">
                <AlertCircle className="h-3 w-3" />
                {t('studentAssignments.status.overdue')}
              </span>
            )}
          </div>

          {/* Due date */}
          {checkpoint.dueDate && (
            <div
              className={`mt-1.5 flex items-center gap-1 text-xs ${isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-muted-foreground'}`}
            >
              <Clock className="h-3 w-3" />
              <span>{format(new Date(checkpoint.dueDate), 'MMM d, yyyy')}</span>
            </div>
          )}

          {/* Consultation progress */}
          {minConsults > 0 && (
            <div
              className={`mt-1.5 flex items-center gap-1 text-xs ${isSatisfied ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}
            >
              <Users className="h-3 w-3" />
              <span>
                {t('studentAssignments.consultations', {
                  current: String(checkpoint.verifiedConsultationCount),
                  required: String(minConsults),
                })}
              </span>
            </div>
          )}

          {/* Blocking reasons */}
          {checkpoint.blockingReasons && checkpoint.blockingReasons.length > 0 && (
            <div className="mt-2 space-y-1">
              {checkpoint.blockingReasons.map((reason, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400"
                >
                  <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>{reason}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action button */}
        {checkpoint.state === 'unlocked' && (
          <Button size="sm" className="shrink-0">
            {t('studentAssignments.submit')}
          </Button>
        )}
      </div>
    </div>
  );
}
