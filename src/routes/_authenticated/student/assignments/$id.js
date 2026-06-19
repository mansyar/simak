import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { useState, useEffect } from 'react';
import { createFileRoute, Link, Outlet, useMatchRoute } from '@tanstack/react-router';
import { getStudentAssignmentDetail } from '@/server/assignments';
import { listConsultations, listVerifiedCounts } from '@/server/consultations';
import { listMyExtensionRequests } from '@/server/extensions';
import { AssignmentDetailHeader } from '@/components/student/assignments/AssignmentDetailHeader';
import { CheckpointTimeline } from '@/components/student/assignments/CheckpointTimeline';
import { StudentAssignmentLoadingSkeleton } from '@/components/student/assignments/StudentAssignmentLoadingSkeleton';
import { ConsultationForm } from '@/components/consultations/ConsultationForm';
import { ConsultationList } from '@/components/consultations/ConsultationList';
import { ConsultationProgress } from '@/components/consultations/ConsultationProgress';
import { ExtensionRequestForm } from '@/components/student/extensions/ExtensionRequestForm';
import { ExtensionHistoryList } from '@/components/student/extensions/ExtensionHistoryList';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { useI18n } from '../../../__root';
export const Route = createFileRoute('/_authenticated/student/assignments/$id')({
  loader: async ({ params }) => {
    // @ts-expect-error - getStudentAssignmentDetail handler type inference limitation
    return getStudentAssignmentDetail({ data: { id: Number(params.id) } });
  },
  pendingComponent: () =>
    _jsx('div', {
      className: 'space-y-6',
      children: _jsx(StudentAssignmentLoadingSkeleton, { count: 1 }),
    }),
  notFoundComponent: () => _jsx(AssignmentNotFound, {}),
  component: AssignmentDetailPage,
});
function AssignmentNotFound() {
  const { t } = useI18n();
  return _jsxs('div', {
    className: 'flex flex-col items-center justify-center py-16 text-center',
    children: [
      _jsx('h2', {
        className: 'text-xl font-semibold text-foreground mb-2',
        children: t('studentAssignments.notFound'),
      }),
      _jsx('p', {
        className: 'text-sm text-muted-foreground mb-4',
        children: t('studentAssignments.notFoundDescription'),
      }),
      _jsx(Link, {
        to: '/student/assignments',
        className: 'inline-flex',
        search: () => ({ page: 1, limit: 20, search: '' }),
        children: _jsxs(Button, {
          variant: 'outline',
          type: 'button',
          children: [_jsx(ChevronLeft, { className: 'mr-2 h-4 w-4' }), t('common.back')],
        }),
      }),
    ],
  });
}
function AssignmentDetailPage() {
  const { t } = useI18n();
  const data = Route.useLoaderData();
  const matchRoute = useMatchRoute();
  const [consultations, setConsultations] = useState([]);
  const [verifiedCounts, setVerifiedCounts] = useState([]);
  const [activeTab, setActiveTab] = useState('timeline');
  const [extensionItems, setExtensionItems] = useState([]);
  // Load consultation data on mount
  useEffect(() => {
    if (data) {
      const loadConsultations = async () => {
        const listConsFn = listConsultations;
        const listCountsFn = listVerifiedCounts;
        const consResult = await listConsFn({
          data: { assignmentId: data.id },
        });
        if (consResult && typeof consResult === 'object' && 'consultations' in consResult) {
          setConsultations(consResult.consultations);
        }
        const countsResult = await listCountsFn({
          data: { assignmentId: data.id },
        });
        if (countsResult && typeof countsResult === 'object' && 'counts' in countsResult) {
          setVerifiedCounts(countsResult.counts);
        }
        // Load extension requests
        const listExtFn = listMyExtensionRequests;
        const extResult = await listExtFn({
          data: { assignmentId: data.id },
        });
        if (extResult && typeof extResult === 'object' && 'items' in extResult) {
          setExtensionItems(extResult.items);
        }
      };
      loadConsultations();
    }
  }, [data]);
  // If a child route is active (e.g., /checkpoints/:checkpointId), render it via Outlet
  // The child route (submission page) has its own full layout and back navigation
  const isOnCheckpointChild = matchRoute({
    to: '/student/assignments/$id/checkpoints/$checkpointId',
  });
  if (isOnCheckpointChild) {
    return _jsx(Outlet, {});
  }
  if (!data) {
    return _jsx(AssignmentNotFound, {});
  }
  const detail = {
    title: data.title,
    description: data.description,
    finalDeadline: new Date(data.finalDeadline),
    instructorName: data.instructorName,
    templateName: data.templateName,
    templateType: data.templateType,
  };
  const checkpoints = (data.checkpoints ?? []).map((cp) => ({
    id: cp.id,
    name: cp.name,
    order: cp.order,
    state: cp.state,
    dueDate: cp.dueDate ? new Date(cp.dueDate) : null,
    minConsultations: cp.minConsultations,
    verifiedConsultationCount: cp.verifiedConsultationCount,
    blockingReasons: cp.blockingReasons,
  }));
  const handleConsultationSuccess = async () => {
    // Refresh consultation data
    const listConsFn = listConsultations;
    const listCountsFn = listVerifiedCounts;
    const consResult = await listConsFn({
      data: { assignmentId: data.id },
    });
    if (consResult && typeof consResult === 'object' && 'consultations' in consResult) {
      setConsultations(consResult.consultations);
    }
    const countsResult = await listCountsFn({
      data: { assignmentId: data.id },
    });
    if (countsResult && typeof countsResult === 'object' && 'counts' in countsResult) {
      setVerifiedCounts(countsResult.counts);
    }
  };
  const handleExtensionSuccess = async () => {
    // Refresh extension data
    const listExtFn = listMyExtensionRequests;
    const extResult = await listExtFn({
      data: { assignmentId: data.id },
    });
    if (extResult && typeof extResult === 'object' && 'items' in extResult) {
      setExtensionItems(extResult.items);
    }
  };
  return _jsxs('div', {
    className: 'space-y-6',
    children: [
      _jsxs('div', {
        className: 'flex items-center justify-between',
        children: [
          _jsx(Link, {
            to: '/student/assignments',
            search: () => ({ page: 1, limit: 20, search: '' }),
            className: 'inline-flex',
            children: _jsxs(Button, {
              variant: 'ghost',
              size: 'sm',
              type: 'button',
              children: [_jsx(ChevronLeft, { className: 'mr-1 h-4 w-4' }), t('common.back')],
            }),
          }),
          _jsxs('div', {
            className: 'flex items-center gap-2 text-sm',
            children: [
              _jsx('span', {
                className: 'text-muted-foreground',
                children: t('studentAssignments.progress'),
              }),
              _jsxs('span', {
                className: 'font-semibold text-foreground',
                children: [data.progressPercent ?? 0, '%'],
              }),
            ],
          }),
        ],
      }),
      _jsx(AssignmentDetailHeader, { detail: detail }),
      _jsx('div', {
        className: 'border-b border-border',
        children: _jsxs('div', {
          className: 'flex gap-1',
          children: [
            _jsx('button', {
              type: 'button',
              onClick: () => setActiveTab('timeline'),
              'data-state': activeTab === 'timeline' ? 'active' : 'inactive',
              className: `px-3 py-2 text-sm font-medium border-b-2 rounded-t-md transition-colors ${
                activeTab === 'timeline'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`,
              children: t('studentAssignments.checkpointTimeline'),
            }),
            _jsx('button', {
              type: 'button',
              onClick: () => setActiveTab('consultations'),
              'data-state': activeTab === 'consultations' ? 'active' : 'inactive',
              className: `px-3 py-2 text-sm font-medium border-b-2 rounded-t-md transition-colors ${
                activeTab === 'consultations'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`,
              children: t('consultations.title'),
            }),
            _jsx('button', {
              type: 'button',
              onClick: () => setActiveTab('extensions'),
              'data-state': activeTab === 'extensions' ? 'active' : 'inactive',
              className: `px-3 py-2 text-sm font-medium border-b-2 rounded-t-md transition-colors ${
                activeTab === 'extensions'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`,
              children: t('extensions.requestTitle'),
            }),
          ],
        }),
      }),
      activeTab === 'timeline' &&
        _jsx('div', {
          className: 'border-t pt-6',
          children: _jsx(CheckpointTimeline, { checkpoints: checkpoints, assignmentId: data.id }),
        }),
      activeTab === 'consultations' &&
        _jsxs('div', {
          className: 'space-y-6',
          children: [
            _jsx(ConsultationProgress, { counts: verifiedCounts }),
            _jsxs('div', {
              className: 'rounded-lg border bg-card p-5 shadow-sm',
              children: [
                _jsx('h3', {
                  className: 'text-lg font-semibold text-foreground mb-4',
                  children: t('consultations.logConsultation'),
                }),
                _jsx(ConsultationForm, {
                  assignmentId: data.id,
                  checkpoints: checkpoints.map((cp) => ({ id: cp.id, name: cp.name })),
                  onSuccess: handleConsultationSuccess,
                }),
              ],
            }),
            _jsxs('div', {
              className: 'rounded-lg border bg-card p-5 shadow-sm',
              children: [
                _jsx('h3', {
                  className: 'text-lg font-semibold text-foreground mb-4',
                  children: t('consultations.previousSessions'),
                }),
                _jsx(ConsultationList, { consultations: consultations }),
              ],
            }),
          ],
        }),
      activeTab === 'extensions' &&
        _jsxs('div', {
          className: 'space-y-6',
          children: [
            _jsxs('div', {
              className: 'rounded-lg border bg-card p-5 shadow-sm',
              children: [
                _jsx('h3', {
                  className: 'text-lg font-semibold text-foreground mb-4',
                  children: t('extensions.requestTitle'),
                }),
                _jsx(ExtensionRequestForm, {
                  assignmentId: data.id,
                  maxExtensionDays: data.maxExtensionDays ?? 7,
                  maxTotalExtensions: data.maxTotalExtensions ?? 3,
                  checkpoints: checkpoints.map((cp) => ({ id: cp.id, name: cp.name })),
                  onSuccess: handleExtensionSuccess,
                }),
              ],
            }),
            _jsx(ExtensionHistoryList, { items: extensionItems }),
          ],
        }),
    ],
  });
}
