import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { useI18n } from '../../../routes/__root';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TemplateTypeBadge } from '@/components/ui/template-type-badge';
import { format } from 'date-fns/format';
import { BookOpen, Clipboard, Calendar, Users } from 'lucide-react';
export function ReviewStep({
  title,
  description,
  finalDeadline,
  assignedStudents,
  selectedTemplate,
  error,
}) {
  const { t } = useI18n();
  return _jsxs('div', {
    className: 'space-y-6',
    children: [
      _jsxs('div', {
        className: 'flex flex-col gap-2',
        children: [
          _jsx('h2', {
            className: 'text-xl font-bold tracking-tight text-foreground',
            children: t('instructorAssignments.wizard.stepConfirm'),
          }),
          _jsx('p', {
            className: 'text-sm text-muted-foreground',
            children: t('instructorAssignments.wizard.reviewPrompt'),
          }),
        ],
      }),
      error &&
        _jsx('div', {
          className:
            'p-4 rounded-lg bg-destructive/10 text-destructive text-sm font-semibold border border-destructive/20',
          'aria-live': 'polite',
          children: error,
        }),
      _jsxs('div', {
        className: 'grid gap-6 md:grid-cols-3',
        children: [
          _jsxs('div', {
            className: 'md:col-span-2 space-y-4',
            children: [
              _jsxs(Card, {
                className: 'p-5 border-border bg-card shadow-sm space-y-4',
                children: [
                  _jsxs('div', {
                    className: 'flex items-start gap-3',
                    children: [
                      _jsx(BookOpen, { className: 'h-5 w-5 text-primary mt-0.5' }),
                      _jsxs('div', {
                        children: [
                          _jsx('h4', {
                            className:
                              'text-xs font-bold text-muted-foreground uppercase tracking-wider',
                            children: t('instructorAssignments.wizard.titleLabel'),
                          }),
                          _jsx('p', {
                            className: 'text-lg font-bold text-foreground mt-0.5',
                            children: title,
                          }),
                        ],
                      }),
                    ],
                  }),
                  description &&
                    _jsxs('div', {
                      className: 'border-t pt-3 flex items-start gap-3',
                      children: [
                        _jsx(Clipboard, { className: 'h-5 w-5 text-primary mt-0.5' }),
                        _jsxs('div', {
                          className: 'min-w-0 flex-1',
                          children: [
                            _jsx('h4', {
                              className:
                                'text-xs font-bold text-muted-foreground uppercase tracking-wider',
                              children: t('instructorAssignments.details.description'),
                            }),
                            _jsx('p', {
                              className:
                                'text-sm text-muted-foreground mt-1 whitespace-pre-line leading-relaxed',
                              children: description,
                            }),
                          ],
                        }),
                      ],
                    }),
                  _jsxs('div', {
                    className: 'border-t pt-3 flex items-start gap-3',
                    children: [
                      _jsx(Calendar, { className: 'h-5 w-5 text-primary mt-0.5' }),
                      _jsxs('div', {
                        children: [
                          _jsx('h4', {
                            className:
                              'text-xs font-bold text-muted-foreground uppercase tracking-wider',
                            children: t('instructorAssignments.details.deadline'),
                          }),
                          _jsx('p', {
                            className: 'text-sm font-bold text-foreground mt-0.5',
                            children: format(new Date(finalDeadline), 'MMMM d, yyyy h:mm a'),
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              _jsxs(Card, {
                className: 'p-5 border-border bg-card shadow-sm space-y-3',
                children: [
                  _jsxs('div', {
                    className: 'flex items-center justify-between border-b pb-2',
                    children: [
                      _jsxs('h3', {
                        className:
                          'text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5',
                        children: [
                          _jsx(Users, { className: 'h-4 w-4 text-primary' }),
                          t('instructorAssignments.assignedCohort'),
                        ],
                      }),
                      _jsx(Badge, {
                        variant: 'secondary',
                        className: 'font-bold',
                        children: t('instructorAssignments.studentsCount', {
                          count: String(assignedStudents.length),
                        }),
                      }),
                    ],
                  }),
                  _jsx('div', {
                    className: 'grid gap-2 sm:grid-cols-2 max-h-[160px] overflow-y-auto pr-1',
                    children: assignedStudents.map((student) =>
                      _jsxs(
                        'div',
                        {
                          className:
                            'flex items-center gap-2 p-2 rounded-lg border bg-accent/20 text-xs',
                          children: [
                            _jsx('div', {
                              className:
                                'h-6 w-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center',
                              children: student.name[0].toUpperCase(),
                            }),
                            _jsxs('div', {
                              className: 'min-w-0 flex-1',
                              children: [
                                _jsx('p', {
                                  className: 'font-semibold text-foreground truncate',
                                  children: student.name,
                                }),
                                _jsx('p', {
                                  className: 'text-[10px] text-muted-foreground truncate',
                                  children: student.email,
                                }),
                              ],
                            }),
                          ],
                        },
                        student.id,
                      ),
                    ),
                  }),
                ],
              }),
            ],
          }),
          _jsx('div', {
            className: 'space-y-4',
            children: _jsxs(Card, {
              className: 'p-5 border-primary/20 bg-gradient-to-br from-card to-accent/10 space-y-4',
              children: [
                _jsxs('div', {
                  children: [
                    _jsx('h4', {
                      className: 'text-xs font-bold text-muted-foreground uppercase tracking-wider',
                      children: t('instructorAssignments.selectedRoadmap'),
                    }),
                    _jsx('p', {
                      className: 'text-base font-bold text-primary mt-1',
                      children: selectedTemplate.name,
                    }),
                    _jsx(TemplateTypeBadge, { type: selectedTemplate.type, className: 'mt-1.5' }),
                  ],
                }),
                _jsxs('div', {
                  className: 'border-t pt-3 space-y-3',
                  children: [
                    _jsx('h5', {
                      className: 'text-xs font-bold text-muted-foreground uppercase tracking-wider',
                      children: t('instructorAssignments.milestonesSequence'),
                    }),
                    _jsx('div', {
                      className:
                        'relative pl-4 space-y-3.5 before:absolute before:left-1.5 before:top-1.5 before:bottom-1.5 before:w-0.5 before:bg-primary/20',
                      children: selectedTemplate.checkpoints.map((cp, idx) =>
                        _jsxs(
                          'div',
                          {
                            className: 'relative flex items-center gap-2 text-xs',
                            children: [
                              _jsx('div', {
                                className: `absolute -left-4 flex h-3 w-3 items-center justify-center rounded-full border text-[8px] font-bold ${
                                  idx === 0
                                    ? 'bg-primary border-primary text-primary-foreground'
                                    : 'bg-background border-muted-foreground/30 text-muted-foreground'
                                }`,
                                children: idx + 1,
                              }),
                              _jsx('span', {
                                className: `font-semibold ${idx === 0 ? 'text-primary' : 'text-foreground'}`,
                                children: cp,
                              }),
                            ],
                          },
                          idx,
                        ),
                      ),
                    }),
                  ],
                }),
              ],
            }),
          }),
        ],
      }),
    ],
  });
}
