import { useI18n } from '../../routes/__root';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, RefreshCcw, User, MessageSquare, Clock } from 'lucide-react';

interface ReviewHistoryEntry {
  id: number;
  decision: 'pass' | 'revise';
  comment?: string | null;
  instructorName: string;
  createdAt: Date;
}

interface ReviewHistoryProps {
  reviews: ReviewHistoryEntry[];
}

export function ReviewHistory({ reviews }: ReviewHistoryProps) {
  const { t } = useI18n();

  if (reviews.length === 0) return null;

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground">
        {t('instructorReviews.reviewHistory')}
      </h3>
      <div className="space-y-3">
        {reviews.map((review) => (
          <div key={review.id} className="flex items-start gap-3 rounded-md border bg-muted/20 p-3">
            <div className="mt-0.5">
              {review.decision === 'pass' ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <RefreshCcw className="h-4 w-4 text-orange-500" />
              )}
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant={review.decision === 'pass' ? 'success' : 'warning'}>
                  {review.decision === 'pass'
                    ? t('instructorReviews.passed')
                    : t('instructorReviews.revise')}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  <Clock className="inline h-3 w-3 mr-1" />
                  {new Date(review.createdAt).toLocaleDateString()}
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
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
