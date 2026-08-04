import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const {
  mockUseLoaderData,
  mockIsServerError,
  mockListConsultations,
  mockListVerifiedCounts,
  mockListMyExtensionRequests,
} = vi.hoisted(() => ({
  mockUseLoaderData: vi.fn().mockReturnValue(null),
  mockIsServerError: vi.fn().mockReturnValue(false),
  mockListConsultations: vi.fn(),
  mockListVerifiedCounts: vi.fn(),
  mockListMyExtensionRequests: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: vi.fn().mockReturnValue((config: any) => ({
    ...config,
    useLoaderData: () => mockUseLoaderData(),
    useSearch: vi.fn(),
    useNavigate: vi.fn(),
  })),
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  Outlet: () => null,
  useMatchRoute: vi.fn().mockReturnValue(() => false),
}));

vi.mock('@/server/assignments', () => ({
  getStudentAssignmentDetail: vi.fn(),
}));
vi.mock('@/server/consultations', () => ({
  listConsultations: mockListConsultations,
  listVerifiedCounts: mockListVerifiedCounts,
}));
vi.mock('@/server/extensions', () => ({
  listMyExtensionRequests: mockListMyExtensionRequests,
}));

vi.mock('@/components/student/assignments/AssignmentDetailHeader', () => ({
  AssignmentDetailHeader: () => null,
}));
vi.mock('@/components/student/assignments/CheckpointTimeline', () => ({
  CheckpointTimeline: () => null,
}));
vi.mock('@/components/student/assignments/StudentAssignmentLoadingSkeleton', () => ({
  StudentAssignmentLoadingSkeleton: () => null,
}));
vi.mock('@/components/consultations/ConsultationForm', () => ({
  ConsultationForm: () => null,
}));
vi.mock('@/components/consultations/ConsultationList', () => ({
  ConsultationList: () => null,
}));
vi.mock('@/components/consultations/ConsultationProgress', () => ({
  ConsultationProgress: () => null,
}));
vi.mock('@/components/ui/pagination', () => ({
  Pagination: () => null,
}));
vi.mock('@/components/student/extensions/ExtensionRequestForm', () => ({
  ExtensionRequestForm: () => null,
}));
vi.mock('@/components/student/extensions/ExtensionHistoryList', () => ({
  ExtensionHistoryList: () => null,
}));
vi.mock('@/components/gradebook/StudentFinalGradeCard', () => ({
  StudentFinalGradeCard: () => null,
}));
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('lucide-react', () => ({
  ChevronLeft: () => null,
  AlertCircle: () => null,
  RefreshCw: () => null,
}));
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
  Route: {},
}));
vi.mock('../../../__root', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
  Route: {},
}));
vi.mock('@/lib/errors', () => ({
  isServerError: mockIsServerError,
  getErrorTranslationKey: vi.fn(() => 'errors.fetchFailed'),
}));

import { Route } from '@/routes/_authenticated/student/assignments/$id';

const mockAssignment = {
  id: 1,
  title: 'Test Assignment',
  description: 'Test Description',
  finalDeadline: '2026-12-31T23:59:59Z',
  effectiveDeadline: null,
  instructorName: 'Instructor',
  templateName: 'Template',
  templateType: 'project',
  progressPercent: 0,
  maxExtensionDays: 7,
  maxTotalExtensions: 3,
  checkpoints: [],
};

describe('StudentAssignmentDetailPage - side-data error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockUseLoaderData.mockReturnValue(mockAssignment);
    mockIsServerError.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should show error banner when side data fails to load', async () => {
    mockListConsultations.mockRejectedValue(new Error('Network error'));

    const Component = (Route as any).component as React.FC;
    render(<Component />);

    fireEvent.click(screen.getByText('consultations.title'));

    await waitFor(
      () => {
        expect(screen.getByText('errors.fetchFailed')).toBeDefined();
      },
      { timeout: 3000 },
    );
  });

  it('should distinguish a primary server failure from not found', () => {
    mockUseLoaderData.mockReturnValue({
      error: { code: 'INTERNAL', message: 'database failure' },
    });
    mockIsServerError.mockReturnValue(true);

    const Component = (Route as any).component as React.FC;
    render(<Component />);

    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText('errors.fetchFailed')).toBeDefined();
    expect(screen.queryByText('studentAssignments.notFound')).toBeNull();
  });

  it('should show retry button when side data fails to load', async () => {
    mockListConsultations.mockRejectedValue(new Error('Network error'));

    const Component = (Route as any).component as React.FC;
    render(<Component />);

    fireEvent.click(screen.getByText('consultations.title'));

    await waitFor(
      () => {
        expect(screen.getByText('common.refresh')).toBeDefined();
      },
      { timeout: 3000 },
    );
  });

  it('should show an error state when consultation data returns a server error', async () => {
    mockIsServerError.mockImplementation((value: unknown) => {
      return Boolean(value && typeof value === 'object' && 'error' in value);
    });
    mockListConsultations.mockResolvedValue({
      error: { code: 'INTERNAL', message: 'database failure' },
    });
    mockListVerifiedCounts.mockResolvedValue({ counts: [] });
    mockListMyExtensionRequests.mockResolvedValue({ items: [], total: 0 });

    const Component = (Route as any).component as React.FC;
    render(<Component />);

    fireEvent.click(screen.getByText('consultations.title'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getByText('errors.fetchFailed')).toBeDefined();
      expect(screen.queryByText('database failure')).toBeNull();
    });
  });
});
