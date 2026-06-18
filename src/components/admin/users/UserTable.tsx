import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
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

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: 'superadmin' | 'admin' | 'instructor' | 'student';
  emailVerified: boolean;
  createdAt: Date;
};

interface UserTableProps {
  data: UserRow[];
  onEdit: (user: UserRow) => void;
  onDelete: (user: UserRow) => void;
  onGenerateLink: (user: UserRow) => void;
}

import { useI18n } from '../../../routes/__root';
import type { TranslationKey } from '../../../i18n/index';

export function UserTable({ data, onEdit, onDelete, onGenerateLink }: UserTableProps) {
  const { t } = useI18n();

  const columns: ColumnDef<UserRow>[] = [
    {
      accessorKey: 'name',
      header: t('adminUsers.table.name'),
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.name}</span>
          <span className="text-xs text-muted-foreground">{row.original.email}</span>
        </div>
      ),
    },
    {
      accessorKey: 'role',
      header: t('adminUsers.table.role'),
      cell: ({ row }) => {
        const role = row.original.role;
        const roleVariants: Record<
          'superadmin' | 'admin' | 'instructor' | 'student',
          | 'default'
          | 'secondary'
          | 'destructive'
          | 'outline'
          | 'success'
          | 'warning'
          | 'error'
          | 'info'
          | 'ghost'
          | 'link'
        > = {
          superadmin: 'default',
          admin: 'warning',
          instructor: 'info',
          student: 'secondary',
        };
        const roleLabels: Record<string, string> = {
          superadmin: 'adminUsers.role_superadmin',
          admin: 'adminUsers.role_admin',
          instructor: 'adminUsers.role_instructor',
          student: 'adminUsers.role_student',
        };
        return (
          <Badge variant={roleVariants[role] || 'outline'} className="capitalize">
            {t((roleLabels[role] || role) as TranslationKey)}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'emailVerified',
      header: 'Status',
      cell: ({ row }) => {
        const verified = row.original.emailVerified;
        return (
          <Badge variant={verified ? 'success' : 'secondary'} className="gap-1.5">
            <StatusDot variant={verified ? 'verified' : 'inactive'} />
            {verified ? t('adminUsers.emailVerified') : t('adminUsers.notVerified')}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'createdAt',
      header: t('adminUsers.table.createdAt'),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(row.original.createdAt), 'MMM d, yyyy')}
        </span>
      ),
    },
    {
      id: 'actions',
      header: t('adminUsers.table.actions'),
      cell: ({ row }) => {
        const user = row.original;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">{t('common.openMenu')}</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel>{t('adminUsers.table.actions')}</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuItem onClick={() => onEdit(user)}>
                <Pencil className="mr-2 h-4 w-4" />
                {t('common.edit')}
              </DropdownMenuItem>
              {!user.emailVerified && (
                <DropdownMenuItem onClick={() => onGenerateLink(user)}>
                  <LinkIcon className="mr-2 h-4 w-4" />
                  {t('adminUsers.generateLink')}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(user)}
                className="text-destructive focus:text-destructive"
              >
                <Trash className="mr-2 h-4 w-4" />
                {t('common.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="p-0">
                  <EmptyState
                    icon={Users}
                    title={t('adminUsers.empty')}
                    description={t('adminUsers.emptyPrompt')}
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
