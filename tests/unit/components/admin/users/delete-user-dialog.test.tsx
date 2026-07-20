/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
  },
}));

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (params) {
        return Object.entries(params).reduce(
          (str: string, [k, v]) => str.replace(`{${k}}`, v),
          key,
        );
      }
      return key;
    },
    locale: 'en' as const,
    setLocale: vi.fn(),
  }),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, onOpenChange, children }: any) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children, ...props }: any) => (
    <div data-testid="dialog-content" {...props}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <h2 data-testid="dialog-title">{children}</h2>,
  DialogDescription: ({ children }: any) => <p data-testid="dialog-description">{children}</p>,
  DialogFooter: ({ children }: any) => <div data-testid="dialog-footer">{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, variant, ...props }: any) => (
    <button data-testid="button" data-variant={variant} onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('lucide-react', () => ({
  AlertTriangle: (props: any) => <svg data-testid="alert-triangle" {...props} />,
}));

import { DeleteUserDialog } from '@/components/admin/users/DeleteUserDialog';

describe('DeleteUserDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onConfirm: vi.fn().mockResolvedValue(undefined),
    userName: 'John Doe',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the dialog with the user name in delete confirmation', () => {
    render(<DeleteUserDialog {...defaultProps} />);
    expect(screen.getByTestId('dialog')).toBeDefined();
    // The description contains the delete confirmation with user name
    expect(screen.getByText(/deleteConfirm/)).toBeDefined();
  });

  it('should call onConfirm when delete button is clicked', () => {
    render(<DeleteUserDialog {...defaultProps} />);
    const buttons = screen.getAllByTestId('button');
    const deleteButton = buttons.find((b) => b.getAttribute('data-variant') === 'destructive');
    fireEvent.click(deleteButton!);
    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('should call onOpenChange(false) when cancel is clicked', () => {
    render(<DeleteUserDialog {...defaultProps} />);
    const buttons = screen.getAllByTestId('button');
    const cancelButton = buttons.find((b) => b.getAttribute('data-variant') === 'outline');
    fireEvent.click(cancelButton!);
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('should not render when closed', () => {
    render(<DeleteUserDialog {...defaultProps} open={false} />);
    expect(screen.queryByTestId('dialog')).toBeNull();
  });

  it('should show success toast on successful delete', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<DeleteUserDialog {...defaultProps} onConfirm={onConfirm} />);

    const buttons = screen.getAllByTestId('button');
    const deleteButton = buttons.find((b) => b.getAttribute('data-variant') === 'destructive');
    fireEvent.click(deleteButton!);

    await vi.waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('adminUsers.deleteSuccess');
    });
  });
});
