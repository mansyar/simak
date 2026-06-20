type StatusDotVariant = 'verified' | 'inactive';
type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'secondary';

export interface ActionVisualProps {
  dotVariant: StatusDotVariant;
  badgeVariant: BadgeVariant;
}

export function getActionVisualProps(type: string): ActionVisualProps {
  if (
    type.includes('created') ||
    type.includes('passed') ||
    type.includes('verified') ||
    type.includes('unlocked')
  ) {
    return { dotVariant: 'verified', badgeVariant: 'success' };
  }
  if (type.includes('updated') || type.includes('extended')) {
    return { dotVariant: 'inactive', badgeVariant: 'warning' };
  }
  if (type.includes('deleted') || type.includes('rejected') || type.includes('revised')) {
    return { dotVariant: 'inactive', badgeVariant: 'error' };
  }
  return { dotVariant: 'inactive', badgeVariant: 'info' };
}
