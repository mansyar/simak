import { useQuery } from '@tanstack/react-query';
import { FileStack } from 'lucide-react';
import { useI18n } from '@/routes/__root';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { ReportHistoryItem } from '@/components/reporting/ReportHistoryItem';
import { getErrorTranslationKey, isServerError } from '@/lib/errors';
import { hasActiveReportJobs, toReportHistoryJob } from '@/lib/reporting-history';
import type { ReportHistoryJob } from '@/lib/reporting-history';
import { reportKeys } from '@/lib/query-keys';
import type { ReportingRole } from '@/lib/reporting-policy';
import { getReportHistory } from '@/server/reporting';

type ReportHistoryProps = {
  role: ReportingRole;
};

const HISTORY_LIMIT = 20;
const ACTIVE_POLL_INTERVAL_MS = 5000;

function HistoryLoading() {
  const { t } = useI18n();

  return (
    <div role="status" className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('reports.history.loading')}</p>
      <Skeleton className="h-20" />
      <Skeleton className="h-20" />
    </div>
  );
}

export function ReportHistory({ role }: ReportHistoryProps) {
  const { t } = useI18n();

  const historyQuery = useQuery({
    queryKey: reportKeys.history(role),
    queryFn: async () => {
      const result = await getReportHistory({ data: { limit: HISTORY_LIMIT } });
      if (isServerError(result)) {
        throw new Error(t(getErrorTranslationKey(result.error.code)));
      }
      return result.jobs.map(toReportHistoryJob).filter((j): j is ReportHistoryJob => j !== null);
    },
    retry: false,
    refetchInterval: (query) =>
      hasActiveReportJobs(query.state.data ?? []) ? ACTIVE_POLL_INTERVAL_MS : false,
  });

  const jobs = historyQuery.data ?? [];
  const activeCount = jobs.filter((job) => hasActiveReportJobs([job])).length;

  return (
    <section aria-labelledby="report-history-title" className="space-y-4">
      <div className="space-y-1">
        <h2 id="report-history-title" className="text-lg font-semibold tracking-tight">
          {t('reports.history.title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('reports.history.description')}</p>
      </div>

      {historyQuery.isPending && <HistoryLoading />}

      {historyQuery.isError && (
        <ErrorState
          title={t('reports.history.loadError')}
          description={historyQuery.error instanceof Error ? historyQuery.error.message : undefined}
          retryLabel={t('common.retry')}
          onRetry={() => historyQuery.refetch()}
        />
      )}

      {historyQuery.isSuccess && jobs.length === 0 && (
        <EmptyState
          icon={FileStack}
          title={t('reports.history.empty')}
          description={t('reports.history.emptyDescription')}
        />
      )}

      {historyQuery.isSuccess && jobs.length > 0 && (
        <>
          <ul role="list" aria-label={t('reports.history.listLabel')} className="space-y-3">
            {jobs.map((job) => (
              <ReportHistoryItem
                key={job.id}
                job={job}
                onJobChanged={() => historyQuery.refetch()}
              />
            ))}
          </ul>
          <p className="sr-only" role="status" aria-live="polite">
            {activeCount > 0
              ? t('reports.history.activeFeedback', { count: String(activeCount) })
              : t('reports.history.upToDateFeedback', { count: String(jobs.length) })}
          </p>
        </>
      )}
    </section>
  );
}
