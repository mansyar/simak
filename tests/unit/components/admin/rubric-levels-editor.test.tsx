import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const translations: Record<string, string> = {
        'rubrics.levels.add': 'Add Level',
        'rubrics.levels.remove': 'Remove',
        'rubrics.levels.moveUp': 'Move Up',
        'rubrics.levels.moveDown': 'Move Down',
        'rubrics.levels.labelPlaceholder': 'Level label',
        'rubrics.levels.descriptionPlaceholder': 'Description (optional)',
        'rubrics.levels.scoreLabel': 'Score',
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

import { RubricLevelsEditor } from '@/components/admin/templates/RubricLevelsEditor';

describe('RubricLevelsEditor', () => {
  it('should render provided levels', () => {
    render(
      <RubricLevelsEditor
        levels={[
          { id: 1, label: 'Excellent', description: 'Outstanding work', score: 90, order: 0 },
          { id: 2, label: 'Good', description: '', score: 70, order: 1 },
        ]}
        onLevelsChange={vi.fn()}
      />,
    );
    expect((screen.getByTestId('level-label-0') as HTMLInputElement).value).toBe('Excellent');
    expect((screen.getByTestId('level-score-0') as HTMLInputElement).value).toBe('90');
    expect((screen.getByTestId('level-label-1') as HTMLInputElement).value).toBe('Good');
  });

  it('should add a new level when Add Level is clicked', () => {
    const onLevelsChange = vi.fn();
    render(<RubricLevelsEditor levels={[]} onLevelsChange={onLevelsChange} />);
    fireEvent.click(screen.getByText('Add Level'));
    expect(onLevelsChange).toHaveBeenCalledWith([
      { label: '', description: '', score: 0, order: 0 },
    ]);
  });

  it('should remove a level when Remove is clicked', () => {
    const onLevelsChange = vi.fn();
    render(
      <RubricLevelsEditor
        levels={[
          { id: 1, label: 'Excellent', description: '', score: 90, order: 0 },
          { id: 2, label: 'Good', description: '', score: 70, order: 1 },
        ]}
        onLevelsChange={onLevelsChange}
      />,
    );
    fireEvent.click(screen.getAllByLabelText('Remove')[0]);
    expect(onLevelsChange).toHaveBeenCalledWith([
      { id: 2, label: 'Good', description: '', score: 70, order: 0 },
    ]);
  });

  it('should reorder levels when Move Up is clicked', () => {
    const onLevelsChange = vi.fn();
    render(
      <RubricLevelsEditor
        levels={[
          { id: 1, label: 'Excellent', description: '', score: 90, order: 0 },
          { id: 2, label: 'Good', description: '', score: 70, order: 1 },
        ]}
        onLevelsChange={onLevelsChange}
      />,
    );
    fireEvent.click(screen.getAllByLabelText('Move Up')[1]);
    expect(onLevelsChange).toHaveBeenCalledWith([
      { id: 2, label: 'Good', description: '', score: 70, order: 0 },
      { id: 1, label: 'Excellent', description: '', score: 90, order: 1 },
    ]);
  });

  it('should reorder levels when Move Down is clicked', () => {
    const onLevelsChange = vi.fn();
    render(
      <RubricLevelsEditor
        levels={[
          { id: 1, label: 'Excellent', description: '', score: 90, order: 0 },
          { id: 2, label: 'Good', description: '', score: 70, order: 1 },
        ]}
        onLevelsChange={onLevelsChange}
      />,
    );
    fireEvent.click(screen.getAllByLabelText('Move Down')[0]);
    expect(onLevelsChange).toHaveBeenCalledWith([
      { id: 2, label: 'Good', description: '', score: 70, order: 0 },
      { id: 1, label: 'Excellent', description: '', score: 90, order: 1 },
    ]);
  });

  it('should update label when label input changes', () => {
    const onLevelsChange = vi.fn();
    render(
      <RubricLevelsEditor
        levels={[{ id: 1, label: 'Excellent', description: '', score: 90, order: 0 }]}
        onLevelsChange={onLevelsChange}
      />,
    );
    fireEvent.change(screen.getByTestId('level-label-0'), { target: { value: 'Outstanding' } });
    expect(onLevelsChange).toHaveBeenCalledWith([
      { id: 1, label: 'Outstanding', description: '', score: 90, order: 0 },
    ]);
  });

  it('should update score when score input changes', () => {
    const onLevelsChange = vi.fn();
    render(
      <RubricLevelsEditor
        levels={[{ id: 1, label: 'Excellent', description: '', score: 90, order: 0 }]}
        onLevelsChange={onLevelsChange}
      />,
    );
    fireEvent.change(screen.getByTestId('level-score-0'), { target: { value: '85' } });
    expect(onLevelsChange).toHaveBeenCalledWith([
      { id: 1, label: 'Excellent', description: '', score: 85, order: 0 },
    ]);
  });

  it('should clamp score to 0-100 range', () => {
    const onLevelsChange = vi.fn();
    render(
      <RubricLevelsEditor
        levels={[{ id: 1, label: 'Excellent', description: '', score: 90, order: 0 }]}
        onLevelsChange={onLevelsChange}
      />,
    );
    fireEvent.change(screen.getByTestId('level-score-0'), { target: { value: '150' } });
    expect(onLevelsChange).toHaveBeenCalledWith([
      { id: 1, label: 'Excellent', description: '', score: 100, order: 0 },
    ]);
  });

  it('should update description when description input changes', () => {
    const onLevelsChange = vi.fn();
    render(
      <RubricLevelsEditor
        levels={[{ id: 1, label: 'Excellent', description: '', score: 90, order: 0 }]}
        onLevelsChange={onLevelsChange}
      />,
    );
    fireEvent.change(screen.getByTestId('level-description-0'), {
      target: { value: 'Great work' },
    });
    expect(onLevelsChange).toHaveBeenCalledWith([
      { id: 1, label: 'Excellent', description: 'Great work', score: 90, order: 0 },
    ]);
  });
});
