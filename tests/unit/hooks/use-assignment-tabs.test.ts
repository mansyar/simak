/** @vitest-environment jsdom */
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockListPendingConsultations = vi.fn();
const mockListExtensionRequests = vi.fn();
const mockApproveExtension = vi.fn();
const mockRejectExtension = vi.fn();
const mockShowErrorToast = vi.fn();
const mockShowSuccessToast = vi.fn();

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('@/lib/toast', () => ({
  parseServerError: (res: { error?: { code: string; message: string } }) =>
    res.error ? res.error : { code: 'UNKNOWN', message: '' },
  showErrorToast: (...args: unknown[]) => mockShowErrorToast(...args),
  showSuccessToast: (...args: unknown[]) => mockShowSuccessToast(...args),
}));

vi.mock('@/server/consultations', () => ({
  listPendingConsultations: (...args: unknown[]) => mockListPendingConsultations(...args),
}));

vi.mock('@/server/extensions', () => ({
  listExtensionRequests: (...args: unknown[]) => mockListExtensionRequests(...args),
  approveExtension: (...args: unknown[]) => mockApproveExtension(...args),
  rejectExtension: (...args: unknown[]) => mockRejectExtension(...args),
}));

import { useAssignmentTabs } from '@/hooks/use-assignment-tabs';

const fakeConsultation = {
  id: 1,
  studentName: 'Alice',
  checkpointName: 'CP1',
  sessionType: 'internal',
  externalConsultantName: null,
  notes: 'Discussed outline',
  createdAt: '2026-06-19T00:00:00.000Z',
};

const fakeExtension = {
  id: 7,
  studentId: 'student-1',
  studentName: 'Bob',
  category: 'personal',
  reason: 'Family emergency',
  extensionDays: 3,
  status: 'pending',
  createdAt: '2026-06-19T00:00:00.000Z',
};

describe('useAssignmentTabs', () => {
  beforeEach(() => {
    mockListPendingConsultations.mockReset();
    mockListExtensionRequests.mockReset();
    mockApproveExtension.mockReset();
    mockRejectExtension.mockReset();
    mockShowSuccessToast.mockReset();

    mockListPendingConsultations.mockResolvedValue({ consultations: [], total: 0 });
    mockListExtensionRequests.mockResolvedValue({ items: [] });
    mockApproveExtension.mockResolvedValue({});
    mockRejectExtension.mockResolvedValue({});
  });

  it('returns empty arrays and not loading when assignmentId is null', async () => {
    const { result } = renderHook(() => useAssignmentTabs(null));

    expect(result.current.pendingConsultations).toEqual([]);
    expect(result.current.extensionRequests).toEqual([]);
    expect(result.current.extensionsLoading).toBe(false);

    // No fetches should have been triggered
    expect(mockListPendingConsultations).not.toHaveBeenCalled();
    expect(mockListExtensionRequests).not.toHaveBeenCalled();
  });

  it('loads pending consultations and extensions on mount when assignmentId is provided', async () => {
    mockListPendingConsultations.mockResolvedValue({
      consultations: [fakeConsultation],
      total: 1,
    });
    mockListExtensionRequests.mockResolvedValue({ items: [fakeExtension] });

    const { result } = renderHook(() => useAssignmentTabs(42));

    await waitFor(() => {
      expect(result.current.pendingConsultations).toEqual([fakeConsultation]);
    });
    expect(result.current.extensionRequests).toEqual([fakeExtension]);
    expect(result.current.extensionsLoading).toBe(false);

    expect(mockListPendingConsultations).toHaveBeenCalledWith({
      data: { assignmentId: 42, page: 1, limit: 20 },
    });
    expect(mockListExtensionRequests).toHaveBeenCalledWith({
      data: { assignmentId: 42, status: 'pending', page: 1, limit: 50 },
    });
  });

  it('handles listPendingConsultations returning no consultations key', async () => {
    mockListPendingConsultations.mockResolvedValue({});

    const { result } = renderHook(() => useAssignmentTabs(1));

    await waitFor(() => {
      expect(result.current.extensionsLoading).toBe(false);
    });
    expect(result.current.pendingConsultations).toEqual([]);
  });

  it('does not set extensionRequests when the response has no items key', async () => {
    mockListExtensionRequests.mockResolvedValue({
      error: { code: 'FORBIDDEN', message: 'Forbidden' },
    });

    const { result } = renderHook(() => useAssignmentTabs(1));

    await waitFor(() => {
      expect(result.current.extensionsLoading).toBe(false);
    });
    expect(result.current.extensionRequests).toEqual([]);
  });

  it('approveExtensionHandler calls the server and refreshes on success', async () => {
    mockListExtensionRequests
      .mockResolvedValueOnce({ items: [fakeExtension] })
      .mockResolvedValueOnce({ items: [] });

    const { result } = renderHook(() => useAssignmentTabs(1));

    await waitFor(() => {
      expect(result.current.extensionRequests).toEqual([fakeExtension]);
    });

    await act(async () => {
      await result.current.handleApproveExtension(7, 'looks fine');
    });

    expect(mockApproveExtension).toHaveBeenCalledWith({
      data: { requestId: 7, resolutionReason: 'looks fine' },
    });
    await waitFor(() => {
      expect(result.current.extensionRequests).toEqual([]);
    });
    expect(mockShowSuccessToast).toHaveBeenCalledWith('extensions.approveSuccess');
  });

  it('approveExtensionHandler does not refresh and toasts server error', async () => {
    mockApproveExtension.mockResolvedValue({ error: { code: 'FORBIDDEN', message: 'Forbidden' } });
    mockListExtensionRequests.mockResolvedValue({ items: [fakeExtension] });

    const { result } = renderHook(() => useAssignmentTabs(1));

    await waitFor(() => {
      expect(result.current.extensionRequests).toEqual([fakeExtension]);
    });

    await act(async () => {
      await result.current.handleApproveExtension(7, 'approved');
    });

    expect(mockApproveExtension).toHaveBeenCalledTimes(1);
    // Only the initial mount fetch should have occurred — no second refresh
    expect(mockListExtensionRequests).toHaveBeenCalledTimes(1);
    expect(mockShowErrorToast).toHaveBeenCalledWith('FORBIDDEN', expect.any(Function));
  });

  it('rejectExtensionHandler calls the server with the reason and refreshes on success', async () => {
    mockListExtensionRequests
      .mockResolvedValueOnce({ items: [fakeExtension] })
      .mockResolvedValueOnce({ items: [] });

    const { result } = renderHook(() => useAssignmentTabs(1));

    await waitFor(() => {
      expect(result.current.extensionRequests).toEqual([fakeExtension]);
    });

    await act(async () => {
      await result.current.handleRejectExtension(7, 'reason is too short to accept');
    });

    expect(mockRejectExtension).toHaveBeenCalledWith({
      data: { requestId: 7, resolutionReason: 'reason is too short to accept' },
    });
    await waitFor(() => {
      expect(result.current.extensionRequests).toEqual([]);
    });
    expect(mockShowSuccessToast).toHaveBeenCalledWith('extensions.rejectSuccess');
  });

  it('rejectExtensionHandler does not refresh and toasts server error', async () => {
    mockRejectExtension.mockResolvedValue({ error: { code: 'FORBIDDEN', message: 'Forbidden' } });
    mockListExtensionRequests.mockResolvedValue({ items: [fakeExtension] });

    const { result } = renderHook(() => useAssignmentTabs(1));

    await waitFor(() => {
      expect(result.current.extensionRequests).toEqual([fakeExtension]);
    });

    await act(async () => {
      await result.current.handleRejectExtension(7, 'reason goes here');
    });

    expect(mockRejectExtension).toHaveBeenCalledTimes(1);
    expect(mockListExtensionRequests).toHaveBeenCalledTimes(1);
    expect(mockShowErrorToast).toHaveBeenCalledWith('FORBIDDEN', expect.any(Function));
  });

  it('exposes setPendingConsultations for parent components to update the queue', async () => {
    const { result } = renderHook(() => useAssignmentTabs(1));

    await waitFor(() => {
      expect(result.current.extensionsLoading).toBe(false);
    });

    act(() => {
      result.current.setPendingConsultations([fakeConsultation]);
    });

    expect(result.current.pendingConsultations).toEqual([fakeConsultation]);
  });

  it('refreshExtensions does nothing when assignmentId is null', async () => {
    // We can't directly call refreshExtensions (it's internal), but we can verify
    // that an approve with null assignmentId does not trigger a list call beyond
    // the guard.
    mockListExtensionRequests.mockResolvedValue({ items: [] });

    const { result } = renderHook(() => useAssignmentTabs(null));

    // No fetches because assignmentId is null
    expect(mockListExtensionRequests).not.toHaveBeenCalled();

    // Setting state and calling the handler should be a no-op
    await act(async () => {
      await result.current.handleApproveExtension(1, 'ok');
    });

    // Still no fetches
    expect(mockListExtensionRequests).not.toHaveBeenCalled();
  });
});
