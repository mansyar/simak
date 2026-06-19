import { jsx as _jsx } from 'react/jsx-runtime';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key) => key,
  }),
}));
vi.mock('@/components/student/assignments/CheckpointCard', () => ({
  CheckpointCard: ({ checkpoint }) =>
    _jsx('div', { 'data-testid': `checkpoint-card-${checkpoint.id}`, children: checkpoint.name }),
}));
import { CheckpointTimeline } from '@/components/student/assignments/CheckpointTimeline';
describe('CheckpointTimeline', () => {
  const checkpoints = [
    { id: 1, name: 'Proposal', order: 1, state: 'passed' },
    { id: 2, name: 'Chapter 1', order: 2, state: 'unlocked' },
    { id: 3, name: 'Final', order: 3, state: 'locked' },
  ];
  it('should render all checkpoints in order', () => {
    render(_jsx(CheckpointTimeline, { checkpoints: checkpoints, assignmentId: 101 }));
    const cards = screen.getAllByTestId(/checkpoint-card-/);
    expect(cards).toHaveLength(3);
  });
  it('should render the timeline title', () => {
    render(_jsx(CheckpointTimeline, { checkpoints: checkpoints, assignmentId: 101 }));
    expect(screen.getByText('studentAssignments.timeline')).toBeDefined();
  });
  it('should display checkpoints in the correct order', () => {
    render(_jsx(CheckpointTimeline, { checkpoints: checkpoints, assignmentId: 101 }));
    const cards = screen.getAllByTestId(/checkpoint-card-/);
    expect(cards[0].textContent).toBe('Proposal');
    expect(cards[1].textContent).toBe('Chapter 1');
    expect(cards[2].textContent).toBe('Final');
  });
});
