import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CheckpointListEditor } from '@/components/admin/templates/CheckpointListEditor';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'adminTemplates.form.moveUp': 'Move Up',
        'adminTemplates.form.moveDown': 'Move Down',
        'adminTemplates.form.checkpointName': 'Checkpoint Name',
        'adminTemplates.form.minConsultations': 'Min. Consultations',
        'adminTemplates.form.estimatedDuration': 'Est. Duration (days)',
        'adminTemplates.form.removeCheckpoint': 'Remove',
        'adminTemplates.form.addCheckpoint': 'Add Checkpoint',
        'adminTemplates.form.minConsHint': 'Verified consultations required before submission',
        'adminTemplates.form.durationHint': 'Days allotted for this checkpoint',
        'adminTemplates.form.gradingType': 'Grading Type',
        'adminTemplates.form.gradingTypeNone': 'No Rubric',
        'adminTemplates.form.gradingTypeNumeric': 'Numeric',
        'adminTemplates.form.gradingTypeQualitative': 'Qualitative',
      };
      return translations[key] || key;
    },
  }),
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, size, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-slot="button"
      data-variant={variant}
      data-size={size}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: any) => (
    <select
      value={value ?? 'none'}
      onChange={(e) => onValueChange?.(e.target.value)}
      data-testid="grading-type-select"
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: any) => <>{children}</>,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
  SelectValue: () => null,
}));

vi.mock('@/components/admin/templates/RubricCriteriaEditor', () => ({
  RubricCriteriaEditor: ({ templateCheckpointId, gradingType }: any) => (
    <div data-testid={`rubric-editor-${templateCheckpointId}`} data-grading-type={gradingType} />
  ),
}));

describe('CheckpointListEditor', () => {
  const defaultProps = {
    checkpoints: [
      { name: 'Chapter 1', minConsultations: 0, estimatedDuration: 7 },
      { name: 'Chapter 2', minConsultations: 0, estimatedDuration: 14 },
      { name: 'Chapter 3', minConsultations: 0, estimatedDuration: 21 },
    ],
    onAdd: vi.fn(),
    onRemove: vi.fn(),
    onChange: vi.fn(),
    onMinConsultationsChange: vi.fn(),
    onEstimatedDurationChange: vi.fn(),
    onMoveUp: vi.fn(),
    onMoveDown: vi.fn(),
  };

  it('should render all checkpoints', () => {
    render(<CheckpointListEditor {...defaultProps} />);
    expect(screen.getByDisplayValue('Chapter 1')).toBeDefined();
    expect(screen.getByDisplayValue('Chapter 2')).toBeDefined();
    expect(screen.getByDisplayValue('Chapter 3')).toBeDefined();
  });

  it('should call onChange when input value changes', () => {
    render(<CheckpointListEditor {...defaultProps} />);
    fireEvent.change(screen.getByDisplayValue('Chapter 1'), { target: { value: 'Introduction' } });
    expect(defaultProps.onChange).toHaveBeenCalledWith(0, 'Introduction');
  });

  it('should call onAdd when Add Checkpoint is clicked', () => {
    render(<CheckpointListEditor {...defaultProps} />);
    fireEvent.click(screen.getByText('Add Checkpoint'));
    expect(defaultProps.onAdd).toHaveBeenCalledOnce();
  });

  it('should call onRemove when Remove button is clicked', () => {
    render(<CheckpointListEditor {...defaultProps} />);
    const removeBtns = screen.getAllByLabelText('Remove');
    fireEvent.click(removeBtns[0]);
    expect(defaultProps.onRemove).toHaveBeenCalledWith(0);
  });

  it('should call onMoveUp when Move Up is clicked', () => {
    render(<CheckpointListEditor {...defaultProps} />);
    fireEvent.click(screen.getAllByLabelText('Move Up')[1]);
    expect(defaultProps.onMoveUp).toHaveBeenCalledWith(1);
  });

  it('should call onMoveDown when Move Down is clicked', () => {
    render(<CheckpointListEditor {...defaultProps} />);
    fireEvent.click(screen.getAllByLabelText('Move Down')[0]);
    expect(defaultProps.onMoveDown).toHaveBeenCalledWith(0);
  });

  it('should disable Move Up on first checkpoint', () => {
    render(<CheckpointListEditor {...defaultProps} />);
    expect((screen.getAllByLabelText('Move Up')[0] as HTMLButtonElement).disabled).toBe(true);
  });

  it('should disable Move Down on last checkpoint', () => {
    render(<CheckpointListEditor {...defaultProps} />);
    const downBtns = screen.getAllByLabelText('Move Down');
    expect((downBtns[downBtns.length - 1] as HTMLButtonElement).disabled).toBe(true);
  });

  it('should show error text when errors prop is provided', () => {
    render(<CheckpointListEditor {...defaultProps} errors={[undefined, 'Required', undefined]} />);
    expect(screen.getByText('Required')).toBeDefined();
  });

  it('should disable Remove when only one checkpoint', () => {
    render(
      <CheckpointListEditor
        {...defaultProps}
        checkpoints={[{ name: 'Only', minConsultations: 0, estimatedDuration: 7 }]}
      />,
    );
    expect((screen.getByLabelText('Remove') as HTMLButtonElement).disabled).toBe(true);
  });

  it('should call onEstimatedDurationChange when duration input changes', () => {
    render(<CheckpointListEditor {...defaultProps} />);
    const durationInputs = screen.getAllByLabelText('Est. Duration (days)');
    fireEvent.change(durationInputs[0], { target: { value: '14' } });
    expect(defaultProps.onEstimatedDurationChange).toHaveBeenCalledWith(0, 14);
  });

  it('should render Add Checkpoint button', () => {
    render(<CheckpointListEditor {...defaultProps} />);
    expect(screen.getByText('Add Checkpoint')).toBeDefined();
  });

  it('should use Button component for move buttons', () => {
    const { container } = render(<CheckpointListEditor {...defaultProps} />);
    const moveButtons = container.querySelectorAll('[data-slot="button"][aria-label]');
    const moveUpBtns = Array.from(moveButtons).filter((btn) =>
      btn.getAttribute('aria-label')?.includes('Move Up'),
    );
    const moveDownBtns = Array.from(moveButtons).filter((btn) =>
      btn.getAttribute('aria-label')?.includes('Move Down'),
    );
    expect(moveUpBtns.length).toBeGreaterThan(0);
    expect(moveDownBtns.length).toBeGreaterThan(0);
  });

  it('should hide column headers on mobile (hidden sm:flex)', () => {
    const { container } = render(<CheckpointListEditor {...defaultProps} />);
    const columnHeaderRow = container.querySelector('[role="row"]');
    expect(columnHeaderRow?.className).toMatch(/\bhidden\b/);
    expect(columnHeaderRow?.className).toMatch(/\bsm:flex\b/);
  });

  it('should stack checkpoint rows vertically on mobile (flex-col sm:flex-row)', () => {
    render(<CheckpointListEditor {...defaultProps} />);
    const checkpointInput = screen.getByTestId('checkpoint-input-0');
    const rowDiv = checkpointInput.parentElement?.parentElement;
    expect(rowDiv?.className).toMatch(/\bflex-col\b/);
    expect(rowDiv?.className).toMatch(/\bsm:flex-row\b/);
  });

  it('should render grading type selector when checkpoint has an id', () => {
    render(
      <CheckpointListEditor
        {...defaultProps}
        checkpoints={[{ id: 1, name: 'Chapter 1', minConsultations: 0, estimatedDuration: 7 }]}
      />,
    );
    expect(screen.getByTestId('grading-type-select')).toBeDefined();
  });

  it('should not render grading type selector when checkpoint has no id', () => {
    render(<CheckpointListEditor {...defaultProps} />);
    expect(screen.queryByTestId('grading-type-select')).toBeNull();
  });

  it('should call onGradingTypeChange when grading type changes to numeric', () => {
    const onGradingTypeChange = vi.fn();
    render(
      <CheckpointListEditor
        {...defaultProps}
        checkpoints={[{ id: 1, name: 'Chapter 1', minConsultations: 0, estimatedDuration: 7 }]}
        onGradingTypeChange={onGradingTypeChange}
      />,
    );
    fireEvent.change(screen.getByTestId('grading-type-select'), { target: { value: 'numeric' } });
    expect(onGradingTypeChange).toHaveBeenCalledWith(0, 'numeric');
  });

  it('should call onGradingTypeChange with null when none is selected', () => {
    const onGradingTypeChange = vi.fn();
    render(
      <CheckpointListEditor
        {...defaultProps}
        checkpoints={[
          {
            id: 1,
            name: 'Chapter 1',
            minConsultations: 0,
            estimatedDuration: 7,
            gradingType: 'numeric',
          },
        ]}
        onGradingTypeChange={onGradingTypeChange}
      />,
    );
    fireEvent.change(screen.getByTestId('grading-type-select'), { target: { value: 'none' } });
    expect(onGradingTypeChange).toHaveBeenCalledWith(0, null);
  });

  it('should render all three grading type options', () => {
    render(
      <CheckpointListEditor
        {...defaultProps}
        checkpoints={[{ id: 1, name: 'Chapter 1', minConsultations: 0, estimatedDuration: 7 }]}
      />,
    );
    const select = screen.getByTestId('grading-type-select') as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toEqual(['none', 'numeric', 'qualitative']);
  });

  it('should render RubricCriteriaEditor when gradingType is set', () => {
    render(
      <CheckpointListEditor
        {...defaultProps}
        checkpoints={[
          {
            id: 5,
            name: 'Chapter 1',
            minConsultations: 0,
            estimatedDuration: 7,
            gradingType: 'numeric',
          },
        ]}
      />,
    );
    expect(screen.getByTestId('rubric-editor-5')).toBeDefined();
    expect(screen.getByTestId('rubric-editor-5').getAttribute('data-grading-type')).toBe('numeric');
  });

  it('should not render RubricCriteriaEditor when gradingType is null', () => {
    render(
      <CheckpointListEditor
        {...defaultProps}
        checkpoints={[
          {
            id: 5,
            name: 'Chapter 1',
            minConsultations: 0,
            estimatedDuration: 7,
            gradingType: null,
          },
        ]}
      />,
    );
    expect(screen.queryByTestId('rubric-editor-5')).toBeNull();
  });
});
