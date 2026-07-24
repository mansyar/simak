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
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const translations: Record<string, string> = {
        'rubrics.criteria.loading': 'Loading...',
        'rubrics.criteria.saveError': 'Failed to save rubric',
        'rubrics.criteria.saveSuccess': 'Rubric saved',
        'rubrics.criteria.titlePlaceholder': 'Criterion title',
        'rubrics.criteria.add': 'Add Criterion',
        'rubrics.criteria.remove': 'Remove',
        'rubrics.criteria.moveUp': 'Move Up',
        'rubrics.criteria.moveDown': 'Move Down',
        'rubrics.criteria.weightSum': 'Weight sum: {sum}/100',
        'rubrics.criteria.save': 'Save Rubric',
        'rubrics.criteria.saving': 'Saving...',
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
  RubricLevelsEditor: ({ levels }: any) => (
    <div data-testid="rubric-levels-editor" data-levels-count={levels.length} />
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

describe('RubricCriteriaEditor — pending reviews edit warning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRubric.mockResolvedValue({
      gradingType: 'numeric',
      criteria: [{ id: 1, title: 'A', description: null, weight: 100, order: 0 }],
      levels: [],
    });
    mockSaveRubric.mockResolvedValue({ success: true });
    mockCountPendingReviews.mockResolvedValue({ count: 0 });
  });

  it('should show confirmation dialog with count when pending reviews > 0', async () => {
    mockCountPendingReviews.mockResolvedValue({ count: 3 });

    render(<RubricCriteriaEditor templateCheckpointId={5} gradingType="numeric" />);
    await waitFor(() => {
      expect(screen.getByTestId('save-rubric')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('save-rubric'));

    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeDefined();
    });
    expect(screen.getByText('Pending Reviews Affected')).toBeDefined();
    expect(screen.getByText(/3 pending review/)).toBeDefined();
    expect(mockSaveRubric).not.toHaveBeenCalled();
  });

  it('should save directly without dialog when pending reviews count is 0', async () => {
    render(<RubricCriteriaEditor templateCheckpointId={5} gradingType="numeric" />);
    await waitFor(() => {
      expect(screen.getByTestId('save-rubric')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('save-rubric'));

    await waitFor(() => {
      expect(mockSaveRubric).toHaveBeenCalled();
    });
    expect(screen.queryByTestId('confirm-dialog')).toBeNull();
  });

  it('should not call saveRubric when Cancel is clicked in confirmation dialog', async () => {
    mockCountPendingReviews.mockResolvedValue({ count: 2 });

    render(<RubricCriteriaEditor templateCheckpointId={5} gradingType="numeric" />);
    await waitFor(() => {
      expect(screen.getByTestId('save-rubric')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('save-rubric'));

    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeDefined();
    });
    fireEvent.click(screen.getByText('Cancel'));

    await waitFor(() => {
      expect(screen.queryByTestId('confirm-dialog')).toBeNull();
    });
    expect(mockSaveRubric).not.toHaveBeenCalled();
  });

  it('should call saveRubric when Confirm is clicked in confirmation dialog', async () => {
    mockCountPendingReviews.mockResolvedValue({ count: 2 });

    render(<RubricCriteriaEditor templateCheckpointId={5} gradingType="numeric" />);
    await waitFor(() => {
      expect(screen.getByTestId('save-rubric')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('save-rubric'));

    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeDefined();
    });
    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => {
      expect(mockSaveRubric).toHaveBeenCalledWith({
        data: {
          templateCheckpointId: 5,
          gradingType: 'numeric',
          criteria: [{ id: 1, title: 'A', description: '', weight: 100, order: 0 }],
          levels: [],
        },
      });
    });
  });
});
