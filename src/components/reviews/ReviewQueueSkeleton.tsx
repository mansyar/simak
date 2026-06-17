import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';

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
                    <div
                      data-testid="skeleton"
                      className="h-4 w-32 rounded bg-muted animate-pulse"
                    />
                    <div
                      data-testid="skeleton"
                      className="h-3 w-24 rounded bg-muted animate-pulse"
                    />
                  </div>
                </TableCell>
                <TableCell>
                  <div data-testid="skeleton" className="h-4 w-28 rounded bg-muted animate-pulse" />
                </TableCell>
                <TableCell>
                  <div data-testid="skeleton" className="h-4 w-16 rounded bg-muted animate-pulse" />
                </TableCell>
                <TableCell>
                  <div
                    data-testid="skeleton"
                    className="h-5 w-20 rounded-full bg-muted animate-pulse"
                  />
                </TableCell>
                <TableCell>
                  <div data-testid="skeleton" className="h-4 w-4 rounded bg-muted animate-pulse" />
                  <div
                    data-testid="skeleton"
                    className="h-8 w-16 rounded-md bg-muted animate-pulse"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
