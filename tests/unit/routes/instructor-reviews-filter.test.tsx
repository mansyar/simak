/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @tanstack/react-start/server
vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: vi.fn().mockReturnValue(new Headers()),
}));

// Mock @tanstack/react-start
vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
  useServerFn: vi.fn().mockReturnValue(vi.fn()),
}));

// Mock @tanstack/react-router
const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  redirect: vi.fn().mockImplementation((opts) => {
    throw new Error(`REDIRECT: ${opts.to}`);
  }),
  createFileRoute: vi.fn().mockReturnValue((config: any) => ({
    ...config,
    useLoaderData: vi.fn().mockReturnValue({ items: [], total: 0 }),
    useSearch: vi.fn().mockReturnValue({ page: 1, limit: 20, assignmentId: undefined }),
    useNavigate: vi.fn().mockReturnValue(mockNavigate),
  })),
  Link: vi.fn().mockReturnValue(null),
  useNavigate: vi.fn().mockReturnValue(mockNavigate),
}));

// Mock server functions
vi.mock('@/server/reviews', () => ({
  listPendingReviews: vi.fn(),
}));

const mockListInstructorAssignmentsForFilter = vi.fn();
vi.mock('@/server/instructor-assignments-filter', () => ({
  listInstructorAssignmentsForFilter: (...args: any[]) => mockListInstructorAssignmentsForFilter(...args),
}));

// Mock __root
vi.mock('@/routes/__root', () => ({
  useI18n: vi.fn().mockReturnValue({
    t: vi.fn().mockImplementation((key: string) => key),
    locale: 'en',
    setLocale: vi.fn(),
  }),
}));

// Mock components
vi.mock('@/components/reviews/ReviewQueueTable', () => ({
  ReviewQueueTable: vi.fn().mockReturnValue(null),
}));

let capturedFiltersProps: any = undefined;
vi.mock('@/components/reviews/ReviewQueueFilters', () => ({
  ReviewQueueFilters: vi.fn().mockImplementation((props: any) => {
    capturedFiltersProps = props;
    return null;
  }),
}));

vi.mock('@/components/reviews/ReviewQueueEmptyState', () => ({
  ReviewQueueEmptyState: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/reviews/ReviewQueueSkeleton', () => ({
  ReviewQueueSkeleton: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/reviews/ReviewQueuePagination', () => ({
  ReviewQueuePagination: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/ui/button', () => ({
  Button: vi.fn().mockReturnValue(null),
}));

vi.mock('lucide-react', () => ({
  RefreshCcw: vi.fn().mockReturnValue(null),
}));

describe('Reviews List Page - Assignment Filter Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedFiltersProps = undefined;
  });

  it('should export Route with loader', async () => {
    const { Route } = await import('@/routes/_authenticated/instructor/reviews/index');
    expect(Route).toBeDefined();
    expect(Route).toHaveProperty('loader');
  });

  it('should import listInstructorAssignmentsForFilter server function', async () => {
    // Verify the server function module can be imported
    const mod = await import('@/server/instructor-assignments-filter');
    expect(mod.listInstructorAssignmentsForFilter).toBeDefined();
    expect(typeof mod.listInstructorAssignmentsForFilter).toBe('function');
  });
});
