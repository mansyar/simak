import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from 'react/jsx-runtime';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Monitor, Smartphone, Tablet, RefreshCw, LogOut, LogOutIcon } from 'lucide-react';
import { listActiveSessions, revokeSession, revokeAllOtherSessions } from '@/server/sessions';
import { useI18n } from '@/routes/__root';
function DeviceIcon({ device }) {
  if (device.device === 'Mobile') return _jsx(Smartphone, { className: 'h-4 w-4' });
  if (device.device === 'Tablet') return _jsx(Tablet, { className: 'h-4 w-4' });
  return _jsx(Monitor, { className: 'h-4 w-4' });
}
function formatDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}
export function SessionManagement() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [isRevokeAllOpen, setIsRevokeAllOpen] = useState(false);
  const { data: sessionsData, isLoading } = useQuery({
    queryKey: ['activeSessions'],
    queryFn: async () => {
      const result = await listActiveSessions();
      return result;
    },
  });
  const revokeMutation = useMutation({
    mutationFn: async (sessionId) => {
      const result = await revokeSession({ data: { sessionId } });
      return result;
    },
    onSuccess: (data) => {
      if (data.error) return;
      queryClient.invalidateQueries({ queryKey: ['activeSessions'] });
      setRevokeTarget(null);
    },
  });
  const revokeAllMutation = useMutation({
    mutationFn: async () => {
      const result = await revokeAllOtherSessions({ data: {} });
      return result;
    },
    onSuccess: (data) => {
      if (data.error) return;
      queryClient.invalidateQueries({ queryKey: ['activeSessions'] });
      setIsRevokeAllOpen(false);
    },
  });
  const sessions = sessionsData?.sessions ?? [];
  const otherSessions = sessions.filter((s) => !s.isCurrent);
  if (isLoading) {
    return _jsx(Card, {
      children: _jsx(CardContent, {
        className: 'flex items-center justify-center py-8',
        children: _jsx(RefreshCw, { className: 'h-5 w-5 animate-spin text-muted-foreground' }),
      }),
    });
  }
  return _jsxs(_Fragment, {
    children: [
      _jsxs(Card, {
        children: [
          _jsxs(CardHeader, {
            children: [
              _jsxs(CardTitle, {
                className: 'flex items-center gap-2',
                children: [_jsx(Monitor, { className: 'h-5 w-5' }), t('settings.sessions.title')],
              }),
              _jsx(CardDescription, { children: t('settings.sessions.description') }),
            ],
          }),
          _jsxs(CardContent, {
            className: 'space-y-3',
            children: [
              sessions.length === 0
                ? _jsx('p', {
                    className: 'text-sm text-muted-foreground',
                    children: t('settings.sessions.noSessions'),
                  })
                : sessions.map((s) =>
                    _jsxs(
                      'div',
                      {
                        className: 'flex items-center justify-between rounded-lg border p-3',
                        children: [
                          _jsxs('div', {
                            className: 'flex items-center gap-3',
                            children: [
                              _jsx(DeviceIcon, { device: s.device }),
                              _jsxs('div', {
                                children: [
                                  _jsxs('div', {
                                    className: 'flex items-center gap-2',
                                    children: [
                                      _jsxs('span', {
                                        className: 'text-sm font-medium',
                                        children: [s.device.browser, ' on ', s.device.os],
                                      }),
                                      s.isCurrent &&
                                        _jsx(Badge, {
                                          variant: 'default',
                                          className: 'text-xs',
                                          children: t('settings.sessions.current'),
                                        }),
                                    ],
                                  }),
                                  _jsxs('div', {
                                    className: 'text-xs text-muted-foreground',
                                    children: [
                                      s.ipAddress ?? 'Unknown IP',
                                      ' \u00B7 ',
                                      formatDate(s.createdAt),
                                    ],
                                  }),
                                ],
                              }),
                            ],
                          }),
                          !s.isCurrent &&
                            _jsx(Button, {
                              variant: 'ghost',
                              size: 'sm',
                              onClick: () => setRevokeTarget(s),
                              children: _jsx(LogOut, { className: 'h-4 w-4' }),
                            }),
                        ],
                      },
                      s.id,
                    ),
                  ),
              otherSessions.length > 0 &&
                _jsx('div', {
                  className: 'pt-2',
                  children: _jsxs(Button, {
                    variant: 'destructive',
                    size: 'sm',
                    onClick: () => setIsRevokeAllOpen(true),
                    children: [
                      _jsx(LogOutIcon, { className: 'h-4 w-4 mr-2' }),
                      t('settings.sessions.revokeAllOthers'),
                    ],
                  }),
                }),
            ],
          }),
        ],
      }),
      _jsx(Dialog, {
        open: !!revokeTarget,
        onOpenChange: (open) => {
          if (!open) setRevokeTarget(null);
        },
        children: _jsxs(DialogContent, {
          className: 'sm:max-w-md',
          children: [
            _jsxs(DialogHeader, {
              children: [
                _jsx(DialogTitle, { children: t('settings.sessions.revokeTitle') }),
                _jsx(DialogDescription, { children: t('settings.sessions.revokeDescription') }),
              ],
            }),
            revokeTarget &&
              _jsxs('p', {
                className: 'text-sm',
                children: [
                  revokeTarget.device.browser,
                  ' on ',
                  revokeTarget.device.os,
                  ' \u00B7',
                  ' ',
                  revokeTarget.ipAddress ?? 'Unknown IP',
                ],
              }),
            _jsxs(DialogFooter, {
              children: [
                _jsx(Button, {
                  variant: 'outline',
                  onClick: () => setRevokeTarget(null),
                  children: t('common.cancel'),
                }),
                _jsxs(Button, {
                  variant: 'destructive',
                  onClick: () => revokeTarget && revokeMutation.mutate(revokeTarget.id),
                  disabled: revokeMutation.isPending,
                  children: [
                    revokeMutation.isPending &&
                      _jsx(RefreshCw, { className: 'h-4 w-4 animate-spin mr-2' }),
                    t('settings.sessions.revoke'),
                  ],
                }),
              ],
            }),
          ],
        }),
      }),
      _jsx(Dialog, {
        open: isRevokeAllOpen,
        onOpenChange: setIsRevokeAllOpen,
        children: _jsxs(DialogContent, {
          className: 'sm:max-w-md',
          children: [
            _jsxs(DialogHeader, {
              children: [
                _jsx(DialogTitle, { children: t('settings.sessions.revokeAllTitle') }),
                _jsx(DialogDescription, {
                  children: t('settings.sessions.revokeAllDescription', {
                    count: String(otherSessions.length),
                  }),
                }),
              ],
            }),
            _jsxs(DialogFooter, {
              children: [
                _jsx(Button, {
                  variant: 'outline',
                  onClick: () => setIsRevokeAllOpen(false),
                  children: t('common.cancel'),
                }),
                _jsxs(Button, {
                  variant: 'destructive',
                  onClick: () => revokeAllMutation.mutate(),
                  disabled: revokeAllMutation.isPending,
                  children: [
                    revokeAllMutation.isPending &&
                      _jsx(RefreshCw, { className: 'h-4 w-4 animate-spin mr-2' }),
                    t('settings.sessions.revokeAll'),
                  ],
                }),
              ],
            }),
          ],
        }),
      }),
    ],
  });
}
