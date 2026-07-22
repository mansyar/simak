/**
 * Hook for the assignment detail page: loads consultation + extension data
 * and exposes state + handlers for the tab subcomponents.
 */
import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listPendingConsultations } from '@/server/consultations';
import { listExtensionRequests, approveExtension, rejectExtension } from '@/server/extensions';
import { parseServerError, showErrorToast, showSuccessToast } from '@/lib/toast';
import { useI18n } from '@/routes/__root';
import { isServerError } from '@/lib/errors';
import { consultationKeys, extensionKeys } from '@/lib/query-keys';
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
  const queryClient = useQueryClient();
  const [pendingPage, setPendingPage] = useState(1);

  const consultationsQuery = useQuery({
    queryKey: consultationKeys.pending(assignmentId ?? -1, pendingPage),
    queryFn: async () => {
      if (assignmentId == null) return { consultations: [] as PendingConsultation[], total: 0 };
      const result = await listPendingConsultations({
        data: { assignmentId, page: pendingPage, limit: 20 },
      });
      if (!isServerError(result) && result.consultations) {
        return { consultations: result.consultations, total: result.total };
      }
      return { consultations: [] as PendingConsultation[], total: 0 };
    },
    enabled: assignmentId != null,
  });

  const pendingConsultations = consultationsQuery.data?.consultations ?? [];
  const pendingTotal = consultationsQuery.data?.total ?? 0;

  const setPendingConsultations = useCallback(
    (consultations: PendingConsultation[]) => {
      queryClient.setQueryData(consultationKeys.pending(assignmentId ?? -1, pendingPage), {
        consultations,
        total: consultations.length,
      });
    },
    [queryClient, assignmentId, pendingPage],
  );

  const refreshPendingConsultations = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: consultationKeys.all() });
  }, [queryClient]);

  const extensionsQuery = useQuery({
    queryKey: extensionKeys.pending(assignmentId ?? -1),
    queryFn: async () => {
      if (assignmentId == null) return { items: [] as ExtensionRequestItem[] };
      const result = await listExtensionsFn({
        data: { assignmentId, status: 'pending', page: 1, limit: 50 },
      });
      if ('items' in result) return { items: result.items };
      return { items: [] as ExtensionRequestItem[] };
    },
    enabled: assignmentId != null,
  });

  const extensionRequests = extensionsQuery.data?.items ?? [];
  const extensionsLoading = extensionsQuery.isLoading;

  const approveMutation = useMutation({
    mutationFn: async (vars: { requestId: number; comment?: string }) => {
      const result = await approveFn({
        data: { requestId: vars.requestId, resolutionReason: vars.comment },
      });
      if ('error' in result) throw result;
      return result;
    },
    onMutate: async (vars: { requestId: number; comment?: string }) => {
      await queryClient.cancelQueries({ queryKey: extensionKeys.all() });
      const previousEntries = queryClient.getQueriesData({ queryKey: extensionKeys.all() });
      queryClient.setQueriesData({ queryKey: extensionKeys.all() }, (old: unknown) => {
        if (old && typeof old === 'object' && 'items' in old) {
          return {
            items: (old as { items: { id: number }[] }).items.filter(
              (i) => i.id !== vars.requestId,
            ),
          };
        }
        return old;
      });
      return { previousEntries };
    },
    onSuccess: () => {
      showSuccessToast(t('extensions.approveSuccess'));
    },
    onError: (error: unknown, _vars, context) => {
      if (context?.previousEntries) {
        for (const [queryKey, data] of context.previousEntries) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      const parsed = parseServerError(error);
      showErrorToast(parsed.code, t);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: extensionKeys.all() });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (vars: { requestId: number; reason: string }) => {
      const result = await rejectFn({
        data: { requestId: vars.requestId, resolutionReason: vars.reason },
      });
      if ('error' in result) throw result;
      return result;
    },
    onMutate: async (vars: { requestId: number; reason: string }) => {
      await queryClient.cancelQueries({ queryKey: extensionKeys.all() });
      const previousEntries = queryClient.getQueriesData({ queryKey: extensionKeys.all() });
      queryClient.setQueriesData({ queryKey: extensionKeys.all() }, (old: unknown) => {
        if (old && typeof old === 'object' && 'items' in old) {
          return {
            items: (old as { items: { id: number }[] }).items.filter(
              (i) => i.id !== vars.requestId,
            ),
          };
        }
        return old;
      });
      return { previousEntries };
    },
    onSuccess: () => {
      showSuccessToast(t('extensions.rejectSuccess'));
    },
    onError: (error: unknown, _vars, context) => {
      if (context?.previousEntries) {
        for (const [queryKey, data] of context.previousEntries) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      const parsed = parseServerError(error);
      showErrorToast(parsed.code, t);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: extensionKeys.all() });
    },
  });

  const handleApproveExtension = useCallback(
    async (requestId: number, comment?: string) => {
      approveMutation.mutate({ requestId, comment });
    },
    [approveMutation],
  );

  const handleRejectExtension = useCallback(
    async (requestId: number, reason: string) => {
      rejectMutation.mutate({ requestId, reason });
    },
    [rejectMutation],
  );

  return {
    pendingConsultations,
    setPendingConsultations,
    pendingPage,
    setPendingPage,
    pendingTotal,
    refreshPendingConsultations,
    extensionRequests,
    extensionsLoading,
    handleApproveExtension,
    handleRejectExtension,
  };
}
