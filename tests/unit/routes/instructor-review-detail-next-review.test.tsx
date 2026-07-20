import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const { mockUseLoaderData, mockNavigate, mockListPendingReviews } = vi.hoisted(() => ({
  mockUseLoaderData: vi.fn(),
  mockNavigate: vi.fn(),
  mockListPendingReviews: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: vi.fn().mockReturnValue((config: any) => ({
    ...config,
    useLoaderData: () => mockUseLoaderData(),
    useParams: () => ({ submissionId: '1' }),
  })),
  useNavigate: () => mockNavigate,
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
vi.mock('@/components/reviews/ReviewForm', () => ({
  ReviewForm: ({ onComplete }: { onComplete: () => void }) => (
    <button data-testid="complete-btn" onClick={onComplete}>
      Complete
    </button>
  ),
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

describe('ReviewDetailPage - Next Review button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockUseLoaderData.mockReturnValue(mockReviewDetail);
  });

  it('shows Next Review button and navigates when there are pending reviews', async () => {
    mockListPendingReviews.mockResolvedValue({ items: [{ submissionId: 42 }], total: 1 });

    const Component = (Route as any).component as React.FC;
    const { findByTestId, findByText } = render(<Component />);

    // Trigger success state by clicking the complete button
    const completeBtn = await findByTestId('complete-btn');
    fireEvent.click(completeBtn);

    // Next Review button should appear
    const nextReviewBtn = await findByText('instructorReviews.nextReview');
    expect(nextReviewBtn).toBeInTheDocument();

    // Clicking it should navigate to the next pending submission
    fireEvent.click(nextReviewBtn);
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/instructor/reviews/$submissionId',
      params: { submissionId: '42' },
    });
  });

  it('hides Next Review button when there are no more reviews', async () => {
    mockListPendingReviews.mockResolvedValue({ items: [], total: 0 });

    const Component = (Route as any).component as React.FC;
    const { findByTestId, queryByText } = render(<Component />);

    const completeBtn = await findByTestId('complete-btn');
    fireEvent.click(completeBtn);

    // Wait for listPendingReviews to be called and resolve
    await waitFor(() => {
      expect(mockListPendingReviews).toHaveBeenCalled();
    });

    // Next Review button should NOT be present
    expect(queryByText('instructorReviews.nextReview')).not.toBeInTheDocument();
  });
});
