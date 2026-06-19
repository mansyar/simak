import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { listInstructorAssignments } from '@/server/assignments';
import { AssignmentCard } from '@/components/instructor/assignments/AssignmentCard';
import { AssignmentFilters } from '@/components/instructor/assignments/AssignmentFilters';
import { AssignmentEmptyState } from '@/components/instructor/assignments/AssignmentEmptyState';
import { AssignmentLoadingSkeleton } from '@/components/instructor/assignments/AssignmentLoadingSkeleton';
import { TemplatePagination } from '@/components/admin/templates/TemplatePagination'; // reuse
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
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
    // @ts-expect-error - handler type inference limitation
    return listInstructorAssignments({ data: deps });
  },
  pendingComponent: () => _jsx(AssignmentLoadingSkeleton, {}),
  component: AssignmentsPage,
});
function AssignmentsPage() {
  const { t } = useI18n();
  const data = Route.useLoaderData();
  const assignments = data?.assignments ?? [];
  const total = data?.total ?? 0;
  const searchParams = Route.useSearch();
  const navigate = Route.useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleSearchChange = (value) => {
    navigate({
      search: (prev) => ({
        ...prev,
        search: value,
        page: 1,
      }),
    });
  };
  const handlePageChange = (page) => {
    navigate({
      search: (prev) => ({ ...prev, page }),
    });
  };
  const handleCreateNew = () => {
    navigate({ to: '/instructor/assignments/new', search: {} });
  };
  return _jsxs('div', {
    className: 'space-y-6',
    children: [
      _jsx(PageHeader, {
        title: t('instructorAssignments.title'),
        subtitle: t('instructorAssignments.subtitle'),
        action: _jsxs('div', {
          className: 'flex items-center gap-2',
          children: [
            _jsx(Button, {
              variant: 'outline',
              size: 'icon',
              onClick: () => {
                setIsRefreshing(true);
                navigate({ search: (prev) => prev });
                setTimeout(() => setIsRefreshing(false), 1000);
              },
              disabled: isRefreshing,
              children: _jsx(RefreshCcw, {
                className: `h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`,
              }),
            }),
            _jsxs(Button, {
              onClick: handleCreateNew,
              className: 'bg-primary hover:bg-primary/95 text-primary-foreground font-semibold',
              children: [
                _jsx(Plus, { className: 'mr-2 h-4 w-4' }),
                t('instructorAssignments.newAssignment'),
              ],
            }),
          ],
        }),
      }),
      _jsx(AssignmentFilters, { search: searchParams.search, onSearchChange: handleSearchChange }),
      assignments.length === 0
        ? _jsx(AssignmentEmptyState, { onCreateNew: handleCreateNew })
        : _jsx('div', {
            className: 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3',
            children: assignments.map((assignment) =>
              _jsx(AssignmentCard, { assignment: assignment }, assignment.id),
            ),
          }),
      assignments.length > 0 &&
        _jsx(TemplatePagination, {
          currentPage: searchParams.page,
          totalPages: Math.max(1, Math.ceil(total / searchParams.limit)),
          onPageChange: handlePageChange,
        }),
    ],
  });
}
