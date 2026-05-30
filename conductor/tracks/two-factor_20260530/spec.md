# Track 3.1: Two-Factor Authentication & Session Management

## Overview

Enable TOTP-based two-factor authentication via Better Auth's built-in `twoFactor` plugin. Users can enable/disable 2FA with an authenticator app, generate backup codes, view active sessions, and revoke sessions. This enhances account security by adding a second layer of authentication beyond password.

## Functional Requirements

### 2FA Setup

- Users access 2FA settings from their Profile/Settings page
- User can enable 2FA by scanning a QR code with an authenticator app (TOTP)
- On enable, 8 single-use backup codes are generated and displayed in a modal with:
  - Copy-to-clipboard functionality
  - Download as text file option
  - Warning that codes won't be shown again
- User must confirm they've saved backup codes before 2FA is activated
- User can disable 2FA with current password confirmation
- Email notification sent when 2FA is enabled or disabled

### 2FA Login Flow

- After successful password entry, user is redirected to a dedicated 2FA page
- 2FA page shows a 6-digit TOTP code input field
- User enters code from authenticator app
- Backup code works as fallback when authenticator device is unavailable
- Failed attempts show appropriate error messages

### Session Management

- Active sessions list shows:
  - Device type (parsed from user agent)
  - IP address
  - Last activity timestamp
- User can revoke specific sessions
- User can revoke all other sessions at once
- Current session is clearly indicated

## Non-Functional Requirements

- 2FA setup and login flows must be accessible (WCAG 2.1 AA)
- Backup codes must be cryptographically random and single-use
- Session revocation must immediately invalidate the session token
- All 2FA actions are logged in the audit log
- Bilingual support (English and Indonesian) for all UI elements

## Acceptance Criteria

- [ ] User can enable 2FA via authenticator app (TOTP QR code)
- [ ] Backup codes (8) displayed on enable; user must confirm they've saved them
- [ ] Login prompts for 6-digit TOTP code when 2FA is enabled
- [ ] Backup code works as fallback when TOTP device is unavailable
- [ ] User can disable 2FA with current password confirmation
- [ ] Active sessions list shows device, IP, timestamp for all sessions
- [ ] Session revocation works (revoke specific session or all other sessions)
- [ ] Email notification sent when 2FA is enabled or disabled
- [ ] 2FA and session management UI are accessible from Settings/Profile page
- [ ] i18n translations for 2FA and session management UI

## Out of Scope

- New device login notifications (deferred to v2.1 enhancement)
- WebAuthn/FIDO2 hardware keys
- SMS-based 2FA
- Session activity logging beyond basic metadata
