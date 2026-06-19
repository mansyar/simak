import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { useState } from 'react';
import { useI18n } from '../../../routes/__root';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { requestExtension } from '@/server/extensions';
const CATEGORY_OPTIONS = ['personal', 'research', 'health', 'other'];
export function ExtensionRequestForm({
  assignmentId,
  maxExtensionDays,
  maxTotalExtensions: _maxTotalExtensions,
  checkpoints,
  onSuccess,
}) {
  const { t } = useI18n();
  const [category, setCategory] = useState('');
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState('');
  const [checkpointId, setCheckpointId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const isFormValid = category && reason.length >= 10 && duration && Number(duration) >= 1;
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid) return;
    setLoading(true);
    setError(null);
    setSuccess(false);
    const fn = requestExtension;
    const result = await fn({
      data: {
        assignmentId,
        category,
        reason,
        extensionDays: Number(duration),
        ...(checkpointId ? { checkpointId: Number(checkpointId) } : {}),
      },
    });
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setSuccess(true);
    setLoading(false);
    setCategory('');
    setReason('');
    setDuration('');
    setCheckpointId('');
    onSuccess();
  };
  const charDisplay =
    reason.length > 0
      ? _jsx('p', {
          className: 'text-xs text-muted-foreground mt-1 text-right',
          children:
            reason.length < 10
              ? t('extensions.reasonMinChars').replace('{count}', '10')
              : `${reason.length} characters`,
        })
      : null;
  if (success) {
    return _jsx('div', {
      className: 'rounded-lg border bg-card p-5 shadow-sm',
      children: _jsx('p', {
        className: 'text-sm text-success font-medium',
        children: t('extensions.successMessage'),
      }),
    });
  }
  return _jsxs('form', {
    onSubmit: handleSubmit,
    className: 'space-y-4',
    children: [
      _jsxs('div', {
        className: 'space-y-2',
        children: [
          _jsx(Label, { htmlFor: 'category', children: t('extensions.category') }),
          _jsxs(Select, {
            value: category,
            onValueChange: (val) => setCategory(val ?? ''),
            children: [
              _jsx(SelectTrigger, {
                id: 'category',
                children: _jsx(SelectValue, { placeholder: t('extensions.categoryPlaceholder') }),
              }),
              _jsx(SelectContent, {
                children: CATEGORY_OPTIONS.map((cat) =>
                  _jsx(
                    SelectItem,
                    {
                      value: cat,
                      children: t(
                        `extensions.category${cat.charAt(0).toUpperCase() + cat.slice(1)}`,
                      ),
                    },
                    cat,
                  ),
                ),
              }),
            ],
          }),
        ],
      }),
      _jsxs('div', {
        className: 'space-y-2',
        children: [
          _jsx(Label, { htmlFor: 'reason', children: t('extensions.reason') }),
          _jsx('textarea', {
            id: 'reason',
            value: reason,
            onChange: (e) => setReason(e.target.value),
            rows: 4,
            placeholder: t('extensions.reasonPlaceholder'),
            className:
              'flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          }),
          charDisplay,
        ],
      }),
      _jsxs('div', {
        className: 'space-y-2',
        children: [
          _jsx(Label, { htmlFor: 'duration', children: t('extensions.duration') }),
          _jsx(Input, {
            id: 'duration',
            type: 'number',
            min: 1,
            max: maxExtensionDays,
            value: duration,
            onChange: (e) => setDuration(e.target.value),
            placeholder: '1',
          }),
          _jsxs('p', {
            className: 'text-xs text-muted-foreground',
            children: [t('extensions.durationHint'), ' (max ', maxExtensionDays, ')'],
          }),
        ],
      }),
      checkpoints.length > 0 &&
        _jsxs('div', {
          className: 'space-y-2',
          children: [
            _jsx(Label, { htmlFor: 'checkpoint', children: t('extensions.checkpoint') }),
            _jsxs(Select, {
              value: checkpointId,
              onValueChange: (val) => setCheckpointId(val ?? ''),
              children: [
                _jsx(SelectTrigger, {
                  id: 'checkpoint',
                  children: _jsx(SelectValue, { placeholder: t('extensions.checkpointHint') }),
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
      error &&
        _jsx('p', {
          className: 'text-sm text-destructive',
          'aria-live': 'polite',
          children: error,
        }),
      _jsx(Button, {
        type: 'submit',
        disabled: !isFormValid || loading,
        children: loading ? t('extensions.submitting') : t('extensions.submit'),
      }),
    ],
  });
}
