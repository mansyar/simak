import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { ProfileSection } from './ProfileSection';
import { PasswordSection } from './PasswordSection';
import { AppearanceSection } from './AppearanceSection';
import { AccessibilitySection } from './AccessibilitySection';
import { TwoFactorSettings } from './TwoFactorSettings';
import { SessionManagement } from './SessionManagement';
export function SettingsPage() {
  return _jsxs('div', {
    className: 'space-y-6',
    children: [
      _jsx(ProfileSection, {}),
      _jsx(PasswordSection, {}),
      _jsx(TwoFactorSettings, {}),
      _jsx(SessionManagement, {}),
      _jsx(AppearanceSection, {}),
      _jsx(AccessibilitySection, {}),
    ],
  });
}
