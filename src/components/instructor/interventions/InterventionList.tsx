import { ClipboardCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useI18n } from '@/routes/__root';
import type {
  InterventionActionTypeSchema,
  InterventionStatusSchema,
} from '@/server/interventions';
import type { z } from 'zod';

export type InterventionListItem = {
  id: number;
  assignmentId: number;
  studentId: string;
  actionType: z.infer<typeof InterventionActionTypeSchema>;
  privateNote: string | null;
  status: z.infer<typeof InterventionStatusSchema>;
  followUpDate: Date | string | null;
  resolutionReason: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  assignmentTitle?: string | null;
  studentName?: string | null;
};

interface InterventionListProps {
  interventions: InterventionListItem[];
  onManage: (intervention: InterventionListItem) => void;
  now?: Date;
}

const statusVariants: Record<
  InterventionListItem['status'],
  'warning' | 'info' | 'success' | 'secondary'
> = {
  open: 'warning',
  monitoring: 'info',
  resolved: 'success',
  dismissed: 'secondary',
};

function isOverdue(intervention: InterventionListItem, now: Date) {
  return (
    (intervention.status === 'open' || intervention.status === 'monitoring') &&
    intervention.followUpDate !== null &&
    new Date(intervention.followUpDate).getTime() < now.getTime()
  );
}

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

export function InterventionList({
  interventions,
  onManage,
  now = new Date(),
}: InterventionListProps) {
  const { t } = useI18n();
  const actionLabels = {
    consultation: t('instructorInterventions.actions.consultation'),
    extension: t('instructorInterventions.actions.extension'),
    discussion: t('instructorInterventions.actions.discussion'),
    other: t('instructorInterventions.actions.other'),
  };

  if (interventions.length === 0) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title={t('instructorInterventions.empty')}
        description={t('instructorInterventions.emptyDescription')}
      />
    );
  }

  return (
    <div className="space-y-3" role="list" aria-label={t('instructorInterventions.listLabel')}>
      {interventions.map((intervention) => {
        const overdue = isOverdue(intervention, now);
        return (
          <article
            key={intervention.id}
            role="listitem"
            className="rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate font-semibold text-foreground">
                    {intervention.studentName ?? intervention.studentId}
                  </h2>
                  <Badge variant={statusVariants[intervention.status]}>
                    {t(`instructorInterventions.status.${intervention.status}`)}
                  </Badge>
                  {overdue && <Badge variant="error">{t('instructorInterventions.overdue')}</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">
                  {intervention.assignmentTitle ?? intervention.assignmentId}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    {t('instructorInterventions.action')}: {actionLabels[intervention.actionType]}
                  </span>
                  <span>{formatDate(intervention.createdAt)}</span>
                </div>
                {intervention.followUpDate && (
                  <p className="text-xs text-muted-foreground">
                    {t('instructorInterventions.followUp')}: {formatDate(intervention.followUpDate)}
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 shrink-0"
                aria-label={t('instructorInterventions.manage')}
                onClick={() => onManage(intervention)}
              >
                {t('instructorInterventions.manage')}
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
