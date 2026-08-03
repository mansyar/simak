import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell } from 'lucide-react';
import { getCurrentUser, updateUserSettings } from '@/server/settings';
import { useI18n } from '@/routes/__root';
import { settingsKeys } from '@/lib/query-keys';
import type { TranslationKey } from '@/i18n/index';

type NotificationChannel = 'email' | 'inApp';
type NotificationPrefs = Record<string, { email?: boolean; inApp?: boolean }>;

type NotificationTypeConfig = {
  type: string;
  labelKey: TranslationKey;
  descKey: TranslationKey;
  emailAlwaysOn?: boolean;
};

type NotificationPrefGroup = {
  labelKey: TranslationKey;
  types: NotificationTypeConfig[];
};

const NOTIFICATION_PREF_GROUPS: NotificationPrefGroup[] = [
  {
    labelKey: 'settings.notificationPreferences.groups.reviews',
    types: [
      {
        type: 'review_completed',
        labelKey: 'settings.notificationPreferences.types.review_completed.label',
        descKey: 'settings.notificationPreferences.types.review_completed.description',
      },
      {
        type: 'revision_requested',
        labelKey: 'settings.notificationPreferences.types.revision_requested.label',
        descKey: 'settings.notificationPreferences.types.revision_requested.description',
      },
    ],
  },
  {
    labelKey: 'settings.notificationPreferences.groups.consultations',
    types: [
      {
        type: 'consultation_logged',
        labelKey: 'settings.notificationPreferences.types.consultation_logged.label',
        descKey: 'settings.notificationPreferences.types.consultation_logged.description',
      },
      {
        type: 'consultation_verified',
        labelKey: 'settings.notificationPreferences.types.consultation_verified.label',
        descKey: 'settings.notificationPreferences.types.consultation_verified.description',
      },
      {
        type: 'consultation_rejected',
        labelKey: 'settings.notificationPreferences.types.consultation_rejected.label',
        descKey: 'settings.notificationPreferences.types.consultation_rejected.description',
      },
    ],
  },
  {
    labelKey: 'settings.notificationPreferences.groups.submissions',
    types: [
      {
        type: 'submission_received',
        labelKey: 'settings.notificationPreferences.types.submission_received.label',
        descKey: 'settings.notificationPreferences.types.submission_received.description',
      },
      {
        type: 'extension_requested',
        labelKey: 'settings.notificationPreferences.types.extension_requested.label',
        descKey: 'settings.notificationPreferences.types.extension_requested.description',
      },
      {
        type: 'extension_approved',
        labelKey: 'settings.notificationPreferences.types.extension_approved.label',
        descKey: 'settings.notificationPreferences.types.extension_approved.description',
      },
      {
        type: 'extension_rejected',
        labelKey: 'settings.notificationPreferences.types.extension_rejected.label',
        descKey: 'settings.notificationPreferences.types.extension_rejected.description',
      },
      {
        type: 'deadline_extended',
        labelKey: 'settings.notificationPreferences.types.deadline_extended.label',
        descKey: 'settings.notificationPreferences.types.deadline_extended.description',
      },
      {
        type: 'deadline_reminder',
        labelKey: 'settings.notificationPreferences.types.deadline_reminder.label',
        descKey: 'settings.notificationPreferences.types.deadline_reminder.description',
      },
    ],
  },
  {
    labelKey: 'settings.notificationPreferences.groups.system',
    types: [
      {
        type: 'sla_breach',
        labelKey: 'settings.notificationPreferences.types.sla_breach.label',
        descKey: 'settings.notificationPreferences.types.sla_breach.description',
        emailAlwaysOn: true,
      },
    ],
  },
];

export function NotificationPreferencesSection() {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: settingsKeys.currentUser(),
    queryFn: async () => {
      const result = await getCurrentUser();
      return result as {
        user: { id: string; name: string; email: string; image: string | null } | null;
        settings: {
          reducedMotion?: boolean;
          notificationPrefs?: NotificationPrefs;
        } | null;
        error?: string;
      };
    },
  });

  const prefs: NotificationPrefs = data?.settings?.notificationPrefs ?? {};

  const updateSettingsMutation = useMutation({
    mutationFn: async (args: { notificationPrefs: NotificationPrefs }) => {
      const result = await updateUserSettings({
        data: { notificationPrefs: args.notificationPrefs },
      });
      return result as { notificationPrefs?: NotificationPrefs; error?: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.currentUser() });
    },
  });

  const handleToggle = (type: string, channel: NotificationChannel, current: boolean) => {
    const newPrefs: NotificationPrefs = { ...prefs };
    newPrefs[type] = { ...newPrefs[type], [channel]: !current };
    updateSettingsMutation.mutateAsync({ notificationPrefs: newPrefs }).catch(() => {});
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
          <Bell className="h-5 w-5" />
          {t('settings.notificationPreferences.title')}
        </CardTitle>
        <CardDescription>{t('settings.notificationPreferences.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {NOTIFICATION_PREF_GROUPS.map((group) => (
          <div key={group.labelKey} className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">{t(group.labelKey)}</h2>
            <div className="space-y-4">
              {group.types.map(({ type, labelKey, descKey, emailAlwaysOn }) => {
                const typePrefs = prefs[type] ?? {};
                const emailEnabled = typePrefs.email !== false;
                const inAppEnabled = typePrefs.inApp !== false;
                return (
                  <div key={type} className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium leading-none">{t(labelKey)}</p>
                      <p className="text-sm text-muted-foreground">{t(descKey)}</p>
                    </div>
                    <div className="flex gap-4">
                      {emailAlwaysOn ? null : (
                        <div className="flex items-center gap-2">
                          <input
                            id={`notif-${type}-email`}
                            type="checkbox"
                            checked={emailEnabled}
                            onChange={() => handleToggle(type, 'email', emailEnabled)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <label
                            htmlFor={`notif-${type}-email`}
                            className="text-sm text-muted-foreground"
                          >
                            {t('settings.notificationPreferences.channels.email')}
                          </label>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <input
                          id={`notif-${type}-inApp`}
                          type="checkbox"
                          checked={inAppEnabled}
                          onChange={() => handleToggle(type, 'inApp', inAppEnabled)}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <label
                          htmlFor={`notif-${type}-inApp`}
                          className="text-sm text-muted-foreground"
                        >
                          {t('settings.notificationPreferences.channels.inApp')}
                        </label>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
