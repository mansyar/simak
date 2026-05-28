import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { listAuditLogs } from '@/server/audit-logs';
import { Button } from '@/components/ui/button';
import { useI18n } from '../../__root';
import { RefreshCcw, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { z } from 'zod';

const AuditLogSearchSchema = z.object({
  page: z.number().optional().default(1),
  limit: z.number().optional().default(50),
  action: z.string().optional().default(''),
  dateFrom: z.string().optional().default(''),
  dateTo: z.string().optional().default(''),
  search: z.string().optional().default(''),
});

const ACTION_TYPES = [
  'user.created',
  'user.deleted',
  'template.created',
  'template.updated',
  'template.deleted',
  'assignment.created',
  'review.passed',
  'review.revised',
  'checkpoint.unlocked',
  'deadline.extended',
  'consultation.verified',
  'consultation.rejected',
] as const;

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
    return (listAuditLogs as any)({ data: deps });
  },
  component: AuditLogPage,
});

function AuditLogPage() {
  const { t } = useI18n();
  const data = Route.useLoaderData();
  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;
  const searchParams = Route.useSearch();
  const navigate = Route.useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const totalPages = Math.ceil(total / searchParams.limit);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await (listAuditLogs as any)({ data: { ...searchParams } });
    setIsRefreshing(false);
  };

  const handleSearchChange = (value: string) => {
    navigate({ search: (prev: any) => ({ ...prev, search: value, page: 1 }) });
  };

  const handleActionFilter = (value: string) => {
    navigate({ search: (prev: any) => ({ ...prev, action: value, page: 1 }) });
  };

  const handleDateFromChange = (value: string) => {
    navigate({ search: (prev: any) => ({ ...prev, dateFrom: value, page: 1 }) });
  };

  const handleDateToChange = (value: string) => {
    navigate({ search: (prev: any) => ({ ...prev, dateTo: value, page: 1 }) });
  };

  const goToPage = (page: number) => {
    navigate({ search: (prev: any) => ({ ...prev, page }) });
  };

  const toggleDetails = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const formatTimestamp = (date: Date | string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('adminAuditLog.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('adminAuditLog.subtitle')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCcw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          {t('common.refresh')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('adminAuditLog.searchPlaceholder')}
              value={searchParams.search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
        <select
          value={searchParams.action}
          onChange={(e) => handleActionFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">{t('adminAuditLog.allActions')}</option>
          {ACTION_TYPES.map((action) => (
            <option key={action} value={action}>
              {action}
            </option>
          ))}
        </select>
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
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-3 text-left font-medium">
                  {t('adminAuditLog.auditTable.timestamp')}
                </th>
                <th className="p-3 text-left font-medium">
                  {t('adminAuditLog.auditTable.action')}
                </th>
                <th className="p-3 text-left font-medium">{t('adminAuditLog.auditTable.actor')}</th>
                <th className="p-3 text-left font-medium">
                  {t('adminAuditLog.auditTable.entityType')}
                </th>
                <th className="p-3 text-left font-medium">
                  {t('adminAuditLog.auditTable.entityId')}
                </th>
                <th className="p-3 text-left font-medium">
                  {t('adminAuditLog.auditTable.details')}
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    {t('adminAuditLog.empty')}
                  </td>
                </tr>
              ) : (
                entries.map((entry: any) => (
                  <tr key={entry.id} className="border-b hover:bg-muted/30">
                    <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                      {formatTimestamp(entry.createdAt)}
                    </td>
                    <td className="p-3">
                      <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium">
                        {entry.action}
                      </span>
                    </td>
                    <td className="p-3 text-xs">{entry.actorId}</td>
                    <td className="p-3 text-xs">{entry.entityType}</td>
                    <td className="p-3 text-xs font-mono">{entry.entityId}</td>
                    <td className="p-3 text-xs">
                      {entry.details ? (
                        <button
                          onClick={() => toggleDetails(entry.id)}
                          className="text-primary hover:underline"
                        >
                          {expandedId === entry.id ? t('common.hide') : t('common.view')}
                        </button>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                      {expandedId === entry.id && entry.details && (
                        <pre className="mt-2 rounded bg-muted p-2 text-xs overflow-x-auto">
                          {JSON.stringify(entry.details, null, 2)}
                        </pre>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t p-3">
            <span className="text-xs text-muted-foreground">
              {t('adminAuditLog.showing', {
                from: String((searchParams.page - 1) * searchParams.limit + 1),
                to: String(Math.min(searchParams.page * searchParams.limit, total)),
                total: String(total),
              })}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={searchParams.page <= 1}
                onClick={() => goToPage(searchParams.page - 1)}
              >
                {t('common.previous')}
              </Button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const start = Math.max(1, Math.min(searchParams.page - 2, totalPages - 4));
                const pageNum = start + i;
                if (pageNum > totalPages) return null;
                return (
                  <Button
                    key={pageNum}
                    variant={pageNum === searchParams.page ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => goToPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}
              <Button
                variant="outline"
                size="sm"
                disabled={searchParams.page >= totalPages}
                onClick={() => goToPage(searchParams.page + 1)}
              >
                {t('common.next')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
