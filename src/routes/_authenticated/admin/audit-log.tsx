import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { listAuditLogs } from '@/server/audit-logs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useI18n } from '../../__root';
import type { TranslationKey } from '@/i18n/index';
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
import { Search } from 'lucide-react';
import { z } from 'zod';
import { getActionVisualProps, ACTION_TYPES } from '@/lib/admin/audit-actions';
import { formatDate } from '@/lib/format-date';
import { isServerError } from '@/lib/errors';
import { TableSkeleton } from '@/components/skeletons/table-skeleton';

interface AuditLogEntry {
  id: number;
  actorId: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown> | null;
  createdAt: string | null;
}

const AuditLogSearchSchema = z.object({
  page: z.number().optional().default(1),
  limit: z.number().optional().default(50),
  action: z.string().optional().default(''),
  dateFrom: z.string().optional().default(''),
  dateTo: z.string().optional().default(''),
  search: z.string().optional().default(''),
});

export const Route = createFileRoute('/_authenticated/admin/audit-log')({
  validateSearch: (search) => AuditLogSearchSchema.parse(search),
  loaderDeps: ({ search }) => ({
    page: search.page,
    limit: search.limit,
    action: search.action,
    dateFrom: search.dateFrom,
    dateTo: search.dateTo,
    search: search.search,
  }),
  loader: async ({ deps }) => {
    return listAuditLogs({ data: deps });
  },
  component: AuditLogPage,
  pendingComponent: () => <TableSkeleton />,
});

function AuditLogPage() {
  const { t, locale } = useI18n();
  const data = Route.useLoaderData();
  const listData = isServerError(data)
    ? { entries: [], total: 0 }
    : (data ?? { entries: [], total: 0 });
  const entries = listData.entries;
  const total = listData.total;
  const searchParams = Route.useSearch();
  const navigate = Route.useNavigate();
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const totalPages = Math.ceil(total / searchParams.limit);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await router.invalidate();
    setIsRefreshing(false);
  };

  type AuditLogSearchParams = z.infer<typeof AuditLogSearchSchema>;

  const handleSearchChange = (value: string) => {
    navigate({ search: (prev: AuditLogSearchParams) => ({ ...prev, search: value, page: 1 }) });
  };

  const handleActionFilter = (value: string) => {
    navigate({ search: (prev: AuditLogSearchParams) => ({ ...prev, action: value, page: 1 }) });
  };

  const handleDateFromChange = (value: string) => {
    navigate({ search: (prev: AuditLogSearchParams) => ({ ...prev, dateFrom: value, page: 1 }) });
  };

  const handleDateToChange = (value: string) => {
    navigate({ search: (prev: AuditLogSearchParams) => ({ ...prev, dateTo: value, page: 1 }) });
  };

  const goToPage = (page: number) => {
    navigate({ search: (prev: AuditLogSearchParams) => ({ ...prev, page }) });
  };

  const toggleDetails = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const formatTimestamp = (date: Date | string | null) => {
    if (!date) return '-';
    return formatDate(date, locale, 'time');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('adminAuditLog.title')}
        subtitle={t('adminAuditLog.subtitle')}
        action={<RefreshButton isRefreshing={isRefreshing} onClick={handleRefresh} />}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('adminAuditLog.searchPlaceholder')}
              value={searchParams.search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <Select
          value={searchParams.action || 'all'}
          onValueChange={(value) => handleActionFilter(value === 'all' ? '' : (value ?? ''))}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('adminAuditLog.allActions')}</SelectItem>
            {ACTION_TYPES.map((action) => (
              <SelectItem key={action.value} value={action.value}>
                {t(action.label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={searchParams.dateFrom}
            onChange={(e) => handleDateFromChange(e.target.value)}
            className="w-[160px]"
            placeholder={t('adminAuditLog.dateFrom')}
          />
          <span className="text-muted-foreground">-</span>
          <Input
            type="date"
            value={searchParams.dateTo}
            onChange={(e) => handleDateToChange(e.target.value)}
            className="w-[160px]"
            placeholder={t('adminAuditLog.dateTo')}
          />
        </div>
      </div>

      {/* Audit Log Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('adminAuditLog.auditTable.timestamp')}</TableHead>
                  <TableHead>{t('adminAuditLog.auditTable.action')}</TableHead>
                  <TableHead>{t('adminAuditLog.auditTable.actor')}</TableHead>
                  <TableHead>{t('adminAuditLog.auditTable.entityType')}</TableHead>
                  <TableHead>{t('adminAuditLog.auditTable.entityId')}</TableHead>
                  <TableHead>{t('adminAuditLog.auditTable.details')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="p-8 text-center text-muted-foreground">
                      {t('adminAuditLog.empty')}
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((entry: AuditLogEntry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimestamp(entry.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getActionVisualProps(entry.action).badgeVariant}>
                          {t(
                            (ACTION_TYPES.find((a) => a.value === entry.action)?.label ??
                              entry.action) as TranslationKey,
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{entry.actorName ?? entry.actorId}</TableCell>
                      <TableCell className="text-xs">{entry.entityType}</TableCell>
                      <TableCell className="text-xs font-mono">{entry.entityId}</TableCell>
                      <TableCell className="text-xs">
                        {entry.details ? (
                          <button
                            onClick={() => toggleDetails(entry.id)}
                            className="text-primary hover:underline"
                            aria-expanded={expandedId === entry.id}
                            aria-controls={`details-${entry.id}`}
                          >
                            {expandedId === entry.id ? t('common.hide') : t('common.view')}
                          </button>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                        {expandedId === entry.id && entry.details && (
                          <pre
                            className="mt-2 rounded bg-muted p-2 text-xs overflow-x-auto"
                            id={`details-${entry.id}`}
                          >
                            {JSON.stringify(entry.details, null, 2)}
                          </pre>
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
    </div>
  );
}
