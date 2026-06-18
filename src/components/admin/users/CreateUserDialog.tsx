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
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { CreateUserSchema } from '@/server/users';
import { useI18n } from '../../../routes/__root';
import type { TranslationKey } from '../../../i18n/index';

type CreateUserFormValues = z.infer<typeof CreateUserSchema>;

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: CreateUserFormValues) => Promise<void>;
}

export function CreateUserDialog({ open, onOpenChange, onSubmit }: CreateUserDialogProps) {
  const { t } = useI18n();
  const form = useForm<CreateUserFormValues>({
    resolver: zodResolver(CreateUserSchema),
    defaultValues: {
      name: '',
      email: '',
      role: 'student',
    },
  });

  const handleFormSubmit = async (values: CreateUserFormValues) => {
    await onSubmit(values);
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('adminUsers.newUser')}</DialogTitle>
          <DialogDescription>{t('adminUsers.createPrompt')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('adminUsers.table.name')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('common.namePlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('auth.email')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('common.emailPlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('adminUsers.table.role')}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <span data-slot="select-value" className="flex flex-1 text-left">
                          {field.value
                            ? t(('adminUsers.role_' + field.value) as TranslationKey)
                            : t('adminUsers.table.role')}
                        </span>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="admin">{t('adminUsers.role_admin')}</SelectItem>
                      <SelectItem value="instructor">{t('adminUsers.role_instructor')}</SelectItem>
                      <SelectItem value="student">{t('adminUsers.role_student')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
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
