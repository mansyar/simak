import type { InterventionStatusSchema } from '@/server/interventions';
import { useI18n } from '@/routes/__root';
import type { z } from 'zod';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
        <Label htmlFor="intervention-status-filter">
          {t('instructorInterventions.filters.status')}
        </Label>
        <Select
          value={status ?? 'all'}
          onValueChange={(value) =>
            onStatusChange(value === 'all' ? null : (value as InterventionStatus))
          }
        >
          <SelectTrigger
            id="intervention-status-filter"
            aria-label={t('instructorInterventions.filters.status')}
          >
            <SelectValue>
              {status
                ? t(`instructorInterventions.status.${status}`)
                : t('instructorInterventions.filters.allStatuses')}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('instructorInterventions.filters.allStatuses')}</SelectItem>
            <SelectItem value="open">{t('instructorInterventions.status.open')}</SelectItem>
            <SelectItem value="monitoring">
              {t('instructorInterventions.status.monitoring')}
            </SelectItem>
            <SelectItem value="resolved">{t('instructorInterventions.status.resolved')}</SelectItem>
            <SelectItem value="dismissed">
              {t('instructorInterventions.status.dismissed')}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Label className="flex min-h-11 items-center gap-3 text-sm font-medium text-foreground">
        <Checkbox
          checked={overdue}
          onCheckedChange={(checked) => onOverdueChange(checked === true)}
        />
        {t('instructorInterventions.filters.overdue')}
      </Label>
    </div>
  );
}
