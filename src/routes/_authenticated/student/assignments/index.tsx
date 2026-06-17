import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { listStudentAssignments } from '@/server/assignments';
import {
  StudentAssignmentCard,
  StudentAssignmentRow,
} from '@/components/student/assignments/StudentAssignmentCard';
import { StudentAssignmentFilters } from '@/components/student/assignments/StudentAssignmentFilters';
import { StudentAssignmentEmptyState } from '@/components/student/assignments/StudentAssignmentEmptyState';
import { StudentAssignmentLoadingSkeleton } from '@/components/student/assignments/StudentAssignmentLoadingSkeleton';
import { TemplatePagination } from '@/components/admin/templates/TemplatePagination';
import { RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { z } from 'zod';
import { useI18n } from '../../../__root';

const AssignmentSearchSchema = z.object({
  page: z.number().optional().default(1),
  limit: z.number().optional().default(20),
  search: z.string().optional().default(''),
});

export const Route = createFileRoute('/_authenticated/student/assignments/')({
  validateSearch: (search) => AssignmentSearchSchema.parse(search),
  loaderDeps: ({ search }) => ({
    page: search.page,
    limit: search.limit,
    search: search.search,
  }),
  loader: async ({ deps }) => {
    // @ts-expect-error - listStudentAssignments handler type inference limitation
    return listStudentAssignments({ data: deps });
  },
  pendingComponent: () => <StudentAssignmentLoadingSkeleton />,
  component: AssignmentsPage,
});

function AssignmentsPage() {
  const { t } = useI18n();
  const data = Route.useLoaderData() as
    | { assignments: StudentAssignmentRow[]; total: number }
    | undefined;
  const assignments = data?.assignments ?? [];
  const total = data?.total ?? 0;
  const searchParams = Route.useSearch();
  const navigate = Route.useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);

  type StudentSearchParams = z.infer<typeof AssignmentSearchSchema>;

  const handleSearchChange = (value: string) => {
    navigate({
      search: (prev: StudentSearchParams) => ({ ...prev, search: value, page: 1 }),
    });
  };

  const handlePageChange = (page: number) => {
    navigate({
      search: (prev: StudentSearchParams) => ({ ...prev, page }),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-foreground">{t('studentAssignments.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('studentAssignments.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              setIsRefreshing(true);
              navigate({ search: (prev: StudentSearchParams) => prev });
              setTimeout(() => setIsRefreshing(false), 1000);
            }}
            disabled={isRefreshing}
          >
            <RefreshCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <StudentAssignmentFilters search={searchParams.search} onSearchChange={handleSearchChange} />

      {assignments.length === 0 ? (
        <StudentAssignmentEmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assignments.map((assignment: StudentAssignmentRow) => (
            <StudentAssignmentCard key={assignment.id} assignment={assignment} />
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
