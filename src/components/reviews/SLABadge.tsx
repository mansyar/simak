import { useEffect, useState } from 'react';
import { useI18n } from '../../routes/__root';
import { Badge } from '@/components/ui/badge';
import { formatRelativeTime } from '@/lib/format';

interface SLABadgeProps {
  state: 'submitted' | 'under_review';
  updatedAt: Date;
}

const SLA_MS = 3 * 24 * 60 * 60 * 1000;
const APPROACHING_MS = 2 * 24 * 60 * 60 * 1000;

export function SLABadge({ state, updatedAt }: SLABadgeProps) {
  const { t, locale } = useI18n();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const relativeTime = hydrated ? formatRelativeTime(updatedAt, locale) : undefined;

  if (state === 'submitted') {
    return (
      <Badge variant="secondary" data-testid="sla-badge" title={relativeTime}>
        {t('instructorReviews.slaNotReviewed')}
      </Badge>
    );
  }

  const elapsed = hydrated ? Date.now() - new Date(updatedAt).getTime() : 0;

  if (elapsed >= SLA_MS) {
    return (
      <Badge variant="destructive" data-testid="sla-badge" title={relativeTime}>
        {t('instructorReviews.slaBreached')}
      </Badge>
    );
  }

  if (elapsed >= APPROACHING_MS) {
    return (
      <Badge variant="warning" data-testid="sla-badge" title={relativeTime}>
        {t('instructorReviews.slaApproaching')}
      </Badge>
    );
  }

  return (
    <Badge variant="success" data-testid="sla-badge" title={relativeTime}>
      {t('instructorReviews.slaOnTime')}
    </Badge>
  );
}
