import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (params) return `${key} ${JSON.stringify(params)}`;
      return key;
    },
    locale: 'en' as const,
  }),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, className, to }: any) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

import { CheckpointCard } from '@/components/student/assignments/CheckpointCard';

describe('CheckpointCard', () => {
  const passedCheckpoint = {
    id: 1,
    name: 'Proposal',
    order: 1,
    state: 'passed' as const,
    dueDate: new Date('2026-03-01'),
    minConsultations: 2,
    verifiedConsultationCount: 2,
  };

  const lockedCheckpoint = {
    id: 3,
    name: 'Final Defense',
    order: 3,
    state: 'locked' as const,
    dueDate: new Date('2026-05-01'),
    minConsultations: 1,
    verifiedConsultationCount: 0,
    blockingReasons: ['Previous checkpoint not passed', 'Insufficient consultations: 0/1 verified'],
  };

  const overdueCheckpoint = {
    id: 2,
    name: 'Chapter 1',
    order: 2,
    state: 'unlocked' as const,
    dueDate: new Date('2025-01-01'), // Past date
    minConsultations: 0,
    verifiedConsultationCount: 0,
  };

  it('should render checkpoint name', () => {
    render(<CheckpointCard checkpoint={passedCheckpoint} assignmentId={101} />);
    expect(screen.getByText('Proposal')).toBeDefined();
  });

  it('should render passed state badge with correct color', () => {
    render(<CheckpointCard checkpoint={passedCheckpoint} assignmentId={101} />);
    const badge = screen.getByText('studentAssignments.status.passed');
    expect(badge.className).toContain('bg-success');
  });

  it('should render locked state badge with correct variant', () => {
    render(<CheckpointCard checkpoint={lockedCheckpoint} assignmentId={101} />);
    const badge = screen.getByText('studentAssignments.status.locked');
    expect(badge).toBeDefined();
  });

  it('should display blocking reasons for locked checkpoints', () => {
    render(<CheckpointCard checkpoint={lockedCheckpoint} assignmentId={101} />);
    expect(screen.getByText('studentAssignments.blockedByPrevious')).toBeDefined();
    expect(screen.getByText(/studentAssignments.blockedByConsultations/)).toBeDefined();
  });

  it('should provide an explicit next-step message for locked checkpoints', () => {
    render(<CheckpointCard checkpoint={lockedCheckpoint} assignmentId={101} />);
    expect(screen.getByText('studentAssignments.lockedNextStep')).toBeDefined();
  });

  it('should expose checkpoint state as a status with an accessible label', () => {
    render(<CheckpointCard checkpoint={passedCheckpoint} assignmentId={101} />);
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-label')).toBe(
      'studentAssignments.statusLabel: studentAssignments.status.passed',
    );
  });

  it('should indicate overdue checkpoints', () => {
    render(<CheckpointCard checkpoint={overdueCheckpoint} assignmentId={101} />);
    expect(screen.getByText('studentAssignments.status.overdue')).toBeDefined();
  });

  it('should display consultation progress when minConsultations > 0', () => {
    render(<CheckpointCard checkpoint={passedCheckpoint} assignmentId={101} />);
    expect(screen.getByText(/studentAssignments.consultations/)).toBeDefined();
  });

  it('should render due date', () => {
    render(<CheckpointCard checkpoint={passedCheckpoint} assignmentId={101} />);
    expect(screen.getByText(/Mar/)).toBeDefined();
  });

  it('should display relative time in parentheses after absolute date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-26T00:00:00'));
    try {
      render(<CheckpointCard checkpoint={passedCheckpoint} assignmentId={101} />);
      expect(screen.getByText(/Mar 1, 2026 \(in 3 days\)/)).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('should render submit button for unlocked checkpoints', () => {
    render(<CheckpointCard checkpoint={overdueCheckpoint} assignmentId={101} />);
    expect(screen.getByText('studentAssignments.submit')).toBeDefined();
  });

  it('should not render submit button for locked checkpoints', () => {
    render(<CheckpointCard checkpoint={lockedCheckpoint} assignmentId={101} />);
    expect(screen.queryByText('studentAssignments.submit')).toBeNull();
  });

  it('should render resubmit button for revise state', () => {
    const reviseCheckpoint = { ...passedCheckpoint, state: 'revise' as const };
    render(<CheckpointCard checkpoint={reviseCheckpoint} assignmentId={101} />);
    expect(screen.getByText('studentAssignments.resubmit')).toBeDefined();
  });

  it('should render view submission link for submitted state', () => {
    const submittedCheckpoint = { ...passedCheckpoint, state: 'submitted' as const };
    render(<CheckpointCard checkpoint={submittedCheckpoint} assignmentId={101} />);
    expect(screen.getByText('studentAssignments.viewSubmission')).toBeDefined();
  });

  it('should render view submission link for under_review state', () => {
    const underReviewCheckpoint = { ...passedCheckpoint, state: 'under_review' as const };
    render(<CheckpointCard checkpoint={underReviewCheckpoint} assignmentId={101} />);
    expect(screen.getByText('studentAssignments.viewSubmission')).toBeDefined();
  });

  it('should render view submission link for passed state', () => {
    render(<CheckpointCard checkpoint={passedCheckpoint} assignmentId={101} />);
    expect(screen.getByText('studentAssignments.viewSubmission')).toBeDefined();
  });

  // FR-2: Semantic color token tests
  it('should use semantic success token for passed state container', () => {
    render(<CheckpointCard checkpoint={passedCheckpoint} assignmentId={101} />);
    const card = screen.getByText('Proposal').closest('[class*="border-l-"]');
    expect(card?.className).toContain('border-l-success');
    expect(card?.className).toContain('bg-success');
    expect(card?.className).not.toContain('green-500');
    expect(card?.className).not.toContain('green-50');
  });

  it('should use semantic info token for submitted state container', () => {
    const submitted = { ...passedCheckpoint, state: 'submitted' as const };
    render(<CheckpointCard checkpoint={submitted} assignmentId={101} />);
    const card = screen.getByText('Proposal').closest('[class*="border-l-"]');
    expect(card?.className).toContain('border-l-info');
    expect(card?.className).toContain('bg-info');
    expect(card?.className).not.toContain('blue-500');
  });

  it('should use semantic warning token for under_review state container', () => {
    const underReview = { ...passedCheckpoint, state: 'under_review' as const };
    render(<CheckpointCard checkpoint={underReview} assignmentId={101} />);
    const card = screen.getByText('Proposal').closest('[class*="border-l-"]');
    expect(card?.className).toContain('border-l-warning');
    expect(card?.className).toContain('bg-warning');
    expect(card?.className).not.toContain('amber-500');
  });

  it('should use semantic error token for revise state container', () => {
    const revise = { ...passedCheckpoint, state: 'revise' as const };
    render(<CheckpointCard checkpoint={revise} assignmentId={101} />);
    const card = screen.getByText('Proposal').closest('[class*="border-l-"]');
    expect(card?.className).toContain('border-l-error');
    expect(card?.className).toContain('bg-error');
    expect(card?.className).not.toContain('orange-500');
  });

  it('should use semantic primary token for unlocked state container', () => {
    render(<CheckpointCard checkpoint={overdueCheckpoint} assignmentId={101} />);
    const card = screen.getByText('Chapter 1').closest('[class*="border-l-"]');
    expect(card?.className).toContain('border-l-primary');
    expect(card?.className).toContain('bg-primary');
    expect(card?.className).not.toContain('teal-500');
  });

  it('should use semantic muted token for locked state container', () => {
    render(<CheckpointCard checkpoint={lockedCheckpoint} assignmentId={101} />);
    const card = screen.getByText('Final Defense').closest('[class*="border-l-"]');
    expect(card?.className).toContain('border-l-border');
    expect(card?.className).toContain('bg-muted');
    expect(card?.className).not.toContain('gray-400');
  });

  it('should use warning color for blocking reasons instead of red', () => {
    render(<CheckpointCard checkpoint={lockedCheckpoint} assignmentId={101} />);
    const reasons = screen.getAllByText(/studentAssignments\.blockedBy/);
    for (const reason of reasons) {
      // The text-warning class is on the parent div, not the span
      const container = reason.closest('[class*="text-warning"]') ?? reason.parentElement;
      expect(container?.className).toContain('text-warning');
      expect(container?.className).not.toContain('text-red-600');
    }
  });

  it('should use warning color for overdue date text instead of red', () => {
    render(<CheckpointCard checkpoint={overdueCheckpoint} assignmentId={101} />);
    const dateEl = screen.getByText(/Jan/);
    expect(dateEl.closest('[class*="text-"]')?.className).toContain('text-warning');
  });

  it('should use success color for satisfied consultation text instead of green', () => {
    render(<CheckpointCard checkpoint={passedCheckpoint} assignmentId={101} />);
    const consultEl = screen.getByText(/studentAssignments\.consultations/);
    expect(consultEl.closest('[class*="text-"]')?.className).toContain('text-success');
  });
});
