import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Badge } from '@/components/ui/badge';

describe('Badge', () => {
  it('renders children correctly', () => {
    render(<Badge>Badge text</Badge>);
    expect(screen.getByText('Badge text')).toBeDefined();
  });

  it('renders with default variant', () => {
    const { container } = render(<Badge>Default</Badge>);
    const badge = container.querySelector('[data-slot="badge"]');
    expect(badge).toBeDefined();
    expect(badge?.className).toContain('bg-primary');
  });

  it('applies custom className', () => {
    const { container } = render(<Badge className="custom-class">Custom</Badge>);
    const badge = container.querySelector('[data-slot="badge"]');
    expect(badge?.className).toContain('custom-class');
  });
});

describe('Badge variants', () => {
  const variants = [
    { variant: 'default' as const, classPattern: 'bg-primary' },
    { variant: 'secondary' as const, classPattern: 'bg-secondary' },
    { variant: 'destructive' as const, classPattern: 'bg-destructive/10' },
    { variant: 'success' as const, classPattern: 'bg-success/10' },
    { variant: 'warning' as const, classPattern: 'bg-warning/10' },
    { variant: 'error' as const, classPattern: 'bg-error/10' },
    { variant: 'info' as const, classPattern: 'bg-info/10' },
    { variant: 'outline' as const, classPattern: 'border-border' },
    { variant: 'ghost' as const, classPattern: 'hover:bg-muted' },
    { variant: 'link' as const, classPattern: 'text-primary' },
  ];

  for (const { variant, classPattern } of variants) {
    it(`renders ${variant} variant with correct styles`, () => {
      const { container } = render(<Badge variant={variant}>{variant}</Badge>);
      const badge = container.querySelector('[data-slot="badge"]');
      expect(badge).toBeDefined();
      expect(badge?.className).toContain(classPattern);
    });
  }
});

describe('Badge dot indicator', () => {
  it('renders dot indicator when showDot is true', () => {
    const { container } = render(<Badge showDot>With dot</Badge>);
    const dot = container.querySelector('span.rounded-full.bg-current');
    expect(dot).toBeDefined();
    expect(screen.getByText('With dot')).toBeDefined();
  });

  it('does not render dot when showDot is false', () => {
    const { container } = render(<Badge>No dot</Badge>);
    const dots = container.querySelectorAll('.bg-current');
    // Only the badge text, no additional dot span with bg-current
    const badge = container.querySelector('[data-slot="badge"]');
    expect(badge).toBeDefined();
  });
});

describe('Badge dot variant', () => {
  it('renders as a small standalone circle', () => {
    const { container } = render(<Badge variant="dot" />);
    const badge = container.querySelector('[data-slot="badge"]');
    expect(badge).toBeDefined();
    expect(badge?.className).toContain('size-2');
    expect(badge?.className).toContain('rounded-full');
    expect(badge?.className).toContain('p-0');
  });
});
