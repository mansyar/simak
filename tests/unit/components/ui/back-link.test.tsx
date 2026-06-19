import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import userEvent from '@testing-library/user-event';
import { BackLink } from '@/components/ui/back-link';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, search, className, ...props }: any) => (
    <a href={to} className={className} data-search={JSON.stringify(search)} {...props}>
      {children}
    </a>
  ),
}));

describe('BackLink', () => {
  it('renders with ArrowLeft icon and label', () => {
    render(<BackLink to="/instructor/assignments" label="Back to Assignments" />);
    expect(screen.getByText('Back to Assignments')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/instructor/assignments');
  });

  it('applies canonical class string', () => {
    render(<BackLink to="/instructor/assignments" label="Back" />);
    const link = screen.getByRole('link');
    expect(link).toHaveClass(
      'inline-flex',
      'items-center',
      'gap-1.5',
      'text-sm',
      'font-medium',
      'text-muted-foreground',
      'hover:text-primary',
      'transition-colors',
    );
  });

  it('navigates via Link with correct to prop', () => {
    render(<BackLink to="/instructor/reviews" label="Back" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/instructor/reviews');
  });

  it('passes search prop to Link', () => {
    render(<BackLink to="/instructor/assignments" label="Back" search={{ page: 1, limit: 20 }} />);
    const link = screen.getByRole('link');
    expect(link.dataset.search).toBe(JSON.stringify({ page: 1, limit: 20 }));
  });

  it('applies custom className', () => {
    render(<BackLink to="/" label="Back" className="custom-class" />);
    expect(screen.getByRole('link')).toHaveClass('custom-class');
  });

  it('renders ArrowLeft icon (SVG)', () => {
    const { container } = render(<BackLink to="/" label="Back" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});
