import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReviewForm } from '@/components/reviews/ReviewForm';

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
});
