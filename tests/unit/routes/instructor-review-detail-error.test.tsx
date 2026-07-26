import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

const { mockUseLoaderData, mockNavigate, mockToastError, mockOpenForReview } = vi.hoisted(() => ({
  mockUseLoaderData: vi.fn(),
  mockNavigate: vi.fn(),
  mockToastError: vi.fn(),
  mockOpenForReview: vi.fn(),
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
  openForReview: mockOpenForReview,
}));

vi.mock('@/lib/errors', () => ({
  isServerError: vi.fn().mockReturnValue(false),
  serverError: vi.fn(),
  ErrorCode: { INTERNAL: 'INTERNAL' },
}));

vi.mock('sonner', () => ({
  toast: { error: mockToastError },
}));

vi.mock('@/components/reviews/ReviewDetailHeader', () => ({
  ReviewDetailHeader: () => null,
}));
vi.mock('@/components/reviews/ReviewFilePreview', () => ({
  ReviewFilePreview: () => null,
}));
vi.mock('@/components/discussions/discussion-panel', () => ({
  DiscussionPanel: () => null,
}));
vi.mock('@/components/reviews/ReviewHistory', () => ({
  ReviewHistory: () => null,
}));
vi.mock('@/components/reviews/ReviewForm', () => ({
  ReviewForm: () => null,
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
    checkpointState: 'submitted',
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

describe('ReviewDetailPage - openForReview error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockUseLoaderData.mockReturnValue(mockReviewDetail);
  });

  it('should show toast.error when openForReview fails', async () => {
    mockOpenForReview.mockRejectedValue(new Error('Failed'));

    const Component = (Route as any).component as React.FC;
    render(<Component />);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  it('should not navigate when openForReview fails', async () => {
    mockOpenForReview.mockRejectedValue(new Error('Failed'));

    const Component = (Route as any).component as React.FC;
    render(<Component />);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
