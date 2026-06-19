import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { Link } from '@tanstack/react-router';
import { FileText, Clock } from 'lucide-react';
import { useI18n } from '../../routes/__root';
import { SLABadge } from './SLABadge';
export function ReviewQueueItem({ item }) {
  const { t } = useI18n();
  const waitTime = getWaitTime(item.uploadedAt);
  return _jsxs('div', {
    className:
      'flex items-center justify-between rounded-lg border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/30',
    children: [
      _jsxs('div', {
        className: 'flex-1 space-y-2',
        children: [
          _jsxs('div', {
            className: 'flex items-center gap-2',
            children: [
              _jsx('span', {
                className: 'text-sm font-semibold text-foreground',
                children: item.studentName,
              }),
              _jsx('span', { className: 'text-xs text-muted-foreground', children: '\u2014' }),
              _jsx('span', {
                className: 'text-sm text-muted-foreground',
                children: item.checkpointName,
              }),
            ],
          }),
          _jsxs('div', {
            className: 'flex items-center gap-4 text-xs text-muted-foreground',
            children: [
              _jsxs('div', {
                className: 'flex items-center gap-1',
                children: [
                  _jsx(FileText, { className: 'h-3 w-3' }),
                  _jsx('span', { children: item.assignmentTitle }),
                ],
              }),
              _jsxs('div', {
                className: 'flex items-center gap-1',
                children: [
                  _jsx(Clock, { className: 'h-3 w-3' }),
                  _jsx('span', { children: waitTime }),
                ],
              }),
            ],
          }),
        ],
      }),
      _jsxs('div', {
        className: 'flex items-center gap-3',
        children: [
          _jsx(SLABadge, {
            state: item.checkpointState,
            updatedAt: item.checkpointUpdatedAt ?? item.uploadedAt,
          }),
          _jsx(Link, {
            to: '/instructor/reviews/$submissionId',
            params: { submissionId: String(item.submissionId) },
            'data-testid': 'review-queue-link',
            className:
              'inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors',
            children: t('common.viewAll'),
          }),
        ],
      }),
    ],
  });
}
function getWaitTime(uploadedAt) {
  const now = Date.now();
  const diff = now - new Date(uploadedAt).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h`;
  return '< 1h';
}
