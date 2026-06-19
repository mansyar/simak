import { jsx as _jsx } from 'react/jsx-runtime';
import { useI18n } from '../../routes/__root';
import { Badge } from '@/components/ui/badge';
const SLA_MS = 3 * 24 * 60 * 60 * 1000;
const APPROACHING_MS = 2 * 24 * 60 * 60 * 1000;
export function SLABadge({ state, updatedAt }) {
  const { t } = useI18n();
  if (state === 'submitted') {
    return _jsx(Badge, {
      variant: 'secondary',
      'data-testid': 'sla-badge',
      children: t('instructorReviews.slaNotReviewed'),
    });
  }
  const elapsed = Date.now() - new Date(updatedAt).getTime();
  if (elapsed >= SLA_MS) {
    return _jsx(Badge, {
      variant: 'destructive',
      'data-testid': 'sla-badge',
      children: t('instructorReviews.slaBreached'),
    });
  }
  if (elapsed >= APPROACHING_MS) {
    return _jsx(Badge, {
      variant: 'warning',
      'data-testid': 'sla-badge',
      children: t('instructorReviews.slaApproaching'),
    });
  }
  return _jsx(Badge, {
    variant: 'success',
    'data-testid': 'sla-badge',
    children: t('instructorReviews.slaOnTime'),
  });
}
