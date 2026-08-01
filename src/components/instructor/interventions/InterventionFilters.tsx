import type { InterventionStatusSchema } from '@/server/interventions';
import { useI18n } from '@/routes/__root';
import type { z } from 'zod';

type InterventionStatus = z.infer<typeof InterventionStatusSchema>;

interface InterventionFiltersProps {
  status: InterventionStatus | null;
  overdue: boolean;
  onStatusChange: (status: InterventionStatus | null) => void;
  onOverdueChange: (overdue: boolean) => void;
}

export function InterventionFilters({
  status,
  overdue,
  onStatusChange,
  onOverdueChange,
}: InterventionFiltersProps) {
  const { t } = useI18n();

  return (
    <div className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <div className="space-y-2">
        <label htmlFor="intervention-status-filter" className="text-sm font-medium text-foreground">
          {t('instructorInterventions.filters.status')}
        </label>
        <select
          id="intervention-status-filter"
          value={status ?? ''}
          onChange={(event) =>
            onStatusChange((event.target.value || null) as InterventionStatus | null)
          }
          className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label={t('instructorInterventions.filters.status')}
        >
          <option value="">{t('instructorInterventions.filters.allStatuses')}</option>
          <option value="open">{t('instructorInterventions.status.open')}</option>
          <option value="monitoring">{t('instructorInterventions.status.monitoring')}</option>
          <option value="resolved">{t('instructorInterventions.status.resolved')}</option>
          <option value="dismissed">{t('instructorInterventions.status.dismissed')}</option>
        </select>
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-foreground">
        <input
          type="checkbox"
          checked={overdue}
          onChange={(event) => onOverdueChange(event.target.checked)}
          className="size-4 rounded border-input accent-primary focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label={t('instructorInterventions.filters.overdue')}
        />
        {t('instructorInterventions.filters.overdue')}
      </label>
    </div>
  );
}
