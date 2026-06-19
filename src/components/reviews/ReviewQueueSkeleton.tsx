import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface ReviewQueueSkeletonProps {
  count?: number;
}

export function ReviewQueueSkeleton({ count = 5 }: ReviewQueueSkeletonProps) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead />
              <TableHead />
              <TableHead />
              <TableHead />
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: count }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <div className="flex flex-col gap-1.5">
                    <Skeleton data-testid="skeleton" className="h-4 w-32 rounded" />
                    <Skeleton data-testid="skeleton" className="h-3 w-24 rounded" />
                  </div>
                </TableCell>
                <TableCell>
                  <Skeleton data-testid="skeleton" className="h-4 w-28 rounded" />
                </TableCell>
                <TableCell>
                  <Skeleton data-testid="skeleton" className="h-4 w-16 rounded" />
                </TableCell>
                <TableCell>
                  <Skeleton data-testid="skeleton" className="h-5 w-20 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton data-testid="skeleton" className="h-4 w-4 rounded" />
                  <Skeleton data-testid="skeleton" className="h-8 w-16 rounded-md" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
