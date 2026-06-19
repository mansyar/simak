import { jsx as _jsx } from 'react/jsx-runtime';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReviewQueueSkeleton } from '@/components/reviews/ReviewQueueSkeleton';
describe('ReviewQueueSkeleton', () => {
  it('should render default 5 skeleton items (7 skeleton divs each)', () => {
    render(_jsx(ReviewQueueSkeleton, {}));
    const skeletons = screen.getAllByTestId('skeleton');
    // 7 skeleton divs per item × 5 items = 35
    expect(skeletons.length).toBe(35);
  });
  it('should render custom count of skeleton items', () => {
    render(_jsx(ReviewQueueSkeleton, { count: 2 }));
    const skeletons = screen.getAllByTestId('skeleton');
    // 7 skeleton divs per item × 2 items = 14
    expect(skeletons.length).toBe(14);
  });
});
