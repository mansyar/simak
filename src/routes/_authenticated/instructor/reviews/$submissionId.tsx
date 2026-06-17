import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { getReviewDetail, openForReview } from '@/server/reviews';
import { ReviewDetailHeader } from '@/components/reviews/ReviewDetailHeader';
import { ReviewFilePreview } from '@/components/reviews/ReviewFilePreview';
import { ReviewHistory } from '@/components/reviews/ReviewHistory';
import { ReviewForm } from '@/components/reviews/ReviewForm';
import { ReviewQueueSkeleton } from '@/components/reviews/ReviewQueueSkeleton';
import { useI18n } from '../../../__root';
import { AlertCircle, CheckCircle2, SearchX } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

interface ReviewDetailLoaderData {
  submission?: {
    studentName: string;
    assignmentTitle: string;
    checkpointName: string;
    fileName: string;
    fileSize: number;
    version: number;
    uploadedAt: Date;
    downloadUrl: string;
    checkpointState: string;
  };
  reviewHistory?: Array<{
    id: number;
    decision: 'pass' | 'revise';
    comment?: string | null;
    instructorName: string;
    createdAt: Date;
  }>;
  error?: string;
}

export const Route = createFileRoute('/_authenticated/instructor/reviews/$submissionId')({
  loader: async ({ params }): Promise<ReviewDetailLoaderData> => {
    try {
      // @ts-expect-error - handler type inference limitation
      const data = await getReviewDetail({ data: { submissionId: Number(params.submissionId) } });
      return data as ReviewDetailLoaderData;
    } catch {
      return { error: 'Failed to load review detail' };
    }
  },
  pendingComponent: () => (
    <div className="space-y-6">
      <ReviewQueueSkeleton count={1} />
    </div>
  ),
  component: ReviewDetailPage,
});

function ReviewDetailPage() {
  const { t } = useI18n();
  const data = Route.useLoaderData() as ReviewDetailLoaderData;
  const params = Route.useParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [transitioned, setTransitioned] = useState(false);

  // On page load, if checkpoint is 'submitted', call openForReview
  useEffect(() => {
    if (data?.submission && data.submission.checkpointState === 'submitted' && !transitioned) {
      setTransitioned(true);
      let cancelled = false;
      (async () => {
        const openFn = openForReview as unknown as (args: {
          data: { submissionId: number };
        }) => Promise<unknown>;
        await openFn({ data: { submissionId: Number(params.submissionId) } });
        if (cancelled) return;
        // Re-fetch detail after transition by navigating to self
        navigate({ replace: true });
      })();
      return () => {
        cancelled = true;
      };
    }
  }, [data, params.submissionId, transitioned, navigate]);

  if (data?.error) {
    return <EmptyState icon={AlertCircle} title={data.error} description="" />;
  }

  if (!data?.submission) {
    return <EmptyState icon={SearchX} title={t('common.noResults')} description="" />;
  }

  const { submission, reviewHistory } = data;

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
        <CheckCircle2 className="h-12 w-12 text-green-500" />
        <h2 className="text-xl font-semibold">{t('instructorReviews.reviewSubmitted')}</h2>
        <button
          onClick={() => navigate({ to: '/instructor/reviews', search: { page: 1, limit: 20 } })}
          className="text-sm text-primary hover:underline"
        >
          {t('instructorReviews.backToQueue')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back nav + header */}
      <ReviewDetailHeader
        studentName={submission.studentName}
        assignmentTitle={submission.assignmentTitle}
        checkpointName={submission.checkpointName}
      />

      {/* Error alert */}
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {/* File preview */}
      <ReviewFilePreview
        fileName={submission.fileName}
        fileSize={submission.fileSize}
        version={submission.version}
        uploadedAt={submission.uploadedAt}
        downloadUrl={submission.downloadUrl}
      />

      {/* Review history */}
      {reviewHistory && reviewHistory.length > 0 && <ReviewHistory reviews={reviewHistory} />}

      {/* Review form */}
      <ReviewForm
        submissionId={Number(params.submissionId)}
        onComplete={() => setSuccess(true)}
        onError={(msg) => setError(msg)}
      />
    </div>
  );
}
