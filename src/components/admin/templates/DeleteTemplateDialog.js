import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle } from 'lucide-react';
import { useI18n } from '../../../routes/__root';
export function DeleteTemplateDialog({ open, onOpenChange, onConfirm, usageCount }) {
  const { t } = useI18n();
  const [deleteText, setDeleteText] = useState('');
  const isInUse = usageCount > 0;
  const canConfirm = !isInUse || deleteText === 'DELETE';
  const handleConfirm = () => {
    if (canConfirm) {
      onConfirm();
      setDeleteText('');
      onOpenChange(false);
    }
  };
  const handleOpenChange = (newOpen) => {
    if (!newOpen) {
      setDeleteText('');
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
            _jsxs(DialogTitle, {
              className: 'flex items-center gap-2',
              children: [
                isInUse && _jsx(AlertTriangle, { className: 'h-5 w-5 text-destructive' }),
                t('adminTemplates.deleteConfirm'),
              ],
            }),
            _jsx(DialogDescription, {
              children: isInUse
                ? _jsx('span', {
                    className: 'text-destructive',
                    children: t('adminTemplates.deleteInUse', { count: String(usageCount) }),
                  })
                : t('adminTemplates.deleteConfirm'),
            }),
          ],
        }),
        isInUse &&
          _jsx('div', {
            className: 'py-2',
            children: _jsx(Input, {
              value: deleteText,
              onChange: (e) => setDeleteText(e.target.value),
              placeholder: t('common.typeDeleteToConfirm'),
              'data-testid': 'delete-input',
            }),
          }),
        _jsxs(DialogFooter, {
          children: [
            _jsx(Button, {
              type: 'button',
              variant: 'outline',
              onClick: () => handleOpenChange(false),
              children: t('common.cancel'),
            }),
            _jsx(Button, {
              type: 'button',
              variant: 'destructive',
              onClick: handleConfirm,
              disabled: !canConfirm,
              children: t('adminTemplates.actions.delete'),
            }),
          ],
        }),
      ],
    }),
  });
}
