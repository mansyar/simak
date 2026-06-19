import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { Link } from '@tanstack/react-router';
import { Calendar, Users, Clipboard } from 'lucide-react';
import { format } from 'date-fns/format';
import { useI18n } from '../../../routes/__root';
import { Card, CardContent } from '@/components/ui/card';
import { TemplateTypeBadge } from '@/components/ui/template-type-badge';
export function AssignmentCard({ assignment }) {
  const { t } = useI18n();
  return _jsxs(Card, {
    className:
      'group relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-primary/30',
    children: [
      _jsx('div', {
        className:
          'absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-violet-500 opacity-80',
      }),
      _jsxs(CardContent, {
        className: 'flex flex-col justify-between pt-4',
        children: [
          _jsxs('div', {
            className: 'space-y-3',
            children: [
              _jsx('div', {
                className: 'flex items-start justify-between gap-2',
                children: _jsxs('div', {
                  children: [
                    _jsx(TemplateTypeBadge, { type: assignment.templateType }),
                    _jsx('h3', {
                      className:
                        'mt-1.5 text-lg font-semibold text-foreground leading-snug group-hover:text-primary transition-colors',
                      children: assignment.title,
                    }),
                  ],
                }),
              }),
              assignment.description &&
                _jsx('p', {
                  className: 'text-sm text-muted-foreground line-clamp-2',
                  children: assignment.description,
                }),
              _jsx('div', {
                className:
                  'flex items-center gap-2 text-xs text-muted-foreground border-t pt-3 mt-3',
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
          _jsxs('div', {
            className:
              'mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground',
            children: [
              _jsxs('div', {
                className: 'flex items-center gap-4',
                children: [
                  _jsxs('div', {
                    className: 'flex items-center gap-1',
                    children: [
                      _jsx(Users, { className: 'h-3.5 w-3.5 text-muted-foreground' }),
                      _jsx('span', {
                        className: 'font-medium text-foreground',
                        children: t('instructorAssignments.studentCount', {
                          count: String(assignment.studentCount),
                        }),
                      }),
                    ],
                  }),
                  _jsxs('div', {
                    className: 'flex items-center gap-1',
                    children: [
                      _jsx(Calendar, { className: 'h-3.5 w-3.5 text-muted-foreground' }),
                      _jsx('span', {
                        children: t('instructorAssignments.finalDeadline', {
                          date: format(new Date(assignment.finalDeadline), 'MMM d, yyyy'),
                        }),
                      }),
                    ],
                  }),
                ],
              }),
              _jsxs(Link, {
                to: `/instructor/assignments/${assignment.id}`,
                className:
                  'inline-flex items-center justify-center rounded-md text-xs font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:bg-accent hover:text-accent-foreground px-2.5 py-1.5 text-primary',
                children: [t('common.viewAll'), ' \u2192'],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}
