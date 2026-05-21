import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock the useLocation hook
const mockLocation = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useLocation: () => mockLocation(),
  Link: ({
    to,
    children,
    className,
  }: {
    to: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={to} className={className} data-testid={`link-${to}`}>
      {children}
    </a>
  ),
}));

// Mock the useI18n hook
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (params) {
        return `${key} ${JSON.stringify(params)}`;
      }
      return key;
    },
  }),
}));

import { StudentAssignmentCard } from '@/components/student/assignments/StudentAssignmentCard';

describe('StudentAssignmentCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockAssignment = {
    id: 101,
    title: 'Thesis Assignment',
    finalDeadline: new Date('2026-06-01'),
    templateName: 'Thesis Template',
    templateType: 'Thesis',
    progressPercent: 33,
  };

  it('should render the assignment title', () => {
    mockLocation.mockReturnValue({ pathname: '/student/assignments' });
    render(<StudentAssignmentCard assignment={mockAssignment} />);
    expect(screen.getByText('Thesis Assignment')).toBeDefined();
  });

  it('should render the template type badge', () => {
    mockLocation.mockReturnValue({ pathname: '/student/assignments' });
    render(<StudentAssignmentCard assignment={mockAssignment} />);
    expect(screen.getByText('Thesis')).toBeDefined();
  });

  it('should render the deadline', () => {
    mockLocation.mockReturnValue({ pathname: '/student/assignments' });
    render(<StudentAssignmentCard assignment={mockAssignment} />);
    // Should contain "Deadline:" prefix from i18n or the date
    const deadlineText = screen.getByText(/Jun/i);
    expect(deadlineText).toBeDefined();
  });

  it('should render the progress percentage', () => {
    mockLocation.mockReturnValue({ pathname: '/student/assignments' });
    render(<StudentAssignmentCard assignment={mockAssignment} />);
    const progressText = screen.getByText(/33/);
    expect(progressText).toBeDefined();
  });

  it('should link to the assignment detail page', () => {
    mockLocation.mockReturnValue({ pathname: '/student/assignments' });
    render(<StudentAssignmentCard assignment={mockAssignment} />);
    const link = screen.getByTestId('link-/student/assignments/101');
    expect(link).toBeDefined();
  });

  it('should render the template name', () => {
    mockLocation.mockReturnValue({ pathname: '/student/assignments' });
    render(<StudentAssignmentCard assignment={mockAssignment} />);
    expect(screen.getByText('Thesis Template')).toBeDefined();
  });
});
