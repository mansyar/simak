import { useQuery } from '@tanstack/react-query';
import { FileBarChart } from 'lucide-react';
import { useI18n } from '@/routes/__root';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { ReportCard } from '@/components/reporting/ReportCard';
import { ReportHistory } from '@/components/reporting/ReportHistory';
import { getErrorTranslationKey, isServerError } from '@/lib/errors';
import { reportKeys } from '@/lib/query-keys';
import type { ReportingRole } from '@/lib/reporting-policy';
import { getReportCatalog } from '@/server/reporting';

type ReportCatalogControlsProps = {
  role: ReportingRole;
};

function CatalogLoading() {
  const { t } = useI18n();

  return (
    <div role="status" className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('reports.loading')}</p>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}

export function ReportCatalogControls({ role }: ReportCatalogControlsProps) {
  const { t } = useI18n();

  const catalogQuery = useQuery({
    queryKey: reportKeys.catalog(role),
    queryFn: async () => {
      const result = await getReportCatalog({ data: {} });
      if (isServerError(result)) {
        throw new Error(t(getErrorTranslationKey(result.error.code)));
      }
      return result;
    },
    retry: false,
  });

  const { data } = catalogQuery;

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <p className="font-mono text-xs font-semibold tracking-[0.2em] text-primary uppercase">
          {t('reports.eyebrow')}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{t('reports.title')}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t(`reports.subtitle.${role}`)}</p>
      </header>

      {catalogQuery.isPending && <CatalogLoading />}

      {catalogQuery.isError && (
        <ErrorState
          title={t('reports.loadError')}
          description={catalogQuery.error instanceof Error ? catalogQuery.error.message : undefined}
          retryLabel={t('common.retry')}
          onRetry={() => catalogQuery.refetch()}
        />
      )}

      {data && data.reports.length === 0 && (
        <EmptyState
          icon={FileBarChart}
          title={t('reports.empty')}
          description={t('reports.emptyDescription')}
        />
      )}

      {data && data.reports.length > 0 && (
        <section aria-label={t('reports.catalogLabel')} className="grid gap-6 lg:grid-cols-2">
          {data.reports.map((reportType) => (
            <ReportCard
              key={reportType}
              reportType={reportType}
              role={role}
              options={data.filters}
            />
          ))}
        </section>
      )}

      <ReportHistory role={role} />
    </div>
  );
}
