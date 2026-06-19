import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User } from 'lucide-react';
import { getCurrentUser, updateProfile } from '@/server/settings';
import { useI18n } from '@/routes/__root';
export function ProfileSection() {
  const { t } = useI18n();
  const { data, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const result = await getCurrentUser();
      return result;
    },
  });
  const [name, setName] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (data?.user?.name) {
      setName(data.user.name);
    }
  }, [data?.user?.name]);
  const updateNameMutation = useMutation({
    mutationFn: async (args) => {
      const result = await updateProfile({ data: { name: args.name } });
      return result;
    },
  });
  const handleSaveName = async () => {
    setSuccess('');
    setError('');
    try {
      await updateNameMutation.mutateAsync({ name });
      setSuccess(t('settings.profile.nameSuccess'));
    } catch {
      setError(t('settings.profile.nameError'));
    }
  };
  const getInitials = (fullName) => {
    return fullName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };
  if (isLoading) {
    return _jsx(Card, {
      children: _jsx(CardContent, {
        className: 'flex items-center justify-center py-8',
        children: t('common.loading'),
      }),
    });
  }
  const user = data?.user;
  return _jsxs(Card, {
    children: [
      _jsx(CardHeader, {
        children: _jsxs(CardTitle, {
          className: 'flex items-center gap-2',
          children: [_jsx(User, { className: 'h-5 w-5' }), t('settings.profile.title')],
        }),
      }),
      _jsxs(CardContent, {
        className: 'space-y-6',
        children: [
          _jsx('div', {
            className: 'flex items-center gap-4',
            children: _jsx('div', {
              className:
                'h-16 w-16 rounded-full bg-muted flex items-center justify-center overflow-hidden',
              'aria-label': t('settings.profile.avatarLabel'),
              children: user?.image
                ? _jsx('img', {
                    src: user.image,
                    alt: user.name,
                    className: 'h-full w-full object-cover',
                  })
                : _jsx('span', {
                    className: 'text-lg font-semibold text-muted-foreground',
                    children: user?.name ? getInitials(user.name) : '??',
                  }),
            }),
          }),
          _jsxs('div', {
            className: 'space-y-2',
            children: [
              _jsx(Label, { htmlFor: 'profile-name', children: t('settings.profile.nameLabel') }),
              _jsxs('div', {
                className: 'flex gap-2',
                children: [
                  _jsx(Input, {
                    id: 'profile-name',
                    value: name,
                    onChange: (e) => setName(e.target.value),
                  }),
                  _jsx(Button, {
                    onClick: handleSaveName,
                    disabled: updateNameMutation.isPending,
                    children: t('settings.profile.saveName'),
                  }),
                ],
              }),
            ],
          }),
          _jsxs('div', {
            className: 'space-y-2',
            children: [
              _jsx(Label, { children: t('settings.profile.emailLabel') }),
              _jsx('p', {
                className: 'text-sm text-muted-foreground',
                children: user?.email ?? '',
              }),
            ],
          }),
          success &&
            _jsx('div', {
              className:
                'text-sm text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400 p-3 rounded-md',
              children: success,
            }),
          error &&
            _jsx('div', {
              className: 'text-sm text-destructive bg-destructive/10 p-3 rounded-md',
              children: error,
            }),
        ],
      }),
    ],
  });
}
