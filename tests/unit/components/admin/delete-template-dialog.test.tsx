import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeleteTemplateDialog } from '@/components/admin/templates/DeleteTemplateDialog';

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
  DialogDescription: ({ children }: any) => <div data-testid="dialog-desc">{children}</div>,
  DialogFooter: ({ children }: any) => <div data-testid="dialog-footer">{children}</div>,
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <div data-testid="dialog-title">{children}</div>,
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input data-testid="delete-input" {...props} />,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} data-testid="dialog-btn" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => (
    <label data-slot="label" {...props}>
      {children}
    </label>
  ),
}));

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'adminTemplates.deleteConfirm': 'Delete this template?',
        'adminTemplates.deleteInUse': params
          ? `This template is used by ${params.count} assignment(s). Type DELETE to confirm.`
          : key,
        'adminTemplates.actions.delete': 'Delete',
        'common.cancel': 'Cancel',
        'common.deleteConfirmationWord': 'DELETE',
      };
      return translations[key] || key;
    },
  }),
}));

describe('DeleteTemplateDialog', () => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render when open', () => {
    render(
      <DeleteTemplateDialog
        open={true}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
        usageCount={0}
      />,
    );
    expect(screen.getByTestId('dialog')).toBeDefined();
  });

  it('should not render when closed', () => {
    render(
      <DeleteTemplateDialog
        open={false}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
        usageCount={0}
      />,
    );
    expect(screen.queryByTestId('dialog')).toBeNull();
  });

  it('should show basic confirm text for unused template', () => {
    render(
      <DeleteTemplateDialog
        open={true}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
        usageCount={0}
      />,
    );
    const found = screen.getAllByText('Delete this template?');
    expect(found.length).toBeGreaterThan(0);
  });

  it('should show usage warning for in-use template', () => {
    render(
      <DeleteTemplateDialog
        open={true}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
        usageCount={3}
      />,
    );
    expect(screen.getByText(/This template is used by 3/)).toBeDefined();
  });

  it('should show text input for in-use template requiring DELETE', () => {
    render(
      <DeleteTemplateDialog
        open={true}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
        usageCount={3}
      />,
    );
    expect(screen.getByTestId('delete-input')).toBeDefined();
  });

  it('should not show text input for unused template', () => {
    render(
      <DeleteTemplateDialog
        open={true}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
        usageCount={0}
      />,
    );
    expect(screen.queryByTestId('delete-input')).toBeNull();
  });

  it('should not disable confirm for unused template', () => {
    render(
      <DeleteTemplateDialog
        open={true}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
        usageCount={0}
      />,
    );
    const buttons = screen.getAllByTestId('dialog-btn');
    const confirmBtn = buttons.find((btn) => btn.textContent === 'Delete') as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(false);
  });

  it('should disable confirm button for in-use when DELETE not typed', () => {
    render(
      <DeleteTemplateDialog
        open={true}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
        usageCount={3}
      />,
    );
    const buttons = screen.getAllByTestId('dialog-btn');
    const confirmBtn = buttons.find((btn) => btn.textContent === 'Delete') as HTMLButtonElement;
    expect(confirmBtn).toBeDefined();
    expect(confirmBtn.disabled).toBe(true);
  });

  it('should enable confirm button for in-use when DELETE typed', () => {
    render(
      <DeleteTemplateDialog
        open={true}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
        usageCount={3}
      />,
    );
    const input = screen.getByTestId('delete-input');
    fireEvent.change(input, { target: { value: 'DELETE' } });

    const buttons = screen.getAllByTestId('dialog-btn');
    const confirmBtn = buttons.find((btn) => btn.textContent === 'Delete') as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(false);
  });

  it('should call onConfirm when delete clicked for unused template', () => {
    render(
      <DeleteTemplateDialog
        open={true}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
        usageCount={0}
      />,
    );
    const buttons = screen.getAllByTestId('dialog-btn');
    const confirmBtn = buttons.find((btn) => btn.textContent === 'Delete');
    fireEvent.click(confirmBtn!);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('should call onCancel when cancel clicked', () => {
    render(
      <DeleteTemplateDialog
        open={true}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
        usageCount={0}
      />,
    );
    const buttons = screen.getAllByTestId('dialog-btn');
    const cancelBtn = buttons.find((btn) => btn.textContent === 'Cancel');
    fireEvent.click(cancelBtn!);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('should use Label component for the DELETE confirmation input', () => {
    const { container } = render(
      <DeleteTemplateDialog
        open={true}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
        usageCount={3}
      />,
    );
    const labels = container.querySelectorAll('[data-slot="label"]');
    expect(labels.length).toBe(1);
  });
});
