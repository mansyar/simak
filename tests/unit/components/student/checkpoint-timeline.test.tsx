import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/components/student/assignments/CheckpointCard', () => ({
  CheckpointCard: ({ checkpoint }: any) => (
    <div data-testid={`checkpoint-card-${checkpoint.id}`}>{checkpoint.name}</div>
  ),
}));

import { CheckpointTimeline } from '@/components/student/assignments/CheckpointTimeline';

describe('CheckpointTimeline', () => {
  const checkpoints = [
    { id: 1, name: 'Proposal', order: 1, state: 'passed' as const },
    { id: 2, name: 'Chapter 1', order: 2, state: 'unlocked' as const },
    { id: 3, name: 'Final', order: 3, state: 'locked' as const },
  ];

  it('should render all checkpoints in order', () => {
    render(<CheckpointTimeline checkpoints={checkpoints as any} />);
    const cards = screen.getAllByTestId(/checkpoint-card-/);
    expect(cards).toHaveLength(3);
  });

  it('should render the timeline title', () => {
    render(<CheckpointTimeline checkpoints={checkpoints as any} />);
    expect(screen.getByText('studentAssignments.timeline')).toBeDefined();
  });

  it('should display checkpoints in the correct order', () => {
    render(<CheckpointTimeline checkpoints={checkpoints as any} />);
    const cards = screen.getAllByTestId(/checkpoint-card-/);
    expect(cards[0].textContent).toBe('Proposal');
    expect(cards[1].textContent).toBe('Chapter 1');
    expect(cards[2].textContent).toBe('Final');
  });
});
