import { useState, useEffect } from 'react';
import {
  getConsultationDetail,
  verifyConsultation,
  rejectConsultation,
} from '@/server/consultations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

  const handleVerify = async () => {
    if (!consultationId) return;
    setLoading(true);
    setError(null);
    const result = await (
      verifyConsultation as unknown as (args: {
        data: { consultationId: number };
      }) => Promise<{ success: boolean; error: string | null }>
    )({ data: { consultationId } });
    if (result.success) {
      onOpenChange(false);
      onActionComplete();
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const handleReject = async () => {
    if (!consultationId || !rejectReason.trim()) return;
    setLoading(true);
    setError(null);
    const result = await (
      rejectConsultation as unknown as (args: {
        data: { consultationId: number; reason: string };
      }) => Promise<{ success: boolean; error: string | null }>
    )({
      data: { consultationId, reason: rejectReason.trim() },
    });
    if (result.success) {
      onOpenChange(false);
      onActionComplete();
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('consultations.consultationDetail')}</DialogTitle>
        </DialogHeader>

        {loading && !detail && (
          <div className="py-8 text-center text-muted-foreground">{t('common.loading')}</div>
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
                disabled={loading}
              >
                {t('consultations.reject')}
              </Button>
              <Button type="button" onClick={handleVerify} disabled={loading}>
                {loading ? t('common.loading') : t('consultations.verify')}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                type="button"
                onClick={() => setShowRejectInput(false)}
                disabled={loading}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="destructive"
                type="button"
                onClick={handleReject}
                disabled={loading || !rejectReason.trim()}
              >
                {loading ? t('common.loading') : t('consultations.confirmReject')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
