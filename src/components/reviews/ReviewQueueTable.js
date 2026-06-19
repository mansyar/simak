import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Link } from '@tanstack/react-router';
import { FileText, Clock } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SLABadge } from './SLABadge';
import { useI18n } from '../../routes/__root';
function getWaitTime(uploadedAt) {
  const now = Date.now();
  const diff = now - new Date(uploadedAt).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h`;
  return '< 1h';
}
export function ReviewQueueTable({ data }) {
  const { t } = useI18n();
  const columns = [
    {
      accessorKey: 'studentName',
      header: t('instructorReviews.table.student'),
      cell: ({ row }) =>
        _jsxs('div', {
          className: 'flex flex-col',
          children: [
            _jsx('span', { className: 'font-medium', children: row.original.studentName }),
            _jsx('span', {
              className: 'text-xs text-muted-foreground',
              children: row.original.checkpointName,
            }),
          ],
        }),
    },
    {
      accessorKey: 'assignmentTitle',
      header: t('instructorReviews.table.assignment'),
      cell: ({ row }) =>
        _jsxs('div', {
          className: 'flex items-center gap-1.5 text-sm text-muted-foreground',
          children: [
            _jsx(FileText, { className: 'h-3.5 w-3.5 shrink-0' }),
            _jsx('span', { children: row.original.assignmentTitle }),
          ],
        }),
    },
    {
      accessorKey: 'uploadedAt',
      header: t('instructorReviews.table.waitTime'),
      cell: ({ row }) => {
        const waitTime = getWaitTime(row.original.uploadedAt);
        return _jsxs('div', {
          className: 'flex items-center gap-1.5 text-sm text-muted-foreground',
          children: [
            _jsx(Clock, { className: 'h-3.5 w-3.5 shrink-0' }),
            _jsx('span', { children: waitTime }),
          ],
        });
      },
    },
    {
      id: 'sla',
      header: t('instructorReviews.table.status'),
      cell: ({ row }) =>
        _jsx(SLABadge, {
          state: row.original.checkpointState,
          updatedAt: row.original.checkpointUpdatedAt ?? row.original.uploadedAt,
        }),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        _jsx(Link, {
          to: '/instructor/reviews/$submissionId',
          params: { submissionId: String(row.original.submissionId) },
          'data-testid': 'review-queue-link',
          children: _jsx(Button, { variant: 'outline', size: 'sm', children: t('common.viewAll') }),
        }),
    },
  ];
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  return _jsx(Card, {
    children: _jsx(CardContent, {
      className: 'p-0',
      children: _jsxs(Table, {
        children: [
          _jsx(TableHeader, {
            children: table
              .getHeaderGroups()
              .map((headerGroup) =>
                _jsx(
                  TableRow,
                  {
                    children: headerGroup.headers.map((header) =>
                      _jsx(
                        TableHead,
                        {
                          children: header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext()),
                        },
                        header.id,
                      ),
                    ),
                  },
                  headerGroup.id,
                ),
              ),
          }),
          _jsx(TableBody, {
            children:
              table.getRowModel().rows?.length &&
              table
                .getRowModel()
                .rows.map((row) =>
                  _jsx(
                    TableRow,
                    {
                      children: row
                        .getVisibleCells()
                        .map((cell) =>
                          _jsx(
                            TableCell,
                            { children: flexRender(cell.column.columnDef.cell, cell.getContext()) },
                            cell.id,
                          ),
                        ),
                    },
                    row.id,
                  ),
                ),
          }),
        ],
      }),
    }),
  });
}
