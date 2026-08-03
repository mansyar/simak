import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { getStudentAssignmentDetail } from '@/server/assignments';
import { listSubmissions, submitCheckpoint } from '@/server/submissions';
import { getPresignedUploadUrl } from '@/server/files';
import { isServerError } from '@/lib/errors';
import { getLatestReview } from '@/server/reviews';
import { FileUploader } from '@/components/files/file-uploader';
import { FileList } from '@/components/files/file-list';
import { SubmissionStatus } from '@/components/files/submission-status';
import { RubricResultView } from '@/components/student/rubric-result-view';
import { RevisionActionPlan } from '@/components/student/RevisionActionPlan';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { StudentAssignmentLoadingSkeleton } from '@/components/student/assignments/StudentAssignmentLoadingSkeleton';
import { DiscussionPanel } from '@/components/discussions/discussion-panel';
import { SearchX, ChevronLeft } from 'lucide-react';
import { useI18n } from '../../../__root';
import { useState, useCallback } from 'react';
import { detectLocale } from '@/i18n';
import { translateKey } from '@/lib/i18n-server';
import { toast } from 'sonner';

export const Route = createFileRoute(
  '/_authenticated/student/assignments/$id/checkpoints/$checkpointId',
)({
  loader: async ({ params }) => {
    try {
      const { id, checkpointId } = params;
      const assignmentData = await getStudentAssignmentDetail({ data: { id: Number(id) } });

      if (!assignmentData) return null;

      // Find the specific checkpoint
      const checkpoint = (
        (assignmentData as { checkpoints: { id: number; state: string; name: string }[] })
          .checkpoints ?? []
      ).find((cp) => cp.id === Number(checkpointId));

      if (!checkpoint) return null;

      // Fetch submissions for this checkpoint
      const submissionsData = await listSubmissions({
        data: { checkpointId: Number(checkpointId), page: 1, limit: 20 },
      });

      // Find the latest review (from the reviews table)
      const reviewData = await getLatestReview({
        data: { checkpointId: Number(checkpointId) },
      });
      const latestReview =
        !isServerError(reviewData) && reviewData?.review
          ? ({
              decision: reviewData.review.decision as 'pass' | 'revise',
              comment: reviewData.review.comment ?? null,
              reviewerName: reviewData.review.instructorName ?? null,
              revisionDeadline: reviewData.review.revisionDeadline ?? null,
              reviewedAt: reviewData.review.createdAt ?? null,
            } as const)
          : null;
      const reviewHistory =
        !isServerError(reviewData) && reviewData?.reviewHistory
          ? reviewData.reviewHistory
          : !isServerError(reviewData) && reviewData?.review
            ? [{ ...reviewData.review, actionItems: reviewData.actionItems ?? [] }]
            : [];

      return {
        assignmentId: Number(id),
        assignmentTitle: (assignmentData as { title: string }).title,
        checkpoint,
        submissions: !isServerError(submissionsData) ? submissionsData.submissions : [],
        submissionTotal: !isServerError(submissionsData) ? submissionsData.total : 0,
        latestReview,
        rubricScores: !isServerError(reviewData) ? (reviewData?.scores ?? []) : [],
        reviewHistory,
      };
    } catch (err) {
      console.error('Failed to load submission page:', err);
      toast.error(translateKey('errors.fetchFailed', detectLocale()));
      return null;
    }
  },
  pendingComponent: () => (
    <div className="space-y-6">
      <StudentAssignmentLoadingSkeleton count={1} />
    </div>
  ),
  notFoundComponent: () => <SubmissionNotFound />,
  component: CheckpointSubmissionPage,
});

function SubmissionNotFound() {
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <EmptyState
      icon={SearchX}
      title={t('studentAssignments.notFound')}
      description={t('studentAssignments.notFoundDescription')}
    >
      <Button
        variant="outline"
        onClick={() =>
          navigate({ to: '/student/assignments', search: { page: 1, limit: 20, search: '' } })
        }
      >
        <ChevronLeft className="mr-2 h-4 w-4" />
        {t('common.back')}
      </Button>
    </EmptyState>
  );
}

function CheckpointSubmissionPage() {
  const { t } = useI18n();
  const data = Route.useLoaderData();
  const params = Route.useParams();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | undefined>(undefined);
  const [submissions, setSubmissions] = useState<
    {
      id: number;
      version: number | null;
      fileName: string;
      fileSize: number;
      uploadedAt: Date | null;
    }[]
  >(data?.submissions ?? []);
  const [submissionPage, setSubmissionPage] = useState(1);
  const [submissionTotal, setSubmissionTotal] = useState(data?.submissionTotal ?? 0);

  const fetchSubmissions = useCallback(
    async (page: number) => {
      const submissionsData = await listSubmissions({
        data: { checkpointId: Number(params.checkpointId), page, limit: 20 },
      });
      if (!isServerError(submissionsData)) {
        setSubmissions(submissionsData.submissions);
        setSubmissionTotal(submissionsData.total);
      }
    },
    [params.checkpointId],
  );

  const handleUploadSuccess = useCallback(
    async (file: File) => {
      setIsUploading(true);
      setUploadError(null);
      setUploadSuccess(false);
      setUploadProgress(undefined);

      try {
        const extension = file.name.split('.').pop()?.toLowerCase() ?? 'pdf';
        const contentType =
          extension === 'pdf'
            ? 'application/pdf'
            : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

        // Step 1: Get presigned upload URL
        const uploadData = await getPresignedUploadUrl({
          data: {
            checkpointId: Number(params.checkpointId),
            contentType,
            extension,
          },
        });

        if (isServerError(uploadData)) {
          setUploadError(uploadData.error.message);
          return;
        }

        // Step 2: Upload file directly to R2 via XMLHttpRequest (for progress tracking)
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', uploadData.uploadUrl);
          xhr.setRequestHeader('Content-Type', contentType);

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              setUploadProgress(Math.round((e.loaded / e.total) * 100));
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              setUploadProgress(100);
              resolve();
            } else {
              reject(new Error(`Upload failed: ${xhr.status}`));
            }
          };

          xhr.onerror = () => reject(new TypeError('Network error'));

          xhr.send(file);
        });

        // Step 3: Submit checkpoint
        const result = await submitCheckpoint({
          data: {
            checkpointId: Number(params.checkpointId),
            fileKey: uploadData.fileKey,
            fileName: file.name,
            fileSize: file.size,
          },
        });

        if (isServerError(result)) {
          setUploadError(result.error.message);
          return;
        }

        setUploadSuccess(true);
        setIsUploading(false);

        // Refresh submissions list
        await fetchSubmissions(submissionPage);
      } catch (error) {
        if (error instanceof TypeError) {
          setUploadError(t('files.networkError'));
        } else {
          setUploadError(t('files.serverError'));
        }
        setIsUploading(false);
        setUploadProgress(undefined);
      }
    },
    [params.checkpointId, t, fetchSubmissions, submissionPage],
  );

  const handleDownload = useCallback(async (submissionId: number) => {
    const { getPresignedDownloadUrl } = await import('@/server/files');
    const result = await getPresignedDownloadUrl({
      data: { submissionId },
    });
    if (!isServerError(result) && result?.downloadUrl) {
      window.open(result.downloadUrl, '_blank');
    }
  }, []);

  if (!data) {
    return (
      <EmptyState
        icon={SearchX}
        title={t('studentAssignments.notFound')}
        description={t('studentAssignments.notFoundDescription')}
      >
        <Link to="/student/assignments" search={{ page: 1, limit: 20, search: '' }}>
          <Button variant="outline" type="button">
            <ChevronLeft className="mr-2 h-4 w-4" />
            {t('common.back')}
          </Button>
        </Link>
      </EmptyState>
    );
  }

  const canSubmit = data.checkpoint.state === 'unlocked' || data.checkpoint.state === 'revise';
  const revisionPlans = (data.reviewHistory ?? []).filter(
    (review) => review.decision === 'revise' && review.actionItems.length > 0,
  );
  const currentPlanReviewId = revisionPlans[0]?.id;

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <Link
        to="/student/assignments/$id"
        params={{ id: String(data.assignmentId) }}
        className="inline-flex"
      >
        <Button variant="ghost" size="sm" type="button">
          <ChevronLeft className="mr-1 h-4 w-4" />
          {t('common.back')}
        </Button>
      </Link>

      {/* Header */}
      <div>
        <h1 className="font-display text-3xl text-foreground">{data.checkpoint.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">{data.assignmentTitle}</p>
      </div>

      {/* File upload section */}
      {canSubmit && (
        <FileUploader
          onUploadSuccess={handleUploadSuccess}
          isUploading={isUploading}
          uploadProgress={uploadProgress}
          uploadError={uploadError}
          uploadSuccess={uploadSuccess}
          onResetSuccess={() => setUploadSuccess(false)}
        />
      )}

      {/* Review status */}
      <SubmissionStatus review={data.latestReview} />

      {/* Revision action plans */}
      {revisionPlans.map((review) => (
        <RevisionActionPlan
          key={review.id}
          items={review.actionItems}
          isCurrentPlan={review.id === currentPlanReviewId}
        />
      ))}

      {/* Rubric results */}
      <RubricResultView scores={data.rubricScores ?? []} />

      {/* Submission history */}
      <div>
        <h2 className="font-display text-2xl text-foreground mb-3">{t('files.table.version')}</h2>
        <FileList submissions={submissions} onDownload={handleDownload} />
        {submissionTotal > 20 && (
          <Pagination
            currentPage={submissionPage}
            totalPages={Math.max(1, Math.ceil(submissionTotal / 20))}
            onPageChange={(page) => {
              setSubmissionPage(page);
              fetchSubmissions(page);
            }}
          />
        )}
      </div>

      {/* Discussion panel */}
      <DiscussionPanel
        checkpointId={Number(params.checkpointId)}
        assignmentId={data.assignmentId}
      />
    </div>
  );
}
