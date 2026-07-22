import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import { consultationKeys } from '@/lib/query-keys';
import { VerificationDialog } from '@/components/consultations/VerificationDialog';
import React from 'react';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('lucide-react', () => ({
  Loader2: (props: any) => <svg data-testid="loader2-icon" {...props} />,
}));

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'consultations.consultationDetail': 'Consultation Detail',
        'consultations.student': 'Student',
        'consultations.checkpoint': 'Checkpoint',
        'consultations.sessionType': 'Session Type',
        'consultations.date': 'Date',
        'consultations.externalConsultantName': 'External Consultant',
        'consultations.notes': 'Notes',
        'consultations.internal': 'Internal',
        'consultations.external': 'External',
        'consultations.verify': 'Verify',
        'consultations.reject': 'Reject',
        'consultations.confirmReject': 'Confirm Reject',
        'consultations.rejectReason': 'Reason for rejection',
        'consultations.rejectReasonPlaceholder': 'Enter rejection reason',
        'common.loading': 'Loading...',
        'common.cancel': 'Cancel',
        'consultations.verifySuccess': 'Consultation verified successfully',
        'consultations.rejectSuccess': 'Consultation rejected successfully',
      };
      return translations[key] || key;
    },
  }),
}));

vi.mock('@/server/consultations', () => ({
  getConsultationDetail: vi.fn(),
  verifyConsultation: vi.fn(),
  rejectConsultation: vi.fn(),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <div data-testid="dialog-title">{children}</div>,
  DialogFooter: ({ children }: any) => <div data-testid="dialog-footer">{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, type, ...props }: any) => (
    <button
      type={type || 'button'}
      onClick={onClick}
      disabled={disabled}
      data-testid="dialog-btn"
      data-variant={variant}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input data-testid="reject-input" {...props} />,
}));

describe('VerificationDialog', () => {
  const onOpenChange = vi.fn();
  const onActionComplete = vi.fn();

  const mockDetail = {
    id: 42,
    studentName: 'Alice Johnson',
    checkpointName: 'Proposal',
    sessionType: 'internal',
    externalConsultantName: null,
    notes: 'Discussed topic selection.',
    createdAt: '2026-05-20T10:00:00Z',
    status: 'pending',
  };

  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  function renderDialog(overrides: Partial<React.ComponentProps<typeof VerificationDialog>> = {}) {
    return render(
      <QueryClientProvider client={queryClient}>
        <VerificationDialog
          consultationId={42}
          open={true}
          onOpenChange={onOpenChange}
          onActionComplete={onActionComplete}
          {...overrides}
        />
      </QueryClientProvider>,
    );
  }

  const findBtn = (text: string) => {
    const b = screen.getAllByTestId('dialog-btn').find((b) => b.textContent === text);
    if (!b) throw new Error(`Button "${text}" not found`);
    return b;
  };

  async function resolveDetail(detail = mockDetail) {
    const mod = await import('@/server/consultations');
    (mod.getConsultationDetail as any).mockResolvedValue({ consultation: detail });
  }

  async function loadDetail() {
    await vi.waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeDefined();
    });
  }

  it('should show Loader2 spinner instead of plain loading text when loading detail', async () => {
    // Never resolves — keeps the dialog in loading state
    const mod = await import('@/server/consultations');
    (mod.getConsultationDetail as any).mockReturnValue(new Promise(() => {}));

    renderDialog();

    await vi.waitFor(() => {
      expect(screen.getAllByTestId('loader2-icon').length).toBeGreaterThan(0);
    });
  });

  it('should not render when closed', () => {
    renderDialog({ open: false, consultationId: null });
    expect(screen.queryByTestId('dialog')).toBeNull();
  });

  it('should render when open', async () => {
    await resolveDetail();
    renderDialog();
    expect(screen.getByTestId('dialog')).toBeDefined();
  });

  it('should render title', async () => {
    await resolveDetail();
    renderDialog();
    expect(screen.getByText('Consultation Detail')).toBeDefined();
  });

  it('should display consultation details after loading', async () => {
    await resolveDetail();
    renderDialog();
    await loadDetail();
    expect(screen.getByText('Proposal')).toBeDefined();
    expect(screen.getByText('Internal')).toBeDefined();
    expect(screen.getByText('Discussed topic selection.')).toBeDefined();
  });

  it('should show error when loading fails', async () => {
    const mod = await import('@/server/consultations');
    (mod.getConsultationDetail as any).mockResolvedValue({ error: 'Failed to load' });

    renderDialog();

    await vi.waitFor(() => {
      expect(screen.getByText('Failed to load')).toBeDefined();
    });
  });

  it('should show external consultant name for external sessions', async () => {
    const mod = await import('@/server/consultations');
    (mod.getConsultationDetail as any).mockResolvedValue({
      consultation: { ...mockDetail, sessionType: 'external', externalConsultantName: 'Dr. Smith' },
    });
    renderDialog();
    await loadDetail();
    expect(screen.getByText('Dr. Smith')).toBeDefined();
  });

  it('should render Verify and Reject buttons', async () => {
    await resolveDetail();
    renderDialog();
    await loadDetail();
    expect(findBtn('Verify')).toBeDefined();
    expect(findBtn('Reject')).toBeDefined();
  });

  it('should call verifyConsultation and onActionComplete on verify', async () => {
    await resolveDetail();
    const mod = await import('@/server/consultations');
    (mod.verifyConsultation as any).mockResolvedValue({ success: true });

    renderDialog();
    await loadDetail();
    fireEvent.click(findBtn('Verify'));

    await vi.waitFor(() => {
      expect(mod.verifyConsultation).toHaveBeenCalledOnce();
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onActionComplete).toHaveBeenCalledOnce();
  });

  it('should show error on verify failure', async () => {
    await resolveDetail();
    const mod = await import('@/server/consultations');
    (mod.verifyConsultation as any).mockResolvedValue({ error: 'Already verified' });

    renderDialog();
    await loadDetail();

    fireEvent.click(findBtn('Verify'));

    await vi.waitFor(() => {
      expect(screen.getByText('Already verified')).toBeDefined();
    });
    expect(onActionComplete).not.toHaveBeenCalled();
  });

  it('should show reject reason input when Reject is clicked', async () => {
    await resolveDetail();
    renderDialog();
    await loadDetail();

    fireEvent.click(findBtn('Reject'));

    expect(screen.getByTestId('reject-input')).toBeDefined();
    expect(screen.getByText('Confirm Reject')).toBeDefined();
    expect(screen.getByText('Cancel')).toBeDefined();
  });

  it('should toggle confirm reject disabled state based on reason', async () => {
    await resolveDetail();
    renderDialog();
    await loadDetail();
    fireEvent.click(findBtn('Reject'));
    expect(findBtn('Confirm Reject')).toHaveProperty('disabled', true);
    fireEvent.change(screen.getByTestId('reject-input'), { target: { value: 'x' } });
    expect(findBtn('Confirm Reject')).toHaveProperty('disabled', false);
  });

  it('should call rejectConsultation on confirm reject', async () => {
    await resolveDetail();
    const mod = await import('@/server/consultations');
    (mod.rejectConsultation as any).mockResolvedValue({ success: true });

    renderDialog();
    await loadDetail();

    fireEvent.click(findBtn('Reject'));

    const input = screen.getByTestId('reject-input');
    fireEvent.change(input, { target: { value: 'Insufficient detail' } });

    fireEvent.click(findBtn('Confirm Reject'));

    await vi.waitFor(() => {
      expect(mod.rejectConsultation).toHaveBeenCalledOnce();
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onActionComplete).toHaveBeenCalledOnce();
  });

  it('should show error on reject failure', async () => {
    await resolveDetail();
    const mod = await import('@/server/consultations');
    (mod.rejectConsultation as any).mockResolvedValue({ error: 'Already verified' });

    renderDialog();
    await loadDetail();

    fireEvent.click(findBtn('Reject'));

    const input = screen.getByTestId('reject-input');
    fireEvent.change(input, { target: { value: 'Insufficient detail' } });

    fireEvent.click(findBtn('Confirm Reject'));

    await vi.waitFor(() => {
      expect(screen.getByText('Already verified')).toBeDefined();
    });
    expect(onActionComplete).not.toHaveBeenCalled();
  });

  it('should return to verify/reject buttons when Cancel is clicked in reject mode', async () => {
    await resolveDetail();
    renderDialog();
    await loadDetail();

    fireEvent.click(findBtn('Reject'));
    expect(screen.getByTestId('reject-input')).toBeDefined();

    fireEvent.click(findBtn('Cancel'));

    expect(screen.queryByTestId('reject-input')).toBeNull();
    expect(findBtn('Verify')).toBeDefined();
    expect(findBtn('Reject')).toBeDefined();
  });

  it('should show error text when present', async () => {
    const mod = await import('@/server/consultations');
    (mod.getConsultationDetail as any).mockResolvedValue({ error: 'Consultation not found' });

    renderDialog({ consultationId: 999 });

    await vi.waitFor(() => {
      expect(screen.getByText('Consultation not found')).toBeDefined();
    });
  });

  it('should show success toast on verify', async () => {
    await resolveDetail();
    const mod = await import('@/server/consultations');
    (mod.verifyConsultation as any).mockResolvedValue({ success: true });

    renderDialog();
    await loadDetail();

    fireEvent.click(findBtn('Verify'));

    await vi.waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Consultation verified successfully');
    });
  });

  it('should show success toast on reject', async () => {
    await resolveDetail();
    const mod = await import('@/server/consultations');
    (mod.rejectConsultation as any).mockResolvedValue({ success: true });

    renderDialog();
    await loadDetail();

    fireEvent.click(findBtn('Reject'));

    const input = screen.getByTestId('reject-input');
    fireEvent.change(input, { target: { value: 'Insufficient detail' } });

    fireEvent.click(findBtn('Confirm Reject'));

    await vi.waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Consultation rejected successfully');
    });
  });

  it('should invalidate consultation query on successful verify', async () => {
    await resolveDetail();
    const mod = await import('@/server/consultations');
    (mod.verifyConsultation as any).mockResolvedValue({ success: true });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderDialog();
    await loadDetail();

    fireEvent.click(findBtn('Verify'));

    await vi.waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: consultationKeys.all() });
    });
  });

  it('should invalidate consultation query on successful reject', async () => {
    await resolveDetail();
    const mod = await import('@/server/consultations');
    (mod.rejectConsultation as any).mockResolvedValue({ success: true });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderDialog();
    await loadDetail();

    fireEvent.click(findBtn('Reject'));

    const input = screen.getByTestId('reject-input');
    fireEvent.change(input, { target: { value: 'Insufficient detail' } });

    fireEvent.click(findBtn('Confirm Reject'));

    await vi.waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: consultationKeys.all() });
    });
  });

  describe('optimistic updates', () => {
    const mk = (id: number) => ({
      id,
      studentName: 'A',
      checkpointName: 'C',
      sessionType: 'internal',
      externalConsultantName: null,
      notes: null,
      createdAt: '2026-01-01',
    });
    const seedData = { consultations: [mk(42), mk(43)], total: 2 };
    const clickVerify = () => fireEvent.click(findBtn('Verify'));
    const rejectWithReason = () => {
      fireEvent.click(findBtn('Reject'));
      fireEvent.change(screen.getByTestId('reject-input'), { target: { value: 'x' } });
      fireEvent.click(findBtn('Confirm Reject'));
    };
    const getCache = () => queryClient.getQueryData<any>(consultationKeys.pending(1, 1));

    it('should optimistically remove consultation on verify', async () => {
      await resolveDetail();
      const mod = await import('@/server/consultations');
      (mod.verifyConsultation as any).mockReturnValue(new Promise(() => {}));
      queryClient.setQueryData(consultationKeys.pending(1, 1), seedData);
      renderDialog();
      await loadDetail();
      clickVerify();
      await vi.waitFor(() => {
        expect(getCache()?.consultations).toHaveLength(1);
        expect(getCache()?.consultations[0].id).toBe(43);
        expect(getCache()?.total).toBe(1);
      });
    });

    it('should restore consultation list on verify error', async () => {
      await resolveDetail();
      const mod = await import('@/server/consultations');
      (mod.verifyConsultation as any).mockResolvedValue({ error: 'Already verified' });
      queryClient.setQueryData(consultationKeys.pending(1, 1), seedData);
      renderDialog();
      await loadDetail();
      clickVerify();
      await vi.waitFor(() => {
        expect(getCache()?.consultations).toHaveLength(2);
        expect(getCache()?.total).toBe(2);
      });
    });

    it('should show error toast on verify rollback', async () => {
      await resolveDetail();
      const mod = await import('@/server/consultations');
      (mod.verifyConsultation as any).mockResolvedValue({ error: 'Already verified' });
      renderDialog();
      await loadDetail();
      clickVerify();
      await vi.waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Already verified');
      });
    });

    it('should optimistically remove consultation on reject', async () => {
      await resolveDetail();
      const mod = await import('@/server/consultations');
      (mod.rejectConsultation as any).mockReturnValue(new Promise(() => {}));
      queryClient.setQueryData(consultationKeys.pending(1, 1), seedData);
      renderDialog();
      await loadDetail();
      rejectWithReason();
      await vi.waitFor(() => {
        expect(getCache()?.consultations).toHaveLength(1);
        expect(getCache()?.consultations[0].id).toBe(43);
        expect(getCache()?.total).toBe(1);
      });
    });

    it('should restore consultation list on reject error', async () => {
      await resolveDetail();
      const mod = await import('@/server/consultations');
      (mod.rejectConsultation as any).mockResolvedValue({ error: 'Already rejected' });
      queryClient.setQueryData(consultationKeys.pending(1, 1), seedData);
      renderDialog();
      await loadDetail();
      rejectWithReason();
      await vi.waitFor(() => {
        expect(getCache()?.consultations).toHaveLength(2);
        expect(getCache()?.total).toBe(2);
      });
    });

    it('should show error toast on reject rollback', async () => {
      await resolveDetail();
      const mod = await import('@/server/consultations');
      (mod.rejectConsultation as any).mockResolvedValue({ error: 'Already rejected' });
      renderDialog();
      await loadDetail();
      rejectWithReason();
      await vi.waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Already rejected');
      });
    });
  });
});
