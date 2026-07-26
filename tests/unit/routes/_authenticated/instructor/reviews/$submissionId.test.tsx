/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { ComponentType } from 'react';

const mocks = vi.hoisted(() => ({
  loaderData: {
    submission: {
      submissionId: 1,
      checkpointId: 42,
      checkpointName: 'Checkpoint 1',
      assignmentId: 10,
      assignmentTitle: 'Test Assignment',
      instructorId: 'instructor-1',
      studentId: 'student-1',
      studentName: 'John Doe',
      fileKey: 'key',
      fileName: 'file.pdf',
      fileSize: 1024,
      version: 1,
      uploadedAt: new Date('2026-01-01T00:00:00.000Z'),
      checkpointState: 'under_review' as const,
      checkpointUpdatedAt: new Date('2026-01-01T00:00:00.000Z'),
      templateCheckpointId: null,
      downloadUrl: 'https://example.com/download',
    },
    reviewHistory: [],
    rubric: null,
  },
  discussionPanelProps: null as Record<string, unknown> | null,
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: any) => ({
    ...config,
    useLoaderData: () => mocks.loaderData,
    useParams: () => ({ submissionId: '1' }),
  }),
  useNavigate: () => vi.fn(),
}));

vi.mock('@/server/reviews', () => ({
  getReviewDetail: vi.fn(),
  openForReview: vi.fn(),
}));

vi.mock('@/hooks/use-review-nav', () => ({
  useReviewNav: () => ({
    pendingList: [],
    currentIndex: -1,
  }),
}));

vi.mock('@/components/reviews/ReviewDetailHeader', () => ({
  ReviewDetailHeader: (props: any) => (
    <div data-testid="review-detail-header">{props.studentName}</div>
  ),
}));

vi.mock('@/components/reviews/ReviewFilePreview', () => ({
  ReviewFilePreview: () => <div data-testid="review-file-preview" />,
}));

vi.mock('@/components/reviews/ReviewHistory', () => ({
  ReviewHistory: () => <div data-testid="review-history" />,
}));

vi.mock('@/components/reviews/ReviewForm', () => ({
  ReviewForm: () => <div data-testid="review-form" />,
}));

vi.mock('@/components/reviews/ReviewQueueSkeleton', () => ({
  ReviewQueueSkeleton: () => <div data-testid="review-queue-skeleton" />,
}));

vi.mock('@/components/ui/empty-state', () => ({
  EmptyState: ({ title }: any) => <div data-testid="empty-state">{title}</div>,
}));

vi.mock('@/components/discussions/discussion-panel', () => ({
  DiscussionPanel: (props: any) => {
    mocks.discussionPanelProps = props;
    return <div data-testid="discussion-panel" />;
  },
}));

vi.mock('@/lib/errors', () => ({
  isServerError: () => false,
  serverError: vi.fn((code: string, message: string) => ({ error: { code, message } })),
  ErrorCode: { INTERNAL: 'INTERNAL', NOT_FOUND: 'NOT_FOUND', UNAUTHORIZED: 'UNAUTHORIZED' },
}));

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('lucide-react', () => ({
  AlertCircle: () => null,
  CheckCircle2: () => null,
  SearchX: () => null,
}));

import { Route } from '@/routes/_authenticated/instructor/reviews/$submissionId';

const ReviewDetailPage = (Route as any).component as ComponentType;

describe('ReviewDetailPage - DiscussionPanel', () => {
  beforeEach(() => {
    cleanup();
    mocks.discussionPanelProps = null;
  });

  it('should render DiscussionPanel with checkpointId and assignmentId from submission', () => {
    render(<ReviewDetailPage />);

    expect(mocks.discussionPanelProps).toEqual({
      checkpointId: 42,
      assignmentId: 10,
      instructorView: true,
    });
  });

  it('should render DiscussionPanel below the file preview section', () => {
    const { container } = render(<ReviewDetailPage />);

    const filePreview = container.querySelector('[data-testid="review-file-preview"]');
    const discussionPanel = container.querySelector('[data-testid="discussion-panel"]');

    expect(filePreview).toBeTruthy();
    expect(discussionPanel).toBeTruthy();

    // DiscussionPanel should come AFTER file preview in DOM order
    const allElements = Array.from(container.querySelectorAll('[data-testid]'));
    const filePreviewIndex = allElements.indexOf(filePreview!);
    const discussionPanelIndex = allElements.indexOf(discussionPanel!);

    expect(discussionPanelIndex).toBeGreaterThan(filePreviewIndex);
  });
});
