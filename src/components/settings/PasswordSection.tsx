import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KeyRound, Loader2 } from 'lucide-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { authClient } from '@/lib/auth-client';
import { useI18n } from '@/routes/__root';

export function PasswordSection() {
  const { t } = useI18n();

  const formSchema = z
    .object({
      currentPassword: z.string().min(1, t('settings.password.currentPasswordRequired')),
      newPassword: z.string().min(8, t('settings.password.passwordMinLength')),
      confirmPassword: z.string(),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: t('settings.password.passwordMismatch'),
      path: ['confirmPassword'],
    });

  type FormValues = z.infer<typeof formSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    mode: 'onBlur',
  });

  const handleFormSubmit = async (values: FormValues) => {
    try {
      await authClient.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      toast.success(t('settings.password.passwordSuccess'));
      form.reset();
    } catch {
      form.setError('root', { message: t('settings.password.passwordError') });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          {t('settings.password.title')}
        </CardTitle>
        <CardDescription>{t('settings.password.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('settings.password.currentPassword')}</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      aria-label={t('settings.password.currentPassword')}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('settings.password.newPassword')}</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      aria-label={t('settings.password.newPassword')}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('settings.password.confirmPassword')}</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      aria-label={t('settings.password.confirmPassword')}
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
                t('settings.password.changePassword')
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
