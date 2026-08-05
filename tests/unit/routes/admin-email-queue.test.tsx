/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { ComponentType } from 'react';

const mockRouter = vi.hoisted(() => ({
  invalidate: vi.fn(),
}));

const mockData = vi.hoisted(() => ({
  entries: [] as Array<Record<string, unknown>>,
  total: 0,
  page: 1,
  limit: 20,
  summary: { pending: 0, sent: 0, failed: 0 },
}));

const mockSearch = vi.hoisted(() => ({
  page: 1,
  status: 'all' as string,
  search: '',
}));

const mockRetryEmail = vi.hoisted(() => vi.fn());
const mockTriggerR2Cleanup = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: vi.fn().mockReturnValue(new Headers()),
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    middleware: vi.fn().mockReturnThis(),
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
  createMiddleware: vi.fn().mockReturnValue({
    server: vi.fn().mockImplementation((fn) => fn),
  }),
}));

vi.mock('@tanstack/react-router', () => ({
  redirect: vi.fn().mockImplementation((opts) => {
    throw new Error(`REDIRECT: ${opts.to}`);
  }),
  createFileRoute: vi.fn().mockReturnValue((config: any) => ({
    ...config,
    useLoaderData: vi.fn().mockReturnValue(mockData),
    useSearch: vi.fn().mockReturnValue(mockSearch),
    useNavigate: vi.fn().mockReturnValue(vi.fn()),
  })),
  useRouter: vi.fn().mockReturnValue(mockRouter),
}));

vi.mock('@/server/email-queue', () => ({
  listEmailQueue: vi.fn(),
  retryEmail: mockRetryEmail,
}));

vi.mock('@/server/r2-cleanup', () => ({
  triggerR2Cleanup: mockTriggerR2Cleanup,
}));

vi.mock('@/routes/__root', () => ({
  useI18n: vi.fn().mockReturnValue({
    t: vi.fn().mockImplementation((key: string) => key),
    locale: 'en',
    setLocale: vi.fn(),
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/toast', () => ({
  showErrorToast: vi.fn(),
  parseServerError: vi.fn().mockReturnValue('INTERNAL'),
}));

async function getComponent(): Promise<ComponentType> {
  const mod = await import('@/routes/_authenticated/admin/email-queue');
  return (mod.Route as any).component ?? (mod.Route as any).Component;
}

describe('Admin Email Queue page', () => {
  beforeEach(() => {
    mockRouter.invalidate.mockClear();
    mockRetryEmail.mockClear();
    mockTriggerR2Cleanup.mockClear();
    mockData.entries = [];
    mockData.total = 0;
    mockData.page = 1;
    mockData.limit = 20;
    mockData.summary = { pending: 0, sent: 0, failed: 0 };
    delete (mockData as Record<string, unknown>).error;
    mockSearch.page = 1;
    mockSearch.status = 'all';
    mockSearch.search = '';
  });

  it('should export a route component', async () => {
    const mod = await import('@/routes/_authenticated/admin/email-queue');
    expect(mod).toBeDefined();
    expect(mod.Route).toBeDefined();
  });

  it('should use listEmailQueue server function', async () => {
    const { listEmailQueue } = await import('@/server/email-queue');
    expect(typeof listEmailQueue).toBe('function');
  });

  describe('render', () => {
    it('should render the page title via PageHeader', async () => {
      const Component = await getComponent();
      render(<Component />);
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveClass('font-display', 'text-3xl');
      expect(heading.textContent).toBe('adminEmailQueue.title');
    });

    it('should render the page subtitle', async () => {
      const Component = await getComponent();
      render(<Component />);
      expect(screen.getByText('adminEmailQueue.subtitle')).toBeInTheDocument();
    });

    it('should render a refresh button that calls router.invalidate on click', async () => {
      const Component = await getComponent();
      render(<Component />);
      const refreshButton = screen.getByRole('button', { name: 'common.refresh' });
      mockRouter.invalidate.mockClear();
      fireEvent.click(refreshButton);
      expect(mockRouter.invalidate).toHaveBeenCalledTimes(1);
    });

    it('should show a retryable error state instead of an empty email queue', async () => {
      (mockData as Record<string, unknown>).error = {
        code: 'INTERNAL',
        message: 'queue details',
      };
      const Component = await getComponent();
      render(<Component />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('error.internal')).toBeInTheDocument();
      expect(screen.queryByText('queue details')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'common.refresh' }));
      expect(mockRouter.invalidate).toHaveBeenCalledTimes(1);
    });

    it('should render summary stat row with pending/sent/failed counts', async () => {
      mockData.summary = { pending: 5, sent: 10, failed: 3 };
      const Component = await getComponent();
      render(<Component />);
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('adminEmailQueue.summary.pending')).toBeInTheDocument();
      expect(screen.getByText('adminEmailQueue.summary.sent')).toBeInTheDocument();
      expect(screen.getByText('adminEmailQueue.summary.failed')).toBeInTheDocument();
    });

    it('should render table with rows from listEmailQueue', async () => {
      mockData.entries = [
        {
          id: 1,
          recipientEmail: 'user@example.com',
          subject: 'Password Reset',
          templateType: 'password_reset',
          status: 'sent',
          attempts: 1,
          lastAttemptAt: null,
          errorMessage: null,
          resendMessageId: 'resend-msg-001',
          createdAt: null,
        },
        {
          id: 2,
          recipientEmail: 'failed@example.com',
          subject: 'Invitation',
          templateType: 'invitation',
          status: 'failed',
          attempts: 3,
          lastAttemptAt: null,
          errorMessage: 'SMTP timeout',
          resendMessageId: null,
          createdAt: null,
        },
      ];
      mockData.total = 2;
      const Component = await getComponent();
      render(<Component />);
      expect(screen.getByText('user@example.com')).toBeInTheDocument();
      expect(screen.getByText('failed@example.com')).toBeInTheDocument();
      expect(screen.getByText('Password Reset')).toBeInTheDocument();
      expect(screen.getByText('Invitation')).toBeInTheDocument();
    });

    it('should render resendMessageId column header', async () => {
      const Component = await getComponent();
      render(<Component />);
      expect(screen.getByText('adminEmailQueue.table.resendMessageId')).toBeInTheDocument();
    });

    it('should render resendMessageId cell with monospace font, truncation, and title tooltip', async () => {
      mockData.entries = [
        {
          id: 1,
          recipientEmail: 'user@example.com',
          subject: 'Password Reset',
          templateType: 'password_reset',
          status: 'sent',
          attempts: 1,
          lastAttemptAt: null,
          errorMessage: null,
          resendMessageId: 'resend-msg-abc-123',
          createdAt: null,
        },
      ];
      mockData.total = 1;
      const Component = await getComponent();
      const { container } = render(<Component />);
      const resendCell = Array.from(container.querySelectorAll('td')).find(
        (td) => td.textContent === 'resend-msg-abc-123',
      );
      expect(resendCell).toBeTruthy();
      expect(resendCell!.className).toContain('font-mono');
      expect(resendCell!.className).toContain('truncate');
      expect(resendCell!.getAttribute('title')).toBe('resend-msg-abc-123');
    });

    it('should render dash when resendMessageId is null', async () => {
      mockData.entries = [
        {
          id: 2,
          recipientEmail: 'failed@example.com',
          subject: 'Failed Email',
          templateType: 'invitation',
          status: 'failed',
          attempts: 3,
          lastAttemptAt: null,
          errorMessage: 'SMTP timeout',
          resendMessageId: null,
          createdAt: null,
        },
      ];
      mockData.total = 1;
      const Component = await getComponent();
      render(<Component />);
      // The resendMessageId column for a null entry should show '-'
      const cells = screen.getAllByText('-');
      expect(cells.length).toBeGreaterThan(0);
    });

    it('should render Retry button only for failed rows', async () => {
      mockData.entries = [
        {
          id: 1,
          recipientEmail: 'sent@example.com',
          subject: 'Sent Email',
          templateType: 'password_reset',
          status: 'sent',
          attempts: 1,
          lastAttemptAt: null,
          errorMessage: null,
          createdAt: null,
        },
        {
          id: 2,
          recipientEmail: 'failed@example.com',
          subject: 'Failed Email',
          templateType: 'invitation',
          status: 'failed',
          attempts: 3,
          lastAttemptAt: null,
          errorMessage: 'SMTP timeout',
          createdAt: null,
        },
      ];
      const Component = await getComponent();
      render(<Component />);
      const retryButtons = screen.getAllByRole('button', { name: 'adminEmailQueue.retry' });
      expect(retryButtons).toHaveLength(1);
    });

    it('should open confirmation dialog when Retry is clicked', async () => {
      mockData.entries = [
        {
          id: 5,
          recipientEmail: 'failed@example.com',
          subject: 'Failed Email',
          templateType: 'invitation',
          status: 'failed',
          attempts: 3,
          lastAttemptAt: null,
          errorMessage: 'SMTP timeout',
          createdAt: null,
        },
      ];
      const Component = await getComponent();
      render(<Component />);
      expect(screen.queryByText('adminEmailQueue.retryConfirmTitle')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'adminEmailQueue.retry' }));
      expect(screen.getByText('adminEmailQueue.retryConfirmTitle')).toBeInTheDocument();
      expect(screen.getByText('adminEmailQueue.retryConfirmDescription')).toBeInTheDocument();
    });

    it('should call retryEmail and refetch when confirmation is confirmed', async () => {
      mockData.entries = [
        {
          id: 5,
          recipientEmail: 'failed@example.com',
          subject: 'Failed Email',
          templateType: 'invitation',
          status: 'failed',
          attempts: 3,
          lastAttemptAt: null,
          errorMessage: 'SMTP timeout',
          createdAt: null,
        },
      ];
      mockRetryEmail.mockResolvedValueOnce({ success: true, emailId: 5 });
      const { toast } = await import('sonner');
      const Component = await getComponent();
      render(<Component />);
      fireEvent.click(screen.getByRole('button', { name: 'adminEmailQueue.retry' }));
      const confirmButtons = screen.getAllByRole('button', { name: 'adminEmailQueue.retry' });
      fireEvent.click(confirmButtons[confirmButtons.length - 1]);
      await waitFor(() => {
        expect(mockRetryEmail).toHaveBeenCalledWith({ data: { emailId: 5 } });
      });
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('adminEmailQueue.retrySuccess');
      });
      await waitFor(() => {
        expect(mockRouter.invalidate).toHaveBeenCalled();
      });
    });

    it('should render status filter Select with all status options', async () => {
      const Component = await getComponent();
      const { container } = render(<Component />);
      const selectTrigger = container.querySelector('[data-slot="select-trigger"]');
      expect(selectTrigger).toBeTruthy();
    });

    it('should render search input', async () => {
      const Component = await getComponent();
      render(<Component />);
      expect(
        screen.getByRole('textbox', { name: 'adminEmailQueue.searchLabel' }),
      ).toBeInTheDocument();
    });

    it('should expose a caption and mobile-safe email rows', async () => {
      mockData.entries = [
        {
          id: 1,
          recipientEmail: 'user@example.com',
          subject: 'Password Reset',
          templateType: 'password_reset',
          status: 'sent',
          attempts: 1,
          lastAttemptAt: null,
          errorMessage: null,
          resendMessageId: null,
          createdAt: null,
        },
      ];
      const Component = await getComponent();
      const { container } = render(<Component />);
      const table = container.querySelector('table');
      expect(table?.querySelector('caption')?.textContent).toContain(
        'adminEmailQueue.table.caption',
      );
      expect(
        Array.from(table?.querySelectorAll('th') ?? []).every((head) => head.scope === 'col'),
      ).toBe(true);
      expect(table?.className).toMatch(/block/);
      expect(table?.querySelector('tbody tr')?.className).toMatch(/md:table-row/);
    });

    it('should render empty state when no entries', async () => {
      const Component = await getComponent();
      render(<Component />);
      expect(screen.getByText('adminEmailQueue.empty')).toBeInTheDocument();
    });

    it('should render filtered empty state when search/filter yields no results', async () => {
      mockSearch.search = 'nonexistent';
      mockData.entries = [];
      const Component = await getComponent();
      render(<Component />);
      expect(screen.getByText('adminEmailQueue.emptyFiltered')).toBeInTheDocument();
    });

    it('should wrap the table in a Card primitive', async () => {
      const Component = await getComponent();
      const { container } = render(<Component />);
      const allCards = container.querySelectorAll('[data-slot]');
      const cardElements = Array.from(allCards).filter(
        (el) => el.getAttribute('data-slot') === 'card',
      );
      expect(cardElements.length).toBeGreaterThan(0);
      const tableCard = cardElements.find((el) => el.querySelector('table'));
      expect(tableCard).toBeTruthy();
    });

    it('should render Trigger R2 Cleanup button', async () => {
      const Component = await getComponent();
      render(<Component />);
      expect(
        screen.getByRole('button', { name: 'adminEmailQueue.r2Cleanup.trigger' }),
      ).toBeInTheDocument();
    });

    it('should call triggerR2Cleanup and show success toast on click', async () => {
      mockTriggerR2Cleanup.mockResolvedValueOnce({ deleted: 3, failed: 1, batchSize: 4 });
      const { toast } = await import('sonner');
      const Component = await getComponent();
      render(<Component />);
      fireEvent.click(screen.getByRole('button', { name: 'adminEmailQueue.r2Cleanup.trigger' }));
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'adminEmailQueue.r2Cleanup.confirm' }));
      await waitFor(() => {
        expect(mockTriggerR2Cleanup).toHaveBeenCalledWith({ data: {} });
      });
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('adminEmailQueue.r2Cleanup.success');
      });
    });

    it('should keep cleanup confirmation open when cleanup fails', async () => {
      mockTriggerR2Cleanup.mockResolvedValueOnce({
        error: { code: 'INTERNAL', message: 'private cleanup details' },
      });
      const Component = await getComponent();
      render(<Component />);
      fireEvent.click(screen.getByRole('button', { name: 'adminEmailQueue.r2Cleanup.trigger' }));
      fireEvent.click(screen.getByRole('button', { name: 'adminEmailQueue.r2Cleanup.confirm' }));
      await waitFor(() => expect(mockTriggerR2Cleanup).toHaveBeenCalled());
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      expect(screen.queryByText('private cleanup details')).not.toBeInTheDocument();
    });
  });
});
