import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TemplateCard } from '@/components/admin/templates/TemplateCard';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'adminTemplates.checkpointCount') {
        return params ? `${params.count} checkpoints` : key;
      }
      if (key === 'adminTemplates.createdAt') return 'Created At';
      if (key === 'adminTemplates.actions.edit') return 'Edit';
      if (key === 'adminTemplates.actions.duplicate') return 'Duplicate';
      if (key === 'adminTemplates.actions.delete') return 'Delete';
      return key;
    },
  }),
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div data-testid="dropdown-content">{children}</div>,
  DropdownMenuItem: ({ children, onClick, className }: any) => {
    // Extract text content from children array (icon + text)
    const text = Array.isArray(children) ? children[1] : children;
    return (
      <button onClick={onClick} className={className}>
        {children}
      </button>
    );
  },
  DropdownMenuTrigger: ({ children }: any) => (
    <button data-testid="dropdown-trigger">{children}</button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: any) => (
    <span data-testid="badge" data-variant={variant}>
      {children}
    </span>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
}));

describe('TemplateCard', () => {
  const mockTemplate = {
    id: 1,
    name: 'Thesis Template',
    type: 'Thesis',
    checkpointCount: 4,
    createdAt: new Date('2025-01-15'),
  };

  const onEdit = vi.fn();
  const onDuplicate = vi.fn();
  const onDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render template name', () => {
    render(
      <TemplateCard
        template={mockTemplate}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByText('Thesis Template')).toBeDefined();
  });

  it('should render type label badge', () => {
    render(
      <TemplateCard
        template={mockTemplate}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByText('Thesis')).toBeDefined();
  });

  it('should render checkpoint count', () => {
    render(
      <TemplateCard
        template={mockTemplate}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByText('4 checkpoints')).toBeDefined();
  });

  it('should render actions dropdown', () => {
    render(
      <TemplateCard
        template={mockTemplate}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByTestId('dropdown-menu')).toBeDefined();
    expect(screen.getByTestId('dropdown-trigger')).toBeDefined();
  });

  it('should call onEdit when edit dropdown item is clicked', () => {
    render(
      <TemplateCard
        template={mockTemplate}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByText('Edit'));
    expect(onEdit).toHaveBeenCalledWith(mockTemplate);
  });

  it('should call onDuplicate when duplicate dropdown item is clicked', () => {
    render(
      <TemplateCard
        template={mockTemplate}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByText('Duplicate'));
    expect(onDuplicate).toHaveBeenCalledWith(mockTemplate);
  });

  it('should call onDelete when delete dropdown item is clicked', () => {
    render(
      <TemplateCard
        template={mockTemplate}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByText('Delete'));
    expect(onDelete).toHaveBeenCalledWith(mockTemplate);
  });

  it('should render formatted date', () => {
    render(
      <TemplateCard
        template={mockTemplate}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByText('Jan 15, 2025')).toBeDefined();
  });

  it('should render without date when createdAt is null', () => {
    const templateNoDate = { ...mockTemplate, createdAt: null };
    render(
      <TemplateCard
        template={templateNoDate}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />,
    );
    const datePattern = /Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/;
    expect(screen.queryByText(datePattern)).toBeNull();
  });
});
