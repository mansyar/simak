import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accessibility } from 'lucide-react';
import { getCurrentUser, updateUserSettings } from '@/server/settings';
import { useI18n } from '@/routes/__root';
import { settingsKeys } from '@/lib/query-keys';
import { MutationFeedback } from '@/components/ui/mutation-feedback';

export function AccessibilitySection() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<{ error?: string; success?: string }>({});

  const { data, isLoading } = useQuery({
    queryKey: settingsKeys.accessibility(),
    queryFn: async () => {
      const result = await getCurrentUser();
      return result as {
        user: { id: string; name: string; email: string; image: string | null } | null;
        settings: { reducedMotion?: boolean } | null;
        error?: string;
      };
    },
  });

  const reducedMotion = data?.settings?.reducedMotion ?? false;

  useEffect(() => {
    const root = document.documentElement;

    if (reducedMotion) {
      root.dataset.reducedMotion = 'true';
    } else {
      delete root.dataset.reducedMotion;
    }

    return () => {
      delete root.dataset.reducedMotion;
    };
  }, [reducedMotion]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (args: { reducedMotion: boolean }) => {
      const result = await updateUserSettings({ data: { reducedMotion: args.reducedMotion } });
      return result as { reducedMotion?: boolean; error?: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.accessibility() });
    },
  });

  const handleToggle = async () => {
    setFeedback({});
    try {
      const result = await updateSettingsMutation.mutateAsync({ reducedMotion: !reducedMotion });
      if (result?.error) throw new Error(result.error);
      setFeedback({ success: t('settings.accessibility.saveSuccess') });
    } catch {
      setFeedback({ error: t('settings.accessibility.saveError') });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          {t('common.loading')}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Accessibility className="h-5 w-5" />
          {t('settings.accessibility.title')}
        </CardTitle>
        <CardDescription>{t('settings.accessibility.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <MutationFeedback {...feedback} className="mb-4" />
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <label
              htmlFor="reduced-motion"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {t('settings.accessibility.reducedMotionLabel')}
            </label>
            <p className="text-sm text-muted-foreground">
              {t('settings.accessibility.reducedMotionHint')}
            </p>
          </div>
          <input
            id="reduced-motion"
            type="checkbox"
            checked={reducedMotion}
            onChange={handleToggle}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
        </div>
      </CardContent>
    </Card>
  );
}
