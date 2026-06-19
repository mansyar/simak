import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from 'react/jsx-runtime';
import { useState, useEffect } from 'react';
import {
  getConsultationDetail,
  verifyConsultation,
  rejectConsultation,
} from '@/server/consultations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useI18n } from '../../routes/__root';
export function VerificationDialog({ consultationId, open, onOpenChange, onActionComplete }) {
  const { t } = useI18n();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  useEffect(() => {
    if (open && consultationId) {
      loadDetail(consultationId);
    } else {
      setDetail(null);
      setError(null);
      setRejectReason('');
      setShowRejectInput(false);
    }
  }, [open, consultationId]);
  const loadDetail = async (id) => {
    setLoading(true);
    setError(null);
    const result = await getConsultationDetail({ data: { consultationId: id } });
    if (result.consultation) {
      setDetail(result.consultation);
    } else {
      setError(result.error ?? 'Failed to load consultation');
    }
    setLoading(false);
  };
  const handleVerify = async () => {
    if (!consultationId) return;
    setLoading(true);
    setError(null);
    const result = await verifyConsultation({ data: { consultationId } });
    if (result.success) {
      onOpenChange(false);
      onActionComplete();
    } else {
      setError(result.error);
    }
    setLoading(false);
  };
  const handleReject = async () => {
    if (!consultationId || !rejectReason.trim()) return;
    setLoading(true);
    setError(null);
    const result = await rejectConsultation({
      data: { consultationId, reason: rejectReason.trim() },
    });
    if (result.success) {
      onOpenChange(false);
      onActionComplete();
    } else {
      setError(result.error);
    }
    setLoading(false);
  };
  return _jsx(Dialog, {
    open: open,
    onOpenChange: onOpenChange,
    children: _jsxs(DialogContent, {
      className: 'sm:max-w-[500px]',
      children: [
        _jsx(DialogHeader, {
          children: _jsx(DialogTitle, { children: t('consultations.consultationDetail') }),
        }),
        loading &&
          !detail &&
          _jsx('div', {
            className: 'py-8 text-center text-muted-foreground',
            children: t('common.loading'),
          }),
        error &&
          _jsx('p', {
            className: 'text-sm text-destructive',
            'aria-live': 'polite',
            children: error,
          }),
        detail &&
          _jsxs('div', {
            className: 'space-y-3',
            children: [
              _jsxs('div', {
                className: 'grid grid-cols-2 gap-3 text-sm',
                children: [
                  _jsxs('div', {
                    children: [
                      _jsx('span', {
                        className: 'text-xs text-muted-foreground font-medium',
                        children: t('consultations.student'),
                      }),
                      _jsx('p', { className: 'text-foreground', children: detail.studentName }),
                    ],
                  }),
                  _jsxs('div', {
                    children: [
                      _jsx('span', {
                        className: 'text-xs text-muted-foreground font-medium',
                        children: t('consultations.checkpoint'),
                      }),
                      _jsx('p', { className: 'text-foreground', children: detail.checkpointName }),
                    ],
                  }),
                  _jsxs('div', {
                    children: [
                      _jsx('span', {
                        className: 'text-xs text-muted-foreground font-medium',
                        children: t('consultations.sessionType'),
                      }),
                      _jsx('p', {
                        className: 'text-foreground',
                        children:
                          detail.sessionType === 'external'
                            ? t('consultations.external')
                            : t('consultations.internal'),
                      }),
                    ],
                  }),
                  _jsxs('div', {
                    children: [
                      _jsx('span', {
                        className: 'text-xs text-muted-foreground font-medium',
                        children: t('consultations.date'),
                      }),
                      _jsx('p', {
                        className: 'text-foreground',
                        children: new Date(detail.createdAt).toLocaleDateString(),
                      }),
                    ],
                  }),
                ],
              }),
              detail.sessionType === 'external' &&
                detail.externalConsultantName &&
                _jsxs('div', {
                  className: 'text-sm',
                  children: [
                    _jsx('span', {
                      className: 'text-xs text-muted-foreground font-medium',
                      children: t('consultations.externalConsultantName'),
                    }),
                    _jsx('p', {
                      className: 'text-foreground',
                      children: detail.externalConsultantName,
                    }),
                  ],
                }),
              _jsxs('div', {
                className: 'text-sm',
                children: [
                  _jsx('span', {
                    className: 'text-xs text-muted-foreground font-medium',
                    children: t('consultations.notes'),
                  }),
                  _jsx('p', {
                    className: 'text-foreground whitespace-pre-wrap',
                    children: detail.notes ?? '-',
                  }),
                ],
              }),
              showRejectInput &&
                _jsxs('div', {
                  className: 'space-y-2',
                  children: [
                    _jsx('label', {
                      className: 'text-xs text-muted-foreground font-medium',
                      children: t('consultations.rejectReason'),
                    }),
                    _jsx(Input, {
                      value: rejectReason,
                      onChange: (e) => setRejectReason(e.target.value),
                      placeholder: t('consultations.rejectReasonPlaceholder'),
                    }),
                  ],
                }),
            ],
          }),
        _jsx(DialogFooter, {
          className: 'gap-2',
          children: !showRejectInput
            ? _jsxs(_Fragment, {
                children: [
                  _jsx(Button, {
                    variant: 'outline',
                    type: 'button',
                    onClick: () => setShowRejectInput(true),
                    disabled: loading,
                    children: t('consultations.reject'),
                  }),
                  _jsx(Button, {
                    type: 'button',
                    onClick: handleVerify,
                    disabled: loading,
                    children: loading ? t('common.loading') : t('consultations.verify'),
                  }),
                ],
              })
            : _jsxs(_Fragment, {
                children: [
                  _jsx(Button, {
                    variant: 'outline',
                    type: 'button',
                    onClick: () => setShowRejectInput(false),
                    disabled: loading,
                    children: t('common.cancel'),
                  }),
                  _jsx(Button, {
                    variant: 'destructive',
                    type: 'button',
                    onClick: handleReject,
                    disabled: loading || !rejectReason.trim(),
                    children: loading ? t('common.loading') : t('consultations.confirmReject'),
                  }),
                ],
              }),
        }),
      ],
    }),
  });
}
