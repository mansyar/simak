import { jsx as _jsx } from 'react/jsx-runtime';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { TemplateLoadingSkeleton } from '@/components/admin/templates/TemplateLoadingSkeleton';
vi.mock('@/components/ui/card', () => ({
  Card: ({ children }) => _jsx('div', { 'data-testid': 'card', children: children }),
  CardContent: ({ children }) => _jsx('div', { 'data-testid': 'card-content', children: children }),
}));
describe('TemplateLoadingSkeleton', () => {
  it('should render skeleton cards', () => {
    const { container } = render(_jsx(TemplateLoadingSkeleton, { count: 3 }));
    const cards = container.querySelectorAll('[data-testid="card"]');
    expect(cards.length).toBe(3);
    const skeletonElements = container.querySelectorAll('[data-testid="skeleton"]');
    expect(skeletonElements.length).toBeGreaterThan(0);
  });
  it('should render default number of skeleton items (6)', () => {
    const { container } = render(_jsx(TemplateLoadingSkeleton, {}));
    const cards = container.querySelectorAll('[data-testid="card"]');
    expect(cards.length).toBe(6);
  });
  it('should render specified count of skeleton items', () => {
    const { container } = render(_jsx(TemplateLoadingSkeleton, { count: 3 }));
    const cards = container.querySelectorAll('[data-testid="card"]');
    expect(cards.length).toBe(3);
  });
});
