import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { listPendingReviews } from '@/server/reviews';
import { listInstructorAssignmentsForFilter } from '@/server/instructor-assignments-filter';
import { ReviewQueueTable } from '@/components/reviews/ReviewQueueTable';
import { ReviewQueueFilters } from '@/components/reviews/ReviewQueueFilters';
import { ReviewQueueEmptyState } from '@/components/reviews/ReviewQueueEmptyState';
import { ReviewQueueSkeleton } from '@/components/reviews/ReviewQueueSkeleton';
import { ReviewQueuePagination } from '@/components/reviews/ReviewQueuePagination';
import { RefreshCcw } from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
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
    // @ts-expect-error - handler type inference limitation
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
  pendingComponent: () => _jsx(ReviewQueueSkeleton, {}),
  component: ReviewsPage,
});
function ReviewsPage() {
  const { t } = useI18n();
  const data = Route.useLoaderData();
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const assignments = data?.assignments ?? [];
  const searchParams = Route.useSearch();
  const navigate = Route.useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleAssignmentChange = (assignmentId) => {
    navigate({
      search: (prev) => ({
        ...prev,
        assignmentId: assignmentId ?? undefined,
        page: 1,
      }),
    });
  };
  const handlePageChange = (page) => {
    navigate({
      search: (prev) => ({ ...prev, page }),
    });
  };
  return _jsxs('div', {
    className: 'space-y-6',
    children: [
      _jsx(PageHeader, {
        title: t('instructorReviews.title'),
        subtitle: t('instructorReviews.subtitle'),
        action: _jsx(Button, {
          variant: 'outline',
          size: 'icon',
          onClick: async () => {
            setIsRefreshing(true);
            await navigate({ search: searchParams });
            setIsRefreshing(false);
          },
          disabled: isRefreshing,
          children: _jsx(RefreshCcw, {
            className: `h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`,
          }),
        }),
      }),
      _jsx(ReviewQueueFilters, {
        assignments: assignments,
        selectedAssignmentId: searchParams.assignmentId ?? null,
        onAssignmentChange: handleAssignmentChange,
      }),
      items.length === 0
        ? _jsx(ReviewQueueEmptyState, {})
        : _jsx(ReviewQueueTable, { data: items }),
      items.length > 0 &&
        _jsx(ReviewQueuePagination, {
          currentPage: searchParams.page,
          totalPages: Math.max(1, Math.ceil(total / searchParams.limit)),
          onPageChange: handlePageChange,
        }),
    ],
  });
}
