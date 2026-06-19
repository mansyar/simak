import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/routes/__root';
export function ApproveExtensionDialog({ request, open, onOpenChange, onConfirm }) {
  const { t } = useI18n();
  const [comment, setComment] = useState('');
  const handleConfirm = () => {
    onConfirm(comment || undefined);
    setComment('');
  };
  const handleOpenChange = (newOpen) => {
    if (!newOpen) {
      setComment('');
    }
    onOpenChange(newOpen);
  };
  return _jsx(Dialog, {
    open: open,
    onOpenChange: handleOpenChange,
    children: _jsxs(DialogContent, {
      className: 'sm:max-w-[425px]',
      children: [
        _jsxs(DialogHeader, {
          children: [
            _jsx(DialogTitle, { children: t('extensions.dialog.approve.title') }),
            _jsx(DialogDescription, {
              children: t('extensions.dialog.approve.description', {
                student: request.studentName,
                count: String(request.extensionDays),
              }),
            }),
          ],
        }),
        _jsxs('div', {
          className: 'space-y-3 py-2',
          children: [
            _jsxs('div', {
              children: [
                _jsx('p', {
                  className: 'text-sm font-medium text-muted-foreground',
                  children: t('extensions.queue.checkpoint'),
                }),
                _jsx('p', { className: 'text-sm', children: request.checkpointName ?? '-' }),
              ],
            }),
            _jsxs('div', {
              children: [
                _jsx('p', {
                  className: 'text-sm font-medium text-muted-foreground',
                  children: t('extensions.queue.reason'),
                }),
                _jsx('p', { className: 'text-sm text-muted-foreground', children: request.reason }),
              ],
            }),
            _jsxs('div', {
              children: [
                _jsx('label', {
                  htmlFor: 'approve-comment',
                  className: 'text-sm font-medium text-muted-foreground',
                  children: t('extensions.dialog.approve.comment'),
                }),
                _jsx(Textarea, {
                  id: 'approve-comment',
                  value: comment,
                  onChange: (e) => setComment(e.target.value),
                  size: 'sm',
                  placeholder: t('extensions.dialog.approve.commentPlaceholder'),
                  className: 'mt-1',
                }),
              ],
            }),
          ],
        }),
        _jsxs(DialogFooter, {
          children: [
            _jsx(Button, {
              variant: 'outline',
              onClick: () => handleOpenChange(false),
              children: t('extensions.dialog.approve.cancel'),
            }),
            _jsx(Button, {
              onClick: handleConfirm,
              children: t('extensions.dialog.approve.confirm'),
            }),
          ],
        }),
      ],
    }),
  });
}
