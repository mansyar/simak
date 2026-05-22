import { Card, CardContent } from '@/components/ui/card';

interface StudentAssignmentLoadingSkeletonProps {
  count?: number;
}

export function StudentAssignmentLoadingSkeleton({
  count = 6,
}: StudentAssignmentLoadingSkeletonProps) {
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
            <div className="h-2 w-full rounded-full bg-muted animate-pulse" />
            <div className="flex items-center justify-between border-t pt-3">
              <div data-testid="skeleton" className="h-3.5 w-24 rounded bg-muted animate-pulse" />
              <div data-testid="skeleton" className="h-4 w-12 rounded bg-muted animate-pulse" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
