import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { listStudentAssignments } from '@/server/assignments';
import { StudentAssignmentCard } from '@/components/student/assignments/StudentAssignmentCard';
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
  pendingComponent: () => _jsx(StudentAssignmentLoadingSkeleton, {}),
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
      search: (prev) => ({ ...prev, search: value, page: 1 }),
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
      _jsxs('div', {
        className: 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4',
        children: [
          _jsxs('div', {
            children: [
              _jsx('h1', {
                className: 'font-display text-4xl text-foreground',
                children: t('studentAssignments.title'),
              }),
              _jsx('p', {
                className: 'text-sm text-muted-foreground mt-1',
                children: t('studentAssignments.subtitle'),
              }),
            ],
          }),
          _jsx('div', {
            className: 'flex items-center gap-2',
            children: _jsx(Button, {
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
          }),
        ],
      }),
      _jsx(StudentAssignmentFilters, {
        search: searchParams.search,
        onSearchChange: handleSearchChange,
      }),
      assignments.length === 0
        ? _jsx(StudentAssignmentEmptyState, {})
        : _jsx('div', {
            className: 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3',
            children: assignments.map((assignment) =>
              _jsx(StudentAssignmentCard, { assignment: assignment }, assignment.id),
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
