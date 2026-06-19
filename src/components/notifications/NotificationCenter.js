import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from 'react/jsx-runtime';
import { X, CheckSquare, Loader2 } from 'lucide-react';
import { useI18n } from '@/routes/__root';
import { useNotificationsList, useMarkAllRead } from '@/hooks/use-notifications';
import { NotificationItem } from './NotificationItem';
const GROUP_CONFIGS = [
  {
    key: 'newReviews',
    labelKey: 'notifications.groups.newReviews',
    types: ['review_completed', 'revision_requested'],
  },
  {
    key: 'consultations',
    labelKey: 'notifications.groups.consultations',
    types: ['consultation_verified', 'consultation_logged', 'consultation_rejected'],
  },
  {
    key: 'submissions',
    labelKey: 'notifications.groups.submissions',
    types: ['submission_received'],
  },
  {
    key: 'system',
    labelKey: 'notifications.groups.system',
    types: ['sla_breach'],
  },
];
export function NotificationCenter({ isOpen, onClose }) {
  const { t } = useI18n();
  const { data, isLoading } = useNotificationsList({ page: 1, limit: 50 });
  const { mutate: markAllRead, isPending: isMarkingAll } = useMarkAllRead();
  if (!isOpen) return null;
  const items = data?.items || [];
  // Group notifications
  const groupedNotifications = GROUP_CONFIGS.map((group) => {
    const groupItems = items.filter((item) => group.types.includes(item.type));
    return {
      ...group,
      items: groupItems,
    };
  }).filter((group) => group.items.length > 0);
  const hasNotifications = items.length > 0;
  return _jsxs(_Fragment, {
    children: [
      _jsx('div', {
        className: 'fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity',
        onClick: onClose,
      }),
      _jsxs('div', {
        className:
          'fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-background border-l border-border shadow-2xl transition-all duration-300 ease-in-out',
        children: [
          _jsxs('div', {
            className: 'flex items-center justify-between border-b border-border p-4',
            children: [
              _jsxs('div', {
                className: 'flex items-center gap-2',
                children: [
                  _jsx('h2', {
                    className: 'text-lg font-semibold text-foreground',
                    children: t('notifications.title'),
                  }),
                  items.filter((i) => !i.read).length > 0 &&
                    _jsx('span', {
                      className:
                        'inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-400',
                      children: items.filter((i) => !i.read).length,
                    }),
                ],
              }),
              _jsxs('div', {
                className: 'flex items-center gap-1.5',
                children: [
                  hasNotifications &&
                    _jsxs('button', {
                      type: 'button',
                      onClick: () => markAllRead(),
                      disabled: isMarkingAll || items.every((i) => i.read),
                      className:
                        'inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-accent disabled:opacity-50 transition-colors',
                      children: [
                        _jsx(CheckSquare, { className: 'h-3.5 w-3.5' }),
                        t('notifications.markAllRead'),
                      ],
                    }),
                  _jsx('button', {
                    type: 'button',
                    onClick: onClose,
                    className:
                      'rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors',
                    'aria-label': t('notifications.closePanel'),
                    children: _jsx(X, { className: 'h-5 w-5' }),
                  }),
                ],
              }),
            ],
          }),
          _jsx('div', {
            className: 'flex-1 overflow-y-auto',
            children: isLoading
              ? _jsx('div', {
                  className: 'flex h-64 items-center justify-center',
                  children: _jsx(Loader2, {
                    className: 'h-8 w-8 animate-spin text-muted-foreground',
                  }),
                })
              : !hasNotifications
                ? _jsxs('div', {
                    className: 'flex h-64 flex-col items-center justify-center p-6 text-center',
                    children: [
                      _jsx('div', {
                        className: 'rounded-full bg-muted p-3 text-muted-foreground',
                        children: _jsx(X, { className: 'h-6 w-6' }),
                      }),
                      _jsx('h3', {
                        className: 'mt-4 text-sm font-semibold text-foreground',
                        children: t('notifications.empty'),
                      }),
                    ],
                  })
                : _jsx('div', {
                    className: 'divide-y divide-border/20',
                    children: groupedNotifications.map((group) =>
                      _jsxs(
                        'div',
                        {
                          className: 'py-2',
                          children: [
                            _jsxs('div', {
                              className:
                                'px-4 py-2 bg-muted/30 text-xs font-semibold text-muted-foreground flex items-center justify-between',
                              children: [
                                _jsx('span', { children: t(group.labelKey) }),
                                _jsx('span', {
                                  className: 'rounded bg-muted px-1.5 py-0.5 text-[10px]',
                                  children: group.items.length,
                                }),
                              ],
                            }),
                            _jsx('div', {
                              children: group.items.map((item) =>
                                _jsx(NotificationItem, { item: item }, item.id),
                              ),
                            }),
                          ],
                        },
                        group.key,
                      ),
                    ),
                  }),
          }),
        ],
      }),
    ],
  });
}
