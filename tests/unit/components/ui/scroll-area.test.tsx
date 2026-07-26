import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ScrollArea } from '@/components/ui/scroll-area';

describe('ScrollArea', () => {
  it('renders children', () => {
    render(
      <ScrollArea data-testid="scroll-area">
        <div>Content</div>
      </ScrollArea>,
    );
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(
      <ScrollArea className="custom-class" data-testid="scroll-area">
        <div>Content</div>
      </ScrollArea>,
    );
    const scrollArea = screen.getByTestId('scroll-area');
    expect(scrollArea.className).toContain('custom-class');
  });

  it('applies default overflow classes', () => {
    render(
      <ScrollArea data-testid="scroll-area">
        <div>Content</div>
      </ScrollArea>,
    );
    const scrollArea = screen.getByTestId('scroll-area');
    expect(scrollArea.className).toContain('overflow-y-auto');
  });

  it('applies max height class when provided', () => {
    render(
      <ScrollArea maxHeight="300px" data-testid="scroll-area">
        <div>Content</div>
      </ScrollArea>,
    );
    const scrollArea = screen.getByTestId('scroll-area');
    expect(scrollArea.style.maxHeight).toBe('300px');
  });
});
