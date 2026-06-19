import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { useI18n } from '../../routes/__root';
import { Link } from '@tanstack/react-router';
import {
  Users,
  ClipboardList,
  ClipboardCheck,
  MessageSquare,
  Bell,
  AlertTriangle,
  UserPlus,
  FileType,
  Mail,
  MailCheck,
  MailX,
  Clock,
} from 'lucide-react';
import { MetricCard } from '@/components/ui/metric-card';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusDot } from '@/components/ui/status-dot';
function getActivityDotColor(type) {
  if (type.includes('created') || type.includes('passed') || type.includes('verified')) {
    return 'verified';
  }
  return 'inactive';
}
export function AdminDashboard({ data }) {
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
    className: 'space-y-6',
    children: [
      _jsxs('div', {
        className: 'grid gap-5 sm:grid-cols-2 lg:grid-cols-3',
        children: [
          _jsx(MetricCard, {
            label: t('adminDashboard.totalUsers'),
            value: d.metrics?.totalUsers ?? 0,
            icon: Users,
            color: 'primary',
          }),
          _jsx(MetricCard, {
            label: t('adminDashboard.instructors'),
            value: d.metrics?.instructors ?? 0,
            icon: Users,
            color: 'warning',
          }),
          _jsx(MetricCard, {
            label: t('adminDashboard.students'),
            value: d.metrics?.students ?? 0,
            icon: Users,
            color: 'success',
          }),
          _jsx(MetricCard, {
            label: t('adminDashboard.activeAssignments'),
            value: d.metrics?.activeAssignments ?? 0,
            icon: ClipboardList,
            color: 'info',
          }),
          _jsx(MetricCard, {
            label: t('adminDashboard.pendingReviews'),
            value: d.metrics?.pendingReviews ?? 0,
            icon: ClipboardCheck,
            color: 'primary',
          }),
          _jsx(MetricCard, {
            label: t('adminDashboard.activeConsultations'),
            value: d.metrics?.activeConsultations ?? 0,
            icon: MessageSquare,
            color: 'success',
          }),
        ],
      }),
      _jsxs('div', {
        className: 'grid gap-6 md:grid-cols-2',
        children: [
          _jsxs(Card, {
            children: [
              _jsx(CardHeader, {
                children: _jsx(CardTitle, { children: t('adminDashboard.emailQueue.title') }),
              }),
              _jsx(CardContent, {
                children: _jsxs('div', {
                  className: 'grid gap-4 sm:grid-cols-3',
                  children: [
                    _jsxs('div', {
                      className: 'rounded-lg bg-card p-5 text-center',
                      children: [
                        _jsx('div', {
                          className:
                            'mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary',
                          children: _jsx(Mail, { className: 'size-5' }),
                        }),
                        _jsx('div', {
                          className:
                            'font-display text-[1.75rem] font-bold leading-none text-foreground',
                          children: d.emailQueueCounts?.pending ?? 0,
                        }),
                        _jsx('p', {
                          className: 'mt-1 text-[0.8125rem] font-medium text-primary',
                          children: t('adminDashboard.emailQueue.pending'),
                        }),
                      ],
                    }),
                    _jsxs('div', {
                      className: 'rounded-lg bg-card p-5 text-center',
                      children: [
                        _jsx('div', {
                          className:
                            'mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-success/10 text-success',
                          children: _jsx(MailCheck, { className: 'size-5' }),
                        }),
                        _jsx('div', {
                          className:
                            'font-display text-[1.75rem] font-bold leading-none text-foreground',
                          children: d.emailQueueCounts?.sent ?? 0,
                        }),
                        _jsx('p', {
                          className: 'mt-1 text-[0.8125rem] font-medium text-success',
                          children: t('adminDashboard.emailQueue.sent'),
                        }),
                      ],
                    }),
                    _jsxs('div', {
                      className: 'rounded-lg bg-card p-5 text-center',
                      children: [
                        _jsx('div', {
                          className:
                            'mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-error/10 text-error',
                          children: _jsx(MailX, { className: 'size-5' }),
                        }),
                        _jsx('div', {
                          className:
                            'font-display text-[1.75rem] font-bold leading-none text-foreground',
                          children: d.emailQueueCounts?.failed ?? 0,
                        }),
                        _jsx('p', {
                          className: 'mt-1 text-[0.8125rem] font-medium text-error',
                          children: t('adminDashboard.emailQueue.failed'),
                        }),
                      ],
                    }),
                  ],
                }),
              }),
            ],
          }),
          _jsxs(Card, {
            children: [
              _jsx(CardHeader, {
                children: _jsx(CardTitle, { children: t('adminDashboard.escalationAlerts') }),
              }),
              _jsx(CardContent, {
                children:
                  d.escalationAlerts.length === 0
                    ? _jsx(EmptyState, {
                        icon: Clock,
                        title: t('adminDashboard.noEscalationAlerts'),
                        description: 'All assignments are on track',
                      })
                    : _jsx('ul', {
                        className: 'space-y-3',
                        children: d.escalationAlerts.map((alert) =>
                          _jsxs(
                            'li',
                            {
                              className: `flex items-start gap-4 rounded-lg p-4 ${
                                alert.daysOverdue > 3
                                  ? 'bg-error/5 border border-error/20'
                                  : 'bg-muted/30 border border-border'
                              }`,
                              children: [
                                _jsx('div', {
                                  className:
                                    'flex size-9 shrink-0 items-center justify-center rounded-full bg-error text-white',
                                  children: _jsx(AlertTriangle, { className: 'size-[18px]' }),
                                }),
                                _jsxs('div', {
                                  className: 'min-w-0 flex-1',
                                  children: [
                                    _jsx('p', {
                                      className: 'text-sm font-semibold text-foreground truncate',
                                      children: alert.instructorName,
                                    }),
                                    _jsxs('p', {
                                      className: 'text-xs text-muted-foreground truncate',
                                      children: [
                                        alert.assignmentTitle,
                                        ' \u2014 ',
                                        alert.checkpointName,
                                      ],
                                    }),
                                    _jsxs('p', {
                                      className: 'text-xs text-muted-foreground truncate',
                                      children: [
                                        t('adminDashboard.student'),
                                        ': ',
                                        alert.studentName,
                                      ],
                                    }),
                                    _jsxs('p', {
                                      className: `text-xs mt-0.5 ${alert.daysOverdue > 3 ? 'text-error font-medium' : 'text-muted-foreground'}`,
                                      children: [
                                        alert.daysOverdue,
                                        ' ',
                                        t('adminDashboard.daysOverdue'),
                                      ],
                                    }),
                                  ],
                                }),
                              ],
                            },
                            alert.submissionId,
                          ),
                        ),
                      }),
              }),
            ],
          }),
        ],
      }),
      _jsxs('div', {
        className: 'grid gap-6 md:grid-cols-2',
        children: [
          _jsxs(Card, {
            children: [
              _jsx(CardHeader, {
                children: _jsx(CardTitle, { children: t('adminDashboard.recentActivity') }),
              }),
              _jsx(CardContent, {
                children:
                  d.recentActivity.length === 0
                    ? _jsx(EmptyState, {
                        icon: Bell,
                        title: t('adminDashboard.noRecentActivity'),
                        description: 'No recent activity to display',
                      })
                    : _jsx('ul', {
                        className: 'space-y-3',
                        children: d.recentActivity.map((event) =>
                          _jsxs(
                            'li',
                            {
                              className:
                                'flex items-start gap-3 border-b border-border/50 pb-3 last:border-b-0 last:pb-0',
                              children: [
                                _jsx(StatusDot, {
                                  variant: getActivityDotColor(event.type),
                                  className: 'mt-[6px]',
                                }),
                                _jsxs('div', {
                                  className: 'min-w-0 flex-1',
                                  children: [
                                    _jsx('p', {
                                      className: 'text-sm text-foreground',
                                      children: event.title,
                                    }),
                                    event.message &&
                                      _jsx('p', {
                                        className: 'text-xs text-muted-foreground truncate',
                                        children: event.message,
                                      }),
                                    _jsx('p', {
                                      className: 'text-[10px] text-muted-foreground mt-0.5',
                                      children: event.createdAt
                                        ? new Date(event.createdAt).toLocaleDateString()
                                        : '',
                                    }),
                                  ],
                                }),
                              ],
                            },
                            event.id,
                          ),
                        ),
                      }),
              }),
            ],
          }),
          _jsxs(Card, {
            children: [
              _jsx(CardHeader, {
                children: _jsx(CardTitle, { children: t('adminDashboard.quickActions') }),
              }),
              _jsx(CardContent, {
                children: _jsxs('div', {
                  className: 'flex flex-col gap-3',
                  children: [
                    _jsxs(Link, {
                      to: '/admin/users',
                      className:
                        'flex items-center gap-3 rounded-lg border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary hover:shadow-md',
                      children: [
                        _jsx('div', {
                          className:
                            'flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary',
                          children: _jsx(UserPlus, { className: 'size-[18px]' }),
                        }),
                        _jsxs('div', {
                          children: [
                            _jsx('p', {
                              className: 'text-sm font-medium text-foreground',
                              children: t('adminDashboard.manageUsers'),
                            }),
                            _jsx('p', {
                              className: 'text-xs text-muted-foreground',
                              children: t('adminDashboard.manageUsersDesc'),
                            }),
                          ],
                        }),
                      ],
                    }),
                    _jsxs(Link, {
                      to: '/admin/templates',
                      className:
                        'flex items-center gap-3 rounded-lg border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary hover:shadow-md',
                      children: [
                        _jsx('div', {
                          className:
                            'flex size-9 items-center justify-center rounded-md bg-success/10 text-success',
                          children: _jsx(FileType, { className: 'size-[18px]' }),
                        }),
                        _jsxs('div', {
                          children: [
                            _jsx('p', {
                              className: 'text-sm font-medium text-foreground',
                              children: t('adminDashboard.manageTemplates'),
                            }),
                            _jsx('p', {
                              className: 'text-xs text-muted-foreground',
                              children: t('adminDashboard.manageTemplatesDesc'),
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
      }),
    ],
  });
}
