import { useState, useCallback } from 'react';
import { useI18n } from '../../routes/__root';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { submitReview } from '@/server/reviews';
import { isServerError } from '@/lib/errors';
import { getPresignedReviewFeedbackUploadUrl } from '@/server/files';
import { RubricScoringSection, type ScoreInput } from '@/components/reviews/RubricScoringSection';
import type { RubricData } from '@/server/rubrics';
import { Loader2, Upload } from 'lucide-react';

interface ReviewFormProps {
  submissionId: number;
  onComplete: () => void;
  onError: (error: string) => void;
  rubric?: RubricData | null;
}

export function ReviewForm({ submissionId, onComplete, onError, rubric }: ReviewFormProps) {
  const { t } = useI18n();
  const [decision, setDecision] = useState<'pass' | 'revise' | null>(null);
  const [comment, setComment] = useState('');
  const [feedbackFile, setFeedbackFile] = useState<File | null>(null);
  const [feedbackFileKey, setFeedbackFileKey] = useState<string | null>(null);
  const [revisionDeadline, setRevisionDeadline] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingFeedback, setIsUploadingFeedback] = useState(false);
  const [scores, setScores] = useState<ScoreInput[]>([]);

  const rubricActive = !!rubric && rubric.gradingType !== null;
  const allScored =
    rubric && rubric.gradingType !== null
      ? rubric.criteria.every((c) => scores.some((s) => s.criterionId === c.id))
      : true;

  const handleFeedbackFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const extension = file.name.split('.').pop()?.toLowerCase() ?? 'pdf';
      const contentType =
        extension === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

      setIsUploadingFeedback(true);
      try {
        const uploadData = await (
          getPresignedReviewFeedbackUploadUrl as unknown as (args: {
            data: { extension: string; contentType: string };
          }) => Promise<{ uploadUrl: string; fileKey: string; error?: string }>
        )({
          data: { extension, contentType },
        });

        if (uploadData.error) {
          onError(uploadData.error);
          return;
        }

        // Upload to R2
        const response = await fetch(uploadData.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': contentType },
        });

        if (!response.ok) {
          onError(t('instructorReviews.errors.feedbackUploadFailed'));
          return;
        }

        setFeedbackFile(file);
        setFeedbackFileKey(uploadData.fileKey);
      } catch {
        onError(t('instructorReviews.errors.feedbackUploadFailed'));
      } finally {
        setIsUploadingFeedback(false);
      }
    },
    [onError, t],
  );

  const handleSubmit = useCallback(async () => {
    if (!decision) return;

    if (decision === 'revise' && !revisionDeadline) {
      onError(t('instructorReviews.revisionDeadlineRequired'));
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await (
        submitReview as unknown as (args: {
          data: {
            submissionId: number;
            decision: 'pass' | 'revise';
            comment: string;
            feedbackFileKey?: string;
            revisionDeadline?: string;
            scores?: ScoreInput[];
          };
        }) => Promise<{ error?: string }>
      )({
        data: {
          submissionId,
          decision,
          comment: comment || '',
          feedbackFileKey: feedbackFileKey || undefined,
          revisionDeadline: decision === 'revise' ? revisionDeadline : undefined,
          scores: rubricActive ? scores : undefined,
        },
      });

      if (isServerError(result)) {
        onError(result.error.message);
        return;
      }

      onComplete();
    } catch {
      onError(t('instructorReviews.submitError'));
    } finally {
      setIsSubmitting(false);
    }
  }, [
    decision,
    revisionDeadline,
    comment,
    feedbackFileKey,
    submissionId,
    onComplete,
    onError,
    t,
    scores,
    rubricActive,
  ]);

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-sm">{t('instructorReviews.decision')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pass/Revise radio */}
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="decision"
              value="pass"
              checked={decision === 'pass'}
              onChange={() => setDecision('pass')}
              className="accent-success"
            />
            <span className="text-sm font-medium text-success">{t('instructorReviews.pass')}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="decision"
              value="revise"
              checked={decision === 'revise'}
              onChange={() => setDecision('revise')}
              className="accent-warning"
            />
            <span className="text-sm font-medium text-warning">
              {t('instructorReviews.revise')}
            </span>
          </label>
        </div>

        {/* Comment textarea */}
        <div className="space-y-1.5">
          <Label htmlFor="comment">{t('instructorReviews.comment')}</Label>
          <Textarea
            id="comment"
            placeholder={t('instructorReviews.commentPlaceholder')}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
          />
        </div>

        {/* Feedback file upload */}
        <div className="space-y-1.5">
          <Label>{t('instructorReviews.feedbackFile')}</Label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="file"
              accept=".pdf,.docx"
              onChange={handleFeedbackFileChange}
              className="hidden"
              disabled={isUploadingFeedback}
            />
            <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent transition-colors">
              {isUploadingFeedback ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              <span>
                {feedbackFile ? feedbackFile.name : t('instructorReviews.uploadFeedback')}
              </span>
            </div>
          </label>
        </div>

        {/* Revision deadline (only when revise selected) */}
        {decision === 'revise' && (
          <div className="space-y-1.5">
            <Label htmlFor="revisionDeadline">{t('instructorReviews.revisionDeadline')}</Label>
            <input
              id="revisionDeadline"
              type="date"
              value={revisionDeadline}
              onChange={(e) => setRevisionDeadline(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
        )}

        {/* Rubric scoring (when rubric is active) */}
        {rubricActive && rubric && (
          <RubricScoringSection rubric={rubric} scores={scores} onScoresChange={setScores} />
        )}

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={!decision || isSubmitting || !allScored}
          className="w-full"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('instructorReviews.submitting')}
            </>
          ) : (
            t('instructorReviews.submitReview')
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
