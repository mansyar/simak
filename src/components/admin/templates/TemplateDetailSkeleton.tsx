import { Card, CardContent } from '@/components/ui/card';

export function TemplateDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Back button skeleton */}
      <div className="h-8 w-40 rounded bg-muted animate-pulse" />

      {/* Metadata card skeleton */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="h-6 w-48 rounded bg-muted animate-pulse" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="h-4 w-24 rounded bg-muted animate-pulse" />
              <div className="h-10 w-full rounded bg-muted animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-24 rounded bg-muted animate-pulse" />
              <div className="h-10 w-full rounded bg-muted animate-pulse" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="h-4 w-40 rounded bg-muted animate-pulse" />
            <div className="h-4 w-40 rounded bg-muted animate-pulse" />
          </div>
        </CardContent>
      </Card>

      {/* Checkpoints skeleton */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="h-5 w-32 rounded bg-muted animate-pulse" />
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex gap-2">
              <div className="h-10 flex-1 rounded bg-muted animate-pulse" />
              <div className="h-10 w-28 rounded bg-muted animate-pulse" />
              <div className="h-10 w-24 rounded bg-muted animate-pulse" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
