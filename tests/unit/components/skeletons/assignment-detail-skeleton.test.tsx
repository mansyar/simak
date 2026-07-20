import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AssignmentDetailSkeleton } from '@/components/skeletons/assignment-detail-skeleton';

describe('AssignmentDetailSkeleton', () => {
  it('should render skeleton elements', () => {
    render(<AssignmentDetailSkeleton />);
    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render a card layout', () => {
    const { container } = render(<AssignmentDetailSkeleton />);
    const cards = container.querySelectorAll('[data-slot="card"]');
    expect(cards.length).toBeGreaterThan(0);
  });
});
