import { jsx as _jsx } from 'react/jsx-runtime';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditUserSheet } from '@/components/admin/users/EditUserSheet';
// Mock react-hook-form to bypass validation
vi.mock('react-hook-form', () => ({
  useForm: () => ({
    register: vi.fn(),
    handleSubmit: (fn) => (e) => {
      if (e?.preventDefault) e.preventDefault();
      return Promise.resolve(fn({ name: 'John Doe', email: 'john@example.com' }));
    },
    watch: () => ({}),
    getValues: () => ({}),
    setValue: vi.fn(),
    reset: vi.fn(),
    formState: { errors: {}, isSubmitting: false },
  }),
  Controller: ({ render, name }) => render({ field: { value: '', onChange: vi.fn(), name } }),
  FormProvider: ({ children }) => _jsx('div', { children: children }),
  useFormContext: () => ({
    register: vi.fn(),
    handleSubmit: (fn) => (e) => {
      if (e?.preventDefault) e.preventDefault();
      return Promise.resolve(fn({ name: 'John Doe', email: 'john@example.com' }));
    },
    watch: () => ({}),
    getValues: () => ({}),
    setValue: vi.fn(),
    reset: vi.fn(),
    formState: { errors: {}, isSubmitting: false },
  }),
}));
vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => () => ({ values: {}, errors: {} }),
}));
// Mock the UI components
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children, open }) =>
    open ? _jsx('div', { 'data-testid': 'sheet', children: children }) : null,
  SheetContent: ({ children }) =>
    _jsx('div', { 'data-testid': 'sheet-content', children: children }),
  SheetDescription: ({ children }) =>
    _jsx('div', { 'data-testid': 'sheet-desc', children: children }),
  SheetFooter: ({ children }) => _jsx('div', { 'data-testid': 'sheet-footer', children: children }),
  SheetHeader: ({ children }) => _jsx('div', { 'data-testid': 'sheet-header', children: children }),
  SheetTitle: ({ children }) => _jsx('div', { 'data-testid': 'sheet-title', children: children }),
}));
vi.mock('@/components/ui/form', () => ({
  Form: ({ children }) => _jsx('div', { 'data-testid': 'form', children: children }),
  FormControl: ({ children }) => _jsx('div', { 'data-testid': 'form-control', children: children }),
  FormField: ({ render, name }) =>
    _jsx('div', {
      'data-testid': 'form-field',
      'data-field-name': name,
      children: render ? render({ field: { value: '', onChange: () => {}, name } }) : null,
    }),
  FormItem: ({ children }) => _jsx('div', { 'data-testid': 'form-item', children: children }),
  FormLabel: ({ children }) => _jsx('div', { 'data-testid': 'form-label', children: children }),
  FormMessage: () => _jsx('div', { 'data-testid': 'form-message' }),
}));
vi.mock('@/components/ui/input', () => ({
  Input: (props) =>
    _jsx('input', { 'data-testid': `input-${props.name || props.placeholder}`, ...props }),
}));
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, type, loading, ...props }) =>
    _jsx('button', {
      type: type,
      'data-testid': 'submit-btn',
      disabled: loading,
      ...props,
      children: loading ? 'Loading...' : children,
    }),
}));
// Mock useI18n
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key) => {
      const translations = {
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
      _jsx(EditUserSheet, {
        user: mockUser,
        open: true,
        onOpenChange: onOpenChange,
        onSubmit: onSubmit,
      }),
    );
    expect(screen.getByTestId('sheet')).toBeDefined();
    expect(screen.getByTestId('sheet-title')).toBeDefined();
    expect(screen.getByTestId('sheet-desc')).toBeDefined();
  });
  it('should not render when closed', () => {
    render(
      _jsx(EditUserSheet, {
        user: mockUser,
        open: false,
        onOpenChange: onOpenChange,
        onSubmit: onSubmit,
      }),
    );
    expect(screen.queryByTestId('sheet')).toBeNull();
  });
  it('should render form with two fields (name and email)', () => {
    render(
      _jsx(EditUserSheet, {
        user: mockUser,
        open: true,
        onOpenChange: onOpenChange,
        onSubmit: onSubmit,
      }),
    );
    const fields = screen.getAllByTestId('form-field');
    expect(fields).toHaveLength(2);
    expect(fields[0].getAttribute('data-field-name')).toBe('name');
    expect(fields[1].getAttribute('data-field-name')).toBe('email');
  });
  it('should render submit button', () => {
    render(
      _jsx(EditUserSheet, {
        user: mockUser,
        open: true,
        onOpenChange: onOpenChange,
        onSubmit: onSubmit,
      }),
    );
    expect(screen.getByTestId('submit-btn')).toBeDefined();
  });
  it('should call onSubmit when form is submitted', async () => {
    const submitFn = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const { container } = render(
      _jsx(EditUserSheet, {
        user: mockUser,
        open: true,
        onOpenChange: onClose,
        onSubmit: submitFn,
      }),
    );
    const formEl = container.querySelector('form');
    if (formEl) {
      fireEvent.submit(formEl);
    }
    await vi.waitFor(() => {
      expect(submitFn).toHaveBeenCalledOnce();
    });
    expect(onClose).toHaveBeenCalledOnce();
  });
  it('should render sheet with empty form when open even without user data', () => {
    render(
      _jsx(EditUserSheet, {
        user: null,
        open: true,
        onOpenChange: onOpenChange,
        onSubmit: onSubmit,
      }),
    );
    // Sheet renders with empty fields when user is null
    expect(screen.getByTestId('sheet')).toBeDefined();
    expect(screen.getByTestId('form')).toBeDefined();
  });
});
