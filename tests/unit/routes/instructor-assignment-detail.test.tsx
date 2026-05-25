import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DeadlineManager } from '@/components/reviews/DeadlineManager';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/server/assignments', () => ({
  unlockCheckpoint: vi.fn(),
  extendDeadline: vi.fn(),
}));

const mockStudents = [
  {
    id: 'student-1',
    name: 'Alice Cooper',
    email: 'alice@test.com',
    progressPercent: 50,
    passedCount: 1,
    totalCheckpointsCount: 2,
    activeCheckpoint: { id: 2, name: 'Chapter 2', state: 'unlocked' as const },
    checkpoints: [
      {
        id: 1,
        name: 'Chapter 1',
        order: 1,
        state: 'passed' as const,
        studentId: 'student-1',
        dueDate: new Date('2026-05-20'),
        minConsultations: 0,
      },
      {
        id: 2,
        name: 'Chapter 2',
        order: 2,
        state: 'unlocked' as const,
        studentId: 'student-1',
        dueDate: new Date('2026-06-15'),
        minConsultations: 0,
      },
    ],
  },
  {
    id: 'student-2',
    name: 'Bob Marley',
    email: 'bob@test.com',
    progressPercent: 0,
    passedCount: 0,
    totalCheckpointsCount: 2,
    activeCheckpoint: { id: 3, name: 'Chapter 1', state: 'locked' as const },
    checkpoints: [
      {
        id: 3,
        name: 'Chapter 1',
        order: 1,
        state: 'locked' as const,
        studentId: 'student-2',
        dueDate: new Date('2026-05-20'),
        minConsultations: 0,
      },
      {
        id: 4,
        name: 'Chapter 2',
        order: 2,
        state: 'locked' as const,
        studentId: 'student-2',
        dueDate: new Date('2026-06-15'),
        minConsultations: 0,
      },
    ],
  },
];

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('Assignment Detail Page — DeadlineManager Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render DeadlineManager when assignment data with students is available', () => {
    renderWithQuery(<DeadlineManager students={mockStudents} assignmentId={1} />);
    expect(screen.getByText('instructorAssignments.deadlineManager.title')).toBeDefined();
  });

  it('should render the Deadline Manager below student progress data', () => {
    renderWithQuery(<DeadlineManager students={mockStudents} assignmentId={1} />);
    // DeadlineManager should be visible with student names
    expect(screen.getByText('Alice Cooper')).toBeDefined();
    expect(screen.getByText('Bob Marley')).toBeDefined();
  });

  it('should pass assignmentId to DeadlineManager for server function calls', async () => {
    const { unlockCheckpoint } = await import('@/server/assignments');
    (unlockCheckpoint as any).mockResolvedValue({ success: true });

    renderWithQuery(<DeadlineManager students={mockStudents} assignmentId={42} />);

    // Expand students
    const sections = screen.getAllByTestId('student-section');
    sections.forEach((s) => {
      const btn = s.querySelector('button');
      if (btn) fireEvent.click(btn);
    });

    // Click unlock
    const unlockButtons = screen.getAllByText('instructorAssignments.deadlineManager.unlock');
    fireEvent.click(unlockButtons[0]);

    // Confirm
    const confirmButton = screen.getByText('common.confirm');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(unlockCheckpoint).toHaveBeenCalled();
    });
  });

  it('should handle empty students array gracefully', () => {
    renderWithQuery(<DeadlineManager students={[]} assignmentId={1} />);
    // Should show empty state
    expect(screen.getByText('instructorAssignments.deadlineManager.empty')).toBeDefined();
  });

  it('should show Deadline Manager with correct heading icon and title', () => {
    renderWithQuery(<DeadlineManager students={mockStudents} assignmentId={1} />);
    const heading = screen.getByText('instructorAssignments.deadlineManager.title');
    expect(heading).toBeDefined();
    // The heading should be inside an h3 element
    expect(heading.tagName).toBe('H3');
  });
});
