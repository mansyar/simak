import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CreateTemplateDialog } from '@/components/admin/templates/CreateTemplateDialog';
// Direct import to test Zod schema validation
import { CreateTemplateSchema } from '@/server/templates';
import { serverError, ErrorCode } from '@/lib/errors';

// Minimal react-hook-form mock
vi.mock('react-hook-form', () => ({
  useForm: () => ({
    register: vi.fn(),
    handleSubmit: (fn: any) => (e?: any) => {
      if (e?.preventDefault) e.preventDefault();
      return Promise.resolve(fn({ name: '', type: '', checkpoints: ['', '', ''] }));
    },
    watch: () => ['', '', ''],
    getValues: () => ['', '', ''],
    setValue: vi.fn(),
    reset: vi.fn(),
    formState: { errors: {}, isSubmitting: false },
  }),
  Controller: ({ render, name }: any) => render({ field: { value: '', onChange: vi.fn(), name } }),
  FormProvider: ({ children }: any) => <div>{children}</div>,
  useFormContext: () => ({
    watch: () => ['', '', ''],
    getValues: () => ['', '', ''],
    setValue: vi.fn(),
    reset: vi.fn(),
    register: vi.fn(),
    handleSubmit: (fn: any) => (e?: any) => {
      if (e?.preventDefault) e.preventDefault();
      return Promise.resolve(fn({ name: '', type: '', checkpoints: ['', '', ''] }));
    },
    formState: { errors: {}, isSubmitting: false },
  }),
}));

vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => () => ({ values: {}, errors: {} }),
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
        'adminTemplates.createPrompt': 'Create your first template',
        'adminTemplates.form.name': 'Template Name',
        'adminTemplates.form.type': 'Type',
        'adminTemplates.form.checkpoints': 'Checkpoints',
        'common.create': 'Create',
        'common.cancel': 'Cancel',
        'common.error': 'Error',
      };
      return translations[key] || key;
    },
  }),
}));

describe('CreateTemplateDialog', () => {
  const onSubmit = vi.fn();
  const onSuccess = vi.fn();
  const onOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render when open', () => {
    render(
      <CreateTemplateDialog
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />,
    );
    expect(screen.getByText('New Template')).toBeDefined();
    expect(screen.getByText('Create your first template')).toBeDefined();
  });

  it('should not render when closed', () => {
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

  it('should render form fields', () => {
    render(
      <CreateTemplateDialog
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />,
    );
    expect(screen.getByText('Template Name')).toBeDefined();
    expect(screen.getByText('Type')).toBeDefined();
    expect(screen.getByText('Checkpoints')).toBeDefined();
  });

  it('should render Create and Cancel buttons', () => {
    render(
      <CreateTemplateDialog
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />,
    );
    expect(screen.getByText('Create')).toBeDefined();
    expect(screen.getByText('Cancel')).toBeDefined();
  });

  it('should call onOpenChange when Cancel is clicked', () => {
    render(
      <CreateTemplateDialog
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />,
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('should validate Zod schema correctly', () => {
    // Valid input
    expect(
      CreateTemplateSchema.safeParse({
        name: 'Test',
        type: 'Thesis',
        checkpoints: [{ name: 'Ch1' }],
      }).success,
    ).toBe(true);
    // Empty name
    expect(
      CreateTemplateSchema.safeParse({ name: '', type: 'Thesis', checkpoints: [{ name: 'Ch1' }] })
        .success,
    ).toBe(false);
    // Empty type
    expect(
      CreateTemplateSchema.safeParse({ name: 'Test', type: '', checkpoints: [{ name: 'Ch1' }] })
        .success,
    ).toBe(false);
    // No checkpoints
    expect(
      CreateTemplateSchema.safeParse({ name: 'Test', type: 'Thesis', checkpoints: [] }).success,
    ).toBe(false);
    // Empty checkpoint name
    expect(
      CreateTemplateSchema.safeParse({ name: 'Test', type: 'Thesis', checkpoints: [{ name: '' }] })
        .success,
    ).toBe(false);
  });

  it('should call onSubmit when form is submitted', async () => {
    const submitFn = vi.fn().mockResolvedValue({ template: { id: 1 } });
    const onClose = vi.fn();
    const onSucceed = vi.fn();
    const { container } = render(
      <CreateTemplateDialog
        open={true}
        onOpenChange={onClose}
        onSubmit={submitFn}
        onSuccess={onSucceed}
      />,
    );

    const formEl = container.querySelector('form');
    if (formEl) {
      fireEvent.submit(formEl);
    }

    await vi.waitFor(() => {
      expect(submitFn).toHaveBeenCalledOnce();
    });
    expect(onSucceed).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it('should show server error on submit failure', async () => {
    const submitFn = vi
      .fn()
      .mockResolvedValue(serverError(ErrorCode.BAD_REQUEST, 'Server error occurred'));
    const onClose = vi.fn();
    const onSucceed = vi.fn();
    const { container } = render(
      <CreateTemplateDialog
        open={true}
        onOpenChange={onClose}
        onSubmit={submitFn}
        onSuccess={onSucceed}
      />,
    );

    const formEl = container.querySelector('form');
    if (formEl) {
      fireEvent.submit(formEl);
    }

    await vi.waitFor(() => {
      expect(screen.getByText(/Server error/)).toBeDefined();
    });
    expect(onSucceed).not.toHaveBeenCalled();
  });
});
