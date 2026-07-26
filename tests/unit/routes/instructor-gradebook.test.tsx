/**
 * Task 3 — Failing tests for instructor gradebook route components.
 *
 * Tests: GradebookTable, GradeConfigSummary, RecomputeGradesButton,
 * GradebookExportButtons. Components don't exist yet — tests will fail.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('@/server/gradebook', () => ({
  recomputeAllGrades: vi.fn(),
}));

vi.mock('@/server/analytics', () => ({
  exportGradebookCsv: vi.fn(),
}));

vi.mock('@/hooks/use-csv-download', () => ({
  useCsvDownload: () => ({ exportCsv: vi.fn(), isExporting: false }),
}));

vi.mock('@/lib/excel-export', () => ({
  exportGradebookToExcel: vi.fn(),
}));

import { GradebookTable } from '@/components/gradebook/GradebookTable';
import { GradeConfigSummary } from '@/components/gradebook/GradeConfigSummary';
import { RecomputeGradesButton } from '@/components/gradebook/RecomputeGradesButton';
import { GradebookExportButtons } from '@/components/gradebook/GradebookExportButtons';
import type {
  AssignmentGradeConfig,
  ContributingCheckpoint,
  FinalGradeResult,
} from '@/lib/grade-computation';

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

// ---- Mock Data ----

const mockConfig: AssignmentGradeConfig = {
  gradingScheme: 'equal_weight',
  customWeights: null,
  letterGradeBounds: { A: 90, B: 80, C: 70, D: 60 },
};

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

const cp1Failed: ContributingCheckpoint = { ...cp1, state: 'revise', score: 0 };

const aliceGrade: FinalGradeResult = {
  numericScore: 93.75,
  letterGrade: 'A',
  status: 'complete',
  contributingCheckpoints: [cp1, cp2],
  staleWeights: false,
};

const bobGrade: FinalGradeResult = {
  numericScore: 0,
  letterGrade: 'F',
  status: 'in_progress',
  contributingCheckpoints: [cp1Failed],
  staleWeights: false,
};

const mockStudents = [
  { studentId: 's1', studentName: 'Alice', checkpoints: [cp1, cp2], finalGrade: aliceGrade },
  { studentId: 's2', studentName: 'Bob', checkpoints: [cp1Failed], finalGrade: bobGrade },
];

// ---- GradebookTable ----

describe('GradebookTable', () => {
  it('renders student rows with names and checkpoint column headers', () => {
    renderWithQuery(<GradebookTable students={mockStudents} config={mockConfig} />);
    expect(screen.getByText('Alice')).toBeDefined();
    expect(screen.getByText('Bob')).toBeDefined();
    expect(screen.getByText('Checkpoint 1')).toBeDefined();
    expect(screen.getByText('Checkpoint 2')).toBeDefined();
  });

  it('shows pass/fail badge for non-rubric and score for rubric checkpoints', () => {
    renderWithQuery(<GradebookTable students={mockStudents} config={mockConfig} />);
    // Alice CP1: passed → badge
    expect(screen.getByText('gradebook.passed')).toBeDefined();
    // Alice CP2: rubric → numeric score
    expect(screen.getByText('87.5')).toBeDefined();
    // Bob CP1: revise → not passed badge
    expect(screen.getByText('gradebook.notPassed')).toBeDefined();
  });

  it('renders final grade column with score, letter, and status badge', () => {
    renderWithQuery(<GradebookTable students={mockStudents} config={mockConfig} />);
    expect(screen.getByText('93.75')).toBeDefined();
    expect(screen.getByText('A')).toBeDefined();
    expect(screen.getByText('gradebook.status.complete')).toBeDefined();
    expect(screen.getByText('F')).toBeDefined();
    expect(screen.getByText('gradebook.status.in_progress')).toBeDefined();
  });

  it('shows empty state when no students', () => {
    renderWithQuery(<GradebookTable students={[]} config={mockConfig} />);
    expect(screen.getByText('gradebook.empty')).toBeDefined();
  });
});

// ---- GradeConfigSummary ----

describe('GradeConfigSummary', () => {
  it('renders equal_weight scheme label', () => {
    renderWithQuery(<GradeConfigSummary config={mockConfig} />);
    expect(screen.getByText('gradebook.configSummary')).toBeDefined();
    expect(screen.getByText('gradebook.equalWeight')).toBeDefined();
  });

  it('renders custom_weight scheme label when custom', () => {
    const customConfig: AssignmentGradeConfig = {
      gradingScheme: 'custom_weight',
      customWeights: { '1': 60, '2': 40 },
      letterGradeBounds: { A: 90, B: 80, C: 70, D: 60 },
    };
    renderWithQuery(<GradeConfigSummary config={customConfig} />);
    expect(screen.getByText('gradebook.customWeight')).toBeDefined();
  });

  it('renders letter bounds label', () => {
    renderWithQuery(<GradeConfigSummary config={mockConfig} />);
    expect(screen.getByText('gradebook.letterBounds')).toBeDefined();
  });

  it('shows no config message when config is null', () => {
    renderWithQuery(<GradeConfigSummary config={null} />);
    expect(screen.getByText('gradebook.noGrades')).toBeDefined();
  });

  it('shows stale weights warning when staleWeights is true', () => {
    renderWithQuery(<GradeConfigSummary config={mockConfig} staleWeights={true} />);
    expect(screen.getByText('gradebook.staleWeightsWarning')).toBeDefined();
  });
});

// ---- RecomputeGradesButton ----

describe('RecomputeGradesButton', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not render button when isAdmin is false', () => {
    const { container } = renderWithQuery(
      <RecomputeGradesButton assignmentId={1} isAdmin={false} />,
    );
    expect(container.querySelector('button')).toBeNull();
  });

  it('renders button when isAdmin is true', () => {
    renderWithQuery(<RecomputeGradesButton assignmentId={1} isAdmin={true} />);
    expect(screen.getByText('gradebook.recomputeAll')).toBeDefined();
  });

  it('calls recomputeAllGrades after confirmation', async () => {
    const { recomputeAllGrades } = await import('@/server/gradebook');
    (recomputeAllGrades as any).mockResolvedValue({ success: true, count: 2 });

    renderWithQuery(<RecomputeGradesButton assignmentId={42} isAdmin={true} />);

    fireEvent.click(screen.getByText('gradebook.recomputeAll'));
    fireEvent.click(screen.getByText('common.confirm'));

    await waitFor(() => {
      expect(recomputeAllGrades).toHaveBeenCalledWith({ data: { assignmentId: 42 } });
    });
  });
});

// ---- GradebookExportButtons ----

describe('GradebookExportButtons', () => {
  it('renders CSV export button', () => {
    renderWithQuery(<GradebookExportButtons assignmentId={1} />);
    expect(screen.getByText('gradebook.exportCsv')).toBeDefined();
  });

  it('renders Excel export button', () => {
    renderWithQuery(<GradebookExportButtons assignmentId={1} />);
    expect(screen.getByText('gradebook.exportExcel')).toBeDefined();
  });
});
