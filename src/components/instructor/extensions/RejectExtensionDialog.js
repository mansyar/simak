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
const MIN_REASON_LENGTH = 20;
export function RejectExtensionDialog({ request, open, onOpenChange, onConfirm }) {
  const { t } = useI18n();
  const [reason, setReason] = useState('');
  const isValid = reason.trim().length >= MIN_REASON_LENGTH;
  const handleConfirm = () => {
    if (!isValid) return;
    onConfirm(reason.trim());
    setReason('');
  };
  const handleOpenChange = (newOpen) => {
    if (!newOpen) {
      setReason('');
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
            _jsx(DialogTitle, { children: t('extensions.dialog.reject.title') }),
            _jsx(DialogDescription, {
              children: t('extensions.dialog.reject.description', {
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
              className: 'space-y-1',
              children: [
                _jsx('label', {
                  htmlFor: 'reject-reason',
                  className: 'text-sm font-medium text-muted-foreground',
                  children: t('extensions.dialog.reject.reason'),
                }),
                _jsx(Textarea, {
                  id: 'reject-reason',
                  value: reason,
                  onChange: (e) => setReason(e.target.value),
                  rows: 3,
                  placeholder: t('extensions.dialog.reject.reasonPlaceholder'),
                }),
                _jsx('p', {
                  className: 'text-xs text-muted-foreground text-right',
                  children: t('extensions.dialog.reject.charCount', {
                    count: String(reason.length),
                    min: String(MIN_REASON_LENGTH),
                  }),
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
              children: t('extensions.dialog.reject.cancel'),
            }),
            _jsx(Button, {
              onClick: handleConfirm,
              disabled: !isValid,
              children: t('extensions.dialog.reject.confirm'),
            }),
          ],
        }),
      ],
    }),
  });
}
