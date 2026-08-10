import { useCallback, useEffect, useState } from 'react';
import { Activity, History } from 'lucide-react';
import { listInstructorRiskHistory } from '@/server/risk-history';
import { useI18n } from '@/routes/__root';
import { isServerError } from '@/lib/errors';
import { formatDate } from '@/lib/format-date';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';

type StudentOption = { id: string | number; name: string };
type RiskLevel = 'low' | 'medium' | 'high';
type Observation = {
  id: number;
  source: 'lifecycle_event' | 'daily_snapshot';
  eventType: string | null;
  observedAt: Date;
  algorithmVersion: string;
  riskLevel: RiskLevel;
  factors: Array<{ code: string; category: string; severity: RiskLevel }>;
};
type InterventionBasis = {
  id: number;
  actionType: string;
  status: string;
  followUpDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
type HistoryResult = {
  observations: Observation[];
  total: number;
  page: number;
  limit: number;
  outcomes: {
    facts: {
      checkpointTotal: number;
      checkpointPassed: number;
      submissionCount: number;
      reviewCount: number;
      verifiedConsultationCount: number;
    };
    interpretation: { academicProgress: string; engagement: string };
    interventionBasis: InterventionBasis[];
  };
};

type Props = { assignmentId: number; students: StudentOption[] };

function parseDateStart(value: string) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function parseDateEnd(value: string) {
  return value ? new Date(`${value}T23:59:59.999Z`) : null;
}

const riskBadge = { low: 'success', medium: 'warning', high: 'destructive' } as const;
export function InstructorRiskHistoryTab({ assignmentId, students }: Props) {
  const { locale, t } = useI18n();
  const academicLabel = (value: string) => {
    if (value === 'complete') return t('riskHistory.interpretation.academic.complete');
    if (value === 'in_progress') return t('riskHistory.interpretation.academic.in_progress');
    return t('riskHistory.interpretation.academic.not_started');
  };
  const engagementLabel = (value: string) =>
    value === 'engaged'
      ? t('riskHistory.interpretation.engagement.engaged')
      : t('riskHistory.interpretation.engagement.no_recorded_engagement');
  const eventLabel = (value: string | null) => {
    if (value === 'checkpoint_updated') return t('riskHistory.event.checkpoint_updated');
    if (value === 'submission_recorded') return t('riskHistory.event.submission_recorded');
    if (value === 'review_recorded') return t('riskHistory.event.review_recorded');
    if (value === 'consultation_verified') return t('riskHistory.event.consultation_verified');
    if (value === 'intervention_updated') return t('riskHistory.event.intervention_updated');
    return t('riskHistory.event.daily_snapshot');
  };
  const riskLevelLabel = (value: 'low' | 'medium' | 'high') => {
    if (value === 'low') return t('riskHistory.level.low');
    if (value === 'medium') return t('riskHistory.level.medium');
    return t('riskHistory.level.high');
  };
  const [studentId, setStudentId] = useState(() => String(students[0]?.id ?? ''));
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [filters, setFilters] = useState({ from: '', to: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<HistoryResult | null>(null);
  const [loading, setLoading] = useState(students.length > 0);
  const [failed, setFailed] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    setFailed(false);
    try {
      const result = await listInstructorRiskHistory({
        data: {
          assignmentId,
          studentId,
          from: parseDateStart(filters.from),
          to: parseDateEnd(filters.to),
          page,
          limit: 20,
        },
      });
      if (isServerError(result)) {
        setFailed(true);
        return;
      }
      setData(result as HistoryResult);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [assignmentId, filters, page, studentId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  if (students.length === 0) {
    return <EmptyState icon={History} title={t('riskHistory.noStudents')} />;
  }

  const applyFilters = () => {
    setPage(1);
    setFilters({ from, to });
  };
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 20));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('riskHistory.filters.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,1fr)_1fr_1fr_auto] lg:items-end">
            <label className="grid gap-1.5 text-sm font-medium">
              {t('riskHistory.filters.student')}
              <select
                value={studentId}
                onChange={(event) => {
                  setStudentId(event.target.value);
                  setPage(1);
                }}
                className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {students.map((student) => (
                  <option key={student.id} value={String(student.id)}>
                    {student.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              {t('riskHistory.filters.from')}
              <input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(event) => setFrom(event.target.value)}
                className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              {t('riskHistory.filters.to')}
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(event) => setTo(event.target.value)}
                className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </label>
            <Button type="button" onClick={applyFilters}>
              {t('riskHistory.filters.apply')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-3" aria-live="polite">
          <span className="sr-only">{t('riskHistory.loading')}</span>
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : failed ? (
        <ErrorState
          title={t('riskHistory.error.title')}
          description={t('riskHistory.error.description')}
          retryLabel={t('common.retry')}
          onRetry={() => void loadHistory()}
        />
      ) : data ? (
        <>
          <section aria-labelledby="risk-history-outcomes" className="space-y-4">
            <h2 id="risk-history-outcomes" className="font-display text-2xl font-semibold">
              {t('riskHistory.outcomes.title')}
            </h2>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>{t('riskHistory.outcomes.facts')}</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                  <Fact
                    label={t('riskHistory.facts.checkpoints')}
                    value={`${data.outcomes.facts.checkpointPassed}/${data.outcomes.facts.checkpointTotal}`}
                  />
                  <Fact
                    label={t('riskHistory.facts.submissions')}
                    value={data.outcomes.facts.submissionCount}
                  />
                  <Fact
                    label={t('riskHistory.facts.reviews')}
                    value={data.outcomes.facts.reviewCount}
                  />
                  <Fact
                    label={t('riskHistory.facts.consultations')}
                    value={data.outcomes.facts.verifiedConsultationCount}
                  />
                  <Fact
                    label={t('riskHistory.facts.interventions')}
                    value={data.outcomes.interventionBasis.length}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>{t('riskHistory.outcomes.interpretation')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <Interpretation
                    label={t('riskHistory.interpretation.academicLabel')}
                    value={academicLabel(data.outcomes.interpretation.academicProgress)}
                  />
                  <Interpretation
                    label={t('riskHistory.interpretation.engagementLabel')}
                    value={engagementLabel(data.outcomes.interpretation.engagement)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('riskHistory.outcomes.interpretationNote')}
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>

          <section aria-labelledby="risk-history-timeline" className="space-y-4">
            <h2 id="risk-history-timeline" className="font-display text-2xl font-semibold">
              {t('riskHistory.timeline.title')}
            </h2>
            {data.observations.length === 0 ? (
              <EmptyState
                icon={Activity}
                title={t('riskHistory.empty.title')}
                description={t('riskHistory.empty.description')}
              />
            ) : (
              <ol className="relative space-y-4 border-l border-border pl-6">
                {data.observations.map((observation) => (
                  <li
                    key={observation.id}
                    className="relative rounded-lg border bg-card p-4 shadow-sm"
                  >
                    <span
                      className="absolute -left-[1.93rem] top-5 size-3 rounded-full border-2 border-background bg-primary"
                      aria-hidden="true"
                    />
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{eventLabel(observation.eventType)}</h3>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(observation.observedAt, locale, 'time')}
                        </p>
                      </div>
                      <Badge variant={riskBadge[observation.riskLevel]}>
                        {riskLevelLabel(observation.riskLevel)}
                      </Badge>
                    </div>
                    {observation.factors.length > 0 && (
                      <div
                        className="mt-3 flex flex-wrap gap-2"
                        aria-label={t('riskHistory.timeline.factors')}
                      >
                        {observation.factors.map((factor) => (
                          <Badge key={`${observation.id}-${factor.code}`} variant="outline">
                            {factor.code}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
            {data.total > 0 && (
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                showCounter
              />
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function Interpretation({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md bg-muted/40 p-3">
      <span className="text-muted-foreground">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
