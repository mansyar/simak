import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReviewHistory } from '@/components/reviews/ReviewHistory';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

const passReview = {
  id: 1,
  decision: 'pass' as const,
  comment: 'Great work!',
  instructorName: 'Dr. Smith',
  createdAt: new Date('2026-05-20'),
};

const reviseReview = {
  id: 2,
  decision: 'revise' as const,
  instructorName: 'Prof. Jones',
  createdAt: new Date('2026-05-22'),
};

describe('ReviewHistory', () => {
  it('should render nothing when reviews array is empty', () => {
    const { container } = render(<ReviewHistory reviews={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('should render review history title', () => {
    render(<ReviewHistory reviews={[passReview]} />);
    expect(screen.getByText('instructorReviews.reviewHistory')).toBeDefined();
  });

  it('should render pass badge for pass decision', () => {
    render(<ReviewHistory reviews={[passReview]} />);
    expect(screen.getByText('instructorReviews.passed')).toBeDefined();
  });

  it('should render revise badge for revise decision', () => {
    render(<ReviewHistory reviews={[reviseReview]} />);
    expect(screen.getByText('instructorReviews.revise')).toBeDefined();
  });

  it('should render instructor name', () => {
    render(<ReviewHistory reviews={[passReview]} />);
    expect(screen.getByText('Dr. Smith')).toBeDefined();
  });

  it('should render comment when present', () => {
    render(<ReviewHistory reviews={[passReview]} />);
    expect(screen.getByText('Great work!')).toBeDefined();
  });

  it('should render multiple reviews', () => {
    render(<ReviewHistory reviews={[passReview, reviseReview]} />);
    expect(screen.getByText('Dr. Smith')).toBeDefined();
    expect(screen.getByText('Prof. Jones')).toBeDefined();
  });
});
