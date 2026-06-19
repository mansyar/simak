import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
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
export const Route = createFileRoute('/_authenticated/instructor/reviews/$submissionId')({
  loader: async ({ params }) => {
    try {
      // @ts-expect-error - handler type inference limitation
      const data = await getReviewDetail({ data: { submissionId: Number(params.submissionId) } });
      return data;
    } catch {
      return { error: 'Failed to load review detail' };
    }
  },
  pendingComponent: () =>
    _jsx('div', { className: 'space-y-6', children: _jsx(ReviewQueueSkeleton, { count: 1 }) }),
  component: ReviewDetailPage,
});
function ReviewDetailPage() {
  const { t } = useI18n();
  const data = Route.useLoaderData();
  const params = Route.useParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [transitioned, setTransitioned] = useState(false);
  // On page load, if checkpoint is 'submitted', call openForReview
  useEffect(() => {
    if (data?.submission && data.submission.checkpointState === 'submitted' && !transitioned) {
      setTransitioned(true);
      let cancelled = false;
      (async () => {
        const openFn = openForReview;
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
    return _jsx(EmptyState, { icon: AlertCircle, title: data.error, description: '' });
  }
  if (!data?.submission) {
    return _jsx(EmptyState, { icon: SearchX, title: t('common.noResults'), description: '' });
  }
  const { submission, reviewHistory } = data;
  if (success) {
    return _jsxs('div', {
      className: 'flex flex-col items-center justify-center py-16 text-center space-y-4',
      children: [
        _jsx(CheckCircle2, { className: 'h-12 w-12 text-green-500' }),
        _jsx('h2', {
          className: 'text-xl font-semibold',
          children: t('instructorReviews.reviewSubmitted'),
        }),
        _jsx('button', {
          onClick: () => navigate({ to: '/instructor/reviews', search: { page: 1, limit: 20 } }),
          className: 'text-sm text-primary hover:underline',
          children: t('instructorReviews.backToQueue'),
        }),
      ],
    });
  }
  return _jsxs('div', {
    className: 'space-y-6 max-w-3xl',
    children: [
      _jsx(ReviewDetailHeader, {
        studentName: submission.studentName,
        assignmentTitle: submission.assignmentTitle,
        checkpointName: submission.checkpointName,
      }),
      error &&
        _jsxs('div', {
          className:
            'flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive',
          children: [
            _jsx(AlertCircle, { className: 'h-4 w-4' }),
            _jsx('span', { children: error }),
          ],
        }),
      _jsx(ReviewFilePreview, {
        fileName: submission.fileName,
        fileSize: submission.fileSize,
        version: submission.version,
        uploadedAt: submission.uploadedAt,
        downloadUrl: submission.downloadUrl,
      }),
      _jsx(ReviewHistory, { reviews: reviewHistory ?? [] }),
      _jsx(ReviewForm, {
        submissionId: Number(params.submissionId),
        onComplete: () => setSuccess(true),
        onError: (msg) => setError(msg),
      }),
    ],
  });
}
