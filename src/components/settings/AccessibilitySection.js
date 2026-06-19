import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accessibility } from 'lucide-react';
import { getCurrentUser, updateUserSettings } from '@/server/settings';
import { useI18n } from '@/routes/__root';
export function AccessibilitySection() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const result = await getCurrentUser();
      return result;
    },
  });
  const reducedMotion = data?.settings?.reducedMotion ?? false;
  const updateSettingsMutation = useMutation({
    mutationFn: async (args) => {
      const result = await updateUserSettings({ data: { reducedMotion: args.reducedMotion } });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    },
  });
  const handleToggle = () => {
    updateSettingsMutation.mutateAsync({ reducedMotion: !reducedMotion });
  };
  if (isLoading) {
    return _jsx(Card, {
      children: _jsx(CardContent, {
        className: 'flex items-center justify-center py-8',
        children: t('common.loading'),
      }),
    });
  }
  return _jsxs(Card, {
    children: [
      _jsxs(CardHeader, {
        children: [
          _jsxs(CardTitle, {
            className: 'flex items-center gap-2',
            children: [
              _jsx(Accessibility, { className: 'h-5 w-5' }),
              t('settings.accessibility.title'),
            ],
          }),
          _jsx(CardDescription, { children: t('settings.accessibility.description') }),
        ],
      }),
      _jsx(CardContent, {
        children: _jsxs('div', {
          className: 'flex items-center justify-between',
          children: [
            _jsxs('div', {
              className: 'space-y-0.5',
              children: [
                _jsx('label', {
                  htmlFor: 'reduced-motion',
                  className:
                    'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
                  children: t('settings.accessibility.reducedMotionLabel'),
                }),
                _jsx('p', {
                  className: 'text-sm text-muted-foreground',
                  children: t('settings.accessibility.reducedMotionHint'),
                }),
              ],
            }),
            _jsx('input', {
              id: 'reduced-motion',
              type: 'checkbox',
              checked: reducedMotion,
              onChange: handleToggle,
              className: 'h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary',
            }),
          ],
        }),
      }),
    ],
  });
}
