import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useI18n } from '../../../routes/__root';
import type { TranslationKey } from '../../../i18n/index';
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
import { requestExtension } from '@/server/extensions';
import { isServerError } from '@/lib/errors';
import { MutationFeedback } from '@/components/ui/mutation-feedback';

interface CheckpointOption {
  id: number;
  name: string;
}

interface ExtensionRequestFormProps {
  assignmentId: number;
  maxExtensionDays: number;
  maxTotalExtensions: number;
  checkpoints: CheckpointOption[];
  onSuccess: () => void;
}

const CATEGORY_OPTIONS = ['personal', 'research', 'health', 'other'] as const;

export function ExtensionRequestForm({
  assignmentId,
  maxExtensionDays,
  maxTotalExtensions: _maxTotalExtensions,
  checkpoints,
  onSuccess,
}: ExtensionRequestFormProps) {
  const { t } = useI18n();
  const [success, setSuccess] = useState(false);

  const formSchema = z.object({
    category: z.string().min(1, t('extensions.errors.categoryRequired')),
    reason: z.string().min(10, t('extensions.errors.reasonMin')),
    duration: z
      .string()
      .refine((val) => val !== '' && Number(val) >= 1, t('extensions.errors.durationMin'))
      .refine(
        (val) => val !== '' && Number(val) <= maxExtensionDays,
        t('extensions.errors.durationMax').replace('{max}', String(maxExtensionDays)),
      ),
    checkpointId: z.string().optional(),
  });

  type FormValues = z.infer<typeof formSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      category: '',
      reason: '',
      duration: '',
      checkpointId: '',
    },
    mode: 'onBlur',
  });

  const reasonValue = form.watch('reason') || '';

  const charDisplay =
    reasonValue.length > 0 ? (
      <p className="text-xs text-muted-foreground mt-1 text-right">
        {reasonValue.length < 10
          ? t('extensions.reasonMinChars').replace('{count}', '10')
          : t('extensions.reasonCharacterCount', { count: String(reasonValue.length) })}
      </p>
    ) : null;

  const handleFormSubmit = async (values: FormValues) => {
    try {
      const result = await requestExtension({
        data: {
          assignmentId,
          category: values.category as 'personal' | 'research' | 'health' | 'other',
          reason: values.reason,
          extensionDays: Number(values.duration),
          ...(values.checkpointId ? { checkpointId: Number(values.checkpointId) } : {}),
        },
      });

      if (isServerError(result)) {
        form.setError('root', { message: t('extensions.errors.submitFailed') });
        return;
      }

      setSuccess(true);
      form.reset();
      onSuccess();
    } catch {
      form.setError('root', { message: t('extensions.errors.submitFailed') });
    }
  };

  if (success) {
    return (
      <div className="rounded-lg border bg-card p-5 shadow-sm">
        <MutationFeedback success={t('extensions.successMessage')} />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('extensions.category')}</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t('extensions.categoryPlaceholder')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {t(
                        `extensions.category${cat.charAt(0).toUpperCase() + cat.slice(1)}` as TranslationKey,
                      )}
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
          name="reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('extensions.reason')}</FormLabel>
              <FormControl>
                <textarea
                  rows={4}
                  placeholder={t('extensions.reasonPlaceholder')}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  {...field}
                />
              </FormControl>
              {charDisplay}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="duration"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('extensions.duration')}</FormLabel>
              <FormControl>
                <Input type="number" min={1} max={maxExtensionDays} placeholder="1" {...field} />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                {t('extensions.durationHint')} (
                {t('extensions.durationMaxHint', { max: String(maxExtensionDays) })})
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        {checkpoints.length > 0 && (
          <FormField
            control={form.control}
            name="checkpointId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('extensions.checkpoint')}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t('extensions.checkpointHint')} />
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
        )}

        {form.formState.errors.root && (
          <MutationFeedback error={form.formState.errors.root.message} />
        )}

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('extensions.submitting')}
            </>
          ) : (
            t('extensions.submit')
          )}
        </Button>
      </form>
    </Form>
  );
}
