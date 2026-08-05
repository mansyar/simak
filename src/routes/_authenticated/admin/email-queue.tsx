import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { listEmailQueue, retryEmail } from '@/server/email-queue';
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
import { getErrorTranslationKey, isServerError } from '@/lib/errors';
import { toast } from 'sonner';
import { showErrorToast, parseServerError } from '@/lib/toast';
import { ErrorState } from '@/components/ui/error-state';

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
  const [isCleaningR2, setIsCleaningR2] = useState(false);
  const [isCleanupDialogOpen, setIsCleanupDialogOpen] = useState(false);
  const [cleanupError, setCleanupError] = useState<string | undefined>();

  if (isServerError(data)) {
    return (
      <ErrorState
        title={t(getErrorTranslationKey(data.error.code))}
        retryLabel={t('common.refresh')}
        onRetry={() => void router.invalidate()}
      />
    );
  }

  const totalPages = Math.ceil(listData.total / LIMIT);

  type EmailQueueSearchParams = z.infer<typeof EmailQueueSearchSchema>;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await router.invalidate();
    setIsRefreshing(false);
  };

  const handleR2Cleanup = async () => {
    setIsCleaningR2(true);
    setCleanupError(undefined);
    try {
      const result = await triggerR2Cleanup({ data: {} });
      if (isServerError(result)) {
        showErrorToast(parseServerError(result).code, t);
        setCleanupError(t('adminEmailQueue.r2Cleanup.error'));
        return;
      }

      toast.success(
        t('adminEmailQueue.r2Cleanup.success', {
          deleted: String(result.deleted),
          failed: String(result.failed),
          batchSize: String(result.batchSize),
        }),
      );
      setIsCleanupDialogOpen(false);
    } catch {
      setCleanupError(t('adminEmailQueue.r2Cleanup.error'));
    } finally {
      setIsCleaningR2(false);
    }
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
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setCleanupError(undefined);
                setIsCleanupDialogOpen(true);
              }}
              disabled={isCleaningR2}
            >
              {isCleaningR2 && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('adminEmailQueue.r2Cleanup.trigger')}
            </Button>
            <RefreshButton isRefreshing={isRefreshing} onClick={handleRefresh} />
          </div>
        }
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

      {isCleanupDialogOpen && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="r2-cleanup-title"
          aria-describedby="r2-cleanup-description"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
            <h2 id="r2-cleanup-title" className="font-display text-xl">
              {t('adminEmailQueue.r2Cleanup.confirmTitle')}
            </h2>
            <p id="r2-cleanup-description" className="mt-2 text-sm text-muted-foreground">
              {t('adminEmailQueue.r2Cleanup.confirmDescription')}
            </p>
            {cleanupError && (
              <p role="alert" aria-live="assertive" className="mt-4 text-sm text-destructive">
                {cleanupError}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => setIsCleanupDialogOpen(false)}
                disabled={isCleaningR2}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="min-h-11"
                onClick={() => void handleR2Cleanup()}
                disabled={isCleaningR2}
              >
                {isCleaningR2 && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('adminEmailQueue.r2Cleanup.confirm')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
