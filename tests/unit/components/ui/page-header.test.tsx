import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { PageHeader } from '@/components/ui/page-header';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, search, className, ...props }: any) => (
    <a href={to} className={className} data-search={JSON.stringify(search)} {...props}>
      {children}
    </a>
  ),
}));

describe('PageHeader', () => {
  it('renders title with canonical heading class', () => {
    render(<PageHeader title="Assignments" />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveTextContent('Assignments');
    expect(heading).toHaveClass('font-display', 'text-3xl', 'text-foreground');
  });

  it('renders optional subtitle', () => {
    render(<PageHeader title="Assignments" subtitle="Manage your assignments" />);
    expect(screen.getByText('Manage your assignments')).toBeInTheDocument();
  });

  it('does not render subtitle when omitted', () => {
    const { container } = render(<PageHeader title="Assignments" />);
    const subtitles = container.querySelectorAll('p');
    expect(subtitles.length).toBe(0);
  });

  it('renders action slot on the right', () => {
    render(
      <PageHeader
        title="Assignments"
        action={<button data-testid="action-btn">Create</button>}
      />,
    );
    expect(screen.getByTestId('action-btn')).toBeInTheDocument();
    expect(screen.getByText('Create')).toBeInTheDocument();
  });

  it('renders back link when back prop is provided', () => {
    render(
      <PageHeader
        title="Assignment Detail"
        back={{ to: '/instructor/assignments', label: 'Back to Assignments' }}
      />,
    );
    expect(screen.getByText('Back to Assignments')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/instructor/assignments');
  });

  it('does not render back link when back prop is omitted', () => {
    const { container } = render(<PageHeader title="Assignments" />);
    const links = container.querySelectorAll('a');
    expect(links.length).toBe(0);
  });

  it('renders back link above title when back prop is provided', () => {
    const { container } = render(
      <PageHeader
        title="Assignment Detail"
        back={{ to: '/instructor/assignments', label: 'Back' }}
      />,
    );
    const heading = screen.getByRole('heading', { level: 1 });
    const link = screen.getByRole('link');
    // Link should appear before heading in DOM
    expect(link.compareDocumentPosition(heading)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('applies custom className', () => {
    const { container } = render(<PageHeader title="Assignments" className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('passes search prop to back link', () => {
    render(
      <PageHeader
        title="Detail"
        back={{
          to: '/instructor/assignments',
          label: 'Back',
          search: { page: 2 },
        }}
      />,
    );
    const link = screen.getByRole('link');
    expect(link.dataset.search).toBe(JSON.stringify({ page: 2 }));
  });
});
