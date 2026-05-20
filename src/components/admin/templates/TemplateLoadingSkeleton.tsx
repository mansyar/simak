import { Card, CardContent } from '@/components/ui/card';

interface TemplateLoadingSkeletonProps {
  count?: number;
}

export function TemplateLoadingSkeleton({ count = 6 }: TemplateLoadingSkeletonProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-6">
            <div className="space-y-3">
              <div data-testid="skeleton" className="h-5 w-3/4 rounded bg-muted animate-pulse" />
              <div data-testid="skeleton" className="h-4 w-1/2 rounded bg-muted animate-pulse" />
              <div data-testid="skeleton" className="h-3 w-1/3 rounded bg-muted animate-pulse" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
