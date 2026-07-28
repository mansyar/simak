/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@/routes/__root', () => ({
  useI18n: vi.fn().mockReturnValue({
    t: vi.fn().mockImplementation((key: string) => key),
    locale: 'en',
  }),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: vi.fn().mockReturnValue(vi.fn()),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));

vi.mock('@/lib/format', () => ({
  formatRelativeTime: () => 'in 2 days',
  formatDateShort: () => 'Jan 1, 2026',
}));

vi.mock('date-fns/isPast', () => ({
  isPast: () => false,
}));

vi.mock('lucide-react', () => ({
  Clock: () => <div />,
  AlertCircle: () => <div />,
  Users: () => <div />,
  ExternalLink: () => <div />,
}));

import { CheckpointCard } from '@/components/student/assignments/CheckpointCard';

describe('CheckpointCard heading order', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render checkpoint name as h3 (not h4) for proper heading order', () => {
    const checkpoint = {
      id: 1,
      name: 'Chapter 1',
      order: 1,
      state: 'unlocked' as const,
      dueDate: new Date('2026-06-01'),
      minConsultations: 0,
      verifiedConsultationCount: 0,
    };

    const { container } = render(<CheckpointCard checkpoint={checkpoint} assignmentId={1} />);

    const h3 = container.querySelector('h3');
    expect(h3).not.toBeNull();
    expect(h3?.textContent).toBe('Chapter 1');
    const h4 = container.querySelector('h4');
    expect(h4).toBeNull();
  });
});
