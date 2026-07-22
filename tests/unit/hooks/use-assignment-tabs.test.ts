/** @vitest-environment jsdom */
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { consultationKeys, extensionKeys } from '@/lib/query-keys';

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
  let queryClient: QueryClient;

  beforeEach(() => {
    mockListPendingConsultations.mockReset();
    mockListExtensionRequests.mockReset();
    mockApproveExtension.mockReset();
    mockRejectExtension.mockReset();
    mockShowSuccessToast.mockReset();
    mockShowErrorToast.mockReset();

    mockListPendingConsultations.mockResolvedValue({ consultations: [], total: 0 });
    mockListExtensionRequests.mockResolvedValue({ items: [] });
    mockApproveExtension.mockResolvedValue({});
    mockRejectExtension.mockResolvedValue({});

    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  function createWrapper() {
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
  }

  function renderHookWithWrapper<T>(fn: () => T) {
    return renderHook(fn, { wrapper: createWrapper() });
  }

  it('returns empty arrays and not loading when assignmentId is null', async () => {
    const { result } = renderHookWithWrapper(() => useAssignmentTabs(null));

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

    const { result } = renderHookWithWrapper(() => useAssignmentTabs(42));

    await waitFor(() => {
      expect(result.current.pendingConsultations).toEqual([fakeConsultation]);
      expect(result.current.extensionRequests).toEqual([fakeExtension]);
      expect(result.current.extensionsLoading).toBe(false);
    });

    expect(mockListPendingConsultations).toHaveBeenCalledWith({
      data: { assignmentId: 42, page: 1, limit: 20 },
    });
    expect(mockListExtensionRequests).toHaveBeenCalledWith({
      data: { assignmentId: 42, status: 'pending', page: 1, limit: 50 },
    });
  });

  it('handles listPendingConsultations returning no consultations key', async () => {
    mockListPendingConsultations.mockResolvedValue({});

    const { result } = renderHookWithWrapper(() => useAssignmentTabs(1));

    await waitFor(() => {
      expect(result.current.extensionsLoading).toBe(false);
    });
    expect(result.current.pendingConsultations).toEqual([]);
  });

  it('does not set extensionRequests when the response has no items key', async () => {
    mockListExtensionRequests.mockResolvedValue({
      error: { code: 'FORBIDDEN', message: 'Forbidden' },
    });

    const { result } = renderHookWithWrapper(() => useAssignmentTabs(1));

    await waitFor(() => {
      expect(result.current.extensionsLoading).toBe(false);
    });
    expect(result.current.extensionRequests).toEqual([]);
  });

  it('approveExtensionHandler calls the server and refreshes on success', async () => {
    mockListExtensionRequests
      .mockResolvedValueOnce({ items: [fakeExtension] })
      .mockResolvedValueOnce({ items: [] });

    const { result } = renderHookWithWrapper(() => useAssignmentTabs(1));

    await waitFor(() => {
      expect(result.current.extensionRequests).toEqual([fakeExtension]);
    });

    await act(async () => {
      result.current.handleApproveExtension(7, 'looks fine');
    });

    await waitFor(() => {
      expect(mockApproveExtension).toHaveBeenCalledWith({
        data: { requestId: 7, resolutionReason: 'looks fine' },
      });
      expect(result.current.extensionRequests).toEqual([]);
      expect(mockShowSuccessToast).toHaveBeenCalledWith('extensions.approveSuccess');
    });
  });

  it('approveExtensionHandler toasts server error and restores queue on error', async () => {
    mockApproveExtension.mockResolvedValue({ error: { code: 'FORBIDDEN', message: 'Forbidden' } });
    mockListExtensionRequests.mockResolvedValue({ items: [fakeExtension] });

    const { result } = renderHookWithWrapper(() => useAssignmentTabs(1));

    await waitFor(() => {
      expect(result.current.extensionRequests).toEqual([fakeExtension]);
    });

    await act(async () => {
      result.current.handleApproveExtension(7, 'approved');
    });

    await waitFor(() => {
      expect(mockApproveExtension).toHaveBeenCalledTimes(1);
      expect(mockShowErrorToast).toHaveBeenCalledWith('FORBIDDEN', expect.any(Function));
      expect(result.current.extensionRequests).toEqual([fakeExtension]);
    });
  });

  it('should optimistically remove the extension from the pending queue', async () => {
    mockListExtensionRequests.mockResolvedValue({ items: [fakeExtension] });
    mockApproveExtension.mockReturnValue(new Promise(() => {}));

    const { result } = renderHookWithWrapper(() => useAssignmentTabs(42));

    await waitFor(() => {
      expect(result.current.extensionRequests).toEqual([fakeExtension]);
    });

    await act(async () => {
      result.current.handleApproveExtension(7, 'looks fine');
    });

    const cache = queryClient.getQueryData<{ items: (typeof fakeExtension)[] }>(
      extensionKeys.pending(42),
    );
    expect(cache?.items).toEqual([]);
  });

  it('rejectExtensionHandler calls the server with the reason and refreshes on success', async () => {
    mockListExtensionRequests
      .mockResolvedValueOnce({ items: [fakeExtension] })
      .mockResolvedValueOnce({ items: [] });

    const { result } = renderHookWithWrapper(() => useAssignmentTabs(1));

    await waitFor(() => {
      expect(result.current.extensionRequests).toEqual([fakeExtension]);
    });

    await act(async () => {
      result.current.handleRejectExtension(7, 'reason is too short to accept');
    });

    await waitFor(() => {
      expect(mockRejectExtension).toHaveBeenCalledWith({
        data: { requestId: 7, resolutionReason: 'reason is too short to accept' },
      });
      expect(result.current.extensionRequests).toEqual([]);
      expect(mockShowSuccessToast).toHaveBeenCalledWith('extensions.rejectSuccess');
    });
  });

  it('rejectExtensionHandler toasts server error and restores queue on error', async () => {
    mockRejectExtension.mockResolvedValue({ error: { code: 'FORBIDDEN', message: 'Forbidden' } });
    mockListExtensionRequests.mockResolvedValue({ items: [fakeExtension] });

    const { result } = renderHookWithWrapper(() => useAssignmentTabs(1));

    await waitFor(() => {
      expect(result.current.extensionRequests).toEqual([fakeExtension]);
    });

    await act(async () => {
      result.current.handleRejectExtension(7, 'reason goes here');
    });

    await waitFor(() => {
      expect(mockRejectExtension).toHaveBeenCalledTimes(1);
      expect(mockShowErrorToast).toHaveBeenCalledWith('FORBIDDEN', expect.any(Function));
      expect(result.current.extensionRequests).toEqual([fakeExtension]);
    });
  });

  it('should optimistically remove the extension from the queue on reject', async () => {
    mockListExtensionRequests.mockResolvedValue({ items: [fakeExtension] });
    mockRejectExtension.mockReturnValue(new Promise(() => {}));

    const { result } = renderHookWithWrapper(() => useAssignmentTabs(42));

    await waitFor(() => {
      expect(result.current.extensionRequests).toEqual([fakeExtension]);
    });

    await act(async () => {
      result.current.handleRejectExtension(7, 'reason is too short');
    });

    const cache = queryClient.getQueryData<{ items: (typeof fakeExtension)[] }>(
      extensionKeys.pending(42),
    );
    expect(cache?.items).toEqual([]);
  });

  it('exposes setPendingConsultations for parent components to update the queue', async () => {
    const { result } = renderHookWithWrapper(() => useAssignmentTabs(1));

    await waitFor(() => {
      expect(result.current.extensionsLoading).toBe(false);
    });

    act(() => {
      result.current.setPendingConsultations([fakeConsultation]);
    });

    await waitFor(() => {
      expect(result.current.pendingConsultations).toEqual([fakeConsultation]);
    });
  });

  it('refreshExtensions does nothing when assignmentId is null', async () => {
    // We can't directly call refreshExtensions (it's internal), but we can verify
    // that an approve with null assignmentId does not trigger a list call beyond
    // the guard.
    mockListExtensionRequests.mockResolvedValue({ items: [] });

    const { result } = renderHookWithWrapper(() => useAssignmentTabs(null));

    // No fetches because assignmentId is null
    expect(mockListExtensionRequests).not.toHaveBeenCalled();

    // Setting state and calling the handler should be a no-op
    await act(async () => {
      result.current.handleApproveExtension(1, 'ok');
    });

    // Still no fetches — query is disabled and no invalidation triggers a refetch
    expect(mockListExtensionRequests).not.toHaveBeenCalled();
  });

  it('should register pending consultations query with consultationKeys', async () => {
    mockListPendingConsultations.mockResolvedValue({
      consultations: [fakeConsultation],
      total: 1,
    });

    renderHookWithWrapper(() => useAssignmentTabs(42));

    await waitFor(() => {
      const query = queryClient.getQueryCache().find({
        queryKey: consultationKeys.pending(42, 1),
      });
      expect(query).toBeDefined();
    });
  });

  it('should invalidate consultation query when refreshPendingConsultations is called', async () => {
    mockListPendingConsultations.mockResolvedValue({
      consultations: [fakeConsultation],
      total: 1,
    });

    const { result } = renderHookWithWrapper(() => useAssignmentTabs(42));

    await waitFor(() => {
      expect(result.current.pendingConsultations).toEqual([fakeConsultation]);
    });

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      await result.current.refreshPendingConsultations();
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: consultationKeys.all() });
  });

  it('should register extensions query with extensionKeys', async () => {
    mockListExtensionRequests.mockResolvedValue({ items: [fakeExtension] });

    renderHookWithWrapper(() => useAssignmentTabs(42));

    await waitFor(() => {
      const query = queryClient.getQueryCache().find({
        queryKey: extensionKeys.pending(42),
      });
      expect(query).toBeDefined();
    });
  });

  it('should invalidate extensions query on successful approve', async () => {
    mockListExtensionRequests.mockResolvedValue({ items: [fakeExtension] });
    mockApproveExtension.mockResolvedValue({});

    const { result } = renderHookWithWrapper(() => useAssignmentTabs(42));

    await waitFor(() => {
      expect(result.current.extensionRequests).toEqual([fakeExtension]);
    });

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      result.current.handleApproveExtension(7, 'looks fine');
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: extensionKeys.all() });
    });
  });

  it('should invalidate extensions query on successful reject', async () => {
    mockListExtensionRequests.mockResolvedValue({ items: [fakeExtension] });
    mockRejectExtension.mockResolvedValue({});

    const { result } = renderHookWithWrapper(() => useAssignmentTabs(42));

    await waitFor(() => {
      expect(result.current.extensionRequests).toEqual([fakeExtension]);
    });

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      result.current.handleRejectExtension(7, 'reason is too short to accept');
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: extensionKeys.all() });
    });
  });
});
