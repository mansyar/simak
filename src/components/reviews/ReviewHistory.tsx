import { useI18n } from '../../routes/__root';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { CheckCircle2, RefreshCcw, User, MessageSquare, Clock } from 'lucide-react';
import { formatDateShort } from '@/lib/format';

export interface ReviewHistoryActionItem {
  id: number;
  itemText: string;
  order: number;
  criterionId?: number | null;
  criterionTitle?: string | null;
  addressedAt?: Date | null;
}

export interface ReviewHistoryEntry {
  id: number;
  decision: 'pass' | 'revise';
  comment?: string | null;
  instructorName: string;
  createdAt: Date;
  actionItems?: ReviewHistoryActionItem[];
}

interface ReviewHistoryProps {
  reviews: ReviewHistoryEntry[];
}

export function ReviewHistory({ reviews }: ReviewHistoryProps) {
  const { t } = useI18n();
  const currentPlanReviewId = reviews.find(
    (review) => review.decision === 'revise' && (review.actionItems?.length ?? 0) > 0,
  )?.id;

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-sm">{t('instructorReviews.reviewHistory')}</CardTitle>
      </CardHeader>
      <CardContent>
        {reviews.length === 0 ? (
          <EmptyState icon={MessageSquare} title={t('instructorReviews.noReviewsYet')} compact />
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="flex items-start gap-3 rounded-md border bg-muted/20 p-3"
              >
                <div className="mt-0.5">
                  {review.decision === 'pass' ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <RefreshCcw className="h-4 w-4 text-warning" />
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={review.decision === 'pass' ? 'success' : 'warning'}>
                      {review.decision === 'pass'
                        ? t('instructorReviews.passed')
                        : t('instructorReviews.revise')}
                    </Badge>
                    {review.decision === 'revise' && (review.actionItems?.length ?? 0) > 0 && (
                      <Badge variant="outline">
                        {review.id === currentPlanReviewId
                          ? t('instructorReviews.actionPlan.current')
                          : t('instructorReviews.actionPlan.historical')}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      <Clock className="inline h-3 w-3 mr-1" />
                      {t('instructorReviews.reviewDateLabel', {
                        date: formatDateShort(review.createdAt),
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>{review.instructorName}</span>
                  </div>
                  {review.comment && (
                    <div className="flex items-start gap-1 text-xs text-foreground">
                      <MessageSquare className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                      <p>{review.comment}</p>
                    </div>
                  )}
                  {review.actionItems && review.actionItems.length > 0 && (
                    <ol
                      className="space-y-2 pt-2"
                      aria-label={t('instructorReviews.actionPlan.listLabel')}
                    >
                      {[...review.actionItems]
                        .sort((a, b) => a.order - b.order || a.id - b.id)
                        .map((item) => (
                          <li key={item.id} className="rounded-md border bg-background p-2 text-xs">
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-foreground">{item.itemText}</span>
                              <span className="shrink-0 text-muted-foreground">
                                {item.addressedAt
                                  ? t('instructorReviews.actionPlan.addressed')
                                  : t('instructorReviews.actionPlan.open')}
                              </span>
                            </div>
                            {item.criterionTitle && (
                              <span className="mt-1 block text-muted-foreground">
                                {t('instructorReviews.actionPlan.criterion', {
                                  title: item.criterionTitle,
                                })}
                              </span>
                            )}
                          </li>
                        ))}
                    </ol>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
