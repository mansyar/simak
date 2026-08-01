import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  getGradeReleasePreflight,
  publishGradeRelease,
  withdrawGradeRelease,
} from '@/server/gradebook';
import { isServerError } from '@/lib/errors';
import { useI18n } from '@/routes/__root';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

type ReleaseStatus = 'draft' | 'published';

interface ReleaseStudent {
  studentId: string;
  studentName: string | null;
  status: 'complete' | 'incomplete' | 'in_progress' | null;
  numericScore?: string | number | null;
  letterGrade?: string | null;
}

interface ReleasePreflight {
  releaseStatus: ReleaseStatus;
  activeReleaseVersion: number | null;
  publishedAt: Date | null;
  eligible: ReleaseStudent[];
  incomplete: ReleaseStudent[];
  missing: ReleaseStudent[];
  eligibleStudents?: ReleaseStudent[];
  incompleteStudents?: ReleaseStudent[];
  missingStudents?: ReleaseStudent[];
  counts: {
    eligible: number;
    incomplete: number;
    missing: number;
  };
}

interface GradeReleaseControlsProps {
  assignmentId: number;
  releaseStatus: ReleaseStatus;
  activeReleaseVersion: number | null;
  publishedAt: Date | null;
  canManage: boolean;
  onChanged?: () => void;
}

type DialogName = 'publish' | 'withdraw' | null;
type FeedbackKey =
  | 'gradebook.release.publishSuccess'
  | 'gradebook.release.withdrawSuccess'
  | 'gradebook.release.publishError'
  | 'gradebook.release.withdrawError';

export function GradeReleaseControls({
  assignmentId,
  releaseStatus,
  activeReleaseVersion,
  publishedAt,
  canManage,
  onChanged,
}: GradeReleaseControlsProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<DialogName>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [validationError, setValidationError] = useState<'gradebook.release.reasonRequired' | null>(
    null,
  );
  const [feedback, setFeedback] = useState<FeedbackKey | null>(null);

  const preflightQuery = useQuery<ReleasePreflight>({
    queryKey: ['gradebook', 'releasePreflight', assignmentId],
    enabled: false,
    queryFn: async () => {
      const result = await getGradeReleasePreflight({ data: { assignmentId } });
      if (isServerError(result)) throw new Error(result.error.message);
      return result;
    },
  });

  const invalidateGradebook = async () => {
    await queryClient.invalidateQueries({ queryKey: ['gradebook'] });
    onChanged?.();
  };

  const publishMutation = useMutation({
    mutationFn: async () => {
      const result = await publishGradeRelease({ data: { assignmentId, confirmed: true } });
      if (isServerError(result)) throw new Error(result.error.message);
      return result;
    },
    onSuccess: async () => {
      setDialog(null);
      setConfirmed(false);
      setFeedback('gradebook.release.publishSuccess');
      toast.success(t('gradebook.release.publishSuccess'));
      await invalidateGradebook();
    },
    onError: () => {
      setFeedback('gradebook.release.publishError');
      toast.error(t('gradebook.release.publishError'));
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async (reason: string) => {
      const result = await withdrawGradeRelease({ data: { assignmentId, reason } });
      if (isServerError(result)) throw new Error(result.error.message);
      return result;
    },
    onSuccess: async () => {
      setDialog(null);
      setWithdrawReason('');
      setFeedback('gradebook.release.withdrawSuccess');
      toast.success(t('gradebook.release.withdrawSuccess'));
      await invalidateGradebook();
    },
    onError: () => {
      setFeedback('gradebook.release.withdrawError');
      toast.error(t('gradebook.release.withdrawError'));
    },
  });

  if (!canManage) return null;

  const eligible = preflightQuery.data?.eligible ?? preflightQuery.data?.eligibleStudents ?? [];
  const incomplete =
    preflightQuery.data?.incomplete ?? preflightQuery.data?.incompleteStudents ?? [];
  const missing = preflightQuery.data?.missing ?? preflightQuery.data?.missingStudents ?? [];

  const openPublish = () => {
    setFeedback(null);
    setValidationError(null);
    setConfirmed(false);
    setDialog('publish');
    void preflightQuery.refetch();
  };

  const openWithdraw = () => {
    setFeedback(null);
    setValidationError(null);
    setWithdrawReason('');
    setDialog('withdraw');
  };

  const submitWithdraw = () => {
    const reason = withdrawReason.trim();
    if (!reason) {
      setValidationError('gradebook.release.reasonRequired');
      return;
    }
    setValidationError(null);
    withdrawMutation.mutate(reason);
  };

  return (
    <div
      data-testid="grade-release-controls"
      className="space-y-3 rounded-lg border bg-card p-4"
      aria-label={t('gradebook.release.status')}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{t('gradebook.release.status')}</span>
        <Badge variant={releaseStatus === 'published' ? 'default' : 'secondary'}>
          {releaseStatus === 'published'
            ? t('gradebook.release.published')
            : t('gradebook.release.draft')}
        </Badge>
        {releaseStatus === 'published' && activeReleaseVersion !== null && (
          <span className="text-sm text-muted-foreground">
            {t('gradebook.release.version', { version: String(activeReleaseVersion) })}
          </span>
        )}
        {releaseStatus === 'published' && publishedAt && (
          <span className="text-sm text-muted-foreground">
            {t('gradebook.student.publishedAt')}: {publishedAt.toLocaleDateString()}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {releaseStatus === 'draft' ? (
          <Button type="button" className="min-h-11" onClick={openPublish}>
            {t('gradebook.release.startPublish')}
          </Button>
        ) : (
          <Button type="button" variant="outline" className="min-h-11" onClick={openWithdraw}>
            {t('gradebook.release.withdraw')}
          </Button>
        )}
      </div>

      {feedback && (
        <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
          {t(feedback)}
        </p>
      )}

      <Dialog open={dialog === 'publish'} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('gradebook.release.preflightTitle')}</DialogTitle>
            <DialogDescription>{t('gradebook.release.preflightDescription')}</DialogDescription>
          </DialogHeader>
          {preflightQuery.isFetching && (
            <p role="status">{t('gradebook.release.publishLoading')}</p>
          )}
          {preflightQuery.isError && <p role="alert">{t('gradebook.release.preflightError')}</p>}
          {preflightQuery.data && (
            <div className="space-y-3">
              <ul className="space-y-1 text-sm" aria-label={t('gradebook.release.preflightTitle')}>
                <li>{t('gradebook.release.eligibleCount', { count: String(eligible.length) })}</li>
                <li>
                  {t('gradebook.release.incompleteCount', { count: String(incomplete.length) })}
                </li>
                <li>{t('gradebook.release.missingCount', { count: String(missing.length) })}</li>
              </ul>
              {[...eligible, ...incomplete, ...missing].length > 0 && (
                <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                  {[...eligible, ...incomplete, ...missing].map((student) => (
                    <li key={student.studentId}>{student.studentName ?? student.studentId}</li>
                  ))}
                </ul>
              )}
              <label className="flex min-h-11 items-center gap-2 text-sm" htmlFor="release-confirm">
                <Checkbox
                  id="release-confirm"
                  checked={confirmed}
                  onClick={() => setConfirmed((value) => !value)}
                />
                <span>{t('gradebook.release.confirmPublish')}</span>
              </label>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => setDialog(null)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              className="min-h-11"
              disabled={!confirmed || preflightQuery.isFetching || publishMutation.isPending}
              onClick={() => publishMutation.mutate()}
            >
              {t('gradebook.release.publish')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === 'withdraw'} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('gradebook.release.withdrawTitle')}</DialogTitle>
            <DialogDescription>{t('gradebook.release.withdrawDescription')}</DialogDescription>
          </DialogHeader>
          <label className="space-y-2 text-sm font-medium" htmlFor="withdraw-reason">
            <span>{t('gradebook.release.withdrawReason')}</span>
            <Textarea
              id="withdraw-reason"
              value={withdrawReason}
              placeholder={t('gradebook.release.withdrawReasonPlaceholder')}
              onChange={(event) => setWithdrawReason(event.target.value)}
              aria-invalid={validationError !== null}
            />
          </label>
          {validationError && <p role="alert">{t(validationError)}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => setDialog(null)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              className="min-h-11"
              disabled={withdrawMutation.isPending}
              onClick={submitWithdraw}
            >
              {withdrawMutation.isPending
                ? t('gradebook.release.withdrawLoading')
                : t('gradebook.release.confirmWithdraw')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
