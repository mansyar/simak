import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { TemplateLoadingSkeleton } from '@/components/admin/templates/TemplateLoadingSkeleton';

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
}));

describe('TemplateLoadingSkeleton', () => {
  it('should render skeleton cards', () => {
    const { container } = render(<TemplateLoadingSkeleton count={3} />);
    const cards = container.querySelectorAll('[data-testid="card"]');
    expect(cards.length).toBe(3);
    const skeletonElements = container.querySelectorAll('[data-testid="skeleton"]');
    expect(skeletonElements.length).toBeGreaterThan(0);
  });

  it('should render default number of skeleton items (6)', () => {
    const { container } = render(<TemplateLoadingSkeleton />);
    const cards = container.querySelectorAll('[data-testid="card"]');
    expect(cards.length).toBe(6);
  });

  it('should render specified count of skeleton items', () => {
    const { container } = render(<TemplateLoadingSkeleton count={3} />);
    const cards = container.querySelectorAll('[data-testid="card"]');
    expect(cards.length).toBe(3);
  });
});
