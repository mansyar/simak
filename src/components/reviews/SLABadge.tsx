import { useI18n } from '../../routes/__root';
import { Badge } from '@/components/ui/badge';

interface SLABadgeProps {
  state: 'submitted' | 'under_review';
  updatedAt: Date;
}

const SLA_MS = 3 * 24 * 60 * 60 * 1000;
const APPROACHING_MS = 2 * 24 * 60 * 60 * 1000;

export function SLABadge({ state, updatedAt }: SLABadgeProps) {
  const { t } = useI18n();

  if (state === 'submitted') {
    return (
      <Badge variant="secondary" data-testid="sla-badge">
        {t('instructorReviews.slaNotReviewed')}
      </Badge>
    );
  }

  const elapsed = Date.now() - new Date(updatedAt).getTime();

  if (elapsed >= SLA_MS) {
    return (
      <Badge variant="destructive" data-testid="sla-badge">
        {t('instructorReviews.slaBreached')}
      </Badge>
    );
  }

  if (elapsed >= APPROACHING_MS) {
    return (
      <Badge
        variant="outline"
        className="border-amber-400 text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950"
        data-testid="sla-badge"
      >
        {t('instructorReviews.slaApproaching')}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="border-emerald-400 text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950"
      data-testid="sla-badge"
    >
      {t('instructorReviews.slaOnTime')}
    </Badge>
  );
}
