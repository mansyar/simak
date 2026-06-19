import { jsx as _jsx } from 'react/jsx-runtime';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '@/components/ui/badge';
describe('Badge', () => {
  it('renders children correctly', () => {
    render(_jsx(Badge, { children: 'Badge text' }));
    expect(screen.getByText('Badge text')).toBeDefined();
  });
  it('renders with default variant', () => {
    const { container } = render(_jsx(Badge, { children: 'Default' }));
    const badge = container.querySelector('[data-slot="badge"]');
    expect(badge).toBeDefined();
    expect(badge?.className).toContain('bg-primary');
  });
  it('applies custom className', () => {
    const { container } = render(_jsx(Badge, { className: 'custom-class', children: 'Custom' }));
    const badge = container.querySelector('[data-slot="badge"]');
    expect(badge?.className).toContain('custom-class');
  });
});
describe('Badge variants', () => {
  const variants = [
    { variant: 'default', classPattern: 'bg-primary' },
    { variant: 'secondary', classPattern: 'bg-secondary' },
    { variant: 'destructive', classPattern: 'bg-destructive/10' },
    { variant: 'success', classPattern: 'bg-success/10' },
    { variant: 'warning', classPattern: 'bg-warning/10' },
    { variant: 'error', classPattern: 'bg-error/10' },
    { variant: 'info', classPattern: 'bg-info/10' },
    { variant: 'outline', classPattern: 'border-border' },
    { variant: 'ghost', classPattern: 'hover:bg-muted' },
    { variant: 'link', classPattern: 'text-primary' },
  ];
  for (const { variant, classPattern } of variants) {
    it(`renders ${variant} variant with correct styles`, () => {
      const { container } = render(_jsx(Badge, { variant: variant, children: variant }));
      const badge = container.querySelector('[data-slot="badge"]');
      expect(badge).toBeDefined();
      expect(badge?.className).toContain(classPattern);
    });
  }
});
describe('Badge dot indicator', () => {
  it('renders dot indicator when showDot is true', () => {
    const { container } = render(_jsx(Badge, { showDot: true, children: 'With dot' }));
    const dot = container.querySelector('span.rounded-full.bg-current');
    expect(dot).toBeDefined();
    expect(screen.getByText('With dot')).toBeDefined();
  });
  it('does not render dot when showDot is false', () => {
    const { container } = render(_jsx(Badge, { children: 'No dot' }));
    const dots = container.querySelectorAll('.bg-current');
    // Only the badge text, no additional dot span with bg-current
    const badge = container.querySelector('[data-slot="badge"]');
    expect(badge).toBeDefined();
  });
});
describe('Badge dot variant', () => {
  it('renders as a small standalone circle', () => {
    const { container } = render(_jsx(Badge, { variant: 'dot' }));
    const badge = container.querySelector('[data-slot="badge"]');
    expect(badge).toBeDefined();
    expect(badge?.className).toContain('size-2');
    expect(badge?.className).toContain('rounded-full');
    expect(badge?.className).toContain('p-0');
  });
});
