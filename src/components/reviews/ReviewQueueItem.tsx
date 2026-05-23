import { Link } from '@tanstack/react-router';
import { FileText, Clock, User } from 'lucide-react';
import { useI18n } from '../../routes/__root';
import { SLABadge } from './SLABadge';

export interface ReviewQueueItemData {
  submissionId: number;
  checkpointId: number;
  checkpointName: string;
  assignmentId: number;
  assignmentTitle: string;
  studentId: string;
  studentName: string;
  fileName: string;
  fileSize: number;
  version: number;
  uploadedAt: Date;
  checkpointState: 'submitted' | 'under_review';
  checkpointUpdatedAt?: Date;
}

interface ReviewQueueItemProps {
  item: ReviewQueueItemData;
}

export function ReviewQueueItem({ item }: ReviewQueueItemProps) {
  const { t } = useI18n();

  const waitTime = getWaitTime(item.uploadedAt);

  return (
    <div className="flex items-center justify-between rounded-lg border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/30">
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{item.studentName}</span>
          <span className="text-xs text-muted-foreground">—</span>
          <span className="text-sm text-muted-foreground">{item.checkpointName}</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            <span>{item.assignmentTitle}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{waitTime}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <SLABadge
          state={item.checkpointState}
          updatedAt={item.checkpointUpdatedAt ?? item.uploadedAt}
        />
        <Link
          to={`/instructor/reviews/${item.submissionId}` as any}
          data-testid="review-queue-link"
          className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {t('common.viewAll')}
        </Link>
      </div>
    </div>
  );
}

function getWaitTime(uploadedAt: Date): string {
  const now = Date.now();
  const diff = now - new Date(uploadedAt).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h`;
  return '< 1h';
}
