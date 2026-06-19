import { PendingExtensionsSection } from '@/components/instructor/extensions/PendingExtensionsSection';
import type { ExtensionRequestItem } from '@/components/instructor/extensions/PendingExtensionsSection';

interface AssignmentExtensionsTabProps {
  requests: ExtensionRequestItem[];
  loading: boolean;
  onApprove: (requestId: number, comment?: string) => Promise<void>;
  onReject: (requestId: number, reason: string) => Promise<void>;
}

export function AssignmentExtensionsTab({
  requests,
  loading,
  onApprove,
  onReject,
}: AssignmentExtensionsTabProps) {
  return (
    <PendingExtensionsSection
      requests={requests}
      loading={loading}
      onApprove={onApprove}
      onReject={onReject}
    />
  );
}
