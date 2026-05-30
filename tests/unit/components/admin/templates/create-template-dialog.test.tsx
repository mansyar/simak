import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CreateTemplateDialog } from '@/components/admin/templates/CreateTemplateDialog';

const mockFormMethods = vi.hoisted(() => ({
  register: vi.fn(),
  handleSubmit: vi.fn((cb: Function) => async () => {}),
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
      <button data-testid="btn-move-down-2" onClick={() => onMoveDown(2)}>
        MoveDown 2
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

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
  DialogDescription: ({ children }: any) => <div data-testid="dialog-desc">{children}</div>,
  DialogFooter: ({ children }: any) => <div data-testid="dialog-footer">{children}</div>,
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <div data-testid="dialog-title">{children}</div>,
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
  Button: ({ children, type, onClick, ...props }: any) => (
    <button type={type || 'button'} onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'adminTemplates.newTemplate': 'New Template',
        'adminTemplates.createPrompt': 'Fill out the form to create a new template',
        'adminTemplates.form.name': 'Name',
        'adminTemplates.form.namePlaceholder': 'e.g. Thesis Template',
        'adminTemplates.form.type': 'Type',
        'adminTemplates.form.typePlaceholder': 'e.g. Thesis',
        'adminTemplates.form.checkpoints': 'Checkpoints',
        'common.create': 'Create',
        'common.cancel': 'Cancel',
        'common.error': 'Error',
      };
      return translations[key] || key;
    },
  }),
}));

const defaultCheckpoints = [
  { name: 'CP1', minConsultations: 0, estimatedDuration: 7 },
  { name: 'CP2', minConsultations: 1, estimatedDuration: 14 },
  { name: 'CP3', minConsultations: 2, estimatedDuration: 21 },
];

describe('CreateTemplateDialog', () => {
  const onSubmit = vi.fn();
  const onSuccess = vi.fn();
  const onOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFormMethods.getValues.mockReturnValue(defaultCheckpoints);
    mockFormMethods.watch.mockReturnValue(defaultCheckpoints);
    mockFormMethods.handleSubmit.mockImplementation((cb: Function) => async () => {
      await cb({
        name: 'New Template',
        type: 'Thesis',
        checkpoints: defaultCheckpoints,
      });
    });
  });

  it('renders dialog with title when open=true', () => {
    render(
      <CreateTemplateDialog
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />,
    );
    expect(screen.getByText('New Template')).toBeDefined();
    expect(screen.getByText('Fill out the form to create a new template')).toBeDefined();
  });

  it('does not render content when open=false', () => {
    render(
      <CreateTemplateDialog
        open={false}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />,
    );
    expect(screen.queryByText('New Template')).toBeNull();
  });

  it('renders form fields: name and type inputs', () => {
    render(
      <CreateTemplateDialog
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />,
    );
    expect(screen.getByText('Name')).toBeDefined();
    expect(screen.getByText('Type')).toBeDefined();
    expect(screen.getByText('Checkpoints')).toBeDefined();
  });

  it('renders CheckpointListEditor with 3 default checkpoints', () => {
    render(
      <CreateTemplateDialog
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />,
    );
    expect(screen.getByTestId('checkpoint-editor')).toBeDefined();
    expect(screen.getByTestId('checkpoint-count').textContent).toBe('3');
  });

  it('handleAddCheckpoint adds a new checkpoint', () => {
    render(
      <CreateTemplateDialog
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
      expect.any(Object),
    );
    const callArgs = mockFormMethods.setValue.mock.calls.find((c) => c[0] === 'checkpoints');
    expect(callArgs?.[1]).toHaveLength(4);
  });

  it('handleRemoveCheckpoint removes at index', () => {
    render(
      <CreateTemplateDialog
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
      expect.objectContaining({ shouldValidate: true }),
    );
    const callArgs = mockFormMethods.setValue.mock.calls.find((c) => c[0] === 'checkpoints');
    expect(callArgs?.[1]).toHaveLength(2);
  });

  it('handleRemoveCheckpoint does NOT remove last checkpoint', () => {
    mockFormMethods.getValues.mockReturnValue([defaultCheckpoints[0]]);
    render(
      <CreateTemplateDialog
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
      <CreateTemplateDialog
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
      <CreateTemplateDialog
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
    expect(swapped[0]).toEqual(defaultCheckpoints[1]);
    expect(swapped[1]).toEqual(defaultCheckpoints[0]);
  });

  it('handleMoveDown does nothing for last item', () => {
    render(
      <CreateTemplateDialog
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />,
    );
    fireEvent.click(screen.getByTestId('btn-move-down-2'));
    expect(mockFormMethods.setValue).not.toHaveBeenCalled();
  });

  it('handleCheckpointChange updates name', () => {
    render(
      <CreateTemplateDialog
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
      <CreateTemplateDialog
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
      <CreateTemplateDialog
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

  it('server error displayed when onSubmit returns error', async () => {
    const errorSubmit = vi.fn().mockResolvedValue({ error: 'Name already taken' });
    const { container } = render(
      <CreateTemplateDialog
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
    await vi.waitFor(() => {
      expect(screen.getByText(/Name already taken/)).toBeDefined();
    });
  });

  it('handleOpenChange clears server error on close', async () => {
    const errorSubmit = vi.fn().mockResolvedValue({ error: 'Name already taken' });
    const { container } = render(
      <CreateTemplateDialog
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
    await vi.waitFor(() => {
      expect(screen.getByText(/Name already taken/)).toBeDefined();
    });
    fireEvent.click(screen.getByText('Cancel'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText(/Name already taken/)).toBeNull();
  });

  it('handleFormSubmit calls onSuccess on successful create', async () => {
    const successSubmit = vi.fn().mockResolvedValue({ template: { id: 1 } });
    const { container } = render(
      <CreateTemplateDialog
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={successSubmit}
        onSuccess={onSuccess}
      />,
    );
    const formEl = container.querySelector('form');
    if (formEl) {
      fireEvent.submit(formEl);
    }
    await vi.waitFor(() => {
      expect(successSubmit).toHaveBeenCalledOnce();
    });
    expect(mockFormMethods.reset).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSuccess).toHaveBeenCalledOnce();
  });
});
