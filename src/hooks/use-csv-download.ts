import { useState, useCallback } from 'react';
import { downloadCsv } from '@/lib/download';
import { isServerError } from '@/lib/errors';
import { showErrorToast } from '@/lib/toast';
import { useI18n } from '@/routes/__root';

/**
 * Hook for CSV export with loading state.
 * Wraps an async fetch function, checks for server errors,
 * and delegates the actual download to downloadCsv.
 */
export function useCsvDownload() {
  const [isExporting, setIsExporting] = useState(false);
  const { t } = useI18n();

  const exportCsv = useCallback(
    async (fetchCsv: () => Promise<unknown>, filename: string) => {
      setIsExporting(true);
      try {
        const result = await fetchCsv();
        if (isServerError(result)) {
          showErrorToast(result.error.code, t);
          return;
        }
        downloadCsv(result as string, filename);
      } catch {
        showErrorToast('INTERNAL', t);
      } finally {
        setIsExporting(false);
      }
    },
    [t],
  );

  return { exportCsv, isExporting };
}
