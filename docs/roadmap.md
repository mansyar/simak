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

- **Server function split:** Every feature has two files — `*.ts` (client-safe stub with `typedServerFn` + dynamic import) and `*.server.ts` (handler with DB code). Four structural patterns are documented in `AGENTS.md` → "Server function split" (Standard pair, Extras variant, Multi-handler, Handler-only). Type-only circular dependencies (`import type`) between stub and handler files are acceptable — neither edge exists at runtime.
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
- **Status:** ✅ Complete · **Audit IDs:** None (new feature) · **Deps:** None
- **Key decisions:** `grading_type` pgEnum (nullable) on `template_checkpoints` (`null`/`numeric`/`qualitative`); `checkpoints.templateCheckpointId` FK (nullable, backfilled); `rubric_criteria`/`rubric_levels` with soft-delete; `review_scores` with full denormalized snapshot (`criterionTitle`, `levelLabel`, `score`, `weight`); `updateTemplateHandler` refactored from delete+reinsert to upsert/diff (preserves checkpoint IDs); weight-sum (100%) validation at Zod application layer; live rubric lookup at review time + frozen snapshot for completed reviews; rubric analytics (avg per criterion, cross-instructor comparison, CSV/Excel export); review fixes: validation-before-insert to prevent orphaned reviews, `.returning()` for review ID, TOCTOU lock on `saveRubricHandler`, `safeAuditLog` helper, Excel injection mitigation, a11y (aria-live, accessible labels, stable React keys)
- **Detail:** `conductor/archive/rubric-based-grading-evaluation_20260723/` (spec.md, plan.md)

### TRACK-021: Proactive Deadline Reminder System
- **Status:** ✅ Complete · **Deps:** None
- **Key decisions:** Background scanner (`processDeadlineReminders()`) runs hourly via email-queue tick throttled by `lastReminderScanAt`; tiered reminders (7d/3d/1d lead times) with non-overlapping bands (`>3d`/`>1d`/`>0d`) firing in-app notifications + emails; `deadline_reminders` dedup table with unique `(checkpointId, tier)` + `ON CONFLICT DO NOTHING RETURNING *` for multi-instance safety; `checkpoints_state_due_date_idx` composite index; dedup + notification inserts wrapped in `db.transaction` (atomicity — if notification insert fails, dedup row rolls back so the tier can retry); email dispatch post-commit via `Promise.allSettled` (advisory, never throws); `deadline_reminder` added to `email_queue.templateType` Drizzle text enum (code-only, no `ALTER TYPE`); email subject `{assignmentTitle}` interpolated via `subjectParams` on `enqueueEventEmail`; scanner failure isolated via `try/catch` in `tick()` (email processing unaffected)
- **Detail:** `conductor/archive/proactive-deadline-reminders_20260723/` (spec.md, plan.md)

### TRACK-022: User Notification Preferences
- **Status:** ✅ Complete · **Deps:** None (recommended AFTER TRACK-021 — prevents `deadline_reminder` notifications from being un-mutable; TRACK-021 is now complete)
- **Key decisions:** Per-user, per-type, per-channel notification preferences stored in existing `users.settings` JSONB column (no separate table, no migration); 12 types across 4 groups (Reviews, Consultations, Submissions, System) with independent Email + In-app toggles (default all ON — opt-out); `updateUserSettingsHandler` refactored from replace to read-modify-write merge (prevents `notificationPrefs` from clobbering `reducedMotion`); email gate in `enqueueEventEmail` (skip enqueue when `notificationPrefs[type].email === false`); in-app gate via `shouldSendInAppNotification` helper at 12 creation sites; `EMAIL_GATE_EXEMPT` set for 4 security types (password_reset, invitation, two_factor, sla_alert); `notificationType` param resolves `sla_breach`↔`sla_alert` and `deadline_extended`↔`extension_approved` type mismatches; `sla_breach` email always sent to admins (bypasses gate via `enqueueEmail` direct call — email toggle hidden in UI); `maybeInsertNotification` helper reduces code duplication at 4 consultation/review sites
- **Detail:** `conductor/archive/user-notification-preferences_20260723/` (spec.md, plan.md)

### TRACK-023: At-Risk Student Identification & Early Warning System
- **Status:** ✅ Complete · **Deps:** None (complementary to TRACK-021)
- **Key decisions:** Pure function `computeStudentRisk(data): RiskAssessment` with 5 risk signals (overdue=High, approaching deadline no submission=Medium, insufficient consultations=Medium, repeated revise>=2=Medium, stalled review>3d=Low); signals 1-4=`student_inaction`, 5=`pending_review`; overall level=highest severity; ephemeral (never persisted); `checkAndFireRiskAlert` advisory post-commit (try/catch, 7-day dedup via notifications table JSON metadata, `Promise.allSettled` for parallel notification+email); `maybeFireReviewRiskAlert` called from `submitReviewHandler` when revise OR SLA breach (double try/catch safety); deadline reminder scanner integration via `Promise.allSettled`; instructor dashboard at-risk widget (sorted by severity, i18n factor descriptions via `getRiskFactorText`, `EmptyState` when none); admin analytics `atRiskSummary`{high,medium,low} with colored Badge UI (destructive/warning/info); `student_at_risk` notification type (instructor target, `system` group in `GROUP_CONFIGS`, route to `/instructor/assignments/` + assignmentId); `buildStudentAtRiskHtml` email template + `sendStudentAtRiskEmail` wrapper; `student_at_risk` added to `templateType` enum (code-only, no ALTER TYPE -- 14 values now); review fixes applied: i18n factor descriptions resolved via `getRiskFactorText` in dashboard widget, admin analytics `atRiskSummary` UI card added with Badge components + `EmptyState`
- **Detail:** conductor/archive/at-risk-student-early-warning_20260724/ (spec.md, plan.md)

### TRACK-025: Gradebook & Final Grade Computation
- **Status:** ✅ Complete · **Audit IDs:** None (new feature) · **Deps:** TRACK-020 (Rubric-Based Grading — provides `review_scores` with denormalized weight/score snapshots)
- **Key decisions:** Pure `computeFinalGrade` function (no DB access); `assignment_grade_config` (1:1 with assignments, cascade-deleted) + `final_grades` cache table (upserted, never individually deleted); auto-created default config on assignment creation + migration backfill for pre-existing assignments; `equal_weight`/`custom_weight` schemes with stale-weight fallback (sum≠100, missing/extra checkpoint entries → equal_weight + warning badge); post-commit advisory grade recomputation on `pass` review decision (try/catch, never affects review transaction); admin-only `recomputeAllGrades` wrapped in `db.transaction` for atomicity; CSV export with formula-injection mitigation (`escapeCsvValue`); client-side Excel via SheetJS (`sanitizeCell`); admin grade distribution analytics (A/B/C/D/F progress bars); review fixes applied: stale-weight detection for removed checkpoints (key-count check), `logAuditEvent` awaited in try/catch (SQL §6.4), `recomputeAllGradesHandler` transaction wrapping, redundant `computeFinalGrade`/`computeCheckpointScore` calls eliminated, migration rollback file created (SQL §5.1)
- **Detail:** `conductor/archive/gradebook-final-grade-computation_20260725/` (spec.md, plan.md)

---

### TRACK-026: Checkpoint Discussion / Q&A Threads
- **Status:** ✅ Complete · **Audit IDs:** None (new feature) · **Deps:** None
- **Key decisions:** New `checkpoint_discussions` table (self-referencing `parentMessageId` for threaded replies, soft-delete via `deletedAt`); 3 indexes (`(checkpointId, createdAt ASC)`, `(assignmentId, createdAt DESC)`, `(parentMessageId)`); two-file split (`discussions.ts` + `discussions.server.ts`) with 3 handlers (list paginated 20/page, post with notification+email, delete with 15-min window); ownership guards (student owns checkpoint OR instructor owns assignment); `discussion_reply` notification type via `metadata.target` route derivation, added to `consultations` group with `MessageCircle` icon; `'discussion_reply'` added to `email_queue.templateType` enum (code-only) + `TemplateType` union; `buildDiscussionReplyHtml` email template + `sendDiscussionReplyEmail` wrapper; `DiscussionPanel` component (optimistic mutations, 30s refetchInterval, ScrollArea, Avatar, role-based alignment) mounted on student checkpoint + instructor assignment detail (Discussions tab) + instructor review detail; `discussionKeys` factory; review fixes: migration rollback file, post-commit email try/catch (§6.4), aria-label fix, reply button hidden on deleted messages
- **Detail:** `conductor/archive/checkpoint-discussion-qa-threads_20260725/` (spec.md, plan.md)

---

## Milestone 7: Infrastructure & Tooling

> This milestone addresses proactive infrastructure and tooling upgrades that improve developer experience, build performance, and toolchain currency. These tracks are not audit-driven — they are technology refresh initiatives.

---

### TRACK-024: TypeScript 7 Upgrade
- **Status:** ✅ Complete · **Audit IDs:** None (proactive infrastructure upgrade) · **Deps:** None
- **Key decisions:** Direct upgrade TS 5.8→7.0.2 (native Go compiler port); removed `baseUrl` from tsconfig (only TS 7-incompatible option); deleted `tsconfig.tsbuildinfo` (incompatible incremental cache format); `--checkers 4` flag in lefthook pre-push gate; no compiler API consumers (oxlint/Vitest/tsx/drizzle-kit all use own parsers); `pnpm typecheck` 8.85s→1.40s (~6.3x speedup); 2937 tests pass, all quality gates clean; 4 config verification tests added (`tests/unit/config/typescript-7-upgrade.test.ts`)
- **Detail:** `conductor/archive/typescript-7-upgrade_20260723/` (spec.md, plan.md)

---

## Milestone 8: E2E Coverage Expansion

> This milestone addresses gaps identified in a comprehensive E2E test audit conducted after Milestone 4 (E2E-FEAT-001) and all subsequent feature tracks. The audit found that the existing 5-spec, 14-test suite covers only 10 of 30 page routes (33%) and leaves several core business flows with zero E2E coverage. Tracks are split by criticality: TRACK-027 covers P0 gaps in untested core flows, TRACK-028 covers P1/P2 breadth and infrastructure quality. Both tracks build on the Playwright infrastructure established in E2E-FEAT-001.

---

### TRACK-027: Critical Business Flow E2E Coverage

- **Status:** ✅ Complete · **Audit IDs:** None (proactive testing gap remediation — identified in E2E audit) · **Deps:** E2E-FEAT-001 (E2E Testing with Playwright — provides infrastructure)
- **Key decisions:** 3 new E2E specs (consultation lifecycle, extension workflow, password setup); seed data expanded with student2 (enrolled) + student3 (not enrolled) + pending consultation; instructor-review tests decoupled (each sets up own state via `createSubmissionForCheckpoint`); notification delivery assertions added to existing specs; upload UI validation (file type + size); negative test cases (invalid login, locked checkpoint, cross-student access denial, superadmin role-creation rule); shared `tests/e2e/helpers/notifications.ts` extracted from duplicated helpers; non-null assertions replaced with guard clauses; template literals without interpolation replaced with single quotes
- **Detail:** `conductor/archive/critical-business-flow-e2e-coverage_20260726/` (spec.md, plan.md)

---

### TRACK-028: E2E Breadth & Infrastructure Expansion

- **Status:** ✅ Complete · **Audit IDs:** None (proactive testing gap remediation — identified in E2E audit) · **Deps:** E2E-FEAT-001 (E2E Testing with Playwright — provides infrastructure). Recommended AFTER TRACK-027.
- **Key decisions:** Expanded E2E coverage from 14→73 tests (chromium) across 14 spec files; route coverage from 10/30→28/31; added Firefox + mobile-chrome (Pixel 7) Playwright projects; integrated `@axe-core/playwright` for automated WCAG 2.1 AA accessibility scanning on 6 key pages; fixed 8 critical/serious a11y violations (color contrast on muted-foreground/sidebar/warning/success/info colors, aria-progressbar-name, label on discussion textarea, button-name on select triggers); fixed Firefox `NS_BINDING_ABORTED` by adding `waitForLoadState('networkidle')` in `loginAsRole`; `retries: 1` (2 in CI); cross-role lifecycle integration test; settings hub tests; rubric grading test; discussion Q&A tests; added second instructor to seed data for reassignment tests
- **Detail:** `conductor/archive/e2e-breadth-and-infrastructure-expansion_20260726/` (spec.md, plan.md)

---

## Milestone 9: Client Architecture Consistency

> This milestone addresses client-side data-fetching architectural inconsistencies identified after the completion of the gradebook feature (TRACK-025). The TanStack Query architecture established in TRACK-014 (query-key factory + `useQuery`/`useMutation` with optimistic updates) is followed by most domains, but two gaps were identified: (1) ~~the query-key factory covers only 7 of ~13 data domains, with 5 settings components and the entire gradebook feature using inline string-array keys or pre-React-Query `useState`/`useEffect` patterns~~ **[CLOSED — TRACK-029 complete: factory now covers 9 domains, all inline keys migrated]**, and (2) ~~the NotificationCenter reimplements infinite-scroll pagination by hand instead of using TanStack Query's native `useInfiniteQuery`~~ **[CLOSED — TRACK-030 complete: migrated to `useInfiniteQuery`, fixed latent optimistic-mutation no-op bug]**. These tracks are consistency/tech-debt work — no new product features, no backend changes, no schema migrations.

---

### TRACK-029: Query-Key Factory Completion & Client Data-Fetching Consistency
- **Status:** ✅ Complete · **Audit IDs:** None (architectural consistency / tech-debt remediation) · **Deps:** TRACK-014 (query-key factory)
- **Key decisions:** Added `settingsKeys` (4 sub-keys: `currentUser`, `activeSessions`, `twoFactorStatus`, `accessibility`) and `gradebookKeys` (`studentFinalGrade(assignmentId)` only — gradebook route uses SSR loader, not TanStack Query) to `src/lib/query-keys.ts`; migrated 5 settings components from inline `['...']` keys to factory calls; fixed `ProfileSection` missing `onSettled` invalidation bug (name update didn't refetch); migrated `StudentFinalGradeCard` from `useState`+`useEffect` to `useQuery`; migrated `RecomputeGradesButton` from `useState(loading)`+inline async to `useMutation` with dual invalidation (`queryClient.invalidateQueries` + `router.invalidate()` — the latter for SSR loader data); Phase 3 audit confirmed zero inline query keys remaining in `src/**/*.tsx`; review fix: replaced `as any` type assertions with `vi.mocked()` in test file per TypeScript styleguide
- **Detail:** `conductor/archive/query-key-factory-completion_20260726/` (spec.md, plan.md)

---

### TRACK-030: NotificationCenter Infinite Query Migration
- **Status:** ✅ Complete · **Audit IDs:** None (architectural consistency / tech-debt remediation) · **Deps:** TRACK-014 (query-key factory — `notificationKeys`), TRACK-012 (Notifications & File Management UX — introduced "Load More" pagination pattern)
- **Key decisions:** Migrated `useNotificationsList` from `useQuery` + manual `useState`/`useEffect` accumulation to TanStack Query's native `useInfiniteQuery` (`initialPageParam: 1`, `getNextPageParam` derived from accumulated items vs `total`); removed `page` from `notificationKeys.list` factory type signature (managed by `pageParam` — all pages of the same filter share one cache entry); refactored `NotificationCenter.tsx` to use `data.pages.flatMap(p => p.items)` instead of manual accumulation with `Set`-based dedup; rewrote `useMarkRead`/`useMarkAllRead` optimistic `onMutate` callbacks to handle `{ pages, pageParams }` shape — changed from `'items' in old` to `'pages' in old`, mapping over `old.pages` to update items within each page — fixed a latent bug where optimistic updates silently no-op'd against the infinite query data shape; `useUnreadCount` still uses `useQuery` (returns a number, not paginated data) — its `typeof old === 'number'` check is preserved unchanged; review fix: removed redundant type annotation on `data?.pages.flatMap(...)` in `NotificationCenter.tsx`
- **Detail:** `conductor/archive/notification-center-infinite-query-migration_20260726/` (spec.md, plan.md)

---

## Milestone 10: Infrastructure Consistency & Tech Debt Remediation

> This milestone addresses structural inconsistencies and tech debt identified in a comprehensive infrastructure audit conducted after Milestone 9. The audit examined server-function architecture, type safety, error handling, i18n completeness, test configuration, and developer tooling. Findings are prefixed `INFRA-` to distinguish them from prior audit IDs. Tracks are ordered by ROI: quick wins first, then structural standardization, then the larger type-safety restoration effort.

---

### TRACK-031: Server-Side Guard Consolidation & Env Type Consolidation
- **Status:** ✅ Complete · **Audit IDs:** INFRA-1 (role-check helper duplication), INFRA-7 (redundant Env type reconstruction in `env.ts`) · **Deps:** None
- **Key decisions:** Created `src/lib/session-guards.ts` shared module with 4 client-safe type-guard functions (`isAdmin`, `isInstructor`, `isStudent`, `isAuthenticated` — all accept `NonNullableSession | null`, return `session is NonNullableSession`); replaced 28 duplicate inline guard definitions across 20 `*.server.ts` files with imports from the shared module; refactored `requireRole` in `src/server/auth.ts` to use `isAuthenticated`; consolidated `Env` type in `src/config/env.ts` — replaced manual `z.infer<typeof baseSchema> & Partial<z.infer<typeof r2Schema>> & {...}` with `z.infer<typeof envSchema>`, removed dead `baseSchema` and `r2Schema` constants (their validation messages were never surfaced — `envSchema` redefined R2 fields with plain `.optional()`); `templates.server.ts` retains `NonNullableSession` import for out-of-scope `isInstructorOrAdmin` (array membership, not single-role narrowing); 20 new unit tests in `tests/unit/lib/session-guards.test.ts`; all 3,773 tests pass, typecheck clean, lint clean (4 pre-existing warnings unrelated)
- **Detail:** `conductor/archive/server-guard-env-consolidation_20260727/` (spec.md, plan.md)

---

### TRACK-032: Type-Safety Restoration — Eliminate `as unknown as` Casts
- **Status:** ✅ Complete · **Audit IDs:** INFRA-4 (systemic type-safety erosion — ~80 `as unknown as` casts across hooks, components, routes, and server files) · **Deps:** TRACK-031 (recommended after — guard consolidation reduced the surface area of server-function calls to audit)
- **Key decisions:** Created `typedServerFn` wrapper in `src/lib/server-fn.ts` — wraps `createServerFn` with a single `as unknown as TypedBuilder` solution cast that restores return-type inference through the `.inputValidator(Schema).handler(fn)` builder chain (root cause: TanStack Start's `ServerFnReturnType` applies `ValidateSerializableInput` conditional type that prevents TS from inferring `TNewResponse` through the chain); migrated all 23 server stub files from `createServerFn` to `typedServerFn`; eliminated 66 in-scope `as unknown as` casts across hooks (7), components (38), routes (19), server files (5), lib (3), and Better Auth handlers (2) — replaced with `isServerError()` type-guard checks and proper Drizzle/Better Auth typing; 10 documented TanStack Router limitation casts remain (6 sidebar typed-routes, 2 auth redirect, 2 route redirect) + 1 solution cast in `server-fn.ts`; type-only changes — zero behavioral changes, all 3,780 tests pass unchanged; review fixes: removed `as DetailData` narrowing cast in `VerificationDialog.tsx` with proper nullable interface, updated `spec.md` FR-3 wording to acknowledge the documented solution cast
- **Detail:** `conductor/archive/type-safety-restoration_20260727/` (spec.md, plan.md)

---

### TRACK-033: Server-Function Architecture Standardization
- **Status:** ✅ Complete · **Audit IDs:** INFRA-2 (inconsistent server-function split patterns), INFRA-3 (17 circular dependency chains), INFRA-5 (setup-password.ts error handling inconsistency), INFRA-9 (audit-log naming inconsistency) · **Deps:** TRACK-032 (recommended after — type fixes on stub files precede structural changes)
- **Key decisions:** Documented 4-pattern server-function split taxonomy in AGENTS.md (Standard pair, Extras variant, Multi-handler, Handler-only) with decision criteria; documented acceptable type-only circular dependencies (stub uses dynamic import, handler uses `import type` — neither edge exists at runtime, all 34 chains verified); refactored `setup-password.ts` into two-file split (`setup-password.ts` stub + `setup-password.server.ts` handler) migrating error handling from `{ error: string }` to `serverError(ErrorCode.X, message)` + `ServerError` type with `logError` structured logging; renamed `audit-logs.ts` → `audit-log.ts` and `audit-logs.server.ts` → `audit-log.server.ts` to match schema file (`src/db/schema/audit-log.ts`) and DB table (`audit_log`); review fixes: replaced explicit `any` in test mock callbacks with typed callback signatures, fixed pre-existing lefthook/oxlint misconfiguration (added `exclude: "{tests,scripts}/**"` to lint step in `lefthook.yml`)
- **Detail:** `conductor/archive/server-function-architecture-standardization_20260728/` (spec.md, plan.md)

---

### TRACK-034: i18n & Email Localization Completeness
- **Status:** ✅ Complete · **Audit IDs:** INFRA-6 (hardcoded 2FA email subjects) · **Deps:** None
- **Key decisions:** Replaced 2 hardcoded 2FA email subjects in `src/server/two-factor.server.ts` with `resolveEmailSubject('emails.subjects.twoFactorEnabled'|'twoFactorDisabled', undefined, session.user.locale as Locales)` calls; added `emails.subjects.twoFactorEnabled` / `twoFactorDisabled` i18n keys to both locale files; regenerated `src/i18n/types.ts` via `pnpm generate:i18n`; updated `tests/unit/server/two-factor.test.ts` to mock `@/lib/i18n-server` and assert `resolveEmailSubject` called with correct key + `session.user.locale`; Phase 2 audit confirmed zero hardcoded `subject:` string literals remain in `src/server/` or `src/lib/`; email body localization explicitly deferred (HTML bodies remain English-only by design)
- **Detail:** `conductor/archive/i18n-email-localization_20260727/` (spec.md, plan.md)

---

### TRACK-035: Test Infrastructure Consolidation
- **Status:** ✅ Complete · **Audit IDs:** INFRA-8 (fragile test script configuration) · **Deps:** None
- **Key decisions:** `vitest.config.ts` restructured to use Vitest 4 `projects` array with `extends: true` — unit project (vmThreads pool, excludes integration + 4 xlsx files) and xlsx project (threads pool, includes 4 xlsx files) — eliminating all script-level `--exclude`/`--pool` flags; integration test exclusion moved from script flags to config `exclude` array; new `vitest.config.integration.ts` standalone config (alias, globals, happy-dom, env loading, vmThreads, `testTimeout: 30000`); `package.json` scripts simplified to flag-free one-liners (`test`=`vitest run`, `test:unit`=`pnpm test`, `test:watch`=`vitest`, `test:coverage`=`vitest run --coverage`, `test:integration`=`vitest run --config vitest.config.integration.ts tests/integration`); `test:watch` now runs xlsx tests (previously silently skipped); `test:coverage` uses vmThreads for unit tests (no global `--pool=threads`); AGENTS.md and workflow.md documentation updated to reflect projects-based pool isolation; review fix added `testTimeout: 30000` to integration config (standalone config defaulted to 5s, risking DB-dependent test timeouts)
- **Detail:** `conductor/archive/test-infrastructure-consolidation_20260727/` (spec.md, plan.md)

---

### TRACK-036: Developer Experience & Tooling Hygiene
- **Status:** ✅ Complete · **Audit IDs:** INFRA-10 (lefthook vs package.json configuration mismatch) · **Deps:** None
- **Key decisions:** Aligned `lefthook.yml` and `package.json` tooling gates — format glob expanded to include `.css` (`*.{js,jsx,ts,tsx,css}`) and cover all dirs (was `src/**/*.{ts,tsx,css}` in `pnpm format`); lint glob expanded from `src/**/*.{js,jsx,ts,tsx}` to `*.{js,jsx,ts,tsx}` (all dirs, matching `oxlint .`); `pnpm typecheck` script updated to include `--checkers 4` (TS 7 shared-memory multithreading, previously only in lefthook pre-push gate); created `.socraticodecontextartifacts.json` with 7 entries (`conductor/product.md`, `conductor/tech-stack.md`, `conductor/workflow.md`, `conductor/product-guidelines.md`, `drizzle/migrations/`, `docs/PRD.md`, `docs/TDD.md`) enabling SocratiCode semantic search across project documentation and DB migrations; updated `AGENTS.md` (Developer Commands table, Formatting Quirks, Pre-commit gate description); expanded format scope surfaced 2 formatting fixes (`src/app/global.css` oklch normalization, `tests/unit/lib/notification-resolver.test.ts` line folding); all 3,773 tests pass, typecheck clean, lint clean (0 errors), i18n parity confirmed (963 keys in both locales)
- **Detail:** `conductor/archive/developer-experience-tooling-hygiene_20260728/` (spec.md, plan.md)

---

### Vitest Coverage Performance Investigation (August 2026)
- **Status:** ✅ Complete — evidence-only; no retained configuration or package-script changes
- **Key decisions:** Recorded a repeatable 113.35-second median for `pnpm test:coverage`; evaluated worker counts, pools, reporters, isolation, environment/project layouts, and coverage-processing concurrency; rejected candidates that failed the 20% target, broke isolation, or changed the preserved coverage/project contract. The existing V8 provider, text/JSON/HTML reports, source scope, thresholds, unit/XLSX projects, and opt-in integration workflow remain authoritative.
- **Detail:** [`docs/vitest-coverage-performance.md`](vitest-coverage-performance.md)

---

## Milestone 11: Observability & Infrastructure Hardening

> This milestone addresses observability, infrastructure hardening, and accessibility compliance gaps identified in a post-completion audit of the production-ready codebase. These tracks are proactive infrastructure improvements — no new product features. Tracks are ordered by priority: accessibility compliance first (legal/compliance risk), then quick infrastructure wins (health endpoint, R2 cleanup), and finally the larger structured logging effort.

---

### TRACK-037: Accessibility Moderate Violations Remediation
- **Status:** ✅ Complete · **Audit IDs:** None (recurring a11y violations documented in `docs/a11y-violations.md`) · **Deps:** TRACK-010 (Accessibility & i18n Compliance — established the a11y baseline and fixed all critical/serious violations)
- **Key decisions:** Remediated 4 recurring MODERATE axe-core violations: (1) `landmark-one-main` — wrapped `<Outlet />` in `<main id="main-content" tabIndex={-1}>` in `_unauthenticated.tsx`; changed landing page `<div>` to `<main>` in `index.tsx`; (2) `skip-link` — added `id="main-content"` and `tabIndex={-1}` to existing `<main>` in all 3 role layouts (`student.tsx`, `instructor.tsx`, `admin.tsx`) and landing page; removed duplicate `id="main-content"` from `login.tsx` `<div>`; (3) `region` — moved `KeyboardCheatSheet` from `_authenticated.tsx` (rendered outside landmarks) into `AppHeader` (`<header>` landmark); added `aria-label` to sonner `<Toaster>` via i18n key `notifications.toasterLabel`; (4) `heading-order` — fixed heading skips across 9 components/pages (StudentDashboard `h3`→`h2`, CheckpointTimeline `h3`→`h2`, CheckpointCard `h4`→`h3`, ExtensionHistoryList `h3`→`h2`, DiscussionPanel `h3`→`h2`, TemplateDangerZone `h3`→`h2`, TemplateDetailPage added `<h1>`, student assignment detail 3× `h3`→`h2`, instructor review detail `h2`→`h1`). E2E axe-core scans updated with `filterModerate` function and moderate violation assertions. Unit tests added for all affected components (8 new test files, 4 modified). Review fixes: restored 9 behavioral tests in `app-header.test.tsx` and 2 DiscussionPanel integration tests in `$submissionId.test.tsx` that were lost during a11y mock refactoring. Note: E2E axe-core scan execution is pending a pre-existing TanStack Router runtime issue in this worktree (see TRACK-037 spec, "Out of Scope") — unit tests verify the DOM-level fixes.
- **Detail:** `conductor/archive/accessibility-moderate-violations-remediation_20260728/` (spec.md, plan.md)

---

### TRACK-038: Health Check Endpoint
- **Status:** ✅ Complete · **Audit IDs:** None (new infrastructure — addresses missing production monitoring) · **Deps:** None
- **Key decisions:** Public unauthenticated `GET /api/health` endpoint with 3 parallel checks (2s timeout each via `Promise.allSettled`): DB (`SELECT 1`), R2 (`HeadBucketCommand` — `not_configured` if env vars absent, healthy), email queue depth (`COUNT` pending/processing — informational only). Returns 200 (healthy) or 503 (unhealthy). Generic error messages (no internal detail leakage). Dockerfile `HEALTHCHECK` using `wget --spider`. Review fix: replaced raw `error.message`/`String(error)` with generic `'database unreachable'`/`'r2 unreachable'` to prevent information leakage on public endpoint.
- **Detail:** `conductor/archive/health-check-endpoint_20260728/` (spec.md, plan.md)

---

### TRACK-039: Orphaned R2 Object Cleanup
- **Status:** ✅ Complete · **Audit IDs:** None (new infrastructure — addresses storage cost growth from orphaned R2 objects) · **Deps:** None
- **Key decisions:** Periodic cleanup scanner (`processOrphanedR2Objects()` in `src/lib/r2-cleanup.ts`) integrated into the email-queue tick loop with 6h in-memory throttle (`lastR2CleanupAt`, same pattern as `lastReminderScanAt`). Queries orphaned intents (`consumedAt IS NULL AND expiresAt < now() AND cleanedUpAt IS NULL LIMIT 50`), deletes R2 objects via `DeleteObjectCommand` in parallel (`Promise.allSettled`), marks `cleanedUpAt = now()` on success. New nullable `cleanedUpAt` timestamp column on `upload_intents` (migration 0016) preserves audit trail. No-op if R2 not configured. Scanner failure isolated via `try/catch`. Audit logging via `safeAuditLog` with `actorId` parameter (default `'system'` for background, admin userId for manual trigger). Admin-only `triggerR2Cleanup()` two-file split (`.ts` stub + `.server.ts` handler with `isAdmin` guard) bypasses throttle. "Trigger R2 Cleanup" button on `/admin/email-queue` with `Loader2` spinner and shared `showErrorToast` pattern. Review fixes: eliminated double audit-log entry (handler passes admin userId directly to `processOrphanedR2Objects` instead of calling `safeAuditLog` twice), removed unused `r2Cleanup.error` i18n key, added loading spinner
- **Detail:** `conductor/archive/orphaned-r2-object-cleanup_20260728/` (spec.md, plan.md)

---

### TRACK-040: Structured Logging & Observability
- **Status:** ✅ Complete · **Audit IDs:** None (new infrastructure — addresses ad-hoc `console.*` logging and missing request tracing) · **Deps:** None
- **Key decisions:** Introduced `pino` as the structured logger (server-side only — TanStack Start runs on Node.js via vinxi/nitro). Full migration of all 41 `console.*` calls across `src/lib/` and `src/server/` (errors.ts `logError()` handled in Phase 2, remaining 41 calls in Phase 4). Two migration patterns: (1) structured calls `console.error({ event: '...' })` in background jobs → `logger.info`/`logger.error` preserving `{ event, ...payload }` shape with `requestId: crypto.randomUUID()` child logger; (2) unstructured calls `console.error('Failed to ...', err)` in server handler advisory blocks → `logger.error({ event: 'advisory_failed', handler: '<fn_name>', error: err instanceof Error ? err.message : String(err) })`. `logError()` in `src/lib/errors.ts` refactored to use `logger.error(entry)` — preserves existing `entry` object shape (`timestamp`, `code`, `message`, `cause`, `userId`, `handler`, `stack`, `input`) and `sanitizeInput()` redaction. Uses `import.meta.env.PROD` for env detection (dead code elimination in production). JSON format in production, `pino-pretty` in dev (lazy-loaded via `createRequire` to avoid bundling in prod). `LOG_LEVEL` env var (default `info`). Request ID propagation infrastructure defined (`requestIdMiddleware` + `createRequestLogger` in `src/lib/request-context.ts`) but **not yet wired** to HTTP handlers — wiring requires extending `typedServerFn` to chain `.middleware([requestIdMiddleware])` and threading `requestId` through stub handlers. Background jobs propagate `requestId` via `logger.child({ requestId: crypto.randomUUID() })` directly. No external log aggregation (logs to stdout for Docker/Coolify). Review fixes: removed `logAdvisoryFailure` helper (was used in only 2 of 11 server files — eliminated pattern inconsistency; all advisory logging now uses inline `logger.error({ event: 'advisory_failed', ... })`); extracted `reassignAssignmentHandler` to new `src/server/assignments-admin.server.ts` (multi-handler pattern) to stay under the 500-line file limit; documented `requestIdMiddleware`/`createRequestLogger` as future-work dead code via JSDoc.
- **Detail:** `conductor/archive/structured-logging-observability_20260729/` (spec.md, plan.md)

---

## Milestone 12: Security, Reliability & Real-Time Infrastructure

> These tracks address security, reliability, and observability gaps identified in a post-completion review of the production-ready codebase following Milestone 11. All tracks are proactive infrastructure improvements — no new product features, except TRACK-046 (SSE notifications) which enhances the existing notification UX. Findings are not audit-driven; they were identified during a comprehensive codebase review covering configuration, database, server-function architecture, and background processing. Tracks are ordered by recommended priority: security hardening first (CSP headers, rate limiting), then reliability (DB pool config, graceful shutdown), then observability completeness (request ID wiring), and finally the larger real-time notification effort.

---

### TRACK-041: HTTP Security Headers

- **Status:** ✅ Complete · **Audit IDs:** None (proactive security hardening) · **Deps:** None
- **Key decisions:** New `src/lib/security-headers.ts` — pure functions `generateNonce()` (`crypto.randomBytes(16).toString('base64')` → 24-char base64) + `buildSecurityHeaders(nonce, isProd, r2Domain?)` (returns header name→value map). New `src/start.ts` — `createStart` instance with `securityHeadersMiddleware` (request middleware via `createMiddleware().server()`: generates nonce, extracts R2 domain via `new URL(endpoint).hostname` with try/catch, builds headers, sets all via `setResponseHeader()`, passes nonce to router context via `next({ context: { nonce } })`) + `createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === 'serverFn' })` (explicitly added because a custom `src/start.ts` disables TanStack Start's auto-installed CSRF middleware). Updated `src/router.tsx` — `getGlobalStartContext()` nonce extraction (justified type assertion — middleware context not inferred through `Register`) + `ssr: { nonce }` router option (TanStack Start auto-attaches nonce to all inline `<script>`/`<style>` tags during SSR, including the theme script and hydration scripts — no `__root.tsx` changes needed). CSP directives: `default-src 'self'; script-src 'nonce-{nonce}' 'strict-dynamic'; style-src 'nonce-{nonce}'; img-src 'self' data: https:; connect-src 'self' <R2 domain>; frame-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests` (prod only). `Content-Security-Policy-Report-Only` in dev (violations logged, not blocked), `Content-Security-Policy` in prod (enforced). HSTS (`max-age=31536000; includeSubDomains`) + `upgrade-insecure-requests` prod-only (omitted in dev — Report-Only has no effect + Chrome console error). R2 domain omitted gracefully when `R2_ENDPOINT` unset/invalid (consistent with `storage.ts` direct `process.env` access pattern). Additional headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: geolocation=(), microphone=(), camera=()`. Unit tests (32): nonce generation (uniqueness, length, base64 format), header values (exact string match), Report-Only vs enforce switching, `getR2Domain` edge cases (valid URL, port, unset, empty, invalid), router nonce propagation. E2E test asserts all headers present + nonce uniqueness + nonce auto-attached to `<script>` tags. Review fix: added E2E assertion for nonce auto-attached to script tags (automates AC #2).
- **Detail:** `conductor/archive/http-security-headers_20260730/` (spec.md, plan.md)

---

### TRACK-042: Database Connection Pool Configuration

- **Status:** ✅ Complete · **Audit IDs:** None (proactive reliability hardening) · **Deps:** None
- **Key decisions:** Configured explicit postgres.js pool options on the `postgres()` call in `src/db/index.ts` (`max` via `DB_POOL_MAX` env var default 10, `idle_timeout: 30`, `connect_timeout: 10`, `max_lifetime: 1800`); `prepare: !DB_PREPARED_STATEMENTS_DISABLED` for PgBouncer transaction-pooling compatibility; `onnotice` callback routes PostgreSQL notices through pino (`logger.debug({ event: 'pg_notice', ...notice })` — consistent with TRACK-040 structured logging); `getDb()` migrated from `process.env.DATABASE_URL` to `getEnv()` for Zod-validated config; added two optional env vars to `env.ts` — `DB_POOL_MAX` (`z.coerce.number().int().positive().default(10)`) and `DB_PREPARED_STATEMENTS_DISABLED` (string → `val === 'true'` transform, `.default(false)` — deliberately avoids `z.coerce.boolean()` which returns `true` for the string `'false'`); `.env.example` documents both vars. **Documented deviation:** FR-3/AC-2/AC-8 (matching `prepare` on the `drizzle()` config) not met — verified against installed `drizzle-orm@0.45.2` that `DrizzleConfig<TSchema>` (`node_modules/drizzle-orm/utils.d.ts`) contains only `logger`/`schema`/`casing`/`cache` with no `prepare` member; the `drizzle(client, config)` overload takes plain `DrizzleConfig`, and only the `connection:`-form overload accepts postgres.js `Options`. The postgres.js client `prepare` setting is sufficient (Drizzle delegates to the underlying client). Documented in plan.md, the tech-stack.md changelog (dated 2026-07-30), and the spec's own "Critical implementation note". SSL config deferred (Coolify manages the DB connection; local dev uses docker-compose without SSL).
- **Detail:** `conductor/archive/database-connection-pool-config_20260730/` (spec.md, plan.md)

---

### TRACK-043: Application-Level Rate Limiting on Server Functions

- **Status:** ✅ Complete · **Audit IDs:** None (proactive security hardening) · **Deps:** TRACK-032 (typedServerFn wrapper — provides the single chokepoint to extend). **Coordinate with TRACK-044** — TRACK-043 established the `.middleware()` method that TRACK-044 uses to compose request-ID and optional rate-limit middleware.
- **Key decisions:** `RATE_LIMITED` error code added to `ErrorCode` enum; new `src/lib/rate-limiter.ts` — in-memory sliding window (`Map<string, {count, windowStart}>` keyed by `userId:fnId`) with 4-tier `RATE_LIMITS` presets (presignedUrl 20/min, heavyMutation 10/min, destructive 5/min, standardRead 60/min); `createRateLimitMiddleware(config)` factory uses `createMiddleware({type:'request'}).server()` — calls `getSessionFromHeaders()`, unauthenticated pass-through, short-circuits with `serverError(RATE_LIMITED)` when exceeded; `.middleware()` method added to `TypedBuilder` interface in `server-fn.ts`; `typedServerFn` accepts optional `rateLimit?: RateLimitConfig` — chains middleware when provided, pass-through when omitted; 85 functions annotated across 22 stub files (Tier 1 presignedUrl: 4, Tier 2 heavyMutation: 3, Tier 3 destructive: 36, Tier 4 standardRead: 42); exempt: `_getSession` (cascading concern), `getUnreadCount`/`markRead`/`markAllRead` (high-freq UX), `completePasswordSetup` (token-based, no session); `RATE_LIMITED` mapped to `error.rateLimited` i18n key in EN/ID; deviation: `listNotifications` annotated `standardRead` for consistency (not in spec catalog); no handler changes (zero `.server.ts` files modified); single-instance in-memory Map sufficient (Redis deferred); 3,919 tests pass, coverage ≥80% all metrics (`rate-limiter.ts` and `server-fn.ts` at 100%)
- **Detail:** `conductor/archive/application-level-rate-limiting_20260730/` (spec.md, plan.md)

---

### TRACK-044: Request ID Middleware Wiring

- **Status:** ✅ Complete · **Audit IDs:** None (completes TRACK-040 observability) · **Deps:** TRACK-040, TRACK-043
- **Key decisions:** `typedServerFn` now always wires `requestIdMiddleware` before optional rate-limit middleware, covering every server function without handler changes. `requestIdMiddleware` uses `AsyncLocalStorage` (`src/lib/request-context-store.ts`) to scope a supplied `x-request-id` or generated UUID through the request. The pino logger's `mixin` reads that context and automatically adds `requestId` to server-function log entries; it returns `{}` outside a request, preserving existing background-job `logger.child({ requestId })` behavior.
- **Detail:** `conductor/archive/request-id-middleware-wiring_20260730/` (spec.md, plan.md)

---

### TRACK-045: Graceful Shutdown & Background Processor Drain

- **Status:** ✅ Complete · **Audit IDs:** None (proactive reliability hardening) · **Deps:** None
- **Key decisions:** New `src/lib/shutdown.ts` — `registerShutdownHandlers()` registers SIGTERM/SIGINT handlers (guarded by `import.meta.env.SSR`): clears `setInterval`, awaits in-flight `tick()` via async `stopGracefully()` (drain), closes DB pool via `closeDb()`, then `process.exit(0)`. Second signal forces `process.exit(1)`. Configurable timeout via `SHUTDOWN_TIMEOUT_MS` (default 10000ms). Added `closeDb()` to `src/db/index.ts` (stores raw postgres.js client, exports `closeDb()` calling `client.end()`). Added `reclaimAllProcessingRows()` to `email-queue-processor.ts` — resets ALL `processing` rows to `pending` on startup before first tick (no time threshold). Converted `stopEmailQueue()` (dead code) to async `stopGracefully()`. Wired in `src/router.tsx` alongside `startEmailQueue()`.
- **Detail:** `conductor/archive/track-045/` (spec.md, plan.md)

---

### TRACK-046: Real-Time Notifications via Server-Sent Events (SSE)

- **Status:** 📋 Planned · **Audit IDs:** None (proactive UX enhancement — supersedes conscious v1 decision "No WebSocket/SSE in v1") · **Deps:** TRACK-022 (User Notification Preferences — provides `maybeInsertNotification` chokepoint in `src/lib/notification-prefs.ts`), TRACK-030 (NotificationCenter Infinite Query Migration — provides the client-side notification data layer via `useInfiniteQuery` + `notificationKeys` factory)
- **Problem:** The notification system is polling-only: `useUnreadCount` (`src/hooks/use-notifications.ts` line 7-23) uses `useQuery` with `refetchInterval: 30000` + `refetchIntervalInBackground: false`. This was a conscious v1 decision ("No WebSocket/SSE in v1 — 30s polling is sufficient"). As the system scales, 30s polling creates unnecessary DB load (every active user hits the unread count endpoint every 30s) and delays notification delivery by up to 30s. SSE provides server-push without the complexity of WebSocket, reducing DB load and providing real-time UX. The existing `useInfiniteQuery` notification data layer (from TRACK-030) can be updated via `queryClient.setQueryData` on SSE push. Discussion Q&A polling (`discussion-panel.tsx` line 74: `refetchInterval: 30000`) is **out of scope** — stays on 30s polling.
- **Proposed solution:** Add a `GET /api/notifications/stream` SSE endpoint using `createFileRoute('/api/notifications/stream')` with `server.handlers.GET` (same pattern as `src/routes/api/health.ts`). Auth via `getSessionFromHeaders()` (available in `createFileRoute` handlers through Nitro's request context — return 401 if no session). Return `new Response(readableStream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' } })`. In-memory connection manager (`src/lib/sse.ts`) stores `Map<userId, ReadableStreamDefaultController[]>` (array per user to support multiple tabs/devices). Post-commit advisory SSE emission (same pattern as `enqueueEmail` — try/catch, never rolls back primary operation) at the 6 notification call sites that call `maybeInsertNotification` (`reviews.server.ts:420`, `discussions.server.ts:183`, `consultations.server.ts:101,371,448` + submission handlers). Replace `useUnreadCount` 30s polling with an `EventSource` listener that calls `queryClient.setQueryData(notificationKeys.unreadCount(), newCount)` on push. Keep polling as fallback (SSE auto-reconnect via `EventSource`; fallback interval 30s on disconnect). Heartbeat: send `:keepalive\n\n` SSE comment every 20s to prevent Traefik idle timeout killing the connection.
- **Feasibility spike:** Before full implementation, verify that TanStack Start/Nitro supports streaming responses (`Response` with `ReadableStream` body) — the existing health check endpoint returns a string `Response`, not a stream. If streaming is not supported, fall back to shorter polling interval (e.g., 10s) and document the limitation.
- **Scope:** New SSE route handler (`src/routes/api/notifications/stream.ts`), new `src/lib/sse.ts` (in-memory connection manager — `Map<userId, ReadableStreamDefaultController[]>` + register/unregister/broadcast/heartbeat), post-commit SSE emission at 6 notification call sites (advisory try/catch, after transaction commit), `src/hooks/use-notifications.ts` (add `useSSENotifications` hook with `EventSource` + fallback polling, keep `useUnreadCount` as fallback), new tests for SSE connection management.
- **Execution vectors:** Feasibility spike — create minimal `createFileRoute` returning `Response` with `ReadableStream`, verify client receives streaming data; create SSE connection manager (register/unregister/broadcast per user + heartbeat interval); add SSE route handler with auth guard + heartbeat; add post-commit `emitSSENotification(userId, payload)` helper (advisory, try/catch) called after transaction commit at each `maybeInsertNotification` site; client-side `EventSource` listener with TanStack Query cache integration (`queryClient.setQueryData` on push); fallback polling on SSE disconnect; unit tests for connection manager (register, unregister, cleanup, cross-user isolation, multiple tabs per user); E2E test for real-time notification delivery; document Traefik proxy config (`proxy buffering off` for SSE, idle timeout > 20s heartbeat).
- **Definition of Done:** Feasibility spike confirms streaming works (or fallback to shorter polling documented); SSE endpoint streams notifications in real-time to connected users; `useUnreadCount` uses SSE with 30s polling fallback (fallback kicks in on disconnect); connection manager handles cleanup on disconnect + user logout + multiple tabs; auth guard prevents cross-user SSE access; heartbeat (`:keepalive\n\n` every 20s) prevents stale connections; post-commit SSE emission never rolls back primary operation; unit + E2E tests pass; typecheck + lint clean.

---

> **Current-state note (2026-08-01):** Earlier completed-track entries preserve
> historical implementation decisions and are not normative when they mention the
> former `typedServerFn` wrapper, VM-thread test workers, self-only/R2-bare CSP
> sources, or request middleware details. The current implementation uses the
> type-preserving `createServerFn` alias with explicit `serverFnMiddlewares`,
> dynamically imported server-only handlers, forked unit workers, restricted R2
> CSP sources, and thrown rate-limit errors. See `README.md`, `docs/TDD.md`, and
> `AGENTS.md` for the active architecture.

### TRACK-047: Coolify Private-Pilot Deployment

- **Status:** ✅ Complete and archived in `conductor/archive/coolify-private-pilot-deployment_20260731/` · **Audit IDs:** None (production-readiness track) · **Deps:** TRACK-038 (health endpoint), TRACK-041 (security headers), TRACK-042 (DB pool configuration), TRACK-045 (graceful shutdown)
- **Problem:** SIMAK needed a repeatable private-pilot deployment topology, isolated production services, safe migrations and bootstrap, configured external integrations, and operational recovery evidence.
- **Decisions:** Deploy one invite-only SIMAK application instance through Coolify with a Coolify-managed PostgreSQL 16 service on a private network, direct PostgreSQL connections without PgBouncer, a private Cloudflare R2 bucket, Resend email, and an HTTPS custom domain. The Docker image runs `/app/start.sh`, which applies advisory-locked migrations before `exec`-starting the app; the production-safe SuperAdmin seed is a separate one-time command. Daily PostgreSQL backups retain seven copies in both Coolify server storage and remote S3-compatible storage. Redis, multi-instance scaling, and CI/CD outside Coolify remain out of scope.
- **Scope:** Docker/Coolify deployment, runtime-only secrets, persistent PostgreSQL storage, migration and seed procedures, R2 CORS and Resend verification, health/security checks, role/auth/core-flow smoke tests, secret-free log verification, backup/restore drill, rollback guidance, and the deployment runbook. No production Compose topology or migration sidecar was introduced.
- **Execution vectors:** Built and deployed the image, configured the Coolify project/environment and private database service, verified HTTPS and `/api/health`, completed SuperAdmin/Admin/Instructor/Student, invitation, R2, PDF preview, and assignment lifecycle checks, verified structured secret-free logs, tested restore into an isolated target, and documented rollback plus operational limits.
- **Definition of Done:** Production Coolify deployment is healthy over HTTPS; migrations and idempotent SuperAdmin bootstrap are documented; R2 CORS/CSP and Resend sender behavior are verified; persistent backups and isolated restore are proven; runbooks and README links are current; role/auth/core-flow/log smoke tests pass; and the completed track is archived.

---

### TRACK-048: Backup & Restore Readiness

- **Status:** 📋 Planned · **Audit IDs:** None (broader data-protection and operational-resilience enhancement) · **Deps:** TRACK-047 (complete; establishes the production database, R2 bucket, and deployment environment)
- **Problem:** SIMAK stores academic records that cannot be recreated easily. TRACK-047 established and validated the private-pilot backup baseline, but broader retention, independent scheduling, failure alerting, and object-durability decisions may still be needed before wider production use.
- **Decisions:** The current pilot uses daily PostgreSQL backups with seven retained copies in Coolify server storage and remote S3-compatible storage, plus an isolated restore drill. Any future 30-day logical-backup bucket, independent scheduler, or expanded R2 durability policy must be approved as a follow-up and must not be represented as the current pilot configuration. Restoration remains an operator-only runbook procedure.
- **Scope:** If activated, a follow-up may add an independently scheduled backup job, approved retention policy, job-level failure visibility, and expanded R2 uploaded-file durability/versioning review. The existing TRACK-047 restore runbook and isolated drill are the baseline; application schema and feature behavior remain unchanged.
- **Out of Scope:** Point-in-time recovery, high-availability replicas, a user-facing restore UI, cross-region active-active deployment, backup encryption beyond Cloudflare R2's managed encryption at rest, and mandatory R2 object replication unless the R2 review identifies a gap.
- **Execution vectors:** If approved, establish least-privilege backup credentials, implement and schedule the follow-up job, capture sanitized success/failure metadata, verify external failure visibility, and extend the existing isolated restore and R2 review procedures.
- **Definition of Done:** Any approved follow-up retention and scheduling policy is operationally visible, independently restorable, documented without conflicting with the seven-copy pilot baseline, and unavailable to the normal application runtime except through least-privilege backup credentials.

---

### TRACK-049: Instructor Feedback Snippets

- **Status:** 📋 Planned · **Audit IDs:** None (proactive instructor-productivity enhancement) · **Deps:** None
- **Problem:** SIMAK's review queue already provides FIFO prioritization, SLA indicators, inline PDF/DOCX previews, keyboard navigation, rubric scoring, and next-review navigation. However, instructors still repeatedly compose common feedback in free-text comments, slowing the review bottleneck that gates student checkpoint progress and can lead to SLA breaches. The system has no reusable, instructor-owned feedback library.
- **Decisions:** Snippets are private to their owning instructor; there is no shared or admin-managed library in this version. Snippets are plain text with a required title, optional free-text category, and bounded body length validated by Zod; dynamic placeholders and HTML/rich-text rendering are deliberately excluded. Inserting a snippet appends its plain text to the editable review comment through an explicit action—it never selects Pass/Revise, completes rubric scores, or submits a review. Snippet updates and archival never alter comments on existing reviews.
- **Scope:** A small instructor-owned feedback-snippet data model; CRUD server functions with session ownership checks; a dedicated instructor-only `/instructor/feedback-snippets` management route; and review-form insertion that appends text while preserving manual editing. Archived snippets are excluded from the default picker/list but retained for historical management. Include i18n, unit tests, and E2E coverage for snippet ownership and review-form insertion.
- **Out of Scope:** Shared or department-wide snippet libraries, admin approval workflows, AI-generated feedback, automatic decision recommendations, custom placeholders, and feedback-quality analytics.
- **Execution vectors:** Add a migration with an instructor-user foreign key, bounded columns, and archival support; implement client-safe stubs and server-only handlers following the established two-file pattern; add the dedicated instructor route and sidebar navigation; integrate a searchable active-snippet picker into the review form while preserving manual editing; verify inserts do not alter review state or rubric behavior; test validation boundaries, cross-instructor access denial, archival behavior, and historical-review immutability.
- **Definition of Done:** Instructors can create, edit, archive, search, and append only their own validated plain-text snippets; archived snippets are not offered for insertion; insertion leaves comments editable and cannot auto-submit or select a decision; existing review comments remain unchanged after snippet edits; cross-instructor access is rejected; all new UI is bilingual and accessible; unit/E2E tests, typecheck, lint, and coverage gates pass.

---

### TRACK-050: At-Risk Intervention Workflow

- **Status:** 📋 Planned · **Audit IDs:** None (proactive student-support workflow enhancement) · **Deps:** TRACK-023 (at-risk student identification provides risk signals and dashboard context)
- **Problem:** SIMAK identifies at-risk students from overdue work, approaching deadlines without submissions, insufficient consultations, repeated revisions, and stalled reviews. It surfaces the risk to instructors through dashboard widgets and alerts, but provides no structured record of whether an instructor responded, what support action was chosen, or when follow-up is due. Detection without a human-response workflow risks alert fatigue and makes support activity impossible to track.
- **Decisions:** Intervention records are private operational records: they are visible only to the current instructor who owns the assignment, never to students or admins; the original actor is retained in the audit history. If an assignment is reassigned, the replacement instructor receives access as the new assignment owner and the former instructor loses access. Each record is scoped to one student and assignment, with at most one open intervention per pair. Creation is available only when the live assessment contains at least one `student_inaction` factor; a `pending_review`-only risk is an instructor-workload issue and cannot create a student intervention. The instructor explicitly manages status (`open`, `monitoring`, `resolved`, `dismissed`) and provides a reason when resolving or dismissing. Follow-up dates are displayed, including overdue state, in instructor views only; they do not create new in-app or email notifications. Risk scoring remains live and separate—an intervention never automatically resolves because risk factors disappear.
- **Scope:** An intervention data model with immutable audit events; instructor-only server functions and UI launched from at-risk dashboard/assignment context; live student-inaction risk-factor context; action type, private note, status, optional follow-up date, and resolution/dismissal reason; filters and dashboard visibility for open and overdue follow-ups; reassignment-aware authorization. Existing consultation, extension, and discussion workflows remain the mechanisms for carrying out the chosen action.
- **Out of Scope:** Student-visible risk labels or intervention plans, admin case-management access, automated follow-up notifications, cross-assignment student case files, escalation chains, institutional counseling integrations, and automatic intervention resolution.
- **Execution vectors:** Add the schema and migration with unique protection for an open student-assignment intervention; implement session/assignment ownership guards in the established server-function split; add dashboard and assignment-context intervention UI; link existing extension/consultation/discussion actions without duplicating them; add immutable audit events; extend assignment reassignment behavior to preserve authorized handover; test privacy boundaries, student-inaction eligibility, pending-review-only rejection, duplicate-open prevention, reassignment access, status transitions, and overdue display behavior.
- **Definition of Done:** The current owning instructor can create and manage interventions only for students in their assignments and only with a live student-inaction risk factor; a pending-review-only risk cannot create an intervention; only one open intervention exists per student-assignment pair; risk factors are visible as context; resolution/dismissal requires a reason and creates an immutable audit event; assignment reassignment transfers record access to the replacement instructor; open and overdue follow-ups are visible in instructor views without sending notifications; students and admins cannot access individual records; unit/E2E tests, typecheck, lint, i18n, accessibility, and coverage gates pass.

---

### TRACK-051: Grade Release Workflow

- **Status:** 📋 Planned · **Audit IDs:** None (proactive academic-governance enhancement) · **Deps:** TRACK-025 (gradebook and final-grade computation)
- **Problem:** SIMAK computes final grades from checkpoint outcomes and rubric scores, but computed values can be provisional while late submissions, reviews, or corrections remain in progress. Students currently have no explicit distinction between a working grade and an officially released result. Formal coursework requires the instructor to control when results become visible and to leave an accountable record if a published result must be withdrawn for correction.
- **Decisions:** Grade release is controlled by the assignment instructor, not an admin approval queue; existing authorized staff retain their current read-only gradebook access. Each assignment has a `draft` or `published` release state, stored with its existing one-to-one grade configuration. Publishing creates an immutable release snapshot for every currently complete enrolled student from the authoritative computed grade; later grade recomputation cannot silently change the student-visible released value. An instructor can return the release to draft only with an audit reason, then publish a new snapshot after corrections or after additional students become complete. Incomplete students continue to see a clear unavailable/not-yet-released state. Staff exports remain working-data exports and do not claim to be a released transcript.
- **Scope:** Grade-configuration release state plus immutable per-student published-grade snapshot data and migrations; ownership-guarded publish/unpublish server functions; instructor gradebook preflight summary for incomplete/missing-grade students; student final-grade visibility gating; audit-log events for publication and withdrawal; bilingual, accessible UI and tests. Existing grade computation and rubric scoring remain unchanged.
- **Out of Scope:** Admin moderation/approval queues, grade appeals, student acknowledgments, formal transcripts, GPA calculation, scheduled release dates, automatic email/in-app publication announcements, and a student-facing history of withdrawn or superseded releases.
- **Execution vectors:** Add the release-state and immutable snapshot schema; update gradebook and student-grade handlers to enforce role-appropriate visibility and select the active published snapshot for students; build a preflight confirmation showing eligible, incomplete, and missing-grade students; implement publish/unpublish with instructor ownership verification and a required unpublish reason; add audit events; test that unpublished computed results remain inaccessible to students, published values do not change after recomputation, newly completed students require a later publication, incomplete students remain unavailable, and unauthorized users cannot change release state.
- **Definition of Done:** Only the owning instructor can publish or unpublish an assignment's grades; draft computed grades are inaccessible to students; publishing creates immutable snapshots visible only to completed enrolled students; later recomputation cannot alter an active published value; incomplete or newly completed students remain unavailable until a later publication; withdrawal requires a reason and publication/withdrawal are audited; existing authorized staff exports remain working-data exports; unit/E2E tests, typecheck, lint, i18n, accessibility, and coverage gates pass.

---

## Track Dependency Graph

```
Milestone 1: Critical Fixes
├── TRACK-001: Concurrency & Transaction Safety [✅ Complete — archived — no deps]
├── TRACK-002: Deadline & SLA Logic Correctness [✅ Complete — archived — coordinate with 001]
├── TRACK-003: Input Validation & Data Integrity [✅ Complete — archived — no deps]
└── TRACK-004: Email Queue Robustness [✅ Complete — archived — no deps]

Milestone 2: Performance & Optimization
├── TRACK-005: Database Indexes & Schema Optimization [✅ Complete — archived — no deps]
├── TRACK-006: Query & Data-Fetching Optimization [✅ Complete — archived — depends on 005]
└── TRACK-007: Session Caching & Bundle Safety [✅ Complete — archived — no deps]

Milestone 3: UX & Accessibility
├── TRACK-008: Critical UX Fixes (Broken Functionality) [✅ Complete — archived — no deps]
├── TRACK-009: Action Feedback & Loading States [✅ Complete — archived — no deps]
├── TRACK-010: Accessibility & i18n Compliance [✅ Complete — archived — no deps]
├── TRACK-011: Search Debounce & Form Validation [✅ Complete — archived — no deps]
├── TRACK-012: Notifications & File Management UX [✅ Complete — archived — depends on 010]
└── TRACK-013: Empty States, Date Display & Mobile [✅ Complete — archived — coordinate with 010]

Milestone 4: Quality Assurance
└── E2E-FEAT-001: E2E Testing with Playwright [✅ Complete — archived — no deps — requires core features]

Milestone 5: Post-Audit Enhancements
├── TRACK-014: Optimistic UI Updates for Mutations [✅ Complete — archived — introduces query-key factory]
├── TRACK-015: UI Hygiene & Tech-Debt Quick Wins [✅ Complete — archived]
├── TRACK-016: Email Queue Retention & Delivery Completeness [✅ Complete — archived — no deps]
├── TRACK-017: Instructor Productivity: DOCX Preview & Keyboard Shortcuts [✅ Complete — archived — no deps]
├── TRACK-018: Event Email Notifications [✅ Complete — archived — no deps]
└── TRACK-019: Analytics & Reporting [✅ Complete — archived — no deps]

Milestone 6: New Features
├── TRACK-020: Rubric-Based Grading & Evaluation [✅ Complete — archived]
├── TRACK-021: Proactive Deadline Reminder System [✅ Complete — archived — no deps — recommended after 022]
├── TRACK-022: User Notification Preferences [✅ Complete — archived]
├── TRACK-023: At-Risk Student Identification [✅ Complete — archived]
├── TRACK-025: Gradebook & Final Grade Computation [✅ Complete — archived — depends on 020 — aggregates review_scores]
└── TRACK-026: Checkpoint Discussion / Q&A Threads [✅ Complete — archived]

Milestone 7: Infrastructure & Tooling
└── TRACK-024: TypeScript 7 Upgrade [✅ Complete — archived]

Milestone 8: E2E Coverage Expansion
├── TRACK-027: Critical Business Flow E2E Coverage [✅ Complete — archived]
└── TRACK-028: E2E Breadth & Infrastructure Expansion [✅ Complete — archived]

Milestone 9: Client Architecture Consistency
├── TRACK-029: Query-Key Factory Completion & Client Data-Fetching Consistency [✅ Complete — archived — extends query-key factory]
└── TRACK-030: NotificationCenter Infinite Query Migration [✅ Complete — archived — depends on 014 — notificationKeys factory]

Milestone 10: Infrastructure Consistency & Tech Debt Remediation
├── TRACK-031: Server-Side Guard Consolidation & Env Type Consolidation [✅ Complete — archived]
├── TRACK-032: Type-Safety Restoration — Eliminate `as unknown as` Casts [✅ Complete — archived — recommended after 031]
├── TRACK-033: Server-Function Architecture Standardization [✅ Complete — archived — recommended after 032]
├── TRACK-034: i18n & Email Localization Completeness [✅ Complete — archived]
├── TRACK-035: Test Infrastructure Consolidation [✅ Complete — archived — no deps]
└── TRACK-036: Developer Experience & Tooling Hygiene [✅ Complete — archived — no deps]

Milestone 11: Observability & Infrastructure Hardening
├── TRACK-037: Accessibility Moderate Violations Remediation [✅ Complete — archived — depends on 010]
├── TRACK-038: Health Check Endpoint [✅ Complete — archived]
├── TRACK-039: Orphaned R2 Object Cleanup [✅ Complete — archived]
└── TRACK-040: Structured Logging & Observability [✅ Complete — archived — no deps]

Milestone 12: Security, Reliability & Real-Time Infrastructure
├── TRACK-041: HTTP Security Headers [✅ Complete — archived — no deps]
├── TRACK-042: Database Connection Pool Configuration [✅ Complete — archived — no deps]
├── TRACK-043: Application-Level Rate Limiting on Server Functions [✅ Complete — archived — depends on 032]
├── TRACK-044: Request ID Middleware Wiring [✅ Complete — archived — depends on 040, 043]
├── TRACK-045: Graceful Shutdown & Background Processor Drain [✅ Complete — archived — no deps]
└── TRACK-046: Real-Time Notifications via SSE [📋 Planned — depends on 022, 030]

Milestone 13: Production Readiness
└── TRACK-047: Coolify Private-Pilot Deployment [✅ Complete — archived — depends on 038, 041, 042, 045]

Milestone 14: Data Protection & Recovery
└── TRACK-048: Backup & Restore Readiness [📋 Planned — depends on 047]

Milestone 15: Instructor Productivity
└── TRACK-049: Instructor Feedback Snippets [📋 Planned — no deps]

Milestone 16: Student Support Workflows
└── TRACK-050: At-Risk Intervention Workflow [📋 Planned — depends on 023]

Milestone 17: Academic Governance
└── TRACK-051: Grade Release Workflow [📋 Planned — depends on 025]
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
| **G** | TRACK-014, TRACK-016, TRACK-017, TRACK-018, TRACK-019 | Fully independent — no file overlap (distinct domains: mutations, email ops, review UX, notifications, analytics) — all complete (archived) |
| **H** | TRACK-015 → TRACK-014 | Sequential — TRACK-015 consumed the query-key factory from TRACK-014 for useQuery conversion (both complete — TRACK-014 archived, TRACK-015 archived) |
| **I** | TRACK-020 | Complete — independent, new domain (rubrics/grading), extends completed tracks (template editor, review screen, analytics) but no concurrent work (complete — archived) |
| **J** | TRACK-021 | Complete — independent, extends existing email-queue polling loop + notifications, no file overlap with TRACK-020 (different domain: deadline reminders vs grading) (complete — archived) |
| **K** | TRACK-022 | Complete — extends existing `users.settings` JSONB + `enqueueEventEmail` chokepoint + 12 notification sites with per-type per-channel preference gating. Implemented alongside TRACK-021 so `deadline_reminder` type respects user prefs from day one (complete — archived) |
| **L** | TRACK-023 | Independent — new risk-scoring module + dashboard widget + event-driven alerts at `submitReviewHandler`. No file overlap with TRACK-020/021/022 (different domain: risk identification vs grading/reminders/preferences). Complementary to TRACK-021 (event-driven catches discrete risk moments, scanner catches time-based risk). Minor overlap with TRACK-022 on notification type registry — coordinate if parallelized (complete — archived) |
| **M** | TRACK-024 | Fully independent — only touches `tsconfig.json` and `package.json`, no feature file overlap (complete — archived) |
| **N** | TRACK-025 | Complete — depends on TRACK-020 (complete) — extends `review_scores` data and analytics export infrastructure. No file overlap with TRACK-023 (different domain: grade computation vs risk scoring). Minor overlap with analytics dashboards — coordinate if parallelized with TRACK-023 admin analytics extension (complete — archived) |
| **O** | TRACK-026 | Complete — new domain (discussions), extended notification infrastructure (TRACK-022) and email queue (TRACK-018). No file overlap with TRACK-025 (different domain: discussions vs grading). Archived |
| **P** | TRACK-027 → TRACK-028 | Both complete (archived). TRACK-027 expanded seed data (student2, student3, consultation seed) + decoupled instructor-review tests + 3 new specs + notification/upload/negative test assertions. TRACK-028 built on this expanded seed data and decoupled patterns — expanded coverage to 73 tests across 14 spec files, added Firefox + mobile-chrome projects, axe-core a11y scanning, cross-role lifecycle test. No file overlap with feature tracks (TRACK-025/026) — only touches `tests/e2e/`, `scripts/seed-e2e.ts`, and `playwright.config.ts` |
| **Q** | TRACK-029, TRACK-030 | Both complete — TRACK-029 touched `query-keys.ts` + settings + gradebook components (archived); TRACK-030 touched `use-notifications.ts` + `NotificationCenter.tsx` + `query-keys.ts` (archived). Both depended on TRACK-014 (complete — query-key factory). No file overlap with E2E tracks (TRACK-027/028 — different domain: client data-fetching vs e2e tests). Minor overlap with gradebook feature (TRACK-025 — complete) on gradebook component files (TRACK-029 only) |
| **R** | TRACK-031, TRACK-034 (complete — archived), TRACK-035 (complete — archived), TRACK-036 (complete — archived) | Fully independent quick wins — TRACK-031 touches `src/server/*.server.ts` (guard imports) + `src/config/env.ts`; TRACK-034 touched `src/server/two-factor.server.ts` + locale files (complete — archived); TRACK-035 touched `vitest.config.ts` + `vitest.config.integration.ts` + `package.json` (complete — archived); TRACK-036 touched `lefthook.yml` + `package.json` + `.socraticodecontextartifacts.json` (complete — archived). Minor overlap: TRACK-035 and TRACK-036 both touched `package.json` scripts — coordinated to avoid merge conflicts |
| **S** | TRACK-032 → TRACK-033 | Both complete — TRACK-032 (type-safety restoration, archived) touched the same `createServerFn` stub files that TRACK-033 (architecture standardization, archived) refactored. TRACK-033 proceeded with structural changes on the typed stubs after TRACK-032's type fixes. Both touched `src/server/*.ts` and `src/server/*.server.ts` |
| **T** | TRACK-037 (complete — archived), TRACK-038 (complete — archived), TRACK-039 (complete — archived), TRACK-040 (complete — archived) | All complete — TRACK-037 touches layout files + E2E tests; TRACK-038 added a new route; TRACK-039 extended email-queue tick loop with R2 cleanup scanner; TRACK-040 touches logger/errors/background jobs. Minor overlap: TRACK-040 and TRACK-039 both touched `email-queue-init.ts` — coordinate if parallelized (both complete) |
| **U** | TRACK-041 (complete — archived), TRACK-042 (complete — archived), TRACK-045 (complete — archived) | TRACK-041 created new `src/start.ts` + `src/lib/security-headers.ts` + updated `src/router.tsx` (nonce via `ssr: { nonce }`); TRACK-042 touched `src/db/index.ts` + `env.ts`; TRACK-045 touches `src/router.tsx` + `email-queue-init.ts` + new `shutdown.ts`. Note: TRACK-041 and TRACK-045 both touch `src/router.tsx` — overlap is moot since TRACK-041 is complete (TRACK-045 builds on the post-041 router). Config/infrastructure-only changes |
| **V** | TRACK-043 → TRACK-032 (complete — archived) | Sequential dependency — TRACK-043 extends the `typedServerFn` wrapper introduced in TRACK-032. Established the `.middleware()` method on `TypedBuilder`, now used by TRACK-044. |
| **W** | TRACK-044 → TRACK-040, TRACK-043 (complete — archived) | TRACK-044 wires TRACK-040's `requestIdMiddleware` through the middleware chaining established by TRACK-043. It runs request-ID middleware before optional rate limiting so all server-function logs receive request context. |
| **X** | TRACK-046 → TRACK-022 (complete), TRACK-030 (complete) | Sequential dependency — TRACK-046 builds on notification infrastructure from TRACK-022 and the client-side data layer from TRACK-030. New domain (SSE route + connection manager) — no file overlap with other planned tracks |
| **Y** | TRACK-047 → TRACK-048 | TRACK-047 is complete and archived; any broader backup/restore follow-up can now build on the verified seven-copy pilot baseline before wider onboarding. |
| **Z** | TRACK-049, TRACK-050, TRACK-051 | Independently implementable after their completed dependencies. TRACK-049 touches review UI and a new snippet domain; TRACK-050 touches risk/dashboard/assignment-reassignment paths; TRACK-051 touches gradebook and student-grade visibility. Coordinate only if work overlaps shared instructor dashboard or gradebook files. |

---

## Effort Summary

| Milestone | Tracks | Estimated Effort |
|-----------|:---:|:---:|
| 1: Critical Fixes | 4 | ~12 Days |
| 2: Performance & Optimization | 3 | ~7 Days |
| 3: UX & Accessibility | 6 | ~13 Days |
| 4: Quality Assurance | 1 | ~3 Days |
| 5: Post-Audit Enhancements | 6 | ~25 Days |
| 6: New Features | 6 | ~34 Days |
| 7: Infrastructure & Tooling | 1 | ~1 Day |
| 8: E2E Coverage Expansion | 2 | ~9 Days |
| 9: Client Architecture Consistency | 2 | ~3 Days |
| 10: Infrastructure Consistency & Tech Debt | 6 | ~12 Days |
| 11: Observability & Infrastructure Hardening | 4 | ~10 Days |
| 12: Security, Reliability & Real-Time Infrastructure | 6 | ~20 Days |
| 13: Production Readiness | 1 | ~4–6 Days |
| 14: Data Protection & Recovery | 1 | ~3–6 Days |
| 15: Instructor Productivity | 1 | ~4–7 Days |
| 16: Student Support Workflows | 1 | ~5–8 Days |
| 17: Academic Governance | 1 | ~8–12 Days |
| **Total** | **52** | **~173–188 Days** |

> Effort estimates assume a single developer. Tracks within the same parallelization group can be distributed across developers to reduce wall-clock time.

---

## Adding New Tracks

New tracks follow a two-phase lifecycle in this document:

1. **Planned/Active** — Add a full-detail entry under the appropriate milestone (status, audit IDs, deps, decisions, scope, execution vectors, DoD). Scaffold via `conductor_new_track` which creates `conductor/tracks/<track_id>/spec.md` + `plan.md`.
2. **Complete** — On archival to `conductor/archive/<track_id>_<date>/`, collapse the entry to an index row: status badge, audit IDs, deps, one-line decision summary, archive link. The archive's `spec.md` and `plan.md` become the single source of truth for full detail.

This keeps the roadmap scannable — new tracks add ~5 lines as index entries, not ~50–100 lines of duplicated detail.
