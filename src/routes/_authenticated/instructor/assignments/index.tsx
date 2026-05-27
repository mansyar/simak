import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { listInstructorAssignments } from '@/server/assignments';
import { AssignmentCard } from '@/components/instructor/assignments/AssignmentCard';
import { AssignmentFilters } from '@/components/instructor/assignments/AssignmentFilters';
import { AssignmentEmptyState } from '@/components/instructor/assignments/AssignmentEmptyState';
import { AssignmentLoadingSkeleton } from '@/components/instructor/assignments/AssignmentLoadingSkeleton';
import { TemplatePagination } from '@/components/admin/templates/TemplatePagination'; // reuse
import { Button } from '@/components/ui/button';
import { Plus, RefreshCcw } from 'lucide-react';
import { z } from 'zod';
import { useI18n } from '../../../__root';

const AssignmentSearchSchema = z.object({
  page: z.number().optional().default(1),
  limit: z.number().optional().default(20),
  search: z.string().optional().default(''),
});

export const Route = createFileRoute('/_authenticated/instructor/assignments/')({
  validateSearch: (search) => AssignmentSearchSchema.parse(search),
  loaderDeps: ({ search }) => ({
    page: search.page,
    limit: search.limit,
    search: search.search,
  }),
  loader: async ({ deps }) => {
    return (listInstructorAssignments as any)({ data: deps });
  },
  pendingComponent: () => <AssignmentLoadingSkeleton />,
  component: AssignmentsPage,
});

function AssignmentsPage() {
  const { t } = useI18n();
  const data = Route.useLoaderData() as any;
  const assignments = data?.assignments ?? [];
  const total = data?.total ?? 0;
  const searchParams = Route.useSearch() as any;
  const navigate = Route.useNavigate() as any;
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleSearchChange = (value: string) => {
    navigate({
      search: (prev: any) => ({ ...prev, search: value, page: 1 }),
    });
  };

  const handlePageChange = (page: number) => {
    navigate({
      search: (prev: any) => ({ ...prev, page }),
    });
  };

  const handleCreateNew = () => {
    navigate({ to: '/instructor/assignments/new' as any });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {t('instructorAssignments.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('instructorAssignments.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              setIsRefreshing(true);
              navigate({ search: (prev: any) => prev });
              setTimeout(() => setIsRefreshing(false), 1000);
            }}
            disabled={isRefreshing}
          >
            <RefreshCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            onClick={handleCreateNew}
            className="bg-primary hover:bg-primary/95 text-primary-foreground font-semibold"
          >
            <Plus className="mr-2 h-4 w-4" />
            {t('instructorAssignments.newAssignment')}
          </Button>
        </div>
      </div>

      <AssignmentFilters search={searchParams.search} onSearchChange={handleSearchChange} />

      {assignments.length === 0 ? (
        <AssignmentEmptyState onCreateNew={handleCreateNew} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assignments.map((assignment: any) => (
            <AssignmentCard key={assignment.id} assignment={assignment} />
          ))}
        </div>
      )}

      {assignments.length > 0 && (
        <TemplatePagination
          currentPage={searchParams.page}
          totalPages={Math.max(1, Math.ceil(total / searchParams.limit))}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}
