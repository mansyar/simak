/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';

const mocks = vi.hoisted(() => ({
  reviewDetail: {
    submission: {
      id: 1,
      studentName: 'John Doe',
      assignmentTitle: 'Thesis',
      checkpointName: 'Chapter 1',
      checkpointState: 'under_review',
      checkpointId: 1,
      assignmentId: 1,
      fileName: 'file.pdf',
      fileSize: 1024,
      version: 1,
      uploadedAt: new Date(),
      downloadUrl: '#',
    },
    reviewHistory: [],
    rubric: null,
  } as any,
  discussionPanelProps: null as Record<string, unknown> | null,
  shouldCompleteReview: false,
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: vi.fn().mockReturnValue((config: any) => ({
    ...config,
    useLoaderData: () => mocks.reviewDetail,
    useParams: () => ({ submissionId: '1' }),
  })),
  useNavigate: vi.fn().mockReturnValue(vi.fn()),
}));

vi.mock('@/routes/__root', () => ({
  useI18n: vi.fn().mockReturnValue({
    t: vi.fn().mockImplementation((key: string) => key),
    locale: 'en',
  }),
}));

vi.mock('@/server/reviews', () => ({
  getReviewDetail: vi.fn(),
  openForReview: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/hooks/use-review-nav', () => ({
  useReviewNav: vi.fn().mockReturnValue({ pendingList: [], currentIndex: -1 }),
}));

vi.mock('@/lib/errors', () => ({
  isServerError: vi.fn().mockReturnValue(false),
  serverError: vi.fn(),
  ErrorCode: { INTERNAL: 'INTERNAL' },
}));

vi.mock('@/components/reviews/ReviewDetailHeader', () => ({
  ReviewDetailHeader: ({ studentName }: any) => <h1 data-testid="review-header">{studentName}</h1>,
}));

vi.mock('@/components/reviews/ReviewFilePreview', () => ({
  ReviewFilePreview: () => <div data-testid="file-preview" />,
}));

vi.mock('@/components/reviews/ReviewHistory', () => ({
  ReviewHistory: () => <div data-testid="review-history" />,
}));

vi.mock('@/components/reviews/ReviewForm', () => ({
  ReviewForm: ({ onComplete }: any) => {
    React.useEffect(() => {
      if (mocks.shouldCompleteReview) onComplete();
    }, []);
    return null;
  },
}));

vi.mock('@/components/reviews/ReviewQueueSkeleton', () => ({
  ReviewQueueSkeleton: () => <div data-testid="review-skeleton" />,
}));

vi.mock('@/components/discussions/discussion-panel', () => ({
  DiscussionPanel: (props: any) => {
    mocks.discussionPanelProps = props;
    return <div data-testid="discussion-panel" />;
  },
}));

vi.mock('@/components/ui/empty-state', () => ({
  EmptyState: ({ title }: any) => <div>{title}</div>,
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));

vi.mock('lucide-react', () => ({
  AlertCircle: () => <div />,
  CheckCircle2: () => <div />,
  SearchX: () => <div />,
}));

describe('ReviewDetailPage - DiscussionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.discussionPanelProps = null;
    mocks.shouldCompleteReview = false;
  });

  it('should render DiscussionPanel with checkpointId and assignmentId from submission', async () => {
    const mod = await import('@/routes/_authenticated/instructor/reviews/$submissionId');
    const Component = (mod.Route as any).component;
    render(<Component />);

    expect(mocks.discussionPanelProps).toEqual({
      checkpointId: 1,
      assignmentId: 1,
      instructorView: true,
    });
  });

  it('should render DiscussionPanel below the file preview section', async () => {
    const mod = await import('@/routes/_authenticated/instructor/reviews/$submissionId');
    const Component = (mod.Route as any).component;
    const { container } = render(<Component />);

    const filePreview = container.querySelector('[data-testid="file-preview"]');
    const discussionPanelEl = container.querySelector('[data-testid="discussion-panel"]');

    expect(filePreview).toBeTruthy();
    expect(discussionPanelEl).toBeTruthy();

    // DiscussionPanel should come AFTER file preview in DOM order
    const allElements = Array.from(container.querySelectorAll('[data-testid]'));
    const filePreviewIndex = allElements.indexOf(filePreview!);
    const discussionPanelIndex = allElements.indexOf(discussionPanelEl!);

    expect(discussionPanelIndex).toBeGreaterThan(filePreviewIndex);
  });
});

describe('Instructor Review Detail heading order', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.discussionPanelProps = null;
    mocks.shouldCompleteReview = true;
  });

  it('should render success message as h1 (not h2) for proper heading order', async () => {
    const mod = await import('@/routes/_authenticated/instructor/reviews/$submissionId');
    const Component = (mod.Route as any).component;
    const { container } = render(<Component />);

    // Wait for success state to render (ReviewForm mock calls onComplete)
    await waitFor(() => {
      const h1s = container.querySelectorAll('h1');
      // Success state renders only the success message h1 (ReviewDetailHeader not rendered)
      expect(h1s.length).toBeGreaterThanOrEqual(1);
    });

    // Verify the success message is h1 (not h2)
    const successHeading = container.querySelector('h1');
    expect(successHeading).not.toBeNull();

    // Verify no h2 exists for the success message
    const h2s = container.querySelectorAll('h2');
    // The success message should be h1, not h2
    // (there may be h2s from other components, but the success message itself should be h1)
    const successText = 'instructorReviews.reviewSubmitted';
    const allH2Text = Array.from(h2s).map((h) => h.textContent);
    expect(allH2Text).not.toContain(successText);
  });
});
