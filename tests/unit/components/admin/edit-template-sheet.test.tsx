import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EditTemplateSheet } from '@/components/admin/templates/EditTemplateSheet';
import { UpdateTemplateSchema } from '@/server/templates';

// Minimal react-hook-form mock
vi.mock('react-hook-form', () => ({
  useForm: () => ({
    register: vi.fn(),
    handleSubmit: (fn: any) => (e?: any) => {
      if (e?.preventDefault) e.preventDefault();
      return Promise.resolve(fn({ name: '', type: '', checkpoints: ['', ''] }));
    },
    watch: () => ['', ''],
    getValues: () => ['', ''],
    setValue: vi.fn(),
    reset: vi.fn(),
    formState: { errors: {}, isSubmitting: false },
  }),
  Controller: ({ render, name }: any) => render({ field: { value: '', onChange: vi.fn(), name } }),
  FormProvider: ({ children }: any) => <div>{children}</div>,
  useFormContext: () => ({
    watch: () => ['', ''],
    getValues: () => ['', ''],
    setValue: vi.fn(),
    reset: vi.fn(),
    register: vi.fn(),
    handleSubmit: (fn: any) => (e?: any) => {
      if (e?.preventDefault) e.preventDefault();
      return Promise.resolve(fn({ name: '', type: '', checkpoints: ['', ''] }));
    },
    formState: { errors: {}, isSubmitting: false },
  }),
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
  Button: ({ children, type, onClick, ...props }: any) => (
    <button type={type || 'button'} onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'adminTemplates.edit': 'Edit Template',
        'adminTemplates.form.name': 'Template Name',
        'adminTemplates.form.type': 'Type',
        'adminTemplates.form.checkpoints': 'Checkpoints',
        'adminTemplates.inUseBanner': params
          ? `This template is used by ${String(params.count)} assignment(s).`
          : key,
        'common.save': 'Save',
        'common.error': 'Error',
      };
      return translations[key] || key;
    },
  }),
}));

describe('EditTemplateSheet', () => {
  const mockTemplate = {
    id: 1,
    name: 'Thesis Template',
    type: 'Thesis',
    checkpoints: [
      { id: 1, name: 'Chapter 1', order: 1 },
      { id: 2, name: 'Chapter 2', order: 2 },
    ],
  };

  const onSubmit = vi.fn();
  const onSuccess = vi.fn();
  const onOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render when open with template data', () => {
    render(
      <EditTemplateSheet
        template={mockTemplate}
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />,
    );
    expect(screen.getByText('Edit Template')).toBeDefined();
    expect(screen.getByText('Edit template name, type, and checkpoints.')).toBeDefined();
  });

  it('should not render when closed', () => {
    render(
      <EditTemplateSheet
        template={mockTemplate}
        open={false}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />,
    );
    expect(screen.queryByText('Edit Template')).toBeNull();
  });

  it('should render form fields', () => {
    render(
      <EditTemplateSheet
        template={mockTemplate}
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

  it('should render Save button', () => {
    render(
      <EditTemplateSheet
        template={mockTemplate}
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />,
    );
    expect(screen.getByText('Save')).toBeDefined();
  });

  it('should render in-use banner when template has assignments', () => {
    render(
      <EditTemplateSheet
        template={{ ...mockTemplate, assignmentCount: 3 }}
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />,
    );
    expect(screen.getByText(/used by 3/)).toBeDefined();
  });

  it('should not render in-use banner when template has no assignments', () => {
    render(
      <EditTemplateSheet
        template={{ ...mockTemplate, assignmentCount: 0 }}
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />,
    );
    expect(screen.queryByText(/used by/)).toBeNull();
  });

  it('should not render in-use banner when assignmentCount is undefined', () => {
    render(
      <EditTemplateSheet
        template={mockTemplate}
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />,
    );
    expect(screen.queryByText(/used by/)).toBeNull();
  });

  it('should validate UpdateTemplateSchema correctly', () => {
    // Valid
    expect(
      UpdateTemplateSchema.safeParse({ name: 'Test', type: 'Thesis', checkpoints: [{ name: 'Ch1' }] })
        .success,
    ).toBe(true);
    // Empty name
    expect(
      UpdateTemplateSchema.safeParse({ name: '', type: 'Thesis', checkpoints: [{ name: 'Ch1' }] }).success,
    ).toBe(false);
    // No checkpoints
    expect(
      UpdateTemplateSchema.safeParse({ name: 'Test', type: 'Thesis', checkpoints: [] }).success,
    ).toBe(false);
  });

  it('should handle null template gracefully', () => {
    render(
      <EditTemplateSheet
        template={null}
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />,
    );
    expect(screen.getByText('Edit Template')).toBeDefined();
  });

  it('should call onSubmit when form is submitted', async () => {
    const submitFn = vi.fn().mockResolvedValue({ success: true });
    const onClose = vi.fn();
    const onSucceed = vi.fn();
    const { container } = render(
      <EditTemplateSheet
        template={{
          id: 1,
          name: 'Test',
          type: 'Thesis',
          checkpoints: [{ id: 1, name: 'Ch1', order: 1 }],
        }}
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

  it('should toggle open state correctly', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <EditTemplateSheet
        template={{
          id: 1,
          name: 'Test',
          type: 'Thesis',
          checkpoints: [{ id: 1, name: 'Ch1', order: 1 }],
        }}
        open={true}
        onOpenChange={onClose}
        onSubmit={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    expect(screen.getByText('Edit Template')).toBeDefined();

    // Rerender with closed
    rerender(
      <EditTemplateSheet
        template={null}
        open={false}
        onOpenChange={onClose}
        onSubmit={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    expect(screen.queryByText('Edit Template')).toBeNull();
  });
});
