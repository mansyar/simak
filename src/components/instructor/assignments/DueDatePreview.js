import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { useMemo } from 'react';
import { useI18n } from '../../../routes/__root';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Calendar } from 'lucide-react';
export function DueDatePreview({ checkpoints, overrides, onOverride, baseDate }) {
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
  const getEffectiveDate = (order) => {
    const override = overrides.find((o) => o.checkpointOrder === order);
    if (override) {
      return new Date(override.dueDate);
    }
    return calculatedDueDates.find((c) => c.order === order)?.calculatedDate ?? new Date();
  };
  const handleOverride = (order, dateStr) => {
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
  const formatDate = (date) => {
    return date.toISOString().slice(0, 10);
  };
  return _jsxs('div', {
    className: 'space-y-6',
    children: [
      _jsxs('div', {
        className: 'flex flex-col gap-2',
        children: [
          _jsx('h2', {
            className: 'text-xl font-bold tracking-tight text-foreground',
            children: t('instructorAssignments.wizard.stepDueDates'),
          }),
          _jsx('p', {
            className: 'text-sm text-muted-foreground',
            children: t('instructorAssignments.wizard.dueDatesPrompt'),
          }),
        ],
      }),
      _jsx('div', {
        className: 'space-y-3',
        children: calculatedDueDates.map((cp) => {
          const effectiveDate = getEffectiveDate(cp.order);
          const isOverridden = overrides.some((o) => o.checkpointOrder === cp.order);
          return _jsxs(
            Card,
            {
              className: `p-4 border flex items-center gap-4 ${isOverridden ? 'border-primary/40 bg-primary/5' : 'border-border'}`,
              children: [
                _jsx('div', {
                  className:
                    'flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0',
                  children: cp.order,
                }),
                _jsxs('div', {
                  className: 'flex-1 min-w-0',
                  children: [
                    _jsx('p', {
                      className: 'text-sm font-semibold text-foreground truncate',
                      children: cp.name,
                    }),
                    _jsxs('p', {
                      className: 'text-xs text-muted-foreground',
                      children: [
                        cp.estimatedDuration,
                        ' ',
                        t('instructorAssignments.wizard.daysLabel', {
                          count: String(cp.estimatedDuration),
                        }),
                      ],
                    }),
                  ],
                }),
                _jsxs('div', {
                  className: 'flex items-center gap-2',
                  children: [
                    _jsx(Calendar, { className: 'h-4 w-4 text-muted-foreground' }),
                    _jsx(Input, {
                      type: 'date',
                      value: formatDate(effectiveDate),
                      onChange: (e) => handleOverride(cp.order, e.target.value),
                      className: 'w-40 h-9 text-sm',
                      'data-testid': `due-date-input-${cp.order}`,
                      'aria-label': `${t('instructorAssignments.wizard.dueDateFor')} ${cp.name}`,
                    }),
                  ],
                }),
              ],
            },
            cp.order,
          );
        }),
      }),
    ],
  });
}
