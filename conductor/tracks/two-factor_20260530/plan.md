<protect>
# Implementation Plan: Track 3.1 — Two-Factor Authentication & Session Management

## Phase 1: Database Schema & Better Auth Configuration [checkpoint: ab25642]

### Tasks

- [x] Configure Better Auth `twoFactor` plugin in `src/auth/config.ts` — SHA: 6e02f49
- [x] Generate and apply database migration for 2FA tables — SHA: eb42c61
- [x] Verify `twoFactor` tables are created (two_factor, backup_codes) — SHA: eb42c61
- [x] Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md) — SHA: ab25642

## Phase 2: 2FA Server Functions [checkpoint: b0e75bd]

### Tasks

- [x] Create two-factor server function stubs (`src/server/two-factor.ts`)
- [x] Implement two-factor handlers (`src/server/two-factor.server.ts`) — SHA: 444d851
- [x] Wire up audit log events for 2FA actions
- [x] Send email notifications for 2FA status changes
- [x] Write unit tests for all server functions
- [x] Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

## Phase 3: Session Management Server Functions [checkpoint: 1a78f43]

### Tasks

- [x] Create `src/server/sessions.ts` with Zod schemas and server function stubs — SHA: dd7b291
- [x] Create `src/server/sessions.server.ts` with handler implementations — SHA: dd7b291
- [x] Implement `listActiveSessions` — returns all sessions for current user — SHA: dd7b291
- [x] Implement `revokeSession` — invalidates a specific session — SHA: dd7b291
- [x] Implement `revokeAllOtherSessions` — invalidates all sessions except current — SHA: dd7b291
- [x] Parse user agent string for device type display — SHA: dd7b291
- [x] Write unit tests for session management functions — SHA: dd7b291
- [x] Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md) — SHA: 1a78f43

## Phase 4: 2FA Login Flow [checkpoint: 0dfdca0]

### Tasks

- [x] Add `twoFactorClient` plugin to auth client config — SHA: cc4e5a7
- [x] Modify login flow to detect 2FA requirement after password verification — SHA: cc4e5a7
- [x] Create `/auth/verify-2fa` route with TOTP code input — SHA: cc4e5a7
- [x] Create `/auth/verify-backup-code` route for backup code fallback — SHA: cc4e5a7
- [x] Handle failed attempts with appropriate error messages — SHA: cc4e5a7
- [x] Write unit tests for 2FA login flow — SHA: cc4e5a7
- [x] Conductor - User Manual Verification 'Phase 4' (Protocol in workflow.md)

## Phase 5: 2FA Settings UI [checkpoint: 6650886]

### Tasks

- [x] Create 2FA settings section in user profile/settings page — SHA: 6650886
- [x] Implement QR code display component — SHA: 6650886
- [x] Implement backup codes modal with copy/download functionality — SHA: 6650886
- [x] Implement enable/disable 2FA toggle with confirmation dialogs — SHA: 6650886
- [x] Add current 2FA status indicator — SHA: 6650886
- [x] Wire TanStack Query mutations for 2FA operations — SHA: 6650886
- [x] Add loading and error states — SHA: 6650886
- [x] Write component tests for 2FA settings UI — SHA: 6650886
- [x] Conductor - User Manual Verification 'Phase 5' (Protocol in workflow.md)

## Phase 6: Session Management UI [checkpoint: 93273ec]

### Tasks

- [x] Create active sessions list component — SHA: 93273ec
- [x] Display device type, IP address, and timestamp per session — SHA: 93273ec
- [x] Highlight current session — SHA: 93273ec
- [x] Implement revoke session button with confirmation — SHA: 93273ec
- [x] Implement revoke all other sessions button — SHA: 93273ec
- [x] Wire TanStack Query mutations for session operations — SHA: 93273ec
- [x] Write component tests for session management UI — SHA: 93273ec
- [x] Conductor - User Manual Verification 'Phase 6' (Protocol in workflow.md)

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
