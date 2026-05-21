import { Card, CardContent } from '@/components/ui/card';

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
              <div data-testid="skeleton" className="h-3 w-1/4 rounded bg-muted animate-pulse" />
              <div data-testid="skeleton" className="h-5 w-3/4 rounded bg-muted animate-pulse" />
            </div>
            <div className="space-y-1">
              <div data-testid="skeleton" className="h-4 w-full rounded bg-muted animate-pulse" />
              <div data-testid="skeleton" className="h-4 w-5/6 rounded bg-muted animate-pulse" />
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              <div className="flex gap-4">
                <div data-testid="skeleton" className="h-3.5 w-16 rounded bg-muted animate-pulse" />
                <div data-testid="skeleton" className="h-3.5 w-24 rounded bg-muted animate-pulse" />
              </div>
              <div data-testid="skeleton" className="h-4 w-12 rounded bg-muted animate-pulse" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
