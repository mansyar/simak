import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AssignmentLoadingSkeleton } from '@/components/instructor/assignments/AssignmentLoadingSkeleton';

describe('AssignmentLoadingSkeleton', () => {
  it('should render correct number of skeletons', () => {
    render(<AssignmentLoadingSkeleton count={3} />);
    const skeletons = screen.getAllByTestId('skeleton');
    // There are 7 skeleton elements per card
    expect(skeletons.length).toBe(3 * 7);
  });

  it('should default to 6 skeletons if count is omitted', () => {
    render(<AssignmentLoadingSkeleton />);
    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBe(6 * 7);
  });
});
