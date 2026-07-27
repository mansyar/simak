import { useState } from 'react';
import { useI18n } from '@/routes/__root';
import type { TranslationKey } from '@/i18n/index';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CountBadge } from '@/components/ui/count-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock } from 'lucide-react';
import { ApproveExtensionDialog } from './ApproveExtensionDialog';
import { RejectExtensionDialog } from './RejectExtensionDialog';

export interface ExtensionRequestItem {
  id: number;
  studentId: string;
  studentName: string;
  checkpointId: number | null;
  checkpointName: string | null;
  category: string;
  reason: string;
  extensionDays: number;
  status: string;
  createdAt: Date | null;
}

interface PendingExtensionsSectionProps {
  requests: ExtensionRequestItem[];
  loading: boolean;
  onApprove: (requestId: number, comment?: string) => void;
  onReject: (requestId: number, reason: string) => void;
}

const categoryVariantMap: Record<string, 'info' | 'secondary' | 'success' | 'outline'> = {
  personal: 'info',
  research: 'secondary',
  health: 'success',
  other: 'outline',
};

export function PendingExtensionsSection({
  requests,
  loading,
  onApprove,
  onReject,
}: PendingExtensionsSectionProps) {
  const { t } = useI18n();
  const [approveRequest, setApproveRequest] = useState<ExtensionRequestItem | null>(null);
  const [rejectRequest, setRejectRequest] = useState<ExtensionRequestItem | null>(null);

  const pendingCount = requests.length;

  if (!loading && pendingCount === 0) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm">{t('extensions.queue.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState icon={Clock} title={t('extensions.queue.noPending')} compact />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          {t('extensions.queue.title')}
          <CountBadge count={pendingCount} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 rounded-md" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <div
                key={req.id}
                className="flex items-start justify-between gap-4 rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{req.studentName}</span>
                    <Badge variant={categoryVariantMap[req.category] ?? 'outline'}>
                      {t(`extensions.category.${req.category}` as TranslationKey)}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {t('extensions.queue.durationDays', { count: String(req.extensionDays) })}
                    </span>
                  </div>
                  {req.checkpointName && (
                    <p className="text-xs text-muted-foreground">
                      {t('extensions.queue.checkpoint')}: {req.checkpointName}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground line-clamp-2">{req.reason}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="default"
                    disabled={loading}
                    onClick={() => setApproveRequest(req)}
                  >
                    {t('extensions.queue.approve')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={loading}
                    onClick={() => setRejectRequest(req)}
                  >
                    {t('extensions.queue.reject')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {approveRequest && (
          <ApproveExtensionDialog
            request={approveRequest}
            open={true}
            onOpenChange={(open) => {
              if (!open) setApproveRequest(null);
            }}
            onConfirm={(comment) => {
              onApprove(approveRequest.id, comment);
              setApproveRequest(null);
            }}
          />
        )}

        {rejectRequest && (
          <RejectExtensionDialog
            request={rejectRequest}
            open={true}
            onOpenChange={(open) => {
              if (!open) setRejectRequest(null);
            }}
            onConfirm={(reason) => {
              onReject(rejectRequest.id, reason);
              setRejectRequest(null);
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}
