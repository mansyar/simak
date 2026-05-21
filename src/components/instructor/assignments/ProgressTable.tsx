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
import { useI18n } from '../../../routes/__root';

export type StudentProgress = {
  id: string;
  name: string;
  email: string;
  progressPercent: number;
  passedCount: number;
  totalCheckpointsCount: number;
  activeCheckpoint: {
    id: number;
    name: string;
    state: 'passed' | 'under_review' | 'submitted' | 'locked' | 'unlocked' | 'revise';
  } | null;
};

interface ProgressTableProps {
  students: StudentProgress[];
}

export function ProgressTable({ students }: ProgressTableProps) {
  const { t } = useI18n();

  const getStatusBadge = (state: string) => {
    switch (state) {
      case 'passed':
        return (
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200/50">
            {t('instructorAssignments.status.passed')}
          </span>
        );
      case 'under_review':
        return (
          <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200/50">
            {t('instructorAssignments.status.under_review')}
          </span>
        );
      case 'submitted':
        return (
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border border-blue-200/50">
            {t('instructorAssignments.status.submitted')}
          </span>
        );
      case 'revise':
        return <Badge variant="destructive">{t('instructorAssignments.status.revise')}</Badge>;
      case 'unlocked':
        return <Badge variant="default">{t('instructorAssignments.status.unlocked')}</Badge>;
      case 'locked':
      default:
        return <Badge variant="outline">{t('instructorAssignments.status.locked')}</Badge>;
    }
  };

  const columns: ColumnDef<StudentProgress>[] = [
    {
      accessorKey: 'name',
      header: t('instructorAssignments.table.student'),
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-semibold text-foreground">{row.original.name}</span>
          <span className="text-xs text-muted-foreground">{row.original.email}</span>
        </div>
      ),
    },
    {
      accessorKey: 'email',
      header: t('instructorAssignments.table.email'),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.email}</span>
      ),
    },
    {
      accessorKey: 'progressPercent',
      header: t('instructorAssignments.table.progress'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="h-2 w-24 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${row.original.progressPercent}%` }}
            />
          </div>
          <span className="text-xs font-medium text-foreground">
            {row.original.progressPercent}%
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'activeCheckpoint',
      header: t('instructorAssignments.table.activeCheckpoint'),
      cell: ({ row }) => {
        const cp = row.original.activeCheckpoint;
        if (!cp) {
          return (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">—</span>
              {getStatusBadge('passed')}
            </div>
          );
        }
        return (
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <span className="text-sm font-medium text-foreground">{cp.name}</span>
            <div>{getStatusBadge(cp.state)}</div>
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: students,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className="font-semibold">
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
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center text-muted-foreground"
              >
                No students assigned.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
