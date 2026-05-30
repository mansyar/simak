import { ProfileSection } from './ProfileSection';
import { PasswordSection } from './PasswordSection';
import { AppearanceSection } from './AppearanceSection';
import { AccessibilitySection } from './AccessibilitySection';
import { TwoFactorSettings } from './TwoFactorSettings';
import { SessionManagement } from './SessionManagement';

export function SettingsPage() {
  return (
    <div className="container mx-auto max-w-2xl space-y-8 py-8">
      <ProfileSection />
      <PasswordSection />
      <TwoFactorSettings />
      <SessionManagement />
      <AppearanceSection />
      <AccessibilitySection />
    </div>
  );
}
