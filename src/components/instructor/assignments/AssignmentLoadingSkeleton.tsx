import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface AssignmentLoadingSkeletonProps {
  count?: number;
}

export function AssignmentLoadingSkeleton({ count = 6 }: AssignmentLoadingSkeletonProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <div className="h-1 bg-muted" />
          <CardContent className="p-5 space-y-4">
            <div className="space-y-2">
              <Skeleton data-testid="skeleton" className="h-3 w-1/4 rounded" />
              <Skeleton data-testid="skeleton" className="h-5 w-3/4 rounded" />
            </div>
            <div className="space-y-1">
              <Skeleton data-testid="skeleton" className="h-4 w-full rounded" />
              <Skeleton data-testid="skeleton" className="h-4 w-5/6 rounded" />
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              <div className="flex gap-4">
                <Skeleton data-testid="skeleton" className="h-3.5 w-16 rounded" />
                <Skeleton data-testid="skeleton" className="h-3.5 w-24 rounded" />
              </div>
              <Skeleton data-testid="skeleton" className="h-4 w-12 rounded" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
