import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReviewForm } from '@/components/reviews/ReviewForm';
import { submitReview } from '@/server/reviews';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/server/reviews', () => ({
  submitReview: vi.fn(),
}));

vi.mock('@/server/files', () => ({
  getPresignedReviewFeedbackUploadUrl: vi.fn(),
}));

vi.mock('@/components/reviews/FeedbackSnippetPicker', () => ({
  FeedbackSnippetPicker: () => null,
}));

vi.mock('@/lib/errors', () => ({
  isServerError: vi.fn(() => false),
}));

vi.mock('@/components/reviews/RubricScoringSection', () => ({
  RubricScoringSection: () => <div data-testid="rubric-scoring-section" />,
}));

describe('ReviewForm', () => {
  const baseProps = {
    submissionId: 10,
    onComplete: vi.fn(),
    onError: vi.fn(),
  };

  it('should render decision label', () => {
    render(<ReviewForm {...baseProps} />);
    expect(screen.getByText('instructorReviews.decision')).toBeDefined();
  });

  it('should render pass radio option', () => {
    render(<ReviewForm {...baseProps} />);
    const passRadio = screen.getByDisplayValue('pass');
    expect(passRadio).toBeDefined();
  });

  it('should render revise radio option', () => {
    render(<ReviewForm {...baseProps} />);
    const reviseRadio = screen.getByDisplayValue('revise');
    expect(reviseRadio).toBeDefined();
  });

  it('should render comment label', () => {
    render(<ReviewForm {...baseProps} />);
    expect(screen.getByText('instructorReviews.comment')).toBeDefined();
  });

  it('should render comment textarea', () => {
    render(<ReviewForm {...baseProps} />);
    expect(screen.getByPlaceholderText('instructorReviews.commentPlaceholder')).toBeDefined();
  });

  it('should render feedback file upload label', () => {
    render(<ReviewForm {...baseProps} />);
    expect(screen.getByText('instructorReviews.feedbackFile')).toBeDefined();
  });

  it('should render submit button', () => {
    render(<ReviewForm {...baseProps} />);
    expect(screen.getByText('instructorReviews.submitReview')).toBeDefined();
  });

  it('should disable submit button when no decision selected', () => {
    render(<ReviewForm {...baseProps} />);
    const button = screen.getByText('instructorReviews.submitReview').closest('button');
    expect(button).toHaveProperty('disabled', true);
  });

  it('should enable submit button when decision is selected', () => {
    render(<ReviewForm {...baseProps} />);
    const passRadio = screen.getByDisplayValue('pass');
    fireEvent.click(passRadio);
    const button = screen.getByText('instructorReviews.submitReview').closest('button');
    expect(button).toHaveProperty('disabled', false);
  });

  it('should show revision deadline when revise is selected', () => {
    render(<ReviewForm {...baseProps} />);
    const reviseRadio = screen.getByDisplayValue('revise');
    fireEvent.click(reviseRadio);
    expect(screen.getByText('instructorReviews.revisionDeadline')).toBeDefined();
  });

  it('should not show revision deadline when pass is selected', () => {
    render(<ReviewForm {...baseProps} />);
    const passRadio = screen.getByDisplayValue('pass');
    fireEvent.click(passRadio);
    expect(screen.queryByText('instructorReviews.revisionDeadline')).toBeNull();
  });

  // --- Skip rubric UI when grading_type is null (backward compatibility) ---

  it('should not render RubricScoringSection when rubric is null', () => {
    render(<ReviewForm {...baseProps} rubric={null} />);
    expect(screen.queryByTestId('rubric-scoring-section')).toBeNull();
  });

  it('should not render RubricScoringSection when rubric gradingType is null', () => {
    render(<ReviewForm {...baseProps} rubric={{ gradingType: null, criteria: [], levels: [] }} />);
    expect(screen.queryByTestId('rubric-scoring-section')).toBeNull();
  });

  it('should not disable submit by unscored criteria when rubric is null', () => {
    render(<ReviewForm {...baseProps} rubric={null} />);
    fireEvent.click(screen.getByDisplayValue('pass'));
    const button = screen.getByText('instructorReviews.submitReview').closest('button');
    expect(button).toHaveProperty('disabled', false);
  });

  it('should not send scores when rubric is null', async () => {
    render(<ReviewForm {...baseProps} rubric={null} />);
    fireEvent.click(screen.getByDisplayValue('pass'));
    fireEvent.click(screen.getByText('instructorReviews.submitReview'));
    await waitFor(() => {
      expect(submitReview).toHaveBeenCalledTimes(1);
    });
    const callArgs = vi.mocked(submitReview).mock.calls[0][0] as {
      data: { scores?: unknown };
    };
    expect(callArgs.data.scores).toBeUndefined();
  });
});
