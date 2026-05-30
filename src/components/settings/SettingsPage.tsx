import { ProfileSection } from './ProfileSection';
import { PasswordSection } from './PasswordSection';
import { AppearanceSection } from './AppearanceSection';
import { AccessibilitySection } from './AccessibilitySection';
import { TwoFactorSettings } from './TwoFactorSettings';
import { SessionManagement } from './SessionManagement';

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <ProfileSection />
      <PasswordSection />
      <TwoFactorSettings />
      <SessionManagement />
      <AppearanceSection />
      <AccessibilitySection />
    </div>
  );
}
