<protect>
# Implementation Plan: TRACK-034 — i18n & Email Localization Completeness

**Branch:** `track-034/i18n-email-localization`
**Methodology:** TDD per `conductor/workflow.md`. Each task: mark `[~]` → write failing tests (Red) → implement (Green) → run quality gates → commit → attach git note → mark `[x]` with commit SHA. Coverage ≥80% on lines/stmts/branches/funcs.

---

## Phase 1: 2FA Email Subject Localization

- [ ] Task: Read spec.md and workflow.md to orient before Phase 1 implementation
    - [ ] Read `conductor/tracks/i18n-email-localization_20260727/spec.md` — review Functional Requirements, Acceptance Criteria, and Out of Scope
    - [ ] Read `conductor/workflow.md` — review TDD lifecycle, Quality Gates, and Phase Completion Verification protocol

- [ ] Task: Add i18n keys for 2FA email subjects to locale files
    - [ ] Add `emails.subjects.twoFactorEnabled` (`"Two-Factor Authentication Enabled"`) and `emails.subjects.twoFactorDisabled` (`"Two-Factor Authentication Disabled"`) to `locales/en.json` under the existing `emails.subjects` namespace
    - [ ] Add `emails.subjects.twoFactorEnabled` (`"Autentikasi Dua Faktor Diaktifkan"`) and `emails.subjects.twoFactorDisabled` (`"Autentikasi Dua Faktor Dinonaktifkan"`) to `locales/id.json`
    - [ ] Run `pnpm generate:i18n` to regenerate `src/i18n/types.ts` and `src/i18n/detect-locale.ts`
    - [ ] Verify `pnpm check:i18n` passes (parity between EN and ID, no unused keys)

- [ ] Task: Write failing tests for localized 2FA email subjects (Red Phase)
    - [ ] Add `vi.mock('@/lib/i18n-server', () => ({ resolveEmailSubject: vi.fn() }))` to `tests/unit/server/two-factor.test.ts`
    - [ ] Update the `enableTwoFactorHandler` email test to assert `resolveEmailSubject` is called with `('emails.subjects.twoFactorEnabled', undefined, session.user.locale)` instead of asserting the hardcoded subject string on `enqueueEmail`
    - [ ] Update the `disableTwoFactorHandler` email test to assert `resolveEmailSubject` is called with `('emails.subjects.twoFactorDisabled', undefined, session.user.locale)` instead of asserting the hardcoded subject string on `enqueueEmail`
    - [ ] Run `pnpm test` — confirm the updated tests fail (handlers still use hardcoded strings, so `resolveEmailSubject` is never called)

- [ ] Task: Replace hardcoded 2FA email subjects with resolveEmailSubject calls (Green Phase)
    - [ ] Add `import { resolveEmailSubject } from '../lib/i18n-server'` to `src/server/two-factor.server.ts`
    - [ ] Add `import type { Locales } from '../i18n/types'` to `src/server/two-factor.server.ts`
    - [ ] Replace `subject: 'Two-Factor Authentication Enabled'` (line 99) with `subject: resolveEmailSubject('emails.subjects.twoFactorEnabled', undefined, session.user.locale as Locales)`
    - [ ] Replace `subject: 'Two-Factor Authentication Disabled'` (line 201) with `subject: resolveEmailSubject('emails.subjects.twoFactorDisabled', undefined, session.user.locale as Locales)`
    - [ ] Run `pnpm test` — confirm all tests now pass
    - [ ] Run quality gates: `pnpm typecheck` (0 errors), `pnpm lint` (0 warnings/errors), `pnpm check:i18n` (parity), `pnpm test:coverage` (≥80% all thresholds)
    - [ ] Stage all changes and commit: `fix(i18n): Replace hardcoded 2FA email subjects with resolveEmailSubject calls`
    - [ ] Attach git note with task summary to the commit

- [ ] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)

---

## Phase 2: Full Audit of enqueueEmail Call Sites

- [ ] Task: Read spec.md and workflow.md to orient before Phase 2 implementation
    - [ ] Read `conductor/tracks/i18n-email-localization_20260727/spec.md` — review FR-3 (audit scope) and Acceptance Criteria
    - [ ] Read `conductor/workflow.md` — review Quality Gates and Phase Completion Verification protocol

- [ ] Task: Grep audit all enqueueEmail call sites for hardcoded subjects
    - [ ] Run grep for `subject:\s*['"]` across `src/server/**/*.ts` and `src/lib/**/*.ts` to find any remaining hardcoded subject string literals
    - [ ] Document findings — confirm no hardcoded subjects remain beyond the 2 fixed in Phase 1
    - [ ] If additional offenders are found: write failing test (Red) → replace with `resolveEmailSubject()` call (Green) → run quality gates for each

- [ ] Task: Final quality gate verification and commit
    - [ ] Run `pnpm test:coverage` — verify ≥80% on all thresholds (lines, statements, branches, functions)
    - [ ] Run `pnpm typecheck` — 0 errors
    - [ ] Run `pnpm lint` — 0 warnings, 0 errors
    - [ ] Run `pnpm check:i18n` — parity, no unused keys
    - [ ] If additional fixes were made in the audit task: stage and commit with `fix(i18n): Fix additional hardcoded email subjects found in audit`
    - [ ] If no additional fixes: commit the audit documentation in the plan update
    - [ ] Attach git note with audit summary to the commit

- [ ] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)
</protect>
