import { format } from 'date-fns/format';
import { isPast } from 'date-fns/isPast';
import { useNavigate } from '@tanstack/react-router';
import { useI18n } from '../../../routes/__root';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertCircle, Users, ExternalLink } from 'lucide-react';

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
  assignmentId: number;
}

const stateConfig: Record<
  string,
  {
    label: string;
    containerClass: string;
    badgeVariant: 'success' | 'info' | 'warning' | 'destructive' | 'default' | 'outline';
  }
> = {
  passed: {
    label: 'studentAssignments.status.passed',
    containerClass: 'border-l-green-500 bg-green-50 dark:bg-green-950/20',
    badgeVariant: 'success',
  },
  submitted: {
    label: 'studentAssignments.status.submitted',
    containerClass: 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/20',
    badgeVariant: 'info',
  },
  under_review: {
    label: 'studentAssignments.status.under_review',
    containerClass: 'border-l-amber-500 bg-amber-50 dark:bg-amber-950/20',
    badgeVariant: 'warning',
  },
  revise: {
    label: 'studentAssignments.status.revise',
    containerClass: 'border-l-orange-500 bg-orange-50 dark:bg-orange-950/20',
    badgeVariant: 'destructive',
  },
  unlocked: {
    label: 'studentAssignments.status.unlocked',
    containerClass: 'border-l-teal-500 bg-teal-50 dark:bg-teal-950/20',
    badgeVariant: 'default',
  },
  locked: {
    label: 'studentAssignments.status.locked',
    containerClass: 'border-l-gray-400 bg-gray-50 dark:bg-gray-900/20',
    badgeVariant: 'outline',
  },
};

function getTranslatedBlockingReason(
  reason: string,
  t: (key: string, params?: Record<string, string>) => string,
): string {
  if (reason.startsWith('Previous checkpoint not passed')) {
    return t('studentAssignments.blockedByPrevious');
  }
  const consultMatch = reason.match(/Insufficient consultations: (\d+)\/(\d+) verified/);
  if (consultMatch) {
    return t('studentAssignments.blockedByConsultations', {
      current: consultMatch[1],
      required: consultMatch[2],
    });
  }
  return reason;
}

export function CheckpointCard({ checkpoint, assignmentId }: CheckpointCardProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
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
            <Badge variant={config.badgeVariant}>{t(config.label)}</Badge>
            {isOverdue && (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                {t('studentAssignments.status.overdue')}
              </Badge>
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
              {checkpoint.blockingReasons.map((reason, idx) => {
                const translatedReason = getTranslatedBlockingReason(reason, t);
                return (
                  <div
                    key={idx}
                    className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400"
                  >
                    <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>{translatedReason}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Action buttons */}
        {checkpoint.state === 'unlocked' && (
          <Button
            size="sm"
            className="shrink-0"
            onClick={() =>
              navigate({
                to: '/student/assignments/$id/checkpoints/$checkpointId',
                params: { id: String(assignmentId), checkpointId: String(checkpoint.id) },
              })
            }
          >
            {t('studentAssignments.submit')}
          </Button>
        )}
        {checkpoint.state === 'revise' && (
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={() =>
              navigate({
                to: '/student/assignments/$id/checkpoints/$checkpointId',
                params: { id: String(assignmentId), checkpointId: String(checkpoint.id) },
              })
            }
          >
            {t('studentAssignments.resubmit')}
          </Button>
        )}
        {(checkpoint.state === 'submitted' ||
          checkpoint.state === 'under_review' ||
          checkpoint.state === 'passed') && (
          <Button
            variant="link"
            size="sm"
            onClick={() =>
              navigate({
                to: '/student/assignments/$id/checkpoints/$checkpointId',
                params: { id: String(assignmentId), checkpointId: String(checkpoint.id) },
              })
            }
            className="shrink-0"
          >
            <ExternalLink className="h-3 w-3" />
            {t('studentAssignments.viewSubmission')}
          </Button>
        )}
      </div>
    </div>
  );
}
