/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { ComponentType } from 'react';

// Mock @tanstack/react-router
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: vi.fn().mockReturnValue((config: any) => ({
    ...config,
    useNavigate: vi.fn().mockReturnValue(vi.fn()),
  })),
  useRouter: vi.fn().mockReturnValue({ invalidate: vi.fn() }),
}));

// Mock @tanstack/react-start
vi.mock('@tanstack/react-start', () => ({
  useServerFn: vi.fn().mockImplementation((fn) => fn),
}));

// Mock server functions
vi.mock('@/server/bulk-import', () => ({
  bulkCreateUsers: vi.fn(),
}));

// Mock __root (i18n)
vi.mock('@/routes/__root', () => ({
  useI18n: vi.fn().mockReturnValue({
    t: vi.fn().mockImplementation((key: string) => key),
    locale: 'en',
    setLocale: vi.fn(),
  }),
}));

// Mock bulk-import client libs
vi.mock('@/lib/bulk-import/parse-users', () => ({
  parseUsersXlsx: vi.fn(),
}));

vi.mock('@/lib/bulk-import/samples', () => ({
  generateUserSampleXlsx: vi.fn(),
}));

// Mock UI components that are not under test
vi.mock('@/components/ui/page-header', () => ({
  PageHeader: ({ title, subtitle }: any) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  ),
}));

vi.mock('@/components/ui/alert-banner', () => ({
  AlertBanner: (props: any) => (
    <div data-testid="alert-banner" data-variant={props.variant}>
      {props.children}
    </div>
  ),
}));

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value, label }: any) => (
    <div data-testid="progress">
      {label}: {value}%
    </div>
  ),
}));

async function getComponent(): Promise<ComponentType> {
  const mod = await import('@/routes/_authenticated/admin/users/import');
  return (mod.Route as any).component ?? (mod.Route as any).Component;
}

describe('Admin Users Import page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export a route component', async () => {
    const mod = await import('@/routes/_authenticated/admin/users/import');
    expect(mod).toBeDefined();
    expect(mod.Route).toBeDefined();
  });

  describe('dropzone', () => {
    it('should render a file input that only accepts .xlsx', async () => {
      const Component = await getComponent();
      render(<Component />);
      const input = screen.getByTestId('bulk-import-dropzone-input');
      expect(input).toHaveAttribute('accept', '.xlsx');
    });

    it('should reject non-xlsx files at dropzone with message', async () => {
      const Component = await getComponent();
      render(<Component />);
      const input = screen.getByTestId('bulk-import-dropzone-input') as HTMLInputElement;

      // Create a fake .csv file
      const csvFile = new File(['name,email,role'], 'users.csv', { type: 'text/csv' });
      Object.defineProperty(input, 'files', { value: [csvFile], configurable: true });
      fireEvent.change(input);

      expect(screen.getByTestId('alert-banner')).toBeInTheDocument();
      expect(screen.getByTestId('alert-banner')).toHaveAttribute('data-variant', 'error');
    });

    it('should reject files exceeding 5MB', async () => {
      const Component = await getComponent();
      render(<Component />);
      const input = screen.getByTestId('bulk-import-dropzone-input') as HTMLInputElement;

      // Create a fake large file (6MB)
      const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'users.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      Object.defineProperty(input, 'files', { value: [largeFile], configurable: true });
      fireEvent.change(input);

      expect(screen.getByTestId('alert-banner')).toBeInTheDocument();
      expect(screen.getByTestId('alert-banner')).toHaveAttribute('data-variant', 'error');
    });

    it('should show row-limit rejection message after parsing', async () => {
      const { parseUsersXlsx } = await import('@/lib/bulk-import/parse-users');
      (parseUsersXlsx as any).mockResolvedValue({
        rows: [],
        errors: ['Maximum 500 rows allowed'],
      });

      const Component = await getComponent();
      render(<Component />);
      const input = screen.getByTestId('bulk-import-dropzone-input') as HTMLInputElement;

      // Create a valid xlsx file
      const xlsxFile = new File(['data'], 'users.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      Object.defineProperty(input, 'files', { value: [xlsxFile], configurable: true });
      fireEvent.change(input);

      // Wait for async processing
      await new Promise((r) => setTimeout(r, 10));

      expect(screen.getByTestId('alert-banner')).toBeInTheDocument();
      expect(screen.getByText(/bulkImport\.common\.validationErrors/)).toBeInTheDocument();
    });
  });

  describe('preview table', () => {
    it('should render parsed rows with per-row Valid/Invalid status', async () => {
      const { parseUsersXlsx } = await import('@/lib/bulk-import/parse-users');
      (parseUsersXlsx as any).mockResolvedValue({
        rows: [
          { name: 'Alice', email: 'alice@example.com', role: 'student', status: 'valid' },
          {
            name: 'Bob',
            email: 'invalid-email',
            role: 'student',
            status: 'invalid',
            error: 'Invalid email',
          },
        ],
        errors: ['Invalid email format'],
      });

      const Component = await getComponent();
      render(<Component />);
      const input = screen.getByTestId('bulk-import-dropzone-input') as HTMLInputElement;

      const xlsxFile = new File(['data'], 'users.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      Object.defineProperty(input, 'files', { value: [xlsxFile], configurable: true });
      fireEvent.change(input);

      await new Promise((r) => setTimeout(r, 10));

      // Should show preview table
      expect(screen.getByText('bulkImport.users.name')).toBeInTheDocument();
      expect(screen.getByText('bulkImport.users.email')).toBeInTheDocument();
      expect(screen.getByText('bulkImport.users.role')).toBeInTheDocument();
      expect(screen.getByText('bulkImport.common.status')).toBeInTheDocument();

      // Should show valid/invalid status
      expect(screen.getByTestId('row-status-0')).toHaveTextContent('bulkImport.common.valid');
      expect(screen.getByTestId('row-status-1')).toHaveTextContent('bulkImport.common.invalid');

      // Should show row data
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    it('should show valid/invalid counts', async () => {
      const { parseUsersXlsx } = await import('@/lib/bulk-import/parse-users');
      (parseUsersXlsx as any).mockResolvedValue({
        rows: [
          { name: 'Alice', email: 'alice@example.com', role: 'student', status: 'valid' },
          { name: 'Bob', email: 'bob@example.com', role: 'student', status: 'valid' },
          {
            name: 'Charlie',
            email: 'bad',
            role: 'student',
            status: 'invalid',
            error: 'Invalid email',
          },
        ],
        errors: ['Invalid email format'],
      });

      const Component = await getComponent();
      render(<Component />);
      const input = screen.getByTestId('bulk-import-dropzone-input') as HTMLInputElement;

      const xlsxFile = new File(['data'], 'users.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      Object.defineProperty(input, 'files', { value: [xlsxFile], configurable: true });
      fireEvent.change(input);

      await new Promise((r) => setTimeout(r, 10));

      expect(screen.getByText('2 valid')).toBeInTheDocument();
      expect(screen.getByText('1 invalid')).toBeInTheDocument();
    });
  });

  describe('commit', () => {
    it('should render import button after parsing valid rows', async () => {
      const { parseUsersXlsx } = await import('@/lib/bulk-import/parse-users');
      (parseUsersXlsx as any).mockResolvedValue({
        rows: [{ name: 'Alice', email: 'alice@example.com', role: 'student', status: 'valid' }],
        errors: [],
      });

      const Component = await getComponent();
      render(<Component />);
      const input = screen.getByTestId('bulk-import-dropzone-input') as HTMLInputElement;

      const xlsxFile = new File(['data'], 'users.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      Object.defineProperty(input, 'files', { value: [xlsxFile], configurable: true });
      fireEvent.change(input);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /bulkImport.users.importButton/ }),
        ).toBeInTheDocument();
      });
    });

    it('should disable import button when no valid rows', async () => {
      const { parseUsersXlsx } = await import('@/lib/bulk-import/parse-users');
      (parseUsersXlsx as any).mockResolvedValue({
        rows: [
          { name: '', email: 'bad', role: 'student', status: 'invalid', error: 'Name required' },
        ],
        errors: ['Name required'],
      });

      const Component = await getComponent();
      render(<Component />);
      const input = screen.getByTestId('bulk-import-dropzone-input') as HTMLInputElement;

      const xlsxFile = new File(['data'], 'users.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      Object.defineProperty(input, 'files', { value: [xlsxFile], configurable: true });
      fireEvent.change(input);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /bulkImport.users.importButton/ }),
        ).toBeDisabled();
      });
    });
  });

  describe('download sample', () => {
    it('should render download sample button', async () => {
      const Component = await getComponent();
      render(<Component />);

      expect(screen.getByText('bulkImport.common.downloadSample')).toBeInTheDocument();
    });
  });
});
