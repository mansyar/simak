import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { toast } from 'sonner';
import { SaveGradeConfigSchema } from '@/server/gradebook';

// Hoisted mock form methods for controllable behavior across tests
const mockFormMethods = vi.hoisted(() => ({
  register: vi.fn(),
  handleSubmit: vi.fn((cb: Function) => async (e?: any) => {
    if (e?.preventDefault) e.preventDefault();
  }),
  watch: vi.fn(),
  setValue: vi.fn(),
  getValues: vi.fn(),
  reset: vi.fn(),
  formState: { errors: {}, isSubmitting: false },
  control: {},
}));

vi.mock('react-hook-form', () => ({
  useForm: vi.fn(() => mockFormMethods),
  Controller: ({ render, name }: any) => render({ field: { value: '', onChange: vi.fn(), name } }),
  FormProvider: ({ children }: any) => <div>{children}</div>,
  useFormContext: () => mockFormMethods,
}));

vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => () => ({ values: {}, errors: {} }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div data-testid="dialog-footer">{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div data-testid="dialog-title">{children}</div>,
}));

vi.mock('@/components/ui/form', () => ({
  Form: ({ children }: any) => <div data-testid="form">{children}</div>,
  FormControl: ({ children }: any) => <div>{children}</div>,
  FormField: ({ render, name }: any) => render({ field: { value: '', onChange: vi.fn(), name } }),
  FormItem: ({ children }: any) => <div>{children}</div>,
  FormLabel: ({ children }: any) => <label>{children}</label>,
  FormMessage: () => null,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <select
      data-testid="scheme-select"
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input data-testid={`input-${props.name || 'default'}`} {...props} />,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, type, loading, ...props }: any) => (
    <button type={type} data-testid="submit-btn" disabled={loading} {...props}>
      {loading ? 'Loading...' : children}
    </button>
  ),
}));

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

// Import after mocks — this will fail because the component doesn't exist yet
import { GradeSettingsDialog } from '@/components/gradebook/GradeSettingsDialog';

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  assignmentId: 1,
  config: null as any,
  checkpoints: [
    { id: 'cp1', name: 'Checkpoint 1' },
    { id: 'cp2', name: 'Checkpoint 2' },
  ],
  onSubmit: vi.fn().mockResolvedValue(undefined),
};

describe('GradeSettingsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFormMethods.watch.mockReturnValue('equal_weight');
    mockFormMethods.handleSubmit.mockImplementation((cb: Function) => async (e?: any) => {
      if (e?.preventDefault) e.preventDefault();
      await cb({
        assignmentId: 1,
        gradingScheme: 'equal_weight',
        customWeights: null,
        letterGradeBounds: { A: 90, B: 80, C: 70, D: 60 },
      });
    });
  });

  it('renders dialog when open', () => {
    render(<GradeSettingsDialog {...defaultProps} />);
    expect(screen.getByTestId('dialog')).toBeDefined();
    expect(screen.getByTestId('dialog-title')).toBeDefined();
  });

  it('does not render when closed', () => {
    render(<GradeSettingsDialog {...defaultProps} open={false} />);
    expect(screen.queryByTestId('dialog')).toBeNull();
  });

  it('renders scheme Select with equal_weight and custom_weight options', () => {
    render(<GradeSettingsDialog {...defaultProps} />);
    const select = screen.getByTestId('scheme-select');
    expect(select).toBeDefined();
    const options = select.querySelectorAll('option');
    expect(options).toHaveLength(2);
    expect(options[0].getAttribute('value')).toBe('equal_weight');
    expect(options[1].getAttribute('value')).toBe('custom_weight');
  });

  it('renders letter bound inputs for A, B, C, D', () => {
    render(<GradeSettingsDialog {...defaultProps} />);
    expect(screen.getByTestId('input-letterGradeBounds.A')).toBeDefined();
    expect(screen.getByTestId('input-letterGradeBounds.B')).toBeDefined();
    expect(screen.getByTestId('input-letterGradeBounds.C')).toBeDefined();
    expect(screen.getByTestId('input-letterGradeBounds.D')).toBeDefined();
  });

  it('does not show custom weight inputs when scheme is equal_weight', () => {
    mockFormMethods.watch.mockReturnValue('equal_weight');
    render(<GradeSettingsDialog {...defaultProps} />);
    expect(screen.queryByTestId('custom-weights-section')).toBeNull();
  });

  it('shows custom weight inputs when scheme is custom_weight', () => {
    mockFormMethods.watch.mockReturnValue('custom_weight');
    render(<GradeSettingsDialog {...defaultProps} />);
    expect(screen.getByTestId('custom-weights-section')).toBeDefined();
    expect(screen.getByTestId('input-customWeights.cp1')).toBeDefined();
    expect(screen.getByTestId('input-customWeights.cp2')).toBeDefined();
  });

  it('calls onSubmit when form is submitted', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<GradeSettingsDialog {...defaultProps} onSubmit={onSubmit} />);
    const formEl = container.querySelector('form');
    if (formEl) fireEvent.submit(formEl);
    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledOnce();
    });
  });

  it('shows success toast on successful save', async () => {
    const { container } = render(<GradeSettingsDialog {...defaultProps} />);
    const formEl = container.querySelector('form');
    if (formEl) fireEvent.submit(formEl);
    await vi.waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('gradebook.settings.saveSuccess');
    });
  });

  it('does not show toast when onSubmit rejects', async () => {
    const failingSubmit = vi.fn().mockRejectedValue(new Error('fail'));
    const { container } = render(
      <GradeSettingsDialog {...defaultProps} onSubmit={failingSubmit} />,
    );
    const formEl = container.querySelector('form');
    if (formEl) fireEvent.submit(formEl);
    await vi.waitFor(() => {
      expect(failingSubmit).toHaveBeenCalledOnce();
    });
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('closes dialog after successful save', async () => {
    const onOpenChange = vi.fn();
    const { container } = render(
      <GradeSettingsDialog {...defaultProps} onOpenChange={onOpenChange} />,
    );
    const formEl = container.querySelector('form');
    if (formEl) fireEvent.submit(formEl);
    await vi.waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});

describe('SaveGradeConfigSchema validation', () => {
  it('accepts equal_weight with null weights', () => {
    const result = SaveGradeConfigSchema.safeParse({
      assignmentId: 1,
      gradingScheme: 'equal_weight',
      customWeights: null,
      letterGradeBounds: { A: 90, B: 80, C: 70, D: 60 },
    });
    expect(result.success).toBe(true);
  });

  it('accepts custom_weight with weights summing to 100', () => {
    const result = SaveGradeConfigSchema.safeParse({
      assignmentId: 1,
      gradingScheme: 'custom_weight',
      customWeights: { cp1: 50, cp2: 50 },
      letterGradeBounds: { A: 90, B: 80, C: 70, D: 60 },
    });
    expect(result.success).toBe(true);
  });

  it('rejects custom_weight with null weights', () => {
    const result = SaveGradeConfigSchema.safeParse({
      assignmentId: 1,
      gradingScheme: 'custom_weight',
      customWeights: null,
      letterGradeBounds: { A: 90, B: 80, C: 70, D: 60 },
    });
    expect(result.success).toBe(false);
  });

  it('rejects custom_weight with weights summing to 99', () => {
    const result = SaveGradeConfigSchema.safeParse({
      assignmentId: 1,
      gradingScheme: 'custom_weight',
      customWeights: { cp1: 50, cp2: 49 },
      letterGradeBounds: { A: 90, B: 80, C: 70, D: 60 },
    });
    expect(result.success).toBe(false);
  });
});
