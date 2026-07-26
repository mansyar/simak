/**
 * Task 7 — Failing tests for student final grade card.
 *
 * Tests: StudentFinalGradeCard. Component doesn't exist yet — tests will fail.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('@/server/gradebook', () => ({
  getStudentFinalGrade: vi.fn(),
}));

import { StudentFinalGradeCard } from '@/components/gradebook/StudentFinalGradeCard';
import { getStudentFinalGrade } from '@/server/gradebook';
import type { FinalGradeResult, ContributingCheckpoint } from '@/lib/grade-computation';

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

// ---- Mock Data ----

const cp1: ContributingCheckpoint = {
  checkpointId: 1,
  checkpointName: 'Checkpoint 1',
  templateCheckpointId: 1,
  order: 0,
  state: 'passed',
  score: 100,
  isRubric: false,
  weight: 50,
};

const cp2: ContributingCheckpoint = {
  checkpointId: 2,
  checkpointName: 'Checkpoint 2',
  templateCheckpointId: 2,
  order: 1,
  state: 'passed',
  score: 87.5,
  isRubric: true,
  weight: 50,
};

const completeGrade: FinalGradeResult = {
  numericScore: 93.75,
  letterGrade: 'A',
  status: 'complete',
  contributingCheckpoints: [cp1, cp2],
  staleWeights: false,
};

const inProgressGrade: FinalGradeResult = {
  numericScore: 50,
  letterGrade: 'F',
  status: 'in_progress',
  contributingCheckpoints: [cp1, { ...cp2, state: 'locked', score: 0 }],
  staleWeights: false,
};

const incompleteGrade: FinalGradeResult = {
  numericScore: null,
  letterGrade: null,
  status: 'incomplete',
  contributingCheckpoints: [],
  staleWeights: false,
};

const mockServerError = { error: { code: 'INTERNAL', message: 'Failed' } };

// ---- Tests ----

describe('StudentFinalGradeCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows loading skeleton while fetching', () => {
    (getStudentFinalGrade as any).mockReturnValue(new Promise(() => {}));
    renderWithQuery(<StudentFinalGradeCard assignmentId={1} />);
    expect(screen.getByTestId('grade-card-skeleton')).toBeDefined();
  });

  it('renders nothing when grade is null (no config)', async () => {
    (getStudentFinalGrade as any).mockResolvedValue(null);
    const { container } = renderWithQuery(<StudentFinalGradeCard assignmentId={1} />);
    await waitFor(() => {
      expect(container.querySelector('[data-slot="card"]')).toBeNull();
    });
  });

  it('shows error message on server error', async () => {
    (getStudentFinalGrade as any).mockResolvedValue(mockServerError);
    renderWithQuery(<StudentFinalGradeCard assignmentId={1} />);
    await waitFor(() => {
      expect(screen.getByText('gradebook.loadError')).toBeDefined();
    });
  });

  it('shows numeric score and letter badge when complete', async () => {
    (getStudentFinalGrade as any).mockResolvedValue(completeGrade);
    renderWithQuery(<StudentFinalGradeCard assignmentId={1} />);
    await waitFor(() => {
      expect(screen.getByText('93.75')).toBeDefined();
      expect(screen.getByText('A')).toBeDefined();
      expect(screen.getByText('gradebook.status.complete')).toBeDefined();
    });
  });

  it('shows current progress score with in_progress status (no letter badge)', async () => {
    (getStudentFinalGrade as any).mockResolvedValue(inProgressGrade);
    renderWithQuery(<StudentFinalGradeCard assignmentId={1} />);
    await waitFor(() => {
      expect(screen.getByText('50')).toBeDefined();
      expect(screen.getByText('gradebook.status.in_progress')).toBeDefined();
    });
    // Letter badge should NOT be shown for in_progress
    expect(screen.queryByText('F')).toBeNull();
  });

  it('shows incomplete status without score or letter', async () => {
    (getStudentFinalGrade as any).mockResolvedValue(incompleteGrade);
    renderWithQuery(<StudentFinalGradeCard assignmentId={1} />);
    await waitFor(() => {
      expect(screen.getByText('gradebook.status.incomplete')).toBeDefined();
    });
  });

  it('hides breakdown by default and shows it on click', async () => {
    (getStudentFinalGrade as any).mockResolvedValue(completeGrade);
    renderWithQuery(<StudentFinalGradeCard assignmentId={1} />);
    await waitFor(() => {
      expect(screen.getByText('gradebook.student.finalGrade')).toBeDefined();
    });
    // Breakdown hidden initially
    expect(screen.queryByText('Checkpoint 1')).toBeNull();
    expect(screen.queryByText('Checkpoint 2')).toBeNull();
    // Click show breakdown
    fireEvent.click(screen.getByText('gradebook.student.breakdown'));
    expect(screen.getByText('Checkpoint 1')).toBeDefined();
    expect(screen.getByText('Checkpoint 2')).toBeDefined();
  });

  it('shows pass/fail label for non-rubric and numeric score for rubric in breakdown', async () => {
    (getStudentFinalGrade as any).mockResolvedValue(completeGrade);
    renderWithQuery(<StudentFinalGradeCard assignmentId={1} />);
    await waitFor(() => {
      expect(screen.getByText('gradebook.student.finalGrade')).toBeDefined();
    });
    fireEvent.click(screen.getByText('gradebook.student.breakdown'));
    // CP1: pass/fail → 'gradebook.passed'
    expect(screen.getByText('gradebook.passed')).toBeDefined();
    // CP2: rubric → numeric score 87.5
    expect(screen.getByText('87.5')).toBeDefined();
  });

  it('is read-only (only breakdown toggle button)', async () => {
    (getStudentFinalGrade as any).mockResolvedValue(completeGrade);
    const { container } = renderWithQuery(<StudentFinalGradeCard assignmentId={1} />);
    await waitFor(() => {
      expect(screen.getByText('gradebook.student.finalGrade')).toBeDefined();
    });
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(1);
  });

  it('uses gradebookKeys.studentFinalGrade(assignmentId) as query key', async () => {
    (getStudentFinalGrade as any).mockResolvedValue(completeGrade);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <StudentFinalGradeCard assignmentId={42} />
      </QueryClientProvider>,
    );
    await waitFor(() => {
      expect(screen.getByText('gradebook.student.finalGrade')).toBeDefined();
    });
    expect(queryClient.getQueryData(['gradebook', 'studentFinalGrade', 42])).toEqual(completeGrade);
  });
});
