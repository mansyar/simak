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

- [ ] Task: Read `spec.md` and `workflow.md` before starting phase implementation
    - [ ] Read `conductor/tracks/user-notification-preferences_20260723/spec.md`
    - [ ] Read `conductor/workflow.md`

- [ ] Task: Create `shouldSendInAppNotification` helper in `src/lib/notification-prefs.ts`
    - [ ] Write failing tests (`tests/unit/lib/notification-prefs.test.ts` — returns `false` only when `inApp === false`, returns `true` when absent/undefined, returns `true` for missing type key, returns `true` for null/undefined settings)
    - [ ] Implement `shouldSendInAppNotification(settings: unknown, type: string): boolean` — pure function
    - [ ] Run `pnpm test` — confirm helper tests pass

- [ ] Task: Extend `resolveEmailRecipient` to SELECT `settings`
    - [ ] Write failing tests (`tests/unit/lib/email.test.ts` — `resolveEmailRecipient` returns `settings` in result object alongside existing fields)
    - [ ] Implement: add `settings` to the SELECT query in `src/lib/email.ts:35-58`
    - [ ] Run `pnpm test` — confirm tests pass

- [ ] Task: Extend `enqueueEventEmail` with preference gate + `notificationType` param
    - [ ] Write failing tests (`tests/unit/lib/event-email.test.ts` — skips enqueue when email disabled for type, sends when enabled, sends when no pref set, security types not gated, `notificationType` defaults to `templateType`, `notificationType` override works)
    - [ ] Implement: add optional `notificationType?: string` param (defaults to `templateType`), check `recipient.settings?.notificationPrefs?.[notifType]?.email !== false` before `enqueueEmail`
    - [ ] Run `pnpm test` — confirm gate tests pass

- [ ] Task: Update `sendSLAAlertEmail` to pass `notificationType: 'sla_breach'`
    - [ ] Write failing tests (`tests/unit/lib/email.test.ts` — `sendSLAAlertEmail` passes `notificationType: 'sla_breach'` to `enqueueEventEmail`)
    - [ ] Implement: add `notificationType: 'sla_breach'` to `enqueueEventEmail` call in `sendSLAAlertEmail`
    - [ ] Run `pnpm test` — confirm tests pass

- [ ] Task: Update `sendExtensionApprovedEmail` with `notificationType` param + update `bulkExtendHandler` caller
    - [ ] Write failing tests (`tests/unit/lib/extension-email.test.ts` — `sendExtensionApprovedEmail` accepts optional `notificationType`, defaults to `'extension_approved'`; `bulkExtendHandler` passes `notificationType: 'deadline_extended'`)
    - [ ] Implement: add optional `notificationType` param to `sendExtensionApprovedEmail` in `src/lib/extension-email.ts`, pass `notificationType: 'deadline_extended'` from `bulkExtendHandler` (`src/server/extensions-extras.server.ts:446`)
    - [ ] Run `pnpm test` — confirm tests pass

- [ ] Task: Apply in-app preference gate at 12 notification creation sites
    - [ ] Write failing tests for conditional skip at representative sites (`tests/unit/server/consultations.test.ts`, `tests/unit/server/extensions.test.ts`, `tests/unit/server/submissions.test.ts`, `tests/unit/server/reviews.test.ts`, `tests/unit/lib/review-sla.test.ts`, `tests/unit/lib/deadline-reminder-scanner.test.ts` — in-app insert skipped when `shouldSendInAppNotification` returns `false`, insert proceeds when `true`)
    - [ ] Implement: at each of the 12 sites, fetch recipient `settings` (if not already available) and conditionally skip `db.insert(notifications)` via `shouldSendInAppNotification`:
        1. `consultations.server.ts:115` (`consultation_logged`)
        2. `consultations.server.ts:385` (`consultation_verified`)
        3. `consultations.server.ts:462` (`consultation_rejected`)
        4. `extensions.server.ts:212` (`extension_requested`)
        5. `extensions-extras.server.ts:157` (`extension_approved`)
        6. `extensions-extras.server.ts:276` (`extension_rejected`)
        7. `extensions-extras.server.ts:432` (`deadline_extended`)
        8. `submissions.server.ts:210` (`submission_received`)
        9. `reviews.server.ts:417` (`review_completed`)
        10. `reviews.server.ts:433` (`revision_requested`)
        11. `review-sla.ts:100` (`sla_breach`)
        12. `deadline-reminder-scanner.ts` (`deadline_reminder`)
    - [ ] Run `pnpm test` — confirm all 12 site tests pass

- [ ] Task: Conductor - User Manual Verification 'Preference Gates' (Protocol in workflow.md)

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
