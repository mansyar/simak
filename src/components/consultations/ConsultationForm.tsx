import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { logConsultation } from '@/server/consultations';
import { getErrorTranslationKey, isServerError } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useI18n } from '../../routes/__root';

interface CheckpointOption {
  id: number;
  name: string;
}

interface ConsultationFormProps {
  assignmentId: number;
  checkpoints: CheckpointOption[];
  initialCheckpointId?: number | null;
  onSuccess: () => void;
}

export function ConsultationForm({
  assignmentId: _assignmentId,
  checkpoints,
  initialCheckpointId,
  onSuccess,
}: ConsultationFormProps) {
  const { t } = useI18n();

  const formSchema = z
    .object({
      checkpointId: z.string().min(1, t('consultations.errors.checkpointRequired')),
      sessionType: z.enum(['internal', 'external']),
      externalConsultantName: z.string().optional(),
      notes: z.string().min(1, t('consultations.errors.notesRequired')),
    })
    .superRefine((data, ctx) => {
      if (data.sessionType === 'external' && !data.externalConsultantName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t('consultations.errors.externalConsultantNameRequired'),
          path: ['externalConsultantName'],
        });
      }
    });

  type FormValues = z.infer<typeof formSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      checkpointId:
        initialCheckpointId === null || initialCheckpointId === undefined
          ? ''
          : String(initialCheckpointId),
      sessionType: 'internal',
      externalConsultantName: '',
      notes: '',
    },
    mode: 'onBlur',
  });

  useEffect(() => {
    if (initialCheckpointId !== null && initialCheckpointId !== undefined) {
      form.setValue('checkpointId', String(initialCheckpointId));
    }
  }, [form, initialCheckpointId]);

  const sessionType = form.watch('sessionType');

  const handleFormSubmit = async (values: FormValues) => {
    const result = await logConsultation({
      data: {
        checkpointId: Number(values.checkpointId),
        sessionType: values.sessionType,
        externalConsultantName:
          values.sessionType === 'external' ? values.externalConsultantName : undefined,
        notes: values.notes,
      },
    });

    if (isServerError(result)) {
      form.setError('root', { message: t(getErrorTranslationKey(result.error.code)) });
      return;
    }

    form.reset();
    toast.success(t('consultations.logSuccess'));
    onSuccess();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="checkpointId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('consultations.checkpoint')}</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t('consultations.selectCheckpoint')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {checkpoints.map((cp) => (
                    <SelectItem key={cp.id} value={String(cp.id)}>
                      {cp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="sessionType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('consultations.sessionType')}</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="internal">{t('consultations.internal')}</SelectItem>
                  <SelectItem value="external">{t('consultations.external')}</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {sessionType === 'external' && (
          <FormField
            control={form.control}
            name="externalConsultantName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('consultations.externalConsultantName')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('consultations.consultantNamePlaceholder')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('consultations.notes')}</FormLabel>
              <FormControl>
                <textarea
                  placeholder={t('consultations.notesPlaceholder')}
                  rows={3}
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {form.formState.errors.root && (
          <p className="text-sm text-destructive" aria-live="polite">
            {form.formState.errors.root.message}
          </p>
        )}

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('common.loading')}
            </>
          ) : (
            t('consultations.logConsultation')
          )}
        </Button>
      </form>
    </Form>
  );
}
