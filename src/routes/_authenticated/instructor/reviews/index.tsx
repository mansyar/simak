import { createFileRoute } from '@tanstack/react-router';
import { listPendingReviews } from '@/server/reviews';
import { listInstructorAssignmentsForFilter } from '@/server/instructor-assignments-filter';
import type { ReviewQueueItemData } from '@/components/reviews/ReviewQueueItem';
import { ReviewQueueTable } from '@/components/reviews/ReviewQueueTable';
import { ReviewQueueFilters } from '@/components/reviews/ReviewQueueFilters';
import { ReviewQueueEmptyState } from '@/components/reviews/ReviewQueueEmptyState';
import { ReviewQueueSkeleton } from '@/components/reviews/ReviewQueueSkeleton';
import { Pagination } from '@/components/ui/pagination';
import { RefreshButton } from '@/components/ui/refresh-button';
import { useRefreshSearch } from '@/hooks/use-refresh-search';
import { z } from 'zod';
import { PageHeader } from '@/components/ui/page-header';
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
    const reviewsResult = await listPendingReviews({ data: deps });
    const assignmentsResult = await listInstructorAssignmentsForFilter();

    return {
      ...reviewsResult,
      assignments:
        assignmentsResult && 'assignments' in assignmentsResult
          ? assignmentsResult.assignments
          : [],
    };
  },
  pendingComponent: () => <ReviewQueueSkeleton />,
  component: ReviewsPage,
});

function ReviewsPage() {
  const { t } = useI18n();
  const data = Route.useLoaderData();
  const items = (data as { items?: ReviewQueueItemData[] })?.items ?? [];
  const total = (data as { total?: number })?.total ?? 0;
  const assignments =
    (data as { assignments?: { id: number; title: string }[] })?.assignments ?? [];
  const searchParams = Route.useSearch();
  const navigate = Route.useNavigate();
  const { isRefreshing, refresh } = useRefreshSearch();

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
      <PageHeader
        title={t('instructorReviews.title')}
        subtitle={t('instructorReviews.subtitle')}
        action={
          <RefreshButton
            isRefreshing={isRefreshing}
            onClick={() => refresh(() => navigate({ search: searchParams }))}
          />
        }
      />

      <ReviewQueueFilters
        assignments={assignments}
        selectedAssignmentId={searchParams.assignmentId ?? null}
        onAssignmentChange={handleAssignmentChange}
      />

      {items.length === 0 ? <ReviewQueueEmptyState /> : <ReviewQueueTable data={items} />}

      {items.length > 0 && (
        <Pagination
          currentPage={searchParams.page}
          totalPages={Math.max(1, Math.ceil(total / searchParams.limit))}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}
