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
  actionItems: [
    {
      id: 21,
      itemText: 'Add a cited source',
      order: 0,
      criterionId: 7,
      criterionTitle: 'Evidence',
      addressedAt: null,
    },
  ],
};

describe('ReviewHistory', () => {
  it('should render empty state Card when reviews array is empty', () => {
    const { container } = render(<ReviewHistory reviews={[]} />);
    expect(container.innerHTML).not.toBe('');
    expect(screen.getByText('instructorReviews.noReviewsYet')).toBeDefined();
  });

  it('should render review history title even when reviews are empty', () => {
    render(<ReviewHistory reviews={[]} />);
    expect(screen.getByText('instructorReviews.reviewHistory')).toBeDefined();
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

  it('renders ordered action items with current-plan status and no instructor controls', () => {
    render(<ReviewHistory reviews={[reviseReview]} />);

    expect(screen.getByText('Add a cited source')).toBeDefined();
    expect(screen.getByText('instructorReviews.actionPlan.criterion')).toBeDefined();
    expect(screen.getByText('instructorReviews.actionPlan.current')).toBeDefined();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('renders addressed status for historical plans', () => {
    render(
      <ReviewHistory
        reviews={[
          {
            ...reviseReview,
            id: 3,
            actionItems: [
              {
                ...reviseReview.actionItems[0],
                addressedAt: new Date('2026-05-23'),
              },
            ],
          },
          reviseReview,
        ]}
      />,
    );

    expect(screen.getByText('instructorReviews.actionPlan.historical')).toBeDefined();
    expect(screen.getByText('instructorReviews.actionPlan.addressed')).toBeDefined();
  });

  it('does not label a comment-only Revise entry as an action plan', () => {
    render(<ReviewHistory reviews={[{ ...reviseReview, actionItems: undefined }]} />);

    expect(screen.queryByText('instructorReviews.actionPlan.current')).toBeNull();
    expect(screen.queryByText('instructorReviews.actionPlan.historical')).toBeNull();
  });

  it('should render multiple reviews', () => {
    render(<ReviewHistory reviews={[passReview, reviseReview]} />);
    expect(screen.getByText('Dr. Smith')).toBeDefined();
    expect(screen.getByText('Prof. Jones')).toBeDefined();
  });
});
