/**
 * Hook for the assignment detail page: loads consultation + extension data
 * and exposes state + handlers for the tab subcomponents.
 */
import { useCallback, useEffect, useState } from 'react';
import { listPendingConsultations } from '@/server/consultations';
import { listExtensionRequests, approveExtension, rejectExtension } from '@/server/extensions';
import { parseServerError, showErrorToast } from '@/lib/toast';
import { useI18n } from '@/routes/__root';
import { isServerError } from '@/lib/errors';
import type { PendingConsultation } from '@/components/instructor/assignments/AssignmentConsultationsTab';
import type { ExtensionRequestItem } from '@/components/instructor/extensions/PendingExtensionsSection';

const listExtensionsFn = listExtensionRequests as unknown as (args: {
  data: { assignmentId: number; status: string; page: number; limit: number };
}) => Promise<{ items: ExtensionRequestItem[]; error?: { code: string; message: string } }>;

const approveFn = approveExtension as unknown as (args: {
  data: { requestId: number; resolutionReason?: string };
}) => Promise<{ error?: { code: string; message: string } }>;

const rejectFn = rejectExtension as unknown as (args: {
  data: { requestId: number; resolutionReason: string };
}) => Promise<{ error?: { code: string; message: string } }>;

export function useAssignmentTabs(assignmentId: number | null) {
  const { t } = useI18n();
  const [pendingConsultations, setPendingConsultations] = useState<PendingConsultation[]>([]);
  const [extensionRequests, setExtensionRequests] = useState<ExtensionRequestItem[]>([]);
  const [extensionsLoading, setExtensionsLoading] = useState(false);

  const refreshExtensions = useCallback(async () => {
    if (assignmentId == null) return;
    const extResult = await listExtensionsFn({
      data: { assignmentId, status: 'pending', page: 1, limit: 50 },
    });
    if ('items' in extResult) setExtensionRequests(extResult.items);
  }, [assignmentId]);

  useEffect(() => {
    if (assignmentId == null) return;
    const load = async () => {
      setExtensionsLoading(true);
      const [consultResult, extResult] = await Promise.all([
        listPendingConsultations({ data: { assignmentId } }),
        listExtensionsFn({ data: { assignmentId, status: 'pending', page: 1, limit: 50 } }),
      ]);
      if (!isServerError(consultResult) && consultResult.consultations) {
        setPendingConsultations(consultResult.consultations);
      }
      if ('items' in extResult) setExtensionRequests(extResult.items);
      setExtensionsLoading(false);
    };
    load();
  }, [assignmentId]);

  const handleApproveExtension = useCallback(
    async (requestId: number, comment?: string) => {
      const result = await approveFn({ data: { requestId, resolutionReason: comment } });
      if ('error' in result) {
        const parsed = parseServerError(result);
        showErrorToast(parsed.code, t);
        return;
      }
      await refreshExtensions();
    },
    [refreshExtensions, t],
  );

  const handleRejectExtension = useCallback(
    async (requestId: number, reason: string) => {
      const result = await rejectFn({ data: { requestId, resolutionReason: reason } });
      if ('error' in result) {
        const parsed = parseServerError(result);
        showErrorToast(parsed.code, t);
        return;
      }
      await refreshExtensions();
    },
    [refreshExtensions, t],
  );

  return {
    pendingConsultations,
    setPendingConsultations,
    extensionRequests,
    extensionsLoading,
    handleApproveExtension,
    handleRejectExtension,
  };
}
