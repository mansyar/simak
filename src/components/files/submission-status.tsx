import { useI18n } from '../../routes/__root';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, RefreshCcw, Clock, User, MessageSquare } from 'lucide-react';

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

function formatDate(date: Date | string | null | undefined, locale: string): string {
  if (!date) return '';
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

export function SubmissionStatus({ review }: SubmissionStatusProps) {
  const { t, locale } = useI18n();

  if (!review) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('files.review.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
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

  const isPassed = review.decision === 'pass';

  return (
    <Card className={isPassed ? 'border-l-green-500' : 'border-l-orange-500'}>
      <CardHeader>
        <CardTitle className="text-base">{t('files.review.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Decision badge */}
        <div className="flex items-center gap-2">
          {isPassed ? (
            <>
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <Badge
                variant="secondary"
                className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
              >
                {t('files.review.passed')}
              </Badge>
            </>
          ) : (
            <>
              <RefreshCcw className="h-5 w-5 text-orange-500" />
              <Badge
                variant="secondary"
                className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300"
              >
                {t('files.review.revise')}
              </Badge>
            </>
          )}
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
        {!isPassed && review.revisionDeadline && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              {t('files.revisionDeadline', { date: formatDate(review.revisionDeadline, locale) })}
            </span>
          </div>
        )}

        {/* Review date */}
        {review.reviewedAt && (
          <p className="text-xs text-muted-foreground">
            {t('files.review.reviewedOn', { date: formatDate(review.reviewedAt, locale) })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
