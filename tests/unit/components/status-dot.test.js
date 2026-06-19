import { jsx as _jsx } from 'react/jsx-runtime';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusDot } from '@/components/ui/status-dot';
describe('StatusDot', () => {
  it('renders verified variant with bg-success', () => {
    const { container } = render(_jsx(StatusDot, { variant: 'verified' }));
    const dot = container.querySelector('.size-2');
    expect(dot).toBeDefined();
    expect(dot?.className).toContain('bg-success');
  });
  it('renders inactive variant with muted foreground', () => {
    const { container } = render(_jsx(StatusDot, { variant: 'inactive' }));
    const dot = container.querySelector('.size-2');
    expect(dot).toBeDefined();
    expect(dot?.className).toContain('bg-muted-foreground/40');
  });
  it('renders label text when provided', () => {
    render(_jsx(StatusDot, { variant: 'verified', label: 'Verified' }));
    expect(screen.getByText('Verified')).toBeDefined();
  });
  it('renders label with correct text size', () => {
    render(_jsx(StatusDot, { variant: 'inactive', label: 'Inactive' }));
    const label = screen.getByText('Inactive');
    expect(label).toBeDefined();
    expect(label.className).toContain('text-sm');
  });
  it('does not render label text when not provided', () => {
    const { container } = render(_jsx(StatusDot, { variant: 'verified' }));
    const allSpans = container.querySelectorAll('span');
    // Root span + dot span = 2 spans, no label span
    expect(allSpans.length).toBe(2);
    const labelText = container.querySelector('.text-sm');
    expect(labelText).toBeNull();
  });
  it('renders dot with rounded-full class', () => {
    const { container } = render(_jsx(StatusDot, { variant: 'verified' }));
    const dot = container.querySelector('.size-2');
    expect(dot?.className).toContain('rounded-full');
  });
  it('renders inline-flex layout', () => {
    const { container } = render(_jsx(StatusDot, { variant: 'verified' }));
    const root = container.firstChild;
    expect(root.className).toContain('inline-flex');
    expect(root.className).toContain('items-center');
  });
  it('applies custom className', () => {
    const { container } = render(
      _jsx(StatusDot, { variant: 'verified', className: 'custom-class' }),
    );
    const root = container.firstChild;
    expect(root.className).toContain('custom-class');
  });
  it('renders with gap between dot and label', () => {
    const { container } = render(_jsx(StatusDot, { variant: 'verified', label: 'Active' }));
    const root = container.firstChild;
    expect(root.className).toContain('gap-1.5');
  });
});
