import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { getInstructorAnalyticsData } from '@/server/analytics';
import { useI18n } from '../../__root';
import { PageHeader } from '@/components/ui/page-header';
import { MetricCard } from '@/components/ui/metric-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isServerError } from '@/lib/errors';
import { DashboardSkeleton } from '@/components/skeletons/dashboard-skeleton';
import { CheckCircle, Clock, AlertTriangle, Users, ClipboardList } from 'lucide-react';

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
    return getInstructorAnalyticsData({ data: deps });
  },
  component: InstructorAnalyticsPage,
  pendingComponent: () => <DashboardSkeleton />,
});

type InstructorAnalyticsData = {
  reviewsCompleted: number;
  averageResponseTimeHours: number | null;
  slaBreachCount: number;
  studentsSupervised: number;
  assignmentsActive: number;
  dateRange: { start: string | null; end: string | null };
};

type AnalyticsSearchParams = {
  range?: '7d' | '30d' | '90d' | 'all';
  start?: string;
  end?: string;
};

function InstructorAnalyticsPage() {
  const { t } = useI18n();
  const data = Route.useLoaderData() as unknown as InstructorAnalyticsData;
  const searchParams = Route.useSearch() as unknown as AnalyticsSearchParams;
  const navigate = Route.useNavigate();

  if (isServerError(data)) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t('instructorAnalytics.title')}
          subtitle={t('instructorAnalytics.subtitle')}
        />
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          {data.error.message}
        </div>
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('instructorAnalytics.title')}
        subtitle={t('instructorAnalytics.subtitle')}
      />

      {/* Date Range Selector */}
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
            data.averageResponseTimeHours !== null ? `${data.averageResponseTimeHours}h` : 'N/A'
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
    </div>
  );
}
