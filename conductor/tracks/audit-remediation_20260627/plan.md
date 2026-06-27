<protect>
# Implementation Plan: Audit Remediation — i18n, Type Safety, Hygiene

**Track ID:** `audit-remediation_20260627`
**Specification:** `./spec.md`

## [x] Phase 1: Notification i18n (H1) [checkpoint: 4875b95]

 - [x] Task: Read `spec.md` and `conductor/workflow.md` to review requirements and TDD protocol for this phase [1c289ff]
     - [x] Read `./spec.md` — focus on FR-1 (Notification i18n) and NFR-5 (expand-contract migration)
     - [x] Read `conductor/workflow.md` — focus on Standard Task Workflow (TDD Red/Green) and Phase Completion Verification protocol

 - [x] Task: Define notification i18n keys in locale files [09ea8e0]
     - [x] Write test verifying all notification types have keys in both `en.json` and `id.json` (Red)
     - [x] Add `notifications.*` namespace keys for all 10 notification types to `locales/en.json` (Green)
     - [x] Add corresponding Indonesian translations to `locales/id.json`
     - [x] Run `pnpm generate:i18n` to regenerate types
     - [x] Run `pnpm check:i18n` to verify parity

 - [x] Task: Schema migration — expand (add new columns) [c7e4869]
     - [x] Write test verifying new columns exist on the `notifications` table schema (Red)
     - [x] Add `titleKey` (varchar), `messageKey` (varchar), `params` (jsonb, nullable) columns to the notifications schema in `src/db/schema.ts` (Green)
     - [x] Generate migration with `pnpm db:generate`
     - [x] Apply migration to dev DB with `pnpm db:push`
     - [x] Verify old `title`/`message` columns still exist (expand phase — no drops)

 - [x] Task: Read-time notification resolver
     - [x] Write tests for the resolver: EN locale returns English strings, ID locale returns Indonesian strings, params interpolation works, missing key returns fallback (Red)
     - [x] Implement `resolveNotificationContent(titleKey, messageKey, params, locale)` in `src/server/notifications.server.ts` or a shared util (Green)
     - [x] Update `listNotifications`/`getNotifications` handlers to call the resolver before returning, passing the requesting user's locale
     - [x] Verify tests pass

 - [x] Task: Update notification INSERT sites to use keys + params [75903a5]
     - [x] Write tests verifying each handler inserts `titleKey`/`messageKey`/`params` instead of literal strings (Red)
     - [x] Update `reviews.server.ts` (2 sites: review completed, revision requested) (Green)
     - [x] Update `consultations.server.ts` (3 sites: logged, verified, rejected)
     - [x] Update `extensions-extras.server.ts` (3 sites: approved, rejected, requested)
     - [x] Update `submissions.server.ts` (1 site: new submission)
     - [x] Update `notifications.server.ts` (createNotification uses localized keys from resolver)
     - [x] Update `extensions.server.ts` (1 site: extension requested)
     - [x] Update `src/lib/review-sla.ts` (SLA breach in_app + email records)
     - [x] Verify all handler tests pass

 - [x] Task: Email subject localization [d9e5143]
     - [x] Write test verifying email subject resolves to recipient's locale (Red)
     - [x] Update `src/lib/email.ts` to resolve subjects via i18n keys using recipient locale (Green)
    - [x] Add email subject i18n keys to `locales/en.json` and `locales/id.json`
     - [x] Run `pnpm generate:i18n`
     - [x] Verify tests pass

 - [x] Task: Backfill existing notification rows [d9e5143]
     - [x] Write a backfill migration that maps existing `title`/`message` English text to the new `titleKey`/`messageKey`/`params` columns
    - [x] Apply migration with `pnpm db:migrate`
     - [x] Verify backfill via a query check

 - [x] Task: Extend lint rule for notification strings [9674dcc]
     - [x] Write test for the extended `simak-i18n/no-hardcoded` rule (or companion rule) flagging string literals in notification insert `titleKey`/`messageKey` fields (Red)
     - [x] Extend `lint-plugin.js` to flag non-key strings in notification insert shape (Green)
     - [x] Run `pnpm lint` and verify zero violations on existing code (all sites now use keys)

 - [x] Task: Schema migration — contract (drop old columns) [e1f60d5]
     - [x] Write test verifying old `title`/`message` columns are dropped and new columns are non-null (Red)
     - [x] Remove `title`/`message` columns from schema, make `titleKey`/`messageKey` non-null (Green)
     - [x] Generate + apply migration
     - [x] Verify `pnpm typecheck` and `pnpm test` pass

 - [x] Task: Conductor - User Manual Verification 'Phase 1: Notification i18n' (Protocol in workflow.md) [checkpoint: 4875b95]

## [x] Phase 2: Boundary Type Contract (H2) [checkpoint: 5f73fb7]

- [x] Task: Read `spec.md` and `conductor/workflow.md` to review requirements and TDD protocol for this phase
    - [x] Read `./spec.md` — focus on FR-2 (Boundary Type Contract) and NFR-4 (no new `any`/`@ts-expect-error`)
    - [x] Read `conductor/workflow.md` — focus on Standard Task Workflow (TDD Red/Green) and Phase Completion Verification protocol

- [x] Task: Write boundary type tests
    - [x] Write tests verifying server-fn handlers that cross the boundary have explicit return types with `Date` fields modeled as `string` (Red)
    - [x] `tests/unit/server/dashboard-instructor-boundary.test.ts`
    - [x] `tests/unit/server/assignments-boundary.test.ts`
    - [x] `tests/unit/server/consultations-boundary.test.ts`
    - [x] `tests/unit/server/setup-password-boundary.test.ts`
    - [x] Run tests and confirm they fail (no explicit types declared yet)

- [x] Task: Declare explicit return types on server-fn handlers
    - [x] Identify all server-fn handlers whose output is consumed by route loaders (instructor/dashboard, instructor/assignments/$id, assignments/index, AssignmentConsultationsTab, AssignmentOverviewTab, setup-password) (Green)
    - [x] `src/server/dashboard-instructor.server.ts` — explicit `InstructorDashboardSuccess | ServerError` with ISO date conversion
    - [x] `src/server/assignments.server.ts` — explicit `ListInstructorAssignmentsSuccess | ServerError` and `AssignmentDetailSuccess | ServerError | null`
    - [x] `src/server/consultations.server.ts` — explicit `ListPendingConsultationsSuccess | ServerError`
    - [x] `src/server/setup-password.ts` — explicit `PasswordSetupResult` and typed `createServerFn` input
    - [x] Run `pnpm typecheck` and fix any inference errors

- [x] Task: Remove TODOs and @ts-expect-error
    - [x] Remove the 6 `TODO`/`FIXME` data-shape-mismatch comments (instructor/dashboard.tsx:19, instructor/assignments/$id.tsx:24, assignments/index.tsx:39, assignments/index.tsx:57, AssignmentConsultationsTab.tsx:72, AssignmentOverviewTab.tsx:122)
    - [x] Remove `@ts-expect-error` at `setup-password.tsx:51` by fixing the underlying type inference
    - [x] Run `pnpm typecheck` — must pass with zero new errors
    - [x] Grep source for remaining `@ts-expect-error` (excluding generated files) — must be zero

- [x] Task: Conductor - User Manual Verification 'Phase 2: Boundary Type Contract' (Protocol in workflow.md) [checkpoint: 5f73fb7]

## [x] Phase 3: Dead i18n Key Cleanup (M1) [checkpoint: 99a244c]

- [x] Task: Read `spec.md` and `conductor/workflow.md` to review requirements and TDD protocol for this phase
    - [x] Read `./spec.md` — focus on FR-3 (Dead i18n Key Cleanup) and NFR-6 (i18n keys in both locales)
    - [x] Read `conductor/workflow.md` — focus on Standard Task Workflow (TDD Red/Green) and Phase Completion Verification protocol

- [x] Task: Audit dynamic key references
    - [x] Grep codebase for dynamic i18n key construction patterns: `t(`...${`, string concatenation with `t(`, `i18n(` with template literals
    - [x] Cross-reference any dynamic patterns against the 186 unused keys list
    - [x] Document confirmed-safe keys vs. keys held for further investigation

- [x] Task: Delete confirmed-safe unused keys
    - [x] Remove unused keys from `locales/en.json`
    - [x] Remove corresponding keys from `locales/id.json`
    - [x] Run `pnpm generate:i18n` to regenerate types after deletion
    - [x] Run `pnpm check:i18n:unused` — reports 0 unused keys (39 dynamic keys whitelisted)
    - [x] Run `pnpm check:i18n` — passes parity check

- [x] Task: Add pre-push gate for unused keys
    - [x] Update `lefthook.yml` to add `pnpm check:i18n:unused` to pre-push, exiting non-zero on unused keys
    - [x] Write `tests/unit/i18n/gate-unused.test.ts` verifying the gate fails on an intentionally-unused key
    - [x] Run `pnpm test`, `pnpm typecheck`, and `pnpm lint` — all pass

- [x] Task: Conductor - User Manual Verification 'Phase 3: Dead i18n Key Cleanup' (Protocol in workflow.md) [checkpoint: 99a244c]

## [x] Phase 4: Client Error Handling (M4) [checkpoint: 1aebc21]

- [x] Task: Read `spec.md` and `conductor/workflow.md` to review requirements and TDD protocol for this phase [ea1549f]
    - [x] Read `./spec.md` — focus on FR-4 (Client Error Handling) and NFR-6 (i18n keys in both locales) [ea1549f]
    - [x] Read `conductor/workflow.md` — focus on Standard Task Workflow (TDD Red/Green) and Phase Completion Verification protocol [ea1549f]

- [x] Task: Write tests for toast error display on failed fetches [ea1549f]
    - [x] Write tests verifying `toast.error` is called with the correct i18n key when a fetch fails in AssignmentWizard, TemplatePicker, StudentPicker, and the student checkpoint route (Red) [ea1549f]

- [x] Task: Replace console.error with toast.error [ea1549f]
    - [x] Add `errors.fetchFailed` (and any context-specific) i18n keys to `locales/en.json` and `locales/id.json` (Green) [ea1549f]
    - [x] Run `pnpm generate:i18n` [ea1549f]
    - [x] Update `AssignmentWizard.tsx` (3 catch blocks) to call `toast.error(t('errors.fetchFailed'))` alongside `console.error` [ea1549f]
    - [x] Update `TemplatePicker.tsx` (1 catch block) [ea1549f]
    - [x] Update `StudentPicker.tsx` (1 catch block) [ea1549f]
    - [x] Update student checkpoint route (1 catch block) [ea1549f]
    - [x] Verify all tests pass [ea1549f]

- [x] Task: Conductor - User Manual Verification 'Phase 4: Client Error Handling' (Protocol in workflow.md) [checkpoint: 1aebc21]

## [x] Phase: Review Fixes

- [x] Task: Apply review suggestions [2204cad]
</protect>
