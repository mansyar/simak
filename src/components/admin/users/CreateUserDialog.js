import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
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
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { CreateUserSchema } from '@/server/users';
import { useI18n } from '../../../routes/__root';
export function CreateUserDialog({ open, onOpenChange, onSubmit }) {
  const { t } = useI18n();
  const form = useForm({
    resolver: zodResolver(CreateUserSchema),
    defaultValues: {
      name: '',
      email: '',
      role: 'student',
    },
  });
  const handleFormSubmit = async (values) => {
    await onSubmit(values);
    form.reset();
    onOpenChange(false);
  };
  return _jsx(Dialog, {
    open: open,
    onOpenChange: onOpenChange,
    children: _jsxs(DialogContent, {
      className: 'sm:max-w-[425px]',
      children: [
        _jsxs(DialogHeader, {
          children: [
            _jsx(DialogTitle, { children: t('adminUsers.newUser') }),
            _jsx(DialogDescription, { children: t('adminUsers.createPrompt') }),
          ],
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
              _jsx(FormField, {
                control: form.control,
                name: 'role',
                render: ({ field }) =>
                  _jsxs(FormItem, {
                    children: [
                      _jsx(FormLabel, { children: t('adminUsers.table.role') }),
                      _jsxs(Select, {
                        value: field.value,
                        onValueChange: field.onChange,
                        children: [
                          _jsx(FormControl, {
                            children: _jsx(SelectTrigger, {
                              children: _jsx('span', {
                                'data-slot': 'select-value',
                                className: 'flex flex-1 text-left',
                                children: field.value
                                  ? t('adminUsers.role_' + field.value)
                                  : t('adminUsers.table.role'),
                              }),
                            }),
                          }),
                          _jsxs(SelectContent, {
                            children: [
                              _jsx(SelectItem, {
                                value: 'admin',
                                children: t('adminUsers.role_admin'),
                              }),
                              _jsx(SelectItem, {
                                value: 'instructor',
                                children: t('adminUsers.role_instructor'),
                              }),
                              _jsx(SelectItem, {
                                value: 'student',
                                children: t('adminUsers.role_student'),
                              }),
                            ],
                          }),
                        ],
                      }),
                      _jsx(FormMessage, {}),
                    ],
                  }),
              }),
              _jsx(DialogFooter, {
                children: _jsx(Button, {
                  type: 'submit',
                  loading: form.formState.isSubmitting,
                  children: t('common.create'),
                }),
              }),
            ],
          }),
        }),
      ],
    }),
  });
}
