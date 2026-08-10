import { useCallback, useEffect, useState } from 'react';
import { BarChart3, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { isServerError } from '@/lib/errors';
import { useI18n } from '@/routes/__root';
import { listAcademicTerms } from '@/server/academic-context';
import { getAdminRiskTrends } from '@/server/risk-history';
import type { TranslationKey } from '@/i18n';

type Props = {
  termId?: number;
  courseId?: number;
  sectionId?: number;
  from: string;
  to: string;
};

type TrendResult = {
  suppressed: boolean;
  minimumCohortSize: number;
  cohortSize: number;
  trends: { date: string; riskLevel: 'low' | 'medium' | 'high'; observationCount: number }[];
};

type Term = { id: number; name: string; code: string };

export function AdminRiskHistorySection({ from, to }: { from?: string; to?: string }) {
  const { t } = useI18n();
  const [terms, setTerms] = useState<Term[]>([]);
  const [termId, setTermId] = useState<number>();

  useEffect(() => {
    void listAcademicTerms({ data: { page: 1, limit: 100, search: '', status: '' } }).then(
      (response) => {
        if (!isServerError(response) && response.terms.length) {
          setTerms(response.terms);
          setTermId(response.terms[0].id);
        }
      },
    );
  }, []);

  const today = new Date();
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - 30);
  return (
    <section className="space-y-3" aria-labelledby="risk-history-filter-label">
      <label id="risk-history-filter-label" className="text-sm font-medium" htmlFor="risk-term">
        {t('riskHistory.admin.termFilter')}
      </label>
      <select
        id="risk-term"
        className="min-h-11 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-xs"
        value={termId ?? ''}
        onChange={(event) => setTermId(Number(event.target.value))}
      >
        <option value="" disabled>
          {t('riskHistory.admin.selectTerm')}
        </option>
        {terms.map((term) => (
          <option key={term.id} value={term.id}>
            {term.code} — {term.name}
          </option>
        ))}
      </select>
      {termId ? (
        <AdminRiskTrendsPanel
          termId={termId}
          from={from ?? start.toISOString().slice(0, 10)}
          to={to ?? today.toISOString().slice(0, 10)}
        />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <EmptyState icon={BarChart3} title={t('riskHistory.admin.selectTerm')} />
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function riskLabel(level: 'low' | 'medium' | 'high', t: (key: TranslationKey) => string) {
  if (level === 'high') return t('riskHistory.level.high');
  if (level === 'medium') return t('riskHistory.level.medium');
  return t('riskHistory.level.low');
}

export function AdminRiskTrendsPanel({ termId, courseId, sectionId, from, to }: Props) {
  const { t } = useI18n();
  const [result, setResult] = useState<TrendResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const response = await getAdminRiskTrends({
        data: {
          termId: termId ?? null,
          courseId: courseId ?? null,
          sectionId: sectionId ?? null,
          from,
          to,
        },
      });
      if (isServerError(response)) setFailed(true);
      else setResult(response as TrendResult);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [courseId, from, sectionId, termId, to]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card aria-labelledby="risk-trends-title">
      <CardHeader>
        <CardTitle id="risk-trends-title">{t('riskHistory.admin.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div role="status" aria-label={t('riskHistory.admin.loading')} className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : failed ? (
          <ErrorState
            title={t('riskHistory.admin.error')}
            retryLabel={t('common.retry')}
            onRetry={() => void load()}
          />
        ) : result?.suppressed ? (
          <EmptyState
            icon={ShieldCheck}
            title={t('riskHistory.admin.suppressedTitle')}
            description={t('riskHistory.admin.suppressedDescription')}
          />
        ) : !result?.trends.length ? (
          <EmptyState icon={BarChart3} title={t('riskHistory.admin.empty')} />
        ) : (
          <div className="space-y-3" aria-label={t('riskHistory.admin.aggregateList')}>
            {result.trends.map((trend) => (
              <div
                key={`${trend.date}-${trend.riskLevel}`}
                className="flex min-h-11 flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3"
              >
                <time dateTime={trend.date} className="font-medium">
                  {trend.date}
                </time>
                <div className="flex items-center gap-3">
                  <Badge variant={trend.riskLevel === 'high' ? 'destructive' : 'outline'}>
                    {riskLabel(trend.riskLevel, t)}
                  </Badge>
                  <span aria-label={t('riskHistory.admin.observationCount')}>
                    {trend.observationCount}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
