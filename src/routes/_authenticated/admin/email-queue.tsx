import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { listEmailQueue, retryEmail } from '@/server/email-queue';
import type { EmailQueueEntry } from '@/server/email-queue';
import { useI18n } from '../../__root';
import { PageHeader } from '@/components/ui/page-header';
import { RefreshButton } from '@/components/ui/refresh-button';
import { EmailQueueSummaryCards } from '@/components/admin/email-queue/EmailQueueSummaryCards';
import { EmailQueueFilters } from '@/components/admin/email-queue/EmailQueueFilters';
import { EmailQueueTable } from '@/components/admin/email-queue/EmailQueueTable';
import { RetryEmailDialog } from '@/components/admin/email-queue/RetryEmailDialog';
import { z } from 'zod';
import { isServerError } from '@/lib/errors';
import { toast } from 'sonner';
import { showErrorToast, parseServerError } from '@/lib/toast';

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
    ? { entries: [], total: 0, page: 1, limit: LIMIT, summary: { pending: 0, sent: 0, failed: 0 } }
    : (data ?? {
        entries: [],
        total: 0,
        page: 1,
        limit: LIMIT,
        summary: { pending: 0, sent: 0, failed: 0 },
      });
  const searchParams = Route.useSearch();
  const navigate = Route.useNavigate();
  const router = useRouter();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [retryTarget, setRetryTarget] = useState<EmailQueueEntry | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const totalPages = Math.ceil(listData.total / LIMIT);

  type EmailQueueSearchParams = z.infer<typeof EmailQueueSearchSchema>;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await router.invalidate();
    setIsRefreshing(false);
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
        action={<RefreshButton isRefreshing={isRefreshing} onClick={handleRefresh} />}
      />

      <EmailQueueSummaryCards summary={listData.summary} />

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
