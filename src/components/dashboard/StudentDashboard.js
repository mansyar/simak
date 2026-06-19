import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { useI18n } from '../../routes/__root';
import { Link } from '@tanstack/react-router';
import { Clock, FileText, MessageSquare, ClipboardList } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Progress } from '@/components/ui/progress';
export function StudentDashboard({ data }) {
  const { t } = useI18n();
  if (data?.error) {
    return _jsx('div', {
      className: 'flex items-center justify-center py-12',
      'aria-live': 'polite',
      children: _jsx('p', { className: 'text-destructive', children: t('common.error') }),
    });
  }
  const d = data;
  return _jsxs('div', {
    className: 'grid gap-6 md:grid-cols-2',
    children: [
      _jsxs(Card, {
        className: 'md:col-span-2',
        children: [
          _jsx(CardHeader, {
            children: _jsx(CardTitle, { children: t('studentDashboard.activeAssignments') }),
          }),
          _jsx(CardContent, {
            children:
              d.activeAssignments.length === 0
                ? _jsx(EmptyState, {
                    icon: ClipboardList,
                    title: t('studentDashboard.noActiveAssignments'),
                    description: '',
                    compact: true,
                  })
                : _jsx('div', {
                    className: 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3',
                    children: d.activeAssignments.map((assignment) =>
                      _jsxs(
                        Link,
                        {
                          to: `/student/assignments/${assignment.id}`,
                          className:
                            'block rounded-lg border bg-card p-4 hover:bg-accent/50 transition-colors',
                          children: [
                            _jsxs('div', {
                              className: 'flex items-center justify-between mb-2',
                              children: [
                                _jsx(Badge, {
                                  variant: 'outline',
                                  children: assignment.templateType,
                                }),
                                _jsxs('span', {
                                  className: 'text-xs text-muted-foreground',
                                  children: [assignment.progressPercent ?? 0, '%'],
                                }),
                              ],
                            }),
                            _jsx('h3', {
                              className: 'font-medium text-foreground truncate mb-2',
                              children: assignment.title,
                            }),
                            _jsx(Progress, { value: assignment.progressPercent ?? 0 }),
                          ],
                        },
                        assignment.id,
                      ),
                    ),
                  }),
          }),
        ],
      }),
      _jsxs(Card, {
        children: [
          _jsx(CardHeader, {
            children: _jsx(CardTitle, { children: t('studentDashboard.upcomingDeadlines') }),
          }),
          _jsx(CardContent, {
            children:
              d.upcomingDeadlines.length === 0
                ? _jsx(EmptyState, {
                    icon: Clock,
                    title: t('studentDashboard.noUpcomingDeadlines'),
                    description: '',
                    compact: true,
                  })
                : _jsx('ul', {
                    className: 'space-y-3',
                    children: d.upcomingDeadlines.map((deadline, idx) =>
                      _jsxs(
                        'li',
                        {
                          className: 'flex items-start gap-3',
                          children: [
                            _jsx(Clock, {
                              className: `h-4 w-4 mt-0.5 shrink-0 ${deadline.isOverdue ? 'text-destructive' : 'text-muted-foreground'}`,
                            }),
                            _jsxs('div', {
                              className: 'min-w-0 flex-1',
                              children: [
                                _jsx('p', {
                                  className: 'text-sm font-medium text-foreground truncate',
                                  children: deadline.checkpointName,
                                }),
                                _jsx('p', {
                                  className: 'text-xs text-muted-foreground truncate',
                                  children: deadline.assignmentTitle,
                                }),
                                _jsxs('p', {
                                  className: `text-xs mt-0.5 ${
                                    deadline.isOverdue
                                      ? 'text-destructive font-medium'
                                      : 'text-muted-foreground'
                                  }`,
                                  children: [
                                    deadline.dueDate
                                      ? new Date(deadline.dueDate).toLocaleDateString()
                                      : '',
                                    deadline.isOverdue &&
                                      _jsx(Badge, {
                                        variant: 'destructive',
                                        className: 'ml-1',
                                        children: t('studentDashboard.overdue'),
                                      }),
                                  ],
                                }),
                              ],
                            }),
                          ],
                        },
                        idx,
                      ),
                    ),
                  }),
          }),
        ],
      }),
      _jsxs(Card, {
        children: [
          _jsx(CardHeader, {
            children: _jsx(CardTitle, { children: t('studentDashboard.pendingReviews') }),
          }),
          _jsx(CardContent, {
            children:
              d.pendingReviews.length === 0
                ? _jsx(EmptyState, {
                    icon: FileText,
                    title: t('studentDashboard.noPendingReviews'),
                    description: '',
                    compact: true,
                  })
                : _jsx('ul', {
                    className: 'space-y-3',
                    children: d.pendingReviews.map((review) =>
                      _jsxs(
                        'li',
                        {
                          className: 'flex items-start gap-3',
                          children: [
                            _jsx(FileText, {
                              className: 'h-4 w-4 mt-0.5 shrink-0 text-muted-foreground',
                            }),
                            _jsxs('div', {
                              className: 'min-w-0 flex-1',
                              children: [
                                _jsx('p', {
                                  className: 'text-sm font-medium text-foreground truncate',
                                  children: review.checkpointName,
                                }),
                                _jsx('p', {
                                  className: 'text-xs text-muted-foreground truncate',
                                  children: review.assignmentTitle,
                                }),
                                _jsx('p', {
                                  className: 'text-xs text-muted-foreground mt-0.5',
                                  children: t('studentDashboard.submittedAgo', {
                                    days: String(review.waitTimeDays),
                                  }),
                                }),
                              ],
                            }),
                            _jsx(Badge, {
                              variant: 'warning',
                              children: t('studentDashboard.underReview'),
                            }),
                          ],
                        },
                        review.submissionId,
                      ),
                    ),
                  }),
          }),
        ],
      }),
      _jsxs(Card, {
        children: [
          _jsx(CardHeader, {
            children: _jsx(CardTitle, { children: t('studentDashboard.consultationReminders') }),
          }),
          _jsx(CardContent, {
            children:
              d.consultationReminders.length === 0
                ? _jsx(EmptyState, {
                    icon: MessageSquare,
                    title: t('studentDashboard.noConsultationReminders'),
                    description: '',
                    compact: true,
                  })
                : _jsx('ul', {
                    className: 'space-y-3',
                    children: d.consultationReminders.map((reminder) =>
                      _jsxs(
                        'li',
                        {
                          className: 'flex items-start gap-3',
                          children: [
                            _jsx(MessageSquare, {
                              className: 'h-4 w-4 mt-0.5 shrink-0 text-muted-foreground',
                            }),
                            _jsxs('div', {
                              className: 'min-w-0 flex-1',
                              children: [
                                _jsx('p', {
                                  className: 'text-sm font-medium text-foreground truncate',
                                  children: reminder.checkpointName,
                                }),
                                _jsx('p', {
                                  className: 'text-xs text-muted-foreground truncate',
                                  children: reminder.assignmentTitle,
                                }),
                                _jsx('p', {
                                  className: 'text-xs text-muted-foreground mt-0.5',
                                  children: reminder.consultationDate
                                    ? new Date(reminder.consultationDate).toLocaleDateString()
                                    : '',
                                }),
                              ],
                            }),
                            _jsx(Badge, {
                              variant: 'warning',
                              children: t('studentDashboard.pending'),
                            }),
                          ],
                        },
                        reminder.consultationId,
                      ),
                    ),
                  }),
          }),
        ],
      }),
    ],
  });
}
