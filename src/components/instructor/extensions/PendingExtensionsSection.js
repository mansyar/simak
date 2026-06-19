import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { useState } from 'react';
import { useI18n } from '@/routes/__root';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CountBadge } from '@/components/ui/count-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ApproveExtensionDialog } from './ApproveExtensionDialog';
import { RejectExtensionDialog } from './RejectExtensionDialog';
const categoryColors = {
  personal: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  research: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  health: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  other: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};
export function PendingExtensionsSection({ requests, loading, onApprove, onReject }) {
  const { t } = useI18n();
  const [approveRequest, setApproveRequest] = useState(null);
  const [rejectRequest, setRejectRequest] = useState(null);
  const pendingCount = requests.length;
  if (!loading && pendingCount === 0) {
    return _jsxs(Card, {
      className: 'shadow-sm',
      children: [
        _jsx(CardHeader, {
          children: _jsx(CardTitle, {
            className: 'text-sm',
            children: t('extensions.queue.title'),
          }),
        }),
        _jsx(CardContent, {
          children: _jsx('p', {
            className: 'text-sm text-muted-foreground',
            children: t('extensions.queue.noPending'),
          }),
        }),
      ],
    });
  }
  return _jsxs(Card, {
    className: 'shadow-sm',
    children: [
      _jsx(CardHeader, {
        children: _jsxs(CardTitle, {
          className: 'text-sm flex items-center gap-2',
          children: [t('extensions.queue.title'), _jsx(CountBadge, { count: pendingCount })],
        }),
      }),
      _jsxs(CardContent, {
        children: [
          loading
            ? _jsx('div', {
                className: 'space-y-3',
                children: [1, 2, 3].map((i) => _jsx(Skeleton, { className: 'h-16 rounded-md' }, i)),
              })
            : _jsx('div', {
                className: 'space-y-3',
                children: requests.map((req) =>
                  _jsxs(
                    'div',
                    {
                      className: 'flex items-start justify-between gap-4 rounded-lg border p-3',
                      children: [
                        _jsxs('div', {
                          className: 'min-w-0 flex-1 space-y-1',
                          children: [
                            _jsxs('div', {
                              className: 'flex items-center gap-2 flex-wrap',
                              children: [
                                _jsx('span', {
                                  className: 'text-sm font-medium',
                                  children: req.studentName,
                                }),
                                _jsx('span', {
                                  className: `inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${categoryColors[req.category] ?? categoryColors.other}`,
                                  children: t(`extensions.category.${req.category}`),
                                }),
                                _jsx('span', {
                                  className: 'text-[10px] text-muted-foreground',
                                  children: t('extensions.queue.durationDays', {
                                    count: String(req.extensionDays),
                                  }),
                                }),
                              ],
                            }),
                            req.checkpointName &&
                              _jsxs('p', {
                                className: 'text-xs text-muted-foreground',
                                children: [
                                  t('extensions.queue.checkpoint'),
                                  ': ',
                                  req.checkpointName,
                                ],
                              }),
                            _jsx('p', {
                              className: 'text-xs text-muted-foreground line-clamp-2',
                              children: req.reason,
                            }),
                          ],
                        }),
                        _jsxs('div', {
                          className: 'flex items-center gap-2 shrink-0',
                          children: [
                            _jsx(Button, {
                              size: 'sm',
                              variant: 'default',
                              disabled: loading,
                              onClick: () => setApproveRequest(req),
                              children: t('extensions.queue.approve'),
                            }),
                            _jsx(Button, {
                              size: 'sm',
                              variant: 'outline',
                              disabled: loading,
                              onClick: () => setRejectRequest(req),
                              children: t('extensions.queue.reject'),
                            }),
                          ],
                        }),
                      ],
                    },
                    req.id,
                  ),
                ),
              }),
          approveRequest &&
            _jsx(ApproveExtensionDialog, {
              request: approveRequest,
              open: true,
              onOpenChange: (open) => {
                if (!open) setApproveRequest(null);
              },
              onConfirm: (comment) => {
                onApprove(approveRequest.id, comment);
                setApproveRequest(null);
              },
            }),
          rejectRequest &&
            _jsx(RejectExtensionDialog, {
              request: rejectRequest,
              open: true,
              onOpenChange: (open) => {
                if (!open) setRejectRequest(null);
              },
              onConfirm: (reason) => {
                onReject(rejectRequest.id, reason);
                setRejectRequest(null);
              },
            }),
        ],
      }),
    ],
  });
}
