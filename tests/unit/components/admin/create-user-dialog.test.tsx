import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CreateUserDialog } from '@/components/admin/users/CreateUserDialog';
import { CreateUserSchema } from '@/server/users';

// Mock the UI components that have complex dependencies
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-desc">{children}</div>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-footer">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-title">{children}</div>
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

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange }: any) => (
    <select
      data-testid="role-select"
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ value, children }: any) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
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
        'adminUsers.newUser': 'New User',
        'adminUsers.createPrompt': 'Create your first user',
        'adminUsers.table.name': 'Name',
        'adminUsers.table.role': 'Role',
        'adminUsers.role_admin': 'Admin',
        'adminUsers.role_instructor': 'Instructor',
        'adminUsers.role_student': 'Student',
        'auth.email': 'Email',
        'common.create': 'Create',
        'common.error': 'Error',
      };
      return translations[key] || key;
    },
  }),
}));

describe('CreateUserDialog', () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render title when open', () => {
    render(<CreateUserDialog open={true} onOpenChange={vi.fn()} onSubmit={onSubmit} />);
    expect(screen.getByTestId('dialog')).toBeDefined();
    expect(screen.getByTestId('dialog-title')).toBeDefined();
    expect(screen.getByTestId('dialog-desc')).toBeDefined();
  });

  it('should not render dialog when closed', () => {
    render(<CreateUserDialog open={false} onOpenChange={vi.fn()} onSubmit={onSubmit} />);
    expect(screen.queryByTestId('dialog')).toBeNull();
  });

  it('should render form with submit button', () => {
    render(<CreateUserDialog open={true} onOpenChange={vi.fn()} onSubmit={onSubmit} />);
    expect(screen.getByTestId('form')).toBeDefined();
    expect(screen.getByTestId('submit-btn')).toBeDefined();
  });

  it('should render three form fields for name, email, and role', () => {
    render(<CreateUserDialog open={true} onOpenChange={vi.fn()} onSubmit={onSubmit} />);
    const fields = screen.getAllByTestId('form-field');
    expect(fields).toHaveLength(3);
  });

  it('should render role select dropdown with options', () => {
    render(<CreateUserDialog open={true} onOpenChange={vi.fn()} onSubmit={onSubmit} />);
    expect(screen.getByTestId('role-select')).toBeDefined();

    // All role options should be rendered
    const options = screen.getAllByRole('option');
    expect(options.length).toBe(3); // admin, instructor, student
    expect(options[0].getAttribute('value')).toBe('admin');
    expect(options[1].getAttribute('value')).toBe('instructor');
    expect(options[2].getAttribute('value')).toBe('student');
  });

  it('should validate the Zod schema correctly', () => {
    // Valid input
    const valid = CreateUserSchema.safeParse({
      name: 'Test User',
      email: 'test@example.com',
      role: 'student',
    });
    expect(valid.success).toBe(true);

    // Invalid email
    const invalidEmail = CreateUserSchema.safeParse({
      name: 'Test',
      email: 'not-an-email',
      role: 'student',
    });
    expect(invalidEmail.success).toBe(false);

    // Empty name
    const emptyName = CreateUserSchema.safeParse({
      name: '',
      email: 'test@example.com',
      role: 'student',
    });
    expect(emptyName.success).toBe(false);

    // Invalid role (superadmin not allowed via create)
    const invalidRole = CreateUserSchema.safeParse({
      name: 'Test',
      email: 'test@example.com',
      role: 'superadmin',
    });
    expect(invalidRole.success).toBe(false);
  });
});
