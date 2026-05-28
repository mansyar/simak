import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { getStudentAssignmentDetail } from '@/server/assignments';
import { listSubmissions, submitCheckpoint } from '@/server/submissions';
import { getPresignedUploadUrl } from '@/server/files';
import { getLatestReview } from '@/server/reviews';
import { FileUploader } from '@/components/files/file-uploader';
import { FileList } from '@/components/files/file-list';
import { SubmissionStatus } from '@/components/files/submission-status';
import { Button } from '@/components/ui/button';
import { StudentAssignmentLoadingSkeleton } from '@/components/student/assignments/StudentAssignmentLoadingSkeleton';
import { ChevronLeft } from 'lucide-react';
import { useI18n } from '../../../__root';
import { useState, useCallback } from 'react';

export const Route = createFileRoute(
  '/_authenticated/student/assignments/$id/checkpoints/$checkpointId',
)({
  loader: async ({ params }) => {
    try {
      const { id, checkpointId } = params;
      // @ts-expect-error - handler type inference limitation
      const assignmentData = await getStudentAssignmentDetail({ data: { id: Number(id) } });

      if (!assignmentData) return null;

      // Find the specific checkpoint
      const checkpoint = (
        (assignmentData as { checkpoints: { id: number; state: string; name: string }[] })
          .checkpoints ?? []
      ).find((cp) => cp.id === Number(checkpointId));

      if (!checkpoint) return null;

      // Fetch submissions for this checkpoint
      // @ts-expect-error - handler type inference limitation
      const submissionsData = await listSubmissions({
        data: { checkpointId: Number(checkpointId) },
      });

      // Find the latest review (from the reviews table)
      // @ts-expect-error - handler type inference limitation
      const reviewData = await getLatestReview({ data: { checkpointId: Number(checkpointId) } });
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
        latestReview,
      };
    } catch (err) {
      console.error('Failed to load submission page:', err);
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
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <h2 className="text-xl font-semibold text-foreground mb-2">
        {t('studentAssignments.notFound')}
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        {t('studentAssignments.notFoundDescription')}
      </p>
      <Button
        variant="outline"
        type="button"
        onClick={() =>
          navigate({ to: '/student/assignments', search: { page: 1, limit: 20, search: '' } })
        }
      >
        <ChevronLeft className="mr-2 h-4 w-4" />
        {t('common.back')}
      </Button>
    </div>
  );
}

function CheckpointSubmissionPage() {
  const { t } = useI18n();
  const data = Route.useLoaderData();
  const params = Route.useParams();
  const navigate = Route.useNavigate();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [submissions, setSubmissions] = useState<
    { id: number; version: number; fileName: string; fileSize: number; uploadedAt: Date }[]
  >(data?.submissions ?? []);

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
        }) => Promise<{ uploadUrl: string; fileKey: string; error?: string }>;
        const uploadData = await getUploadUrlFn({
          data: {
            checkpointId: Number(params.checkpointId),
            contentType,
            extension,
          },
        });

        if (uploadData.error) {
          setUploadError(uploadData.error);
          return;
        }

        // Step 2: Upload file directly to R2
        const uploadResponse = await fetch(uploadData.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': contentType },
        });

        if (!uploadResponse.ok) {
          setUploadError(t('files.uploadError'));
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
        const listSubFn = listSubmissions as unknown as (args: {
          data: { checkpointId: number };
        }) => Promise<{
          submissions: {
            id: number;
            version: number;
            fileName: string;
            fileSize: number;
            uploadedAt: Date;
          }[];
        }>;
        const submissionsData = await listSubFn({
          data: { checkpointId: Number(params.checkpointId) },
        });
        setSubmissions(submissionsData?.submissions ?? []);
      } catch (err) {
        setUploadError(t('files.uploadError'));
        setIsUploading(false);
      }
    },
    [params.checkpointId, t],
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
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h2 className="text-xl font-semibold text-foreground mb-2">
          {t('studentAssignments.notFound')}
        </h2>
        <Link
          to="/student/assignments"
          search={{ page: 1, limit: 20, search: '' }}
          className="inline-flex"
        >
          <Button variant="outline" type="button">
            <ChevronLeft className="mr-2 h-4 w-4" />
            {t('common.back')}
          </Button>
        </Link>
      </div>
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
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {data.checkpoint.name}
        </h1>
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
        <h2 className="text-lg font-semibold text-foreground mb-3">{t('files.table.version')}</h2>
        <FileList submissions={submissions} onDownload={handleDownload} />
      </div>
    </div>
  );
}
