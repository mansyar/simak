import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';

// Mock createFileRoute — config is spread, so pendingComponent appears on Route object
const mockUseLoaderData = vi.fn().mockReturnValue(null);
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

// Mock server functions — never resolve to keep loading state active
vi.mock('@/server/assignments', () => ({
  getStudentAssignmentDetail: vi.fn(),
}));

vi.mock('@/server/consultations', () => ({
  listConsultations: vi.fn().mockReturnValue(new Promise(() => {})),
  listVerifiedCounts: vi.fn().mockReturnValue(new Promise(() => {})),
}));

vi.mock('@/server/extensions', () => ({
  listMyExtensionRequests: vi.fn().mockReturnValue(new Promise(() => {})),
}));

// Mock child components — return null so we can test skeleton rendering
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
  isServerError: () => false,
}));

// Import after mocks
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

describe('StudentAssignmentDetailPage - side-data loading skeletons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLoaderData.mockReturnValue(mockAssignment);
  });

  it('should render skeleton elements in consultations tab while side data is loading', () => {
    const Component = (Route as any).component as React.FC;
    render(<Component />);

    // Click on consultations tab
    const consultationsTab = screen.getByText('consultations.title');
    fireEvent.click(consultationsTab);

    // Should render skeleton elements while loading
    const skeletons = document.querySelectorAll('[data-testid="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render skeleton elements in extensions tab while side data is loading', () => {
    const Component = (Route as any).component as React.FC;
    render(<Component />);

    // Click on extensions tab
    const extensionsTab = screen.getByText('extensions.requestTitle');
    fireEvent.click(extensionsTab);

    // Should render skeleton elements while loading
    const skeletons = document.querySelectorAll('[data-testid="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
