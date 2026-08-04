import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { getEmailQueueSummary, listEmailQueue, retryEmail } from '@/server/email-queue';
import { triggerR2Cleanup } from '@/server/r2-cleanup';
import type { EmailQueueEntry } from '@/server/email-queue';
import { useI18n } from '../../__root';
import { PageHeader } from '@/components/ui/page-header';
import { RefreshButton } from '@/components/ui/refresh-button';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { EmailQueueSummaryCards } from '@/components/admin/email-queue/EmailQueueSummaryCards';
import { EmailQueueFilters } from '@/components/admin/email-queue/EmailQueueFilters';
import { EmailQueueTable } from '@/components/admin/email-queue/EmailQueueTable';
import { RetryEmailDialog } from '@/components/admin/email-queue/RetryEmailDialog';
import { z } from 'zod';
import { isServerError } from '@/lib/errors';
import { toast } from 'sonner';
import { showErrorToast, parseServerError } from '@/lib/toast';
import { emailQueueKeys } from '@/lib/query-keys';

const EmailQueueSearchSchema = z.object({
  page: z.number().optional().default(1),
  status: z.enum(['all', 'pending', 'processing', 'sent', 'failed']).optional().default('all'),
  search: z.string().optional().default(''),
});

const LIMIT = 20;

export const Route = createFileRoute('/_authenticated/admin/email-queue')({
  validateSearch: (search) => EmailQueueSearchSchema.parse(search),
  loaderDeps: ({ search }) => ({
    page: search.page,
    status: search.status,
    search: search.search,
  }),
  loader: async ({ deps }) => {
    return listEmailQueue({ data: deps });
  },
  component: EmailQueuePage,
});

function EmailQueuePage() {
  const { t } = useI18n();
  const data = Route.useLoaderData();
  const listData = isServerError(data)
    ? { entries: [], total: 0, page: 1, limit: LIMIT }
    : (data ?? { entries: [], total: 0, page: 1, limit: LIMIT });
  const searchParams = Route.useSearch();
  const navigate = Route.useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const summaryQuery = useQuery({
    queryKey: emailQueueKeys.summary(),
    queryFn: () => getEmailQueueSummary({ data: {} }),
    staleTime: 30_000,
  });
  const summary =
    summaryQuery.data && !isServerError(summaryQuery.data)
      ? summaryQuery.data
      : { pending: 0, sent: 0, failed: 0 };

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [retryTarget, setRetryTarget] = useState<EmailQueueEntry | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isCleaningR2, setIsCleaningR2] = useState(false);

  const totalPages = Math.ceil(listData.total / LIMIT);

  type EmailQueueSearchParams = z.infer<typeof EmailQueueSearchSchema>;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await router.invalidate();
    await queryClient.invalidateQueries({ queryKey: emailQueueKeys.summary() });
    setIsRefreshing(false);
  };

  const handleR2Cleanup = async () => {
    setIsCleaningR2(true);
    const result = await triggerR2Cleanup({ data: {} });
    if (isServerError(result)) {
      showErrorToast(parseServerError(result).code, t);
    } else {
      toast.success(
        t('adminEmailQueue.r2Cleanup.success', {
          deleted: String(result.deleted),
          failed: String(result.failed),
          batchSize: String(result.batchSize),
        }),
      );
    }
    setIsCleaningR2(false);
  };

  const handleSearchChange = (value: string) => {
    navigate({ search: (prev: EmailQueueSearchParams) => ({ ...prev, search: value, page: 1 }) });
  };

  const handleStatusFilter = (value: string) => {
    navigate({
      search: (prev: EmailQueueSearchParams) => ({
        ...prev,
        status: value as EmailQueueSearchParams['status'],
        page: 1,
      }),
    });
  };

  const goToPage = (page: number) => {
    navigate({ search: (prev: EmailQueueSearchParams) => ({ ...prev, page }) });
  };

  const handleRetryConfirm = async () => {
    if (!retryTarget) return;
    setIsRetrying(true);
    const result = await retryEmail({ data: { emailId: retryTarget.id } });
    if (isServerError(result)) {
      showErrorToast(parseServerError(result).code, t);
    } else {
      toast.success(t('adminEmailQueue.retrySuccess'));
      setRetryTarget(null);
      await router.invalidate();
      await queryClient.invalidateQueries({ queryKey: emailQueueKeys.summary() });
    }
    setIsRetrying(false);
  };

  const hasActiveFilters =
    (searchParams.search && searchParams.search.length > 0) ||
    (searchParams.status && searchParams.status !== 'all');

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('adminEmailQueue.title')}
        subtitle={t('adminEmailQueue.subtitle')}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleR2Cleanup} disabled={isCleaningR2}>
              {isCleaningR2 && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('adminEmailQueue.r2Cleanup.trigger')}
            </Button>
            <RefreshButton isRefreshing={isRefreshing} onClick={handleRefresh} />
          </div>
        }
      />

      <EmailQueueSummaryCards summary={summary} />

      <EmailQueueFilters
        search={searchParams.search}
        onSearchChange={handleSearchChange}
        status={searchParams.status || 'all'}
        onStatusChange={handleStatusFilter}
      />

      <EmailQueueTable
        entries={listData.entries}
        onRetry={setRetryTarget}
        hasActiveFilters={hasActiveFilters}
        currentPage={searchParams.page || 1}
        totalPages={totalPages}
        onPageChange={goToPage}
      />

      <RetryEmailDialog
        open={retryTarget !== null}
        onOpenChange={(open) => !open && setRetryTarget(null)}
        onConfirm={handleRetryConfirm}
        isRetrying={isRetrying}
      />
    </div>
  );
}
