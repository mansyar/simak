import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { getAdminAnalyticsData } from '@/server/analytics';
import { useI18n } from '../../__root';
import { PageHeader } from '@/components/ui/page-header';
import { MetricCard } from '@/components/ui/metric-card';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { isServerError } from '@/lib/errors';
import { DashboardSkeleton } from '@/components/skeletons/dashboard-skeleton';
import { ShieldCheck, AlertTriangle, CheckCircle, BarChart3, Download } from 'lucide-react';
import { exportAssignmentProgressCsv } from '@/server/analytics';
import { useCsvDownload } from '@/hooks/use-csv-download';

const AnalyticsSearchSchema = z.object({
  range: z.enum(['7d', '30d', '90d', 'all']).optional(),
  start: z.string().optional(),
  end: z.string().optional(),
});

const RANGE_OPTIONS = [
  { value: '7d', labelKey: 'adminAnalytics.range7d' },
  { value: '30d', labelKey: 'adminAnalytics.range30d' },
  { value: '90d', labelKey: 'adminAnalytics.range90d' },
  { value: 'all', labelKey: 'adminAnalytics.rangeAll' },
] as const;

export const Route = createFileRoute('/_authenticated/admin/analytics')({
  validateSearch: (search: Record<string, unknown>) => AnalyticsSearchSchema.parse(search),
  loaderDeps: ({ search }) => ({
    range: search.range,
    start: search.start,
    end: search.end,
  }),
  loader: async ({ deps }) => {
    return getAdminAnalyticsData({ data: deps });
  },
  component: AdminAnalyticsPage,
  pendingComponent: () => <DashboardSkeleton />,
});

type AdminAnalyticsData = {
  consultationVerificationRate: number;
  deadlineBreachRate: number;
  statusDistribution: { state: string; count: number }[];
  submissionTrend: { date: string; count: number }[];
  reviewTrend: { date: string; count: number }[];
  reviewsCompleted: number;
  dauTrend: { date: string; activeUsers: number }[];
  wauTrend: { date: string; activeUsers: number }[];
  dateRange: { start: string | null; end: string | null };
};

type AnalyticsSearchParams = {
  range?: '7d' | '30d' | '90d' | 'all';
  start?: string;
  end?: string;
};

function AdminAnalyticsPage() {
  const { t } = useI18n();
  const data = Route.useLoaderData() as unknown as AdminAnalyticsData;
  const searchParams = Route.useSearch() as unknown as AnalyticsSearchParams;
  const navigate = Route.useNavigate();
  const { exportCsv, isExporting } = useCsvDownload();

  if (isServerError(data)) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('adminAnalytics.title')} subtitle={t('adminAnalytics.subtitle')} />
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          {data.error.message}
        </div>
      </div>
    );
  }

  const totalCheckpoints = data.statusDistribution.reduce((sum, s) => sum + s.count, 0);

  const statusLabels: Record<string, string> = {
    locked: t('adminAnalytics.statusLocked'),
    unlocked: t('adminAnalytics.statusUnlocked'),
    submitted: t('adminAnalytics.statusSubmitted'),
    under_review: t('adminAnalytics.statusUnderReview'),
    passed: t('adminAnalytics.statusPassed'),
    revise: t('adminAnalytics.statusRevise'),
  };

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
        title={t('adminAnalytics.title')}
        subtitle={t('adminAnalytics.subtitle')}
        action={
          <Button
            variant="outline"
            loading={isExporting}
            onClick={() =>
              exportCsv(
                () => exportAssignmentProgressCsv({ data: {} }) as Promise<unknown>,
                'assignment-progress.csv',
              )
            }
          >
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            {t('common.exportCsv')}
          </Button>
        }
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
          aria-label={t('adminAnalytics.customStart')}
          value={searchParams.start ?? ''}
          onChange={(e) => handleDateChange('start', e.target.value)}
          className="w-[160px]"
        />
        <span className="text-muted-foreground">-</span>
        <Input
          type="date"
          aria-label={t('adminAnalytics.customEnd')}
          value={searchParams.end ?? ''}
          onChange={(e) => handleDateChange('end', e.target.value)}
          className="w-[160px]"
        />
      </div>

      {/* Metric Cards */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label={t('adminAnalytics.verificationRate')}
          value={`${data.consultationVerificationRate}%`}
          icon={ShieldCheck}
          color="success"
        />
        <MetricCard
          label={t('adminAnalytics.breachRate')}
          value={`${data.deadlineBreachRate}%`}
          icon={AlertTriangle}
          color="error"
        />
        <MetricCard
          label={t('adminAnalytics.reviewsCompleted')}
          value={data.reviewsCompleted}
          icon={CheckCircle}
          color="primary"
        />
      </div>

      {/* Status Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>{t('adminAnalytics.statusDistribution')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.statusDistribution.map((item) => (
            <Progress
              key={item.state}
              label={statusLabels[item.state] ?? item.state}
              value={item.count}
              max={totalCheckpoints || 1}
              showValue
            />
          ))}
        </CardContent>
      </Card>

      {/* Trend Tables */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('adminAnalytics.submissionTrend')}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.submissionTrend.length === 0 ? (
              <EmptyState icon={BarChart3} title={t('adminAnalytics.noData')} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('adminAnalytics.date')}</TableHead>
                    <TableHead>{t('adminAnalytics.count')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.submissionTrend.map((row) => (
                    <TableRow key={row.date}>
                      <TableCell>{row.date}</TableCell>
                      <TableCell>{row.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('adminAnalytics.reviewTrend')}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.reviewTrend.length === 0 ? (
              <EmptyState icon={BarChart3} title={t('adminAnalytics.noData')} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('adminAnalytics.date')}</TableHead>
                    <TableHead>{t('adminAnalytics.count')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.reviewTrend.map((row) => (
                    <TableRow key={row.date}>
                      <TableCell>{row.date}</TableCell>
                      <TableCell>{row.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* DAU/WAU Trends */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('adminAnalytics.dauTrend')}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.dauTrend.length === 0 ? (
              <EmptyState icon={BarChart3} title={t('adminAnalytics.noData')} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('adminAnalytics.date')}</TableHead>
                    <TableHead>{t('adminAnalytics.activeUsers')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.dauTrend.map((row) => (
                    <TableRow key={row.date}>
                      <TableCell>{row.date}</TableCell>
                      <TableCell>{row.activeUsers}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('adminAnalytics.wauTrend')}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.wauTrend.length === 0 ? (
              <EmptyState icon={BarChart3} title={t('adminAnalytics.noData')} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('adminAnalytics.date')}</TableHead>
                    <TableHead>{t('adminAnalytics.activeUsers')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.wauTrend.map((row) => (
                    <TableRow key={row.date}>
                      <TableCell>{row.date}</TableCell>
                      <TableCell>{row.activeUsers}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
