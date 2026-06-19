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
    useParams: vi.fn().mockReturnValue({ id: '1', checkpointId: '1' }),
  })),
  Link: vi.fn().mockReturnValue(null),
  Outlet: vi.fn().mockReturnValue(null),
  useNavigate: vi.fn().mockReturnValue(vi.fn()),
  useMatchRoute: vi.fn().mockReturnValue(vi.fn().mockReturnValue(false)),
}));

// Mock server assignments
vi.mock('@/server/assignments', () => ({
  listStudentAssignments: vi.fn(),
  getStudentAssignmentDetail: vi.fn(),
}));

// Mock server consultations
vi.mock('@/server/consultations', () => ({
  listConsultations: vi.fn(),
  listVerifiedCounts: vi.fn(),
}));

// Mock server submissions
vi.mock('@/server/submissions', () => ({
  listSubmissions: vi.fn(),
  submitCheckpoint: vi.fn(),
}));

// Mock server files
vi.mock('@/server/files', () => ({
  getPresignedUploadUrl: vi.fn(),
  getPresignedDownloadUrl: vi.fn(),
}));

// Mock server reviews
vi.mock('@/server/reviews', () => ({
  getLatestReview: vi.fn(),
}));

// Mock __root
vi.mock('@/routes/__root', () => ({
  useI18n: vi.fn().mockReturnValue({
    t: vi.fn().mockImplementation((key: string) => key),
    locale: 'en',
    setLocale: vi.fn(),
  }),
}));

// Mock student components
vi.mock('@/components/student/assignments/StudentAssignmentCard', () => ({
  StudentAssignmentCard: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/student/assignments/StudentAssignmentFilters', () => ({
  StudentAssignmentFilters: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/student/assignments/StudentAssignmentEmptyState', () => ({
  StudentAssignmentEmptyState: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/student/assignments/StudentAssignmentLoadingSkeleton', () => ({
  StudentAssignmentLoadingSkeleton: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/student/assignments/AssignmentDetailHeader', () => ({
  AssignmentDetailHeader: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/student/assignments/CheckpointTimeline', () => ({
  CheckpointTimeline: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/consultations/ConsultationForm', () => ({
  ConsultationForm: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/consultations/ConsultationList', () => ({
  ConsultationList: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/consultations/ConsultationProgress', () => ({
  ConsultationProgress: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/files/file-uploader', () => ({
  FileUploader: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/files/file-list', () => ({
  FileList: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/files/submission-status', () => ({
  SubmissionStatus: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/admin/templates/TemplatePagination', () => ({
  TemplatePagination: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/ui/button', () => ({
  Button: vi.fn().mockReturnValue(null),
}));

vi.mock('lucide-react', () => ({
  RefreshCcw: vi.fn().mockReturnValue(null),
  ChevronLeft: vi.fn().mockReturnValue(null),
}));

describe('Student Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Assignments List Page', () => {
    it('should export Route', async () => {
      const { Route } = await import('@/routes/_authenticated/student/assignments/index');
      expect(Route).toBeDefined();
    });

    it('should have validateSearch in route config', async () => {
      const { Route } = await import('@/routes/_authenticated/student/assignments/index');
      expect(Route).toHaveProperty('validateSearch');
    });

    it('should have loader in route config', async () => {
      const { Route } = await import('@/routes/_authenticated/student/assignments/index');
      expect(Route).toHaveProperty('loader');
    });

    it('should have component in route config', async () => {
      const { Route } = await import('@/routes/_authenticated/student/assignments/index');
      expect(Route).toHaveProperty('component');
    });

    it('should have pendingComponent in route config', async () => {
      const { Route } = await import('@/routes/_authenticated/student/assignments/index');
      expect(Route).toHaveProperty('pendingComponent');
    });
  });

  describe('Assignment Detail Page', () => {
    it('should export Route', async () => {
      const { Route } = await import('@/routes/_authenticated/student/assignments/$id');
      expect(Route).toBeDefined();
    });

    it('should have loader in route config', async () => {
      const { Route } = await import('@/routes/_authenticated/student/assignments/$id');
      expect(Route).toHaveProperty('loader');
    });

    it('should have component in route config', async () => {
      const { Route } = await import('@/routes/_authenticated/student/assignments/$id');
      expect(Route).toHaveProperty('component');
    });

    it('should have pendingComponent in route config', async () => {
      const { Route } = await import('@/routes/_authenticated/student/assignments/$id');
      expect(Route).toHaveProperty('pendingComponent');
    });

    it('should have notFoundComponent in route config', async () => {
      const { Route } = await import('@/routes/_authenticated/student/assignments/$id');
      expect(Route).toHaveProperty('notFoundComponent');
    });
  });

  describe('Checkpoint Submission Page', () => {
    it('should export Route', async () => {
      const { Route } =
        await import('@/routes/_authenticated/student/assignments/$id.checkpoints.$checkpointId');
      expect(Route).toBeDefined();
    });

    it('should have loader in route config', async () => {
      const { Route } =
        await import('@/routes/_authenticated/student/assignments/$id.checkpoints.$checkpointId');
      expect(Route).toHaveProperty('loader');
    });

    it('should have component in route config', async () => {
      const { Route } =
        await import('@/routes/_authenticated/student/assignments/$id.checkpoints.$checkpointId');
      expect(Route).toHaveProperty('component');
    });

    it('should have pendingComponent in route config', async () => {
      const { Route } =
        await import('@/routes/_authenticated/student/assignments/$id.checkpoints.$checkpointId');
      expect(Route).toHaveProperty('pendingComponent');
    });

    it('should have notFoundComponent in route config', async () => {
      const { Route } =
        await import('@/routes/_authenticated/student/assignments/$id.checkpoints.$checkpointId');
      expect(Route).toHaveProperty('notFoundComponent');
    });
  });
});
