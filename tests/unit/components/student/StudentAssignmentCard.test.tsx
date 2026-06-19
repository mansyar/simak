/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock @tanstack/react-router
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

// Mock __root
vi.mock('@/routes/__root', () => ({
  useI18n: vi.fn().mockReturnValue({
    t: vi.fn().mockImplementation((key: string) => key),
    locale: 'en',
    setLocale: vi.fn(),
  }),
}));

// Mock lucide-react
vi.mock('lucide-react', () => ({
  Calendar: () => <div data-testid="calendar-icon" />,
  Clipboard: () => <div data-testid="clipboard-icon" />,
}));

import { StudentAssignmentCard } from '@/components/student/assignments/StudentAssignmentCard';

const mockAssignment = {
  id: 1,
  title: 'Thesis Assignment',
  finalDeadline: new Date('2026-06-01'),
  templateName: 'Thesis Template',
  templateType: 'thesis',
  progressPercent: 50,
};

describe('StudentAssignmentCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render template type using Badge component', () => {
    render(<StudentAssignmentCard assignment={mockAssignment} />);

    const badge = screen.getByText('thesis');
    // Badge component renders as a span with badge variant classes
    expect(badge).toBeDefined();
    expect(badge.tagName).toBe('SPAN');
    // Should NOT have the old inline classes
    expect(badge.className).not.toContain('text-[10px]');
  });

  it('should not contain violet-500 gradient classes', () => {
    const { container } = render(<StudentAssignmentCard assignment={mockAssignment} />);
    const html = container.innerHTML;
    expect(html).not.toContain('violet-500');
    expect(html).not.toContain('from-violet');
    expect(html).not.toContain('to-violet');
  });

  it('should use Progress component instead of inline progress bar', () => {
    const { container } = render(<StudentAssignmentCard assignment={mockAssignment} />);
    const progressbar = container.querySelector('[role="progressbar"]');
    expect(progressbar).toBeDefined();
  });

  it('should render title and template name', () => {
    render(<StudentAssignmentCard assignment={mockAssignment} />);

    expect(screen.getByText('Thesis Assignment')).toBeDefined();
    expect(screen.getByText('Thesis Template')).toBeDefined();
  });

  it('should render deadline', () => {
    render(<StudentAssignmentCard assignment={mockAssignment} />);

    expect(screen.getByText(/studentAssignments\.finalDeadline/)).toBeDefined();
  });

  it('should render view all link', () => {
    render(<StudentAssignmentCard assignment={mockAssignment} />);

    expect(screen.getByText(/common\.viewAll/)).toBeDefined();
  });
});
