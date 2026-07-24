import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-header">{children}</div>
  ),
  CardTitle: ({ children }: { children: React.ReactNode }) => (
    <h3 data-testid="card-title">{children}</h3>
  ),
  CardContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-content">{children}</div>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="badge">{children}</span>
  ),
}));

import { RubricResultView } from '@/components/student/rubric-result-view';

const score = (overrides: Partial<Parameters<typeof RubricResultView>[0]['scores'][0]> = {}) => ({
  id: 1,
  criterionId: 10,
  criterionTitle: 'Content Quality',
  score: 85,
  weight: 100,
  rubricLevelId: null,
  levelLabel: null,
  comment: null,
  ...overrides,
});

describe('RubricResultView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when scores is empty', () => {
    const { container } = render(<RubricResultView scores={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders criterion title, score, and weight for each score', () => {
    const scores = [
      score({ id: 1, criterionTitle: 'Content Quality', score: 85, weight: 50 }),
      score({ id: 2, criterionId: 11, criterionTitle: 'Structure', score: 90, weight: 50 }),
    ];
    render(<RubricResultView scores={scores} />);
    expect(screen.getByText('Content Quality')).toBeDefined();
    expect(screen.getByText('85')).toBeDefined();
    expect(screen.getAllByText('50%')).toHaveLength(2);
    expect(screen.getByText('Structure')).toBeDefined();
    expect(screen.getByText('90')).toBeDefined();
  });

  it('renders level label for qualitative scores', () => {
    const scores = [score({ levelLabel: 'Good', rubricLevelId: 3 })];
    render(<RubricResultView scores={scores} />);
    expect(screen.getByText('Good')).toBeDefined();
  });

  it('does not render level label when null', () => {
    const scores = [score({ levelLabel: null, rubricLevelId: null })];
    render(<RubricResultView scores={scores} />);
    expect(screen.queryByText('Good')).toBeNull();
  });

  it('renders instructor comment when present', () => {
    const scores = [score({ comment: 'Solid analysis, needs more depth' })];
    render(<RubricResultView scores={scores} />);
    expect(screen.getByText('Solid analysis, needs more depth')).toBeDefined();
  });

  it('does not render comment section when null', () => {
    const scores = [score({ comment: null })];
    render(<RubricResultView scores={scores} />);
    expect(screen.queryByText('Solid analysis, needs more depth')).toBeNull();
  });

  it('computes and displays weighted total from snapshot', () => {
    const scores = [
      score({ id: 1, score: 80, weight: 60 }),
      score({ id: 2, criterionId: 11, score: 90, weight: 40 }),
    ];
    render(<RubricResultView scores={scores} />);
    // Weighted total = (80 * 60 + 90 * 40) / 100 = 84
    expect(screen.getByTestId('weighted-total').textContent).toBe('84');
  });

  it('shows soft-deleted criteria via snapshot fields', () => {
    const scores = [
      score({
        criterionId: 999,
        criterionTitle: 'Deleted Criterion',
        score: 75,
        weight: 100,
        comment: 'Criterion was later removed',
      }),
    ];
    render(<RubricResultView scores={scores} />);
    expect(screen.getByText('Deleted Criterion')).toBeDefined();
    expect(screen.getByTestId('badge').textContent).toBe('75');
    expect(screen.getByText('100%')).toBeDefined();
    expect(screen.getByText('Criterion was later removed')).toBeDefined();
  });

  it('renders card with title', () => {
    const scores = [score()];
    render(<RubricResultView scores={scores} />);
    expect(screen.getByTestId('card-title').textContent).toBe('studentRubrics.title');
  });
});
