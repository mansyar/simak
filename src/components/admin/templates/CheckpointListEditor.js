import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, X, ChevronUp, ChevronDown } from 'lucide-react';
import { useI18n } from '../../../routes/__root';
export function CheckpointListEditor({
  checkpoints,
  onAdd,
  onRemove,
  onChange,
  onMinConsultationsChange,
  onEstimatedDurationChange,
  onMoveUp,
  onMoveDown,
  errors,
}) {
  const { t } = useI18n();
  return _jsxs('div', {
    className: 'space-y-3',
    children: [
      _jsxs('div', {
        className: 'flex items-start gap-2 px-1',
        children: [
          _jsx('div', { className: 'w-[52px] shrink-0' }),
          ' ',
          _jsx('div', {
            className: 'flex-1',
            children: _jsx('span', {
              className: 'text-xs font-medium text-muted-foreground',
              children: t('adminTemplates.form.checkpointName'),
            }),
          }),
          _jsx('div', {
            className: 'w-28',
            children: _jsx('span', {
              className: 'text-xs font-medium text-muted-foreground',
              children: t('adminTemplates.form.minConsultations'),
            }),
          }),
          _jsx('div', {
            className: 'w-24',
            children: _jsx('span', {
              className: 'text-xs font-medium text-muted-foreground',
              children: t('adminTemplates.form.estimatedDuration'),
            }),
          }),
          _jsx('div', { className: 'w-9 shrink-0' }),
          ' ',
        ],
      }),
      _jsx('div', {
        className: 'space-y-2',
        children: checkpoints.map((checkpoint, index) =>
          _jsxs(
            'div',
            {
              className: 'flex items-start gap-2',
              children: [
                _jsxs('div', {
                  className: 'flex flex-col pt-1.5',
                  children: [
                    _jsx('button', {
                      type: 'button',
                      onClick: () => onMoveUp(index),
                      disabled: index === 0,
                      className:
                        'p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed',
                      'aria-label': t('adminTemplates.form.moveUp'),
                      children: _jsx(ChevronUp, { className: 'h-3 w-3' }),
                    }),
                    _jsx('button', {
                      type: 'button',
                      onClick: () => onMoveDown(index),
                      disabled: index === checkpoints.length - 1,
                      className:
                        'p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed',
                      'aria-label': t('adminTemplates.form.moveDown'),
                      children: _jsx(ChevronDown, { className: 'h-3 w-3' }),
                    }),
                  ],
                }),
                _jsxs('div', {
                  className: 'flex-1 space-y-1',
                  children: [
                    _jsx(Input, {
                      value: checkpoint.name,
                      onChange: (e) => onChange(index, e.target.value),
                      placeholder: t('adminTemplates.form.checkpointName'),
                      'data-testid': `checkpoint-input-${index}`,
                    }),
                    errors?.[index] &&
                      _jsx('p', {
                        className: 'text-sm text-destructive mt-1',
                        children: errors[index],
                      }),
                  ],
                }),
                _jsxs('div', {
                  className: 'w-28 space-y-1',
                  children: [
                    _jsx(Input, {
                      type: 'number',
                      min: 0,
                      value: checkpoint.minConsultations,
                      onChange: (e) =>
                        onMinConsultationsChange(index, Math.max(0, Number(e.target.value))),
                      placeholder: t('adminTemplates.form.minConsPlaceholder'),
                      'data-testid': `checkpoint-min-cons-${index}`,
                      'aria-label': t('adminTemplates.form.minConsultations'),
                    }),
                    _jsx('p', {
                      className: 'text-[10px] leading-tight text-muted-foreground',
                      children: t('adminTemplates.form.minConsHint'),
                    }),
                  ],
                }),
                _jsxs('div', {
                  className: 'w-24 space-y-1',
                  children: [
                    _jsx(Input, {
                      type: 'number',
                      min: 0,
                      value: checkpoint.estimatedDuration ?? 7,
                      onChange: (e) =>
                        onEstimatedDurationChange(index, Math.max(0, Number(e.target.value))),
                      placeholder: t('adminTemplates.form.durationPlaceholder'),
                      'data-testid': `checkpoint-duration-${index}`,
                      'aria-label': t('adminTemplates.form.estimatedDuration'),
                    }),
                    _jsx('p', {
                      className: 'text-[10px] leading-tight text-muted-foreground',
                      children: t('adminTemplates.form.durationHint'),
                    }),
                  ],
                }),
                _jsx(Button, {
                  type: 'button',
                  variant: 'ghost',
                  size: 'icon',
                  onClick: () => onRemove(index),
                  disabled: checkpoints.length <= 1,
                  className: 'mt-1',
                  'aria-label': t('adminTemplates.form.removeCheckpoint'),
                  children: _jsx(X, { className: 'h-4 w-4' }),
                }),
              ],
            },
            index,
          ),
        ),
      }),
      _jsxs(Button, {
        type: 'button',
        variant: 'outline',
        size: 'sm',
        onClick: onAdd,
        className: 'w-full',
        children: [
          _jsx(Plus, { className: 'mr-2 h-4 w-4' }),
          t('adminTemplates.form.addCheckpoint'),
        ],
      }),
    ],
  });
}
