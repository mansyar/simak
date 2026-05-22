import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

import { StudentAssignmentLoadingSkeleton } from '@/components/student/assignments/StudentAssignmentLoadingSkeleton';

describe('StudentAssignmentLoadingSkeleton', () => {
  it('should render 6 skeleton cards by default', () => {
    const { container } = render(<StudentAssignmentLoadingSkeleton />);
    const skeletons = container.querySelectorAll('[data-testid="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render specified count of skeleton cards', () => {
    const { container } = render(<StudentAssignmentLoadingSkeleton count={3} />);
    // Each card has multiple skeleton elements; verify the grid layout
    const cards = container.querySelectorAll('.overflow-hidden');
    expect(cards.length).toBe(3);
  });
});
