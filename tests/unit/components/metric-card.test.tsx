import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Users } from 'lucide-react';

import { MetricCard } from '@/components/ui/metric-card';

describe('MetricCard', () => {
  it('renders label and value', () => {
    render(<MetricCard label="Total Users" value={42} icon={Users} />);
    expect(screen.getByText('Total Users')).toBeDefined();
    expect(screen.getByText('42')).toBeDefined();
  });

  it('renders with string value', () => {
    render(<MetricCard label="Status" value="1.2k" icon={Users} />);
    expect(screen.getByText('1.2k')).toBeDefined();
  });

  it('renders icon component', () => {
    const { container } = render(<MetricCard label="Test" value={0} icon={Users} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeDefined();
  });

  it('applies custom className', () => {
    const { container } = render(
      <MetricCard label="Test" value={0} icon={Users} className="custom-class" />,
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('custom-class');
  });
});

describe('MetricCard color variants', () => {
  const colors = [
    { color: 'primary' as const, borderClass: 'border-t-primary', iconBgClass: 'bg-primary/10' },
    { color: 'success' as const, borderClass: 'border-t-success', iconBgClass: 'bg-success/10' },
    { color: 'warning' as const, borderClass: 'border-t-warning', iconBgClass: 'bg-warning/10' },
    { color: 'error' as const, borderClass: 'border-t-error', iconBgClass: 'bg-error/10' },
    { color: 'info' as const, borderClass: 'border-t-info', iconBgClass: 'bg-info/10' },
  ];

  for (const { color, borderClass, iconBgClass } of colors) {
    it(`renders ${color} variant with correct styles`, () => {
      const { container } = render(
        <MetricCard label="Test" value={0} icon={Users} color={color} />,
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain(borderClass);

      const iconContainer = card.querySelector('.size-11');
      expect(iconContainer?.className).toContain(iconBgClass);
    });
  }
});

describe('MetricCard hover styles', () => {
  it('has hover transform and shadow classes', () => {
    const { container } = render(<MetricCard label="Test" value={0} icon={Users} />);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('hover:-translate-y-0.5');
    expect(card.className).toContain('hover:shadow-md');
  });
});

describe('MetricCard typography', () => {
  it('uses font-display for value', () => {
    const { container } = render(<MetricCard label="Test" value={100} icon={Users} />);
    const valueEl = container.querySelector('.font-display');
    expect(valueEl).toBeDefined();
    expect(valueEl?.textContent).toBe('100');
    expect(valueEl?.className).toContain('text-[2.25rem]');
  });

  it('renders label with muted text', () => {
    const { container } = render(<MetricCard label="Test Label" value={0} icon={Users} />);
    const label = container.querySelector('.text-muted-foreground');
    expect(label).toBeDefined();
    expect(label?.textContent).toBe('Test Label');
  });
});
