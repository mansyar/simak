import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Mail } from 'lucide-react';

import { EmailQueueStat } from '@/components/ui/email-queue-stat';

describe('EmailQueueStat', () => {
  it('renders label and value', () => {
    render(<EmailQueueStat icon={Mail} color="primary" label="Pending" value={42} />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('applies primary color classes', () => {
    render(<EmailQueueStat icon={Mail} color="primary" label="Pending" value={5} />);
    const container = screen.getByText('Pending').closest('div')!;
    expect(container).toHaveClass('rounded-lg', 'bg-card', 'p-5', 'text-center');
  });

  it('applies success color classes', () => {
    render(<EmailQueueStat icon={Mail} color="success" label="Sent" value={10} />);
    expect(screen.getByText('Sent')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('applies error color classes', () => {
    render(<EmailQueueStat icon={Mail} color="error" label="Failed" value={3} />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders zero value', () => {
    render(<EmailQueueStat icon={Mail} color="primary" label="Pending" value={0} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('renders the icon', () => {
    const { container } = render(
      <EmailQueueStat icon={Mail} color="primary" label="Pending" value={1} />,
    );
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
