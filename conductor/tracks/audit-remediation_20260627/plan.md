<protect>
# Implementation Plan: Audit Remediation — i18n, Type Safety, Hygiene

**Track ID:** `audit-remediation_20260627`
**Specification:** `./spec.md`

## Phase 1: Notification i18n (H1)

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

 - [~] Task: Schema migration — contract (drop old columns)
    - [ ] Write test verifying old `title`/`message` columns are dropped and new columns are non-null (Red)
    - [ ] Remove `title`/`message` columns from schema, make `titleKey`/`messageKey` non-null (Green)
    - [ ] Generate + apply migration
    - [ ] Verify `pnpm typecheck` and `pnpm test` pass

- [ ] Task: Conductor - User Manual Verification 'Phase 1: Notification i18n' (Protocol in workflow.md)

## Phase 2: Boundary Type Contract (H2)

- [ ] Task: Read `spec.md` and `conductor/workflow.md` to review requirements and TDD protocol for this phase
    - [ ] Read `./spec.md` — focus on FR-2 (Boundary Type Contract) and NFR-4 (no new `any`/`@ts-expect-error`)
    - [ ] Read `conductor/workflow.md` — focus on Standard Task Workflow (TDD Red/Green) and Phase Completion Verification protocol

- [ ] Task: Write boundary type tests
    - [ ] Write tests verifying server-fn handlers that cross the boundary have explicit return types with `Date` fields modeled as `string` (Red)
    - [ ] Run tests and confirm they fail (no explicit types declared yet)

- [ ] Task: Declare explicit return types on server-fn handlers
    - [ ] Identify all server-fn handlers whose output is consumed by route loaders (instructor/dashboard, instructor/assignments/$id, assignments/index, AssignmentConsultationsTab, AssignmentOverviewTab, setup-password) (Green)
    - [ ] Declare explicit return types modeling `Date` → `string` (ISO) on each handler
    - [ ] Run `pnpm typecheck` and fix any inference errors

- [ ] Task: Remove TODOs and @ts-expect-error
    - [ ] Remove the 6 `TODO`/`FIXME` data-shape-mismatch comments (instructor/dashboard.tsx:19, instructor/assignments/$id.tsx:24, assignments/index.tsx:39, assignments/index.tsx:57, AssignmentConsultationsTab.tsx:72, AssignmentOverviewTab.tsx:122)
    - [ ] Remove `@ts-expect-error` at `setup-password.tsx:51` by fixing the underlying type inference
    - [ ] Run `pnpm typecheck` — must pass with zero new errors
    - [ ] Grep source for remaining `@ts-expect-error` (excluding generated files) — must be zero

- [ ] Task: Conductor - User Manual Verification 'Phase 2: Boundary Type Contract' (Protocol in workflow.md)

## Phase 3: Dead i18n Key Cleanup (M1)

- [ ] Task: Read `spec.md` and `conductor/workflow.md` to review requirements and TDD protocol for this phase
    - [ ] Read `./spec.md` — focus on FR-3 (Dead i18n Key Cleanup) and NFR-6 (i18n keys in both locales)
    - [ ] Read `conductor/workflow.md` — focus on Standard Task Workflow (TDD Red/Green) and Phase Completion Verification protocol

- [ ] Task: Audit dynamic key references
    - [ ] Grep codebase for dynamic i18n key construction patterns: `t(`...${`, string concatenation with `t(`, `i18n(` with template literals
    - [ ] Cross-reference any dynamic patterns against the 186 unused keys list
    - [ ] Document confirmed-safe keys vs. keys held for further investigation

- [ ] Task: Delete confirmed-safe unused keys
    - [ ] Remove unused keys from `locales/en.json`
    - [ ] Remove corresponding keys from `locales/id.json`
    - [ ] Run `pnpm generate:i18n` to regenerate types
    - [ ] Run `pnpm check:i18n:unused` — must report 0 unused keys
    - [ ] Run `pnpm check:i18n` — must pass parity check

- [ ] Task: Add pre-push gate for unused keys
    - [ ] Update `lefthook.yml` (or equivalent) to add `pnpm check:i18n:unused` to pre-push, exiting non-zero on unused keys
    - [ ] Write a test or manual verification that the gate triggers on an intentionally-unused key
    - [ ] Run `pnpm test` to verify no regressions

- [ ] Task: Conductor - User Manual Verification 'Phase 3: Dead i18n Key Cleanup' (Protocol in workflow.md)

## Phase 4: Client Error Handling (M4)

- [ ] Task: Read `spec.md` and `conductor/workflow.md` to review requirements and TDD protocol for this phase
    - [ ] Read `./spec.md` — focus on FR-4 (Client Error Handling) and NFR-6 (i18n keys in both locales)
    - [ ] Read `conductor/workflow.md` — focus on Standard Task Workflow (TDD Red/Green) and Phase Completion Verification protocol

- [ ] Task: Write tests for toast error display on failed fetches
    - [ ] Write tests verifying `toast.error` is called with the correct i18n key when a fetch fails in AssignmentWizard, TemplatePicker, StudentPicker, and the student checkpoint route (Red)

- [ ] Task: Replace console.error with toast.error
    - [ ] Add `errors.fetchFailed` (and any context-specific) i18n keys to `locales/en.json` and `locales/id.json` (Green)
    - [ ] Run `pnpm generate:i18n`
    - [ ] Update `AssignmentWizard.tsx` (3 catch blocks) to call `toast.error(t('errors.fetchFailed'))` alongside `console.error`
    - [ ] Update `TemplatePicker.tsx` (1 catch block)
    - [ ] Update `StudentPicker.tsx` (1 catch block)
    - [ ] Update student checkpoint route (1 catch block)
    - [ ] Verify all tests pass

- [ ] Task: Conductor - User Manual Verification 'Phase 4: Client Error Handling' (Protocol in workflow.md)
</protect>
