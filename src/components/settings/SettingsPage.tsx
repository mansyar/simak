import type { ReactNode } from 'react';
import type { TranslationKey } from '@/i18n/index';
import { ProfileSection } from './ProfileSection';
import { PasswordSection } from './PasswordSection';
import { AppearanceSection } from './AppearanceSection';
import { AccessibilitySection } from './AccessibilitySection';
import { NotificationPreferencesSection } from './NotificationPreferencesSection';
import { TwoFactorSettings } from './TwoFactorSettings';
import { SessionManagement } from './SessionManagement';
import { TimezoneSettingsSection } from './TimezoneSettingsSection';
import { CalendarFeedSettingsSection } from './CalendarFeedSettingsSection';
import { useI18n } from '@/routes/__root';

type SettingsSectionProps = {
  id: string;
  label: string;
  children: ReactNode;
};

function SettingsSection({ id, label, children }: SettingsSectionProps) {
  return (
    <section id={id} aria-label={label} className="scroll-mt-6">
      {children}
    </section>
  );
}

export function SettingsPage({ studentOnly = false }: { studentOnly?: boolean }) {
  const { t } = useI18n();
  const sections: ReadonlyArray<readonly [string, TranslationKey]> = [
    ['settings-profile', 'settings.navigation.profile'],
    ['settings-password', 'settings.navigation.password'],
    ['settings-two-factor', 'settings.navigation.twoFactor'],
    ['settings-sessions', 'settings.navigation.sessions'],
    ['settings-appearance', 'settings.navigation.appearance'],
    ['settings-accessibility', 'settings.navigation.accessibility'],
    ['settings-notifications', 'settings.navigation.notifications'],
    ...(studentOnly
      ? ([
          ['settings-timezone', 'settings.navigation.timezone'],
          ['settings-calendar', 'settings.navigation.calendar'],
        ] as const)
      : []),
  ];

  return (
    <div className="space-y-6">
      <nav
        aria-label={t('settings.navigation.label')}
        className="flex flex-wrap gap-2 rounded-lg border border-border bg-card p-3"
      >
        {sections.map(([id, labelKey]) => (
          <a
            key={id}
            href={`#${id}`}
            className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {t(labelKey)}
          </a>
        ))}
      </nav>

      <SettingsSection id="settings-profile" label={t('settings.navigation.profile')}>
        <ProfileSection />
      </SettingsSection>
      <SettingsSection id="settings-password" label={t('settings.navigation.password')}>
        <PasswordSection />
      </SettingsSection>
      <SettingsSection id="settings-two-factor" label={t('settings.navigation.twoFactor')}>
        <TwoFactorSettings />
      </SettingsSection>
      <SettingsSection id="settings-sessions" label={t('settings.navigation.sessions')}>
        <SessionManagement />
      </SettingsSection>
      <SettingsSection id="settings-appearance" label={t('settings.navigation.appearance')}>
        <AppearanceSection />
      </SettingsSection>
      <SettingsSection id="settings-accessibility" label={t('settings.navigation.accessibility')}>
        <AccessibilitySection />
      </SettingsSection>
      <SettingsSection id="settings-notifications" label={t('settings.navigation.notifications')}>
        <NotificationPreferencesSection />
      </SettingsSection>
      {studentOnly && (
        <>
          <SettingsSection id="settings-timezone" label={t('settings.navigation.timezone')}>
            <TimezoneSettingsSection />
          </SettingsSection>
          <SettingsSection id="settings-calendar" label={t('settings.navigation.calendar')}>
            <CalendarFeedSettingsSection />
          </SettingsSection>
        </>
      )}
    </div>
  );
}
