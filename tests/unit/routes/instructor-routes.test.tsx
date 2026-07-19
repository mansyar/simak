/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @tanstack/react-start/server
vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: vi.fn().mockReturnValue(new Headers()),
}));

// Mock @tanstack/react-start
vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
  useServerFn: vi.fn().mockReturnValue(vi.fn()),
}));

// Mock @tanstack/react-router
vi.mock('@tanstack/react-router', () => ({
  redirect: vi.fn().mockImplementation((opts) => {
    throw new Error(`REDIRECT: ${opts.to}`);
  }),
  createFileRoute: vi.fn().mockReturnValue((config: any) => ({
    ...config,
    useLoaderData: vi.fn().mockReturnValue({ assignments: [], total: 0 }),
    useSearch: vi.fn().mockReturnValue({ page: 1, limit: 20, search: '' }),
    useNavigate: vi.fn().mockReturnValue(vi.fn()),
    useParams: vi.fn().mockReturnValue({ id: '1', submissionId: '1' }),
  })),
  Link: vi.fn().mockReturnValue(null),
  useNavigate: vi.fn().mockReturnValue(vi.fn()),
}));

// Mock server assignments
vi.mock('@/server/assignments', () => ({
  listInstructorAssignments: vi.fn(),
  getAssignmentDetail: vi.fn(),
}));

// Mock server consultations
vi.mock('@/server/consultations', () => ({
  listPendingConsultations: vi.fn(),
}));

// Mock server extensions (prevents loading drizzle-orm transitively)
vi.mock('@/server/extensions', () => ({
  listExtensionRequests: vi.fn(),
  approveExtension: vi.fn(),
  rejectExtension: vi.fn(),
}));

// Mock assignment detail hook (prevents transitive server imports under load)
vi.mock('@/hooks/use-assignment-tabs', () => ({
  useAssignmentTabs: vi.fn().mockReturnValue({
    pendingConsultations: [],
    setPendingConsultations: vi.fn(),
    pendingPage: 1,
    setPendingPage: vi.fn(),
    pendingTotal: 0,
    refreshPendingConsultations: vi.fn().mockResolvedValue(undefined),
    extensionRequests: [],
    extensionsLoading: false,
    handleApproveExtension: vi.fn(),
    handleRejectExtension: vi.fn(),
  }),
}));

// Mock server reviews
vi.mock('@/server/reviews', () => ({
  listPendingReviews: vi.fn(),
  getReviewDetail: vi.fn(),
  openForReview: vi.fn(),
}));

// Mock __root
vi.mock('@/routes/__root', () => ({
  useI18n: vi.fn().mockReturnValue({
    t: vi.fn().mockImplementation((key: string) => key),
    locale: 'en',
    setLocale: vi.fn(),
  }),
}));

// Mock instructor components
vi.mock('@/components/instructor/assignments/AssignmentCard', () => ({
  AssignmentCard: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/instructor/assignments/AssignmentFilters', () => ({
  AssignmentFilters: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/instructor/assignments/AssignmentEmptyState', () => ({
  AssignmentEmptyState: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/instructor/assignments/AssignmentLoadingSkeleton', () => ({
  AssignmentLoadingSkeleton: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/instructor/assignments/AssignmentWizard', () => ({
  AssignmentWizard: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/instructor/assignments/ProgressTable', () => ({
  ProgressTable: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/admin/templates/TemplatePagination', () => ({
  TemplatePagination: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/ui/button', () => ({
  Button: vi.fn().mockReturnValue(null),
}));

vi.mock('lucide-react', () => ({
  Plus: vi.fn().mockReturnValue(null),
  RefreshCcw: vi.fn().mockReturnValue(null),
  ArrowLeft: vi.fn().mockReturnValue(null),
  Calendar: vi.fn().mockReturnValue(null),
  Users: vi.fn().mockReturnValue(null),
  Clipboard: vi.fn().mockReturnValue(null),
  Percent: vi.fn().mockReturnValue(null),
  CheckCircle2: vi.fn().mockReturnValue(null),
  ClipboardList: vi.fn().mockReturnValue(null),
  AlertCircle: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/reviews/DeadlineManager', () => ({
  DeadlineManager: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/consultations/VerificationQueueItem', () => ({
  VerificationQueueItem: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/consultations/VerificationDialog', () => ({
  VerificationDialog: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/reviews/ReviewQueueItem', () => ({
  ReviewQueueItem: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/reviews/ReviewQueueFilters', () => ({
  ReviewQueueFilters: vi.fn().mockReturnValue(null),
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

vi.mock('@/components/reviews/ReviewDetailHeader', () => ({
  ReviewDetailHeader: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/reviews/ReviewFilePreview', () => ({
  ReviewFilePreview: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/reviews/ReviewHistory', () => ({
  ReviewHistory: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/reviews/ReviewForm', () => ({
  ReviewForm: vi.fn().mockReturnValue(null),
}));

vi.mock('date-fns/format', () => ({
  format: vi.fn().mockReturnValue('Jan 1, 2026'),
}));

describe('Instructor Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Assignments List Page', () => {
    it('should export Route', async () => {
      const { Route } = await import('@/routes/_authenticated/instructor/assignments/index');
      expect(Route).toBeDefined();
    });

    it('should have validateSearch in route config', async () => {
      const { Route } = await import('@/routes/_authenticated/instructor/assignments/index');
      expect(Route).toHaveProperty('validateSearch');
    });

    it('should have loader in route config', async () => {
      const { Route } = await import('@/routes/_authenticated/instructor/assignments/index');
      expect(Route).toHaveProperty('loader');
    });

    it('should have component in route config', async () => {
      const { Route } = await import('@/routes/_authenticated/instructor/assignments/index');
      expect(Route).toHaveProperty('component');
    });

    it('should have pendingComponent in route config', async () => {
      const { Route } = await import('@/routes/_authenticated/instructor/assignments/index');
      expect(Route).toHaveProperty('pendingComponent');
    });
  });

  describe('Assignment Detail Page', () => {
    it('should export Route', async () => {
      const { Route } = await import('@/routes/_authenticated/instructor/assignments/$id');
      expect(Route).toBeDefined();
    });

    it('should have loader in route config', async () => {
      const { Route } = await import('@/routes/_authenticated/instructor/assignments/$id');
      expect(Route).toHaveProperty('loader');
    });

    it('should have component in route config', async () => {
      const { Route } = await import('@/routes/_authenticated/instructor/assignments/$id');
      expect(Route).toHaveProperty('component');
    });
  });

  describe('New Assignment Page', () => {
    it('should export Route', async () => {
      const { Route } = await import('@/routes/_authenticated/instructor/assignments/new');
      expect(Route).toBeDefined();
    });

    it('should have component in route config', async () => {
      const { Route } = await import('@/routes/_authenticated/instructor/assignments/new');
      expect(Route).toHaveProperty('component');
    });
  });

  describe('Reviews List Page', () => {
    it('should export Route', async () => {
      const { Route } = await import('@/routes/_authenticated/instructor/reviews/index');
      expect(Route).toBeDefined();
    });

    it('should have validateSearch in route config', async () => {
      const { Route } = await import('@/routes/_authenticated/instructor/reviews/index');
      expect(Route).toHaveProperty('validateSearch');
    });

    it('should have loader in route config', async () => {
      const { Route } = await import('@/routes/_authenticated/instructor/reviews/index');
      expect(Route).toHaveProperty('loader');
    });

    it('should have component in route config', async () => {
      const { Route } = await import('@/routes/_authenticated/instructor/reviews/index');
      expect(Route).toHaveProperty('component');
    });

    it('should have pendingComponent in route config', async () => {
      const { Route } = await import('@/routes/_authenticated/instructor/reviews/index');
      expect(Route).toHaveProperty('pendingComponent');
    });
  });

  describe('Review Detail Page', () => {
    it('should export Route', async () => {
      const { Route } = await import('@/routes/_authenticated/instructor/reviews/$submissionId');
      expect(Route).toBeDefined();
    });

    it('should have loader in route config', async () => {
      const { Route } = await import('@/routes/_authenticated/instructor/reviews/$submissionId');
      expect(Route).toHaveProperty('loader');
    });

    it('should have component in route config', async () => {
      const { Route } = await import('@/routes/_authenticated/instructor/reviews/$submissionId');
      expect(Route).toHaveProperty('component');
    });

    it('should have pendingComponent in route config', async () => {
      const { Route } = await import('@/routes/_authenticated/instructor/reviews/$submissionId');
      expect(Route).toHaveProperty('pendingComponent');
    });
  });
});
