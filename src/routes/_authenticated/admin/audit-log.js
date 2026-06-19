import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { listAuditLogs } from '@/server/audit-logs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { RefreshCcw, Search } from 'lucide-react';
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
  { value: 'user.created', label: 'adminAuditLog.actionLabels.userCreated' },
  { value: 'user.deleted', label: 'adminAuditLog.actionLabels.userDeleted' },
  { value: 'template.created', label: 'adminAuditLog.actionLabels.templateCreated' },
  { value: 'template.updated', label: 'adminAuditLog.actionLabels.templateUpdated' },
  { value: 'template.deleted', label: 'adminAuditLog.actionLabels.templateDeleted' },
  { value: 'assignment.created', label: 'adminAuditLog.actionLabels.assignmentCreated' },
  { value: 'review.passed', label: 'adminAuditLog.actionLabels.reviewPassed' },
  { value: 'review.revised', label: 'adminAuditLog.actionLabels.reviewRevised' },
  { value: 'checkpoint.unlocked', label: 'adminAuditLog.actionLabels.checkpointUnlocked' },
  { value: 'deadline.extended', label: 'adminAuditLog.actionLabels.deadlineExtended' },
  { value: 'consultation.verified', label: 'adminAuditLog.actionLabels.consultationVerified' },
  { value: 'consultation.rejected', label: 'adminAuditLog.actionLabels.consultationRejected' },
];
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
    // @ts-expect-error - listAuditLogs handler type inference limitation
    return listAuditLogs({ data: deps });
  },
  component: AuditLogPage,
});
function getActionBadgeVariant(action) {
  if (
    action.includes('created') ||
    action.includes('passed') ||
    action.includes('verified') ||
    action.includes('unlocked')
  )
    return 'success';
  if (action.includes('updated') || action.includes('extended')) return 'warning';
  if (action.includes('deleted') || action.includes('rejected') || action.includes('revised'))
    return 'error';
  return 'info';
}
function AuditLogPage() {
  const { t, locale } = useI18n();
  const data = Route.useLoaderData();
  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;
  const searchParams = Route.useSearch();
  const navigate = Route.useNavigate();
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const totalPages = Math.ceil(total / searchParams.limit);
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await router.invalidate();
    setIsRefreshing(false);
  };
  const handleSearchChange = (value) => {
    navigate({ search: (prev) => ({ ...prev, search: value, page: 1 }) });
  };
  const handleActionFilter = (value) => {
    navigate({ search: (prev) => ({ ...prev, action: value, page: 1 }) });
  };
  const handleDateFromChange = (value) => {
    navigate({ search: (prev) => ({ ...prev, dateFrom: value, page: 1 }) });
  };
  const handleDateToChange = (value) => {
    navigate({ search: (prev) => ({ ...prev, dateTo: value, page: 1 }) });
  };
  const goToPage = (page) => {
    navigate({ search: (prev) => ({ ...prev, page }) });
  };
  const toggleDetails = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };
  const formatTimestamp = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleString(locale === 'id' ? 'id-ID' : 'en-US');
  };
  return _jsxs('div', {
    className: 'space-y-6',
    children: [
      _jsxs('div', {
        className: 'flex items-center justify-between',
        children: [
          _jsxs('div', {
            children: [
              _jsx('h1', {
                className: 'font-display text-4xl',
                children: t('adminAuditLog.title'),
              }),
              _jsx('p', {
                className: 'text-sm text-muted-foreground',
                children: t('adminAuditLog.subtitle'),
              }),
            ],
          }),
          _jsxs(Button, {
            variant: 'outline',
            size: 'sm',
            onClick: handleRefresh,
            disabled: isRefreshing,
            children: [
              _jsx(RefreshCcw, { className: `h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}` }),
              t('common.refresh'),
            ],
          }),
        ],
      }),
      _jsxs('div', {
        className: 'flex flex-wrap gap-4',
        children: [
          _jsx('div', {
            className: 'flex-1 min-w-[200px]',
            children: _jsxs('div', {
              className: 'relative',
              children: [
                _jsx(Search, {
                  className: 'absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground',
                }),
                _jsx(Input, {
                  placeholder: t('adminAuditLog.searchPlaceholder'),
                  value: searchParams.search,
                  onChange: (e) => handleSearchChange(e.target.value),
                  className: 'pl-8',
                }),
              ],
            }),
          }),
          _jsxs('select', {
            value: searchParams.action,
            onChange: (e) => handleActionFilter(e.target.value),
            className: 'rounded-md border border-input bg-background px-3 py-2 text-sm',
            children: [
              _jsx('option', { value: '', children: t('adminAuditLog.allActions') }),
              ACTION_TYPES.map((action) =>
                _jsx('option', { value: action.value, children: t(action.label) }, action.value),
              ),
            ],
          }),
          _jsxs('div', {
            className: 'flex items-center gap-2',
            children: [
              _jsx(Input, {
                type: 'date',
                value: searchParams.dateFrom,
                onChange: (e) => handleDateFromChange(e.target.value),
                className: 'w-[160px]',
                placeholder: t('adminAuditLog.dateFrom'),
              }),
              _jsx('span', { className: 'text-muted-foreground', children: '-' }),
              _jsx(Input, {
                type: 'date',
                value: searchParams.dateTo,
                onChange: (e) => handleDateToChange(e.target.value),
                className: 'w-[160px]',
                placeholder: t('adminAuditLog.dateTo'),
              }),
            ],
          }),
        ],
      }),
      _jsxs('div', {
        className: 'rounded-lg border bg-card',
        children: [
          _jsx('div', {
            className: 'overflow-x-auto',
            children: _jsxs(Table, {
              children: [
                _jsx(TableHeader, {
                  children: _jsxs(TableRow, {
                    children: [
                      _jsx(TableHead, { children: t('adminAuditLog.auditTable.timestamp') }),
                      _jsx(TableHead, { children: t('adminAuditLog.auditTable.action') }),
                      _jsx(TableHead, { children: t('adminAuditLog.auditTable.actor') }),
                      _jsx(TableHead, { children: t('adminAuditLog.auditTable.entityType') }),
                      _jsx(TableHead, { children: t('adminAuditLog.auditTable.entityId') }),
                      _jsx(TableHead, { children: t('adminAuditLog.auditTable.details') }),
                    ],
                  }),
                }),
                _jsx(TableBody, {
                  children:
                    entries.length === 0
                      ? _jsx(TableRow, {
                          children: _jsx(TableCell, {
                            colSpan: 6,
                            className: 'p-8 text-center text-muted-foreground',
                            children: t('adminAuditLog.empty'),
                          }),
                        })
                      : entries.map((entry) =>
                          _jsxs(
                            TableRow,
                            {
                              children: [
                                _jsx(TableCell, {
                                  className: 'text-xs text-muted-foreground whitespace-nowrap',
                                  children: formatTimestamp(entry.createdAt),
                                }),
                                _jsx(TableCell, {
                                  children: _jsx(Badge, {
                                    variant: getActionBadgeVariant(entry.action),
                                    children: entry.action,
                                  }),
                                }),
                                _jsx(TableCell, { className: 'text-xs', children: entry.actorId }),
                                _jsx(TableCell, {
                                  className: 'text-xs',
                                  children: entry.entityType,
                                }),
                                _jsx(TableCell, {
                                  className: 'text-xs font-mono',
                                  children: entry.entityId,
                                }),
                                _jsxs(TableCell, {
                                  className: 'text-xs',
                                  children: [
                                    entry.details
                                      ? _jsx('button', {
                                          onClick: () => toggleDetails(entry.id),
                                          className: 'text-primary hover:underline',
                                          children:
                                            expandedId === entry.id
                                              ? t('common.hide')
                                              : t('common.view'),
                                        })
                                      : _jsx('span', {
                                          className: 'text-muted-foreground',
                                          children: '-',
                                        }),
                                    expandedId === entry.id &&
                                      entry.details &&
                                      _jsx('pre', {
                                        className:
                                          'mt-2 rounded bg-muted p-2 text-xs overflow-x-auto',
                                        children: JSON.stringify(entry.details, null, 2),
                                      }),
                                  ],
                                }),
                              ],
                            },
                            entry.id,
                          ),
                        ),
                }),
              ],
            }),
          }),
          totalPages > 1 &&
            _jsxs('div', {
              className: 'flex items-center justify-between border-t p-3',
              children: [
                _jsx('span', {
                  className: 'text-xs text-muted-foreground',
                  children: t('adminAuditLog.showing', {
                    from: String((searchParams.page - 1) * searchParams.limit + 1),
                    to: String(Math.min(searchParams.page * searchParams.limit, total)),
                    total: String(total),
                  }),
                }),
                _jsxs('div', {
                  className: 'flex items-center gap-1',
                  children: [
                    _jsx(Button, {
                      variant: 'outline',
                      size: 'sm',
                      disabled: searchParams.page <= 1,
                      onClick: () => goToPage(searchParams.page - 1),
                      children: t('common.previous'),
                    }),
                    Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      const start = Math.max(1, Math.min(searchParams.page - 2, totalPages - 4));
                      const pageNum = start + i;
                      if (pageNum > totalPages) return null;
                      return _jsx(
                        Button,
                        {
                          variant: pageNum === searchParams.page ? 'default' : 'outline',
                          size: 'sm',
                          onClick: () => goToPage(pageNum),
                          children: pageNum,
                        },
                        pageNum,
                      );
                    }),
                    _jsx(Button, {
                      variant: 'outline',
                      size: 'sm',
                      disabled: searchParams.page >= totalPages,
                      onClick: () => goToPage(searchParams.page + 1),
                      children: t('common.next'),
                    }),
                  ],
                }),
              ],
            }),
        ],
      }),
    ],
  });
}
