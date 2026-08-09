import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useI18n } from '@/routes/__root';
import { Button } from '@/components/ui/button';
import { MutationFeedback } from '@/components/ui/mutation-feedback';
import { formatDate } from '@/lib/format-date';
import { getErrorTranslationKey, isServerError } from '@/lib/errors';
import { isReportDownloadable, isReportExpired } from '@/lib/reporting-history';
import type { ReportHistoryJob } from '@/lib/reporting-history';
import type { TranslationKey } from '@/i18n/index';
import { downloadReport, retryReport } from '@/server/reporting';

type ReportHistoryItemProps = {
  job: ReportHistoryJob;
  onJobChanged: () => void;
};

const REPORT_STATE_KEYS: Record<ReportHistoryJob['state'], TranslationKey> = {
  pending: 'reports.history.state.pending',
  processing: 'reports.history.state.processing',
  completed: 'reports.history.state.completed',
  failed: 'reports.history.state.failed',
  expired: 'reports.history.state.expired',
};

function openDownloadUrl(downloadUrl: string) {
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function ReportHistoryItem({ job, onJobChanged }: ReportHistoryItemProps) {
  const { t, locale } = useI18n();
  const [error, setError] = useState<string | null>(null);

  const downloadMutation = useMutation({
    mutationFn: async () => {
      const result = await downloadReport({ data: { jobId: job.id } });
      if (isServerError(result)) {
        throw new Error(t(getErrorTranslationKey(result.error.code)));
      }
      return result.downloadUrl;
    },
    onSuccess: (downloadUrl) => {
      setError(null);
      openDownloadUrl(downloadUrl);
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : t('error.internal'));
    },
  });

  const retryMutation = useMutation({
    mutationFn: async () => {
      const result = await retryReport({ data: { jobId: job.id } });
      if (isServerError(result)) {
        throw new Error(t(getErrorTranslationKey(result.error.code)));
      }
      return result.job;
    },
    onSuccess: () => {
      setError(null);
      onJobChanged();
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : t('error.internal'));
    },
  });

  const derivedExpired = isReportExpired(job);
  const displayState: ReportHistoryJob['state'] = derivedExpired ? 'expired' : job.state;
  const downloadable = isReportDownloadable(job);
  const busy = downloadMutation.isPending || retryMutation.isPending;

  return (
    <li
      className="flex flex-col gap-3 rounded-md border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
      aria-busy={busy}
    >
      <div className="min-w-0 space-y-1">
        <p className="font-medium text-sm">
          {t(`reports.types.${job.reportType}.name` as TranslationKey)}
        </p>
        <p className="text-xs text-muted-foreground">
          {t('reports.history.requestedLabel', { date: formatDate(job.createdAt, locale, 'time') })}
        </p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="rounded-full border px-2 py-0.5 font-medium text-foreground">
            {t(REPORT_STATE_KEYS[displayState])}
          </span>
          {job.state === 'completed' && job.completedAt && (
            <span>
              {t('reports.history.generatedLabel', {
                date: formatDate(job.completedAt, locale, 'time'),
              })}
            </span>
          )}
          {job.state === 'completed' && job.expiresAt && (
            <span>
              {t('reports.history.expiresLabel', {
                date: formatDate(job.expiresAt, locale, 'short'),
              })}
            </span>
          )}
        </p>
        {derivedExpired && (
          <p className="text-xs text-muted-foreground">{t('reports.history.expiredHint')}</p>
        )}
        {error && <MutationFeedback error={error} />}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {downloadable && (
          <Button
            type="button"
            onClick={() => downloadMutation.mutate()}
            disabled={busy}
            loading={downloadMutation.isPending}
          >
            {downloadMutation.isPending
              ? t('reports.history.downloading')
              : t('reports.history.download')}
          </Button>
        )}
        {job.state === 'failed' && (
          <Button
            type="button"
            variant="outline"
            onClick={() => retryMutation.mutate()}
            disabled={busy}
            loading={retryMutation.isPending}
          >
            {retryMutation.isPending ? t('reports.history.retrying') : t('reports.history.retry')}
          </Button>
        )}
      </div>
    </li>
  );
}
