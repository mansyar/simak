import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockGetRubric = vi.hoisted(() => vi.fn());
const mockSaveRubric = vi.hoisted(() => vi.fn());
const mockCountPendingReviews = vi.hoisted(() => vi.fn());

vi.mock('@/server/rubrics', () => ({
  getRubric: { __rubricFn: 'getRubric' },
  saveRubric: { __rubricFn: 'saveRubric' },
  countPendingReviews: { __rubricFn: 'countPendingReviews' },
}));

vi.mock('@tanstack/react-start', () => ({
  useServerFn: vi.fn((fn: any) => {
    if (fn?.__rubricFn === 'getRubric') return mockGetRubric;
    if (fn?.__rubricFn === 'saveRubric') return mockSaveRubric;
    if (fn?.__rubricFn === 'countPendingReviews') return mockCountPendingReviews;
    return vi.fn();
  }),
  createServerFn: vi.fn().mockReturnValue({
    middleware: vi.fn().mockReturnThis(),
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
  createMiddleware: vi.fn().mockReturnValue({
    server: vi.fn().mockImplementation((fn) => fn),
  }),
}));

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const translations: Record<string, string> = {
        'rubrics.criteria.loading': 'Loading...',
        'rubrics.criteria.loadError': 'Failed to load rubric',
        'rubrics.criteria.saveError': 'Failed to save rubric',
        'rubrics.criteria.saveSuccess': 'Rubric saved',
        'rubrics.criteria.titlePlaceholder': 'Criterion title',
        'rubrics.criteria.descriptionPlaceholder': 'Description (optional)',
        'rubrics.criteria.add': 'Add Criterion',
        'rubrics.criteria.remove': 'Remove',
        'rubrics.criteria.moveUp': 'Move Up',
        'rubrics.criteria.moveDown': 'Move Down',
        'rubrics.criteria.weightSum': 'Weight sum: {sum}/100',
        'rubrics.criteria.save': 'Save Rubric',
        'rubrics.criteria.saving': 'Saving...',
        'rubrics.levels.add': 'Add Level',
        'rubrics.levels.remove': 'Remove',
        'rubrics.levels.moveUp': 'Move Up',
        'rubrics.levels.moveDown': 'Move Down',
        'rubrics.levels.labelPlaceholder': 'Level label',
        'rubrics.levels.descriptionPlaceholder': 'Description (optional)',
        'rubrics.levels.scoreLabel': 'Score',
        'rubrics.criteria.pendingReviewsTitle': 'Pending Reviews Affected',
        'rubrics.criteria.pendingReviewsWarning': '{count} pending review(s) will be affected.',
        'common.cancel': 'Cancel',
        'common.confirm': 'Confirm',
      };
      let result = translations[key] || key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          result = result.replace(`{${k}}`, v);
        });
      }
      return result;
    },
  }),
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('lucide-react', () => ({
  Plus: () => <span data-testid="icon-plus" />,
  X: () => <span data-testid="icon-x" />,
  ChevronUp: () => <span data-testid="icon-chevron-up" />,
  ChevronDown: () => <span data-testid="icon-chevron-down" />,
}));

vi.mock('@/components/admin/templates/RubricLevelsEditor', () => ({
  RubricLevelsEditor: ({ levels, onLevelsChange }: any) => (
    <div data-testid="rubric-levels-editor" data-levels-count={levels.length}>
      <button
        type="button"
        onClick={() =>
          onLevelsChange([
            ...levels,
            { label: 'New', description: '', score: 50, order: levels.length },
          ])
        }
      >
        Mock Add Level
      </button>
    </div>
  ),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: any) =>
    open ? <div data-testid="confirm-dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <div className="footer">{children}</div>,
}));

import { RubricCriteriaEditor } from '@/components/admin/templates/RubricCriteriaEditor';

describe('RubricCriteriaEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRubric.mockResolvedValue({ gradingType: 'numeric', criteria: [], levels: [] });
    mockSaveRubric.mockResolvedValue({ success: true });
    mockCountPendingReviews.mockResolvedValue({ count: 0 });
  });

  it('should show loading state initially', () => {
    mockGetRubric.mockReturnValue(new Promise(() => {}));
    render(<RubricCriteriaEditor templateCheckpointId={1} gradingType="numeric" />);
    expect(screen.getByText('Loading...')).toBeDefined();
  });

  it('should render fetched criteria', async () => {
    mockGetRubric.mockResolvedValue({
      gradingType: 'numeric',
      criteria: [
        { id: 1, title: 'Content', description: 'Quality of content', weight: 60, order: 0 },
        { id: 2, title: 'Grammar', description: null, weight: 40, order: 1 },
      ],
      levels: [],
    });
    render(<RubricCriteriaEditor templateCheckpointId={1} gradingType="numeric" />);
    await waitFor(() => {
      expect((screen.getByTestId('criterion-title-0') as HTMLInputElement).value).toBe('Content');
      expect((screen.getByTestId('criterion-title-1') as HTMLInputElement).value).toBe('Grammar');
    });
  });

  it('should show error when fetch fails', async () => {
    mockGetRubric.mockRejectedValue(new Error('Network error'));
    render(<RubricCriteriaEditor templateCheckpointId={1} gradingType="numeric" />);
    await waitFor(() => {
      expect(screen.getByText('Failed to load rubric')).toBeDefined();
    });
  });

  it('should add a new criterion when Add Criterion is clicked', async () => {
    mockGetRubric.mockResolvedValue({ gradingType: 'numeric', criteria: [], levels: [] });
    render(<RubricCriteriaEditor templateCheckpointId={1} gradingType="numeric" />);
    await waitFor(() => {
      expect(screen.getByText('Add Criterion')).toBeDefined();
    });
    fireEvent.click(screen.getByText('Add Criterion'));
    expect(screen.getByTestId('criterion-title-0')).toBeDefined();
  });

  it('should remove a criterion when Remove is clicked', async () => {
    mockGetRubric.mockResolvedValue({
      gradingType: 'numeric',
      criteria: [
        { id: 1, title: 'Content', description: null, weight: 60, order: 0 },
        { id: 2, title: 'Grammar', description: null, weight: 40, order: 1 },
      ],
      levels: [],
    });
    render(<RubricCriteriaEditor templateCheckpointId={1} gradingType="numeric" />);
    await waitFor(() => {
      expect((screen.getByTestId('criterion-title-0') as HTMLInputElement).value).toBe('Content');
    });
    fireEvent.click(screen.getAllByLabelText('Remove')[0]);
    expect((screen.getByTestId('criterion-title-0') as HTMLInputElement).value).toBe('Grammar');
  });

  it('should reorder criteria when Move Up is clicked', async () => {
    mockGetRubric.mockResolvedValue({
      gradingType: 'numeric',
      criteria: [
        { id: 1, title: 'First', description: null, weight: 50, order: 0 },
        { id: 2, title: 'Second', description: null, weight: 50, order: 1 },
      ],
      levels: [],
    });
    render(<RubricCriteriaEditor templateCheckpointId={1} gradingType="numeric" />);
    await waitFor(() => {
      expect((screen.getByTestId('criterion-title-0') as HTMLInputElement).value).toBe('First');
    });
    fireEvent.click(screen.getAllByLabelText('Move Up')[1]);
    expect((screen.getByTestId('criterion-title-0') as HTMLInputElement).value).toBe('Second');
    expect((screen.getByTestId('criterion-title-1') as HTMLInputElement).value).toBe('First');
  });

  it('should reorder criteria when Move Down is clicked', async () => {
    mockGetRubric.mockResolvedValue({
      gradingType: 'numeric',
      criteria: [
        { id: 1, title: 'First', description: null, weight: 50, order: 0 },
        { id: 2, title: 'Second', description: null, weight: 50, order: 1 },
      ],
      levels: [],
    });
    render(<RubricCriteriaEditor templateCheckpointId={1} gradingType="numeric" />);
    await waitFor(() => {
      expect((screen.getByTestId('criterion-title-0') as HTMLInputElement).value).toBe('First');
    });
    fireEvent.click(screen.getAllByLabelText('Move Down')[0]);
    expect((screen.getByTestId('criterion-title-0') as HTMLInputElement).value).toBe('Second');
    expect((screen.getByTestId('criterion-title-1') as HTMLInputElement).value).toBe('First');
  });

  it('should update title when title input changes', async () => {
    mockGetRubric.mockResolvedValue({
      gradingType: 'numeric',
      criteria: [{ id: 1, title: 'Content', description: null, weight: 100, order: 0 }],
      levels: [],
    });
    render(<RubricCriteriaEditor templateCheckpointId={1} gradingType="numeric" />);
    await waitFor(() => {
      expect((screen.getByTestId('criterion-title-0') as HTMLInputElement).value).toBe('Content');
    });
    fireEvent.change(screen.getByTestId('criterion-title-0'), { target: { value: 'Updated' } });
    expect((screen.getByTestId('criterion-title-0') as HTMLInputElement).value).toBe('Updated');
  });

  it('should update description when description input changes', async () => {
    mockGetRubric.mockResolvedValue({
      gradingType: 'numeric',
      criteria: [{ id: 1, title: 'Content', description: 'Original', weight: 100, order: 0 }],
      levels: [],
    });
    render(<RubricCriteriaEditor templateCheckpointId={1} gradingType="numeric" />);
    await waitFor(() => {
      expect((screen.getByTestId('criterion-description-0') as HTMLInputElement).value).toBe(
        'Original',
      );
    });
    fireEvent.change(screen.getByTestId('criterion-description-0'), {
      target: { value: 'Updated desc' },
    });
    expect((screen.getByTestId('criterion-description-0') as HTMLInputElement).value).toBe(
      'Updated desc',
    );
  });

  it('should update weight when weight input changes', async () => {
    mockGetRubric.mockResolvedValue({
      gradingType: 'numeric',
      criteria: [
        { id: 1, title: 'A', description: null, weight: 50, order: 0 },
        { id: 2, title: 'B', description: null, weight: 30, order: 1 },
      ],
      levels: [],
    });
    render(<RubricCriteriaEditor templateCheckpointId={1} gradingType="numeric" />);
    await waitFor(() => {
      expect((screen.getByTestId('criterion-weight-0') as HTMLInputElement).value).toBe('50');
    });
    fireEvent.change(screen.getByTestId('criterion-weight-0'), { target: { value: '70' } });
    expect((screen.getByTestId('criterion-weight-0') as HTMLInputElement).value).toBe('70');
  });

  it('should display weight sum', async () => {
    mockGetRubric.mockResolvedValue({
      gradingType: 'numeric',
      criteria: [
        { id: 1, title: 'A', description: null, weight: 60, order: 0 },
        { id: 2, title: 'B', description: null, weight: 40, order: 1 },
      ],
      levels: [],
    });
    render(<RubricCriteriaEditor templateCheckpointId={1} gradingType="numeric" />);
    await waitFor(() => {
      expect(screen.getByTestId('weight-sum')).toBeDefined();
    });
    expect(screen.getByTestId('weight-sum').textContent).toContain('100');
  });

  it('should disable Save Rubric button when weights do not sum to 100', async () => {
    mockGetRubric.mockResolvedValue({
      gradingType: 'numeric',
      criteria: [
        { id: 1, title: 'A', description: null, weight: 50, order: 0 },
        { id: 2, title: 'B', description: null, weight: 30, order: 1 },
      ],
      levels: [],
    });
    render(<RubricCriteriaEditor templateCheckpointId={1} gradingType="numeric" />);
    await waitFor(() => {
      expect(screen.getByTestId('save-rubric')).toBeDefined();
    });
    expect((screen.getByTestId('save-rubric') as HTMLButtonElement).disabled).toBe(true);
  });

  it('should enable Save Rubric button when weights sum to 100', async () => {
    mockGetRubric.mockResolvedValue({
      gradingType: 'numeric',
      criteria: [
        { id: 1, title: 'A', description: null, weight: 60, order: 0 },
        { id: 2, title: 'B', description: null, weight: 40, order: 1 },
      ],
      levels: [],
    });
    render(<RubricCriteriaEditor templateCheckpointId={1} gradingType="numeric" />);
    await waitFor(() => {
      expect((screen.getByTestId('save-rubric') as HTMLButtonElement).disabled).toBe(false);
    });
  });

  it('should call saveRubric with correct data when Save is clicked', async () => {
    mockGetRubric.mockResolvedValue({
      gradingType: 'numeric',
      criteria: [
        { id: 1, title: 'A', description: 'Desc A', weight: 60, order: 0 },
        { id: 2, title: 'B', description: null, weight: 40, order: 1 },
      ],
      levels: [],
    });
    render(<RubricCriteriaEditor templateCheckpointId={5} gradingType="numeric" />);
    await waitFor(() => {
      expect(screen.getByTestId('save-rubric')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('save-rubric'));
    await waitFor(() => {
      expect(mockSaveRubric).toHaveBeenCalledWith({
        data: {
          templateCheckpointId: 5,
          gradingType: 'numeric',
          criteria: [
            { id: 1, title: 'A', description: 'Desc A', weight: 60, order: 0 },
            { id: 2, title: 'B', description: '', weight: 40, order: 1 },
          ],
          levels: [],
        },
      });
    });
  });

  it('should show error message when save returns error', async () => {
    mockGetRubric.mockResolvedValue({
      gradingType: 'numeric',
      criteria: [{ id: 1, title: 'A', description: null, weight: 100, order: 0 }],
      levels: [],
    });
    mockSaveRubric.mockResolvedValue({ error: { code: 'VALIDATION', message: 'Invalid weights' } });
    render(<RubricCriteriaEditor templateCheckpointId={1} gradingType="numeric" />);
    await waitFor(() => {
      expect(screen.getByTestId('save-rubric')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('save-rubric'));
    await waitFor(() => {
      expect(screen.getByText('error.validation')).toBeDefined();
    });
  });

  it('should render RubricLevelsEditor when gradingType is qualitative', async () => {
    mockGetRubric.mockResolvedValue({
      gradingType: 'qualitative',
      criteria: [{ id: 1, title: 'A', description: null, weight: 100, order: 0 }],
      levels: [{ id: 1, label: 'Excellent', description: null, score: 90, order: 0 }],
    });
    render(<RubricCriteriaEditor templateCheckpointId={1} gradingType="qualitative" />);
    await waitFor(() => {
      expect(screen.getByTestId('rubric-levels-editor')).toBeDefined();
    });
  });

  it('should not render RubricLevelsEditor when gradingType is numeric', async () => {
    mockGetRubric.mockResolvedValue({
      gradingType: 'numeric',
      criteria: [{ id: 1, title: 'A', description: null, weight: 100, order: 0 }],
      levels: [],
    });
    render(<RubricCriteriaEditor templateCheckpointId={1} gradingType="numeric" />);
    await waitFor(() => {
      expect(screen.getByTestId('save-rubric')).toBeDefined();
    });
    expect(screen.queryByTestId('rubric-levels-editor')).toBeNull();
  });

  it('should disable Save Rubric when qualitative and no levels', async () => {
    mockGetRubric.mockResolvedValue({
      gradingType: 'qualitative',
      criteria: [{ id: 1, title: 'A', description: null, weight: 100, order: 0 }],
      levels: [],
    });
    render(<RubricCriteriaEditor templateCheckpointId={1} gradingType="qualitative" />);
    await waitFor(() => {
      expect(screen.getByTestId('save-rubric')).toBeDefined();
    });
    expect((screen.getByTestId('save-rubric') as HTMLButtonElement).disabled).toBe(true);
  });

  it('should enable Save Rubric when qualitative with levels and weights sum to 100', async () => {
    mockGetRubric.mockResolvedValue({
      gradingType: 'qualitative',
      criteria: [{ id: 1, title: 'A', description: null, weight: 100, order: 0 }],
      levels: [{ id: 1, label: 'Excellent', description: null, score: 90, order: 0 }],
    });
    render(<RubricCriteriaEditor templateCheckpointId={1} gradingType="qualitative" />);
    await waitFor(() => {
      expect((screen.getByTestId('save-rubric') as HTMLButtonElement).disabled).toBe(false);
    });
  });

  it('should call saveRubric with levels when qualitative', async () => {
    mockGetRubric.mockResolvedValue({
      gradingType: 'qualitative',
      criteria: [{ id: 1, title: 'A', description: null, weight: 100, order: 0 }],
      levels: [{ id: 1, label: 'Excellent', description: 'Outstanding', score: 90, order: 0 }],
    });
    render(<RubricCriteriaEditor templateCheckpointId={5} gradingType="qualitative" />);
    await waitFor(() => {
      expect(screen.getByTestId('save-rubric')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('save-rubric'));
    await waitFor(() => {
      expect(mockSaveRubric).toHaveBeenCalledWith({
        data: {
          templateCheckpointId: 5,
          gradingType: 'qualitative',
          criteria: [{ id: 1, title: 'A', description: '', weight: 100, order: 0 }],
          levels: [{ id: 1, label: 'Excellent', description: 'Outstanding', score: 90, order: 0 }],
        },
      });
    });
  });

  it('should update levels when RubricLevelsEditor calls onLevelsChange', async () => {
    mockGetRubric.mockResolvedValue({
      gradingType: 'qualitative',
      criteria: [{ id: 1, title: 'A', description: null, weight: 100, order: 0 }],
      levels: [{ id: 1, label: 'Good', description: null, score: 70, order: 0 }],
    });
    render(<RubricCriteriaEditor templateCheckpointId={1} gradingType="qualitative" />);
    await waitFor(() => {
      expect(screen.getByTestId('rubric-levels-editor')).toBeDefined();
    });
    // Save should be enabled (1 level + weights = 100)
    expect((screen.getByTestId('save-rubric') as HTMLButtonElement).disabled).toBe(false);
    // Remove the level via mock (simulate empty levels)
    // Click "Mock Add Level" to add a new level
    fireEvent.click(screen.getByText('Mock Add Level'));
    await waitFor(() => {
      expect(mockSaveRubric).not.toHaveBeenCalled();
    });
    // Now save
    fireEvent.click(screen.getByTestId('save-rubric'));
    await waitFor(() => {
      expect(mockSaveRubric).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            levels: expect.arrayContaining([
              expect.objectContaining({ label: 'Good' }),
              expect.objectContaining({ label: 'New' }),
            ]),
          }),
        }),
      );
    });
  });
});
