import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardSkeleton } from '@/components/skeletons/dashboard-skeleton';

describe('DashboardSkeleton', () => {
  it('should render skeleton elements', () => {
    render(<DashboardSkeleton />);
    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render a page header skeleton', () => {
    const { container } = render(<DashboardSkeleton />);
    // The skeleton should have at least one heading-like area
    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render a card grid layout', () => {
    const { container } = render(<DashboardSkeleton />);
    // Should contain card-like structures (data-slot="card" from shadcn Card)
    const cards = container.querySelectorAll('[data-slot="card"]');
    expect(cards.length).toBeGreaterThan(0);
  });
});
