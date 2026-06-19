import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { useI18n } from '../../../routes/__root';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
export function AssignmentDetailsForm({
  title,
  onChangeTitle,
  description,
  onChangeDescription,
  finalDeadline,
  onChangeDeadline,
  errors,
}) {
  const { t } = useI18n();
  // Get current date+time formatted as YYYY-MM-DDTHH:MM for min value
  const minDateTime = (() => {
    const now = new Date();
    // Add 1 hour just to be safe
    now.setHours(now.getHours() + 1);
    const tzoffset = now.getTimezoneOffset() * 60000; //offset in milliseconds
    const localISOTime = new Date(now.getTime() - tzoffset).toISOString().slice(0, 16);
    return localISOTime;
  })();
  return _jsxs('div', {
    className: 'space-y-6',
    children: [
      _jsxs('div', {
        className: 'flex flex-col gap-2',
        children: [
          _jsx('h2', {
            className: 'text-xl font-bold tracking-tight text-foreground',
            children: t('instructorAssignments.wizard.stepDetails'),
          }),
          _jsx('p', {
            className: 'text-sm text-muted-foreground',
            children: t('instructorAssignments.wizard.fillDetailsPrompt'),
          }),
        ],
      }),
      _jsxs(Card, {
        className: 'p-6 border-border bg-card shadow-sm space-y-5',
        children: [
          _jsxs('div', {
            className: 'space-y-2',
            children: [
              _jsxs(Label, {
                htmlFor: 'assignment-title',
                className: 'text-sm font-semibold text-foreground',
                children: [
                  t('instructorAssignments.wizard.titleLabel'),
                  ' ',
                  _jsx('span', { className: 'text-destructive', children: '*' }),
                ],
              }),
              _jsx(Input, {
                id: 'assignment-title',
                placeholder: t('instructorAssignments.wizard.titlePlaceholder'),
                value: title,
                onChange: (e) => onChangeTitle(e.target.value),
                className: `h-11 ${errors.title ? 'border-destructive focus-visible:ring-destructive' : ''}`,
              }),
              errors.title &&
                _jsx('p', {
                  className: 'text-xs font-semibold text-destructive mt-1 animate-slide-down',
                  children: errors.title,
                }),
            ],
          }),
          _jsxs('div', {
            className: 'space-y-2',
            children: [
              _jsx(Label, {
                htmlFor: 'assignment-desc',
                className: 'text-sm font-semibold text-foreground',
                children: t('instructorAssignments.wizard.descriptionLabel'),
              }),
              _jsx(Textarea, {
                id: 'assignment-desc',
                placeholder: t('instructorAssignments.wizard.descriptionPlaceholder'),
                value: description,
                onChange: (e) => onChangeDescription(e.target.value),
                rows: 5,
                className: `resize-y ${errors.description ? 'border-destructive focus-visible:ring-destructive' : ''}`,
                'aria-invalid': !!errors.description || undefined,
              }),
              errors.description &&
                _jsx('p', {
                  className: 'text-xs font-semibold text-destructive mt-1',
                  children: errors.description,
                }),
            ],
          }),
          _jsxs('div', {
            className: 'space-y-2',
            children: [
              _jsxs(Label, {
                htmlFor: 'assignment-deadline',
                className: 'text-sm font-semibold text-foreground',
                children: [
                  t('instructorAssignments.wizard.deadlineLabel'),
                  ' ',
                  _jsx('span', { className: 'text-destructive', children: '*' }),
                ],
              }),
              _jsx(Input, {
                id: 'assignment-deadline',
                type: 'datetime-local',
                min: minDateTime,
                value: finalDeadline,
                onChange: (e) => onChangeDeadline(e.target.value),
                className: `h-11 ${errors.finalDeadline ? 'border-destructive focus-visible:ring-destructive' : ''}`,
              }),
              errors.finalDeadline &&
                _jsx('p', {
                  className: 'text-xs font-semibold text-destructive mt-1 animate-slide-down',
                  children: errors.finalDeadline,
                }),
            ],
          }),
        ],
      }),
    ],
  });
}
