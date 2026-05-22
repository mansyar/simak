import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (params) return `${key} ${JSON.stringify(params)}`;
      return key;
    },
  }),
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
    render(<CheckpointCard checkpoint={passedCheckpoint} />);
    expect(screen.getByText('Proposal')).toBeDefined();
  });

  it('should render passed state badge with correct color', () => {
    render(<CheckpointCard checkpoint={passedCheckpoint} />);
    const badge = screen.getByText('studentAssignments.status.passed');
    expect(badge.className).toContain('bg-green');
  });

  it('should render locked state badge with correct color', () => {
    render(<CheckpointCard checkpoint={lockedCheckpoint} />);
    const badge = screen.getByText('studentAssignments.status.locked');
    expect(badge.className).toContain('bg-gray');
  });

  it('should display blocking reasons for locked checkpoints', () => {
    render(<CheckpointCard checkpoint={lockedCheckpoint} />);
    expect(screen.getByText('studentAssignments.blockedByPrevious')).toBeDefined();
    expect(screen.getByText(/studentAssignments.blockedByConsultations/)).toBeDefined();
  });

  it('should indicate overdue checkpoints', () => {
    render(<CheckpointCard checkpoint={overdueCheckpoint} />);
    expect(screen.getByText('studentAssignments.status.overdue')).toBeDefined();
  });

  it('should display consultation progress when minConsultations > 0', () => {
    render(<CheckpointCard checkpoint={passedCheckpoint} />);
    expect(screen.getByText(/studentAssignments.consultations/)).toBeDefined();
  });

  it('should render due date', () => {
    render(<CheckpointCard checkpoint={passedCheckpoint} />);
    expect(screen.getByText(/Mar/)).toBeDefined();
  });

  it('should render submit button for unlocked checkpoints', () => {
    render(<CheckpointCard checkpoint={overdueCheckpoint} />);
    expect(screen.getByText('studentAssignments.submit')).toBeDefined();
  });

  it('should not render submit button for locked checkpoints', () => {
    render(<CheckpointCard checkpoint={lockedCheckpoint} />);
    expect(screen.queryByText('studentAssignments.submit')).toBeNull();
  });
});
