import { jsx as _jsx } from 'react/jsx-runtime';
/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
// Mock @tanstack/react-start
vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    handler: vi.fn().mockImplementation((fn) => fn),
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
// Mock __root
vi.mock('@/routes/__root', () => ({
  useI18n: vi.fn().mockReturnValue({
    t: vi.fn().mockImplementation((key) => key),
    locale: 'en',
    setLocale: vi.fn(),
  }),
}));
// Mock UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }) => _jsx('button', { ...props, children: children }),
}));
vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }) => _jsx('label', { ...props, children: children }),
}));
vi.mock('lucide-react', () => ({
  Loader2: () => _jsx('div', { 'data-testid': 'loader' }),
  Upload: () => _jsx('div', { 'data-testid': 'upload-icon' }),
}));
import { ReviewForm } from '@/components/reviews/ReviewForm';
import { submitReview } from '@/server/reviews';
describe('ReviewForm', () => {
  const mockOnComplete = vi.fn();
  const mockOnError = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('should render the review form', () => {
    render(_jsx(ReviewForm, { submissionId: 1, onComplete: mockOnComplete, onError: mockOnError }));
    expect(screen.getByText('instructorReviews.decision')).toBeDefined();
    expect(screen.getByText('instructorReviews.pass')).toBeDefined();
    expect(screen.getByText('instructorReviews.revise')).toBeDefined();
    expect(screen.getByLabelText('instructorReviews.comment')).toBeDefined();
    expect(screen.getByText('instructorReviews.submitReview')).toBeDefined();
  });
  it('should show revision deadline when revise is selected', () => {
    render(_jsx(ReviewForm, { submissionId: 1, onComplete: mockOnComplete, onError: mockOnError }));
    fireEvent.click(screen.getByText('instructorReviews.revise'));
    expect(screen.getByLabelText('instructorReviews.revisionDeadline')).toBeDefined();
  });
  it('should not show revision deadline when pass is selected', () => {
    render(_jsx(ReviewForm, { submissionId: 1, onComplete: mockOnComplete, onError: mockOnError }));
    fireEvent.click(screen.getByText('instructorReviews.pass'));
    expect(screen.queryByLabelText('instructorReviews.revisionDeadline')).toBeNull();
  });
  it('should show error when submitting revise without deadline', async () => {
    render(_jsx(ReviewForm, { submissionId: 1, onComplete: mockOnComplete, onError: mockOnError }));
    fireEvent.click(screen.getByText('instructorReviews.revise'));
    fireEvent.click(screen.getByText('instructorReviews.submitReview'));
    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith('instructorReviews.revisionDeadlineRequired');
    });
  });
  it('should call submitReview on valid pass submission', async () => {
    vi.mocked(submitReview).mockResolvedValue({ success: true });
    render(_jsx(ReviewForm, { submissionId: 1, onComplete: mockOnComplete, onError: mockOnError }));
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
    render(_jsx(ReviewForm, { submissionId: 1, onComplete: mockOnComplete, onError: mockOnError }));
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
  it('should show error when submitReview returns error', async () => {
    vi.mocked(submitReview).mockResolvedValue({ error: 'Submission failed' });
    render(_jsx(ReviewForm, { submissionId: 1, onComplete: mockOnComplete, onError: mockOnError }));
    fireEvent.click(screen.getByText('instructorReviews.pass'));
    fireEvent.click(screen.getByText('instructorReviews.submitReview'));
    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith('Submission failed');
    });
  });
  it('should show error when submitReview throws exception', async () => {
    vi.mocked(submitReview).mockRejectedValue(new Error('Network error'));
    render(_jsx(ReviewForm, { submissionId: 1, onComplete: mockOnComplete, onError: mockOnError }));
    fireEvent.click(screen.getByText('instructorReviews.pass'));
    fireEvent.click(screen.getByText('instructorReviews.submitReview'));
    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith('instructorReviews.submitError');
    });
  });
});
