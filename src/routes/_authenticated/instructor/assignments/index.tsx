import { createFileRoute } from '@tanstack/react-router';
import { listInstructorAssignments } from '@/server/assignments';
import { listInstructorAssignmentSections } from '@/server/instructor-assignment-context';
import { AssignmentCard } from '@/components/instructor/assignments/AssignmentCard';
import { AssignmentFilters } from '@/components/instructor/assignments/AssignmentFilters';
import { AssignmentEmptyState } from '@/components/instructor/assignments/AssignmentEmptyState';
import { AssignmentLoadingSkeleton } from '@/components/instructor/assignments/AssignmentLoadingSkeleton';
import { Pagination } from '@/components/ui/pagination';
import { Button } from '@/components/ui/button';
import { RefreshButton } from '@/components/ui/refresh-button';
import { useRefreshSearch } from '@/hooks/use-refresh-search';
import { PageHeader } from '@/components/ui/page-header';
import { Plus } from 'lucide-react';
import { z } from 'zod';
import { useI18n } from '../../../__root';
import { isServerError } from '@/lib/errors';
import { ErrorState } from '@/components/ui/error-state';

const AssignmentSearchSchema = z.object({
  page: z.number().optional().default(1),
  limit: z.number().optional().default(20),
  search: z.string().optional().default(''),
  sectionId: z.number().optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
});

export const Route = createFileRoute('/_authenticated/instructor/assignments/')({
  validateSearch: (search) => AssignmentSearchSchema.parse(search),
  loaderDeps: ({ search }) => ({
    page: search.page,
    limit: search.limit,
    search: search.search,
    sectionId: search.sectionId,
    status: search.status,
  }),
  loader: async ({ deps }) => {
    const [assignmentResult, sectionResult] = await Promise.all([
      listInstructorAssignments({ data: deps }),
      listInstructorAssignmentSections(),
    ]);

    if (isServerError(assignmentResult)) return assignmentResult;

    return {
      ...assignmentResult,
      sectionOptions: isServerError(sectionResult) ? [] : sectionResult.sections,
    };
  },
  pendingComponent: () => <AssignmentLoadingSkeleton />,
  component: AssignmentsPage,
});

function AssignmentsPage() {
  const { t } = useI18n();
  const data = Route.useLoaderData();
  const searchParams = Route.useSearch();
  const navigate = Route.useNavigate();
  const { isRefreshing, refresh } = useRefreshSearch();

  if (isServerError(data)) {
    return (
      <ErrorState
        title={t('errors.fetchFailed')}
        retryLabel={t('common.refresh')}
        onRetry={() => refresh(() => navigate({ search: searchParams }))}
      />
    );
  }

  const assignments = data?.assignments ?? [];
  const total = data?.total ?? 0;
  const sectionOptions = data?.sectionOptions ?? [];

  const handleSearchChange = (value: string) => {
    navigate({
      search: (prev: z.infer<typeof AssignmentSearchSchema>) =>
        ({
          ...prev,
          search: value,
          page: 1,
        }) satisfies z.infer<typeof AssignmentSearchSchema>,
    });
  };

  const handlePageChange = (page: number) => {
    navigate({
      search: (prev: z.infer<typeof AssignmentSearchSchema>) =>
        ({ ...prev, page }) satisfies z.infer<typeof AssignmentSearchSchema>,
    });
  };

  const handleSectionChange = (sectionId: number | undefined) => {
    navigate({
      search: (prev: z.infer<typeof AssignmentSearchSchema>) =>
        ({ ...prev, sectionId, page: 1 }) satisfies z.infer<typeof AssignmentSearchSchema>,
    });
  };

  const handleStatusChange = (
    status: z.infer<typeof AssignmentSearchSchema>['status'] | undefined,
  ) => {
    navigate({
      search: (prev: z.infer<typeof AssignmentSearchSchema>) =>
        ({ ...prev, status, page: 1 }) satisfies z.infer<typeof AssignmentSearchSchema>,
    });
  };

  const handleCreateNew = () => {
    navigate({ to: '/instructor/assignments/new' as never, search: {} as never });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('instructorAssignments.title')}
        subtitle={t('instructorAssignments.subtitle')}
        action={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <RefreshButton
              isRefreshing={isRefreshing}
              onClick={() =>
                refresh(() =>
                  navigate({ search: (prev: z.infer<typeof AssignmentSearchSchema>) => prev }),
                )
              }
            />
            <Button className="min-w-0 flex-1 sm:flex-none" onClick={handleCreateNew}>
              <Plus className="mr-2 h-4 w-4" />
              {t('instructorAssignments.newAssignment')}
            </Button>
          </div>
        }
      />

      <AssignmentFilters
        search={searchParams.search}
        onSearchChange={handleSearchChange}
        sectionId={searchParams.sectionId}
        status={searchParams.status}
        sections={sectionOptions}
        onSectionChange={handleSectionChange}
        onStatusChange={handleStatusChange}
      />

      {assignments.length === 0 ? (
        <AssignmentEmptyState onCreateNew={handleCreateNew} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assignments.map((assignment) => (
            <AssignmentCard key={assignment.id} assignment={assignment} />
          ))}
        </div>
      )}

      {assignments.length > 0 && (
        <Pagination
          currentPage={searchParams.page}
          totalPages={Math.max(1, Math.ceil(total / searchParams.limit))}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}
