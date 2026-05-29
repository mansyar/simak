import { useMemo } from 'react';
import { useI18n } from '../../../routes/__root';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Calendar } from 'lucide-react';

interface CheckpointInfo {
  name: string;
  order: number;
  estimatedDuration: number;
}

interface DueDateOverride {
  checkpointOrder: number;
  dueDate: string; // ISO date string (YYYY-MM-DD)
}

interface DueDatePreviewProps {
  checkpoints: CheckpointInfo[];
  overrides: DueDateOverride[];
  onOverride: (overrides: DueDateOverride[]) => void;
  baseDate?: Date;
}

export function DueDatePreview({
  checkpoints,
  overrides,
  onOverride,
  baseDate,
}: DueDatePreviewProps) {
  const { t } = useI18n();

  const calculatedDueDates = useMemo(() => {
    const start = baseDate ?? new Date();
    let cumulative = 0;
    return checkpoints.map((cp) => {
      cumulative += cp.estimatedDuration;
      const date = new Date(start);
      date.setDate(date.getDate() + cumulative);
      return { ...cp, calculatedDate: date };
    });
  }, [checkpoints, baseDate]);

  const getEffectiveDate = (order: number): Date => {
    const override = overrides.find((o) => o.checkpointOrder === order);
    if (override) {
      return new Date(override.dueDate + 'T00:00:00');
    }
    return calculatedDueDates.find((c) => c.order === order)?.calculatedDate ?? new Date();
  };

  const handleOverride = (order: number, dateStr: string) => {
    const existing = overrides.filter((o) => o.checkpointOrder !== order);
    if (dateStr) {
      // Store as ISO date string for Zod coerce support
      existing.push({
        checkpointOrder: order,
        dueDate: new Date(dateStr + 'T12:00:00').toISOString(),
      });
    }
    onOverride(existing);
  };

  const formatDate = (date: Date): string => {
    return date.toISOString().slice(0, 10);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          {t('instructorAssignments.wizard.stepDueDates')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('instructorAssignments.wizard.dueDatesPrompt')}
        </p>
      </div>

      <div className="space-y-3">
        {calculatedDueDates.map((cp) => {
          const effectiveDate = getEffectiveDate(cp.order);
          const isOverridden = overrides.some((o) => o.checkpointOrder === cp.order);
          return (
            <Card
              key={cp.order}
              className={`p-4 border flex items-center gap-4 ${isOverridden ? 'border-primary/40 bg-primary/5' : 'border-border'}`}
            >
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0">
                {cp.order}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{cp.name}</p>
                <p className="text-xs text-muted-foreground">
                  {cp.estimatedDuration}{' '}
                  {t('instructorAssignments.wizard.daysLabel', {
                    count: String(cp.estimatedDuration),
                  })}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={formatDate(effectiveDate)}
                  onChange={(e) => handleOverride(cp.order, e.target.value)}
                  className="w-40 h-9 text-sm"
                  data-testid={`due-date-input-${cp.order}`}
                  aria-label={`${t('instructorAssignments.wizard.dueDateFor')} ${cp.name}`}
                />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
