import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { getStudentAssignmentDetail } from '@/server/assignments';
import { listSubmissions, submitCheckpoint } from '@/server/submissions';
import { getPresignedUploadUrl } from '@/server/files';
import { getLatestReview } from '@/server/reviews';
import { FileUploader } from '@/components/files/file-uploader';
import { FileList } from '@/components/files/file-list';
import { SubmissionStatus } from '@/components/files/submission-status';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { StudentAssignmentLoadingSkeleton } from '@/components/student/assignments/StudentAssignmentLoadingSkeleton';
import { SearchX, ChevronLeft } from 'lucide-react';
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
      const checkpoint = (assignmentData.checkpoints ?? []).find(
        (cp) => cp.id === Number(checkpointId),
      );
      if (!checkpoint) return null;
      // Fetch submissions for this checkpoint
      const submissionsData = await listSubmissions({
        data: { checkpointId: Number(checkpointId) },
      });
      // Find the latest review (from the reviews table)
      const reviewData = await getLatestReview({ data: { checkpointId: Number(checkpointId) } });
      const latestReview = reviewData?.review
        ? {
            decision: reviewData.review.decision,
            comment: reviewData.review.comment ?? null,
            reviewerName: reviewData.review.instructorName ?? null,
            revisionDeadline: reviewData.review.revisionDeadline ?? null,
            reviewedAt: reviewData.review.createdAt ?? null,
          }
        : null;
      return {
        assignmentId: Number(id),
        assignmentTitle: assignmentData.title,
        checkpoint,
        submissions: submissionsData.submissions ?? [],
        latestReview,
      };
    } catch (err) {
      console.error('Failed to load submission page:', err);
      return null;
    }
  },
  pendingComponent: () =>
    _jsx('div', {
      className: 'space-y-6',
      children: _jsx(StudentAssignmentLoadingSkeleton, { count: 1 }),
    }),
  notFoundComponent: () => _jsx(SubmissionNotFound, {}),
  component: CheckpointSubmissionPage,
});
function SubmissionNotFound() {
  const { t } = useI18n();
  const navigate = useNavigate();
  return _jsx(EmptyState, {
    icon: SearchX,
    title: t('studentAssignments.notFound'),
    description: t('studentAssignments.notFoundDescription'),
    children: _jsxs(Button, {
      variant: 'outline',
      onClick: () =>
        navigate({ to: '/student/assignments', search: { page: 1, limit: 20, search: '' } }),
      children: [_jsx(ChevronLeft, { className: 'mr-2 h-4 w-4' }), t('common.back')],
    }),
  });
}
function CheckpointSubmissionPage() {
  const { t } = useI18n();
  const data = Route.useLoaderData();
  const params = Route.useParams();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [submissions, setSubmissions] = useState(data?.submissions ?? []);
  const handleUploadSuccess = useCallback(
    async (file) => {
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
        const getUploadUrlFn = getPresignedUploadUrl;
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
        const submitFn = submitCheckpoint;
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
        const listSubFn = listSubmissions;
        const submissionsData = await listSubFn({
          data: { checkpointId: Number(params.checkpointId) },
        });
        setSubmissions(submissionsData?.submissions ?? []);
      } catch {
        setUploadError(t('files.uploadError'));
        setIsUploading(false);
      }
    },
    [params.checkpointId, t],
  );
  const handleDownload = useCallback(async (submissionId) => {
    const { getPresignedDownloadUrl } = await import('@/server/files');
    const downloadFn = getPresignedDownloadUrl;
    const result = await downloadFn({
      data: { submissionId },
    });
    if (result?.downloadUrl) {
      window.open(result.downloadUrl, '_blank');
    }
  }, []);
  if (!data) {
    return _jsx(EmptyState, {
      icon: SearchX,
      title: t('studentAssignments.notFound'),
      description: t('studentAssignments.notFoundDescription'),
      children: _jsx(Link, {
        to: '/student/assignments',
        search: { page: 1, limit: 20, search: '' },
        children: _jsxs(Button, {
          variant: 'outline',
          type: 'button',
          children: [_jsx(ChevronLeft, { className: 'mr-2 h-4 w-4' }), t('common.back')],
        }),
      }),
    });
  }
  const canSubmit = data.checkpoint.state === 'unlocked' || data.checkpoint.state === 'revise';
  return _jsxs('div', {
    className: 'space-y-6',
    children: [
      _jsx(Link, {
        to: '/student/assignments/$id',
        params: { id: String(data.assignmentId) },
        className: 'inline-flex',
        children: _jsxs(Button, {
          variant: 'ghost',
          size: 'sm',
          type: 'button',
          children: [_jsx(ChevronLeft, { className: 'mr-1 h-4 w-4' }), t('common.back')],
        }),
      }),
      _jsxs('div', {
        children: [
          _jsx('h1', {
            className: 'font-display text-3xl text-foreground',
            children: data.checkpoint.name,
          }),
          _jsx('p', {
            className: 'text-sm text-muted-foreground mt-1',
            children: data.assignmentTitle,
          }),
        ],
      }),
      canSubmit &&
        _jsx(FileUploader, {
          onUploadSuccess: handleUploadSuccess,
          isUploading: isUploading,
          uploadError: uploadError,
          uploadSuccess: uploadSuccess,
        }),
      _jsx(SubmissionStatus, { review: data.latestReview }),
      _jsxs('div', {
        children: [
          _jsx('h2', {
            className: 'font-display text-2xl text-foreground mb-3',
            children: t('files.table.version'),
          }),
          _jsx(FileList, { submissions: submissions, onDownload: handleDownload }),
        ],
      }),
    ],
  });
}
