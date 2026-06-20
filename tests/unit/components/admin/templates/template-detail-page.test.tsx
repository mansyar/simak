import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TemplateDetailPage } from '@/components/admin/templates/TemplateDetailPage';

vi.mock('@tanstack/react-start', () => ({
  useServerFn: vi.fn(() => vi.fn().mockResolvedValue({ assignments: [] })),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, search, ...props }: any) => (
    <a href={to} data-testid="link" {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

vi.mock('@/components/admin/templates/CheckpointListEditor', () => ({
  CheckpointListEditor: ({ checkpoints, onAdd, onRemove, onChange, onMoveUp, onMoveDown }: any) => (
    <div data-testid="checkpoint-editor">
      <span data-testid="checkpoint-count">{checkpoints?.length ?? 0}</span>
      <button data-testid="btn-add" onClick={onAdd}>
        Add
      </button>
      {checkpoints?.map((_: any, i: number) => (
        <div key={i} data-testid={`checkpoint-${i}`}>
          <input
            data-testid={`checkpoint-input-${i}`}
            value={checkpoints[i].name}
            onChange={(e) => onChange(i, e.target.value)}
          />
          <button data-testid={`btn-remove-${i}`} onClick={() => onRemove(i)}>
            Remove
          </button>
          <button data-testid={`btn-up-${i}`} onClick={() => onMoveUp(i)}>
            Up
          </button>
          <button data-testid={`btn-down-${i}`} onClick={() => onMoveDown(i)}>
            Down
          </button>
        </div>
      ))}
    </div>
  ),
}));

vi.mock('@/components/admin/templates/DeleteTemplateDialog', () => ({
  DeleteTemplateDialog: ({ open, onOpenChange, onConfirm, usageCount }: any) =>
    open ? (
      <div data-testid="delete-dialog">
        <span data-testid="delete-usage">{usageCount}</span>
        <button data-testid="btn-confirm-delete" onClick={onConfirm}>
          Confirm
        </button>
        <button data-testid="btn-cancel-delete" onClick={() => onOpenChange(false)}>
          Cancel
        </button>
      </div>
    ) : null,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => (
    <div data-testid="card" {...props}>
      {children}
    </div>
  ),
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: any) => <h3 data-testid="card-title">{children}</h3>,
  CardContent: ({ children, ...props }: any) => (
    <div data-testid="card-content" {...props}>
      {children}
    </div>
  ),
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

vi.mock('@/components/ui/back-link', () => ({
  BackLink: ({ to, label, search }: any) => (
    <a href={to as string} data-testid="back-link" data-search={JSON.stringify(search)}>
      {label}
    </a>
  ),
}));

vi.mock('lucide-react', () => ({
  AlertTriangle: () => <span data-testid="icon-alert" />,
  ArrowLeft: () => <span data-testid="icon-arrow-left" />,
  Trash2: () => <span data-testid="icon-trash" />,
}));

vi.mock('date-fns/format', () => ({
  format: () => 'Jan 1, 2026 00:00',
}));

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const translations: Record<string, string> = {
        'adminTemplates.detail.back': 'Back to Templates',
        'adminTemplates.detail.metadata': 'Template Information',
        'adminTemplates.detail.checkpoints': 'Checkpoints',
        'adminTemplates.detail.assignments': 'Assignments',
        'adminTemplates.detail.noAssignments': 'No assignments',
        'adminTemplates.detail.saveSuccess': 'Saved',
        'adminTemplates.detail.created': 'Created',
        'adminTemplates.detail.createdBy': 'Created by',
        'adminTemplates.form.name': 'Name',
        'adminTemplates.form.type': 'Type',
        'adminTemplates.form.namePlaceholder': 'Name...',
        'adminTemplates.form.typePlaceholder': 'Type...',
        'adminTemplates.actions.delete': 'Delete',
        'adminTemplates.deleteConfirm': 'Delete?',
        'adminTemplates.inUseBanner': 'Used by {count} assignments',
        'common.save': 'Save',
        'common.cancel': 'Cancel',
        'common.saving': 'Saving...',
        'common.error': 'Error',
      };
      let result = translations[key] || key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          result = result.replace(`{${k}}`, v);
        });
      }
      return result;
    },
  }),
}));

vi.mock('@/server/templates', () => ({
  getTemplate: vi.fn(),
  updateTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
  listTemplateAssignments: vi.fn(),
}));

const mockTemplate = {
  id: 1,
  name: 'Thesis Template',
  type: 'Thesis',
  createdBy: 'admin-1',
  createdByName: 'Admin User',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  assignmentCount: 2,
  checkpoints: [
    { id: 1, name: 'Chapter 1', order: 1, minConsultations: 1, estimatedDuration: 7 },
    { id: 2, name: 'Chapter 2', order: 2, minConsultations: 0, estimatedDuration: 14 },
  ],
};

describe('TemplateDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render template name and type inputs', () => {
    render(<TemplateDetailPage template={mockTemplate} />);
    expect((screen.getByTestId('template-name') as HTMLInputElement).value).toBe('Thesis Template');
    expect((screen.getByTestId('template-type') as HTMLInputElement).value).toBe('Thesis');
  });

  it('should render metadata section with created date', () => {
    render(<TemplateDetailPage template={mockTemplate} />);
    expect(screen.getAllByText(/Created/).length).toBeGreaterThanOrEqual(2);
  });

  it('should render in-use banner when assignmentCount > 0', () => {
    render(<TemplateDetailPage template={mockTemplate} />);
    expect(screen.getByText(/Used by 2/)).toBeTruthy();
  });

  it('should not render in-use banner when assignmentCount is 0', () => {
    const template = { ...mockTemplate, assignmentCount: 0 };
    render(<TemplateDetailPage template={template} />);
    expect(screen.queryByText(/Used by/)).toBeNull();
  });

  it('should render checkpoint editor with correct count', () => {
    render(<TemplateDetailPage template={mockTemplate} />);
    expect(screen.getByTestId('checkpoint-count').textContent).toBe('2');
  });

  it('should render save and cancel buttons', () => {
    render(<TemplateDetailPage template={mockTemplate} />);
    expect(screen.getByTestId('save-template')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('should render delete button', () => {
    render(<TemplateDetailPage template={mockTemplate} />);
    expect(screen.getByTestId('delete-template')).toBeTruthy();
  });

  it('should open delete dialog when delete button clicked', () => {
    render(<TemplateDetailPage template={mockTemplate} />);
    fireEvent.click(screen.getByTestId('delete-template'));
    expect(screen.getByTestId('delete-dialog')).toBeTruthy();
    expect(screen.getByTestId('delete-usage').textContent).toBe('2');
  });

  it('should render back link', () => {
    render(<TemplateDetailPage template={mockTemplate} />);
    expect(screen.getByText('Back to Templates')).toBeTruthy();
  });

  it('should render BackLink primitive pointing to /admin/templates with search params', () => {
    render(<TemplateDetailPage template={mockTemplate} />);
    const backLink = screen.getByTestId('back-link');
    expect(backLink).toBeTruthy();
    expect(backLink.getAttribute('href')).toBe('/admin/templates');
    expect(backLink.textContent).toBe('Back to Templates');
    expect(backLink.getAttribute('data-search')).toBe(
      JSON.stringify({ page: 1, limit: 20, search: '', type: '' }),
    );
  });

  it('should render null when template is null', () => {
    const { container } = render(<TemplateDetailPage template={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('should handle template with no checkpoints', () => {
    const template = { ...mockTemplate, checkpoints: [] };
    render(<TemplateDetailPage template={template} />);
    expect(screen.getByTestId('checkpoint-count').textContent).toBe('0');
  });

  it('should handle template with null createdByName', () => {
    const template = { ...mockTemplate, createdByName: null };
    render(<TemplateDetailPage template={template} />);
    expect(screen.getByText('admin-1')).toBeTruthy();
  });
});
