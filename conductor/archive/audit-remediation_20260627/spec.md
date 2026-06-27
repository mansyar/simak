<protect>
# Specification: Audit Remediation — i18n, Type Safety, Hygiene

**Track ID:** `audit-remediation_20260627`
**Type:** Refactor / Bug Fix

## Overview

This track remediates the four highest-priority findings from the independent software audit of the SIMAK codebase. Two are systemic boundary issues (i18n/DB boundary, server-fn/route type boundary); two are hygiene items (dead translation keys, silent client-side error handling). The fixes are scoped to existing functionality — no new features are added.

## Background

An independent audit identified systemic quality gaps. The four findings addressed here, in priority order:

1. **H1 (HIGH):** 11 notification INSERTs across 6 server files store hardcoded English `title`/`message` strings. Email subjects are equally hardcoded. For a bilingual EN/ID app, Indonesian users receive all notifications in English. The `simak-i18n/no-hardcoded` lint rule only checks JSX, not server-side string literals.
2. **H2 (HIGH):** 6 TODOs document a `Date` → `string` serialization mismatch at the server-function ↔ route boundary. One `@ts-expect-error` survives in `setup-password.tsx:51`. The type contract across the network boundary is effectively unenforced.
3. **M1 (MEDIUM):** 186 of 706 i18n keys (26%) are unused — dead translation debt from prior refactors.
4. **M4 (MEDIUM):** 6 client-side `console.error` calls catch failed fetches without surfacing the error to the user via toast.

## Functional Requirements

### FR-1: Notification i18n (H1)

- **FR-1.1:** Add `title_key` (varchar) and `message_key` (varchar) columns to the `notifications` table, replacing the existing `title` and `message` text columns.
- **FR-1.2:** Add a `params` (jsonb, nullable) column to the `notifications` table for interpolation parameters.
- **FR-1.3:** Create a Drizzle migration using the expand-contract pattern (per SQL styleguide §6): add new columns, backfill existing rows with key+params derived from their current English text, then drop old columns in a follow-up migration.
- **FR-1.4:** Define notification i18n keys in `locales/en.json` and `locales/id.json` under a `notifications.*` namespace for all notification types (review completed, revision requested, new submission, consultation logged, consultation verified, consultation rejected, extension approved, extension rejected, extension requested, SLA breach).
- **FR-1.5:** Update all 11 notification INSERT sites across 6 server files to store `titleKey` + `messageKey` + `params` instead of literal `title`/`message` strings.
- **FR-1.6:** Implement a read-time resolver: when fetching notifications, resolve `titleKey`/`messageKey` + `params` against the requesting user's locale preference before returning.
- **FR-1.7:** Update email subject handling in `src/lib/email.ts` to resolve subjects via i18n keys using the recipient's locale.
- **FR-1.8:** Extend the `simak-i18n/no-hardcoded` lint rule (or add a companion rule) to flag string literals passed as `titleKey`/`messageKey` in notification inserts — values must be i18n keys, not free text.

### FR-2: Boundary Type Contract (H2)

- **FR-2.1:** For each server-function handler whose output crosses the network boundary to a route loader, declare an explicit return type modeling `Date` fields as `string` (ISO format), reflecting TanStack Start's serialization behavior.
- **FR-2.2:** Remove all 6 `TODO`/`FIXME` comments documenting data shape mismatches at the boundary (instructor/dashboard.tsx:19, instructor/assignments/$id.tsx:24, assignments/index.tsx:39+57, AssignmentConsultationsTab.tsx:72, AssignmentOverviewTab.tsx:122).
- **FR-2.3:** Remove the `@ts-expect-error` directive at `setup-password.tsx:51` by fixing the underlying type inference.
- **FR-2.4:** Verify `pnpm typecheck` passes with zero new errors after all boundary types are declared.

### FR-3: Dead i18n Key Cleanup (M1)

- **FR-3.1:** Grep the codebase for dynamic i18n key construction patterns (template literals, `t(`...${var}...`)`, string concatenation) to identify any runtime-constructed keys among the 186 unused.
- **FR-3.2:** Delete confirmed-safe unused keys from both `locales/en.json` and `locales/id.json`.
- **FR-3.3:** Run `pnpm generate:i18n` to regenerate types after deletion.
- **FR-3.4:** Add `pnpm check:i18n:unused` to the pre-push Lefthook gate as a blocking check (exits non-zero if unused keys exceed a threshold of 0).

### FR-4: Client Error Handling (M4)

- **FR-4.1:** Replace the 6 client-side `console.error` calls in failed-fetch catch blocks with `toast.error(t('errors.fetchFailed'))` (or context-specific message keys).
- **FR-4.2:** Keep `console.error` alongside the toast for dev diagnostics.
- **FR-4.3:** Add the `errors.fetchFailed` i18n key (and any context-specific keys) to both `locales/en.json` and `locales/id.json`.

## Non-Functional Requirements

- **NFR-1:** No new features are introduced. All changes remediate existing functionality.
- **NFR-2:** All existing tests must continue to pass. New tests must be written for notification i18n resolution (H1) and boundary type contracts (H2).
- **NFR-3:** Code coverage must remain above the 80% threshold.
- **NFR-4:** No `any` types introduced. No new `@ts-expect-error` or `as unknown as` casts.
- **NFR-5:** The expand-contract migration pattern must be followed for the notifications schema change — no destructive column drops in the same migration that adds new columns.
- **NFR-6:** All new user-visible strings must have i18n keys in both EN and ID locales.

## Acceptance Criteria

- [ ] **AC-1:** Indonesian users receive in-app notifications in Indonesian. Verified by a unit test that inserts a notification with key+params, fetches it with locale `id`, and asserts the Indonesian string.
- [ ] **AC-2:** Email subjects are localized to the recipient's locale.
- [ ] **AC-3:** `pnpm typecheck` passes with zero `@ts-expect-error` directives in source (excluding generated files) and zero `TODO`/`FIXME` comments related to data shape mismatch.
- [ ] **AC-4:** `pnpm check:i18n:unused` reports 0 unused keys.
- [ ] **AC-5:** Failed fetches on client surfaces a user-visible toast error.
- [ ] **AC-6:** `pnpm lint` and `pnpm test` pass with the extended lint rule.

## Out of Scope

- The remaining LOW-severity findings (dead `r2Schema` code, `as unknown as NonNullable<Session>` cast, `redirect` typed-route casts, `check-modularity.js` full-repo script, `pnpm.onlyBuiltDependencies` warning) are NOT included in this track.
- The `*-extras.server.ts` documentation gap (M2) is NOT included — it requires only a doc update and can be done separately.
- The duplicated `ILIKE` search pattern (M3) is NOT included — trivial refactor, separate concern.
- No changes to the notification polling infrastructure or notification UI components beyond passing localized strings through.
- No new notification types are added.
</protect>
