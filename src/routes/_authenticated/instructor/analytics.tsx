import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { getInstructorAnalyticsData, getInstructorRubricAnalytics } from '@/server/analytics';
import { useI18n } from '../../__root';
import { PageHeader } from '@/components/ui/page-header';
import { MetricCard } from '@/components/ui/metric-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getErrorTranslationKey, isServerError } from '@/lib/errors';
import { ErrorState } from '@/components/ui/error-state';
import { DashboardSkeleton } from '@/components/skeletons/dashboard-skeleton';
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  Users,
  ClipboardList,
  FileSpreadsheet,
} from 'lucide-react';
import { exportToExcel } from '@/lib/excel-export';

const AnalyticsSearchSchema = z.object({
  range: z.enum(['7d', '30d', '90d', 'all']).optional(),
  start: z.string().optional(),
  end: z.string().optional(),
});

const RANGE_OPTIONS = [
  { value: '7d', labelKey: 'instructorAnalytics.range7d' },
  { value: '30d', labelKey: 'instructorAnalytics.range30d' },
  { value: '90d', labelKey: 'instructorAnalytics.range90d' },
  { value: 'all', labelKey: 'instructorAnalytics.rangeAll' },
] as const;

export const Route = createFileRoute('/_authenticated/instructor/analytics')({
  validateSearch: (search: Record<string, unknown>) => AnalyticsSearchSchema.parse(search),
  loaderDeps: ({ search }) => ({
    range: search.range,
    start: search.start,
    end: search.end,
  }),
  loader: async ({ deps }) => {
    const [analytics, rubric] = await Promise.all([
      getInstructorAnalyticsData({ data: deps }),
      getInstructorRubricAnalytics({ data: deps }),
    ]);
    return { analytics, rubric };
  },
  component: InstructorAnalyticsPage,
  pendingComponent: () => <DashboardSkeleton />,
});

type AnalyticsSearchParams = {
  range?: '7d' | '30d' | '90d' | 'all';
  start?: string;
  end?: string;
};

function InstructorAnalyticsPage() {
  const { t } = useI18n();
  const loaderData = Route.useLoaderData();
  const data = loaderData.analytics;
  const rubricData = loaderData.rubric;
  const searchParams = Route.useSearch();
  const navigate = Route.useNavigate();

  if (isServerError(data)) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t('instructorAnalytics.title')}
          subtitle={t('instructorAnalytics.subtitle')}
        />
        <ErrorState
          title={t(getErrorTranslationKey(data.error.code))}
          retryLabel={t('common.refresh')}
          onRetry={() => navigate({ search: searchParams })}
        />
      </div>
    );
  }

  const activeRange = searchParams.range ?? '30d';

  const handleRangeChange = (range: '7d' | '30d' | '90d' | 'all') => {
    navigate({
      search: (prev: AnalyticsSearchParams) => ({
        ...prev,
        range,
        start: undefined,
        end: undefined,
      }),
    });
  };

  const handleDateChange = (field: 'start' | 'end', value: string) => {
    navigate({
      search: (prev: AnalyticsSearchParams) => ({
        ...prev,
        [field]: value || undefined,
        range: undefined,
      }),
    });
  };

  const handleExportExcel = () => {
    const rows: Record<string, unknown>[] = [
      { Metric: t('instructorAnalytics.reviewsCompleted'), Value: data.reviewsCompleted },
      {
        Metric: t('instructorAnalytics.averageResponseTimeHours'),
        Value:
          data.averageResponseTimeHours === null
            ? t('instructorAnalytics.notAvailable')
            : t('instructorAnalytics.responseHours', {
                value: String(data.averageResponseTimeHours),
              }),
      },
      { Metric: t('instructorAnalytics.slaBreachCount'), Value: data.slaBreachCount },
      { Metric: t('instructorAnalytics.studentsSupervised'), Value: data.studentsSupervised },
      { Metric: t('instructorAnalytics.assignmentsActive'), Value: data.assignmentsActive },
    ];
    exportToExcel(rows, 'Instructor Analytics', 'instructor-analytics.xlsx');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('instructorAnalytics.title')}
        subtitle={t('instructorAnalytics.subtitle')}
        action={
          <Button variant="outline" onClick={handleExportExcel}>
            <FileSpreadsheet className="mr-2 h-4 w-4" aria-hidden="true" />
            {t('common.exportExcel')}
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        {RANGE_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant={activeRange === opt.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleRangeChange(opt.value)}
          >
            {t(opt.labelKey)}
          </Button>
        ))}
        <span className="text-muted-foreground">|</span>
        <Input
          type="date"
          aria-label={t('instructorAnalytics.customStart')}
          value={searchParams.start ?? ''}
          onChange={(e) => handleDateChange('start', e.target.value)}
          className="w-[160px]"
        />
        <span className="text-muted-foreground">-</span>
        <Input
          type="date"
          aria-label={t('instructorAnalytics.customEnd')}
          value={searchParams.end ?? ''}
          onChange={(e) => handleDateChange('end', e.target.value)}
          className="w-[160px]"
        />
      </div>

      {/* Metric Cards */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label={t('instructorAnalytics.reviewsCompleted')}
          value={data.reviewsCompleted}
          icon={CheckCircle}
          color="primary"
        />
        <MetricCard
          label={t('instructorAnalytics.avgResponseTime')}
          value={
            data.averageResponseTimeHours !== null
              ? t('instructorAnalytics.responseHours', {
                  value: String(data.averageResponseTimeHours),
                })
              : t('instructorAnalytics.notAvailable')
          }
          icon={Clock}
          color="info"
        />
        <MetricCard
          label={t('instructorAnalytics.slaBreachCount')}
          value={data.slaBreachCount}
          icon={AlertTriangle}
          color="error"
        />
        <MetricCard
          label={t('instructorAnalytics.studentsSupervised')}
          value={data.studentsSupervised}
          icon={Users}
          color="success"
        />
        <MetricCard
          label={t('instructorAnalytics.assignmentsActive')}
          value={data.assignmentsActive}
          icon={ClipboardList}
          color="primary"
        />
      </div>

      {/* Rubric Analytics Section */}
      {'criteria' in rubricData && rubricData.criteria.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">{t('instructorAnalytics.rubricTitle')}</h2>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left font-medium">
                    {t('instructorAnalytics.rubricCriterion')}
                  </th>
                  <th className="p-3 text-right font-medium">
                    {t('instructorAnalytics.rubricAvgScore')}
                  </th>
                  <th className="p-3 text-right font-medium">
                    {t('instructorAnalytics.rubricPassRate')}
                  </th>
                  <th className="p-3 text-right font-medium">
                    {t('instructorAnalytics.rubricReviewCount')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rubricData.criteria.map((c) => (
                  <tr key={c.criterionId} className="border-b last:border-0">
                    <td className="p-3">{c.criterionTitle}</td>
                    <td className="p-3 text-right">{c.avgScore}</td>
                    <td className="p-3 text-right">{c.passRate}%</td>
                    <td className="p-3 text-right">{c.reviewCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
