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

type SessionDevice = { browser: string; os: string; device: string };
type SessionItem = {
  id: string;
  isCurrent: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  device: SessionDevice;
  createdAt: Date;
  updatedAt: Date;
};

function DeviceIcon({ device }: { device: SessionDevice }) {
  if (device.device === 'Mobile') return <Smartphone className="h-4 w-4" />;
  if (device.device === 'Tablet') return <Tablet className="h-4 w-4" />;
  return <Monitor className="h-4 w-4" />;
}

function formatDate(date: Date): string {
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
  const [revokeTarget, setRevokeTarget] = useState<SessionItem | null>(null);
  const [isRevokeAllOpen, setIsRevokeAllOpen] = useState(false);

  const { data: sessionsData, isLoading } = useQuery({
    queryKey: ['activeSessions'],
    queryFn: async () => {
      const result = await (listActiveSessions as unknown as () => Promise<unknown>)();
      return result as { sessions: SessionItem[]; total: number };
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const result = await (
        revokeSession as unknown as (args: { data: { sessionId: string } }) => Promise<unknown>
      )({ data: { sessionId } });
      return result as { success?: boolean; error?: string };
    },
    onSuccess: (data) => {
      if (data.error) return;
      queryClient.invalidateQueries({ queryKey: ['activeSessions'] });
      setRevokeTarget(null);
    },
  });

  const revokeAllMutation = useMutation({
    mutationFn: async () => {
      const result = await (
        revokeAllOtherSessions as unknown as (args: {
          data: Record<string, never>;
        }) => Promise<unknown>
      )({ data: {} });
      return result as { success?: boolean; revokedCount?: number; error?: string };
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
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            {t('settings.sessions.title')}
          </CardTitle>
          <CardDescription>{t('settings.sessions.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('settings.sessions.noSessions')}</p>
          ) : (
            sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <DeviceIcon device={s.device} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {s.device.browser} on {s.device.os}
                      </span>
                      {s.isCurrent && (
                        <Badge variant="default" className="text-xs">
                          {t('settings.sessions.current')}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {s.ipAddress ?? 'Unknown IP'} &middot; {formatDate(s.createdAt)}
                    </div>
                  </div>
                </div>
                {!s.isCurrent && (
                  <Button variant="ghost" size="sm" onClick={() => setRevokeTarget(s)}>
                    <LogOut className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))
          )}
          {otherSessions.length > 0 && (
            <div className="pt-2">
              <Button variant="destructive" size="sm" onClick={() => setIsRevokeAllOpen(true)}>
                <LogOutIcon className="h-4 w-4 mr-2" />
                {t('settings.sessions.revokeAllOthers')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revoke Single Session Dialog */}
      <Dialog
        open={!!revokeTarget}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('settings.sessions.revokeTitle')}</DialogTitle>
            <DialogDescription>{t('settings.sessions.revokeDescription')}</DialogDescription>
          </DialogHeader>
          {revokeTarget && (
            <p className="text-sm">
              {revokeTarget.device.browser} on {revokeTarget.device.os} &middot;{' '}
              {revokeTarget.ipAddress ?? 'Unknown IP'}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => revokeTarget && revokeMutation.mutate(revokeTarget.id)}
              disabled={revokeMutation.isPending}
            >
              {revokeMutation.isPending && <RefreshCw className="h-4 w-4 animate-spin mr-2" />}
              {t('settings.sessions.revoke')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke All Others Dialog */}
      <Dialog open={isRevokeAllOpen} onOpenChange={setIsRevokeAllOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('settings.sessions.revokeAllTitle')}</DialogTitle>
            <DialogDescription>
              {t('settings.sessions.revokeAllDescription', { count: String(otherSessions.length) })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRevokeAllOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => revokeAllMutation.mutate()}
              disabled={revokeAllMutation.isPending}
            >
              {revokeAllMutation.isPending && <RefreshCw className="h-4 w-4 animate-spin mr-2" />}
              {t('settings.sessions.revokeAll')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
