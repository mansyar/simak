import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useI18n } from '../../../routes/__root';
export function ProgressTable({ students }) {
  const { t } = useI18n();
  const getStatusBadge = (state) => {
    switch (state) {
      case 'passed':
        return _jsx(Badge, {
          variant: 'success',
          children: t('instructorAssignments.status.passed'),
        });
      case 'under_review':
        return _jsx(Badge, {
          variant: 'warning',
          children: t('instructorAssignments.status.under_review'),
        });
      case 'submitted':
        return _jsx(Badge, {
          variant: 'info',
          children: t('instructorAssignments.status.submitted'),
        });
      case 'revise':
        return _jsx(Badge, {
          variant: 'destructive',
          children: t('instructorAssignments.status.revise'),
        });
      case 'unlocked':
        return _jsx(Badge, {
          variant: 'default',
          children: t('instructorAssignments.status.unlocked'),
        });
      case 'locked':
      default:
        return _jsx(Badge, {
          variant: 'outline',
          children: t('instructorAssignments.status.locked'),
        });
    }
  };
  const columns = [
    {
      accessorKey: 'name',
      header: t('instructorAssignments.table.student'),
      cell: ({ row }) =>
        _jsxs('div', {
          className: 'flex flex-col',
          children: [
            _jsx('span', {
              className: 'font-semibold text-foreground',
              children: row.original.name,
            }),
            _jsx('span', {
              className: 'text-xs text-muted-foreground',
              children: row.original.email,
            }),
          ],
        }),
    },
    {
      accessorKey: 'email',
      header: t('instructorAssignments.table.email'),
      cell: ({ row }) =>
        _jsx('span', { className: 'text-sm text-muted-foreground', children: row.original.email }),
    },
    {
      accessorKey: 'progressPercent',
      header: t('instructorAssignments.table.progress'),
      cell: ({ row }) =>
        _jsxs('div', {
          className: 'flex items-center gap-2',
          children: [
            _jsx('div', {
              className: 'h-2 w-24 overflow-hidden rounded-full bg-secondary',
              children: _jsx('div', {
                className: 'h-full bg-primary transition-all duration-300',
                style: { width: `${row.original.progressPercent}%` },
              }),
            }),
            _jsxs('span', {
              className: 'text-xs font-medium text-foreground',
              children: [row.original.progressPercent, '%'],
            }),
          ],
        }),
    },
    {
      accessorKey: 'activeCheckpoint',
      header: t('instructorAssignments.table.activeCheckpoint'),
      cell: ({ row }) => {
        const cp = row.original.activeCheckpoint;
        if (!cp) {
          return _jsxs('div', {
            className: 'flex items-center gap-2',
            children: [
              _jsx('span', { className: 'text-sm text-muted-foreground', children: '\u2014' }),
              getStatusBadge('passed'),
            ],
          });
        }
        return _jsxs('div', {
          className: 'flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2',
          children: [
            _jsx('span', { className: 'text-sm font-medium text-foreground', children: cp.name }),
            _jsx('div', { children: getStatusBadge(cp.state) }),
          ],
        });
      },
    },
  ];
  const table = useReactTable({
    data: students,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  return _jsx(Card, {
    className: 'shadow-sm overflow-hidden',
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
                        className: 'font-semibold',
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
          children: table.getRowModel().rows?.length
            ? table
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
                            {
                              className: 'py-3',
                              children: flexRender(cell.column.columnDef.cell, cell.getContext()),
                            },
                            cell.id,
                          ),
                        ),
                    },
                    row.id,
                  ),
                )
            : _jsx(TableRow, {
                children: _jsx(TableCell, {
                  colSpan: columns.length,
                  className: 'h-24 text-center text-muted-foreground',
                  children: t('instructorAssignments.noStudentsAssigned'),
                }),
              }),
        }),
      ],
    }),
  });
}
