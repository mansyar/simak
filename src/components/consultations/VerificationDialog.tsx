import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getConsultationDetail,
  verifyConsultation,
  rejectConsultation,
} from '@/server/consultations';
import { consultationKeys } from '@/lib/query-keys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useI18n } from '../../routes/__root';

interface VerificationDialogProps {
  consultationId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActionComplete: () => void;
}

interface DetailData {
  id: number;
  studentName: string;
  checkpointName: string;
  sessionType: string | null;
  externalConsultantName: string | null;
  notes: string | null;
  createdAt: string;
  status: string;
}

export function VerificationDialog({
  consultationId,
  open,
  onOpenChange,
  onActionComplete,
}: VerificationDialogProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [detail, setDetail] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  useEffect(() => {
    if (open && consultationId) {
      loadDetail(consultationId);
    } else {
      setDetail(null);
      setError(null);
      setRejectReason('');
      setShowRejectInput(false);
    }
  }, [open, consultationId]);

  const loadDetail = async (id: number) => {
    setLoading(true);
    setError(null);
    const result = await (
      getConsultationDetail as unknown as (args: {
        data: { consultationId: number };
      }) => Promise<{ consultation: DetailData; error?: string }>
    )({ data: { consultationId: id } });
    if (result.consultation) {
      setDetail(result.consultation);
    } else {
      setError(result.error ?? 'Failed to load consultation');
    }
    setLoading(false);
  };

  const verifyMutation = useMutation({
    mutationFn: async () => {
      if (!consultationId) throw new Error('No consultation selected');
      const result = await (
        verifyConsultation as unknown as (args: {
          data: { consultationId: number };
        }) => Promise<{ success: boolean; error: string | null }>
      )({ data: { consultationId } });
      if (!result.success) {
        throw new Error(result.error ?? 'Verification failed');
      }
      return result;
    },
    onMutate: async () => {
      setError(null);
      await queryClient.cancelQueries({ queryKey: consultationKeys.all() });
      const previousEntries = queryClient.getQueriesData({ queryKey: consultationKeys.all() });
      if (consultationId != null) {
        queryClient.setQueriesData({ queryKey: consultationKeys.all() }, (old: unknown) => {
          if (old && typeof old === 'object' && 'consultations' in old) {
            const data = old as { consultations: { id: number }[]; total: number };
            return {
              consultations: data.consultations.filter((c) => c.id !== consultationId),
              total: Math.max(0, data.total - 1),
            };
          }
          return old;
        });
      }
      return { previousEntries };
    },
    onSuccess: () => {
      toast.success(t('consultations.verifySuccess'));
      onOpenChange(false);
      onActionComplete();
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previousEntries) {
        for (const [queryKey, data] of context.previousEntries) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      toast.error(error.message);
      setError(error.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: consultationKeys.all() });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!consultationId || !rejectReason.trim()) throw new Error('No reason provided');
      const result = await (
        rejectConsultation as unknown as (args: {
          data: { consultationId: number; reason: string };
        }) => Promise<{ success: boolean; error: string | null }>
      )({
        data: { consultationId, reason: rejectReason.trim() },
      });
      if (!result.success) {
        throw new Error(result.error ?? 'Rejection failed');
      }
      return result;
    },
    onMutate: () => {
      setError(null);
    },
    onSuccess: () => {
      toast.success(t('consultations.rejectSuccess'));
      onOpenChange(false);
      onActionComplete();
      queryClient.invalidateQueries({ queryKey: consultationKeys.all() });
    },
    onError: (error: Error) => {
      setError(error.message);
    },
  });

  const isMutating = verifyMutation.isPending || rejectMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('consultations.consultationDetail')}</DialogTitle>
        </DialogHeader>

        {loading && !detail && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive" aria-live="polite">
            {error}
          </p>
        )}

        {detail && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-muted-foreground font-medium">
                  {t('consultations.student')}
                </span>
                <p className="text-foreground">{detail.studentName}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground font-medium">
                  {t('consultations.checkpoint')}
                </span>
                <p className="text-foreground">{detail.checkpointName}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground font-medium">
                  {t('consultations.sessionType')}
                </span>
                <p className="text-foreground">
                  {detail.sessionType === 'external'
                    ? t('consultations.external')
                    : t('consultations.internal')}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground font-medium">
                  {t('consultations.date')}
                </span>
                <p className="text-foreground">{new Date(detail.createdAt).toLocaleDateString()}</p>
              </div>
            </div>

            {detail.sessionType === 'external' && detail.externalConsultantName && (
              <div className="text-sm">
                <span className="text-xs text-muted-foreground font-medium">
                  {t('consultations.externalConsultantName')}
                </span>
                <p className="text-foreground">{detail.externalConsultantName}</p>
              </div>
            )}

            <div className="text-sm">
              <span className="text-xs text-muted-foreground font-medium">
                {t('consultations.notes')}
              </span>
              <p className="text-foreground whitespace-pre-wrap">{detail.notes ?? '-'}</p>
            </div>

            {showRejectInput && (
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground font-medium">
                  {t('consultations.rejectReason')}
                </label>
                <Input
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder={t('consultations.rejectReasonPlaceholder')}
                />
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {!showRejectInput ? (
            <>
              <Button
                variant="outline"
                type="button"
                onClick={() => setShowRejectInput(true)}
                disabled={loading || isMutating}
              >
                {t('consultations.reject')}
              </Button>
              <Button
                type="button"
                onClick={() => verifyMutation.mutate()}
                disabled={loading || isMutating}
              >
                {verifyMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('common.loading')}
                  </>
                ) : (
                  t('consultations.verify')
                )}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                type="button"
                onClick={() => setShowRejectInput(false)}
                disabled={loading || isMutating}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="destructive"
                type="button"
                onClick={() => rejectMutation.mutate()}
                disabled={loading || isMutating || !rejectReason.trim()}
              >
                {rejectMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('common.loading')}
                  </>
                ) : (
                  t('consultations.confirmReject')
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
