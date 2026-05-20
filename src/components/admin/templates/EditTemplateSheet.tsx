import { useState, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
import { UpdateTemplateSchema } from '@/server/templates';
import { useI18n } from '../../../routes/__root';
import { AlertTriangle } from 'lucide-react';

type EditTemplateFormValues = z.infer<typeof UpdateTemplateSchema>;

interface EditTemplateSheetProps {
  template: {
    id: number;
    name: string;
    type: string;
    checkpoints: { id: number; name: string; order: number }[];
    assignmentCount?: number;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (id: number, values: EditTemplateFormValues) => Promise<{ error?: string }>;
  onSuccess: () => void;
}

export function EditTemplateSheet({
  template,
  open,
  onOpenChange,
  onSubmit,
  onSuccess,
}: EditTemplateSheetProps) {
  const { t } = useI18n();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<EditTemplateFormValues>({
    resolver: zodResolver(UpdateTemplateSchema),
    defaultValues: {
      name: '',
      type: '',
      checkpoints: [''],
    },
  });

  // Reset form when template data changes
  useEffect(() => {
    if (template) {
      form.reset({
        name: template.name,
        type: template.type,
        checkpoints: template.checkpoints.map((cp) => cp.name),
      });
      setServerError(null);
    }
  }, [template, form]);

  const checkpointValues = form.watch('checkpoints');

  const handleAddCheckpoint = useCallback(() => {
    const current = form.getValues('checkpoints');
    form.setValue('checkpoints', [...current, ''], { shouldValidate: false });
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
      updated[index] = value;
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

  const handleFormSubmit = async (values: EditTemplateFormValues) => {
    if (!template) return;
    setServerError(null);
    const result = await onSubmit(template.id, values);
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
      setServerError(null);
    }
    onOpenChange(newOpen);
  };

  const checkpointErrors = form.formState.errors.checkpoints as
    | { message?: string; [key: number]: { message?: string } }
    | undefined;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="sm:max-w-[500px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t('adminTemplates.edit')}</SheetTitle>
          <SheetDescription>Edit template name, type, and checkpoints.</SheetDescription>
        </SheetHeader>

        {template && template.assignmentCount && template.assignmentCount > 0 && (
          <div className="mt-4 flex items-start gap-2 rounded-md bg-muted p-3 text-sm">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
            <span className="text-muted-foreground">
              {t('adminTemplates.inUseBanner', { count: String(template.assignmentCount) })}
            </span>
          </div>
        )}

        {serverError && (
          <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {t('common.error')}: {serverError}
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 mt-6">
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

            <SheetFooter className="mt-6">
              <Button type="submit" loading={form.formState.isSubmitting} className="w-full">
                {t('common.save')}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
