import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { ListRow } from '@/components/ui/list-row';

describe('ListRow', () => {
  it('renders left content', () => {
    render(<ListRow left={<span>Left Content</span>} />);
    expect(screen.getByText('Left Content')).toBeInTheDocument();
  });

  it('renders right content', () => {
    render(<ListRow left={<span>Left</span>} right={<span>Right</span>} />);
    expect(screen.getByText('Right')).toBeInTheDocument();
  });

  it('renders without right content', () => {
    render(<ListRow left={<span>Left Only</span>} />);
    expect(screen.getByText('Left Only')).toBeInTheDocument();
    // Right side should not be present
    expect(screen.queryByText('Right')).not.toBeInTheDocument();
  });

  it('applies canonical class string', () => {
    render(<ListRow left={<span>Test</span>} />);
    const row = screen.getByText('Test').closest('div')!;
    // The ListRow itself should have the base classes
    expect(row.parentElement).toHaveClass(
      'flex',
      'items-center',
      'justify-between',
      'rounded-md',
      'border',
      'p-3',
      'text-sm',
    );
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    render(<ListRow left={<span>Clickable</span>} onClick={onClick} />);
    const row = screen.getByText('Clickable').closest('div')!.parentElement!;
    await row.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applies custom className', () => {
    render(<ListRow left={<span>Test</span>} className="custom-class" />);
    const row = screen.getByText('Test').closest('div')!.parentElement!;
    expect(row).toHaveClass('custom-class');
  });

  it('has cursor-pointer when onClick is provided', () => {
    render(<ListRow left={<span>Test</span>} onClick={() => {}} />);
    const row = screen.getByText('Test').closest('div')!.parentElement!;
    expect(row).toHaveClass('cursor-pointer');
  });
});
