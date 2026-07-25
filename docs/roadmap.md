# Product Roadmap: SIMAK Remediation

> **Methodology:** Context-Driven Development (CDD) via Conductor.
> **Purpose:** Global architectural index mapping the remediation path following a comprehensive three-way audit (bugs, performance, UX). Completed tracks are summarized as index entries with links to full specs in `conductor/archive/`. Active/planned tracks retain full detail until archived.

---

## Audit Summary

The audit identified issues across three categories:

| Category | Critical/High | Medium | Low | Total |
|----------|:---:|:---:|:---:|:---:|
| **Bugs** | 13 | 9 | 6 | 28 |
| **Performance** | 3 | ~12 | ~15 | ~30 |
| **UX** | 8 | ~12 | ~20 | ~40 |

Each track references individual findings by their audit ID (BUG-X, PERF-X, UX-X, ENH-X). See the full audit report for detailed descriptions, file locations, and reproduction steps.

---

## Global System Configuration & Context

Before initializing individual tracks, the following foundational context files must be present and updated in the repository:

- **PRD Source:** `docs/PRD.md` (Defines feature requirements and user logic)
- **TDD Source:** `docs/TDD.md` (Defines architecture, system design, and schemas)
- **Tech Stack:** `conductor/tech-stack.md` (Defines pinned languages, frameworks, and tools)
- **Guidelines:** `conductor/product-guidelines.md`, `conductor/code_styleguides/` (Defines code style, patterns, and testing thresholds)
- **Workflow:** `conductor/workflow.md` (Defines TDD lifecycle, commit format, and checkpoint protocol)
- **Audit Source:** This document (cross-references all audit findings by ID)

### Cross-Cutting Constraints

All tracks must adhere to the following project constraints:

- **Server function split:** Every feature has two files — `*.ts` (client-safe stub with `createServerFn` + dynamic import) and `*.server.ts` (handler with DB code). See `AGENTS.md` → "Server function split".
- **File limit:** Max 500 lines per file in `src/`, `tests/`, `scripts/`.
- **i18n:** All new user-visible strings must be added to both `locales/en.json` and `locales/id.json`, then `pnpm generate:i18n`.
- **Testing:** TDD per `conductor/workflow.md`. Coverage thresholds: lines/functions/branches/statements ≥ 80%. Integration tests excluded from default run.
- **Concurrency pattern:** All checkpoint state transitions must use `db.transaction` + `.for('update')` inside the transaction, with status re-check after locking. Gold standard: `submitCheckpointHandler` (`src/server/submissions.server.ts`).

---

## Milestone 1: Critical Fixes (Concurrency, Data Integrity, Deadlines)

> These tracks address data corruption risks, race conditions, and logic errors that can cause incorrect state or lost data. They should be prioritized above all other work.

---

### TRACK-001: Concurrency & Transaction Safety
- **Status:** ✅ Complete · **Audit IDs:** BUG-1, BUG-2, BUG-5, BUG-6, BUG-7, BUG-8, BUG-9, BUG-13, BUG-17, BUG-22 · **Deps:** None
- **Key decisions:** `FOR UPDATE` + post-lock status re-check on all state transitions; instructor soft-delete requires reassigning all active assignments first; student soft-delete auto-rejects pending consultations/extensions; DB-first then auth API for 2FA disable; catch PG `23505` for email uniqueness
- **Detail:** `conductor/archive/concurrency-tx-safety_20260718/` (spec.md, plan.md)

### TRACK-002: Deadline & SLA Logic Correctness
- **Status:** ✅ Complete · **Audit IDs:** BUG-3, BUG-11, BUG-12, BUG-16, BUG-18, BUG-19, BUG-21, BUG-28 · **Deps:** None (coordinate with TRACK-001)
- **Key decisions:** `finalDeadline` is immutable (course-wide); per-student effective deadlines derived from checkpoint `dueDate` values via shared `computeEffectiveDeadline` helper; SLA clock anchored to submission upload time (`anchorTime` rename); `finalDeadline` cap enforced at creation time only
- **Detail:** `conductor/archive/deadline-sla-correctness_20260719/` (spec.md, plan.md)

### TRACK-003: Input Validation & Data Integrity
- **Status:** ✅ Complete · **Audit IDs:** BUG-10, BUG-15, BUG-24, BUG-25, BUG-26, BUG-27 · **Deps:** None
- **Key decisions:** Typed builder pattern (`.inputValidator(Schema)`) on all settings stubs; `getObjectContentLength` returns discriminated type (`not_configured`/`not_found`/`size`); validate ALL `studentIds` are active students pre-transaction; `EMAIL_FROM` added to `env.ts`; `instructorId` moved to WHERE clause; store R2-verified `actualSize` not client-reported `fileSize`
- **Detail:** `conductor/archive/input-validation-data-integrity_20260719/` (spec.md, plan.md)

### TRACK-004: Email Queue Robustness
- **Status:** ✅ Complete · **Audit IDs:** BUG-4, BUG-20, PERF-32, PERF-33 (re-scoped) · **Deps:** None
- **Key decisions:** Re-scoped to admin observability — queue inspector UI (`/admin/email-queue`) + manual retry (`FOR UPDATE` + idempotent guard) + structured logging + `EMAIL_FROM` config hygiene; original BUG-4/BUG-20/PERF-32/33 deferred to TRACK-016
- **Detail:** `conductor/archive/email-queue-robustness_20260719/` (spec.md, plan.md)

---

## Milestone 2: Performance & Optimization

> These tracks address database performance, query efficiency, and bundle safety. TRACK-005 (indexes) should be completed before TRACK-006 (query optimization) as indexes are a prerequisite for optimal query plans.

---

### TRACK-005: Database Indexes & Schema Optimization
- **Status:** ✅ Complete · **Audit IDs:** PERF-7, PERF-8, PERF-9, PERF-10, PERF-11, PERF-12, PERF-13, PERF-14 · **Deps:** None
- **Key decisions:** 7 new indexes + 2 replaced (`consultations_status` → composite `(assignmentId, status)`, `reviews_submission_id` → composite `(submissionId, createdAt)`); added table-callback functions to 4 previously plain-object tables; standard migration (no `CONCURRENTLY`)
- **Detail:** `conductor/archive/database-indexes-schema-optimization_20260719/` (spec.md, plan.md)

### TRACK-006: Query & Data-Fetching Optimization
- **Status:** ✅ Complete · **Audit IDs:** PERF-1–6, PERF-15–21, PERF-23–26, PERF-35, BUG-14 · **Deps:** TRACK-005
- **Key decisions:** N+1 elimination via `GROUP BY` + bulk `UPDATE ... WHERE`; full pagination on 5 list handlers + `.limit(20)` safety caps on dashboards; `LATERAL` join for latest-submission-per-checkpoint; narrow `SELECT` + explicit response construction (no `...item` spread); R2 `HEAD` moved before transaction; PERF-36 deferred
- **Detail:** `conductor/archive/query-data-fetching-optimization_20260719/` (spec.md, plan.md)

### TRACK-007: Session Caching & Bundle Safety
- **Status:** ✅ Complete · **Audit IDs:** PERF-22, PERF-34 · **Deps:** None
- **Key decisions:** 5s TTL in-memory session cache (`Map`) with lazy eviction; `auth.ts` split to two-file pattern (stub + handler); soft-delete check skipped on cache hit (5s delay tradeoff); PERF-37 (template caching) dropped
- **Detail:** `conductor/archive/session-caching-bundle-safety_20260719/` (spec.md, plan.md)

---

## Milestone 3: UX & Accessibility

> These tracks address user experience gaps, broken functionality, accessibility violations, and i18n compliance. Most tracks are independent and can be parallelized.

---

### TRACK-008: Critical UX Fixes (Broken Functionality)
- **Status:** ✅ Complete · **Audit IDs:** UX-29, UX-38, UX-39, UX-57 · **Deps:** None
- **Key decisions:** `FileUploader` `onResetSuccess` callback prop; 404/ErrorBoundary links to `/` with new `common.goHome` i18n key; pagination hidden on empty lists
- **Detail:** `conductor/archive/critical-ux-fixes_20260720/` (spec.md, plan.md)

### TRACK-009: Action Feedback & Loading States
- **Status:** ✅ Complete · **Audit IDs:** UX-1–9, UX-30, UX-31, UX-32 · **Deps:** None
- **Key decisions:** `showSuccessToast` helper + `toast.success` on all `onSuccess` handlers; 3 reusable skeleton components + `pendingComponent` on 7 routes; network vs server error differentiation; side-data error banner with retry; UX-33 (undo) dropped
- **Detail:** `conductor/archive/action-feedback-loading-states_20260720/` (spec.md, plan.md)

### TRACK-010: Accessibility (a11y) & i18n Compliance
- **Status:** ✅ Complete · **Audit IDs:** UX-13–24, UX-50 · **Deps:** None
- **Key decisions:** `NotificationCenter` refactored to shadcn `Sheet` (focus trap, Escape, backdrop); `NotificationItem` → `<button>`; dynamic `aria-label` with unread count; `formatDate` replaces `toLocaleDateString`; ARIA on progress bars/collapsibles/icon buttons; `aria-hidden` on decorative elements
- **Detail:** `conductor/archive/accessibility-i18n-compliance_20260720/` (spec.md, plan.md)

### TRACK-011: Search Debounce & Form Validation
- **Status:** ✅ Complete · **Audit IDs:** UX-25, UX-26, UX-27, UX-28, UX-54, UX-56 · **Deps:** None
- **Key decisions:** Custom `useDebouncedCallback` hook (300ms) on 4 server-side search inputs; 3 forms migrated to `react-hook-form` + Zod (`onBlur` validation); `XMLHttpRequest` replaces `fetch` for upload progress; X clear-button on search inputs
- **Detail:** `conductor/archive/search-debounce-form-validation_20260720/` (spec.md, plan.md)

### TRACK-012: Notifications & File Management UX
- **Status:** ✅ Complete · **Audit IDs:** UX-41, UX-42, UX-46, UX-48, UX-49, UX-51, UX-53, PERF-27, PERF-29, PERF-30, PERF-31 · **Deps:** TRACK-010
- **Key decisions:** Notification `metadata` → client-side route map → navigable `<Link>` items; "Next Review" button; All/Unread tabs + "Load More"; DOCX "preview not available" card; "Latest" version badge; `staleTime: 30s` + `refetchInterval: 30s` + `React.memo` + `useMemo`; UX-47/UX-52 dropped
- **Detail:** `conductor/archive/notifications-file-management-ux_20260720/` (spec.md, plan.md)

### TRACK-013: Empty States, Date Display & Mobile Polish
- **Status:** ✅ Complete · **Audit IDs:** UX-10, UX-11, UX-12, UX-34, UX-35, UX-36, UX-43, UX-45 · **Deps:** Coordinate with TRACK-010
- **Key decisions:** `EmptyState` component replaces `null` returns; `formatDistanceToNow` for relative dates; `SLABadge` `title` tooltip; mobile card layout for `ProgressTable`; `flex-col` responsive for `CheckpointListEditor`; UX-44 (timezone) dropped
- **Detail:** `conductor/archive/empty-states-date-display-mobile-polish_20260721/` (spec.md, plan.md)

---

## Milestone 4: Quality Assurance

> This milestone addresses testing infrastructure. It is not tied to specific audit findings — it implements end-to-end test coverage for critical user flows.

---

### E2E-FEAT-001: E2E Testing with Playwright
- **Status:** ✅ Complete · **Audit IDs:** None (proactive testing infrastructure) · **Deps:** None (requires core features)
- **Key decisions:** Dedicated `postgres-test` DB (port 5433); `loginAsRole` via API submit (Base UI Button renders `type="button"`); R2 upload not E2E-tested (TanStack Start server-fn limitation — direct DB insertion workaround); `workers: 1` for DB isolation; `reuseExistingServer` CI-conditional
- **Detail:** `conductor/archive/e2e-playwright-tests_20260721/` (spec.md, plan.md)

---

## Milestone 5: Post-Audit Enhancements

> These tracks address improvement opportunities identified in a follow-up audit conducted after the completion of Milestones 1–3 (the original 98-issue, 13-track remediation) and Milestone 4 (E2E test coverage). Findings are prefixed `ENH-` to distinguish them from the original `BUG-X`/`PERF-X`/`UX-X` audit IDs. Several tracks also pull in items deliberately deferred from the original audit (BUG-4, BUG-20, PERF-32/33). Tracks are ordered by recommended priority: quick wins first, then operational hygiene, productivity, and finally larger feature builds.
>
> **Note:** E2E test coverage (originally a candidate for this milestone) was implemented upstream in Milestone 4 (E2E-FEAT-001) and is therefore excluded here.

---

### TRACK-014: Optimistic UI Updates for Mutations
- **Status:** ✅ Complete · **Audit IDs:** ENH-PERF-1 · **Deps:** None (introduces query-key factory consumed by later tracks)
- **Key decisions:** Query-key factory (6 domains); 5 plain `async`+`useState` mutations refactored to `useMutation`+`useQuery`; optimistic `onMutate`/`onError`/`onSettled` on 9 mutation sites; server-error rollback via `throw` on `!result.success`; `DeadlineManager` invalidation fix
- **Detail:** `conductor/archive/optimistic-ui-updates_20260722/` (spec.md, plan.md)

### TRACK-015: UI Hygiene & Tech-Debt Quick Wins
- **Status:** ✅ Complete · **Audit IDs:** ENH-UX-1, ENH-TD-1 · **Deps:** TRACK-014
- **Key decisions:** Footer "About" → `#how-it-works` anchor, "Contact" removed, copyright via i18n key; 3 `useEffect`+`useState` fetches → `useQuery` (removes `eslint-disable exhaustive-deps`); ENH-TD-2 invalid (`toast.error` already present)
- **Detail:** `conductor/archive/ui-hygiene-tech-debt-quick-wins_20260722/` (spec.md, plan.md)

### TRACK-016: Email Queue Retention & Delivery Completeness
- **Status:** ✅ Complete · **Audit IDs:** ENH-OPS-1, BUG-4, BUG-20, PERF-32, PERF-33 · **Deps:** None
- **Key decisions:** `resendMessageId` column populated from Resend response; retention `DELETE` (sent >90d, failed >180d) via tick-embedded `lastPruneAt`; chunked `Promise.allSettled` sends (batches of 5)
- **Detail:** `conductor/archive/email-queue-retention-delivery-completeness_20260722/` (spec.md, plan.md)

### TRACK-017: Instructor Productivity: DOCX Preview & Keyboard Shortcuts
- **Status:** ✅ Complete · **Audit IDs:** ENH-UX-2, ENH-UX-3, ENH-PERF-2 · **Deps:** None
- **Key decisions:** `mammoth.js` (dynamic import) for `.docx` → HTML in sandboxed `iframe` (`sandbox=""`); 10MB size guard; two-layer keyboard shortcuts (global `R`/`?` + review `J`/`K`); preload pending review list for instant J/K nav; `preload="intent"` on sidebar links
- **Detail:** `conductor/archive/instructor-productivity-docx-preview-keyboard-shortcuts_20260722/` (spec.md, plan.md)

### TRACK-018: Event Email Notifications
- **Status:** ✅ Complete · **Audit IDs:** ENH-FEAT-1 · **Deps:** None
- **Key decisions:** 8 event email templates (`email-templates.ts`) alongside in-app notifications; post-commit advisory `enqueueEmail` (try/catch, no rollback); `template_type` CHECK extended 4→12; `resolveEmailRecipient` skips soft-deleted/unverified; per-user preferences deferred
- **Detail:** `conductor/archive/event-email-notifications_20260722/` (spec.md, plan.md)

### TRACK-019: Analytics & Reporting
- **Status:** ✅ Complete · **Audit IDs:** ENH-FEAT-2 · **Deps:** None
- **Key decisions:** Phased delivery (dashboards then export); admin + instructor analytics with URL date-range params; CSV via server-fn returning string + client `Blob`; Excel via existing `xlsx` dep; no new DB tables; CSV injection mitigation; no charting lib (tables/progress bars)
- **Detail:** `conductor/archive/analytics-reporting_20260722/` (spec.md, plan.md)

---

## Milestone 6: New Features

> New feature tracks beyond the original audit remediation (Milestones 1–3), E2E testing (Milestone 4), and post-audit enhancements (Milestone 5). These tracks build on the hardened foundation to add new product capabilities.

---

### TRACK-020: Rubric-Based Grading & Evaluation
- **Status:** Complete | **Audit IDs:** None (new feature) | **Deps:** None
- **Key decisions:** `grading_type` pgEnum (nullable) on `template_checkpoints` (`null`/`numeric`/`qualitative`); `checkpoints.templateCheckpointId` FK (nullable, backfilled); `rubric_criteria`/`rubric_levels` with soft-delete; `review_scores` with full denormalized snapshot (`criterionTitle`, `levelLabel`, `score`, `weight`); `updateTemplateHandler` refactored from delete+reinsert to upsert/diff (preserves checkpoint IDs); weight-sum (100%) validation at Zod application layer; live rubric lookup at review time + frozen snapshot for completed reviews; rubric analytics (avg per criterion, cross-instructor comparison, CSV/Excel export); review fixes: validation-before-insert to prevent orphaned reviews, `.returning()` for review ID, TOCTOU lock on `saveRubricHandler`, `safeAuditLog` helper, Excel injection mitigation, a11y (aria-live, accessible labels, stable React keys)
- **Detail:** `conductor/archive/rubric-based-grading-evaluation_20260723/` (spec.md, plan.md)

### TRACK-021: Proactive Deadline Reminder System
- **Status:** ✅ Complete · **Deps:** None
- **Key decisions:** Background scanner (`processDeadlineReminders()`) runs hourly via email-queue tick throttled by `lastReminderScanAt`; tiered reminders (7d/3d/1d lead times) with non-overlapping bands (`>3d`/`>1d`/`>0d`) firing in-app notifications + emails; `deadline_reminders` dedup table with unique `(checkpointId, tier)` + `ON CONFLICT DO NOTHING RETURNING *` for multi-instance safety; `checkpoints_state_due_date_idx` composite index; dedup + notification inserts wrapped in `db.transaction` (atomicity — if notification insert fails, dedup row rolls back so the tier can retry); email dispatch post-commit via `Promise.allSettled` (advisory, never throws); `deadline_reminder` added to `email_queue.templateType` Drizzle text enum (code-only, no `ALTER TYPE`); email subject `{assignmentTitle}` interpolated via `subjectParams` on `enqueueEventEmail`; scanner failure isolated via `try/catch` in `tick()` (email processing unaffected)
- **Detail:** `conductor/archive/proactive-deadline-reminders_20260723/` (spec.md, plan.md)

### TRACK-022: User Notification Preferences

*   **Status:** `Pending`
*   **Dependencies:** None (recommended AFTER TRACK-021 — prevents `deadline_reminder` notifications from being un-mutable; TRACK-021 is now complete)
*   **Estimated Effort:** 5 Days / 3 Sprint Loops

#### Context Anchors (Traceability)
*   **PRD Reference:** `docs/PRD.md#checkpoints--submissions` (notification event types — review/consultation/extension outcomes), `docs/PRD.md#analytics--reporting` (notification volume metrics)
*   **TDD Reference:** `docs/TDD.md` `users` table (`src/db/schema/users.ts:21` — `settings` JSONB column, currently typed `{ reducedMotion: boolean }`), `notifications` table (`src/db/schema/notifications.ts:13` — `type`, `channel`, `params`), `email_queue` table (`src/db/schema/email-queue.ts:3` — `templateType` enum); `src/lib/event-email.ts:12` (`enqueueEventEmail` — single email chokepoint, never checks preferences), `src/lib/email.ts:35-58` (`resolveEmailRecipient` — selects `email`/`locale`/`emailVerified`/`deletedAt` but NOT `settings`), `src/server/settings.ts:10-12` (`UpdateUserSettingsSchema` — `z.object({ reducedMotion })`), `src/server/settings.server.ts:106-128` (`updateUserSettingsHandler` — REPLACES entire settings via `.set({ settings: { reducedMotion } })`, MUST refactor to merge), `src/components/settings/SettingsPage.tsx` (6 sections — needs `NotificationPreferencesSection`), `src/components/settings/AccessibilitySection.tsx` (UI pattern template — `useQuery(['currentUser'])` + `useMutation(updateUserSettings)` + `queryClient.invalidateQueries`), `src/components/notifications/NotificationCenter.tsx:15-36` (`GROUP_CONFIGS` — 4 groups for UI taxonomy), `src/lib/email.ts:9-21` (`TemplateType` — 13 values, 4 system/security + 9 event types)

#### Track Tech Stack
*   Drizzle ORM — NO new tables, NO migration needed. The `users.settings` JSONB column already exists (`src/db/schema/users.ts:21`). Only the TypeScript type annotation needs extension: `.$type<{ reducedMotion: boolean; notificationPrefs?: NotificationPrefs }>()`
*   Existing file refactor: `src/server/settings.server.ts:106-128` `updateUserSettingsHandler` — change from REPLACE (`.set({ settings: { reducedMotion } })`) to MERGE (read existing → spread → write merged object). Required so adding `notificationPrefs` doesn't overwrite `reducedMotion` and vice versa
*   Existing file extension: `src/server/settings.ts:10-12` `UpdateUserSettingsSchema` — extend with optional `notificationPrefs` field
*   Existing file extension: `src/lib/email.ts:35-58` `resolveEmailRecipient` — extend SELECT to also return `settings` (for preference check in `enqueueEventEmail`)
*   Existing file extension: `src/lib/event-email.ts:12-31` `enqueueEventEmail` — add preference gate: check `recipient.settings?.notificationPrefs?.[notificationType]?.email !== false` before enqueuing. Add optional `notificationType?: string` param (defaults to `templateType` for backward compat — resolves the `sla_breach`↔`sla_alert` and `deadline_extended`↔`extension_approved` type mismatches)
*   Existing file extension: `src/lib/extension-email.ts` `sendExtensionApprovedEmail` — add optional `notificationType` param (defaults to `'extension_approved'`). When called from `bulkExtendHandler` (`extensions-extras.server.ts:446`), caller passes `notificationType: 'deadline_extended'` so preference lookup uses the correct notification type
*   New shared helper: `src/lib/notification-prefs.ts` — exports `shouldSendInAppNotification(settings, type): boolean` (pure function, no DB query — reads from pre-fetched `settings`). Used at the 11 in-app notification creation sites before `db.insert(notifications)`
*   shadcn/ui components — `Switch` per type × channel, `Card`/`CardHeader`/`CardContent` following `AccessibilitySection.tsx` pattern, grouped by `GROUP_CONFIGS` taxonomy (newReviews, consultations, submissions, system)
*   i18n codegen — new keys in both `locales/en.json` and `locales/id.json` (`settings.notificationPreferences.*` namespace)

#### Scope Boundaries
*   **In Scope:**
    *   **Settings type extension:** Extend `users.settings` JSONB type in `src/db/schema/users.ts:21` to `.$type<{ reducedMotion: boolean; notificationPrefs?: Record<string, { email?: boolean; inApp?: boolean }> }>()`. The key is the notification `type` string (e.g., `'submission_received'`, `'review_completed'`, `'sla_breach'`). Absent key or absent sub-field = default `true` (enabled)
    *   **Schema refactor — updateUserSettingsHandler:** Refactor `src/server/settings.server.ts:106-128` from replace to merge: `const existing = await db.select({ settings: users.settings }).from(users).where(eq(users.id, session.user.id)); const merged = { ...existing.settings, ...input }; await db.update(users).set({ settings: merged })`. Without this refactor, saving `notificationPrefs` would overwrite `reducedMotion` and vice versa
    *   **Zod schema extension:** Extend `UpdateUserSettingsSchema` in `src/server/settings.ts:10-12` with optional `notificationPrefs: z.record(z.string(), z.object({ email: z.boolean().optional(), inApp: z.boolean().optional() })).optional()`
    *   **Email preference gate:** Extend `resolveEmailRecipient` (`src/lib/email.ts:35-58`) to also SELECT `settings`. Extend `enqueueEventEmail` (`src/lib/event-email.ts:12-31`) to check `recipient.settings?.notificationPrefs?.[notifType]?.email !== false` before calling `enqueueEmail`. If email is disabled for that type, skip enqueue silently (advisory — no throw). Add optional `notificationType?: string` param to `enqueueEventEmail` (defaults to `templateType`)
    *   **Type mismatch resolution:** Two notification types have email `templateType` values that don't match their in-app `type`: (1) `sla_breach` in-app type ↔ `sla_alert` email templateType — `sendSLAAlertEmail` passes `notificationType: 'sla_breach'`; (2) `deadline_extended` in-app type → email sent via `sendExtensionApprovedEmail` with `templateType: 'extension_approved'` — `sendExtensionApprovedEmail` gains optional `notificationType` param, `bulkExtendHandler` (`extensions-extras.server.ts:446`) passes `notificationType: 'deadline_extended'`. All other 9 event types match 1:1 (default `notificationType = templateType`)
    *   **In-app preference helper:** New `src/lib/notification-prefs.ts` exporting `shouldSendInAppNotification(settings: unknown, type: string): boolean` — returns `false` only if `settings?.notificationPrefs?.[type]?.inApp === false`. Otherwise `true` (default enabled). Pure function — no DB query, reads from pre-fetched user settings
    *   **In-app notification gate (12 sites):** At each of the 12 in-app notification creation sites, read the recipient's `settings` (already fetched or add lightweight `SELECT settings FROM users WHERE id = ?` before the insert) and conditionally skip `db.insert(notifications)` when `shouldSendInAppNotification` returns `false`. Sites: `consultations.server.ts:115` (`consultation_logged`), `consultations.server.ts:385` (`consultation_verified`), `consultations.server.ts:462` (`consultation_rejected`), `extensions.server.ts:212` (`extension_requested`), `extensions-extras.server.ts:157` (`extension_approved`), `extensions-extras.server.ts:276` (`extension_rejected`), `extensions-extras.server.ts:432` (`deadline_extended`), `submissions.server.ts:210` (`submission_received`), `reviews.server.ts:417` (`review_completed`), `reviews.server.ts:433` (`revision_requested`), `review-sla.ts:100` (`sla_breach`), `deadline-reminder-scanner.ts` (`deadline_reminder` — batch insert added in TRACK-021)
    *   **Security types exempt:** The 4 system/security email templateTypes (`password_reset`, `invitation`, `two_factor`, `sla_alert` when sent to admins) are NEVER gated by preferences. Only the 9 event-notification types are configurable. `sla_breach` is configurable for admins (it's an event notification, not a security email)
    *   **UI — NotificationPreferencesSection:** New `src/components/settings/NotificationPreferencesSection.tsx` following `AccessibilitySection.tsx` pattern: `useQuery(['currentUser'])` for data, `useMutation(updateUserSettings)` for saves, `queryClient.invalidateQueries(['currentUser'])` on success. Renders a table/matrix grouped by `GROUP_CONFIGS` (4 groups: newReviews, consultations, submissions, system) with `Switch` toggles per type × channel (email/in-app). Added as 7th section in `SettingsPage.tsx`
    *   **Default state:** All notifications enabled. Existing users keep current behavior (all on). Users opt OUT. No data migration needed — absent keys = enabled
    *   i18n keys for all labels, group names, channel names, descriptions in both locales
*   **Out of Scope:**
    *   Digest/summary mode (batch emails instead of per-event — v2)
    *   Do-not-disturb time windows (v2 — suppress notifications during configured hours)
    *   Admin-enforced minimum notification requirements (v2 — admin can lock certain types as non-mutable)
    *   Notification frequency caps (v2 — max N emails per hour per user)
    *   Per-channel preference for TRACK-021's `deadline_reminder` type (TRACK-021 should be implemented after TRACK-022 so it naturally inherits the preference system — no special handling needed)

#### High-Level Execution Vectors
*   **Phase 1 (Settings Backend Refactor):** Extend `users.settings` type in `src/db/schema/users.ts:21` with `notificationPrefs`. Refactor `updateUserSettingsHandler` (`src/server/settings.server.ts:106-128`) from replace to merge (read existing → spread → write). Extend `UpdateUserSettingsSchema` (`src/server/settings.ts:10-12`) with optional `notificationPrefs`. NO migration (JSONB column exists). Write tests (merge preserves `reducedMotion` when saving `notificationPrefs` and vice versa, default state when no prefs set, Zod validation rejects malformed prefs). Verify: saving `notificationPrefs` does not clobber `reducedMotion`, saving `reducedMotion` does not clobber `notificationPrefs`, missing prefs = all enabled.
*   **Phase 2 (Preference Gates):** Extend `resolveEmailRecipient` (`src/lib/email.ts:35-58`) to SELECT `settings`. Extend `enqueueEventEmail` (`src/lib/event-email.ts:12-31`) with optional `notificationType` param + preference check (skip enqueue if `notificationPrefs[notifType].email === false`). Update `sendExtensionApprovedEmail` (`src/lib/extension-email.ts`) with optional `notificationType` param — `bulkExtendHandler` passes `'deadline_extended'`. Update `sendSLAAlertEmail` to pass `notificationType: 'sla_breach'`. Create `src/lib/notification-prefs.ts` with `shouldSendInAppNotification(settings, type)`. Apply at 11 in-app creation sites (conditional insert). Write tests (email skipped when disabled, email sent when enabled, email sent when no pref set, in-app skipped when disabled, security types never gated, `notificationType` override works for `sla_breach`/`deadline_extended`, merge behavior in handler). Verify: disabled email type produces no `email_queue` row, disabled in-app type produces no `notifications` row, all other notifications unaffected, security emails always sent.
*   **Phase 3 (UI & i18n):** Create `src/components/settings/NotificationPreferencesSection.tsx` following `AccessibilitySection.tsx` pattern. Render grouped by `GROUP_CONFIGS` with `Switch` per type × channel. Add to `SettingsPage.tsx` as 7th section. Add i18n keys to both `locales/en.json` + `locales/id.json` (`settings.notificationPreferences.*`, group labels matching `GROUP_CONFIGS` keys, per-type labels matching `notifications.events.*` titles). Run `pnpm generate:i18n`. Write tests (section renders all 11 types, toggles call `updateUserSettings` with correct payload, `queryClient.invalidateQueries` on success, default state = all switches on). Verify: `pnpm check:i18n` parity, all 11 types displayed, toggles persist across reload, `reducedMotion` unaffected by preference saves.

#### Verification & Definition of Done (DoD)
*   [ ] **Manual Checkpoint:** User opens Settings → sees Notification Preferences section with 4 groups (Reviews, Consultations, Submissions, System) and 11 event types, each with Email + In-app toggles (all ON by default). User disables email for `submission_received` → instructor no longer receives emails for new submissions, but still gets in-app notifications. User disables in-app for `review_completed` → student no longer sees in-app notifications for completed reviews, but still receives emails. User disables both for `consultation_rejected` → no notification at all for that event. Saving notification preferences does NOT reset `reducedMotion` (merge behavior). Saving `reducedMotion` does NOT reset notification preferences. A user with no preferences set (existing user) receives all notifications as before. Security emails (password reset, invitation, two-factor) are always sent regardless of preferences. `sla_breach` email preference works (despite `templateType: 'sla_alert'` — `notificationType: 'sla_breach'` override). `deadline_extended` email preference works (despite email sent via `sendExtensionApprovedEmail` — `notificationType: 'deadline_extended'` override).
*   [ ] **Automated Tests:** `pnpm test:unit` — all tests pass. New tests for: `updateUserSettingsHandler` merge behavior (preserves `reducedMotion` when saving `notificationPrefs`, preserves `notificationPrefs` when saving `reducedMotion`, defaults when no prefs), `UpdateUserSettingsSchema` Zod validation (accepts valid `notificationPrefs`, rejects malformed), `resolveEmailRecipient` returns `settings`, `enqueueEventEmail` preference gate (skips when email disabled, sends when enabled, sends when no pref, security types not gated), `enqueueEventEmail` `notificationType` override (default = `templateType`, `sla_breach` uses `sla_breach` not `sla_alert`, `deadline_extended` uses `deadline_extended` not `extension_approved`), `shouldSendInAppNotification` helper (returns `false` only when `inApp === false`, returns `true` when absent/undefined), 11 in-app sites conditionally skip insert, `NotificationPreferencesSection` rendering (all 11 types, 4 groups, default all-on, toggle calls mutation, invalidation on success). `pnpm check:i18n` — parity for all new keys. `pnpm test:coverage` >= 80% on all thresholds.
*   [ ] **Conductor Review:** No new DB table or migration (uses existing `users.settings` JSONB column). `updateUserSettingsHandler` refactored from replace to merge (no data loss). `resolveEmailRecipient` extended to return `settings`. `enqueueEventEmail` gates on `notificationPrefs[notifType].email`. `notificationType` param added for `sla_breach`/`deadline_extended` type mismatches. 4 security email types (`password_reset`, `invitation`, `two_factor`, `sla_alert`-to-admins-when-needed) never gated. 11 in-app sites gated via `shouldSendInAppNotification` helper. `NotificationPreferencesSection` follows `AccessibilitySection.tsx` pattern. Default state = all enabled (opt-out). No data migration. All files under 500 lines. `pnpm typecheck`, `pnpm lint`, `pnpm check:i18n` all clean.

### TRACK-023: At-Risk Student Identification & Early Warning System
- **Status:** ✅ Complete · **Deps:** None (complementary to TRACK-021)
- **Key decisions:** Pure function `computeStudentRisk(data): RiskAssessment` with 5 risk signals (overdue=High, approaching deadline no submission=Medium, insufficient consultations=Medium, repeated revise>=2=Medium, stalled review>3d=Low); signals 1-4=`student_inaction`, 5=`pending_review`; overall level=highest severity; ephemeral (never persisted); `checkAndFireRiskAlert` advisory post-commit (try/catch, 7-day dedup via notifications table JSON metadata, `Promise.allSettled` for parallel notification+email); `maybeFireReviewRiskAlert` called from `submitReviewHandler` when revise OR SLA breach (double try/catch safety); deadline reminder scanner integration via `Promise.allSettled`; instructor dashboard at-risk widget (sorted by severity, i18n factor descriptions via `getRiskFactorText`, `EmptyState` when none); admin analytics `atRiskSummary`{high,medium,low} with colored Badge UI (destructive/warning/info); `student_at_risk` notification type (instructor target, `system` group in `GROUP_CONFIGS`, route to `/instructor/assignments/` + assignmentId); `buildStudentAtRiskHtml` email template + `sendStudentAtRiskEmail` wrapper; `student_at_risk` added to `templateType` enum (code-only, no ALTER TYPE -- 14 values now); review fixes applied: i18n factor descriptions resolved via `getRiskFactorText` in dashboard widget, admin analytics `atRiskSummary` UI card added with Badge components + `EmptyState`
- **Detail:** conductor/archive/at-risk-student-early-warning_20260724/ (spec.md, plan.md)

---

## Milestone 7: Infrastructure & Tooling

> This milestone addresses proactive infrastructure and tooling upgrades that improve developer experience, build performance, and toolchain currency. These tracks are not audit-driven — they are technology refresh initiatives.

---

### TRACK-024: TypeScript 7 Upgrade

- **Status:** `Complete`
- **Dependencies:** None
- **Estimated Effort:** 1 Day / 0.5 Sprint Loops
- **Audit IDs:** None (proactive infrastructure upgrade, not audit-driven)
- **Completed:** 2026-07-23 (Conductor track `typescript-7-upgrade_20260723`, archived to `conductor/archive/`)
- **Decisions:**
  - **Direct upgrade path (5.8 → 7.0):** The project is on TypeScript `^5.8.0`. Microsoft recommends going through TS 6.0 as a bridge, but the project's tsconfig is already 95% TS 7-ready. The only deprecated option in use is `baseUrl: "."` (removed in TS 7). Since `paths` already uses `./src/*` (relative to project root), removing `baseUrl` is a trivial 1-line change with zero functional impact. A direct upgrade is low-risk.
  - **No Compiler API consumers (confirmed):** Grep across all `.ts/.tsx/.js/.mjs/.cjs` files confirmed zero direct imports of the `typescript` package. The toolchain is fully decoupled from the TS compiler API: oxlint uses its own parser (not typescript-eslint), Vitest transforms via Vite/esbuild, tsx is esbuild-based, and drizzle-kit has its own TS parser. The biggest blocker for most projects (tooling that `import`s from `typescript`) does not apply.
  - **No blocked frameworks:** No Vue, Svelte, Astro, MDX, or Angular — all of which need the compiler API for template type-checking and are blocked on TS 7.1. Pure React 19 + TanStack Start.
  - **tsc is type-checking only:** The project uses `tsc --noEmit --incremental` exclusively. Transpilation is handled by Vite/esbuild. No emit path, no downleveling concerns. TS 7's removal of `target: es5` and `module: amd/umd/systemjs/none` is irrelevant.
  - **`tsconfig.tsbuildinfo` deletion:** The Go compiler's incremental artifacts are incompatible with the JS compiler's. Must be deleted before the first TS 7 run.
  - **`noUncheckedSideEffectImports` default change:** TS 7 defaults this to `true` — may surface new errors for side-effect imports with typos. Beneficial, but watch during triage.
  - **No `@typescript/typescript6` side-by-side needed:** The project has no tooling that imports the TS compiler API, so the compatibility shim package is unnecessary. `tsc` alone suffices.
  - **Expected gains:** 8–12x faster `pnpm typecheck` (the pre-push gate), faster editor/language server experience, new `--checkers`/`--builders` flags for CI parallelism tuning, and a rebuilt `--watch` mode (Parcel-based file watcher).

#### Completion Summary

- **TypeScript version:** `^5.8.0` → `^7.0.0` (resolved to 7.0.2). Native Go compiler port.
- **tsconfig.json:** Removed `baseUrl: "."` (removed in TS 7). Path alias `"@/*": ["./src/*"]` resolves relative to project root — zero functional impact.
- **tsconfig.tsbuildinfo:** Deleted (incompatible incremental cache format between JS and Go compilers). Regenerated by first TS 7 run.
- **CI typecheck gate (`lefthook.yml`):** Pre-push typecheck updated from `pnpm typecheck` to `pnpm exec tsc --noEmit --incremental --checkers 4` — explicitly enables TS 7 shared-memory multithreading with 4 workers (TS 7 default).
- **Benchmark:** `pnpm typecheck` median time: **8.85s (TS 5.8) → 1.40s (TS 7.0.2)** — **~6.3x speedup** (slightly below the 8–12x estimate, likely due to incremental cache being warm for both measurements).
- **Quality gates (all pass under TS 7):** `pnpm typecheck` (0 errors), `pnpm test:coverage` (299 files, 2937 tests; coverage Stmts 88.26%, Branches 81.9%, Functions 84.08%, Lines 88.88% — all ≥80%), `pnpm lint` (0 warnings, 0 errors across 272 files), `pnpm check:i18n` (EN↔ID parity confirmed, 629 keys used / 762 in each locale).
- **Smoke tests:** `pnpm dev` (dev server starts, i18n codegen passes, Vite ready in ~1.8s), `pnpm build` (client build 3918 modules in 3.08s, SSR build 1116 modules in 1.74s, migrate/seed bundles generated).
- **Config verification tests:** Added `tests/unit/config/typescript-7-upgrade.test.ts` (4 tests: no `baseUrl` in tsconfig, TS version ≥7.0, `--checkers` flag in lefthook.yml, paths alias regression guard).
- **Code commits:** `1827970` (TS upgrade + baseUrl removal), `3d31fb4` (--checkers flag), `1fa5742` (config verification tests).
- **No regressions:** All 2937 existing tests pass unchanged. `noUncheckedSideEffectImports` (new TS 7 default) surfaced zero side-effect import typos.

#### Context Anchors (Traceability)

- **PRD Reference:** N/A (infrastructure upgrade, no product impact)
- **TDD Reference:** N/A (no architecture change — type-checking logic is structurally identical between TS 6.0 and 7.0)
- **Toolchain Reference:** `package.json` (devDependencies), `tsconfig.json`, `AGENTS.md` (developer commands)

#### Track Tech Stack

- TypeScript 7.0 (native Go port — `typescript` npm package, `latest` tag)
- `tsconfig.json` (remove `baseUrl`, verify all other options are TS 7-compatible)
- `pnpm` (package manager)
- CI type-checking (`--checkers`, `--builders` flags for parallelism tuning)

#### Scope Boundaries

- **In Scope:**
  - Remove `baseUrl: "."` from `tsconfig.json` (paths `@/*` → `./src/*` already relative to project root — no functional impact).
  - Update `package.json`: `"typescript": "^5.8.0"` → `"^7.0.0"`.
  - Delete `tsconfig.tsbuildinfo` (incompatible incremental format between JS and Go compilers).
  - Run `pnpm install`, `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm build` — triage any errors from new strict defaults or removed options.
  - Verify `noUncheckedSideEffectImports: true` (new default) doesn't surface side-effect import typos.
  - Optionally tune CI `--checkers N` for type-checking parallelism (default 4).
- **Out of Scope:**
  - TypeScript 6.0 bridge upgrade (unnecessary — tsconfig is already clean enough for direct upgrade)
  - `@typescript/typescript6` side-by-side install (no compiler API consumers to bridge)
  - VS Code extension changes (developer preference, not a project config change)
  - Refactoring code to accommodate new strict defaults (none expected — `strict: true` already set)

#### High-Level Execution Vectors

- **Phase 1 (Config reconciliation):** Remove `baseUrl: "."` from `tsconfig.json`. Verify all other tsconfig options against the TS 7 removed-options list (`target: es5`, `moduleResolution: node/node10/classic`, `module: amd/umd/systemjs/none`, `downlevelIteration`, `esModuleInterop: false`, `alwaysStrict: false`, `module` keyword in namespaces, `assert` import attributes, `ignoreDeprecations`). All confirmed absent via grep audit.
- **Phase 2 (Install & typecheck):** Delete `tsconfig.tsbuildinfo`. Update `package.json` TypeScript version to `^7.0.0`. Run `pnpm install`. Run `pnpm typecheck` — triage any errors. Expected: none (config already matches all TS 7 defaults). If `noUncheckedSideEffectImports` surfaces side-effect import issues, fix the import typos.
- **Phase 3 (Full verification):** Run `pnpm test` (unit + integration), `pnpm lint`, `pnpm build`. Verify all gates pass. Optionally benchmark `pnpm typecheck` before/after to document the speedup. Optionally tune `--checkers N` in CI for parallelism.

#### Verification & Definition of Done (DoD)

- [x] **Manual Checkpoint:** `pnpm typecheck` passes on TS 7.0 with no errors. `pnpm test` (unit + integration) — all pass. `pnpm build` — prod build succeeds (codegen + vite build + migrate/seed bundles). `pnpm dev` — dev server starts, HMR works, editor shows TS 7 language server. Measure `pnpm typecheck` time before (TS 5.8) and after (TS 7.0) — document the speedup.
- [x] **Automated Tests:** `pnpm test:unit` — all existing tests pass unchanged (type-checking logic is structurally identical between TS 6.0 and 7.0). `pnpm test:coverage` ≥80%. `pnpm typecheck` clean. `pnpm lint` — 0 warnings, 0 errors. `pnpm check:i18n` — parity maintained.
- [x] **Conductor Review:** `tsconfig.json` has no `baseUrl`. `tsconfig.tsbuildinfo` deleted and regenerated by TS 7. No deprecated/removed tsconfig options remain (grep for `baseUrl`, `target: es5`, `moduleResolution: node`, `module: amd/umd/systemjs`, `downlevelIteration`, `ignoreDeprecations` — all zero). `package.json` TypeScript version is `^7.0.0`. No `@typescript/typescript6` dependency added (not needed). All pre-push gates pass (`pnpm typecheck` && `pnpm vitest run --coverage`).

---

## Track Dependency Graph

```
Milestone 1: Critical Fixes
├── TRACK-001: Concurrency & Transaction Safety [no deps]
├── TRACK-002: Deadline & SLA Logic Correctness [coordinate with 001]
├── TRACK-003: Input Validation & Data Integrity [no deps]
└── TRACK-004: Email Queue Robustness [no deps]

Milestone 2: Performance & Optimization
├── TRACK-005: Database Indexes & Schema Optimization [no deps]
├── TRACK-006: Query & Data-Fetching Optimization [depends on 005]
└── TRACK-007: Session Caching & Bundle Safety [no deps]

Milestone 3: UX & Accessibility
├── TRACK-008: Critical UX Fixes (Broken Functionality) [no deps]
├── TRACK-009: Action Feedback & Loading States [no deps]
├── TRACK-010: Accessibility & i18n Compliance [no deps]
├── TRACK-011: Search Debounce & Form Validation [no deps]
├── TRACK-012: Notifications & File Management UX [depends on 010]
└── TRACK-013: Empty States, Date Display & Mobile [coordinate with 010]

Milestone 4: Quality Assurance
└── E2E-FEAT-001: E2E Testing with Playwright [no deps — requires core features]

Milestone 5: Post-Audit Enhancements
├── TRACK-014: Optimistic UI Updates for Mutations [Complete — introduces query-key factory]
├── TRACK-015: UI Hygiene & Tech-Debt Quick Wins [Complete — archived]
├── TRACK-016: Email Queue Retention & Delivery Completeness [no deps]
├── TRACK-017: Instructor Productivity: DOCX Preview & Keyboard Shortcuts [no deps]
├── TRACK-018: Event Email Notifications [Complete — no deps]
└── TRACK-019: Analytics & Reporting [no deps]

Milestone 6: New Features
├── TRACK-020: Rubric-Based Grading & Evaluation [Complete — archived]
├── TRACK-021: Proactive Deadline Reminder System [no deps — recommended after 022]
├── TRACK-022: User Notification Preferences [no deps — recommended before 021]
└── TRACK-023: At-Risk Student Identification [Complete — archived]

Milestone 7: Infrastructure & Tooling
└── TRACK-024: TypeScript 7 Upgrade [Complete — archived]
```

### Parallelization Strategy

The following track groups can be worked on simultaneously:

| Group | Tracks | Rationale |
|-------|--------|-----------|
| **A** | TRACK-001, TRACK-003, TRACK-004, TRACK-007, TRACK-008 | Fully independent — no file overlap |
| **B** | TRACK-002 + TRACK-001 | Both touch extension handlers — coordinate to avoid merge conflicts |
| **C** | TRACK-005 → TRACK-006 | Sequential — indexes must precede query optimization |
| **D** | TRACK-009, TRACK-010, TRACK-011 | Independent UX tracks — minimal file overlap |
| **E** | TRACK-012 + TRACK-010 | NotificationCenter refactor in 010 precedes notification UX in 012 |
| **F** | TRACK-013 + TRACK-010 | Both touch date formatting — coordinate i18n date changes |
| **G** | TRACK-014, TRACK-016, TRACK-017, TRACK-018, TRACK-019 | Fully independent — no file overlap (distinct domains: mutations, email ops, review UX, notifications, analytics) — TRACK-014/015/016/017/018 complete |
| **H** | TRACK-015 → TRACK-014 | Sequential — TRACK-015 consumed the query-key factory from TRACK-014 for useQuery conversion (both complete — TRACK-014 archived, TRACK-015 archived) |
| **I** | TRACK-020 | Independent — new domain (rubrics/grading), extends completed tracks (template editor, review screen, analytics) but no concurrent work |
| **J** | TRACK-021 | Independent — extends existing email-queue polling loop + notifications, no file overlap with TRACK-020 (different domain: deadline reminders vs grading) |
| **K** | TRACK-022 | Independent — extends existing `users.settings` JSONB + `enqueueEventEmail` chokepoint + 11 notification sites. Recommended BEFORE or ALONGSIDE TRACK-021 so new `deadline_reminder` type respects user prefs from day one. Minor file overlap with TRACK-021 on `event-email.ts`/`notification-routes.ts` (different functions) — coordinate if parallelized |
| **L** | TRACK-023 | Independent — new risk-scoring module + dashboard widget + event-driven alerts at `submitReviewHandler`. No file overlap with TRACK-020/021/022 (different domain: risk identification vs grading/reminders/preferences). Complementary to TRACK-021 (event-driven catches discrete risk moments, scanner catches time-based risk). Minor overlap with TRACK-022 on notification type registry — coordinate if parallelized (complete — archived) |
| **M** | TRACK-024 | Fully independent — only touches `tsconfig.json` and `package.json`, no feature file overlap (complete — archived) |

---

## Effort Summary

| Milestone | Tracks | Estimated Effort |
|-----------|:---:|:---:|
| 1: Critical Fixes | 4 | ~12 Days |
| 2: Performance & Optimization | 3 | ~7 Days |
| 3: UX & Accessibility | 6 | ~13 Days |
| 4: Quality Assurance | 1 | ~3 Days |
| 5: Post-Audit Enhancements | 6 | ~25 Days |
| 6: New Features | 4 | ~25 Days |
| 7: Infrastructure & Tooling | 1 | ~1 Day |
| **Total** | **25** | **~86 Days** |

> Effort estimates assume a single developer. Tracks within the same parallelization group can be distributed across developers to reduce wall-clock time.

---

## Adding New Tracks

New tracks follow a two-phase lifecycle in this document:

1. **Planned/Active** — Add a full-detail entry under the appropriate milestone (status, audit IDs, deps, decisions, scope, execution vectors, DoD). Scaffold via `conductor_new_track` which creates `conductor/tracks/<track_id>/spec.md` + `plan.md`.
2. **Complete** — On archival to `conductor/archive/<track_id>_<date>/`, collapse the entry to an index row: status badge, audit IDs, deps, one-line decision summary, archive link. The archive's `spec.md` and `plan.md` become the single source of truth for full detail.

This keeps the roadmap scannable — new tracks add ~5 lines as index entries, not ~50–100 lines of duplicated detail.
