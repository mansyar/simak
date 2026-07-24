<protect>
# Track: User Notification Preferences

## Overview

Users currently receive all notifications (in-app + email) with no ability to opt out of specific types. This track adds per-user, per-type, per-channel notification preferences, allowing users to selectively mute notification types they don't want. The system uses the existing `users.settings` JSONB column — no new tables or migrations are needed.

**Track Type:** Feature  
**Dependencies:** None (recommended after TRACK-021, which is now complete — ensures `deadline_reminder` notifications are mutable)  
**Estimated Effort:** 5 Days / 3 Sprint Loops

## Context Anchors

- **PRD Reference:** `docs/PRD.md#checkpoints--submissions` (notification event types — review/consultation/extension outcomes), `docs/PRD.md#analytics--reporting` (notification volume metrics)
- **TDD Reference:**
  - `users` table (`src/db/schema/users.ts:21` — `settings` JSONB column, currently typed `{ reducedMotion: boolean }`)
  - `notifications` table (`src/db/schema/notifications.ts:13` — `type`, `channel`, `params`)
  - `email_queue` table (`src/db/schema/email-queue.ts:3` — `templateType` enum)
  - `src/lib/event-email.ts:12` (`enqueueEventEmail` — single email chokepoint, never checks preferences)
  - `src/lib/email.ts:35-58` (`resolveEmailRecipient` — selects `email`/`locale`/`emailVerified`/`deletedAt` but NOT `settings`)
  - `src/server/settings.ts:10-12` (`UpdateUserSettingsSchema` — `z.object({ reducedMotion })`)
  - `src/server/settings.server.ts:106-128` (`updateUserSettingsHandler` — REPLACES entire settings, MUST refactor to merge)
  - `src/components/settings/SettingsPage.tsx` (6 sections — needs `NotificationPreferencesSection`)
  - `src/components/settings/AccessibilitySection.tsx` (UI pattern template — `useQuery(['currentUser'])` + `useMutation(updateUserSettings)` + `queryClient.invalidateQueries`)
  - `src/components/notifications/NotificationCenter.tsx:15-36` (`GROUP_CONFIGS` — 4 groups for UI taxonomy)
  - `src/lib/email.ts:9-21` (`TemplateType` — 13 values, 4 system/security + 9 event types)

## Functional Requirements

### FR-1: Settings Type Extension
- Extend `users.settings` JSONB type in `src/db/schema/users.ts:21` to `.$type<{ reducedMotion: boolean; notificationPrefs?: Record<string, { email?: boolean; inApp?: boolean }> }>()`.
- The key is the notification `type` string (e.g., `'submission_received'`, `'review_completed'`, `'sla_breach'`).
- Absent key or absent sub-field = default `true` (enabled). No data migration needed.

### FR-2: Settings Handler Refactor (Replace → Merge)
- Refactor `updateUserSettingsHandler` (`src/server/settings.server.ts:106-128`) from replace to merge using read-modify-write:
  - Read existing settings: `SELECT settings FROM users WHERE id = ?`
  - Merge: `{ ...existing.settings, ...input }`
  - Write merged object: `UPDATE users SET settings = ?`
- Without this refactor, saving `notificationPrefs` would overwrite `reducedMotion` and vice versa.

### FR-3: Zod Schema Extension
- Extend `UpdateUserSettingsSchema` in `src/server/settings.ts:10-12` with optional `notificationPrefs` field:  
  `z.record(z.string(), z.object({ email: z.boolean().optional(), inApp: z.boolean().optional() })).optional()`

### FR-4: Email Preference Gate
- Extend `resolveEmailRecipient` (`src/lib/email.ts:35-58`) to also SELECT `settings` (for preference check in `enqueueEventEmail`).
- Extend `enqueueEventEmail` (`src/lib/event-email.ts:12-31`) to check `recipient.settings?.notificationPrefs?.[notifType]?.email !== false` before calling `enqueueEmail`.
  - If email is disabled for that type, skip enqueue silently (advisory — no throw).
  - Add optional `notificationType?: string` param to `enqueueEventEmail` (defaults to `templateType` for backward compat).

### FR-5: Type Mismatch Resolution
Two notification types have email `templateType` values that don't match their in-app `type`:
1. `sla_breach` in-app type ↔ `sla_alert` email templateType — `sendSLAAlertEmail` passes `notificationType: 'sla_breach'`.
2. `deadline_extended` in-app type → email sent via `sendExtensionApprovedEmail` with `templateType: 'extension_approved'` — `sendExtensionApprovedEmail` gains optional `notificationType` param, `bulkExtendHandler` (`extensions-extras.server.ts:446`) passes `notificationType: 'deadline_extended'`.

All other 9 event types match 1:1 (default `notificationType = templateType`).

### FR-6: In-App Preference Helper
- New `src/lib/notification-prefs.ts` exporting `shouldSendInAppNotification(settings: unknown, type: string): boolean`.
- Returns `false` only if `settings?.notificationPrefs?.[type]?.inApp === false`. Otherwise `true` (default enabled).
- Pure function — no DB query, reads from pre-fetched user settings.

### FR-7: In-App Notification Gate (12 sites)
At each of the 12 in-app notification creation sites, read the recipient's `settings` (already fetched or add lightweight `SELECT settings FROM users WHERE id = ?` before the insert) and conditionally skip `db.insert(notifications)` when `shouldSendInAppNotification` returns `false`.

Sites:
1. `consultations.server.ts:115` (`consultation_logged` → instructor)
2. `consultations.server.ts:385` (`consultation_verified` → student)
3. `consultations.server.ts:462` (`consultation_rejected` → student)
4. `extensions.server.ts:212` (`extension_requested` → instructor)
5. `extensions-extras.server.ts:157` (`extension_approved` → student)
6. `extensions-extras.server.ts:276` (`extension_rejected` → student)
7. `extensions-extras.server.ts:432` (`deadline_extended` → student)
8. `submissions.server.ts:210` (`submission_received` → instructor)
9. `reviews.server.ts:417` (`review_completed` → student)
10. `reviews.server.ts:433` (`revision_requested` → student)
11. `review-sla.ts:100` (`sla_breach` → admins)
12. `deadline-reminder-scanner.ts` (`deadline_reminder` → students, batch insert added in TRACK-021)

### FR-8: Security Types Exempt
The 4 system/security email templateTypes are NEVER gated by preferences:
- `password_reset`
- `invitation`
- `two_factor`
- `sla_alert` when sent to admins as a security escalation (note: `sla_breach` in-app notification IS configurable — it's an event notification)

Only the 12 event-notification types are configurable.

### FR-9: UI — NotificationPreferencesSection
- New `src/components/settings/NotificationPreferencesSection.tsx` following `AccessibilitySection.tsx` pattern:
  - `useQuery(['currentUser'])` for data
  - `useMutation(updateUserSettings)` for saves
  - `queryClient.invalidateQueries(['currentUser'])` on success
- Renders a **grouped list** organized by `GROUP_CONFIGS` (4 groups: Reviews, Consultations, Submissions, System).
- Each notification type is a row with: type label + description on the left, two inline `Switch` toggles (Email / In-app) on the right.
- Added as 7th section in `SettingsPage.tsx`.

### FR-10: Default State
- All notifications enabled. Existing users keep current behavior (all on). Users opt OUT.
- No data migration needed — absent keys = enabled.

### FR-11: i18n
- New keys in both `locales/en.json` and `locales/id.json` under `settings.notificationPreferences.*` namespace.
- Includes: section title, group labels (matching `GROUP_CONFIGS` keys), per-type labels (matching `notifications.events.*` titles), channel names (Email / In-app), descriptions.

## Non-Functional Requirements

- **No new DB tables or migrations** — uses existing `users.settings` JSONB column.
- **No data migration** — absent keys = enabled (default state).
- **Performance** — The in-app preference check is a pure function reading pre-fetched settings. No additional DB queries at notification creation sites beyond what's already needed (or a lightweight single-column SELECT).
- **File limit** — All files under 500 lines.
- **Test coverage** — ≥80% on lines, statements, branches, and functions.
- **Backward compatibility** — Existing users with no `notificationPrefs` receive all notifications as before.

## Acceptance Criteria

1. User opens Settings → sees Notification Preferences section with 4 groups (Reviews, Consultations, Submissions, System) and 12 event types, each with Email + In-app toggles (all ON by default).
2. User disables email for `submission_received` → instructor no longer receives emails for new submissions, but still gets in-app notifications.
3. User disables in-app for `review_completed` → student no longer sees in-app notifications for completed reviews, but still receives emails.
4. User disables both for `consultation_rejected` → no notification at all for that event.
5. Saving notification preferences does NOT reset `reducedMotion` (merge behavior verified).
6. Saving `reducedMotion` does NOT reset notification preferences.
7. A user with no preferences set (existing user) receives all notifications as before.
8. Security emails (password reset, invitation, two-factor) are always sent regardless of preferences.
9. `sla_breach` email preference works (despite `templateType: 'sla_alert'` — `notificationType: 'sla_breach'` override).
10. `deadline_extended` email preference works (despite email sent via `sendExtensionApprovedEmail` — `notificationType: 'deadline_extended'` override).
11. `deadline_reminder` (from TRACK-021) is gated by preferences — user can mute deadline reminders.
12. `pnpm test:unit` passes; `pnpm test:coverage` ≥80%; `pnpm typecheck`, `pnpm lint`, `pnpm check:i18n` all clean.

## Out of Scope

- Digest/summary mode (batch emails instead of per-event — v2)
- Do-not-disturb time windows (v2 — suppress notifications during configured hours)
- Admin-enforced minimum notification requirements (v2 — admin can lock certain types as non-mutable)
- Notification frequency caps (v2 — max N emails per hour per user)
</protect>
