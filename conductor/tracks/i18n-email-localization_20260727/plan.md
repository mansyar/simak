<protect>
# Implementation Plan: TRACK-034 — i18n & Email Localization Completeness

**Branch:** `track-034/i18n-email-localization`
**Methodology:** TDD per `conductor/workflow.md`. Each task: mark `[~]` → write failing tests (Red) → implement (Green) → run quality gates → commit → attach git note → mark `[x]` with commit SHA. Coverage ≥80% on lines/stmts/branches/funcs.

---

## Phase 1: 2FA Email Subject Localization

- [x] Task: Read spec.md and workflow.md to orient before Phase 1 implementation
    - [x] Read `conductor/tracks/i18n-email-localization_20260727/spec.md` — review Functional Requirements, Acceptance Criteria, and Out of Scope
    - [x] Read `conductor/workflow.md` — review TDD lifecycle, Quality Gates, and Phase Completion Verification protocol

- [x] Task: Add i18n keys for 2FA email subjects to locale files [af3f00b]
    - [x] Add `emails.subjects.twoFactorEnabled` (`"Two-Factor Authentication Enabled"`) and `emails.subjects.twoFactorDisabled` (`"Two-Factor Authentication Disabled"`) to `locales/en.json` under the existing `emails.subjects` namespace
    - [x] Add `emails.subjects.twoFactorEnabled` (`"Autentikasi Dua Faktor Diaktifkan"`) and `emails.subjects.twoFactorDisabled` (`"Autentikasi Dua Faktor Dinonaktifkan"`) to `locales/id.json`
    - [x] Run `pnpm generate:i18n` to regenerate `src/i18n/types.ts` and `src/i18n/detect-locale.ts`
    - [x] Verify `pnpm check:i18n` passes (parity between EN and ID, no unused keys)

- [x] Task: Write failing tests for localized 2FA email subjects (Red Phase) [af3f00b]
    - [x] Add `vi.mock('@/lib/i18n-server', () => ({ resolveEmailSubject: vi.fn() }))` to `tests/unit/server/two-factor.test.ts`
    - [x] Update the `enableTwoFactorHandler` email test to assert `resolveEmailSubject` is called with `('emails.subjects.twoFactorEnabled', undefined, session.user.locale)` instead of asserting the hardcoded subject string on `enqueueEmail`
    - [x] Update the `disableTwoFactorHandler` email test to assert `resolveEmailSubject` is called with `('emails.subjects.twoFactorDisabled', undefined, session.user.locale)` instead of asserting the hardcoded subject string on `enqueueEmail`
    - [x] Run `pnpm test` — confirm the updated tests fail (handlers still use hardcoded strings, so `resolveEmailSubject` is never called)

- [x] Task: Replace hardcoded 2FA email subjects with resolveEmailSubject calls (Green Phase) [af3f00b]
    - [x] Add `import { resolveEmailSubject } from '../lib/i18n-server'` to `src/server/two-factor.server.ts`
    - [x] Add `import type { Locales } from '../i18n/types'` to `src/server/two-factor.server.ts`
    - [x] Replace `subject: 'Two-Factor Authentication Enabled'` (line 99) with `subject: resolveEmailSubject('emails.subjects.twoFactorEnabled', undefined, session.user.locale as Locales)`
    - [x] Replace `subject: 'Two-Factor Authentication Disabled'` (line 201) with `subject: resolveEmailSubject('emails.subjects.twoFactorDisabled', undefined, session.user.locale as Locales)`
    - [x] Run `pnpm test` — confirm all tests now pass
    - [x] Run quality gates: `pnpm typecheck` (0 errors), `pnpm lint` (0 warnings/errors), `pnpm check:i18n` (parity), `pnpm test:coverage` (≥80% all thresholds)
    - [x] Stage all changes and commit: `fix(i18n): Replace hardcoded 2FA email subjects with resolveEmailSubject calls`
    - [x] Attach git note with task summary to the commit

- [x] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)

---

## Phase 2: Full Audit of enqueueEmail Call Sites

- [x] Task: Read spec.md and workflow.md to orient before Phase 2 implementation
    - [x] Read `conductor/tracks/i18n-email-localization_20260727/spec.md` — review FR-3 (audit scope) and Acceptance Criteria
    - [x] Read `conductor/workflow.md` — review Quality Gates and Phase Completion Verification protocol

- [x] Task: Grep audit all enqueueEmail call sites for hardcoded subjects
    - [x] Run grep for `subject:\s*['"]` across `src/server/**/*.ts` and `src/lib/**/*.ts` to find any remaining hardcoded subject string literals
    - [x] Document findings — confirmed no hardcoded subjects remain beyond the 2 fixed in Phase 1. All other `subject:` references are type declarations, parameter passthroughs, or DB field reads.
    - [x] If additional offenders are found: write failing test (Red) → replace with `resolveEmailSubject()` call (Green) → run quality gates for each — N/A, no additional offenders found

- [x] Task: Final quality gate verification and commit
    - [x] Run `pnpm test:coverage` — verify ≥80% on all thresholds (lines, statements, branches, functions) — PASSED (stmts 88.06%, branch 82.15%, funcs 83.55%, lines 88.7%)
    - [x] Run `pnpm typecheck` — 0 errors — PASSED
    - [x] Run `pnpm lint` — 0 warnings, 0 errors — PASSED (4 pre-existing warnings in unrelated files)
    - [x] Run `pnpm check:i18n` — parity, no unused keys — PASSED (963 keys in both locales)
    - [x] If additional fixes were made in the audit task: stage and commit with `fix(i18n): Fix additional hardcoded email subjects found in audit` — N/A, no additional fixes needed
    - [x] If no additional fixes: commit the audit documentation in the plan update
    - [x] Attach git note with audit summary to the commit

- [x] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)
</protect>
