import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { TemplateTypeBadge } from '@/components/ui/template-type-badge';

describe('TemplateTypeBadge', () => {
  it('renders the type string', () => {
    render(<TemplateTypeBadge type="Research" />);
    expect(screen.getByText('Research')).toBeInTheDocument();
  });

  it('applies canonical pill class string', () => {
    render(<TemplateTypeBadge type="Assignment" />);
    const badge = screen.getByText('Assignment');
    expect(badge).toHaveClass(
      'text-[10px]',
      'font-bold',
      'tracking-wider',
      'uppercase',
      'text-primary',
      'bg-primary/10',
      'px-2',
      'py-0.5',
      'rounded-full',
    );
  });

  it('renders with uppercase text via CSS', () => {
    render(<TemplateTypeBadge type="project" />);
    const badge = screen.getByText('project');
    expect(badge).toHaveClass('uppercase');
  });

  it('applies custom className', () => {
    render(<TemplateTypeBadge type="Type" className="custom-class" />);
    expect(screen.getByText('Type')).toHaveClass('custom-class');
  });

  it('renders as a span element', () => {
    render(<TemplateTypeBadge type="Lab" />);
    const badge = screen.getByText('Lab');
    expect(badge.tagName).toBe('SPAN');
  });
});
