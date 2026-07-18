/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

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
  Dialog: ({ open, children }: any) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2 data-testid="dialog-title">{children}</h2>,
  DialogDescription: ({ children }: any) => <p data-testid="dialog-description">{children}</p>,
  DialogFooter: ({ children }: any) => <div data-testid="dialog-footer">{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, variant, disabled, ...props }: any) => (
    <button
      data-testid="button"
      data-variant={variant}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <select
      data-testid="select"
      value={value ?? ''}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: any) => <>{children}</>,
  SelectValue: ({ placeholder }: any) => <option value="">{placeholder}</option>,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: any) => (
    <span data-testid="badge" data-variant={variant}>
      {children}
    </span>
  ),
}));

vi.mock('lucide-react', () => ({
  AlertTriangle: (props: any) => <svg data-testid="alert-triangle" {...props} />,
  CheckCircle: (props: any) => <svg data-testid="check-circle" {...props} />,
}));

import { ReassignmentDialog } from '@/components/admin/users/ReassignmentDialog';

describe('ReassignmentDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    assignments: [
      { id: 1, title: 'Assignment 1' },
      { id: 2, title: 'Assignment 2' },
    ],
    instructors: [
      { id: 'inst-1', name: 'Jane Smith' },
      { id: 'inst-2', name: 'Bob Jones' },
    ],
    onReassign: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the dialog with assignment list', () => {
    render(<ReassignmentDialog {...defaultProps} />);
    expect(screen.getByTestId('dialog')).toBeDefined();
    expect(screen.getByText('Assignment 1')).toBeDefined();
    expect(screen.getByText('Assignment 2')).toBeDefined();
  });

  it('should render a select dropdown for each unassigned assignment', () => {
    render(<ReassignmentDialog {...defaultProps} />);
    const selects = screen.getAllByTestId('select');
    expect(selects).toHaveLength(2);
  });

  it('should disable delete button until all assignments are reassigned', () => {
    render(<ReassignmentDialog {...defaultProps} />);
    const buttons = screen.getAllByTestId('button');
    const deleteButton = buttons.find(
      (b) => b.getAttribute('data-variant') === 'destructive',
    ) as HTMLButtonElement;
    expect(deleteButton?.disabled).toBe(true);
  });

  it('should enable delete button after all assignments are reassigned', async () => {
    render(<ReassignmentDialog {...defaultProps} />);

    const selects = screen.getAllByTestId('select');
    fireEvent.change(selects[0], { target: { value: 'inst-1' } });
    await waitFor(() => {
      expect(defaultProps.onReassign).toHaveBeenCalledWith(1, 'inst-1');
    });

    fireEvent.change(selects[1], { target: { value: 'inst-2' } });
    await waitFor(() => {
      expect(defaultProps.onReassign).toHaveBeenCalledWith(2, 'inst-2');
    });

    const buttons = screen.getAllByTestId('button');
    const deleteButton = buttons.find(
      (b) => b.getAttribute('data-variant') === 'destructive',
    ) as HTMLButtonElement;
    expect(deleteButton?.disabled).toBe(false);
  });

  it('should call onDelete when delete button is clicked after all reassigned', async () => {
    render(<ReassignmentDialog {...defaultProps} />);

    const selects = screen.getAllByTestId('select');
    fireEvent.change(selects[0], { target: { value: 'inst-1' } });
    fireEvent.change(selects[1], { target: { value: 'inst-2' } });

    await waitFor(() => {
      const buttons = screen.getAllByTestId('button');
      const deleteButton = buttons.find(
        (b) => b.getAttribute('data-variant') === 'destructive',
      ) as HTMLButtonElement;
      expect(deleteButton?.disabled).toBe(false);
    });

    const buttons = screen.getAllByTestId('button');
    const deleteButton = buttons.find(
      (b) => b.getAttribute('data-variant') === 'destructive',
    ) as HTMLButtonElement;
    fireEvent.click(deleteButton!);
    expect(defaultProps.onDelete).toHaveBeenCalledTimes(1);
  });

  it('should not render when closed', () => {
    render(<ReassignmentDialog {...defaultProps} open={false} />);
    expect(screen.queryByTestId('dialog')).toBeNull();
  });
});
