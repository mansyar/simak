import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useI18n } from '../../../routes/__root';
import { formatDate } from '@/lib/format-date';
import type { TranslationKey } from '@/i18n/index';
import type { EmailQueueEntry } from '@/server/email-queue';

interface EmailQueueTableProps {
  entries: EmailQueueEntry[];
  onRetry: (entry: EmailQueueEntry) => void;
  hasActiveFilters: boolean;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function EmailQueueTable({
  entries,
  onRetry,
  hasActiveFilters,
  currentPage,
  totalPages,
  onPageChange,
}: EmailQueueTableProps) {
  const { t, locale } = useI18n();

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

  return (
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
                <TableHead>{t('adminEmailQueue.table.resendMessageId')}</TableHead>
                <TableHead>{t('adminEmailQueue.table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="p-8 text-center text-muted-foreground">
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
                    <TableCell
                      className="text-xs font-mono max-w-[150px] truncate"
                      title={entry.resendMessageId ?? ''}
                    >
                      {entry.resendMessageId ?? '-'}
                    </TableCell>
                    <TableCell>
                      {entry.status === 'failed' && (
                        <Button size="sm" variant="outline" onClick={() => onRetry(entry)}>
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

        {totalPages > 1 && (
          <div className="border-t p-3">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={onPageChange}
              showCounter
              showPageNumbers
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
