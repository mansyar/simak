import { jsx as _jsx } from 'react/jsx-runtime';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DeadlineManager } from '@/components/reviews/DeadlineManager';
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key) => key,
  }),
}));
const mockUnlockCheckpoint = vi.fn();
const mockExtendDeadline = vi.fn();
vi.mock('@/server/assignments', () => ({
  unlockCheckpoint: (...args) => mockUnlockCheckpoint(...args),
  extendDeadline: (...args) => mockExtendDeadline(...args),
}));
function renderWithQuery(ui) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(_jsx(QueryClientProvider, { client: queryClient, children: ui }));
}
const mockStudents = [
  {
    id: 'student-1',
    name: 'Alice Cooper',
    email: 'alice@test.com',
    progressPercent: 50,
    passedCount: 1,
    totalCheckpointsCount: 2,
    activeCheckpoint: { id: 2, name: 'Chapter 2', state: 'unlocked' },
    checkpoints: [
      {
        id: 1,
        name: 'Chapter 1',
        order: 1,
        state: 'passed',
        studentId: 'student-1',
        dueDate: new Date('2026-05-20'),
        minConsultations: 0,
      },
      {
        id: 2,
        name: 'Chapter 2',
        order: 2,
        state: 'unlocked',
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
    activeCheckpoint: { id: 3, name: 'Chapter 1', state: 'locked' },
    checkpoints: [
      {
        id: 3,
        name: 'Chapter 1',
        order: 1,
        state: 'locked',
        studentId: 'student-2',
        dueDate: new Date('2026-05-20'),
        minConsultations: 0,
      },
      {
        id: 4,
        name: 'Chapter 2',
        order: 2,
        state: 'locked',
        studentId: 'student-2',
        dueDate: new Date('2026-06-15'),
        minConsultations: 0,
      },
    ],
  },
];
function expandAllStudents() {
  // Click on all student section headers to expand them
  const sections = screen.getAllByTestId('student-section');
  sections.forEach((section) => {
    const btn = section.querySelector('button');
    if (btn) fireEvent.click(btn);
  });
}
describe('DeadlineManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('should render the section heading', () => {
    renderWithQuery(_jsx(DeadlineManager, { students: mockStudents, assignmentId: 1 }));
    expect(screen.getByText('instructorAssignments.deadlineManager.title')).toBeDefined();
  });
  it('should render a list of students', () => {
    renderWithQuery(_jsx(DeadlineManager, { students: mockStudents, assignmentId: 1 }));
    expect(screen.getByText('Alice Cooper')).toBeDefined();
    expect(screen.getByText('Bob Marley')).toBeDefined();
  });
  it('should show Unlock button only for locked checkpoints', () => {
    renderWithQuery(_jsx(DeadlineManager, { students: mockStudents, assignmentId: 1 }));
    expandAllStudents();
    // Bob has 2 locked checkpoints — 2 Unlock buttons
    const unlockButtons = screen.getAllByText('instructorAssignments.deadlineManager.unlock');
    expect(unlockButtons.length).toBe(2);
  });
  it('should not show Unlock button for passed or unlocked checkpoints', () => {
    renderWithQuery(_jsx(DeadlineManager, { students: mockStudents, assignmentId: 1 }));
    expandAllStudents();
    // Alice has a passed (Chapter 1) and unlocked (Chapter 2) checkpoint — no Unlock buttons for her
    const aliceSection = screen
      .getAllByText('Alice Cooper')
      .map((el) => el.closest('[data-testid="student-section"]'))[0];
    const unlockButtonsInAlice = aliceSection ? aliceSection.querySelectorAll('button') : [];
    const aliceUnlockButtons = Array.from(unlockButtonsInAlice).filter(
      (btn) => btn.textContent === 'instructorAssignments.deadlineManager.unlock',
    );
    expect(aliceUnlockButtons.length).toBe(0);
  });
  it('should show confirmation dialog when Unlock is clicked', () => {
    renderWithQuery(_jsx(DeadlineManager, { students: mockStudents, assignmentId: 1 }));
    expandAllStudents();
    const unlockButton = screen.getAllByText('instructorAssignments.deadlineManager.unlock')[0];
    fireEvent.click(unlockButton);
    expect(screen.getByText('instructorAssignments.deadlineManager.unlockConfirm')).toBeDefined();
  });
  it('should call unlockCheckpoint when confirmation dialog is confirmed', async () => {
    mockUnlockCheckpoint.mockResolvedValue({ success: true });
    renderWithQuery(_jsx(DeadlineManager, { students: mockStudents, assignmentId: 1 }));
    expandAllStudents();
    const unlockButton = screen.getAllByText('instructorAssignments.deadlineManager.unlock')[0];
    fireEvent.click(unlockButton);
    const confirmButton = screen.getByText('common.confirm');
    fireEvent.click(confirmButton);
    await waitFor(() => {
      expect(mockUnlockCheckpoint).toHaveBeenCalledWith({ data: { checkpointId: 3 } });
    });
  });
  it('should show extend deadline date input per checkpoint', () => {
    renderWithQuery(_jsx(DeadlineManager, { students: mockStudents, assignmentId: 1 }));
    expandAllStudents();
    // Each checkpoint should have an Extend Deadline date input
    const dateInputs = screen.getAllByTestId(/extend-deadline-input/);
    // Total checkpoints = 2 (Alice) + 2 (Bob) = 4
    expect(dateInputs.length).toBe(4);
  });
  it('should disable extend button when date is empty', () => {
    renderWithQuery(_jsx(DeadlineManager, { students: mockStudents, assignmentId: 1 }));
    expandAllStudents();
    const extendButtons = screen.getAllByText('instructorAssignments.deadlineManager.extend');
    expect(extendButtons.length).toBe(4);
    // All buttons should be disabled initially (no date selected)
    extendButtons.forEach((btn) => {
      expect(btn.closest('button')).toHaveProperty('disabled', true);
    });
  });
  it('should enable extend button when a future date is picked', () => {
    renderWithQuery(_jsx(DeadlineManager, { students: mockStudents, assignmentId: 1 }));
    expandAllStudents();
    const dateInputs = screen.getAllByTestId(/extend-deadline-input/);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    fireEvent.change(dateInputs[0], { target: { value: futureDate.toISOString().slice(0, 10) } });
    const extendButtons = screen.getAllByText('instructorAssignments.deadlineManager.extend');
    expect(extendButtons[0].closest('button')).toHaveProperty('disabled', false);
  });
  it('should call extendDeadline with checkpoint id and new date', async () => {
    mockExtendDeadline.mockResolvedValue({ success: true });
    renderWithQuery(_jsx(DeadlineManager, { students: mockStudents, assignmentId: 1 }));
    expandAllStudents();
    const dateInputs = screen.getAllByTestId(/extend-deadline-input/);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const dateStr = futureDate.toISOString().slice(0, 10);
    fireEvent.change(dateInputs[0], { target: { value: dateStr } });
    const extendButton = screen.getAllByText('instructorAssignments.deadlineManager.extend')[0];
    fireEvent.click(extendButton);
    await waitFor(() => {
      expect(mockExtendDeadline).toHaveBeenCalled();
      const callArg = mockExtendDeadline.mock.calls[0][0];
      expect(callArg).toHaveProperty('data.checkpointId');
      expect(callArg).toHaveProperty('data.newDueDate');
    });
  });
  it('should show loading state during unlock mutation', async () => {
    // Return pending promise so mutation stays in loading state
    mockUnlockCheckpoint.mockReturnValue(new Promise(() => {}));
    renderWithQuery(_jsx(DeadlineManager, { students: mockStudents, assignmentId: 1 }));
    expandAllStudents();
    const unlockButton = screen.getAllByText('instructorAssignments.deadlineManager.unlock')[0];
    fireEvent.click(unlockButton);
    const confirmButton = screen.getByText('common.confirm');
    fireEvent.click(confirmButton);
    // After clicking confirm, the confirm button should become disabled (loading state)
    await waitFor(() => {
      const btn = screen.getByText('common.confirm').closest('button');
      expect(btn).toHaveProperty('disabled', true);
    });
  });
  it('should show error state when unlock fails', async () => {
    mockUnlockCheckpoint.mockRejectedValue(new Error('Failed to unlock'));
    renderWithQuery(_jsx(DeadlineManager, { students: mockStudents, assignmentId: 1 }));
    expandAllStudents();
    const unlockButton = screen.getAllByText('instructorAssignments.deadlineManager.unlock')[0];
    fireEvent.click(unlockButton);
    const confirmButton = screen.getByText('common.confirm');
    fireEvent.click(confirmButton);
    await waitFor(() => {
      expect(screen.getByText('instructorAssignments.deadlineManager.unlockError')).toBeDefined();
    });
  });
  it('should show empty state when no students are provided', () => {
    renderWithQuery(_jsx(DeadlineManager, { students: [], assignmentId: 1 }));
    expect(screen.getByText('instructorAssignments.deadlineManager.empty')).toBeDefined();
  });
  it('should show checkpoint state badge for each checkpoint', () => {
    renderWithQuery(_jsx(DeadlineManager, { students: mockStudents, assignmentId: 1 }));
    expandAllStudents();
    // Check for state badges within the deadline manager
    expect(screen.getByText('instructorAssignments.status.passed')).toBeDefined();
    expect(screen.getByText('instructorAssignments.status.unlocked')).toBeDefined();
    // Bob has 2 locked checkpoints
    expect(screen.getAllByText('instructorAssignments.status.locked').length).toBe(2);
  });
  it('should show current due date for each checkpoint', () => {
    renderWithQuery(_jsx(DeadlineManager, { students: mockStudents, assignmentId: 1 }));
    expandAllStudents();
    // Checkpoints have dueDates - the label appears per checkpoint (4 total)
    const deadlineLabels = screen.getAllByText((content) =>
      content.includes('instructorAssignments.deadlineManager.currentDeadline'),
    );
    expect(deadlineLabels.length).toBe(4);
  });
});
