import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FileQuestion } from 'lucide-react';

import { EmptyState } from '@/components/ui/empty-state';

describe('EmptyState', () => {
  const defaultProps = {
    icon: FileQuestion,
    title: 'No items found',
    description: 'There are no items to display at this time.',
  };

  it('renders the title and description', () => {
    render(<EmptyState {...defaultProps} />);
    expect(screen.getByText('No items found')).toBeDefined();
    expect(screen.getByText('There are no items to display at this time.')).toBeDefined();
  });

  it('renders the icon', () => {
    const { container } = render(<EmptyState {...defaultProps} />);
    const iconContainer = container.querySelector('.size-16');
    expect(iconContainer).toBeDefined();
    const svg = iconContainer?.querySelector('svg');
    expect(svg).toBeDefined();
  });

  it('renders with dashed border class', () => {
    const { container } = render(<EmptyState {...defaultProps} />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('border-dashed');
  });

  it('renders with bg-card class', () => {
    const { container } = render(<EmptyState {...defaultProps} />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('bg-card');
  });

  it('renders with centered layout', () => {
    const { container } = render(<EmptyState {...defaultProps} />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('items-center');
    expect(root.className).toContain('text-center');
  });

  it('renders children when provided', () => {
    render(
      <EmptyState {...defaultProps}>
        <button>Create New</button>
      </EmptyState>,
    );
    expect(screen.getByRole('button', { name: 'Create New' })).toBeDefined();
  });

  it('does not render children container when no children', () => {
    const { container } = render(<EmptyState {...defaultProps} />);
    // The only direct children should be the icon container, h3, and p
    // No extra div wrapper for children
    const paragraphs = container.querySelectorAll('p');
    expect(paragraphs.length).toBe(1);
  });

  it('applies custom className', () => {
    const { container } = render(<EmptyState {...defaultProps} className="custom-class" />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('custom-class');
  });

  it('renders title with correct font size', () => {
    const { container } = render(<EmptyState {...defaultProps} />);
    const heading = container.querySelector('h3');
    expect(heading).toBeDefined();
    expect(heading?.className).toContain('text-[0.9375rem]');
    expect(heading?.className).toContain('font-semibold');
  });

  it('renders description with muted text', () => {
    const { container } = render(<EmptyState {...defaultProps} />);
    const description = container.querySelector('p');
    expect(description).toBeDefined();
    expect(description?.className).toContain('text-muted-foreground');
  });

  it('renders icon with 64px container', () => {
    const { container } = render(<EmptyState {...defaultProps} />);
    const iconContainer = container.querySelector('.size-16');
    expect(iconContainer).toBeDefined();
    expect(iconContainer?.className).toContain('rounded-full');
  });
});
