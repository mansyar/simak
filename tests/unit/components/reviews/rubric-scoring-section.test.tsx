import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RubricScoringSection } from '@/components/reviews/RubricScoringSection';
import type { RubricData } from '@/server/rubrics';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.ComponentProps<'input'>) => <input data-testid="score-input" {...props} />,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: any) => (
    <select
      value={value ?? ''}
      onChange={(e) => onValueChange?.(e.target.value)}
      data-testid="level-select"
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: any) => <>{children}</>,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
  SelectValue: () => null,
}));

const numericRubric: RubricData = {
  gradingType: 'numeric',
  criteria: [
    { id: 1, title: 'Code Quality', description: 'Assess code quality', weight: 50, order: 0 },
    { id: 2, title: 'Documentation', description: 'Assess documentation', weight: 50, order: 1 },
  ],
  levels: [],
};

describe('RubricScoringSection - Numeric Scoring', () => {
  const baseProps = {
    rubric: numericRubric,
    scores: [] as Array<{ criterionId: number; score: number }>,
    onScoresChange: vi.fn(),
  };

  it('renders rubric title', () => {
    render(<RubricScoringSection {...baseProps} />);
    expect(screen.getByText('instructorReviews.rubric.title')).toBeDefined();
  });

  it('renders criterion titles', () => {
    render(<RubricScoringSection {...baseProps} />);
    expect(screen.getByText('Code Quality')).toBeDefined();
    expect(screen.getByText('Documentation')).toBeDefined();
  });

  it('renders criterion descriptions', () => {
    render(<RubricScoringSection {...baseProps} />);
    expect(screen.getByText('Assess code quality')).toBeDefined();
    expect(screen.getByText('Assess documentation')).toBeDefined();
  });

  it('renders criterion weights', () => {
    render(<RubricScoringSection {...baseProps} />);
    expect(screen.getAllByText('50%')).toHaveLength(2);
  });

  it('renders score input per criterion', () => {
    render(<RubricScoringSection {...baseProps} />);
    expect(screen.getAllByTestId('score-input')).toHaveLength(2);
  });

  it('calls onScoresChange when score is entered for new criterion', () => {
    const onScoresChange = vi.fn();
    render(<RubricScoringSection {...baseProps} onScoresChange={onScoresChange} />);
    const inputs = screen.getAllByTestId('score-input');
    fireEvent.change(inputs[0], { target: { value: '80' } });
    expect(onScoresChange).toHaveBeenCalledWith([{ criterionId: 1, score: 80 }]);
  });

  it('updates existing score when changed', () => {
    const onScoresChange = vi.fn();
    render(
      <RubricScoringSection
        rubric={numericRubric}
        scores={[{ criterionId: 1, score: 80 }]}
        onScoresChange={onScoresChange}
      />,
    );
    const inputs = screen.getAllByTestId('score-input');
    fireEvent.change(inputs[0], { target: { value: '90' } });
    expect(onScoresChange).toHaveBeenCalledWith([{ criterionId: 1, score: 90 }]);
  });

  it('computes weighted total when all criteria scored', () => {
    render(
      <RubricScoringSection
        rubric={numericRubric}
        scores={[
          { criterionId: 1, score: 80 },
          { criterionId: 2, score: 90 },
        ]}
        onScoresChange={vi.fn()}
      />,
    );
    // weighted total = 80*50/100 + 90*50/100 = 40 + 45 = 85
    expect(screen.getByText('85 / 100')).toBeDefined();
  });

  it('shows weighted total label', () => {
    render(<RubricScoringSection {...baseProps} />);
    expect(screen.getByText('instructorReviews.rubric.weightedTotal')).toBeDefined();
  });

  it('shows warning when not all criteria scored', () => {
    render(
      <RubricScoringSection
        rubric={numericRubric}
        scores={[{ criterionId: 1, score: 80 }]}
        onScoresChange={vi.fn()}
      />,
    );
    expect(screen.getByText('instructorReviews.rubric.allCriteriaRequired')).toBeDefined();
  });

  it('does not show warning when all criteria scored', () => {
    render(
      <RubricScoringSection
        rubric={numericRubric}
        scores={[
          { criterionId: 1, score: 80 },
          { criterionId: 2, score: 90 },
        ]}
        onScoresChange={vi.fn()}
      />,
    );
    expect(screen.queryByText('instructorReviews.rubric.allCriteriaRequired')).toBeNull();
  });

  it('clamps score to 100 max', () => {
    const onScoresChange = vi.fn();
    render(<RubricScoringSection {...baseProps} onScoresChange={onScoresChange} />);
    const inputs = screen.getAllByTestId('score-input');
    fireEvent.change(inputs[0], { target: { value: '150' } });
    expect(onScoresChange).toHaveBeenCalledWith([{ criterionId: 1, score: 100 }]);
  });

  it('clamps score to 0 min', () => {
    const onScoresChange = vi.fn();
    render(<RubricScoringSection {...baseProps} onScoresChange={onScoresChange} />);
    const inputs = screen.getAllByTestId('score-input');
    fireEvent.change(inputs[0], { target: { value: '-10' } });
    expect(onScoresChange).toHaveBeenCalledWith([{ criterionId: 1, score: 0 }]);
  });

  it('shows weighted total as 0 when no scores entered', () => {
    render(<RubricScoringSection {...baseProps} />);
    expect(screen.getByText('0 / 100')).toBeDefined();
  });
});

const qualitativeRubric: RubricData = {
  gradingType: 'qualitative',
  criteria: [
    { id: 1, title: 'Code Quality', description: 'Assess code quality', weight: 50, order: 0 },
    { id: 2, title: 'Documentation', description: 'Assess documentation', weight: 50, order: 1 },
  ],
  levels: [
    { id: 10, label: 'Excellent', description: 'Outstanding work', score: 100, order: 0 },
    { id: 11, label: 'Good', description: 'Solid work', score: 75, order: 1 },
    { id: 12, label: 'Needs Work', description: 'Room for improvement', score: 50, order: 2 },
  ],
};

describe('RubricScoringSection - Qualitative Scoring', () => {
  const baseProps = {
    rubric: qualitativeRubric,
    scores: [] as Array<{ criterionId: number; score: number }>,
    onScoresChange: vi.fn(),
  };

  it('renders level Select per criterion', () => {
    render(<RubricScoringSection {...baseProps} />);
    expect(screen.getAllByTestId('level-select')).toHaveLength(2);
  });

  it('renders level options in each select', () => {
    render(<RubricScoringSection {...baseProps} />);
    expect(screen.getAllByText('Excellent')).toHaveLength(2);
    expect(screen.getAllByText('Good')).toHaveLength(2);
    expect(screen.getAllByText('Needs Work')).toHaveLength(2);
  });

  it('does not render numeric input when qualitative', () => {
    render(<RubricScoringSection {...baseProps} />);
    expect(screen.queryAllByTestId('score-input')).toHaveLength(0);
  });

  it('calls onScoresChange with score and rubricLevelId when level selected', () => {
    const onScoresChange = vi.fn();
    render(<RubricScoringSection {...baseProps} onScoresChange={onScoresChange} />);
    const selects = screen.getAllByTestId('level-select');
    fireEvent.change(selects[0], { target: { value: '10' } });
    expect(onScoresChange).toHaveBeenCalledWith([
      { criterionId: 1, score: 100, rubricLevelId: 10 },
    ]);
  });

  it('updates existing score and rubricLevelId when different level selected', () => {
    const onScoresChange = vi.fn();
    render(
      <RubricScoringSection
        rubric={qualitativeRubric}
        scores={[{ criterionId: 1, score: 100, rubricLevelId: 10 }]}
        onScoresChange={onScoresChange}
      />,
    );
    const selects = screen.getAllByTestId('level-select');
    fireEvent.change(selects[0], { target: { value: '11' } });
    expect(onScoresChange).toHaveBeenCalledWith([{ criterionId: 1, score: 75, rubricLevelId: 11 }]);
  });

  it('computes weighted total when all criteria scored via levels', () => {
    render(
      <RubricScoringSection
        rubric={qualitativeRubric}
        scores={[
          { criterionId: 1, score: 100, rubricLevelId: 10 },
          { criterionId: 2, score: 75, rubricLevelId: 11 },
        ]}
        onScoresChange={vi.fn()}
      />,
    );
    // weighted total = 100*50/100 + 75*50/100 = 50 + 37.5 = 87.5 → round to 88
    expect(screen.getByText('88 / 100')).toBeDefined();
  });

  it('shows warning when not all criteria scored', () => {
    render(
      <RubricScoringSection
        rubric={qualitativeRubric}
        scores={[{ criterionId: 1, score: 100, rubricLevelId: 10 }]}
        onScoresChange={vi.fn()}
      />,
    );
    expect(screen.getByText('instructorReviews.rubric.allCriteriaRequired')).toBeDefined();
  });

  it('does not show warning when all criteria scored via levels', () => {
    render(
      <RubricScoringSection
        rubric={qualitativeRubric}
        scores={[
          { criterionId: 1, score: 100, rubricLevelId: 10 },
          { criterionId: 2, score: 75, rubricLevelId: 11 },
        ]}
        onScoresChange={vi.fn()}
      />,
    );
    expect(screen.queryByText('instructorReviews.rubric.allCriteriaRequired')).toBeNull();
  });

  it('shows weighted total as 0 when no levels selected', () => {
    render(<RubricScoringSection {...baseProps} />);
    expect(screen.getByText('0 / 100')).toBeDefined();
  });
});
