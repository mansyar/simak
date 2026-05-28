import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { listPendingReviews } from '@/server/reviews';
import { ReviewQueueItem } from '@/components/reviews/ReviewQueueItem';
import type { ReviewQueueItemData } from '@/components/reviews/ReviewQueueItem';
import { ReviewQueueFilters } from '@/components/reviews/ReviewQueueFilters';
import { ReviewQueueEmptyState } from '@/components/reviews/ReviewQueueEmptyState';
import { ReviewQueueSkeleton } from '@/components/reviews/ReviewQueueSkeleton';
import { ReviewQueuePagination } from '@/components/reviews/ReviewQueuePagination';
import { RefreshCcw, ClipboardList } from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { useI18n } from '../../../__root';

const ReviewSearchSchema = z.object({
  page: z.number().optional().default(1),
  limit: z.number().optional().default(20),
  assignmentId: z.number().optional(),
});

export const Route = createFileRoute('/_authenticated/instructor/reviews/')({
  validateSearch: (search) => ReviewSearchSchema.parse(search),
  loaderDeps: ({ search }) => ({
    page: search.page,
    limit: search.limit,
    assignmentId: search.assignmentId,
  }),
  loader: async ({ deps }) => {
    // @ts-expect-error - handler type inference limitation
    return listPendingReviews({ data: deps });
  },
  pendingComponent: () => <ReviewQueueSkeleton />,
  component: ReviewsPage,
});

function ReviewsPage() {
  const { t } = useI18n();
  const data = Route.useLoaderData();
  const items = (data as { items?: ReviewQueueItemData[] })?.items ?? [];
  const total = (data as { total?: number })?.total ?? 0;
  const searchParams = Route.useSearch();
  const navigate = Route.useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleAssignmentChange = (assignmentId: number | null) => {
    navigate({
      search: (prev: z.infer<typeof ReviewSearchSchema>) => ({
        ...prev,
        assignmentId: assignmentId ?? undefined,
        page: 1,
      }),
    });
  };

  const handlePageChange = (page: number) => {
    navigate({
      search: (prev: z.infer<typeof ReviewSearchSchema>) => ({ ...prev, page }),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {t('instructorReviews.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('instructorReviews.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={async () => {
              setIsRefreshing(true);
              await navigate({ search: searchParams });
              setIsRefreshing(false);
            }}
            disabled={isRefreshing}
          >
            <RefreshCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <ReviewQueueFilters
        assignments={[]}
        selectedAssignmentId={searchParams.assignmentId ?? null}
        onAssignmentChange={handleAssignmentChange}
      />

      {items.length === 0 ? (
        <ReviewQueueEmptyState />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <ReviewQueueItem key={item.submissionId} item={item} />
          ))}
        </div>
      )}

      {items.length > 0 && (
        <ReviewQueuePagination
          currentPage={searchParams.page}
          totalPages={Math.max(1, Math.ceil(total / searchParams.limit))}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}
