import { ProfileSection } from './ProfileSection';
import { PasswordSection } from './PasswordSection';
import { AppearanceSection } from './AppearanceSection';
import { AccessibilitySection } from './AccessibilitySection';
import { NotificationPreferencesSection } from './NotificationPreferencesSection';
import { TwoFactorSettings } from './TwoFactorSettings';
import { SessionManagement } from './SessionManagement';
import { TimezoneSettingsSection } from './TimezoneSettingsSection';
import { CalendarFeedSettingsSection } from './CalendarFeedSettingsSection';

export function SettingsPage({ studentOnly = false }: { studentOnly?: boolean }) {
  return (
    <div className="space-y-6">
      <ProfileSection />
      <PasswordSection />
      <TwoFactorSettings />
      <SessionManagement />
      <AppearanceSection />
      <AccessibilitySection />
      <NotificationPreferencesSection />
      {studentOnly && (
        <>
          <TimezoneSettingsSection />
          <CalendarFeedSettingsSection />
        </>
      )}
    </div>
  );
}
