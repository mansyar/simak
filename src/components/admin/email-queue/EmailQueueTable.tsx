import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableCaption,
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
          <Table className="block md:table">
            <TableCaption className="sr-only">{t('adminEmailQueue.table.caption')}</TableCaption>
            <TableHeader className="hidden md:table-header-group">
              <TableRow className="block md:table-row">
                <TableHead scope="col">{t('adminEmailQueue.table.recipient')}</TableHead>
                <TableHead scope="col">{t('adminEmailQueue.table.subject')}</TableHead>
                <TableHead scope="col">{t('adminEmailQueue.table.template')}</TableHead>
                <TableHead scope="col">{t('adminEmailQueue.table.status')}</TableHead>
                <TableHead scope="col">{t('adminEmailQueue.table.attempts')}</TableHead>
                <TableHead scope="col">{t('adminEmailQueue.table.createdAt')}</TableHead>
                <TableHead scope="col">{t('adminEmailQueue.table.lastAttemptAt')}</TableHead>
                <TableHead scope="col">{t('adminEmailQueue.table.errorMessage')}</TableHead>
                <TableHead scope="col">{t('adminEmailQueue.table.resendMessageId')}</TableHead>
                <TableHead scope="col">{t('adminEmailQueue.table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow className="block md:table-row">
                  <TableCell
                    colSpan={10}
                    className="block p-8 text-center text-muted-foreground md:table-cell"
                  >
                    {hasActiveFilters
                      ? t('adminEmailQueue.emptyFiltered')
                      : t('adminEmailQueue.empty')}
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry: EmailQueueEntry) => (
                  <TableRow
                    key={entry.id}
                    className="block border-b p-4 md:table-row md:border-b-0 md:p-0"
                  >
                    <TableCell
                      className="block text-xs before:mr-2 before:font-medium before:content-[attr(data-label)] md:table-cell md:before:content-none"
                      data-label={t('adminEmailQueue.table.recipient')}
                    >
                      {entry.recipientEmail}
                    </TableCell>
                    <TableCell
                      className="block max-w-[200px] truncate text-xs before:mr-2 before:font-medium before:content-[attr(data-label)] md:table-cell md:before:content-none"
                      data-label={t('adminEmailQueue.table.subject')}
                      title={entry.subject}
                    >
                      {entry.subject}
                    </TableCell>
                    <TableCell
                      className="block text-xs before:mr-2 before:font-medium before:content-[attr(data-label)] md:table-cell md:before:content-none"
                      data-label={t('adminEmailQueue.table.template')}
                    >
                      {t(`adminEmailQueue.template.${entry.templateType}` as TranslationKey)}
                    </TableCell>
                    <TableCell
                      className="block before:mr-2 before:font-medium before:content-[attr(data-label)] md:table-cell md:before:content-none"
                      data-label={t('adminEmailQueue.table.status')}
                    >
                      {getStatusBadge(entry.status)}
                    </TableCell>
                    <TableCell
                      className="block text-xs before:mr-2 before:font-medium before:content-[attr(data-label)] md:table-cell md:before:content-none"
                      data-label={t('adminEmailQueue.table.attempts')}
                    >
                      {entry.attempts}
                    </TableCell>
                    <TableCell
                      className="block whitespace-nowrap text-xs text-muted-foreground before:mr-2 before:font-medium before:content-[attr(data-label)] md:table-cell md:before:content-none"
                      data-label={t('adminEmailQueue.table.createdAt')}
                    >
                      {formatTimestamp(entry.createdAt)}
                    </TableCell>
                    <TableCell
                      className="block whitespace-nowrap text-xs text-muted-foreground before:mr-2 before:font-medium before:content-[attr(data-label)] md:table-cell md:before:content-none"
                      data-label={t('adminEmailQueue.table.lastAttemptAt')}
                    >
                      {formatTimestamp(entry.lastAttemptAt)}
                    </TableCell>
                    <TableCell
                      className="block max-w-[200px] truncate text-xs text-muted-foreground before:mr-2 before:font-medium before:content-[attr(data-label)] md:table-cell md:before:content-none"
                      data-label={t('adminEmailQueue.table.errorMessage')}
                      title={entry.errorMessage ?? ''}
                    >
                      {entry.errorMessage ?? '-'}
                    </TableCell>
                    <TableCell
                      className="block max-w-[150px] truncate font-mono text-xs before:mr-2 before:font-medium before:content-[attr(data-label)] md:table-cell md:before:content-none"
                      data-label={t('adminEmailQueue.table.resendMessageId')}
                      title={entry.resendMessageId ?? ''}
                    >
                      {entry.resendMessageId ?? '-'}
                    </TableCell>
                    <TableCell
                      className="block before:mr-2 before:font-medium before:content-[attr(data-label)] md:table-cell md:before:content-none"
                      data-label={t('adminEmailQueue.table.actions')}
                    >
                      {entry.status === 'failed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="min-h-11 focus-visible:ring-2"
                          onClick={() => onRetry(entry)}
                        >
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
