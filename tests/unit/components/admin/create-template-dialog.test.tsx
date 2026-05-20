import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateTemplateDialog } from '@/components/admin/templates/CreateTemplateDialog';
import { CreateTemplateSchema } from '@/server/templates';

// Mock UI components
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
  FormControl: ({ children }: any) => <div data-testid="form-control">{children}</div>,
  FormField: ({ render, name }: any) => (
    <div data-testid="form-field" data-field-name={name}>
      {render ? render({ field: { value: '', onChange: () => {}, name } }) : null}
    </div>
  ),
  FormItem: ({ children }: any) => <div data-testid="form-item">{children}</div>,
  FormLabel: ({ children }: any) => <div data-testid="form-label">{children}</div>,
  FormMessage: () => <div data-testid="form-message" />,
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input data-testid={`input-${props.name || 'generic'}`} {...props} />,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, type, loading, ...props }: any) => (
    <button type={type} data-testid="submit-btn" disabled={loading} {...props}>
      {loading ? 'Loading...' : children}
    </button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: any) => <span data-testid="badge">{children}</span>,
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
        'adminTemplates.form.checkpointName': 'Checkpoint Name',
        'adminTemplates.form.addCheckpoint': 'Add Checkpoint',
        'adminTemplates.form.removeCheckpoint': 'Remove',
        'adminTemplates.form.moveUp': 'Move Up',
        'adminTemplates.form.moveDown': 'Move Down',
        'adminTemplates.createSuccess': 'Template created successfully',
        'common.create': 'Create',
        'common.cancel': 'Cancel',
        'common.error': 'Error',
        'common.submit': 'Submit',
      };
      return translations[key] || key;
    },
  }),
}));

describe('CreateTemplateDialog', () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render title when open', () => {
    render(
      <CreateTemplateDialog
        open={true}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />,
    );
    expect(screen.getByTestId('dialog')).toBeDefined();
    expect(screen.getByTestId('dialog-title')).toBeDefined();
    expect(screen.getByTestId('dialog-desc')).toBeDefined();
  });

  it('should not render dialog when closed', () => {
    render(
      <CreateTemplateDialog
        open={false}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />,
    );
    expect(screen.queryByTestId('dialog')).toBeNull();
  });

  it('should render form with name and type fields', () => {
    render(
      <CreateTemplateDialog
        open={true}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />,
    );
    const fields = screen.getAllByTestId('form-field');
    const fieldNames = fields.map((f) => f.getAttribute('data-field-name'));
    expect(fieldNames).toContain('name');
    expect(fieldNames).toContain('type');
  });

  it('should render submit button', () => {
    render(
      <CreateTemplateDialog
        open={true}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />,
    );
    const submitBtns = screen.getAllByTestId('submit-btn');
    // Find the submit button with type="submit"
    const submitBtn = submitBtns.find((btn) => btn.getAttribute('type') === 'submit');
    expect(submitBtn).toBeDefined();
  });

  it('should render 3 default checkpoint rows', () => {
    render(
      <CreateTemplateDialog
        open={true}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />,
    );
    const checkpointInputs = screen.getAllByPlaceholderText('Checkpoint Name');
    expect(checkpointInputs.length).toBe(3);
  });

  it('should validate the Zod schema correctly', () => {
    // Valid input
    const valid = CreateTemplateSchema.safeParse({
      name: 'Thesis Template',
      type: 'Thesis',
      checkpoints: ['Chapter 1', 'Chapter 2'],
    });
    expect(valid.success).toBe(true);

    // Empty name
    const emptyName = CreateTemplateSchema.safeParse({
      name: '',
      type: 'Thesis',
      checkpoints: ['Chapter 1'],
    });
    expect(emptyName.success).toBe(false);

    // Empty type
    const emptyType = CreateTemplateSchema.safeParse({
      name: 'Test',
      type: '',
      checkpoints: ['Chapter 1'],
    });
    expect(emptyType.success).toBe(false);

    // Zero checkpoints
    const noCheckpoints = CreateTemplateSchema.safeParse({
      name: 'Test',
      type: 'Thesis',
      checkpoints: [],
    });
    expect(noCheckpoints.success).toBe(false);

    // Empty checkpoint name
    const emptyCheckpoint = CreateTemplateSchema.safeParse({
      name: 'Test',
      type: 'Thesis',
      checkpoints: ['Chapter 1', ''],
    });
    expect(emptyCheckpoint.success).toBe(false);
  });
});
