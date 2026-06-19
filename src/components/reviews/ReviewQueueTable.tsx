import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
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
import type { ReviewQueueItemData } from './ReviewQueueItem';

interface ReviewQueueTableProps {
  data: ReviewQueueItemData[];
}

function getWaitTime(uploadedAt: Date): string {
  const now = Date.now();
  const diff = now - new Date(uploadedAt).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h`;
  return '< 1h';
}

export function ReviewQueueTable({ data }: ReviewQueueTableProps) {
  const { t } = useI18n();

  const columns: ColumnDef<ReviewQueueItemData>[] = [
    {
      accessorKey: 'studentName',
      header: t('instructorReviews.table.student'),
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.studentName}</span>
          <span className="text-xs text-muted-foreground">{row.original.checkpointName}</span>
        </div>
      ),
    },
    {
      accessorKey: 'assignmentTitle',
      header: t('instructorReviews.table.assignment'),
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <FileText className="h-3.5 w-3.5 shrink-0" />
          <span>{row.original.assignmentTitle}</span>
        </div>
      ),
    },
    {
      accessorKey: 'uploadedAt',
      header: t('instructorReviews.table.waitTime'),
      cell: ({ row }) => {
        const waitTime = getWaitTime(row.original.uploadedAt);
        return (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>{waitTime}</span>
          </div>
        );
      },
    },
    {
      id: 'sla',
      header: t('instructorReviews.table.status'),
      cell: ({ row }) => (
        <SLABadge
          state={row.original.checkpointState}
          updatedAt={row.original.checkpointUpdatedAt ?? row.original.uploadedAt}
        />
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Link
          to="/instructor/reviews/$submissionId"
          params={{ submissionId: String(row.original.submissionId) }}
          data-testid="review-queue-link"
        >
          <Button variant="outline" size="sm">
            {t('common.viewAll')}
          </Button>
        </Link>
      ),
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
            {table.getRowModel().rows?.length &&
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
