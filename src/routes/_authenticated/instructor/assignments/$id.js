import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from 'react/jsx-runtime';
import { useState, useEffect } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { getAssignmentDetail } from '@/server/assignments';
import { listPendingConsultations } from '@/server/consultations';
import { listExtensionRequests, approveExtension, rejectExtension } from '@/server/extensions';
import { ProgressTable } from '@/components/instructor/assignments/ProgressTable';
import { DeadlineManager } from '@/components/reviews/DeadlineManager';
import { VerificationQueueItem } from '@/components/consultations/VerificationQueueItem';
import { VerificationDialog } from '@/components/consultations/VerificationDialog';
import { PendingExtensionsSection } from '@/components/instructor/extensions/PendingExtensionsSection';
import { Calendar, Users, Clipboard, Percent, CheckCircle2, MessageSquare } from 'lucide-react';
import { format } from 'date-fns/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricCard } from '@/components/ui/metric-card';
import { TemplateTypeBadge } from '@/components/ui/template-type-badge';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { useI18n } from '../../../__root';
export const Route = createFileRoute('/_authenticated/instructor/assignments/$id')({
  loader: async ({ params }) => {
    // @ts-expect-error - handler type inference limitation
    return getAssignmentDetail({ data: { id: Number(params.id) } });
  },
  component: AssignmentDetailPage,
});
function AssignmentDetailPage() {
  const { t } = useI18n();
  const assignment = Route.useLoaderData();
  const [pendingConsultations, setPendingConsultations] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedConsultationId, setSelectedConsultationId] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [extensionRequests, setExtensionRequests] = useState([]);
  const [extensionsLoading, setExtensionsLoading] = useState(false);
  // Load pending consultations and extension requests
  useEffect(() => {
    if (assignment) {
      const listPendingFn = listPendingConsultations;
      const listExtensionsFn = listExtensionRequests;
      const load = async () => {
        const [consultResult, extResult] = await Promise.all([
          listPendingFn({ data: { assignmentId: assignment.id } }),
          listExtensionsFn({
            data: { assignmentId: assignment.id, status: 'pending', page: 1, limit: 50 },
          }),
        ]);
        if (consultResult.consultations) {
          setPendingConsultations(consultResult.consultations);
        }
        if ('items' in extResult) {
          setExtensionRequests(extResult.items);
        }
        setExtensionsLoading(false);
      };
      setExtensionsLoading(true);
      load();
    }
  }, [assignment]);
  // Handle extension approval
  const handleApproveExtension = async (requestId, comment) => {
    const approveFn = approveExtension;
    const result = await approveFn({
      data: { requestId, resolutionReason: comment },
    });
    if (result.error) return;
    // Refresh list
    const listExtensionsFn = listExtensionRequests;
    const extResult = await listExtensionsFn({
      data: { assignmentId: assignment.id, status: 'pending', page: 1, limit: 50 },
    });
    if ('items' in extResult) {
      setExtensionRequests(extResult.items);
    }
  };
  // Handle extension rejection
  const handleRejectExtension = async (requestId, reason) => {
    const rejectFn = rejectExtension;
    const result = await rejectFn({
      data: { requestId, resolutionReason: reason },
    });
    if (result.error) return;
    // Refresh list
    const listExtensionsFn = listExtensionRequests;
    const extResult = await listExtensionsFn({
      data: { assignmentId: assignment.id, status: 'pending', page: 1, limit: 50 },
    });
    if ('items' in extResult) {
      setExtensionRequests(extResult.items);
    }
  };
  if (!assignment) {
    return _jsxs('div', {
      className: 'flex flex-col items-center justify-center py-12 text-center',
      children: [
        _jsx('h2', { className: 'text-xl font-semibold mb-2', children: t('error.notFound') }),
        _jsx('p', {
          className: 'text-muted-foreground mb-4',
          children: t('error.assignmentNotFound'),
        }),
        _jsx(Link, {
          to: '/instructor/assignments',
          search: { page: 1, limit: 20, search: '' },
          className: 'text-primary hover:underline',
          children: t('common.back'),
        }),
      ],
    });
  }
  // Calculate statistics
  const totalStudents = assignment.students.length;
  const avgProgress =
    totalStudents > 0
      ? Math.round(
          assignment.students.reduce((sum, s) => sum + s.progressPercent, 0) / totalStudents,
        )
      : 0;
  const completedStudents = assignment.students.filter((s) => s.progressPercent === 100).length;
  return _jsxs('div', {
    className: 'space-y-6',
    children: [
      _jsx(PageHeader, {
        title: assignment.title,
        back: {
          to: '/instructor/assignments',
          label: t('common.back'),
          search: { page: 1, limit: 20, search: '' },
        },
      }),
      _jsx('div', {
        className: 'flex flex-col md:flex-row md:items-start md:justify-between gap-4',
        children: _jsxs('div', {
          children: [
            _jsx('div', {
              className: 'flex items-center gap-2',
              children: _jsx(TemplateTypeBadge, { type: assignment.templateType }),
            }),
            assignment.description &&
              _jsx('p', {
                className: 'text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed',
                children: assignment.description,
              }),
          ],
        }),
      }),
      _jsxs('div', {
        className: 'grid gap-4 sm:grid-cols-2 lg:grid-cols-4',
        children: [
          _jsx(MetricCard, {
            label: t('instructorAssignments.details.totalStudents'),
            value: totalStudents,
            icon: Users,
            color: 'primary',
          }),
          _jsx(MetricCard, {
            label: t('instructorAssignments.averageProgress'),
            value: `${avgProgress}%`,
            icon: Percent,
            color: 'info',
          }),
          _jsx(MetricCard, {
            label: t('instructorAssignments.completedCohort'),
            value: `${completedStudents} / ${totalStudents}`,
            icon: CheckCircle2,
            color: 'success',
          }),
          _jsx(MetricCard, {
            label: t('instructorAssignments.details.deadline'),
            value: format(new Date(assignment.finalDeadline), 'MMM d, yyyy'),
            icon: Calendar,
            color: 'warning',
          }),
        ],
      }),
      _jsxs(Card, {
        children: [
          _jsx(CardHeader, {
            children: _jsx(CardTitle, { children: t('instructorAssignments.details.overview') }),
          }),
          _jsx(CardContent, {
            children: _jsxs('div', {
              className: 'grid gap-4 sm:grid-cols-3 text-sm',
              children: [
                _jsxs('div', {
                  className: 'space-y-1',
                  children: [
                    _jsx('span', {
                      className:
                        'text-xs text-muted-foreground font-medium uppercase tracking-wider',
                      children: t('instructorAssignments.details.template'),
                    }),
                    _jsxs('div', {
                      className: 'flex items-center gap-2 font-medium text-foreground',
                      children: [
                        _jsx(Clipboard, { className: 'h-4 w-4 text-primary/60' }),
                        assignment.templateName,
                      ],
                    }),
                  ],
                }),
                _jsxs('div', {
                  className: 'space-y-1',
                  children: [
                    _jsx('span', {
                      className:
                        'text-xs text-muted-foreground font-medium uppercase tracking-wider',
                      children: t('instructorAssignments.details.type'),
                    }),
                    _jsx('div', {
                      className: 'font-medium text-foreground',
                      children: assignment.templateType,
                    }),
                  ],
                }),
                _jsxs('div', {
                  className: 'space-y-1',
                  children: [
                    _jsx('span', {
                      className:
                        'text-xs text-muted-foreground font-medium uppercase tracking-wider',
                      children: t('instructorAssignments.details.created'),
                    }),
                    _jsx('div', {
                      className: 'font-medium text-foreground',
                      children: format(new Date(assignment.createdAt), 'MMM d, yyyy HH:mm'),
                    }),
                  ],
                }),
              ],
            }),
          }),
        ],
      }),
      _jsxs('div', {
        className: 'space-y-3',
        children: [
          _jsx('div', {
            className: 'flex items-center justify-between',
            children: _jsx('h2', {
              className: 'font-display text-2xl text-foreground',
              children: t('instructorAssignments.details.studentsProgress'),
            }),
          }),
          _jsx(ProgressTable, { students: assignment.students }),
        ],
      }),
      _jsx('div', {
        className: 'border-b border-border',
        children: _jsxs('div', {
          className: 'flex gap-4',
          children: [
            _jsx('button', {
              type: 'button',
              onClick: () => setActiveTab('overview'),
              className: `pb-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'overview'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`,
              children: t('instructorAssignments.details.overview'),
            }),
            _jsxs('button', {
              type: 'button',
              onClick: () => setActiveTab('consultations'),
              className: `pb-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'consultations'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`,
              children: [
                t('consultations.title'),
                pendingConsultations.length > 0 &&
                  _jsx(Badge, {
                    variant: 'default',
                    className: 'ml-1.5',
                    children: pendingConsultations.length,
                  }),
              ],
            }),
            _jsxs('button', {
              type: 'button',
              onClick: () => setActiveTab('extensions'),
              className: `pb-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'extensions'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`,
              children: [
                t('extensions.queueTitle'),
                extensionRequests.length > 0 &&
                  _jsx(Badge, {
                    variant: 'default',
                    className: 'ml-1.5',
                    children: extensionRequests.length,
                  }),
              ],
            }),
          ],
        }),
      }),
      activeTab === 'overview' &&
        _jsx(_Fragment, {
          children: _jsx(DeadlineManager, {
            students: assignment.students,
            assignmentId: assignment.id,
          }),
        }),
      activeTab === 'consultations' &&
        _jsxs('div', {
          className: 'space-y-4',
          children: [
            _jsx('h2', {
              className: 'text-lg font-semibold text-foreground',
              children: t('consultations.pendingVerification'),
            }),
            pendingConsultations.length === 0
              ? _jsx(EmptyState, {
                  icon: MessageSquare,
                  title: t('consultations.noPendingConsultations'),
                  description: t('consultations.noPendingConsultations'),
                })
              : _jsx('div', {
                  className: 'space-y-3',
                  children: pendingConsultations.map((item) =>
                    _jsx(
                      VerificationQueueItem,
                      {
                        consultation: item,
                        onClick: (id) => {
                          setSelectedConsultationId(id);
                          setDialogOpen(true);
                        },
                      },
                      item.id,
                    ),
                  ),
                }),
            _jsx(VerificationDialog, {
              consultationId: selectedConsultationId,
              open: dialogOpen,
              onOpenChange: setDialogOpen,
              onActionComplete: async () => {
                // Refresh pending queue
                const listPendingFn = listPendingConsultations;
                const result = await listPendingFn({
                  data: { assignmentId: assignment.id },
                });
                if (result.consultations) {
                  setPendingConsultations(result.consultations);
                }
              },
            }),
          ],
        }),
      activeTab === 'extensions' &&
        _jsx(PendingExtensionsSection, {
          requests: extensionRequests,
          loading: extensionsLoading,
          onApprove: handleApproveExtension,
          onReject: handleRejectExtension,
        }),
    ],
  });
}
