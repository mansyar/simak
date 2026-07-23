import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const { mockUseLoaderData, mockListPendingReviews } = vi.hoisted(() => ({
  mockUseLoaderData: vi.fn(),
  mockListPendingReviews: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: vi.fn().mockReturnValue((config: any) => ({
    ...config,
    useLoaderData: () => mockUseLoaderData(),
    useParams: () => ({ submissionId: '1' }),
  })),
  useNavigate: () => vi.fn(),
}));

vi.mock('@/server/reviews', () => ({
  getReviewDetail: vi.fn(),
  openForReview: vi.fn().mockResolvedValue(undefined),
  listPendingReviews: mockListPendingReviews,
}));

vi.mock('@/lib/errors', () => ({
  isServerError: vi.fn().mockReturnValue(false),
  serverError: vi.fn(),
  ErrorCode: { INTERNAL: 'INTERNAL' },
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));

vi.mock('@/components/reviews/ReviewDetailHeader', () => ({
  ReviewDetailHeader: () => null,
}));
vi.mock('@/components/reviews/ReviewFilePreview', () => ({
  ReviewFilePreview: () => null,
}));
vi.mock('@/components/reviews/ReviewHistory', () => ({
  ReviewHistory: () => null,
}));

const capturedProps: any = {};
vi.mock('@/components/reviews/ReviewForm', () => ({
  ReviewForm: (props: any) => {
    Object.assign(capturedProps, props);
    return <div data-testid="review-form-mock" />;
  },
}));
vi.mock('@/components/reviews/ReviewQueueSkeleton', () => ({
  ReviewQueueSkeleton: () => null,
}));
vi.mock('@/components/ui/empty-state', () => ({
  EmptyState: () => null,
}));
vi.mock('lucide-react', () => ({
  AlertCircle: () => null,
  CheckCircle2: () => null,
  SearchX: () => null,
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

import { Route } from '@/routes/_authenticated/instructor/reviews/$submissionId';

const mockReviewDetail = {
  submission: {
    checkpointState: 'under_review',
    studentName: 'John',
    assignmentTitle: 'Test',
    checkpointName: 'CP1',
    fileName: 'test.pdf',
    fileSize: 1000,
    version: 1,
    uploadedAt: new Date(),
    downloadUrl: 'http://example.com',
  },
  reviewHistory: [],
};

describe('ReviewDetailPage - Rubric prop pass-through', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockListPendingReviews.mockResolvedValue({ items: [], total: 0 });
  });

  it('passes rubric data to ReviewForm when present', () => {
    const numericRubric = {
      gradingType: 'numeric' as const,
      criteria: [{ id: 1, title: 'C1', description: null, weight: 100, order: 0 }],
      levels: [],
    };
    mockUseLoaderData.mockReturnValue({ ...mockReviewDetail, rubric: numericRubric });

    const Component = (Route as any).component as React.FC;
    render(<Component />);

    expect(capturedProps.rubric).toEqual(numericRubric);
  });

  it('passes null rubric to ReviewForm when rubric is null', () => {
    mockUseLoaderData.mockReturnValue({ ...mockReviewDetail, rubric: null });

    const Component = (Route as any).component as React.FC;
    render(<Component />);

    expect(capturedProps.rubric).toBeNull();
  });

  it('passes null rubric to ReviewForm when rubric is undefined', () => {
    mockUseLoaderData.mockReturnValue({ ...mockReviewDetail });

    const Component = (Route as any).component as React.FC;
    render(<Component />);

    expect(capturedProps.rubric).toBeNull();
  });
});
