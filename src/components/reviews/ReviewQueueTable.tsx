import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Link } from '@tanstack/react-router';
import { FileText, Clock } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableCaption,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SLABadge } from './SLABadge';
import { useI18n } from '../../routes/__root';
import type { ReviewQueueItemData } from './ReviewQueueItem';
import { formatReviewWaitTime } from './review-wait-time';

interface ReviewQueueTableProps {
  data: ReviewQueueItemData[];
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
        const waitTime = formatReviewWaitTime(row.original.uploadedAt, t);
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
      header: t('instructorReviews.table.actions'),
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
        <div className="hidden sm:block">
          <Table>
            <TableCaption className="sr-only">{t('instructorReviews.table.caption')}</TableCaption>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} scope="col">
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
        </div>

        <div className="space-y-3 p-4 sm:hidden">
          {data.map((item) => (
            <article
              key={item.submissionId}
              className="space-y-3 rounded-md border p-4"
              data-testid="review-queue-mobile-card"
            >
              <div>
                <p className="font-medium">{item.studentName}</p>
                <p className="text-sm text-muted-foreground">{item.checkpointName}</p>
              </div>
              <p className="text-sm text-muted-foreground">{item.assignmentTitle}</p>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">
                  {formatReviewWaitTime(item.uploadedAt, t)}
                </span>
                <SLABadge
                  state={item.checkpointState}
                  updatedAt={item.checkpointUpdatedAt ?? item.uploadedAt}
                />
              </div>
              <Link
                to="/instructor/reviews/$submissionId"
                params={{ submissionId: String(item.submissionId) }}
                data-testid="review-queue-mobile-link"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t('common.viewAll')}
              </Link>
            </article>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
