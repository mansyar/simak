/** @vitest-environment jsdom */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCsvDownload } from '@/hooks/use-csv-download';

vi.mock('@/lib/download', () => ({
  downloadCsv: vi.fn(),
}));

vi.mock('@/lib/toast', () => ({
  showErrorToast: vi.fn(),
}));

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: 'en' }),
}));

import { downloadCsv } from '@/lib/download';
import { showErrorToast } from '@/lib/toast';

describe('useCsvDownload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return isExporting as false initially', () => {
    const { result } = renderHook(() => useCsvDownload());
    expect(result.current.isExporting).toBe(false);
  });

  it('should set isExporting to true while fetching', async () => {
    const { result } = renderHook(() => useCsvDownload());
    let resolveFetch!: (value: unknown) => void;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });

    act(() => {
      result.current.exportCsv(() => fetchPromise, 'test.csv');
    });

    expect(result.current.isExporting).toBe(true);

    await act(async () => {
      resolveFetch('csv,data\n1,2');
      await fetchPromise;
    });

    expect(result.current.isExporting).toBe(false);
  });

  it('should call downloadCsv with fetched CSV string and filename', async () => {
    const { result } = renderHook(() => useCsvDownload());
    const fetchCsv = vi.fn().mockResolvedValue('a,b\n1,2');

    await act(async () => {
      await result.current.exportCsv(fetchCsv, 'export.csv');
    });

    expect(downloadCsv).toHaveBeenCalledWith('a,b\n1,2', 'export.csv');
  });

  it('should not download when server returns error', async () => {
    const { result } = renderHook(() => useCsvDownload());
    const fetchCsv = vi
      .fn()
      .mockResolvedValue({ error: { code: 'INTERNAL', message: 'Server error' } });

    await act(async () => {
      await result.current.exportCsv(fetchCsv, 'test.csv');
    });

    expect(downloadCsv).not.toHaveBeenCalled();
    expect(showErrorToast).toHaveBeenCalledWith('INTERNAL', expect.any(Function));
  });

  it('should set isExporting to false on exception', async () => {
    const { result } = renderHook(() => useCsvDownload());
    const fetchCsv = vi.fn().mockRejectedValue(new Error('Network error'));

    await act(async () => {
      await result.current.exportCsv(fetchCsv, 'test.csv');
    });

    expect(result.current.isExporting).toBe(false);
    expect(showErrorToast).toHaveBeenCalledWith('INTERNAL', expect.any(Function));
  });

  it('should reset isExporting to false after successful download', async () => {
    const { result } = renderHook(() => useCsvDownload());
    const fetchCsv = vi.fn().mockResolvedValue('csv,data');

    await act(async () => {
      await result.current.exportCsv(fetchCsv, 'test.csv');
    });

    expect(result.current.isExporting).toBe(false);
    expect(downloadCsv).toHaveBeenCalledTimes(1);
  });
});
