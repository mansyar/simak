<protect>
# Implementation Plan: Track 3.1 — Two-Factor Authentication & Session Management

## Phase 1: Database Schema & Better Auth Configuration

### Tasks

- [x] Configure Better Auth `twoFactor` plugin in `src/auth/config.ts` — SHA: TBD
- [~] Generate and apply database migration for 2FA tables
- [ ] Verify `twoFactor` tables are created (two_factor, backup_codes)
- [ ] Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)

## Phase 2: 2FA Server Functions

### Tasks

- [ ] Create `src/server/two-factor.ts` with Zod schemas and server function stubs
- [ ] Create `src/server/two-factor.server.ts` with handler implementations
- [ ] Implement `generateTwoFactorSetup` — returns QR code URL and secret
- [ ] Implement `enableTwoFactor` — activates 2FA after TOTP verification
- [ ] Implement `disableTwoFactor` — deactivates 2FA after password confirmation
- [ ] Implement `getBackupCodes` — returns user's backup codes
- [ ] Implement `regenerateBackupCodes` — generates new backup codes
- [ ] Wire audit log events: `two_factor.enabled`, `two_factor.disabled`
- [ ] Send email notification on 2FA enable/disable
- [ ] Write unit tests for all server functions
- [ ] Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

## Phase 3: Session Management Server Functions

### Tasks

- [ ] Create `src/server/sessions.ts` with Zod schemas and server function stubs
- [ ] Create `src/server/sessions.server.ts` with handler implementations
- [ ] Implement `listActiveSessions` — returns all sessions for current user
- [ ] Implement `revokeSession` — invalidates a specific session
- [ ] Implement `revokeAllOtherSessions` — invalidates all sessions except current
- [ ] Parse user agent string for device type display
- [ ] Write unit tests for session management functions
- [ ] Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)

## Phase 4: 2FA Login Flow

### Tasks

- [ ] Modify login flow to detect 2FA requirement after password verification
- [ ] Create `/auth/verify-2fa` route with TOTP code input
- [ ] Create `/auth/verify-backup-code` route for backup code fallback
- [ ] Implement server function to verify TOTP code
- [ ] Implement server function to verify backup code
- [ ] Handle failed attempts with appropriate error messages
- [ ] Write unit tests for 2FA verification handlers
- [ ] Conductor - User Manual Verification 'Phase 4' (Protocol in workflow.md)

## Phase 5: 2FA Settings UI

### Tasks

- [ ] Create 2FA settings section in user profile/settings page
- [ ] Implement QR code display component
- [ ] Implement backup codes modal with copy/download functionality
- [ ] Implement enable/disable 2FA toggle with confirmation dialogs
- [ ] Add current 2FA status indicator
- [ ] Wire TanStack Query mutations for 2FA operations
- [ ] Add loading and error states
- [ ] Write component tests for 2FA settings UI
- [ ] Conductor - User Manual Verification 'Phase 5' (Protocol in workflow.md)

## Phase 6: Session Management UI

### Tasks

- [ ] Create active sessions list component
- [ ] Display device type, IP address, and timestamp per session
- [ ] Highlight current session
- [ ] Implement revoke session button with confirmation
- [ ] Implement revoke all other sessions button
- [ ] Wire TanStack Query mutations for session operations
- [ ] Write component tests for session management UI
- [ ] Conductor - User Manual Verification 'Phase 6' (Protocol in workflow.md)

## Phase 7: i18n & Integration Testing

### Tasks

- [ ] Add English translations for 2FA UI strings
- [ ] Add Indonesian translations for 2FA UI strings
- [ ] Add English translations for session management UI strings
- [ ] Add Indonesian translations for session management UI strings
- [ ] Run full test suite to verify no regressions
- [ ] Verify accessibility (keyboard navigation, screen reader support)
- [ ] Conductor - User Manual Verification 'Phase 7' (Protocol in workflow.md)
      </protect>
