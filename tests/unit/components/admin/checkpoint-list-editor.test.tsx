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
      };
      return translations[key] || key;
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
});
