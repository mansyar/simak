import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function AssignmentDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton data-testid="skeleton" className="h-8 w-64 rounded" />
        <Skeleton data-testid="skeleton" className="h-4 w-48 rounded" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton data-testid="skeleton" className="h-5 w-32 rounded" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton data-testid="skeleton" className="h-4 w-full rounded" />
          <Skeleton data-testid="skeleton" className="h-4 w-3/4 rounded" />
          <div className="flex gap-4 pt-2">
            <Skeleton data-testid="skeleton" className="h-4 w-20 rounded" />
            <Skeleton data-testid="skeleton" className="h-4 w-24 rounded" />
            <Skeleton data-testid="skeleton" className="h-4 w-16 rounded" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
