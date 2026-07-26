import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SaveGradeConfigSchema } from '@/server/gradebook';
import { useI18n } from '@/routes/__root';

type SaveGradeConfigFormValues = z.infer<typeof SaveGradeConfigSchema>;

interface GradeSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignmentId: number;
  config: {
    gradingScheme: 'equal_weight' | 'custom_weight';
    customWeights: Record<string, number> | null;
    letterGradeBounds: Record<string, number>;
  } | null;
  checkpoints: Array<{ id: string; name: string }>;
  onSubmit: (values: SaveGradeConfigFormValues) => Promise<void>;
}

const LETTERS = ['A', 'B', 'C', 'D'] as const;

export function GradeSettingsDialog({
  open,
  onOpenChange,
  assignmentId,
  config,
  checkpoints,
  onSubmit,
}: GradeSettingsDialogProps) {
  const { t } = useI18n();
  const form = useForm<SaveGradeConfigFormValues>({
    resolver: zodResolver(SaveGradeConfigSchema),
    defaultValues: {
      assignmentId,
      gradingScheme: config?.gradingScheme ?? 'equal_weight',
      customWeights: config?.customWeights ?? null,
      letterGradeBounds: (config?.letterGradeBounds ?? {
        A: 90,
        B: 80,
        C: 70,
        D: 60,
      }) as { A: number; B: number; C: number; D: number },
    },
  });

  const gradingScheme = form.watch('gradingScheme');

  const handleFormSubmit = async (values: SaveGradeConfigFormValues) => {
    try {
      await onSubmit(values);
      toast.success(t('gradebook.settings.saveSuccess'));
      onOpenChange(false);
    } catch {
      // Error handled by parent
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('gradebook.settings.title')}</DialogTitle>
          <DialogDescription>{t('gradebook.settings.scheme')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="gradingScheme"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('gradebook.settings.scheme')}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="equal_weight">
                        {t('gradebook.settings.equalWeight')}
                      </SelectItem>
                      <SelectItem value="custom_weight">
                        {t('gradebook.settings.customWeight')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {gradingScheme === 'custom_weight' && (
              <div data-testid="custom-weights-section" className="space-y-3">
                <FormLabel>{t('gradebook.settings.customWeights')}</FormLabel>
                {checkpoints.map((cp) => (
                  <FormField
                    key={cp.id}
                    control={form.control}
                    name={`customWeights.${cp.id}` as `customWeights.${string}`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{cp.name}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            )}

            <div className="space-y-3">
              <FormLabel>{t('gradebook.settings.letterBounds')}</FormLabel>
              {LETTERS.map((letter) => (
                <FormField
                  key={letter}
                  control={form.control}
                  name={`letterGradeBounds.${letter}` as `letterGradeBounds.${typeof letter}`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{letter}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>

            <DialogFooter>
              <Button type="submit" loading={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? t('gradebook.settings.saving')
                  : t('gradebook.settings.save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
