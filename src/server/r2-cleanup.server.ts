// Server-only handlers (not imported by client code)
import { getSessionFromHeaders } from './auth';
import { serverError, ErrorCode, type ServerError } from '../lib/errors';
import { processOrphanedR2Objects } from '@/lib/r2-cleanup';
import { safeAuditLog } from '@/lib/audit';
import type { TriggerR2CleanupInput, R2CleanupSummary } from './r2-cleanup';

// Re-export shared types for callers that historically imported them from here
export type { R2CleanupSummary } from './r2-cleanup';

// ---- Admin Role Check ----

const ADMIN_ROLES = ['superadmin', 'admin'] as const;

function isAdminRole(role: string): role is (typeof ADMIN_ROLES)[number] {
  return (ADMIN_ROLES as readonly string[]).includes(role);
}

// ---- triggerR2CleanupHandler ----

export async function triggerR2CleanupHandler(_args: {
  data: TriggerR2CleanupInput;
}): Promise<R2CleanupSummary | ServerError> {
  const session = await getSessionFromHeaders();
  if (!session || !isAdminRole(session.user.role)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  try {
    const summary = await processOrphanedR2Objects();

    await safeAuditLog('r2-cleanup', {
      actorId: session.user.id,
      action: 'r2.cleanup',
      entityType: 'upload_intent',
      entityId: 'batch',
      details: summary,
    });

    return summary;
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'triggerR2CleanupHandler',
    });
  }
}
