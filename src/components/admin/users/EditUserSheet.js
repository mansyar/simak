import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { UpdateUserSchema } from '@/server/users';
import { useEffect } from 'react';
import { useI18n } from '../../../routes/__root';
export function EditUserSheet({ user, open, onOpenChange, onSubmit }) {
  const { t } = useI18n();
  const form = useForm({
    resolver: zodResolver(UpdateUserSchema),
    defaultValues: {
      name: '',
      email: '',
    },
  });
  useEffect(() => {
    if (user) {
      form.reset({
        name: user.name,
        email: user.email,
      });
    }
  }, [user, form]);
  const handleFormSubmit = async (values) => {
    if (user) {
      await onSubmit(user.id, values);
      onOpenChange(false);
    }
  };
  return _jsx(Sheet, {
    open: open,
    onOpenChange: onOpenChange,
    children: _jsxs(SheetContent, {
      children: [
        _jsxs(SheetHeader, {
          children: [
            _jsx(SheetTitle, { children: t('adminUsers.edit') }),
            _jsx(SheetDescription, { children: t('adminUsers.editDescription') }),
          ],
        }),
        _jsx(Form, {
          ...form,
          children: _jsxs('form', {
            onSubmit: form.handleSubmit(handleFormSubmit),
            className: 'space-y-4 mt-6',
            children: [
              _jsx(FormField, {
                control: form.control,
                name: 'name',
                render: ({ field }) =>
                  _jsxs(FormItem, {
                    children: [
                      _jsx(FormLabel, { children: t('adminUsers.table.name') }),
                      _jsx(FormControl, {
                        children: _jsx(Input, {
                          placeholder: t('common.namePlaceholder'),
                          ...field,
                        }),
                      }),
                      _jsx(FormMessage, {}),
                    ],
                  }),
              }),
              _jsx(FormField, {
                control: form.control,
                name: 'email',
                render: ({ field }) =>
                  _jsxs(FormItem, {
                    children: [
                      _jsx(FormLabel, { children: t('auth.email') }),
                      _jsx(FormControl, {
                        children: _jsx(Input, {
                          placeholder: t('common.emailPlaceholder'),
                          ...field,
                        }),
                      }),
                      _jsx(FormMessage, {}),
                    ],
                  }),
              }),
              _jsx(SheetFooter, {
                className: 'mt-6',
                children: _jsx(Button, {
                  type: 'submit',
                  loading: form.formState.isSubmitting,
                  className: 'w-full',
                  children: t('common.save'),
                }),
              }),
            ],
          }),
        }),
      ],
    }),
  });
}
