import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from 'react/jsx-runtime';
import { useState, useCallback } from 'react';
import { useI18n } from '../../routes/__root';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { submitReview } from '@/server/reviews';
import { getPresignedReviewFeedbackUploadUrl } from '@/server/files';
import { Loader2, Upload } from 'lucide-react';
export function ReviewForm({ submissionId, onComplete, onError }) {
  const { t } = useI18n();
  const [decision, setDecision] = useState(null);
  const [comment, setComment] = useState('');
  const [feedbackFile, setFeedbackFile] = useState(null);
  const [feedbackFileKey, setFeedbackFileKey] = useState(null);
  const [revisionDeadline, setRevisionDeadline] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingFeedback, setIsUploadingFeedback] = useState(false);
  const handleFeedbackFileChange = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const extension = file.name.split('.').pop()?.toLowerCase() ?? 'pdf';
      const contentType =
        extension === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      setIsUploadingFeedback(true);
      try {
        const uploadData = await getPresignedReviewFeedbackUploadUrl({
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
          onError('Failed to upload feedback file');
          return;
        }
        setFeedbackFile(file);
        setFeedbackFileKey(uploadData.fileKey);
      } catch {
        onError('Failed to upload feedback file');
      } finally {
        setIsUploadingFeedback(false);
      }
    },
    [onError],
  );
  const handleSubmit = useCallback(async () => {
    if (!decision) return;
    if (decision === 'revise' && !revisionDeadline) {
      onError(t('instructorReviews.revisionDeadlineRequired'));
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await submitReview({
        data: {
          submissionId,
          decision,
          comment: comment || '',
          feedbackFileKey: feedbackFileKey || undefined,
          revisionDeadline: decision === 'revise' ? revisionDeadline : undefined,
        },
      });
      if (result.error) {
        onError(result.error);
        return;
      }
      onComplete();
    } catch {
      onError(t('instructorReviews.submitError'));
    } finally {
      setIsSubmitting(false);
    }
  }, [decision, revisionDeadline, comment, feedbackFileKey, submissionId, onComplete, onError, t]);
  return _jsxs(Card, {
    className: 'shadow-sm',
    children: [
      _jsx(CardHeader, {
        children: _jsx(CardTitle, {
          className: 'text-sm',
          children: t('instructorReviews.decision'),
        }),
      }),
      _jsxs(CardContent, {
        className: 'space-y-4',
        children: [
          _jsxs('div', {
            className: 'flex gap-4',
            children: [
              _jsxs('label', {
                className: 'flex items-center gap-2 cursor-pointer',
                children: [
                  _jsx('input', {
                    type: 'radio',
                    name: 'decision',
                    value: 'pass',
                    checked: decision === 'pass',
                    onChange: () => setDecision('pass'),
                    className: 'accent-green-500',
                  }),
                  _jsx('span', {
                    className: 'text-sm font-medium text-green-600 dark:text-green-400',
                    children: t('instructorReviews.pass'),
                  }),
                ],
              }),
              _jsxs('label', {
                className: 'flex items-center gap-2 cursor-pointer',
                children: [
                  _jsx('input', {
                    type: 'radio',
                    name: 'decision',
                    value: 'revise',
                    checked: decision === 'revise',
                    onChange: () => setDecision('revise'),
                    className: 'accent-orange-500',
                  }),
                  _jsx('span', {
                    className: 'text-sm font-medium text-orange-600 dark:text-orange-400',
                    children: t('instructorReviews.revise'),
                  }),
                ],
              }),
            ],
          }),
          _jsxs('div', {
            className: 'space-y-1.5',
            children: [
              _jsx(Label, { htmlFor: 'comment', children: t('instructorReviews.comment') }),
              _jsx(Textarea, {
                id: 'comment',
                placeholder: t('instructorReviews.commentPlaceholder'),
                value: comment,
                onChange: (e) => setComment(e.target.value),
                rows: 3,
              }),
            ],
          }),
          _jsxs('div', {
            className: 'space-y-1.5',
            children: [
              _jsx(Label, { children: t('instructorReviews.feedbackFile') }),
              _jsxs('label', {
                className: 'flex items-center gap-2 cursor-pointer',
                children: [
                  _jsx('input', {
                    type: 'file',
                    accept: '.pdf,.docx',
                    onChange: handleFeedbackFileChange,
                    className: 'hidden',
                    disabled: isUploadingFeedback,
                  }),
                  _jsxs('div', {
                    className:
                      'flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent transition-colors',
                    children: [
                      isUploadingFeedback
                        ? _jsx(Loader2, { className: 'h-4 w-4 animate-spin' })
                        : _jsx(Upload, { className: 'h-4 w-4' }),
                      _jsx('span', {
                        children: feedbackFile
                          ? feedbackFile.name
                          : t('instructorReviews.uploadFeedback'),
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          decision === 'revise' &&
            _jsxs('div', {
              className: 'space-y-1.5',
              children: [
                _jsx(Label, {
                  htmlFor: 'revisionDeadline',
                  children: t('instructorReviews.revisionDeadline'),
                }),
                _jsx('input', {
                  id: 'revisionDeadline',
                  type: 'date',
                  value: revisionDeadline,
                  onChange: (e) => setRevisionDeadline(e.target.value),
                  className:
                    'flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                }),
              ],
            }),
          _jsx(Button, {
            onClick: handleSubmit,
            disabled: !decision || isSubmitting,
            className: 'w-full',
            children: isSubmitting
              ? _jsxs(_Fragment, {
                  children: [
                    _jsx(Loader2, { className: 'mr-2 h-4 w-4 animate-spin' }),
                    t('instructorReviews.submitting'),
                  ],
                })
              : t('instructorReviews.submitReview'),
          }),
        ],
      }),
    ],
  });
}
