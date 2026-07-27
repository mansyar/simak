<protect>
# Track: i18n & Email Localization Completeness (TRACK-034)

**Branch:** `track-034/i18n-email-localization`
**Type:** bugfix
**Audit ID:** INFRA-6
**Dependencies:** None

## Overview

The SIMAK i18n policy (enforced by the `simak-i18n/no-hardcoded` lint rule and `conductor/workflow.md` → "i18n Workflow") requires all user-visible strings to use i18n keys. A targeted audit revealed that two email subjects in `src/server/two-factor.server.ts` are hardcoded English strings, bypassing the `resolveEmailSubject()` helper that all other email-sending code uses. This track fixes those two subjects and conducts a full audit of all `enqueueEmail` call sites to ensure no other hardcoded subjects exist.

## Context Anchors (Traceability)

- **PRD Reference:** `docs/PRD.md` — Email Notification System (bilingual email support — EN/ID)
- **TDD Reference:** `src/lib/i18n-server.ts` (exports `resolveEmailSubject(key, params?, locale)` at line 55 — the canonical helper for localized email subjects); `src/lib/email.ts` (uses `resolveEmailSubject` correctly for password reset + invitation); `src/server/two-factor.server.ts:99` (`subject: 'Two-Factor Authentication Enabled'` — hardcoded); `src/server/two-factor.server.ts:201` (`subject: 'Two-Factor Authentication Disabled'` — hardcoded); `conductor/workflow.md` → "i18n Workflow" (all user-visible strings must use i18n keys)

## Track Tech Stack

- `src/lib/i18n-server.ts` — existing `resolveEmailSubject(key, params?, locale='en')` helper. No changes needed to this file.
- `src/server/two-factor.server.ts` — 2 hardcoded email subjects to fix (lines 99, 201). Must add import of `resolveEmailSubject` from `../lib/i18n-server`.
- `locales/en.json` + `locales/id.json` — new i18n keys under `emails.subjects.*` namespace (following existing convention).
- `src/i18n/types.ts` + `src/i18n/detect-locale.ts` — regenerated via `pnpm generate:i18n` (never edit by hand).

## Functional Requirements

### FR-1: Add i18n keys for 2FA email subjects

Add two new keys to the existing `emails.subjects` namespace in both locale files (following the existing `emails.subjects.<camelCase>` convention used by all 14 existing subject keys):

- `emails.subjects.twoFactorEnabled` — EN: `"Two-Factor Authentication Enabled"`, ID: `"Autentikasi Dua Faktor Diaktifkan"`
- `emails.subjects.twoFactorDisabled` — EN: `"Two-Factor Authentication Disabled"`, ID: `"Autentikasi Dua Faktor Dinonaktifkan"`

Run `pnpm generate:i18n` to regenerate type definitions.

### FR-2: Replace hardcoded 2FA email subjects

Replace the two hardcoded subject strings in `src/server/two-factor.server.ts` with `resolveEmailSubject()` calls:

- **Line 99** (`enableTwoFactorHandler`): Replace `subject: 'Two-Factor Authentication Enabled'` with `subject: resolveEmailSubject('emails.subjects.twoFactorEnabled', undefined, session.user.locale as Locales)`
- **Line 201** (`disableTwoFactorHandler`): Replace `subject: 'Two-Factor Authentication Disabled'` with `subject: resolveEmailSubject('emails.subjects.twoFactorDisabled', undefined, session.user.locale as Locales)`

Both handlers already obtain `session` via `getSessionFromHeaders()` at the top of the function, so `session.user.locale` is available. Add the import: `import { resolveEmailSubject } from '../lib/i18n-server'` and `import type { Locales } from '../i18n/types'`.

### FR-3: Audit all `enqueueEmail` call sites

Grep all `src/server/**/*.ts` and `src/lib/**/*.ts` files for hardcoded `subject:` string literals (pattern: `subject: '...'` or `subject: "..."` where the value is a string literal, not a `resolveEmailSubject()` call). Fix any additional offenders found by replacing with `resolveEmailSubject()` using the appropriate locale.

**Pre-verified audit result:** At spec time, the only hardcoded subjects are the 2 in `two-factor.server.ts`. All `src/lib/` files (`email.ts`, `event-email.ts`, `bulk-import.server.ts`) already use `resolveEmailSubject()`. The grep in Phase 2 re-confirms this at implementation time — if new hardcoded subjects have been introduced since, fix them.

## Non-Functional Requirements

### NFR-1: Test coverage

All changes must pass existing quality gates: `pnpm test` (≥80% coverage on lines/statements/branches/functions), `pnpm typecheck`, `pnpm lint` (including `simak-i18n/no-hardcoded`), `pnpm check:i18n`.

### NFR-2: i18n parity

New keys must be added to both `locales/en.json` and `locales/id.json`. `pnpm check:i18n` must pass (no missing keys). No new unused keys.

### NFR-3: No file exceeds 500 lines

`two-factor.server.ts` is currently 309 lines — adding 2 import lines + replacing 2 string literals with function calls keeps it well under 500.

## Acceptance Criteria

- [x] **AC-1:** `emails.subjects.twoFactorEnabled` and `emails.subjects.twoFactorDisabled` keys exist in both `locales/en.json` and `locales/id.json` with correct translations.
- [x] **AC-2:** `pnpm generate:i18n` has been run; `src/i18n/types.ts` and `src/i18n/detect-locale.ts` are regenerated and committed.
- [x] **AC-3:** `src/server/two-factor.server.ts:99` uses `resolveEmailSubject('emails.subjects.twoFactorEnabled', undefined, session.user.locale as Locales)` instead of the hardcoded string.
- [x] **AC-4:** `src/server/two-factor.server.ts:201` uses `resolveEmailSubject('emails.subjects.twoFactorDisabled', undefined, session.user.locale as Locales)` instead of the hardcoded string.
- [x] **AC-5:** `resolveEmailSubject` is imported from `../lib/i18n-server` in `two-factor.server.ts`; `Locales` type is imported from `../i18n/types`.
- [x] **AC-6:** Unit tests in `tests/unit/server/two-factor.test.ts` mock `resolveEmailSubject` and assert it is called with the correct key (`emails.subjects.twoFactorEnabled` / `emails.subjects.twoFactorDisabled`) and `session.user.locale` for both enable and disable handlers. (Existing tests that assert the hardcoded subject string are updated.)
- [x] **AC-7:** Phase 2 grep audit confirms no other hardcoded `subject:` string literals exist in `src/server/**/*.ts` or `src/lib/**/*.ts` (or any newly found ones are fixed).
- [x] **AC-8:** `pnpm test:unit` — all tests pass.
- [x] **AC-9:** `pnpm check:i18n` — parity for new keys, no unused keys.
- [x] **AC-10:** `pnpm typecheck` — 0 errors.
- [x] **AC-11:** `pnpm lint` — 0 warnings, 0 errors.

## Out of Scope

- Email **body** template localization (email HTML bodies remain English-only by design — server-side templates are not user-facing i18n in the same way; deferred to a future track if needed).
- Changes to the `resolveEmailSubject` helper itself (already works correctly).
- Changes to the email queue infrastructure.
- Any new email templates (only fixing existing hardcoded subjects).
- Client-side UI i18n (already enforced by the `simak-i18n/no-hardcoded` lint rule — this track is server-side email subjects only).

## Verification & Definition of Done (DoD)

- [x] **Manual Checkpoint:** Enable 2FA with an Indonesian-locale user (`locale: 'id'`) — verify the email subject is `"Autentikasi Dua Faktor Diaktifkan"`. Disable 2FA — verify the email subject is `"Autentikasi Dua Faktor Dinonaktifkan"`. Enable 2FA with an English-locale user — verify the subject is `"Two-Factor Authentication Enabled"`.
- [x] **Automated Tests:** `pnpm test:unit` — all tests pass. Updated tests for `two-factor.server.ts` verifying `resolveEmailSubject` is called with correct key and locale. `pnpm check:i18n` — parity for new keys. `pnpm typecheck` clean. `pnpm lint` — 0 warnings, 0 errors.
- [x] **Conductor Review:** `src/server/two-factor.server.ts` imports `resolveEmailSubject` from `../lib/i18n-server` and `Locales` type from `../i18n/types`. Both hardcoded subject strings replaced with `resolveEmailSubject()` calls using `session.user.locale`. New keys in `emails.subjects.*` namespace in both locale files. `pnpm generate:i18n` run. Grep audit confirms no remaining hardcoded `subject:` string literals in `src/server/` or `src/lib/`. All files under 500 lines. Pre-push gate passes.
</protect>
