import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Globe } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCurrentUser, updateUserSettings } from '@/server/settings';
import { useI18n } from '@/routes/__root';
import { settingsKeys } from '@/lib/query-keys';
import { DEFAULT_TIME_ZONE, isValidTimeZone, resolveTimeZone } from '@/lib/timezone';

type TimezoneSettings = {
  timezone?: string;
};

type CurrentUserResponse = {
  settings: TimezoneSettings | null;
};

type SaveStatus = 'idle' | 'saved' | 'invalid' | 'error';

export function TimezoneSettingsSection() {
  const { t } = useI18n();
  const [detectedTimezone, setDetectedTimezone] = useState<string>();
  const [hydrated, setHydrated] = useState(false);
  const [manualTimezone, setManualTimezone] = useState('');
  const [status, setStatus] = useState<SaveStatus>('idle');

  const { data, isLoading } = useQuery({
    queryKey: settingsKeys.currentUser(),
    queryFn: async () => (await getCurrentUser()) as CurrentUserResponse,
  });

  const savedTimezone = isValidTimeZone(data?.settings?.timezone)
    ? data?.settings?.timezone
    : undefined;

  const saveTimezoneMutation = useMutation({
    mutationFn: async (args: { timezone: string }) => {
      return updateUserSettings({ data: { timezone: args.timezone } });
    },
  });

  useEffect(() => {
    if (isLoading || !data) return;

    let browserTimezone: string | undefined;
    try {
      browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      browserTimezone = undefined;
    }

    const resolvedTimezone = resolveTimeZone(undefined, browserTimezone);
    setDetectedTimezone(resolvedTimezone);
    setHydrated(true);

    if (!savedTimezone) {
      saveTimezoneMutation.mutateAsync({ timezone: resolvedTimezone }).catch(() => {});
    }
  }, [data, isLoading, savedTimezone, saveTimezoneMutation.mutateAsync]);

  useEffect(() => {
    if (savedTimezone) {
      setManualTimezone(savedTimezone);
    } else if (detectedTimezone) {
      setManualTimezone(detectedTimezone);
    }
  }, [detectedTimezone, savedTimezone]);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const timezone = manualTimezone.trim() || DEFAULT_TIME_ZONE;

    if (!isValidTimeZone(timezone)) {
      setStatus('invalid');
      return;
    }

    setStatus('idle');
    try {
      await saveTimezoneMutation.mutateAsync({ timezone });
      setStatus('saved');
    } catch {
      setStatus('error');
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

  const isReady = hydrated && Boolean(detectedTimezone || savedTimezone);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" aria-hidden="true" />
          {t('settings.timezone.title')}
        </CardTitle>
        <CardDescription>{t('settings.timezone.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSave}>
          <div className="space-y-2">
            <label htmlFor="student-timezone" className="text-sm font-medium">
              {t('settings.timezone.label')}
            </label>
            <input
              id="student-timezone"
              name="timezone"
              type="text"
              list="student-timezone-options"
              value={manualTimezone}
              onChange={(event) => {
                setManualTimezone(event.target.value);
                setStatus('idle');
              }}
              placeholder={
                isReady ? t('settings.timezone.placeholder') : t('settings.timezone.detecting')
              }
              disabled={!isReady || saveTimezoneMutation.isPending}
              aria-describedby="student-timezone-hint"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
            <datalist id="student-timezone-options">
              <option value="UTC" />
              <option value="Asia/Jakarta" />
              <option value="Asia/Singapore" />
              <option value="Australia/Sydney" />
              <option value="Europe/London" />
              <option value="America/New_York" />
              <option value="America/Los_Angeles" />
            </datalist>
            <p id="student-timezone-hint" className="text-sm text-muted-foreground">
              {isReady ? t('settings.timezone.hint') : t('settings.timezone.detecting')}
            </p>
          </div>
          <button
            type="submit"
            disabled={!isReady || saveTimezoneMutation.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('settings.timezone.save')}
          </button>
          {status === 'saved' && (
            <p role="status" className="text-sm text-green-600">
              {t('settings.timezone.saved')}
            </p>
          )}
          {status === 'invalid' && (
            <p role="alert" className="text-sm text-destructive">
              {t('settings.timezone.invalid')}
            </p>
          )}
          {status === 'error' && (
            <p role="alert" className="text-sm text-destructive">
              {t('settings.timezone.saveError')}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
