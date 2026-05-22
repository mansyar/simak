import { createFileRoute, Link } from '@tanstack/react-router';
import { getStudentAssignmentDetail } from '@/server/assignments';
import { listSubmissions, submitCheckpoint } from '@/server/submissions';
import { getPresignedUploadUrl } from '@/server/files';
import { FileUploader } from '@/components/files/file-uploader';
import { FileList } from '@/components/files/file-list';
import { SubmissionStatus } from '@/components/files/submission-status';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { useI18n } from '../../../__root';
import { useState, useCallback } from 'react';

export const Route = createFileRoute(
  '/_authenticated/student/assignments/$id/checkpoints/$checkpointId',
)({
  loader: async ({ params }) => {
    const { id, checkpointId } = params as any;
    const assignmentData = await (getStudentAssignmentDetail as any)({
      data: { id: Number(id) },
    });

    if (!assignmentData) return null;

    // Find the specific checkpoint
    const checkpoint = (assignmentData.checkpoints ?? []).find(
      (cp: any) => cp.id === Number(checkpointId),
    );

    if (!checkpoint) return null;

    // Fetch submissions for this checkpoint
    const submissionsData = await (listSubmissions as any)({
      data: { checkpointId: Number(checkpointId) },
    });

    // Find the latest review (from the most recent submission)
    const latestReview = null;
    // Review data will come from the reviews table (Track 5.1)

    return {
      assignmentId: Number(id),
      assignmentTitle: assignmentData.title,
      checkpoint,
      submissions: submissionsData?.submissions ?? [],
      latestReview,
    };
  },
  component: CheckpointSubmissionPage,
});

function CheckpointSubmissionPage() {
  const { t } = useI18n();
  const data = Route.useLoaderData() as any;
  const params = Route.useParams() as any;
  const navigate = Route.useNavigate() as any;
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [submissions, setSubmissions] = useState(data?.submissions ?? []);

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
        const uploadData = await (getPresignedUploadUrl as any)({
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
        const result = await (submitCheckpoint as any)({
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
        const submissionsData = await (listSubmissions as any)({
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
    const result = await (getPresignedDownloadUrl as any)({
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
        <Link to="/student/assignments" search={() => ({}) as any} className="inline-flex">
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
