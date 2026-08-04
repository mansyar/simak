import { useI18n } from '../../routes/__root';
import type { TranslationKey } from '../../i18n/index';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, RefreshCcw, Clock, User, MessageSquare } from 'lucide-react';
import { useStudentDateFormatter } from '@/hooks/use-student-date';

interface ReviewData {
  decision: 'pass' | 'revise';
  comment?: string | null;
  reviewerName?: string | null;
  revisionDeadline?: Date | string | null;
  reviewedAt?: Date | string | null;
}

interface SubmissionStatusProps {
  review: ReviewData | null;
}

const statusConfig = {
  pass: {
    badgeVariant: 'success' as const,
    icon: CheckCircle2,
    iconClass: 'text-green-500',
    labelKey: 'files.review.passed',
  },
  revise: {
    badgeVariant: 'destructive' as const,
    icon: RefreshCcw,
    iconClass: 'text-orange-500',
    labelKey: 'files.review.revise',
  },
};

export function SubmissionStatus({ review }: SubmissionStatusProps) {
  const { t, locale } = useI18n();
  const { format } = useStudentDateFormatter(locale);

  if (!review) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('files.review.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="flex items-center gap-3"
            role="status"
            aria-label={t('files.review.awaiting')}
          >
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">{t('files.review.awaiting')}</p>
              <p className="text-xs text-muted-foreground">{t('files.review.awaitingHint')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const config = statusConfig[review.decision];
  const Icon = config.icon;

  return (
    <Card className={review.decision === 'pass' ? 'border-l-green-500' : 'border-l-orange-500'}>
      <CardHeader>
        <CardTitle className="text-base">{t('files.review.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Decision badge */}
        <div
          className="flex items-center gap-2"
          role="status"
          aria-label={t(config.labelKey as TranslationKey)}
        >
          <Icon className={`h-5 w-5 ${config.iconClass}`} />
          <Badge variant={config.badgeVariant}>{t(config.labelKey as TranslationKey)}</Badge>
        </div>

        {/* Reviewer */}
        {review.reviewerName && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            <span>{review.reviewerName}</span>
          </div>
        )}

        {/* Comment */}
        {review.comment && (
          <div className="flex items-start gap-2 text-sm">
            <MessageSquare className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-foreground">{review.comment}</p>
          </div>
        )}

        {/* Revision deadline */}
        {review.decision !== 'pass' && review.revisionDeadline && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              {t('files.revisionDeadline', { date: format(review.revisionDeadline, 'short') })}
            </span>
          </div>
        )}

        {/* Review date */}
        {review.reviewedAt && (
          <p className="text-xs text-muted-foreground">
            {t('files.review.reviewedOn', { date: format(review.reviewedAt, 'short') })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
