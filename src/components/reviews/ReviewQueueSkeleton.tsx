interface ReviewQueueSkeletonProps {
  count?: number;
}

export function ReviewQueueSkeleton({ count = 5 }: ReviewQueueSkeletonProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center justify-between rounded-lg border bg-card p-4">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <div data-testid="skeleton" className="h-4 w-32 rounded bg-muted animate-pulse" />
              <div data-testid="skeleton" className="h-3 w-3 rounded bg-muted animate-pulse" />
              <div data-testid="skeleton" className="h-4 w-24 rounded bg-muted animate-pulse" />
            </div>
            <div className="flex items-center gap-4">
              <div data-testid="skeleton" className="h-3 w-40 rounded bg-muted animate-pulse" />
              <div data-testid="skeleton" className="h-3 w-20 rounded bg-muted animate-pulse" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div data-testid="skeleton" className="h-5 w-20 rounded-full bg-muted animate-pulse" />
            <div data-testid="skeleton" className="h-7 w-16 rounded-md bg-muted animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
