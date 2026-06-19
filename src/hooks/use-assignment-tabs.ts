/**
 * Hook for the assignment detail page: loads consultation + extension data
 * and exposes state + handlers for the tab subcomponents.
 */
import { useCallback, useEffect, useState } from 'react';
import { listPendingConsultations } from '@/server/consultations';
import { listExtensionRequests, approveExtension, rejectExtension } from '@/server/extensions';
import type { PendingConsultation } from '@/components/instructor/assignments/AssignmentConsultationsTab';
import type { ExtensionRequestItem } from '@/components/instructor/extensions/PendingExtensionsSection';

// as unknown as casts required: handler return types include Date | null
// fields that PendingConsultation/ExtensionRequestItem do not accept. This is
// a pre-existing data shape mismatch unrelated to the createServerFn typing fix.
const listPendingFn = listPendingConsultations as unknown as (args: {
  data: { assignmentId: number };
}) => Promise<{ consultations: PendingConsultation[] }>;

const listExtensionsFn = listExtensionRequests as unknown as (args: {
  data: { assignmentId: number; status: string; page: number; limit: number };
}) => Promise<{ items: ExtensionRequestItem[] }>;

const approveFn = approveExtension as unknown as (args: {
  data: { requestId: number; resolutionReason?: string };
}) => Promise<{ error?: string }>;

const rejectFn = rejectExtension as unknown as (args: {
  data: { requestId: number; resolutionReason: string };
}) => Promise<{ error?: string }>;

export function useAssignmentTabs(assignmentId: number | null) {
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
        listPendingFn({ data: { assignmentId } }),
        listExtensionsFn({ data: { assignmentId, status: 'pending', page: 1, limit: 50 } }),
      ]);
      if (consultResult.consultations) setPendingConsultations(consultResult.consultations);
      if ('items' in extResult) setExtensionRequests(extResult.items);
      setExtensionsLoading(false);
    };
    load();
  }, [assignmentId]);

  const handleApproveExtension = useCallback(
    async (requestId: number, comment?: string) => {
      const result = await approveFn({ data: { requestId, resolutionReason: comment } });
      if (!result.error) await refreshExtensions();
    },
    [refreshExtensions],
  );

  const handleRejectExtension = useCallback(
    async (requestId: number, reason: string) => {
      const result = await rejectFn({ data: { requestId, resolutionReason: reason } });
      if (!result.error) await refreshExtensions();
    },
    [refreshExtensions],
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
