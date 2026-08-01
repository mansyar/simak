import { Skeleton } from '@/components/ui/skeleton';

export function InterventionListSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-3">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="h-11 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
