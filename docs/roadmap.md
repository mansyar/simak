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

*   **Status:** `Pending`
*   **Dependencies:** None (complementary to TRACK-021 — event-driven alerts catch discrete risk moments, TRACK-021's scanner catches time-based risk. If both are implemented, TRACK-021's scanner can optionally call risk scoring for signal 2/3 coverage)
*   **Estimated Effort:** 5 Days / 3 Sprint Loops

#### Context Anchors (Traceability)
*   **PRD Reference:** `docs/PRD.md#checkpoints--submissions` (checkpoint lifecycle, review workflow — the domain where at-risk identification applies), `docs/PRD.md#analytics--reporting` (instructor/admin analytics — extension point for at-risk aggregate)
*   **TDD Reference:** `docs/TDD.md` `checkpoints` table (`src/db/schema/assignments.ts:77` — `state`, `dueDate`, `minConsultations`, `studentId`), `assignment_students` join table (`src/db/schema/assignments.ts:56` — maps students to assignments), `consultations` table (`src/db/schema/consultations.ts` — `status`, `checkpointId` for verified count), `reviews` table (`src/db/schema/submissions.ts` — `decision` for revise count), `submissions` table (`src/db/schema/submissions.ts` — `uploadedAt` for wait time); `src/server/dashboard-instructor.server.ts:53-255` (`getInstructorDashboardDataHandler` — extension point, currently returns `pendingReviewCount`, `pendingReviewItems`, `recentSubmissions`, `assignments` with per-assignment `overallProgressPercent` but NO per-student risk), `src/lib/review-sla.ts:72-130` (`dispatchSLABreachNotifications` — existing pattern for advisory batch notification + email dispatch), `src/server/reviews.server.ts:220` (`submitReviewHandler` — event site for revise-triggered risk alert), `src/server/analytics-admin.server.ts` (`getAdminAnalyticsDataHandler` — extension point for aggregate at-risk counts, currently computes `deadlineBreachRate`), `src/components/notifications/NotificationCenter.tsx:15-36` (`GROUP_CONFIGS` — 4 groups, `student_at_risk` fits in `system` group)

#### Track Tech Stack
*   Drizzle ORM — NO new tables, NO migration. All risk signals are computed from existing data (checkpoint states, due dates, consultation counts, review decisions, submission timestamps). Risk score is ephemeral — computed on-demand for dashboard, at event time for alerts. Never persisted
*   New shared module: `src/lib/risk-scoring.ts` — pure functions, no DB access. Exports `computeStudentRisk(data: StudentRiskInput): RiskAssessment` and types (`RiskLevel = 'low' | 'medium' | 'high'`, `RiskFactor`, `RiskCategory = 'student_inaction' | 'pending_review'`). Called from dashboard handler (on-demand) and event sites (after review commit)
*   New shared module: `src/lib/risk-alerts.ts` — `checkAndFireRiskAlert(db, { studentId, assignmentId, instructorId, studentName, assignmentTitle })`: fetches student checkpoint data, calls `computeStudentRisk`, checks 7-day dedup via `notifications` table, fires in-app notification + email. Advisory (try/catch, never throws)
*   Existing file extension: `src/server/dashboard-instructor.server.ts` — add at-risk student list to response (batch query joining checkpoints + assignments + assignment_students + users + consultations + submissions + reviews, pass to `computeStudentRisk`). Currently 255 lines — has room for extension before 500-line limit
*   Existing file extension: `src/server/analytics-admin.server.ts` — add aggregate at-risk counts (simplified SQL counting distinct students matching each signal's criteria — no per-student risk function needed for aggregate)
*   Existing file extension: `src/server/reviews.server.ts` `submitReviewHandler` (line 220) — after review transaction commit, when `decision === 'revise'` OR SLA breach occurred, call `checkAndFireRiskAlert` (advisory, post-commit, outside transaction)
*   shadcn/ui components — `Badge` for risk level (yellow=low, orange=medium, red=high), `Card`/`CardHeader`/`CardContent` for at-risk widget, `Tooltip` for risk factor details. New widget component on instructor dashboard route (`src/routes/_authenticated/instructor/dashboard.tsx`)
*   Email infrastructure reuse: `enqueueEventEmail` (`src/lib/event-email.ts:12`), `resolveEmailRecipient` (`src/lib/email.ts:35-58`), `getNotificationKeys` (`src/lib/i18n-server.ts:44`), `STRINGS` constant object + internal helpers in `email-templates.ts` (file-scoped, non-exported — `HEADER_HTML`/`FOOTER_HTML`/`detailRow`/`detailTable`/`deepLinkButton`/`buildEmail`)
*   `email_queue.templateType` is a Drizzle text enum (`text('template_type', { enum: [...] })` at `src/db/schema/email-queue.ts:10`) — adding `'student_at_risk'` is a code-only change, no `ALTER TYPE` migration
*   i18n codegen — new notification keys + email subject key in both `locales/en.json` and `locales/id.json`

#### Scope Boundaries
*   **In Scope:**
    *   **Risk scoring engine:** New `src/lib/risk-scoring.ts` — pure function `computeStudentRisk(data): RiskAssessment`. Takes per-checkpoint data (state, dueDate, minConsultations, verifiedConsultationCount, submissionCount, latestSubmissionDate, reviseCount, underReviewWaitDays) and returns `{ level: 'low'|'medium'|'high', factors: RiskFactor[] }`. Overall level = highest severity among active factors. Each `RiskFactor` has `{ type, severity, category, checkpointId, description }`. Category is `'student_inaction'` (signals 1-4) or `'pending_review'` (signal 5 — instructor-side cause, labeled differently in UI)
    *   **5 risk signals (thresholds):**
        1. **Overdue checkpoint** (High, student_inaction): `state IN ('unlocked','revise') AND dueDate < NOW()` — student hasn't completed a checkpoint past its due date
        2. **Approaching deadline, no submission** (Medium, student_inaction): `state = 'unlocked' AND dueDate <= NOW()+3d AND submissionCount = 0` — student hasn't started and deadline is near
        3. **Insufficient consultations, deadline approaching** (Medium, student_inaction): `verifiedConsultations < minConsultations AND dueDate <= NOW()+7d` — student needs to schedule consultations before deadline
        4. **Repeated revise** (Medium, student_inaction): `reviseCount >= 2` for the same checkpoint — student is struggling with the content
        5. **Stalled — submitted but not reviewed beyond SLA** (Low, pending_review): `state = 'under_review' AND NOW()-latestSubmissionDate > 3 days` — student's progress stalled by slow review (instructor-side cause, labeled "stalled — pending review" in UI)
    *   **Dashboard integration (instructor):** Extend `getInstructorDashboardDataHandler` (`src/server/dashboard-instructor.server.ts:53`) with `atRiskStudents` array in the response. Batch query: join `checkpoints` + `assignments` + `assignment_students` + `users` + `consultations` (verified count) + `submissions` (count/latest) + `reviews` (revise count) for the instructor's active assignments. Filter to checkpoints in states `('unlocked', 'revise', 'under_review', 'submitted')` (skip `passed`/`locked` — no risk). Pass to `computeStudentRisk`. Return students with risk level ≥ low, sorted by severity (high → medium → low). Each entry: `{ studentName, studentId, assignmentTitle, assignmentId, riskLevel, factors[] }`
    *   **Event-driven alerts:** New `src/lib/risk-alerts.ts` exporting `checkAndFireRiskAlert(db, opts)`. Called from `submitReviewHandler` (`reviews.server.ts:220`) post-commit, advisory (try/catch), when `decision === 'revise'` OR SLA breach occurred. Fetches student checkpoint data for the assignment, calls `computeStudentRisk`, fires alert if level is medium or high. Dedup: query `notifications` table for existing `type = 'student_at_risk'` notification for this `studentId` + `assignmentId` in the last 7 days (via `params->>'assignmentId'` + `metadata.studentId`). If exists, skip. Uses `Promise.allSettled` for parallel in-app notification insert + email enqueue (matching `review-sla.ts:111-125` pattern)
    *   **Alert coverage note:** Signals 1 (overdue), 4 (repeated revise), and 5 (SLA stall) are naturally event-triggered at review time. Signals 2 (approaching deadline, no submission) and 3 (insufficient consultations) are time-based — visible on the dashboard (on-demand) but won't trigger event-driven alerts until a discrete event occurs. If TRACK-021 is implemented, its scanner naturally covers signal 2 (approaching deadlines). TRACK-023's risk scoring can be called from TRACK-021's scanner as a future enhancement for full signal coverage
    *   **Admin analytics extension:** Extend `getAdminAnalyticsDataHandler` (`analytics-admin.server.ts`) with `atRiskSummary: { high: number, medium: number, low: number }` — counts of distinct students matching each risk level across all active assignments. Uses simplified SQL (COUNT DISTINCT students matching each signal's criteria directly — no per-student risk function call). No drill-down to individual students
    *   **Dashboard widget (UI):** New component on instructor dashboard (`src/routes/_authenticated/instructor/dashboard.tsx`) — at-risk student list with risk-level `Badge` (yellow/orange/red), student name, assignment title, risk factor count + brief descriptions (via i18n), link to assignment detail (`/instructor/assignments/${assignmentId}`). Sorted by severity. Empty state: "No students at risk" (reuses `EmptyState` component from TRACK-013)
    *   **Notification type:** New `student_at_risk` type — target: instructor (the student's assignment instructor). Route: `/instructor/assignments/${meta.assignmentId}` (extended in `notification-routes.ts`). Params all strings: `studentName`, `assignmentTitle`, `riskLevel`, `riskFactors` (comma-separated type strings). Added to `system` group in `GROUP_CONFIGS` (alongside `sla_breach` — both are system-level alerts, though `sla_breach` goes to admins and `student_at_risk` goes to instructors; they won't appear in the same user's notification center)
    *   **Email template:** New `buildStudentAtRiskHtml` in `src/lib/email-templates.ts` (named `build{Event}Html` matching convention) — uses internal helpers + `STRINGS` object for body content (NOT locales JSON). Shows student name, assignment title, risk level, risk factor descriptions, CTA link to `${BETTER_AUTH_URL}/instructor/assignments/${assignmentId}`. New email helper wrapper: `src/lib/at-risk-email.ts` (`sendStudentAtRiskEmail` calling `enqueueEventEmail`, matching `review-email.ts` pattern). Email subject key: `emails.subjects.studentAtRisk` (camelCase)
    *   **Email queue enum extension:** Add `'student_at_risk'` to the `templateType` array in `src/db/schema/email-queue.ts:10` (code-only — Drizzle text enum, not pg enum, no `ALTER TYPE`)
    *   **i18n keys:** `notifications.events.student_at_risk.title`/`.message` (params: `studentName`, `assignmentTitle`, `riskLevel`), `emails.subjects.studentAtRisk`, `dashboard.atRisk.title`/`.empty`/`.factorCount`, per-factor descriptions (`dashboard.atRisk.factors.overdue_checkpoint`/`.approaching_deadline`/`.insufficient_consultations`/`.repeated_revise`/`.stalled_review`), admin analytics label `analytics.atRiskSummary`. Added to both locales, run `pnpm generate:i18n`
    *   **Unit tests:** `risk-scoring.ts` (all 5 signals in isolation, severity escalation, multi-factor aggregation, category labeling, no-risk student returns `level: 'low'` with empty factors). `risk-alerts.ts` (dedup skips when notification exists within 7 days, fires when no prior notification, advisory try/catch, `Promise.allSettled` for parallel send). Dashboard handler extension (at-risk list populated correctly, sorted by severity, passed/locked excluded). Admin analytics extension (aggregate counts correct). Email template rendering (both locales). `notification-routes.ts` route derivation for `student_at_risk`
*   **Out of Scope:**
    *   Risk history/trend tracking (no time-series of risk scores — would require a `risk_assessments` table; deferred to v2)
    *   Student-facing risk view (students don't see their own risk score — could be demotivating; v2 could add constructive "N checkpoints need attention" view)
    *   Automated interventions (no auto-extending deadlines, no auto-scheduling consultations — the system alerts, the human acts)
    *   Inline actions in at-risk widget (no "extend deadline" or "message student" buttons — instructor navigates to existing pages to act)
    *   Admin drill-down to individual at-risk students (v1 is aggregate counts only)
    *   Risk-based prioritization of TRACK-021 deadline reminders (v2 — reminders could be escalated for at-risk students)

#### High-Level Execution Vectors
*   **Phase 1 (Risk Scoring Engine):** Create `src/lib/risk-scoring.ts` with `computeStudentRisk(data): RiskAssessment`. Define types: `RiskLevel`, `RiskFactor`, `RiskCategory`, `StudentRiskInput`. Implement 5 signal checks with thresholds (overdue=high, approaching+no-submission=medium, insufficient-consultations=medium, repeated-revise=medium, SLA-stall=low). Overall level = highest active signal. Category: signals 1-4 = `'student_inaction'`, signal 5 = `'pending_review'`. Pure function — no DB access, no side effects. Write unit tests (each signal in isolation, multi-factor aggregation, severity escalation, no-risk student, category labeling). Verify: all 5 signals detect correctly, overall level is highest severity, multiple factors aggregated, pure function has no dependencies.
*   **Phase 2 (Dashboard + Event Alerts):** Extend `getInstructorDashboardDataHandler` (`dashboard-instructor.server.ts:53`) — add Group D query: batch join checkpoints + assignments + assignment_students + users + consultations (verified count) + submissions (count/latest) + reviews (revise count) for instructor's active assignments. Filter to states `('unlocked','revise','under_review','submitted')`. Pass per-student data to `computeStudentRisk`. Add `atRiskStudents` to response (students with level ≥ low, sorted high→medium→low). Create `src/lib/risk-alerts.ts` with `checkAndFireRiskAlert(db, opts)` — fetch student data, compute risk, check 7-day dedup via `notifications` table (`SELECT 1 FROM notifications WHERE type = 'student_at_risk' AND params->>'assignmentId' = ? AND metadata->>'studentId' = ? AND createdAt > NOW() - INTERVAL '7 days'`), fire in-app notification + email via `Promise.allSettled`. Call from `submitReviewHandler` (`reviews.server.ts:220`) post-commit when `decision === 'revise'` OR SLA breach occurred. Extend `getAdminAnalyticsDataHandler` (`analytics-admin.server.ts`) with `atRiskSummary` (simplified SQL counting distinct students per signal). Write tests (dashboard populates at-risk list, event-driven alert fires on revise, dedup prevents re-fire within 7 days, advisory try/catch doesn't affect review, admin aggregate counts correct). Verify: dashboard shows at-risk students sorted by severity, revise review triggers alert (if medium/high), pass review does not trigger alert, SLA breach triggers alert, dedup works, admin analytics shows aggregate counts.
*   **Phase 3 (UI, Email & i18n):** Create at-risk widget component on instructor dashboard — `Badge` (yellow/orange/red), student name, assignment title, factor count + descriptions, link to `/instructor/assignments/${assignmentId}`, `EmptyState` when no at-risk students. Add `buildStudentAtRiskHtml` to `email-templates.ts` (internal helpers, `STRINGS[locale].studentAtRisk` for intro, CTA link to `${BETTER_AUTH_URL}/instructor/assignments/${assignmentId}`). Create `src/lib/at-risk-email.ts` wrapper (`sendStudentAtRiskEmail` calling `enqueueEventEmail`). Add `'student_at_risk'` to `templateType` array in `email-queue.ts` (code-only). Extend `notification-routes.ts` `getNotificationRoute()` with `case 'student_at_risk':` returning `/instructor/assignments/${meta.assignmentId}`. Add `student_at_risk` to `system` group in `GROUP_CONFIGS`. Add i18n keys to both locales. Run `pnpm generate:i18n`. Write tests (widget renders, email renders both locales, notification route derived, `pnpm check:i18n` parity). Verify: all 5 factor descriptions display, email renders in both locales, notification is clickable, i18n parity, `reducedMotion` unaffected (no TRACK-022 coupling needed — `student_at_risk` is a new type that will be auto-included when TRACK-022 lands).

#### Verification & Definition of Done (DoD)
*   [ ] **Manual Checkpoint:** Instructor opens dashboard → sees at-risk widget with students sorted by severity (high first). A student with an overdue checkpoint shows as "high" with factor "Overdue checkpoint" (student_inaction). A student with 2 revise reviews on the same checkpoint shows as "medium" with factor "Repeated revise". A student whose submission has been waiting 4 days for review shows as "low" with factor "Stalled — pending review" (pending_review category). A student who is on track shows nothing (not in the at-risk list). Instructor reviews a submission with `revise` decision → if the student's risk is medium/high, the instructor receives an in-app notification + email. A second `revise` on the same checkpoint within 7 days does NOT produce a duplicate alert (dedup). A `pass` review does not trigger an alert. SLA breach triggers an alert (if medium/high). Admin analytics page shows aggregate at-risk counts (X high, Y medium, Z low). In-app `student_at_risk` notifications are clickable (navigate to assignment detail). `sla_breach` notifications still go to admins only (unchanged). `student_at_risk` notifications go to instructors only.
*   [ ] **Automated Tests:** `pnpm test:unit` — all tests pass. New tests for: `computeStudentRisk` (each of 5 signals in isolation — overdue checkpoint=high, approaching+no-submission=medium, insufficient-consultations=medium, repeated-revise=medium, SLA-stall=low), multi-factor aggregation (2+ active signals → highest severity, all factors listed), category labeling (signals 1-4 = `student_inaction`, signal 5 = `pending_review`), no-risk student (all checkpoints passed → `level: 'low'`, empty `factors[]`), `checkAndFireRiskAlert` (fires when risk ≥ medium, skips when risk = low, dedup skips when notification exists within 7 days, advisory try/catch doesn't throw, `Promise.allSettled` for parallel notification+email), `getInstructorDashboardDataHandler` extension (at-risk list populated, sorted by severity, `passed`/`locked` checkpoints excluded, empty when no risk), `getAdminAnalyticsDataHandler` extension (aggregate counts correct per signal), `buildStudentAtRiskHtml` (both locales, `STRINGS` object, factor descriptions rendered), `notification-routes.ts` route for `student_at_risk`. `pnpm check:i18n` — parity for all new keys. `pnpm test:coverage` >= 80% on all thresholds.
*   [ ] **Conductor Review:** No new DB table or migration (all risk computed from existing data — checkpoint states, due dates, consultation counts, review decisions, submission timestamps). Risk score is ephemeral (never persisted — computed on-demand for dashboard, at event time for alerts). `risk-scoring.ts` is a pure function (no DB access, no side effects — unit-testable in isolation). `risk-alerts.ts` is advisory (try/catch, post-commit, never affects review transaction). Event-driven alerts fire at `submitReviewHandler` when `decision === 'revise'` OR SLA breach (not on pass — student succeeded). 7-day dedup via existing `notifications` table (no new state table). Signals 1/4/5 are event-triggered (at review time). Signals 2/3 are time-based (dashboard-only until TRACK-021 scanner available). Signal 5 labeled "stalled — pending review" (category `pending_review` — instructor-side cause distinguished from student inaction). Admin view is aggregate counts only (no drill-down). `student_at_risk` notification goes to instructor (not student, not admin). `sla_breach` notification still goes to admins only (unchanged). `student_at_risk` in `system` group of `GROUP_CONFIGS`. Email builder named `buildStudentAtRiskHtml` (matching convention). Email subject key `emails.subjects.studentAtRisk` (camelCase). `templateType` is Drizzle text enum (code-only change, no `ALTER TYPE`). All files under 500 lines. `pnpm typecheck`, `pnpm lint`, `pnpm check:i18n` all clean.

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
└── TRACK-023: At-Risk Student Identification [no deps — complementary to 021]
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
| **G** | TRACK-014, TRACK-016, TRACK-017, TRACK-018, TRACK-019 | Fully independent — no file overlap (distinct domains: mutations, email ops, review UX, notifications, analytics) |
| **H** | TRACK-015 → TRACK-014 | Sequential — TRACK-015 consumed the query-key factory from TRACK-014 for useQuery conversion |
| **I** | TRACK-020 | Independent — new domain (rubrics/grading), extends completed tracks (template editor, review screen, analytics) but no concurrent work |
| **J** | TRACK-021 | Independent — extends existing email-queue polling loop + notifications, no file overlap with TRACK-020 (different domain: deadline reminders vs grading) |
| **K** | TRACK-022 | Independent — extends existing `users.settings` JSONB + `enqueueEventEmail` chokepoint + 11 notification sites. Recommended BEFORE or ALONGSIDE TRACK-021 so new `deadline_reminder` type respects user prefs from day one. Minor file overlap with TRACK-021 on `event-email.ts`/`notification-routes.ts` (different functions) — coordinate if parallelized |
| **L** | TRACK-023 | Independent — new risk-scoring module + dashboard widget + event-driven alerts at `submitReviewHandler`. No file overlap with TRACK-020/021/022 (different domain: risk identification vs grading/reminders/preferences). Complementary to TRACK-021 (event-driven catches discrete risk moments, scanner catches time-based risk). Minor overlap with TRACK-022 on notification type registry — coordinate if parallelized |

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
| **Total** | **24** | **~85 Days** |

> Effort estimates assume a single developer. Tracks within the same parallelization group can be distributed across developers to reduce wall-clock time.

---

## Adding New Tracks

New tracks follow a two-phase lifecycle in this document:

1. **Planned/Active** — Add a full-detail entry under the appropriate milestone (status, audit IDs, deps, decisions, scope, execution vectors, DoD). Scaffold via `conductor_new_track` which creates `conductor/tracks/<track_id>/spec.md` + `plan.md`.
2. **Complete** — On archival to `conductor/archive/<track_id>_<date>/`, collapse the entry to an index row: status badge, audit IDs, deps, one-line decision summary, archive link. The archive's `spec.md` and `plan.md` become the single source of truth for full detail.

This keeps the roadmap scannable — new tracks add ~5 lines as index entries, not ~50–100 lines of duplicated detail.
