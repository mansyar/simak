import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EditUserSheet } from '@/components/admin/users/EditUserSheet';

// Mock the UI components
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="sheet">{children}</div> : null,
  SheetContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sheet-content">{children}</div>
  ),
  SheetDescription: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sheet-desc">{children}</div>
  ),
  SheetFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sheet-footer">{children}</div>
  ),
  SheetHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sheet-header">{children}</div>
  ),
  SheetTitle: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sheet-title">{children}</div>
  ),
}));

vi.mock('@/components/ui/form', () => ({
  Form: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="form">{children}</div>
  ),
  FormControl: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="form-control">{children}</div>
  ),
  FormField: ({ render, name }: { render: any; name: string }) => (
    <div data-testid="form-field" data-field-name={name}>
      {render ? render({ field: { value: '', onChange: () => {}, name } }) : null}
    </div>
  ),
  FormItem: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="form-item">{children}</div>
  ),
  FormLabel: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="form-label">{children}</div>
  ),
  FormMessage: () => <div data-testid="form-message" />,
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input data-testid={`input-${props.name || props.placeholder}`} {...props} />,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, type, loading, ...props }: any) => (
    <button type={type} data-testid="submit-btn" disabled={loading} {...props}>
      {loading ? 'Loading...' : children}
    </button>
  ),
}));

// Mock useI18n
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'adminUsers.edit': 'Edit User',
        'adminUsers.table.name': 'Name',
        'auth.email': 'Email',
        'common.save': 'Save',
      };
      return translations[key] || key;
    },
  }),
}));

describe('EditUserSheet', () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onOpenChange = vi.fn();
  const mockUser = { id: '1', name: 'John Doe', email: 'john@example.com' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render when open with user data', () => {
    render(
      <EditUserSheet
        user={mockUser}
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByTestId('sheet')).toBeDefined();
    expect(screen.getByTestId('sheet-title')).toBeDefined();
    expect(screen.getByTestId('sheet-desc')).toBeDefined();
  });

  it('should not render when closed', () => {
    render(
      <EditUserSheet
        user={mockUser}
        open={false}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
      />
    );

    expect(screen.queryByTestId('sheet')).toBeNull();
  });

  it('should render form with two fields (name and email)', () => {
    render(
      <EditUserSheet
        user={mockUser}
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
      />
    );

    const fields = screen.getAllByTestId('form-field');
    expect(fields).toHaveLength(2);
    expect(fields[0].getAttribute('data-field-name')).toBe('name');
    expect(fields[1].getAttribute('data-field-name')).toBe('email');
  });

  it('should render submit button', () => {
    render(
      <EditUserSheet
        user={mockUser}
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByTestId('submit-btn')).toBeDefined();
  });

  it('should render sheet with empty form when open even without user data', () => {
    render(
      <EditUserSheet
        user={null}
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
      />
    );

    // Sheet renders with empty fields when user is null
    expect(screen.getByTestId('sheet')).toBeDefined();
    expect(screen.getByTestId('form')).toBeDefined();
  });
});
