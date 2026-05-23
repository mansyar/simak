import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReviewQueueEmptyState } from '@/components/reviews/ReviewQueueEmptyState';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

describe('ReviewQueueEmptyState', () => {
  it('should render empty state title', () => {
    render(<ReviewQueueEmptyState />);
    expect(screen.getByText('instructorReviews.empty')).toBeDefined();
  });

  it('should render empty state prompt', () => {
    render(<ReviewQueueEmptyState />);
    expect(screen.getByText('instructorReviews.emptyPrompt')).toBeDefined();
  });

  it('should render the clipboard icon', () => {
    render(<ReviewQueueEmptyState />);
    const svg = document.querySelector('svg');
    expect(svg).toBeDefined();
  });
});
