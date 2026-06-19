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
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusDot } from '@/components/ui/status-dot';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, Trash, Link as LinkIcon, Users } from 'lucide-react';
import { format } from 'date-fns/format';
import { useI18n } from '../../../routes/__root';
export function UserTable({ data, onEdit, onDelete, onGenerateLink }) {
  const { t } = useI18n();
  const columns = [
    {
      accessorKey: 'name',
      header: t('adminUsers.table.name'),
      cell: ({ row }) =>
        _jsxs('div', {
          className: 'flex flex-col',
          children: [
            _jsx('span', { className: 'font-medium', children: row.original.name }),
            _jsx('span', {
              className: 'text-xs text-muted-foreground',
              children: row.original.email,
            }),
          ],
        }),
    },
    {
      accessorKey: 'role',
      header: t('adminUsers.table.role'),
      cell: ({ row }) => {
        const role = row.original.role;
        const roleVariants = {
          superadmin: 'default',
          admin: 'warning',
          instructor: 'info',
          student: 'secondary',
        };
        const roleLabels = {
          superadmin: 'adminUsers.role_superadmin',
          admin: 'adminUsers.role_admin',
          instructor: 'adminUsers.role_instructor',
          student: 'adminUsers.role_student',
        };
        return _jsx(Badge, {
          variant: roleVariants[role] || 'outline',
          className: 'capitalize',
          children: t(roleLabels[role] || role),
        });
      },
    },
    {
      accessorKey: 'emailVerified',
      header: 'Status',
      cell: ({ row }) => {
        const verified = row.original.emailVerified;
        return _jsxs(Badge, {
          variant: verified ? 'success' : 'secondary',
          className: 'gap-1.5',
          children: [
            _jsx(StatusDot, { variant: verified ? 'verified' : 'inactive' }),
            verified ? t('adminUsers.emailVerified') : t('adminUsers.notVerified'),
          ],
        });
      },
    },
    {
      accessorKey: 'createdAt',
      header: t('adminUsers.table.createdAt'),
      cell: ({ row }) =>
        _jsx('span', {
          className: 'text-sm text-muted-foreground',
          children: format(new Date(row.original.createdAt), 'MMM d, yyyy'),
        }),
    },
    {
      id: 'actions',
      header: t('adminUsers.table.actions'),
      cell: ({ row }) => {
        const user = row.original;
        return _jsxs(DropdownMenu, {
          children: [
            _jsx(DropdownMenuTrigger, {
              render: _jsxs(Button, {
                variant: 'ghost',
                className: 'h-8 w-8 p-0',
                children: [
                  _jsx('span', { className: 'sr-only', children: t('common.openMenu') }),
                  _jsx(MoreHorizontal, { className: 'h-4 w-4' }),
                ],
              }),
            }),
            _jsxs(DropdownMenuContent, {
              align: 'end',
              children: [
                _jsx(DropdownMenuGroup, {
                  children: _jsx(DropdownMenuLabel, { children: t('adminUsers.table.actions') }),
                }),
                _jsxs(DropdownMenuItem, {
                  onClick: () => onEdit(user),
                  children: [_jsx(Pencil, { className: 'mr-2 h-4 w-4' }), t('common.edit')],
                }),
                !user.emailVerified &&
                  _jsxs(DropdownMenuItem, {
                    onClick: () => onGenerateLink(user),
                    children: [
                      _jsx(LinkIcon, { className: 'mr-2 h-4 w-4' }),
                      t('adminUsers.generateLink'),
                    ],
                  }),
                _jsx(DropdownMenuSeparator, {}),
                _jsxs(DropdownMenuItem, {
                  onClick: () => onDelete(user),
                  className: 'text-destructive focus:text-destructive',
                  children: [_jsx(Trash, { className: 'mr-2 h-4 w-4' }), t('common.delete')],
                }),
              ],
            }),
          ],
        });
      },
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
            children: table.getRowModel().rows?.length
              ? table
                  .getRowModel()
                  .rows.map((row) =>
                    _jsx(
                      TableRow,
                      {
                        'data-state': row.getIsSelected() && 'selected',
                        children: row
                          .getVisibleCells()
                          .map((cell) =>
                            _jsx(
                              TableCell,
                              {
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
                    className: 'p-0',
                    children: _jsx(EmptyState, {
                      icon: Users,
                      title: t('adminUsers.empty'),
                      description: t('adminUsers.emptyPrompt'),
                    }),
                  }),
                }),
          }),
        ],
      }),
    }),
  });
}
