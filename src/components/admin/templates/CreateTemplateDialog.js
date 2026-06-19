import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { CheckpointListEditor } from './CheckpointListEditor';
import { CreateTemplateSchema } from '@/server/templates';
import { useI18n } from '../../../routes/__root';
const defaultCheckpoint = () => ({ name: '', minConsultations: 0, estimatedDuration: 7 });
export function CreateTemplateDialog({ open, onOpenChange, onSubmit, onSuccess }) {
  const { t } = useI18n();
  const [serverError, setServerError] = useState(null);
  const form = useForm({
    resolver: zodResolver(CreateTemplateSchema),
    defaultValues: {
      name: '',
      type: '',
      checkpoints: [defaultCheckpoint(), defaultCheckpoint(), defaultCheckpoint()],
    },
  });
  const checkpointValues = form.watch('checkpoints');
  const handleAddCheckpoint = useCallback(() => {
    const current = form.getValues('checkpoints');
    form.setValue('checkpoints', [...current, defaultCheckpoint()], { shouldValidate: false });
  }, [form]);
  const handleRemoveCheckpoint = useCallback(
    (index) => {
      const current = form.getValues('checkpoints');
      if (current.length <= 1) return;
      form.setValue(
        'checkpoints',
        current.filter((_, i) => i !== index),
        { shouldValidate: true },
      );
    },
    [form],
  );
  const handleCheckpointChange = useCallback(
    (index, value) => {
      const current = form.getValues('checkpoints');
      const updated = [...current];
      updated[index] = { ...updated[index], name: value };
      form.setValue('checkpoints', updated, { shouldValidate: false });
    },
    [form],
  );
  const handleMinConsultationsChange = useCallback(
    (index, value) => {
      const current = form.getValues('checkpoints');
      const updated = [...current];
      updated[index] = { ...updated[index], minConsultations: value };
      form.setValue('checkpoints', updated, { shouldValidate: false });
    },
    [form],
  );
  const handleEstimatedDurationChange = useCallback(
    (index, value) => {
      const current = form.getValues('checkpoints');
      const updated = [...current];
      updated[index] = { ...updated[index], estimatedDuration: value };
      form.setValue('checkpoints', updated, { shouldValidate: false });
    },
    [form],
  );
  const handleMoveUp = useCallback(
    (index) => {
      if (index === 0) return;
      const current = form.getValues('checkpoints');
      const updated = [...current];
      [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
      form.setValue('checkpoints', updated, { shouldValidate: false });
    },
    [form],
  );
  const handleMoveDown = useCallback(
    (index) => {
      const current = form.getValues('checkpoints');
      if (index >= current.length - 1) return;
      const updated = [...current];
      [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
      form.setValue('checkpoints', updated, { shouldValidate: false });
    },
    [form],
  );
  const handleFormSubmit = async (values) => {
    setServerError(null);
    const result = await onSubmit(values);
    if (result?.error) {
      setServerError(result.error);
    } else {
      const templateId = result?.template?.id;
      form.reset();
      onOpenChange(false);
      onSuccess(templateId);
    }
  };
  const handleOpenChange = (newOpen) => {
    if (!newOpen) {
      form.reset();
      setServerError(null);
    }
    onOpenChange(newOpen);
  };
  const checkpointErrors = form.formState.errors.checkpoints;
  return _jsx(Dialog, {
    open: open,
    onOpenChange: handleOpenChange,
    children: _jsxs(DialogContent, {
      className: 'sm:max-w-[580px]',
      children: [
        _jsxs(DialogHeader, {
          children: [
            _jsx(DialogTitle, { children: t('adminTemplates.newTemplate') }),
            _jsx(DialogDescription, { children: t('adminTemplates.createPrompt') }),
          ],
        }),
        serverError &&
          _jsxs('div', {
            className: 'rounded-md bg-destructive/10 p-3 text-sm text-destructive',
            children: [t('common.error'), ': ', serverError],
          }),
        _jsx(Form, {
          ...form,
          children: _jsxs('form', {
            onSubmit: form.handleSubmit(handleFormSubmit),
            className: 'space-y-4',
            children: [
              _jsx(FormField, {
                control: form.control,
                name: 'name',
                render: ({ field }) =>
                  _jsxs(FormItem, {
                    children: [
                      _jsx(FormLabel, { children: t('adminTemplates.form.name') }),
                      _jsx(FormControl, {
                        children: _jsx(Input, {
                          placeholder: t('adminTemplates.form.namePlaceholder'),
                          ...field,
                        }),
                      }),
                      _jsx(FormMessage, {}),
                    ],
                  }),
              }),
              _jsx(FormField, {
                control: form.control,
                name: 'type',
                render: ({ field }) =>
                  _jsxs(FormItem, {
                    children: [
                      _jsx(FormLabel, { children: t('adminTemplates.form.type') }),
                      _jsx(FormControl, {
                        children: _jsx(Input, {
                          placeholder: t('adminTemplates.form.typePlaceholder'),
                          ...field,
                        }),
                      }),
                      _jsx(FormMessage, {}),
                    ],
                  }),
              }),
              _jsx(FormField, {
                control: form.control,
                name: 'checkpoints',
                render: () =>
                  _jsxs(FormItem, {
                    children: [
                      _jsx(FormLabel, { children: t('adminTemplates.form.checkpoints') }),
                      _jsx(FormControl, {
                        children: _jsx('div', {
                          className: 'max-h-72 overflow-y-auto pr-1 -mr-1 space-y-0',
                          children: _jsx(CheckpointListEditor, {
                            checkpoints: checkpointValues,
                            onAdd: handleAddCheckpoint,
                            onRemove: handleRemoveCheckpoint,
                            onChange: handleCheckpointChange,
                            onMinConsultationsChange: handleMinConsultationsChange,
                            onEstimatedDurationChange: handleEstimatedDurationChange,
                            onMoveUp: handleMoveUp,
                            onMoveDown: handleMoveDown,
                            errors: checkpointValues.map((_, i) => checkpointErrors?.[i]?.message),
                          }),
                        }),
                      }),
                      checkpointErrors?.message &&
                        _jsx('p', {
                          className: 'text-sm text-destructive mt-1',
                          children: checkpointErrors.message,
                        }),
                    ],
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
                    type: 'submit',
                    loading: form.formState.isSubmitting,
                    children: t('common.create'),
                  }),
                ],
              }),
            ],
          }),
        }),
      ],
    }),
  });
}
