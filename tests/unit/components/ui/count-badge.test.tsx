import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { CountBadge } from '@/components/ui/count-badge';

describe('CountBadge', () => {
  it('renders the count', () => {
    render(<CountBadge count={5} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders zero count by default', () => {
    render(<CountBadge count={0} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('hides when count is 0 and hideWhenZero is true', () => {
    const { container } = render(<CountBadge count={0} hideWhenZero />);
    expect(container.firstChild).toBeNull();
  });

  it('shows when count is greater than 0 and hideWhenZero is true', () => {
    render(<CountBadge count={3} hideWhenZero />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('applies canonical class string', () => {
    render(<CountBadge count={1} />);
    const badge = screen.getByText('1');
    expect(badge).toHaveClass(
      'inline-flex',
      'items-center',
      'justify-center',
      'min-w-[20px]',
      'h-5',
      'px-1.5',
      'text-[10px]',
      'font-bold',
      'rounded-full',
      'bg-primary',
      'text-primary-foreground',
    );
  });

  it('applies custom className', () => {
    render(<CountBadge count={1} className="custom-class" />);
    expect(screen.getByText('1')).toHaveClass('custom-class');
  });

  it('renders as a span element', () => {
    render(<CountBadge count={1} />);
    const badge = screen.getByText('1');
    expect(badge.tagName).toBe('SPAN');
  });

  it('handles large numbers', () => {
    render(<CountBadge count={999} />);
    expect(screen.getByText('999')).toBeInTheDocument();
  });
});
