import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { format } from 'date-fns/format';
import { isPast } from 'date-fns/isPast';
import { useNavigate } from '@tanstack/react-router';
import { useI18n } from '../../../routes/__root';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertCircle, Users, ExternalLink } from 'lucide-react';
const stateConfig = {
  passed: {
    label: 'studentAssignments.status.passed',
    containerClass: 'border-l-success bg-success/10',
    badgeVariant: 'success',
  },
  submitted: {
    label: 'studentAssignments.status.submitted',
    containerClass: 'border-l-info bg-info/10',
    badgeVariant: 'info',
  },
  under_review: {
    label: 'studentAssignments.status.under_review',
    containerClass: 'border-l-warning bg-warning/10',
    badgeVariant: 'warning',
  },
  revise: {
    label: 'studentAssignments.status.revise',
    containerClass: 'border-l-error bg-error/10',
    badgeVariant: 'destructive',
  },
  unlocked: {
    label: 'studentAssignments.status.unlocked',
    containerClass: 'border-l-primary bg-primary/10',
    badgeVariant: 'default',
  },
  locked: {
    label: 'studentAssignments.status.locked',
    containerClass: 'border-l-border bg-muted/50',
    badgeVariant: 'outline',
  },
};
function getTranslatedBlockingReason(reason, t) {
  if (reason.startsWith('Previous checkpoint not passed')) {
    return t('studentAssignments.blockedByPrevious');
  }
  const consultMatch = reason.match(/Insufficient consultations: (\d+)\/(\d+) verified/);
  if (consultMatch) {
    return t('studentAssignments.blockedByConsultations', {
      current: consultMatch[1],
      required: consultMatch[2],
    });
  }
  return reason;
}
export function CheckpointCard({ checkpoint, assignmentId }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const config = stateConfig[checkpoint.state] ?? stateConfig.locked;
  const isOverdue =
    checkpoint.dueDate && isPast(new Date(checkpoint.dueDate)) && checkpoint.state !== 'passed';
  const minConsults = checkpoint.minConsultations ?? 0;
  const isSatisfied = minConsults === 0 || checkpoint.verifiedConsultationCount >= minConsults;
  return _jsx('div', {
    className: `relative rounded-lg border-l-4 p-4 shadow-sm ${config.containerClass}`,
    children: _jsxs('div', {
      className: 'flex items-start justify-between gap-2',
      children: [
        _jsxs('div', {
          className: 'flex-1 min-w-0',
          children: [
            _jsxs('div', {
              className: 'flex items-center gap-2 flex-wrap',
              children: [
                _jsx('h4', {
                  className: 'text-sm font-semibold text-foreground',
                  children: checkpoint.name,
                }),
                _jsx(Badge, { variant: config.badgeVariant, children: t(config.label) }),
                isOverdue &&
                  _jsxs(Badge, {
                    variant: 'destructive',
                    className: 'gap-1',
                    children: [
                      _jsx(AlertCircle, { className: 'h-3 w-3' }),
                      t('studentAssignments.status.overdue'),
                    ],
                  }),
              ],
            }),
            checkpoint.dueDate &&
              _jsxs('div', {
                className: `mt-1.5 flex items-center gap-1 text-xs ${isOverdue ? 'text-warning font-medium' : 'text-muted-foreground'}`,
                children: [
                  _jsx(Clock, { className: 'h-3 w-3' }),
                  _jsx('span', { children: format(new Date(checkpoint.dueDate), 'MMM d, yyyy') }),
                ],
              }),
            minConsults > 0 &&
              _jsxs('div', {
                className: `mt-1.5 flex items-center gap-1 text-xs ${isSatisfied ? 'text-success' : 'text-muted-foreground'}`,
                children: [
                  _jsx(Users, { className: 'h-3 w-3' }),
                  _jsx('span', {
                    children: t('studentAssignments.consultations', {
                      current: String(checkpoint.verifiedConsultationCount),
                      required: String(minConsults),
                    }),
                  }),
                ],
              }),
            checkpoint.blockingReasons &&
              checkpoint.blockingReasons.length > 0 &&
              _jsx('div', {
                className: 'mt-2 space-y-1',
                children: checkpoint.blockingReasons.map((reason, idx) => {
                  const translatedReason = getTranslatedBlockingReason(reason, t);
                  return _jsxs(
                    'div',
                    {
                      className: 'flex items-start gap-1.5 text-xs text-warning',
                      children: [
                        _jsx(AlertCircle, { className: 'h-3 w-3 mt-0.5 shrink-0' }),
                        _jsx('span', { children: translatedReason }),
                      ],
                    },
                    idx,
                  );
                }),
              }),
          ],
        }),
        checkpoint.state === 'unlocked' &&
          _jsx(Button, {
            size: 'sm',
            className: 'shrink-0',
            onClick: () =>
              navigate({
                to: '/student/assignments/$id/checkpoints/$checkpointId',
                params: { id: String(assignmentId), checkpointId: String(checkpoint.id) },
              }),
            children: t('studentAssignments.submit'),
          }),
        checkpoint.state === 'revise' &&
          _jsx(Button, {
            size: 'sm',
            variant: 'outline',
            className: 'shrink-0',
            onClick: () =>
              navigate({
                to: '/student/assignments/$id/checkpoints/$checkpointId',
                params: { id: String(assignmentId), checkpointId: String(checkpoint.id) },
              }),
            children: t('studentAssignments.resubmit'),
          }),
        (checkpoint.state === 'submitted' ||
          checkpoint.state === 'under_review' ||
          checkpoint.state === 'passed') &&
          _jsxs(Button, {
            variant: 'link',
            size: 'sm',
            onClick: () =>
              navigate({
                to: '/student/assignments/$id/checkpoints/$checkpointId',
                params: { id: String(assignmentId), checkpointId: String(checkpoint.id) },
              }),
            className: 'shrink-0',
            children: [
              _jsx(ExternalLink, { className: 'h-3 w-3' }),
              t('studentAssignments.viewSubmission'),
            ],
          }),
      ],
    }),
  });
}
