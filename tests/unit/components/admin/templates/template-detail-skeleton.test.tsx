import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TemplateDetailSkeleton } from '@/components/admin/templates/TemplateDetailSkeleton';

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card">{children}</div>
  ),
  CardContent: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="card-content" data-class={className}>
      {children}
    </div>
  ),
}));

describe('TemplateDetailSkeleton', () => {
  it('should render 2 cards (metadata + checkpoints)', () => {
    render(<TemplateDetailSkeleton />);
    const cards = screen.getAllByTestId('card');
    expect(cards).toHaveLength(2);
  });

  it('should use Skeleton primitive (data-slot) for all placeholders', () => {
    render(<TemplateDetailSkeleton />);
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    // 1 back + 1 metadata header + 2 labels + 2 inputs + 2 metadata fields
    // + 1 checkpoints header + 9 (3 rows x 3) = 18
    expect(skeletons).toHaveLength(18);
  });

  it('should render a back button skeleton (h-8 w-40)', () => {
    render(<TemplateDetailSkeleton />);
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    const backSkeleton = Array.from(skeletons).find((s) =>
      s.className.includes('h-8'),
    );
    expect(backSkeleton).toBeDefined();
    expect(backSkeleton?.className).toContain('w-40');
  });

  it('should render checkpoint skeletons (3 rows of 3)', () => {
    render(<TemplateDetailSkeleton />);
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    const checkpointSkeletons = Array.from(skeletons).filter((s) =>
      s.className.includes('h-10'),
    );
    // 2 metadata inputs (h-10 w-full) + 9 checkpoint inputs (h-10) = 11
    expect(checkpointSkeletons.length).toBeGreaterThanOrEqual(9);
  });
});
