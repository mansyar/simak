import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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

type CreateTemplateFormValues = z.infer<typeof CreateTemplateSchema>;

interface CreateTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: CreateTemplateFormValues) => Promise<{ error?: string; template?: unknown }>;
  onSuccess: () => void;
}

const defaultCheckpoint = () => ({ name: '', minConsultations: 0 });

export function CreateTemplateDialog({
  open,
  onOpenChange,
  onSubmit,
  onSuccess,
}: CreateTemplateDialogProps) {
  const { t } = useI18n();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<CreateTemplateFormValues>({
    resolver: zodResolver(CreateTemplateSchema) as any,
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
    (index: number) => {
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
    (index: number, value: string) => {
      const current = form.getValues('checkpoints');
      const updated = [...current];
      updated[index] = { ...updated[index], name: value };
      form.setValue('checkpoints', updated, { shouldValidate: false });
    },
    [form],
  );

  const handleMinConsultationsChange = useCallback(
    (index: number, value: number) => {
      const current = form.getValues('checkpoints');
      const updated = [...current];
      updated[index] = { ...updated[index], minConsultations: value };
      form.setValue('checkpoints', updated, { shouldValidate: false });
    },
    [form],
  );

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index === 0) return;
      const current = form.getValues('checkpoints');
      const updated = [...current];
      [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
      form.setValue('checkpoints', updated, { shouldValidate: false });
    },
    [form],
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      const current = form.getValues('checkpoints');
      if (index >= current.length - 1) return;
      const updated = [...current];
      [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
      form.setValue('checkpoints', updated, { shouldValidate: false });
    },
    [form],
  );

  const handleFormSubmit = async (values: CreateTemplateFormValues) => {
    setServerError(null);
    const result = await onSubmit(values);
    if (result?.error) {
      setServerError(result.error);
    } else {
      form.reset();
      onOpenChange(false);
      onSuccess();
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
      setServerError(null);
    }
    onOpenChange(newOpen);
  };

  const checkpointErrors = form.formState.errors.checkpoints as
    | { message?: string; [key: number]: { message?: string } }
    | undefined;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('adminTemplates.newTemplate')}</DialogTitle>
          <DialogDescription>{t('adminTemplates.createPrompt')}</DialogDescription>
        </DialogHeader>

        {serverError && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {t('common.error')}: {serverError}
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('adminTemplates.form.name')}</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Thesis Template" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('adminTemplates.form.type')}</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Thesis, Research Paper" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="checkpoints"
              render={() => (
                <FormItem>
                  <FormLabel>{t('adminTemplates.form.checkpoints')}</FormLabel>
                  <FormControl>
                    <CheckpointListEditor
                      checkpoints={checkpointValues}
                      onAdd={handleAddCheckpoint}
                      onRemove={handleRemoveCheckpoint}
                      onChange={handleCheckpointChange}
                      onMinConsultationsChange={handleMinConsultationsChange}
                      onMoveUp={handleMoveUp}
                      onMoveDown={handleMoveDown}
                      errors={checkpointValues.map((_, i) => checkpointErrors?.[i]?.message)}
                    />
                  </FormControl>
                  {checkpointErrors?.message && (
                    <p className="text-sm text-destructive mt-1">{checkpointErrors.message}</p>
                  )}
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" loading={form.formState.isSubmitting}>
                {t('common.create')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
