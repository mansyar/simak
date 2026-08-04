/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InstructorDiscussionBrowser } from '@/components/instructor/assignments/InstructorDiscussionBrowser';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    locale: 'en',
    t: (key: string) => key,
  }),
}));

vi.mock('@/components/discussions/discussion-panel', () => ({
  DiscussionPanel: ({ checkpointId, assignmentId, instructorView }: any) => (
    <div
      data-testid="discussion-panel"
      data-checkpoint-id={checkpointId}
      data-assignment-id={assignmentId}
      data-instructor-view={instructorView ? 'true' : 'false'}
    />
  ),
}));

const students = [
  {
    id: 'student-1',
    name: 'Alice',
    checkpoints: [
      { id: 101, name: 'Proposal' },
      { id: 102, name: 'Chapter 1' },
    ],
  },
  {
    id: 'student-2',
    name: 'Bob',
    checkpoints: [{ id: 201, name: 'Proposal' }],
  },
];

describe('InstructorDiscussionBrowser', () => {
  it('shows one selected discussion at a time with accessible thread controls', () => {
    render(<InstructorDiscussionBrowser assignmentId={42} students={students} />);

    expect(
      screen.getByRole('searchbox', {
        name: 'instructorAssignments.discussions.searchLabel',
      }),
    ).toBeDefined();
    expect(screen.getAllByTestId('discussion-panel')).toHaveLength(1);
    expect(screen.getByTestId('discussion-panel').getAttribute('data-checkpoint-id')).toBe('101');
    const nextThread = screen.getByRole('button', { name: 'Alice — Chapter 1' });
    expect(nextThread.getAttribute('aria-pressed')).toBe('false');
    expect(nextThread.className).toContain('min-h-11');
    expect(nextThread.className).toContain('focus-visible:ring');
  });

  it('filters threads by student and exposes a student filter', () => {
    render(<InstructorDiscussionBrowser assignmentId={42} students={students} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'student-2' } });

    expect(
      screen.getByRole('combobox', {
        name: 'instructorAssignments.discussions.studentFilterLabel',
      }),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Bob — Proposal' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Alice — Proposal' })).toBeNull();
    expect(screen.getByTestId('discussion-panel').getAttribute('data-checkpoint-id')).toBe('201');
  });

  it('supports searching and selecting a specific thread', () => {
    render(<InstructorDiscussionBrowser assignmentId={42} students={students} />);

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Chapter 1' } });
    const thread = screen.getByRole('button', { name: 'Alice — Chapter 1' });
    expect(thread.getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('button', { name: 'Bob — Proposal' })).toBeNull();
  });

  it('shows a status when filters match no discussions', () => {
    render(<InstructorDiscussionBrowser assignmentId={42} students={students} />);

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'unknown' } });

    expect(screen.getByRole('status')).toBeDefined();
  });
});
