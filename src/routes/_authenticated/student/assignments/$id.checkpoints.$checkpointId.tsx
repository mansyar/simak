import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { getStudentAssignmentDetail } from '@/server/assignments';
import { listSubmissions, submitCheckpoint } from '@/server/submissions';
import { getPresignedUploadUrl } from '@/server/files';
import { isServerError } from '@/lib/errors';
import { getLatestReview } from '@/server/reviews';
import { FileUploader } from '@/components/files/file-uploader';
import { FileList } from '@/components/files/file-list';
import { SubmissionStatus } from '@/components/files/submission-status';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { StudentAssignmentLoadingSkeleton } from '@/components/student/assignments/StudentAssignmentLoadingSkeleton';
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
      const submissionsData = await (
        listSubmissions as unknown as (args: {
          data: { checkpointId: number; page: number; limit: number };
        }) => Promise<{ submissions?: unknown; total?: number }>
      )({
        data: { checkpointId: Number(checkpointId), page: 1, limit: 20 },
      });

      // Find the latest review (from the reviews table)
      const reviewData = await (
        getLatestReview as unknown as (args: { data: { checkpointId: number } }) => Promise<{
          review?: {
            decision: string;
            comment: string | null;
            instructorName: string;
            revisionDeadline: string | null;
            createdAt: string | null;
          } | null;
        }>
      )({ data: { checkpointId: Number(checkpointId) } });
      const latestReview = reviewData?.review
        ? ({
            decision: reviewData.review.decision as 'pass' | 'revise',
            comment: reviewData.review.comment ?? null,
            reviewerName: reviewData.review.instructorName ?? null,
            revisionDeadline: reviewData.review.revisionDeadline ?? null,
            reviewedAt: reviewData.review.createdAt ?? null,
          } as const)
        : null;

      return {
        assignmentId: Number(id),
        assignmentTitle: (assignmentData as { title: string }).title,
        checkpoint,
        submissions:
          (
            submissionsData as unknown as {
              submissions: {
                id: number;
                version: number;
                fileName: string;
                fileSize: number;
                uploadedAt: Date;
              }[];
            }
          ).submissions ?? [],
        submissionTotal: (submissionsData as { total?: number })?.total ?? 0,
        latestReview,
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
  const [submissions, setSubmissions] = useState<
    { id: number; version: number; fileName: string; fileSize: number; uploadedAt: Date }[]
  >(data?.submissions ?? []);
  const [submissionPage, setSubmissionPage] = useState(1);
  const [submissionTotal, setSubmissionTotal] = useState(data?.submissionTotal ?? 0);

  const fetchSubmissions = useCallback(
    async (page: number) => {
      const listSubFn = listSubmissions as unknown as (args: {
        data: { checkpointId: number; page: number; limit: number };
      }) => Promise<{
        submissions: {
          id: number;
          version: number;
          fileName: string;
          fileSize: number;
          uploadedAt: Date;
        }[];
        total: number;
      }>;
      const submissionsData = await listSubFn({
        data: { checkpointId: Number(params.checkpointId), page, limit: 20 },
      });
      setSubmissions(submissionsData?.submissions ?? []);
      setSubmissionTotal(submissionsData?.total ?? 0);
    },
    [params.checkpointId],
  );

  const handleUploadSuccess = useCallback(
    async (file: File) => {
      setIsUploading(true);
      setUploadError(null);
      setUploadSuccess(false);

      try {
        const extension = file.name.split('.').pop()?.toLowerCase() ?? 'pdf';
        const contentType =
          extension === 'pdf'
            ? 'application/pdf'
            : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

        // Step 1: Get presigned upload URL
        const getUploadUrlFn = getPresignedUploadUrl as unknown as (args: {
          data: { checkpointId: number; contentType: string; extension: string };
        }) => Promise<{ uploadUrl: string; fileKey: string }>;
        const uploadData = await getUploadUrlFn({
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

        // Step 2: Upload file directly to R2
        const uploadResponse = await fetch(uploadData.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': contentType },
        });

        if (!uploadResponse.ok) {
          setUploadError(t('files.serverError'));
          return;
        }

        // Step 3: Submit checkpoint
        const submitFn = submitCheckpoint as unknown as (args: {
          data: { checkpointId: number; fileKey: string; fileName: string; fileSize: number };
        }) => Promise<{ error?: string }>;
        const result = await submitFn({
          data: {
            checkpointId: Number(params.checkpointId),
            fileKey: uploadData.fileKey,
            fileName: file.name,
            fileSize: file.size,
          },
        });

        if (result.error) {
          setUploadError(result.error);
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
      }
    },
    [params.checkpointId, t, fetchSubmissions, submissionPage],
  );

  const handleDownload = useCallback(async (submissionId: number) => {
    const { getPresignedDownloadUrl } = await import('@/server/files');
    const downloadFn = getPresignedDownloadUrl as unknown as (args: {
      data: { submissionId: number };
    }) => Promise<{ downloadUrl?: string }>;
    const result = await downloadFn({
      data: { submissionId },
    });
    if (result?.downloadUrl) {
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
          uploadError={uploadError}
          uploadSuccess={uploadSuccess}
        />
      )}

      {/* Review status */}
      <SubmissionStatus review={data.latestReview} />

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
    </div>
  );
}
