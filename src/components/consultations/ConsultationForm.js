import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { useState } from 'react';
import { logConsultation } from '@/server/consultations';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useI18n } from '../../routes/__root';
export function ConsultationForm({ assignmentId: _assignmentId, checkpoints, onSuccess }) {
  const { t } = useI18n();
  const [checkpointId, setCheckpointId] = useState('');
  const [sessionType, setSessionType] = useState('internal');
  const [externalConsultantName, setExternalConsultantName] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!checkpointId) return;
    setLoading(true);
    setError(null);
    const result = await logConsultation({
      data: {
        checkpointId: Number(checkpointId),
        sessionType,
        externalConsultantName: sessionType === 'external' ? externalConsultantName : undefined,
        notes,
      },
    });
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    // Reset form
    setCheckpointId('');
    setSessionType('internal');
    setExternalConsultantName('');
    setNotes('');
    setLoading(false);
    onSuccess();
  };
  return _jsxs('form', {
    onSubmit: handleSubmit,
    className: 'space-y-4',
    children: [
      _jsxs('div', {
        className: 'space-y-2',
        children: [
          _jsx(Label, { htmlFor: 'checkpoint', children: t('consultations.checkpoint') }),
          _jsxs(Select, {
            value: checkpointId,
            onValueChange: (val) => setCheckpointId(val ?? ''),
            children: [
              _jsx(SelectTrigger, {
                id: 'checkpoint',
                children: _jsx(SelectValue, { placeholder: t('consultations.selectCheckpoint') }),
              }),
              _jsx(SelectContent, {
                children: checkpoints.map((cp) =>
                  _jsx(SelectItem, { value: String(cp.id), children: cp.name }, cp.id),
                ),
              }),
            ],
          }),
        ],
      }),
      _jsxs('div', {
        className: 'space-y-2',
        children: [
          _jsx(Label, { children: t('consultations.sessionType') }),
          _jsxs(Select, {
            value: sessionType,
            onValueChange: (val) => setSessionType(val ?? 'internal'),
            children: [
              _jsx(SelectTrigger, { children: _jsx(SelectValue, {}) }),
              _jsxs(SelectContent, {
                children: [
                  _jsx(SelectItem, { value: 'internal', children: t('consultations.internal') }),
                  _jsx(SelectItem, { value: 'external', children: t('consultations.external') }),
                ],
              }),
            ],
          }),
        ],
      }),
      sessionType === 'external' &&
        _jsxs('div', {
          className: 'space-y-2',
          children: [
            _jsx(Label, {
              htmlFor: 'consultantName',
              children: t('consultations.externalConsultantName'),
            }),
            _jsx(Input, {
              id: 'consultantName',
              value: externalConsultantName,
              onChange: (e) => setExternalConsultantName(e.target.value),
              placeholder: t('consultations.consultantNamePlaceholder'),
            }),
          ],
        }),
      _jsxs('div', {
        className: 'space-y-2',
        children: [
          _jsx(Label, { htmlFor: 'notes', children: t('consultations.notes') }),
          _jsx('textarea', {
            id: 'notes',
            value: notes,
            onChange: (e) => setNotes(e.target.value),
            placeholder: t('consultations.notesPlaceholder'),
            rows: 3,
            className:
              'flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          }),
        ],
      }),
      error &&
        _jsx('p', {
          className: 'text-sm text-destructive',
          'aria-live': 'polite',
          children: error,
        }),
      _jsx(Button, {
        type: 'submit',
        disabled: loading || !checkpointId || !notes,
        children: loading ? t('common.loading') : t('consultations.logConsultation'),
      }),
    ],
  });
}
