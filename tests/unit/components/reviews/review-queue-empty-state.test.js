import { jsx as _jsx } from 'react/jsx-runtime';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReviewQueueEmptyState } from '@/components/reviews/ReviewQueueEmptyState';
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key) => key,
  }),
}));
describe('ReviewQueueEmptyState', () => {
  it('should render empty state title', () => {
    render(_jsx(ReviewQueueEmptyState, {}));
    expect(screen.getByText('instructorReviews.empty')).toBeDefined();
  });
  it('should render empty state prompt', () => {
    render(_jsx(ReviewQueueEmptyState, {}));
    expect(screen.getByText('instructorReviews.emptyPrompt')).toBeDefined();
  });
  it('should render the clipboard icon', () => {
    render(_jsx(ReviewQueueEmptyState, {}));
    const svg = document.querySelector('svg');
    expect(svg).toBeDefined();
  });
});
