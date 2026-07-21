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
import { Card } from '@/components/ui/card';
import { formatDateShort } from '@/lib/format';
import { useI18n } from '../../../routes/__root';

export type StudentProgress = {
  id: string;
  name: string;
  email: string;
  progressPercent: number;
  passedCount: number;
  totalCheckpointsCount: number;
  effectiveDeadline?: Date | string | null;
  activeCheckpoint: {
    id: number;
    name: string;
    state: string;
  } | null;
};

interface ProgressTableProps {
  students: StudentProgress[];
}

export function ProgressTable({ students }: ProgressTableProps) {
  const { t, locale } = useI18n();

  const getStatusBadge = (state: string) => {
    switch (state) {
      case 'passed':
        return <Badge variant="success">{t('instructorAssignments.status.passed')}</Badge>;
      case 'under_review':
        return <Badge variant="warning">{t('instructorAssignments.status.under_review')}</Badge>;
      case 'submitted':
        return <Badge variant="info">{t('instructorAssignments.status.submitted')}</Badge>;
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
          <div
            className="h-2 w-24 overflow-hidden rounded-full bg-secondary"
            role="progressbar"
            aria-valuenow={row.original.progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('instructorAssignments.table.progress')}
          >
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
    {
      accessorKey: 'effectiveDeadline',
      header: t('instructorAssignments.table.effectiveDeadline'),
      cell: ({ row }) => {
        const deadline = row.original.effectiveDeadline;
        return (
          <span className="text-sm text-muted-foreground">
            {deadline ? formatDateShort(deadline, locale) : '—'}
          </span>
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
    <>
      {/* Desktop Table (hidden on mobile) */}
      <Card
        className="hidden sm:block shadow-sm overflow-hidden"
        data-testid="desktop-progress-table"
      >
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
                  {t('instructorAssignments.noStudentsAssigned')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Mobile Card Layout (UX-36) - hidden on sm+ screens */}
      <div className="flex flex-col gap-4 sm:hidden" data-testid="mobile-progress-cards">
        {students.length === 0 ? (
          <Card className="p-4 text-center text-muted-foreground">
            {t('instructorAssignments.noStudentsAssigned')}
          </Card>
        ) : (
          students.map((student) => (
            <Card key={student.id} className="p-4 space-y-3" data-testid="student-mobile-card">
              <div className="flex flex-col">
                <span className="font-semibold text-foreground">{student.name}</span>
                <span className="text-xs text-muted-foreground">{student.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="h-2 flex-1 overflow-hidden rounded-full bg-secondary"
                  role="progressbar"
                  aria-valuenow={student.progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={t('instructorAssignments.table.progress')}
                >
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${student.progressPercent}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-foreground">
                  {student.progressPercent}%
                </span>
              </div>
              {student.activeCheckpoint ? (
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-foreground">
                    {student.activeCheckpoint.name}
                  </span>
                  <div>{getStatusBadge(student.activeCheckpoint.state)}</div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">—</span>
                  {getStatusBadge('passed')}
                </div>
              )}
              <span className="text-sm text-muted-foreground block">
                {student.effectiveDeadline
                  ? formatDateShort(student.effectiveDeadline, locale)
                  : '—'}
              </span>
            </Card>
          ))
        )}
      </div>
    </>
  );
}
