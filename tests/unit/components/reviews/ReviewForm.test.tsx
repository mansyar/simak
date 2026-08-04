/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock @tanstack/react-start
vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    middleware: vi.fn().mockReturnThis(),
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
  createMiddleware: vi.fn().mockReturnValue({
    server: vi.fn().mockImplementation((fn) => fn),
  }),
}));

// Mock server reviews
vi.mock('@/server/reviews', () => ({
  submitReview: vi.fn(),
}));

// Mock server files
vi.mock('@/server/files', () => ({
  getPresignedReviewFeedbackUploadUrl: vi.fn(),
}));

vi.mock('@/components/reviews/FeedbackSnippetPicker', () => ({
  FeedbackSnippetPicker: ({ onInsert }: { onInsert: (body: string) => void }) => (
    <div>
      <button
        type="button"
        data-testid="insert-first-snippet"
        onClick={() => onInsert('Use evidence.')}
      >
        insert first snippet
      </button>
      <button
        type="button"
        data-testid="insert-second-snippet"
        onClick={() => onInsert('Add detail.')}
      >
        insert second snippet
      </button>
    </div>
  ),
}));

// Mock __root
vi.mock('@/routes/__root', () => ({
  useI18n: vi.fn().mockReturnValue({
    t: vi.fn().mockImplementation((key: string) => key),
    locale: 'en',
    setLocale: vi.fn(),
  }),
}));

// Mock UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}));

vi.mock('lucide-react', () => ({
  Loader2: () => <div data-testid="loader" />,
  Upload: () => <div data-testid="upload-icon" />,
  ChevronDown: () => <div data-testid="chevron-down" />,
  ChevronUp: () => <div data-testid="chevron-up" />,
  Plus: () => <div data-testid="plus" />,
  Trash2: () => <div data-testid="trash" />,
}));

import { ReviewForm } from '@/components/reviews/ReviewForm';
import { submitReview } from '@/server/reviews';
import { getPresignedReviewFeedbackUploadUrl } from '@/server/files';

describe('ReviewForm', () => {
  const mockOnComplete = vi.fn();
  const mockOnError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the review form', () => {
    render(<ReviewForm submissionId={1} onComplete={mockOnComplete} onError={mockOnError} />);

    expect(screen.getByText('instructorReviews.decision')).toBeDefined();
    expect(screen.getByText('instructorReviews.pass')).toBeDefined();
    expect(screen.getByText('instructorReviews.revise')).toBeDefined();
    expect(screen.getByLabelText('instructorReviews.comment')).toBeDefined();
    expect(screen.getByText('instructorReviews.submitReview')).toBeDefined();
  });

  it('should show revision deadline when revise is selected', () => {
    render(<ReviewForm submissionId={1} onComplete={mockOnComplete} onError={mockOnError} />);

    fireEvent.click(screen.getByText('instructorReviews.revise'));

    expect(screen.getByLabelText('instructorReviews.revisionDeadline')).toBeDefined();
  });

  it('should not show revision deadline when pass is selected', () => {
    render(<ReviewForm submissionId={1} onComplete={mockOnComplete} onError={mockOnError} />);

    fireEvent.click(screen.getByText('instructorReviews.pass'));

    expect(screen.queryByLabelText('instructorReviews.revisionDeadline')).toBeNull();
  });

  it('shows the action-plan editor only for Revise', () => {
    render(<ReviewForm submissionId={1} onComplete={mockOnComplete} onError={mockOnError} />);

    expect(screen.queryByText('instructorReviews.revisionActionPlan')).toBeNull();
    fireEvent.click(screen.getByText('instructorReviews.revise'));
    expect(screen.getByText('instructorReviews.revisionActionPlan')).toBeDefined();

    fireEvent.click(screen.getByText('instructorReviews.pass'));
    expect(screen.queryByText('instructorReviews.revisionActionPlan')).toBeNull();
  });

  it('should show error when submitting revise without deadline', async () => {
    render(<ReviewForm submissionId={1} onComplete={mockOnComplete} onError={mockOnError} />);

    fireEvent.click(screen.getByText('instructorReviews.revise'));
    fireEvent.click(screen.getByText('instructorReviews.submitReview'));

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith('instructorReviews.revisionDeadlineRequired');
    });
  });

  it('should call submitReview on valid pass submission', async () => {
    vi.mocked(submitReview).mockResolvedValue({ success: true });

    render(<ReviewForm submissionId={1} onComplete={mockOnComplete} onError={mockOnError} />);

    fireEvent.click(screen.getByText('instructorReviews.pass'));
    fireEvent.change(screen.getByLabelText('instructorReviews.comment'), {
      target: { value: 'Good work!' },
    });
    fireEvent.click(screen.getByText('instructorReviews.submitReview'));

    await waitFor(() => {
      expect(submitReview).toHaveBeenCalledWith({
        data: {
          submissionId: 1,
          decision: 'pass',
          comment: 'Good work!',
          feedbackFileKey: undefined,
          revisionDeadline: undefined,
        },
      });
      expect(mockOnComplete).toHaveBeenCalled();
    });
  });

  it('should call submitReview on valid revise submission', async () => {
    vi.mocked(submitReview).mockResolvedValue({ success: true });

    render(<ReviewForm submissionId={1} onComplete={mockOnComplete} onError={mockOnError} />);

    fireEvent.click(screen.getByText('instructorReviews.revise'));
    fireEvent.change(screen.getByLabelText('instructorReviews.revisionDeadline'), {
      target: { value: '2026-06-01' },
    });
    fireEvent.change(screen.getByLabelText('instructorReviews.comment'), {
      target: { value: 'Needs revision' },
    });
    fireEvent.click(screen.getByText('instructorReviews.submitReview'));

    await waitFor(() => {
      expect(submitReview).toHaveBeenCalledWith({
        data: {
          submissionId: 1,
          decision: 'revise',
          comment: 'Needs revision',
          feedbackFileKey: undefined,
          revisionDeadline: '2026-06-01',
        },
      });
      expect(mockOnComplete).toHaveBeenCalled();
    });
  });

  it('submits ordered action items for Revise and omits them for Pass', async () => {
    vi.mocked(submitReview).mockResolvedValue({ success: true });

    render(<ReviewForm submissionId={1} onComplete={mockOnComplete} onError={mockOnError} />);
    fireEvent.click(screen.getByText('instructorReviews.revise'));
    fireEvent.change(screen.getByLabelText('instructorReviews.revisionDeadline'), {
      target: { value: '2026-06-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'instructorReviews.actionPlan.addItem' }));
    fireEvent.change(screen.getAllByRole('textbox')[1], {
      target: { value: 'Add a cited source' },
    });
    fireEvent.click(screen.getByText('instructorReviews.submitReview'));

    await waitFor(() => {
      expect(submitReview).toHaveBeenCalledWith({
        data: expect.objectContaining({
          decision: 'revise',
          actionItems: [{ itemText: 'Add a cited source' }],
        }),
      });
    });

    vi.clearAllMocks();
    cleanup();
    render(<ReviewForm submissionId={1} onComplete={mockOnComplete} onError={mockOnError} />);
    fireEvent.click(screen.getByText('instructorReviews.pass'));
    fireEvent.click(screen.getByText('instructorReviews.submitReview'));
    await waitFor(() => {
      expect(submitReview).toHaveBeenCalledWith({
        data: expect.not.objectContaining({ actionItems: expect.anything() }),
      });
    });
  });

  it('should show error when submitReview returns error', async () => {
    vi.mocked(submitReview).mockResolvedValue({
      error: { code: 'INTERNAL', message: 'Submission failed' },
    });

    render(<ReviewForm submissionId={1} onComplete={mockOnComplete} onError={mockOnError} />);

    fireEvent.click(screen.getByText('instructorReviews.pass'));
    fireEvent.click(screen.getByText('instructorReviews.submitReview'));

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith('instructorReviews.submitError');
    });
  });

  it('should show error when submitReview throws exception', async () => {
    vi.mocked(submitReview).mockRejectedValue(new Error('Network error'));

    render(<ReviewForm submissionId={1} onComplete={mockOnComplete} onError={mockOnError} />);

    fireEvent.click(screen.getByText('instructorReviews.pass'));
    fireEvent.click(screen.getByText('instructorReviews.submitReview'));

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith('instructorReviews.submitError');
    });
  });

  it('inserts a snippet into an empty comment without submitting or changing the decision', () => {
    render(<ReviewForm submissionId={1} onComplete={mockOnComplete} onError={mockOnError} />);

    const comment = screen.getByLabelText('instructorReviews.comment') as HTMLTextAreaElement;
    fireEvent.click(screen.getByTestId('insert-first-snippet'));

    expect(comment.value).toBe('Use evidence.');
    expect(document.activeElement).toBe(comment);
    expect(screen.getByDisplayValue('pass')).toHaveProperty('checked', false);
    expect(screen.getByDisplayValue('revise')).toHaveProperty('checked', false);
    expect(submitReview).not.toHaveBeenCalled();
  });

  it('adds exactly one blank line for non-empty comments and preserves continued editing', () => {
    render(<ReviewForm submissionId={1} onComplete={mockOnComplete} onError={mockOnError} />);

    const comment = screen.getByLabelText('instructorReviews.comment') as HTMLTextAreaElement;
    fireEvent.change(comment, { target: { value: 'Manual comment' } });
    fireEvent.click(screen.getByTestId('insert-first-snippet'));
    fireEvent.change(comment, { target: { value: `${comment.value} More manual text` } });
    fireEvent.click(screen.getByTestId('insert-second-snippet'));

    expect(comment.value).toBe('Manual comment\n\nUse evidence. More manual text\n\nAdd detail.');
    fireEvent.change(comment, { target: { value: `${comment.value} Edited` } });
    expect(comment.value.endsWith(' Edited')).toBe(true);
    expect(submitReview).not.toHaveBeenCalled();
  });

  it('does not add a separator when the existing comment is whitespace only', () => {
    render(<ReviewForm submissionId={1} onComplete={mockOnComplete} onError={mockOnError} />);

    const comment = screen.getByLabelText('instructorReviews.comment') as HTMLTextAreaElement;
    fireEvent.change(comment, { target: { value: '   ' } });
    fireEvent.click(screen.getByTestId('insert-first-snippet'));

    expect(comment.value).toBe('Use evidence.');
  });
});
