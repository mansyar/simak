<protect>
# Implementation Plan: User Notification Preferences

## Phase 1: Settings Backend Refactor

- [x] Task: Read `spec.md` and `workflow.md` before starting phase implementation
    - [x] Read `conductor/tracks/user-notification-preferences_20260723/spec.md`
    - [x] Read `conductor/workflow.md`

- [x] Task: Extend `users.settings` type with `notificationPrefs` in schema [c11acce]
    - [x] Write failing tests for schema type extension (`tests/unit/db/schema/users.test.ts` — verify `notificationPrefs` field exists in type, defaults to undefined, accepts valid `Record<string, { email?: boolean; inApp?: boolean }>`)
    - [x] Implement `.$type<{ reducedMotion: boolean; notificationPrefs?: Record<string, { email?: boolean; inApp?: boolean }> }>()` on `users.settings` in `src/db/schema/users.ts:21`
    - [x] Run `pnpm test` — confirm new tests pass

- [x] Task: Refactor `updateUserSettingsHandler` from replace to merge (read-modify-write) [a7bd19a]
    - [x] Write failing tests for merge behavior (`tests/unit/server/settings.test.ts` — merge preserves `reducedMotion` when saving `notificationPrefs`, preserves `notificationPrefs` when saving `reducedMotion`, default state when no prefs set)
    - [x] Implement read-modify-write in `src/server/settings.server.ts:106-128`: `SELECT settings` → spread merge `{ ...existing, ...input }` → `UPDATE users SET settings = merged`
    - [x] Run `pnpm test` — confirm merge tests pass

- [x] Task: Extend `UpdateUserSettingsSchema` with optional `notificationPrefs` Zod field [a7bd19a]
    - [x] Write failing tests for Zod validation (`tests/unit/server/settings.test.ts` — accepts valid `notificationPrefs` record, rejects malformed prefs, accepts absent/undefined prefs)
    - [x] Implement `notificationPrefs: z.record(z.string(), z.object({ email: z.boolean().optional(), inApp: z.boolean().optional() })).optional()` in `src/server/settings.ts:10-12`
    - [x] Run `pnpm test` — confirm Zod validation tests pass

- [x] Task: Conductor - User Manual Verification 'Settings Backend Refactor' (Protocol in workflow.md)

## Phase 2: Preference Gates

- [x] Task: Read `spec.md` and `workflow.md` before starting phase implementation
    - [x] Read `conductor/tracks/user-notification-preferences_20260723/spec.md`
    - [x] Read `conductor/workflow.md`

- [x] Task: Create `shouldSendInAppNotification` helper in `src/lib/notification-prefs.ts` [f3590bf]
    - [x] Write failing tests (`tests/unit/lib/notification-prefs.test.ts` — returns `false` only when `inApp === false`, returns `true` when absent/undefined, returns `true` for missing type key, returns `true` for null/undefined settings)
    - [x] Implement `shouldSendInAppNotification(settings: unknown, type: string): boolean` — pure function
    - [x] Run `pnpm test` — confirm helper tests pass

- [x] Task: Extend `resolveEmailRecipient` to SELECT `settings` [f433832]
    - [x] Write failing tests (`tests/unit/lib/email.test.ts` — `resolveEmailRecipient` returns `settings` in result object alongside existing fields)
    - [x] Implement: add `settings` to the SELECT query in `src/lib/email.ts:36-59`, export `EmailRecipient` type with optional `settings`
    - [x] Run `pnpm test` — confirm tests pass

- [x] Task: Extend `enqueueEventEmail` with preference gate + `notificationType` param [f433832]
    - [x] Write failing tests (`tests/unit/lib/event-email.test.ts` — skips enqueue when email disabled for type, sends when enabled, sends when no pref set, security types not gated, `notificationType` defaults to `templateType`, `notificationType` override works)
    - [x] Implement: add optional `notificationType?: string` param (defaults to `templateType`), check `recipient.settings?.notificationPrefs?.[notifType]?.email === false` before `enqueueEmail`. Added `EMAIL_GATE_EXEMPT` set for security types (password_reset, invitation, two_factor, sla_alert).
    - [x] Run `pnpm test` — confirm gate tests pass

- [x] Task: Update `sendSLAAlertEmail` to pass `notificationType: 'sla_breach'` [f433832]
    - **DEVIATION:** `sendSLAAlertEmail` calls `enqueueEmail` directly (not `enqueueEventEmail`), and `sla_alert` is exempt from email gating (FR-8). No email-side change needed. The `notificationType: 'sla_breach'` mapping applies only to the in-app gate (Task 7, site 11: `review-sla.ts:100`).

- [x] Task: Update `sendExtensionApprovedEmail` with `notificationType` param + update `bulkExtendHandler` caller [f433832]
    - [x] Write failing tests (`tests/unit/lib/extension-email.test.ts` — `sendExtensionApprovedEmail` accepts optional `notificationType`, defaults to `'extension_approved'`; `bulkExtendHandler` passes `notificationType: 'deadline_extended'`)
    - [x] Implement: add optional `notificationType` param to `sendExtensionApprovedEmail` in `src/lib/extension-email.ts`, pass `notificationType: 'deadline_extended'` from `bulkExtendHandler` (`src/server/extensions-extras.server.ts:446`)
    - [x] Run `pnpm test` — confirm tests pass

- [x] Task: Apply in-app preference gate at 12 notification creation sites [904a4d9]
    - [x] Write failing tests for conditional skip at representative sites (`tests/unit/server/consultations.test.ts`, `tests/unit/server/extensions-request.test.ts`, `tests/unit/server/extensions-approve-reject.test.ts`, `tests/unit/server/extensions-bulk.test.ts`, `tests/unit/server/submissions.test.ts`, `tests/unit/server/reviews-handlers.test.ts`, `tests/unit/lib/review-sla.test.ts`, `tests/unit/lib/deadline-reminder-scanner.test.ts` — in-app insert skipped when `shouldSendInAppNotification` returns `false`, insert proceeds when `true`)
    - [x] Implement: at each of the 12 sites, fetch recipient `settings` (if not already available) and conditionally skip `db.insert(notifications)` via `shouldSendInAppNotification`:
        1. `consultations.server.ts:115` (`consultation_logged`) — uses `maybeInsertNotification` helper
        2. `consultations.server.ts:385` (`consultation_verified`) — uses `maybeInsertNotification` helper
        3. `consultations.server.ts:462` (`consultation_rejected`) — uses `maybeInsertNotification` helper
        4. `extensions.server.ts:212` (`extension_requested`) — inline pattern
        5. `extensions-extras.server.ts:157` (`extension_approved`) — inline pattern
        6. `extensions-extras.server.ts:276` (`extension_rejected`) — inline pattern
        7. `extensions-extras.server.ts:432` (`deadline_extended`) — inline pattern
        8. `submissions.server.ts:210` (`submission_received`) — inline pattern
        9. `reviews.server.ts:417` (`review_completed`) — uses `maybeInsertNotification` helper (shared SELECT with site 10)
        10. `reviews.server.ts:433` (`revision_requested`) — uses `maybeInsertNotification` helper (shared SELECT with site 9)
        11. `review-sla.ts:100` (`sla_breach`) — batch: filter `notifiableAdmins` before INSERT, emails to ALL
        12. `deadline-reminder-scanner.ts` (`deadline_reminder`) — batch: filter `notifiableCheckpoints` before INSERT, emails to ALL
    - [x] Run `pnpm test` — confirm all 12 site tests pass (3158 tests, 0 failures)
    - **NOTE:** Created `maybeInsertNotification(db, userId, type, values)` helper in `src/lib/notification-prefs.ts` to reduce `consultations.server.ts` (500→495) and `reviews.server.ts` (500→498) below 500-line limit. Moved skip tests to 3 new files (`consultations-prefs.test.ts`, `extensions-approve-reject-prefs.test.ts`, `submissions-prefs.test.ts`) to keep original test files under 500 lines.

- [x] Task: Conductor - User Manual Verification 'Preference Gates' (Protocol in workflow.md)
    - Automated tests: 316 files, 3158 tests passed, 0 failures. Coverage: 88.45% stmts, 82.2% branch, 84.11% funcs, 89.03% lines.
    - Manual verification: Skipped (user confirmed automated tests sufficient).

## Phase 3: UI & i18n

- [ ] Task: Read `spec.md` and `workflow.md` before starting phase implementation
    - [ ] Read `conductor/tracks/user-notification-preferences_20260723/spec.md`
    - [ ] Read `conductor/workflow.md`

- [ ] Task: Create `NotificationPreferencesSection` component
    - [ ] Write failing tests (`tests/unit/components/settings/NotificationPreferencesSection.test.tsx` — renders all 12 types grouped by 4 `GROUP_CONFIGS` groups, renders Email + In-app `Switch` toggles per type, default state = all switches ON, toggle calls `updateUserSettings` with correct payload, `queryClient.invalidateQueries` on success)
    - [ ] Implement `src/components/settings/NotificationPreferencesSection.tsx` following `AccessibilitySection.tsx` pattern: `useQuery(['currentUser'])` for data, `useMutation(updateUserSettings)` for saves, `queryClient.invalidateQueries(['currentUser'])` on success. Renders grouped list with inline `Switch` toggles per type × channel.
    - [ ] Run `pnpm test` — confirm component tests pass

- [ ] Task: Add `NotificationPreferencesSection` to `SettingsPage.tsx` as 7th section
    - [ ] Write failing tests (`tests/unit/components/settings/SettingsPage.test.tsx` — 7th section renders, section title visible)
    - [ ] Implement: import and render `<NotificationPreferencesSection />` as 7th section in `src/components/settings/SettingsPage.tsx`
    - [ ] Run `pnpm test` — confirm integration tests pass

- [ ] Task: Add i18n keys to both locales + run codegen
    - [ ] Add `settings.notificationPreferences.*` keys to `locales/en.json` (section title, group labels matching `GROUP_CONFIGS` keys, per-type labels matching `notifications.events.*` titles, channel names Email/In-app, descriptions)
    - [ ] Add matching keys to `locales/id.json` with Indonesian translations
    - [ ] Run `pnpm generate:i18n` to regenerate types
    - [ ] Verify: `pnpm check:i18n` — parity EN↔ID passes

- [ ] Task: Conductor - User Manual Verification 'UI & i18n' (Protocol in workflow.md)
</protect>
