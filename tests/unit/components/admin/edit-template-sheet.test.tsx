import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EditTemplateSheet } from '@/components/admin/templates/EditTemplateSheet';
import { UpdateTemplateSchema } from '@/server/templates';

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
  Badge: ({ children, variant }: any) => (
    <span data-testid="badge" data-variant={variant}>
      {children}
    </span>
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
        'adminTemplates.form.checkpointName': 'Checkpoint Name',
        'adminTemplates.form.addCheckpoint': 'Add Checkpoint',
        'adminTemplates.form.removeCheckpoint': 'Remove',
        'adminTemplates.form.moveUp': 'Move Up',
        'adminTemplates.form.moveDown': 'Move Down',
        'adminTemplates.updateSuccess': 'Template updated successfully',
        'adminTemplates.inUseBanner': params
          ? `This template is used by ${params.count} assignment(s).`
          : key,
        'common.save': 'Save',
        'common.cancel': 'Cancel',
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

  const onSubmit = vi.fn().mockResolvedValue({ success: true });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render title when open with template data', () => {
    render(
      <EditTemplateSheet
        template={mockTemplate}
        open={true}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
        onSuccess={vi.fn()}
      />,
    );
    expect(screen.getByTestId('sheet')).toBeDefined();
    expect(screen.getByTestId('sheet-title')).toBeDefined();
    expect(screen.getByTestId('sheet-desc')).toBeDefined();
  });

  it('should not render sheet when closed', () => {
    render(
      <EditTemplateSheet
        template={mockTemplate}
        open={false}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
        onSuccess={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('sheet')).toBeNull();
  });

  it('should render form with name and type fields', () => {
    render(
      <EditTemplateSheet
        template={mockTemplate}
        open={true}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
        onSuccess={vi.fn()}
      />,
    );
    const fields = screen.getAllByTestId('form-field');
    const fieldNames = fields.map((f) => f.getAttribute('data-field-name'));
    expect(fieldNames).toContain('name');
    expect(fieldNames).toContain('type');
  });

  it('should render submit button', () => {
    render(
      <EditTemplateSheet
        template={mockTemplate}
        open={true}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
        onSuccess={vi.fn()}
      />,
    );
    const submitBtns = screen.getAllByTestId('submit-btn');
    const saveBtn = submitBtns.find((btn) => btn.textContent === 'Save');
    expect(saveBtn).toBeDefined();
  });

  it('should validate the Zod schema correctly', () => {
    // Valid input
    const valid = UpdateTemplateSchema.safeParse({
      name: 'Updated Template',
      type: 'Thesis',
      checkpoints: ['Ch 1', 'Ch 2'],
    });
    expect(valid.success).toBe(true);

    // Empty name
    const emptyName = UpdateTemplateSchema.safeParse({
      name: '',
      type: 'Thesis',
      checkpoints: ['Ch 1'],
    });
    expect(emptyName.success).toBe(false);

    // Zero checkpoints
    const noCheckpoints = UpdateTemplateSchema.safeParse({
      name: 'Test',
      type: 'Thesis',
      checkpoints: [],
    });
    expect(noCheckpoints.success).toBe(false);
  });
});
