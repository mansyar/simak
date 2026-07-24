/**
 * Notification route derivation map (TRACK-012).
 * Derives the navigation route from a notification's type + metadata.
 * Returns null if the route cannot be derived (missing metadata or unknown type).
 */

interface NotificationMetadata {
  assignmentId?: number | null;
  checkpointId?: number | null;
  submissionId?: number | null;
  [key: string]: unknown;
}

/**
 * Derive the navigation route for a notification based on its type and metadata.
 * Returns null if metadata is missing or the route cannot be derived.
 */
export function getNotificationRoute(
  type: string,
  metadata: Record<string, unknown> | null | undefined,
): string | null {
  if (!metadata) return null;

  // Safe assertion: metadata is jsonb from DB (Record<string, unknown>); narrowing to access typed fields
  const meta = metadata as NotificationMetadata;

  switch (type) {
    case 'review_completed':
    case 'revision_requested':
      if (meta.assignmentId != null && meta.checkpointId != null) {
        return `/student/assignments/${meta.assignmentId}/checkpoints/${meta.checkpointId}`;
      }
      return null;

    case 'submission_received':
      if (meta.submissionId != null) {
        return `/instructor/reviews/${meta.submissionId}`;
      }
      return null;

    case 'consultation_verified':
    case 'consultation_rejected':
      if (meta.assignmentId != null) {
        return `/student/assignments/${meta.assignmentId}`;
      }
      return null;

    case 'extension_requested':
      if (meta.assignmentId != null) {
        return `/instructor/assignments/${meta.assignmentId}`;
      }
      return null;

    case 'extension_approved':
    case 'extension_rejected':
      if (meta.assignmentId != null) {
        return `/student/assignments/${meta.assignmentId}`;
      }
      return null;

    case 'sla_breach':
      return '/admin/dashboard';

    case 'deadline_reminder':
      if (meta.assignmentId != null && meta.checkpointId != null) {
        return `/student/assignments/${meta.assignmentId}/checkpoints/${meta.checkpointId}`;
      }
      return null;

    case 'student_at_risk':
      if (meta.assignmentId != null) {
        return `/instructor/assignments/${meta.assignmentId}`;
      }
      return null;

    default:
      return null;
  }
}
