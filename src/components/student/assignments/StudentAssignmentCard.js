import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { Link } from '@tanstack/react-router';
import { Calendar, Clipboard } from 'lucide-react';
import { format } from 'date-fns/format';
import { useI18n } from '../../../routes/__root';
import { Progress } from '../../ui/progress';
import { Badge } from '../../ui/badge';
export function StudentAssignmentCard({ assignment }) {
  const { t } = useI18n();
  return _jsxs('div', {
    className:
      'group relative flex flex-col justify-between overflow-hidden rounded-xl border bg-card p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-primary/30',
    children: [
      _jsxs('div', {
        children: [
          _jsx('div', {
            className: 'flex items-start justify-between gap-2',
            children: _jsxs('div', {
              children: [
                _jsx(Badge, { variant: 'outline', children: assignment.templateType }),
                _jsx('h3', {
                  className:
                    'mt-1.5 text-lg font-semibold text-foreground leading-snug group-hover:text-primary transition-colors',
                  children: assignment.title,
                }),
              ],
            }),
          }),
          _jsx('div', {
            className: 'flex items-center gap-2 text-xs text-muted-foreground mt-3',
            children: _jsxs('div', {
              className: 'flex items-center gap-1.5',
              children: [
                _jsx(Clipboard, { className: 'h-3.5 w-3.5 text-primary/60' }),
                _jsx('span', {
                  className: 'font-medium text-foreground',
                  children: assignment.templateName,
                }),
              ],
            }),
          }),
        ],
      }),
      _jsx('div', {
        className: 'mt-4',
        children: _jsx(Progress, {
          value: assignment.progressPercent,
          label: t('studentAssignments.progress'),
          showValue: true,
        }),
      }),
      _jsxs('div', {
        className:
          'mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground',
        children: [
          _jsxs('div', {
            className: 'flex items-center gap-1',
            children: [
              _jsx(Calendar, { className: 'h-3.5 w-3.5 text-muted-foreground' }),
              _jsx('span', {
                children: t('studentAssignments.finalDeadline', {
                  date: format(new Date(assignment.finalDeadline), 'MMM d, yyyy'),
                }),
              }),
            ],
          }),
          _jsxs(Link, {
            to: `/student/assignments/${assignment.id}`,
            className:
              'inline-flex items-center justify-center rounded-md text-xs font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:bg-accent hover:text-accent-foreground px-2.5 py-1.5 text-primary',
            children: [t('common.viewAll'), ' \u2192'],
          }),
        ],
      }),
    ],
  });
}
