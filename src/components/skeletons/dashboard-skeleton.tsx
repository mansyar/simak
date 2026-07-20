import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton data-testid="skeleton" className="h-8 w-48 rounded" />
        <Skeleton data-testid="skeleton" className="h-4 w-72 rounded" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton data-testid="skeleton" className="h-4 w-24 rounded" />
            </CardHeader>
            <CardContent>
              <Skeleton data-testid="skeleton" className="h-8 w-16 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton data-testid="skeleton" className="h-5 w-32 rounded" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} data-testid="skeleton" className="h-4 w-full rounded" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
