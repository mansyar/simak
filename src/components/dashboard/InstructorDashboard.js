import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { useI18n } from '../../routes/__root';
import { Link } from '@tanstack/react-router';
import { ClipboardList, ClipboardCheck, FileText, ArrowRight, Users, BookOpen } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { MetricCard } from '@/components/ui/metric-card';
import { SLABadge } from '@/components/reviews/SLABadge';
function getStatusBadgeVariant(status) {
  switch (status) {
    case 'Submitted':
      return 'info';
    case 'Under Review':
      return 'warning';
    case 'Pass':
      return 'success';
    default:
      return 'warning';
  }
}
function getStatusBadgeText(status, t) {
  switch (status) {
    case 'Submitted':
      return t('studentAssignments.status.submitted');
    case 'Under Review':
      return t('studentAssignments.status.under_review');
    case 'Pass':
      return t('studentAssignments.status.passed');
    default:
      return t('studentAssignments.status.revise');
  }
}
export function InstructorDashboard({ data }) {
  const { t } = useI18n();
  if (data?.error) {
    return _jsx('div', {
      className: 'flex items-center justify-center py-12',
      'aria-live': 'polite',
      children: _jsx('p', { className: 'text-destructive', children: t('common.error') }),
    });
  }
  const d = data;
  const totalStudents = d.assignments.reduce((sum, a) => sum + a.studentCount, 0);
  return _jsxs('div', {
    className: 'space-y-6',
    children: [
      _jsxs('div', {
        className: 'grid gap-4 sm:grid-cols-3',
        children: [
          _jsx(MetricCard, {
            label: t('instructorDashboard.pendingReviews'),
            value: d.pendingReviewCount,
            icon: ClipboardCheck,
            color: 'warning',
          }),
          _jsx(MetricCard, {
            label: t('instructorDashboard.activeAssignments'),
            value: d.assignments.length,
            icon: BookOpen,
            color: 'primary',
          }),
          _jsx(MetricCard, {
            label: t('instructorDashboard.totalStudents'),
            value: totalStudents,
            icon: Users,
            color: 'info',
          }),
        ],
      }),
      _jsxs(Card, {
        children: [
          _jsx(CardHeader, {
            children: _jsxs(CardTitle, {
              children: [t('instructorDashboard.pendingReviews'), ' (', d.pendingReviewCount, ')'],
            }),
          }),
          _jsx(CardContent, {
            children:
              d.pendingReviewItems.length === 0
                ? _jsx(EmptyState, {
                    icon: ClipboardCheck,
                    title: t('instructorDashboard.noPendingReviews'),
                    description: '',
                  })
                : _jsxs('div', {
                    className: 'space-y-2',
                    children: [
                      d.pendingReviewItems
                        .slice(0, 10)
                        .map((item) =>
                          _jsxs(
                            Link,
                            {
                              to: '/instructor/reviews/' + item.submissionId,
                              className:
                                'flex items-center justify-between rounded-lg border p-3 hover:bg-accent/50 transition-colors',
                              children: [
                                _jsxs('div', {
                                  className: 'min-w-0 flex-1',
                                  children: [
                                    _jsx('p', {
                                      className: 'text-sm font-medium text-foreground truncate',
                                      children: item.studentName,
                                    }),
                                    _jsxs('p', {
                                      className: 'text-xs text-muted-foreground truncate',
                                      children: [
                                        item.assignmentTitle,
                                        ' \u2014 ',
                                        item.checkpointName,
                                      ],
                                    }),
                                  ],
                                }),
                                _jsxs('div', {
                                  className: 'flex items-center gap-2 shrink-0 ml-2',
                                  children: [
                                    _jsx(SLABadge, {
                                      state: 'under_review',
                                      updatedAt: new Date(item.submittedAt),
                                    }),
                                    _jsx(ArrowRight, {
                                      className: 'h-4 w-4 text-muted-foreground',
                                    }),
                                  ],
                                }),
                              ],
                            },
                            item.submissionId,
                          ),
                        ),
                      d.pendingReviewItems.length > 10 &&
                        _jsx(Link, {
                          to: '/instructor/reviews',
                          className: 'block text-center text-sm text-primary hover:underline py-2',
                          children: t('common.viewAll'),
                        }),
                    ],
                  }),
          }),
        ],
      }),
      _jsxs('div', {
        className: 'grid gap-6 md:grid-cols-2',
        children: [
          _jsxs(Card, {
            children: [
              _jsx(CardHeader, {
                children: _jsx(CardTitle, { children: t('instructorDashboard.recentSubmissions') }),
              }),
              _jsx(CardContent, {
                children:
                  d.recentSubmissions.length === 0
                    ? _jsx(EmptyState, {
                        icon: FileText,
                        title: t('instructorDashboard.noRecentSubmissions'),
                        description: '',
                      })
                    : _jsx('ul', {
                        className: 'space-y-3',
                        children: d.recentSubmissions.map((sub) =>
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
                                      children: sub.studentName,
                                    }),
                                    _jsxs('p', {
                                      className: 'text-xs text-muted-foreground truncate',
                                      children: [
                                        sub.assignmentTitle,
                                        ' \u2014 ',
                                        sub.checkpointName,
                                      ],
                                    }),
                                  ],
                                }),
                                _jsx(Badge, {
                                  variant: getStatusBadgeVariant(sub.status),
                                  children: getStatusBadgeText(sub.status, t),
                                }),
                              ],
                            },
                            sub.submissionId,
                          ),
                        ),
                      }),
              }),
            ],
          }),
          _jsxs(Card, {
            children: [
              _jsx(CardHeader, {
                children: _jsx(CardTitle, {
                  children: t('instructorDashboard.assignmentOverview'),
                }),
              }),
              _jsx(CardContent, {
                children:
                  d.assignments.length === 0
                    ? _jsx(EmptyState, {
                        icon: ClipboardList,
                        title: t('instructorDashboard.noAssignments'),
                        description: '',
                      })
                    : _jsx('div', {
                        className: 'space-y-3',
                        children: d.assignments.slice(0, 5).map((assignment) =>
                          _jsxs(
                            Link,
                            {
                              to: `/instructor/assignments/${assignment.id}`,
                              className:
                                'block rounded-lg border p-3 hover:bg-accent/50 transition-colors',
                              children: [
                                _jsxs('div', {
                                  className: 'flex items-center justify-between mb-1',
                                  children: [
                                    _jsx('h3', {
                                      className: 'text-sm font-medium text-foreground truncate',
                                      children: assignment.title,
                                    }),
                                    _jsxs('span', {
                                      className: 'text-xs text-muted-foreground',
                                      children: [assignment.overallProgressPercent, '%'],
                                    }),
                                  ],
                                }),
                                _jsxs('div', {
                                  className:
                                    'flex items-center gap-3 text-xs text-muted-foreground',
                                  children: [
                                    _jsxs('span', {
                                      className: 'flex items-center gap-1',
                                      children: [
                                        _jsx(Users, { className: 'h-3 w-3' }),
                                        assignment.studentCount,
                                      ],
                                    }),
                                    _jsxs('span', {
                                      className: 'flex items-center gap-1',
                                      children: [
                                        _jsx(ClipboardCheck, { className: 'h-3 w-3' }),
                                        t('instructorDashboard.pendingCount', {
                                          count: String(assignment.pendingReviewCount),
                                        }),
                                      ],
                                    }),
                                  ],
                                }),
                                _jsx('div', {
                                  className:
                                    'w-full bg-secondary rounded-full h-1.5 mt-2 overflow-hidden',
                                  children: _jsx('div', {
                                    className: 'bg-primary h-full rounded-full transition-all',
                                    style: { width: `${assignment.overallProgressPercent}%` },
                                  }),
                                }),
                              ],
                            },
                            assignment.id,
                          ),
                        ),
                      }),
              }),
            ],
          }),
        ],
      }),
      _jsxs(Card, {
        children: [
          _jsx(CardHeader, {
            children: _jsx(CardTitle, { children: t('instructorDashboard.quickActions') }),
          }),
          _jsx(CardContent, {
            children: _jsxs('div', {
              className: 'grid gap-3 sm:grid-cols-2',
              children: [
                _jsxs(Link, {
                  to: '/instructor/reviews',
                  className:
                    'flex items-center gap-3 rounded-lg border p-4 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200',
                  children: [
                    _jsx('div', {
                      className:
                        'flex size-11 items-center justify-center rounded-md bg-primary/10',
                      children: _jsx(ClipboardCheck, { className: 'h-5 w-5 text-primary' }),
                    }),
                    _jsxs('div', {
                      children: [
                        _jsx('p', {
                          className: 'text-sm font-medium text-foreground',
                          children: t('instructorDashboard.goToReviewQueue'),
                        }),
                        _jsx('p', {
                          className: 'text-xs text-muted-foreground',
                          children: t('instructorDashboard.reviewQueueDesc'),
                        }),
                      ],
                    }),
                  ],
                }),
                _jsxs(Link, {
                  to: '/instructor/assignments',
                  className:
                    'flex items-center gap-3 rounded-lg border p-4 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200',
                  children: [
                    _jsx('div', {
                      className:
                        'flex size-11 items-center justify-center rounded-md bg-success/10',
                      children: _jsx(ClipboardList, { className: 'h-5 w-5 text-success' }),
                    }),
                    _jsxs('div', {
                      children: [
                        _jsx('p', {
                          className: 'text-sm font-medium text-foreground',
                          children: t('instructorDashboard.manageAssignments'),
                        }),
                        _jsx('p', {
                          className: 'text-xs text-muted-foreground',
                          children: t('instructorDashboard.manageAssignmentsDesc'),
                        }),
                      ],
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
