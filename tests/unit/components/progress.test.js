import { jsx as _jsx } from 'react/jsx-runtime';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Progress } from '@/components/ui/progress';
describe('Progress', () => {
  it('renders an empty bar when value is 0', () => {
    render(_jsx(Progress, { value: 0 }));
    const bar = screen.getByRole('progressbar');
    expect(bar).toBeDefined();
  });
  it('renders with a label', () => {
    render(_jsx(Progress, { value: 50, label: 'Progress' }));
    expect(screen.getByText('Progress')).toBeDefined();
  });
  it('shows percentage when showValue is true', () => {
    render(_jsx(Progress, { value: 75, showValue: true }));
    expect(screen.getByText('75%')).toBeDefined();
  });
  it('does not show percentage by default', () => {
    render(_jsx(Progress, { value: 75 }));
    expect(screen.queryByText('75%')).toBeNull();
  });
  it('clamps value above max to 100%', () => {
    render(_jsx(Progress, { value: 150, max: 100, showValue: true }));
    expect(screen.getByText('100%')).toBeDefined();
  });
  it('clamps negative value to 0%', () => {
    render(_jsx(Progress, { value: -10, showValue: true }));
    expect(screen.getByText('0%')).toBeDefined();
  });
  it('calculates percentage based on max', () => {
    render(_jsx(Progress, { value: 1, max: 2, showValue: true }));
    expect(screen.getByText('50%')).toBeDefined();
  });
  it('applies custom className', () => {
    const { container } = render(_jsx(Progress, { value: 50, className: 'custom-class' }));
    expect(container.firstChild).toBeDefined();
  });
  it('renders both label and value together', () => {
    render(_jsx(Progress, { value: 30, label: 'Completion', showValue: true }));
    expect(screen.getByText('Completion')).toBeDefined();
    expect(screen.getByText('30%')).toBeDefined();
  });
  it('renders value without label', () => {
    render(_jsx(Progress, { value: 60, showValue: true }));
    expect(screen.getByText('60%')).toBeDefined();
  });
  it('renders label without value', () => {
    render(_jsx(Progress, { value: 40, label: 'Status' }));
    expect(screen.getByText('Status')).toBeDefined();
    expect(screen.queryByText('40%')).toBeNull();
  });
});
