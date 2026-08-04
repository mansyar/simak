/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const routeState = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: { page: 3, limit: 20, search: '' },
  loaderData: { assignments: [], total: 0 },
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: vi.fn().mockImplementation(() => (config: Record<string, unknown>) => ({
    ...config,
    useLoaderData: vi.fn().mockImplementation(() => routeState.loaderData),
    useSearch: vi.fn().mockImplementation(() => routeState.search),
    useNavigate: vi.fn().mockReturnValue(routeState.navigate),
  })),
}));

vi.mock('@/server/assignments', () => ({
  listInstructorAssignments: vi.fn(),
  listStudentAssignments: vi.fn(),
}));

vi.mock('@/routes/__root', () => ({
  useI18n: vi.fn().mockReturnValue({ t: (key: string) => key }),
}));

vi.mock('@/lib/errors', () => ({
  isServerError: vi.fn().mockReturnValue(false),
}));

vi.mock('@/hooks/use-refresh-search', () => ({
  useRefreshSearch: vi.fn().mockReturnValue({ isRefreshing: false, refresh: vi.fn() }),
}));

vi.mock('@/components/instructor/assignments/AssignmentFilters', () => ({
  AssignmentFilters: (props: { onSearchChange: (value: string) => void }) => (
    <button data-testid="search-trigger" onClick={() => props.onSearchChange('draft')} />
  ),
}));

vi.mock('@/components/student/assignments/StudentAssignmentFilters', () => ({
  StudentAssignmentFilters: (props: { onSearchChange: (value: string) => void }) => (
    <button data-testid="search-trigger" onClick={() => props.onSearchChange('draft')} />
  ),
}));

vi.mock('@/components/instructor/assignments/AssignmentCard', () => ({
  AssignmentCard: () => null,
}));
vi.mock('@/components/instructor/assignments/AssignmentEmptyState', () => ({
  AssignmentEmptyState: () => null,
}));
vi.mock('@/components/instructor/assignments/AssignmentLoadingSkeleton', () => ({
  AssignmentLoadingSkeleton: () => null,
}));
vi.mock('@/components/student/assignments/StudentAssignmentCard', () => ({
  StudentAssignmentCard: () => null,
}));
vi.mock('@/components/student/assignments/StudentAssignmentEmptyState', () => ({
  StudentAssignmentEmptyState: () => null,
}));
vi.mock('@/components/student/assignments/StudentAssignmentLoadingSkeleton', () => ({
  StudentAssignmentLoadingSkeleton: () => null,
}));
vi.mock('@/components/ui/button', () => ({ Button: () => null }));
vi.mock('@/components/ui/page-header', () => ({ PageHeader: () => null }));
vi.mock('@/components/ui/pagination', () => ({ Pagination: () => null }));
vi.mock('@/components/ui/refresh-button', () => ({ RefreshButton: () => null }));

function assertSearchResetsPage() {
  fireEvent.click(screen.getByTestId('search-trigger'));

  expect(routeState.navigate).toHaveBeenCalledTimes(1);
  const options = routeState.navigate.mock.calls[0]?.[0] as {
    search: (previous: typeof routeState.search) => typeof routeState.search;
  };

  expect(options.search(routeState.search)).toEqual({
    ...routeState.search,
    search: 'draft',
    page: 1,
  });
}

describe('assignment search route navigation', () => {
  beforeEach(() => {
    routeState.navigate.mockClear();
    routeState.search = { page: 3, limit: 20, search: '' };
    routeState.loaderData = { assignments: [], total: 0 };
  });

  it('resets the instructor assignment page when a committed search changes', async () => {
    const { Route } = await import('@/routes/_authenticated/instructor/assignments/index');
    const Component = (Route as unknown as { component: ComponentType }).component;

    render(<Component />);
    assertSearchResetsPage();
  });

  it('resets the student assignment page when a committed search changes', async () => {
    const { Route } = await import('@/routes/_authenticated/student/assignments/index');
    const Component = (Route as unknown as { component: ComponentType }).component;

    render(<Component />);
    assertSearchResetsPage();
  });
});
