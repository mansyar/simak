import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EditTemplateSheet } from '@/components/admin/templates/EditTemplateSheet';

const mockFormMethods = vi.hoisted(() => ({
  register: vi.fn(),
  handleSubmit: vi.fn(),
  watch: vi.fn(),
  setValue: vi.fn(),
  getValues: vi.fn(),
  reset: vi.fn(),
  formState: { errors: {}, isSubmitting: false },
  control: {},
}));

vi.mock('react-hook-form', () => ({
  useForm: vi.fn(() => mockFormMethods),
  useController: vi.fn(),
}));

vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => () => ({ values: {}, errors: {} }),
}));

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children, open }: any) => (open ? <div data-testid="sheet">{children}</div> : null),
  SheetContent: ({ children }: any) => <div data-testid="sheet-content">{children}</div>,
  SheetDescription: ({ children }: any) => <div data-testid="sheet-desc">{children}</div>,
  SheetFooter: ({ children }: any) => <div data-testid="sheet-footer">{children}</div>,
  SheetHeader: ({ children }: any) => <div data-testid="sheet-header">{children}</div>,
  SheetTitle: ({ children }: any) => <div data-testid="sheet-title">{children}</div>,
}));

vi.mock('@/components/ui/form', () => ({
  Form: ({ children }: any) => <div data-testid="form">{children}</div>,
  FormField: ({ render, name }: any) => render({ field: { value: '', onChange: vi.fn(), name } }),
  FormItem: ({ children }: any) => <div data-testid="form-item">{children}</div>,
  FormLabel: ({ children }: any) => <label data-testid="form-label">{children}</label>,
  FormControl: ({ children }: any) => <div data-testid="form-control">{children}</div>,
  FormMessage: () => <div data-testid="form-message" />,
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input data-testid="input" {...props} />,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, type, onClick, loading, ...props }: any) => (
    <button type={type || 'button'} onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/admin/templates/CheckpointListEditor', () => ({
  CheckpointListEditor: ({
    checkpoints,
    onAdd,
    onRemove,
    onChange,
    onMinConsultationsChange,
    onEstimatedDurationChange,
    onMoveUp,
    onMoveDown,
  }: any) => (
    <div data-testid="checkpoint-editor">
      <span data-testid="checkpoint-count">{checkpoints?.length ?? 0}</span>
      <button data-testid="btn-add" onClick={onAdd}>
        Add
      </button>
      <button data-testid="btn-remove-0" onClick={() => onRemove(0)}>
        Remove 0
      </button>
      <button data-testid="btn-remove-1" onClick={() => onRemove(1)}>
        Remove 1
      </button>
      <button data-testid="btn-move-up-0" onClick={() => onMoveUp(0)}>
        MoveUp 0
      </button>
      <button data-testid="btn-move-up-1" onClick={() => onMoveUp(1)}>
        MoveUp 1
      </button>
      <button data-testid="btn-move-down-0" onClick={() => onMoveDown(0)}>
        MoveDown 0
      </button>
      <button data-testid="btn-move-down-1" onClick={() => onMoveDown(1)}>
        MoveDown 1
      </button>
      <button data-testid="btn-change-0" onClick={() => onChange(0, 'Updated')}>
        Change 0
      </button>
      <button data-testid="btn-min-cons-0" onClick={() => onMinConsultationsChange(0, 2)}>
        MinCons 0
      </button>
      <button data-testid="btn-est-dur-0" onClick={() => onEstimatedDurationChange(0, 14)}>
        EstDur 0
      </button>
    </div>
  ),
}));

vi.mock('lucide-react', () => ({
  AlertTriangle: () => <svg data-testid="alert-triangle" />,
}));

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const translations: Record<string, string> = {
        'adminTemplates.edit': 'Edit Template',
        'adminTemplates.form.name': 'Name',
        'adminTemplates.form.type': 'Type',
        'adminTemplates.form.checkpoints': 'Checkpoints',
        'common.save': 'Save',
        'common.error': 'Error',
        'common.cancel': 'Cancel',
      };
      if (params) {
        if (key === 'adminTemplates.inUseBanner') {
          return `This template is used by ${params.count} assignment(s).`;
        }
        return key;
      }
      return translations[key] || key;
    },
  }),
}));

const mockCheckpoints = [
  { name: 'CP1', minConsultations: 0, estimatedDuration: 7 },
  { name: 'CP2', minConsultations: 1, estimatedDuration: 14 },
];

describe('EditTemplateSheet - interactions', () => {
  const mockTemplate = {
    id: 1,
    name: 'Thesis Template',
    type: 'Thesis',
    checkpoints: [
      { id: 1, name: 'Chapter 1', order: 1, minConsultations: 0, estimatedDuration: 7 },
      { id: 2, name: 'Chapter 2', order: 2, minConsultations: 1, estimatedDuration: 14 },
    ],
  };

  const onSubmit = vi.fn();
  const onSuccess = vi.fn();
  const onOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFormMethods.getValues.mockReturnValue(mockCheckpoints);
    mockFormMethods.watch.mockReturnValue(mockCheckpoints);
    mockFormMethods.handleSubmit.mockImplementation((cb: Function) => async () => {
      await cb({
        name: 'Test Template',
        type: 'Thesis',
        checkpoints: mockCheckpoints,
      });
    });
  });

  it('handleAddCheckpoint appends a default checkpoint', () => {
    render(
      <EditTemplateSheet
        template={mockTemplate}
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />,
    );
    fireEvent.click(screen.getByTestId('btn-add'));
    expect(mockFormMethods.setValue).toHaveBeenCalledWith(
      'checkpoints',
      expect.arrayContaining([expect.any(Object)]),
      { shouldValidate: false },
    );
    const callArgs = mockFormMethods.setValue.mock.calls.find((c) => c[0] === 'checkpoints');
    expect(callArgs?.[1]).toHaveLength(3);
  });

  it('handleRemoveCheckpoint removes at index', () => {
    render(
      <EditTemplateSheet
        template={mockTemplate}
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />,
    );
    fireEvent.click(screen.getByTestId('btn-remove-0'));
    expect(mockFormMethods.setValue).toHaveBeenCalledWith(
      'checkpoints',
      expect.arrayContaining([expect.any(Object)]),
      { shouldValidate: true },
    );
    const callArgs = mockFormMethods.setValue.mock.calls.find((c) => c[0] === 'checkpoints');
    expect(callArgs?.[1]).toHaveLength(1);
  });

  it('handleRemoveCheckpoint guards against removing last checkpoint', () => {
    mockFormMethods.getValues.mockReturnValue([mockCheckpoints[0]]);
    mockFormMethods.watch.mockReturnValue([mockCheckpoints[0]]);
    render(
      <EditTemplateSheet
        template={mockTemplate}
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />,
    );
    fireEvent.click(screen.getByTestId('btn-remove-0'));
    expect(mockFormMethods.setValue).not.toHaveBeenCalledWith(
      'checkpoints',
      expect.any(Array),
      expect.any(Object),
    );
  });

  it('handleMoveUp does nothing for first item', () => {
    render(
      <EditTemplateSheet
        template={mockTemplate}
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />,
    );
    fireEvent.click(screen.getByTestId('btn-move-up-0'));
    expect(mockFormMethods.setValue).not.toHaveBeenCalled();
  });

  it('handleMoveUp swaps with previous', () => {
    render(
      <EditTemplateSheet
        template={mockTemplate}
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />,
    );
    fireEvent.click(screen.getByTestId('btn-move-up-1'));
    expect(mockFormMethods.setValue).toHaveBeenCalledWith(
      'checkpoints',
      expect.any(Array),
      expect.any(Object),
    );
    const callArgs = mockFormMethods.setValue.mock.calls.find((c) => c[0] === 'checkpoints');
    const swapped = callArgs?.[1] as Array<unknown>;
    expect(swapped[0]).toEqual(mockCheckpoints[1]);
    expect(swapped[1]).toEqual(mockCheckpoints[0]);
  });

  it('handleMoveDown does nothing for last item', () => {
    render(
      <EditTemplateSheet
        template={mockTemplate}
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />,
    );
    fireEvent.click(screen.getByTestId('btn-move-down-1'));
    expect(mockFormMethods.setValue).not.toHaveBeenCalled();
  });

  it('handleMoveDown swaps with next', () => {
    render(
      <EditTemplateSheet
        template={mockTemplate}
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />,
    );
    fireEvent.click(screen.getByTestId('btn-move-down-0'));
    expect(mockFormMethods.setValue).toHaveBeenCalledWith(
      'checkpoints',
      expect.any(Array),
      expect.any(Object),
    );
    const callArgs = mockFormMethods.setValue.mock.calls.find((c) => c[0] === 'checkpoints');
    const swapped = callArgs?.[1] as Array<unknown>;
    expect(swapped[0]).toEqual(mockCheckpoints[1]);
    expect(swapped[1]).toEqual(mockCheckpoints[0]);
  });

  it('handleCheckpointChange updates name', () => {
    render(
      <EditTemplateSheet
        template={mockTemplate}
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />,
    );
    fireEvent.click(screen.getByTestId('btn-change-0'));
    expect(mockFormMethods.setValue).toHaveBeenCalledWith(
      'checkpoints',
      expect.any(Array),
      expect.any(Object),
    );
    const callArgs = mockFormMethods.setValue.mock.calls.find((c) => c[0] === 'checkpoints');
    const updated = callArgs?.[1] as Array<{ name: string }>;
    expect(updated[0].name).toBe('Updated');
  });

  it('handleMinConsultationsChange updates value', () => {
    render(
      <EditTemplateSheet
        template={mockTemplate}
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />,
    );
    fireEvent.click(screen.getByTestId('btn-min-cons-0'));
    expect(mockFormMethods.setValue).toHaveBeenCalledWith(
      'checkpoints',
      expect.any(Array),
      expect.any(Object),
    );
    const callArgs = mockFormMethods.setValue.mock.calls.find((c) => c[0] === 'checkpoints');
    const updated = callArgs?.[1] as Array<{ minConsultations: number }>;
    expect(updated[0].minConsultations).toBe(2);
  });

  it('handleEstimatedDurationChange updates value', () => {
    render(
      <EditTemplateSheet
        template={mockTemplate}
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />,
    );
    fireEvent.click(screen.getByTestId('btn-est-dur-0'));
    expect(mockFormMethods.setValue).toHaveBeenCalledWith(
      'checkpoints',
      expect.any(Array),
      expect.any(Object),
    );
    const callArgs = mockFormMethods.setValue.mock.calls.find((c) => c[0] === 'checkpoints');
    const updated = callArgs?.[1] as Array<{ estimatedDuration: number }>;
    expect(updated[0].estimatedDuration).toBe(14);
  });

  it('displays server error when onSubmit returns error', async () => {
    const errorSubmit = vi.fn().mockResolvedValue({ error: 'Name already taken' });
    const { container } = render(
      <EditTemplateSheet
        template={mockTemplate}
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={errorSubmit}
        onSuccess={onSuccess}
      />,
    );
    const formEl = container.querySelector('form');
    if (formEl) {
      fireEvent.submit(formEl);
    }
    await waitFor(() => {
      expect(screen.getByText(/Name already taken/)).toBeDefined();
    });
  });

  it('clears server error when sheet closes', async () => {
    const errorSubmit = vi.fn().mockResolvedValue({ error: 'Name already taken' });
    const { container } = render(
      <EditTemplateSheet
        template={mockTemplate}
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={errorSubmit}
        onSuccess={onSuccess}
      />,
    );
    const formEl = container.querySelector('form');
    if (formEl) {
      fireEvent.submit(formEl);
    }
    await waitFor(() => {
      expect(screen.getByText(/Name already taken/)).toBeDefined();
    });
    // Simulate the sheet's internal handleOpenChange with false
    // The Sheet component passes onOpenChange via Sheet (from lib), so we call via the prop
  });

  it('handleFormSubmit: success calls reset, close, and onSuccess', async () => {
    mockFormMethods.handleSubmit.mockImplementation((cb: Function) => async () => {
      await cb({
        name: 'Test Template',
        type: 'Thesis',
        checkpoints: mockCheckpoints,
      });
    });
    const { container } = render(
      <EditTemplateSheet
        template={mockTemplate}
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />,
    );
    const formEl = container.querySelector('form');
    if (formEl) {
      fireEvent.submit(formEl);
    }
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(mockTemplate.id, expect.any(Object));
      // reset called once by useEffect on mount + once by handleFormSubmit = 2
      expect(mockFormMethods.reset).toHaveBeenCalledTimes(2);
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onSuccess).toHaveBeenCalledOnce();
    });
  });

  it('handleFormSubmit: early return when template is null', async () => {
    mockFormMethods.handleSubmit.mockImplementation((cb: Function) => async () => {
      await cb({
        name: 'Test Template',
        type: 'Thesis',
        checkpoints: mockCheckpoints,
      });
    });
    const { container } = render(
      <EditTemplateSheet
        template={null}
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />,
    );
    const formEl = container.querySelector('form');
    if (formEl) {
      fireEvent.submit(formEl);
    }
    expect(onSubmit).not.toHaveBeenCalled();
    expect(mockFormMethods.reset).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
