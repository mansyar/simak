import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VerificationDialog } from '@/components/consultations/VerificationDialog';

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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderDialog(overrides: Partial<React.ComponentProps<typeof VerificationDialog>> = {}) {
    return render(
      <VerificationDialog
        consultationId={42}
        open={true}
        onOpenChange={onOpenChange}
        onActionComplete={onActionComplete}
        {...overrides}
      />,
    );
  }

  async function resolveDetail(detail = mockDetail) {
    const mod = await import('@/server/consultations');
    (mod.getConsultationDetail as any).mockResolvedValue({ consultation: detail });
  }

  async function loadDetail() {
    await vi.waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeDefined();
    });
  }

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

    const allBtns = screen.getAllByTestId('dialog-btn');
    expect(allBtns.find((b) => b.textContent === 'Verify')).toBeDefined();
    expect(allBtns.find((b) => b.textContent === 'Reject')).toBeDefined();
  });

  it('should call verifyConsultation and onActionComplete on verify', async () => {
    await resolveDetail();
    const mod = await import('@/server/consultations');
    (mod.verifyConsultation as any).mockResolvedValue({ success: true });

    renderDialog();
    await loadDetail();

    const verifyBtn = screen.getAllByTestId('dialog-btn').find((b) => b.textContent === 'Verify');
    fireEvent.click(verifyBtn!);

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

    const verifyBtn = screen.getAllByTestId('dialog-btn').find((b) => b.textContent === 'Verify');
    fireEvent.click(verifyBtn!);

    await vi.waitFor(() => {
      expect(screen.getByText('Already verified')).toBeDefined();
    });
    expect(onActionComplete).not.toHaveBeenCalled();
  });

  it('should show reject reason input when Reject is clicked', async () => {
    await resolveDetail();
    renderDialog();
    await loadDetail();

    const rejectBtn = screen.getAllByTestId('dialog-btn').find((b) => b.textContent === 'Reject');
    fireEvent.click(rejectBtn!);

    expect(screen.getByTestId('reject-input')).toBeDefined();
    expect(screen.getByText('Confirm Reject')).toBeDefined();
    expect(screen.getByText('Cancel')).toBeDefined();
  });

  it('should disable confirm reject when no reason entered', async () => {
    await resolveDetail();
    renderDialog();
    await loadDetail();

    const rejectBtn = screen.getAllByTestId('dialog-btn').find((b) => b.textContent === 'Reject');
    fireEvent.click(rejectBtn!);

    const confirmBtn = screen
      .getAllByTestId('dialog-btn')
      .find((b) => b.textContent === 'Confirm Reject');
    expect(confirmBtn).toHaveProperty('disabled', true);
  });

  it('should enable confirm reject when reason is entered', async () => {
    await resolveDetail();
    renderDialog();
    await loadDetail();

    const rejectBtn = screen.getAllByTestId('dialog-btn').find((b) => b.textContent === 'Reject');
    fireEvent.click(rejectBtn!);

    const input = screen.getByTestId('reject-input');
    fireEvent.change(input, { target: { value: 'Insufficient detail' } });

    const confirmBtn = screen
      .getAllByTestId('dialog-btn')
      .find((b) => b.textContent === 'Confirm Reject');
    expect(confirmBtn).toHaveProperty('disabled', false);
  });

  it('should call rejectConsultation on confirm reject', async () => {
    await resolveDetail();
    const mod = await import('@/server/consultations');
    (mod.rejectConsultation as any).mockResolvedValue({ success: true });

    renderDialog();
    await loadDetail();

    const rejectBtn = screen.getAllByTestId('dialog-btn').find((b) => b.textContent === 'Reject');
    fireEvent.click(rejectBtn!);

    const input = screen.getByTestId('reject-input');
    fireEvent.change(input, { target: { value: 'Insufficient detail' } });

    const confirmBtn = screen
      .getAllByTestId('dialog-btn')
      .find((b) => b.textContent === 'Confirm Reject');
    fireEvent.click(confirmBtn!);

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

    const rejectBtn = screen.getAllByTestId('dialog-btn').find((b) => b.textContent === 'Reject');
    fireEvent.click(rejectBtn!);

    const input = screen.getByTestId('reject-input');
    fireEvent.change(input, { target: { value: 'Insufficient detail' } });

    const confirmBtn = screen
      .getAllByTestId('dialog-btn')
      .find((b) => b.textContent === 'Confirm Reject');
    fireEvent.click(confirmBtn!);

    await vi.waitFor(() => {
      expect(screen.getByText('Already verified')).toBeDefined();
    });
    expect(onActionComplete).not.toHaveBeenCalled();
  });

  it('should return to verify/reject buttons when Cancel is clicked in reject mode', async () => {
    await resolveDetail();
    renderDialog();
    await loadDetail();

    const rejectBtn = screen.getAllByTestId('dialog-btn').find((b) => b.textContent === 'Reject');
    fireEvent.click(rejectBtn!);
    expect(screen.getByTestId('reject-input')).toBeDefined();

    const cancelBtn = screen.getAllByTestId('dialog-btn').find((b) => b.textContent === 'Cancel');
    fireEvent.click(cancelBtn!);

    expect(screen.queryByTestId('reject-input')).toBeNull();
    expect(
      screen.getAllByTestId('dialog-btn').find((b) => b.textContent === 'Verify'),
    ).toBeDefined();
    expect(
      screen.getAllByTestId('dialog-btn').find((b) => b.textContent === 'Reject'),
    ).toBeDefined();
  });

  it('should show error text when present', async () => {
    const mod = await import('@/server/consultations');
    (mod.getConsultationDetail as any).mockResolvedValue({ error: 'Consultation not found' });

    renderDialog({ consultationId: 999 });

    await vi.waitFor(() => {
      expect(screen.getByText('Consultation not found')).toBeDefined();
    });
  });
});
