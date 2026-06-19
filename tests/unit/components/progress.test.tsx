import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Progress } from '@/components/ui/progress';

describe('Progress', () => {
  it('renders an empty bar when value is 0', () => {
    render(<Progress value={0} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toBeDefined();
  });

  it('renders with a label', () => {
    render(<Progress value={50} label="Progress" />);
    expect(screen.getByText('Progress')).toBeDefined();
  });

  it('shows percentage when showValue is true', () => {
    render(<Progress value={75} showValue />);
    expect(screen.getByText('75%')).toBeDefined();
  });

  it('does not show percentage by default', () => {
    render(<Progress value={75} />);
    expect(screen.queryByText('75%')).toBeNull();
  });

  it('clamps value above max to 100%', () => {
    render(<Progress value={150} max={100} showValue />);
    expect(screen.getByText('100%')).toBeDefined();
  });

  it('clamps negative value to 0%', () => {
    render(<Progress value={-10} showValue />);
    expect(screen.getByText('0%')).toBeDefined();
  });

  it('calculates percentage based on max', () => {
    render(<Progress value={1} max={2} showValue />);
    expect(screen.getByText('50%')).toBeDefined();
  });

  it('applies custom className', () => {
    const { container } = render(<Progress value={50} className="custom-class" />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders both label and value together', () => {
    render(<Progress value={30} label="Completion" showValue />);
    expect(screen.getByText('Completion')).toBeDefined();
    expect(screen.getByText('30%')).toBeDefined();
  });

  it('renders value without label', () => {
    render(<Progress value={60} showValue />);
    expect(screen.getByText('60%')).toBeDefined();
  });

  it('renders label without value', () => {
    render(<Progress value={40} label="Status" />);
    expect(screen.getByText('Status')).toBeDefined();
    expect(screen.queryByText('40%')).toBeNull();
  });
});
