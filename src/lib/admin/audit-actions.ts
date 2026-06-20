type StatusDotVariant = 'verified' | 'inactive';
type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'secondary';

export interface ActionVisualProps {
  dotVariant: StatusDotVariant;
  badgeVariant: BadgeVariant;
}

export const ACTION_TYPES = [
  { value: 'user.created', label: 'adminAuditLog.actionLabels.userCreated' },
  { value: 'user.deleted', label: 'adminAuditLog.actionLabels.userDeleted' },
  { value: 'template.created', label: 'adminAuditLog.actionLabels.templateCreated' },
  { value: 'template.updated', label: 'adminAuditLog.actionLabels.templateUpdated' },
  { value: 'template.deleted', label: 'adminAuditLog.actionLabels.templateDeleted' },
  { value: 'assignment.created', label: 'adminAuditLog.actionLabels.assignmentCreated' },
  { value: 'review.passed', label: 'adminAuditLog.actionLabels.reviewPassed' },
  { value: 'review.revised', label: 'adminAuditLog.actionLabels.reviewRevised' },
  { value: 'checkpoint.unlocked', label: 'adminAuditLog.actionLabels.checkpointUnlocked' },
  { value: 'deadline.extended', label: 'adminAuditLog.actionLabels.deadlineExtended' },
  { value: 'consultation.verified', label: 'adminAuditLog.actionLabels.consultationVerified' },
  { value: 'consultation.rejected', label: 'adminAuditLog.actionLabels.consultationRejected' },
  { value: 'extension.approved', label: 'adminAuditLog.actionLabels.extensionApproved' },
  { value: 'extension.rejected', label: 'adminAuditLog.actionLabels.extensionRejected' },
] as const;

export function getActionVisualProps(type: string): ActionVisualProps {
  if (
    type.includes('created') ||
    type.includes('passed') ||
    type.includes('verified') ||
    type.includes('unlocked')
  ) {
    return { dotVariant: 'verified', badgeVariant: 'success' };
  }
  if (type.includes('updated') || type.includes('extended') || type.includes('approved')) {
    return { dotVariant: 'inactive', badgeVariant: 'warning' };
  }
  if (type.includes('deleted') || type.includes('rejected') || type.includes('revised')) {
    return { dotVariant: 'inactive', badgeVariant: 'error' };
  }
  return { dotVariant: 'inactive', badgeVariant: 'info' };
}
