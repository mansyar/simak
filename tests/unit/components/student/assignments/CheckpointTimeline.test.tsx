/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@/routes/__root', () => ({
  useI18n: vi.fn().mockReturnValue({
    t: vi.fn().mockImplementation((key: string) => key),
    locale: 'en',
  }),
}));

vi.mock('@/components/student/assignments/CheckpointCard', () => ({
  CheckpointCard: () => <div data-testid="checkpoint-card" />,
}));

import { CheckpointTimeline } from '@/components/student/assignments/CheckpointTimeline';

describe('CheckpointTimeline heading order', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render timeline title as h2 (not h3) for proper heading order', () => {
    const { container } = render(<CheckpointTimeline checkpoints={[]} assignmentId={1} />);

    const h2 = container.querySelector('h2');
    expect(h2).not.toBeNull();
    expect(h2?.textContent).toBe('studentAssignments.timeline');
    const h3 = container.querySelector('h3');
    expect(h3).toBeNull();
  });
});
