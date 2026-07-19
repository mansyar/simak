import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { listEmailQueue, retryEmail } from '@/server/email-queue';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useI18n } from '../../__root';
import { PageHeader } from '@/components/ui/page-header';
import { RefreshButton } from '@/components/ui/refresh-button';
import { Pagination } from '@/components/ui/pagination';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Search } from 'lucide-react';
import { z } from 'zod';
import { formatDate } from '@/lib/format-date';
import { isServerError } from '@/lib/errors';
import { toast } from 'sonner';
import { showErrorToast, parseServerError } from '@/lib/toast';
import type { TranslationKey } from '@/i18n/index';

interface EmailQueueEntry {
  id: number;
  recipientEmail: string;
  subject: string;
  templateType: string;
  status: string;
  attempts: number;
  lastAttemptAt: string | null;
  errorMessage: string | null;
  createdAt: string | null;
}

interface EmailQueueSummary {
  pending: number;
  sent: number;
  failed: number;
}

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
  const { t, locale } = useI18n();
  const data = Route.useLoaderData();
  const listData = isServerError(data)
    ? { entries: [], total: 0, page: 1, limit: LIMIT, summary: { pending: 0, sent: 0, failed: 0 } }
    : (data ?? {
        entries: [],
        total: 0,
        page: 1,
        limit: LIMIT,
        summary: { pending: 0, sent: 0, failed: 0 } as EmailQueueSummary,
      });
  const entries = listData.entries;
  const total = listData.total;
  const summary = listData.summary;
  const searchParams = Route.useSearch();
  const navigate = Route.useNavigate();
  const router = useRouter();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [retryTarget, setRetryTarget] = useState<EmailQueueEntry | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const totalPages = Math.ceil(total / LIMIT);

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge variant="success">{t('adminEmailQueue.statusSent')}</Badge>;
      case 'failed':
        return <Badge variant="error">{t('adminEmailQueue.statusFailed')}</Badge>;
      case 'processing':
        return <Badge variant="info">{t('adminEmailQueue.statusProcessing')}</Badge>;
      case 'pending':
        return <Badge variant="warning">{t('adminEmailQueue.statusPending')}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatTimestamp = (date: string | null) => {
    if (!date) return '-';
    return formatDate(date, locale, 'time');
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

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{summary?.pending ?? 0}</div>
            <div className="text-sm text-muted-foreground">
              {t('adminEmailQueue.summary.pending')}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{summary?.sent ?? 0}</div>
            <div className="text-sm text-muted-foreground">{t('adminEmailQueue.summary.sent')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{summary?.failed ?? 0}</div>
            <div className="text-sm text-muted-foreground">
              {t('adminEmailQueue.summary.failed')}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('adminEmailQueue.searchPlaceholder')}
              value={searchParams.search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <Select
          value={searchParams.status || 'all'}
          onValueChange={(value) => handleStatusFilter(value ?? 'all')}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('adminEmailQueue.statusAll')}</SelectItem>
            <SelectItem value="pending">{t('adminEmailQueue.statusPending')}</SelectItem>
            <SelectItem value="processing">{t('adminEmailQueue.statusProcessing')}</SelectItem>
            <SelectItem value="sent">{t('adminEmailQueue.statusSent')}</SelectItem>
            <SelectItem value="failed">{t('adminEmailQueue.statusFailed')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('adminEmailQueue.table.recipient')}</TableHead>
                  <TableHead>{t('adminEmailQueue.table.subject')}</TableHead>
                  <TableHead>{t('adminEmailQueue.table.template')}</TableHead>
                  <TableHead>{t('adminEmailQueue.table.status')}</TableHead>
                  <TableHead>{t('adminEmailQueue.table.attempts')}</TableHead>
                  <TableHead>{t('adminEmailQueue.table.createdAt')}</TableHead>
                  <TableHead>{t('adminEmailQueue.table.lastAttemptAt')}</TableHead>
                  <TableHead>{t('adminEmailQueue.table.errorMessage')}</TableHead>
                  <TableHead>{t('adminEmailQueue.table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="p-8 text-center text-muted-foreground">
                      {hasActiveFilters
                        ? t('adminEmailQueue.emptyFiltered')
                        : t('adminEmailQueue.empty')}
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((entry: EmailQueueEntry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-xs">{entry.recipientEmail}</TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate" title={entry.subject}>
                        {entry.subject}
                      </TableCell>
                      <TableCell className="text-xs">
                        {t(`adminEmailQueue.template.${entry.templateType}` as TranslationKey)}
                      </TableCell>
                      <TableCell>{getStatusBadge(entry.status)}</TableCell>
                      <TableCell className="text-xs">{entry.attempts}</TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimestamp(entry.createdAt)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimestamp(entry.lastAttemptAt)}
                      </TableCell>
                      <TableCell
                        className="text-xs text-muted-foreground max-w-[200px] truncate"
                        title={entry.errorMessage ?? ''}
                      >
                        {entry.errorMessage ?? '-'}
                      </TableCell>
                      <TableCell>
                        {entry.status === 'failed' && (
                          <Button size="sm" variant="outline" onClick={() => setRetryTarget(entry)}>
                            {t('adminEmailQueue.retry')}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="border-t p-3">
              <Pagination
                currentPage={searchParams.page || 1}
                totalPages={totalPages}
                onPageChange={(page) => goToPage(page)}
                showCounter
                showPageNumbers
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Retry Confirmation Dialog */}
      <Dialog open={retryTarget !== null} onOpenChange={(open) => !open && setRetryTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('adminEmailQueue.retryConfirmTitle')}</DialogTitle>
            <DialogDescription>{t('adminEmailQueue.retryConfirmDescription')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRetryTarget(null)} disabled={isRetrying}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleRetryConfirm} disabled={isRetrying}>
              {t('adminEmailQueue.retry')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
