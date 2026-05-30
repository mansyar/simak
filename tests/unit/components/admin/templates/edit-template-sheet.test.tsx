import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { EditTemplateSheet } from '@/components/admin/templates/EditTemplateSheet';

// Hoisted mocks for react-hook-form
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
  CheckpointListEditor: ({ checkpoints }: any) => (
    <div data-testid="checkpoint-editor">
      <span data-testid="checkpoint-count">{checkpoints?.length ?? 0}</span>
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
        'adminTemplates.form.namePlaceholder': 'e.g. Thesis Template',
        'adminTemplates.form.type': 'Type',
        'adminTemplates.form.typePlaceholder': 'e.g. Thesis',
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

describe('EditTemplateSheet', () => {
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
    mockFormMethods.getValues.mockReturnValue([
      { name: 'CP1', minConsultations: 0, estimatedDuration: 7 },
      { name: 'CP2', minConsultations: 1, estimatedDuration: 14 },
    ]);
    mockFormMethods.watch.mockReturnValue([
      { name: 'CP1', minConsultations: 0, estimatedDuration: 7 },
      { name: 'CP2', minConsultations: 1, estimatedDuration: 14 },
    ]);
    mockFormMethods.handleSubmit.mockImplementation((cb: Function) => async () => {
      await cb({
        name: 'Test Template',
        type: 'Thesis',
        checkpoints: [{ name: 'CP1', minConsultations: 0, estimatedDuration: 7 }],
      });
    });
  });

  it('renders Sheet with title when open=true and template provided', () => {
    render(
      <EditTemplateSheet
        template={mockTemplate}
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />,
    );
    expect(screen.getByTestId('sheet')).toBeDefined();
    expect(screen.getByText('Edit Template')).toBeDefined();
    expect(screen.getByText('Edit template name, type, and checkpoints.')).toBeDefined();
  });

  it('does not render content when open=false', () => {
    render(
      <EditTemplateSheet
        template={mockTemplate}
        open={false}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />,
    );
    expect(screen.queryByTestId('sheet')).toBeNull();
    expect(screen.queryByText('Edit Template')).toBeNull();
  });

  it('shows in-use banner when template has assignmentCount > 0', () => {
    render(
      <EditTemplateSheet
        template={{ ...mockTemplate, assignmentCount: 5 }}
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />,
    );
    expect(screen.getByText(/used by 5/)).toBeDefined();
    expect(screen.getByTestId('alert-triangle')).toBeDefined();
  });

  it('does NOT show in-use banner when assignmentCount is 0', () => {
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
    expect(screen.queryByTestId('alert-triangle')).toBeNull();
  });

  it('does NOT show in-use banner when assignmentCount is undefined', () => {
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

  it('renders form fields and CheckpointListEditor', () => {
    render(
      <EditTemplateSheet
        template={mockTemplate}
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />,
    );
    expect(screen.getByText('Name')).toBeDefined();
    expect(screen.getByText('Type')).toBeDefined();
    expect(screen.getByText('Checkpoints')).toBeDefined();
    expect(screen.getByText('Save')).toBeDefined();
    expect(screen.getByTestId('checkpoint-editor')).toBeDefined();
    expect(screen.getByTestId('checkpoint-count').textContent).toBe('2');
  });

  it('renders Save button', () => {
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
});
