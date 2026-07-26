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

#### Context Anchors (Traceability)
*   **PRD Reference:** `docs/PRD.md#checkpoints--submissions` (review workflow with rubric scoring — the data source for grade computation), `docs/PRD.md#analytics--reporting` (CSV/Excel export infrastructure — extension point for gradebook exports), `docs/PRD.md#data-model-summary` (`ReviewScore` entity — denormalized snapshot of criterion score/weight at review time)
*   **TDD Reference:** `docs/TDD.md` `assignments` table (`src/db/schema/assignments.ts:24` — `finalDeadline`, `instructorId`), `checkpoints` table (`src/db/schema/assignments.ts:77` — `state`, `order`, `studentId`, `templateCheckpointId`), `reviews` table (`src/db/schema/submissions.ts:41` — `decision`, `reviewedAt`), `review_scores` table (`src/db/schema/rubrics.ts:46` — `score`, `weight`, `criterionTitle`, `levelLabel` — denormalized snapshot frozen at review time), `template_checkpoints` table (`src/db/schema/templates.ts:16` — `gradingType`, `order`, `minConsultations`); `src/server/analytics-export.server.ts` (existing CSV export handlers + private `escapeCsvValue`/`buildCsv` helpers — extension point for gradebook CSV), `src/lib/excel-export.ts` (existing client-side `.xlsx` export + `exportRubricScoresToExcel` pattern — extension point for gradebook Excel), `src/server/dashboard-student.server.ts` (student dashboard handler — extension point for final grade display), `src/server/dashboard-instructor.server.ts:53-255` (`getInstructorDashboardDataHandler` — extension point for gradebook summary), `src/server/reviews.server.ts:220` (`submitReviewHandler` — event site for grade recomputation trigger; file is at 495/500 lines — extension must go in `reviews-extras.server.ts`), `src/server/assignments.server.ts:79` (`createAssignmentHandler` — where default grade config is inserted inside the transaction; file is at 498/500 lines — extension must go in `assignments-extras.server.ts`), `src/server/reviews-extras.server.ts` (existing extras file — extension point for `recomputeStudentGrade` advisory call), `src/server/assignments-extras.server.ts` (existing extras file — extension point for `createDefaultGradeConfig` helper)
*   **Product Spec Reference:** `conductor/product.md` Track: Rubric-Based Grading & Evaluation (TRACK-020) — explicitly deferred "Grade transcripts / final grade aggregation across checkpoints (separate future track)" in Out of Scope section of `conductor/archive/rubric-based-grading-evaluation_20260723/spec.md`

#### Track Tech Stack
*   Drizzle ORM — New `assignment_grade_config` table (weighting scheme per assignment) and `final_grades` table (cached computed grade per student per assignment). New schema file `src/db/schema/gradebook.ts`, registered in `src/db/schema/index.ts` re-exports + relations. Migration generated via `pnpm db:generate`. Neither table uses `deletedAt` soft-delete — `assignment_grade_config` is 1:1 with assignments (cascade-deleted via FK), `final_grades` is a cache (upserted, never deleted individually).
*   New shared module: `src/lib/grade-computation.ts` — pure functions, no DB access. Exports `computeFinalGrade(checkpoints: CheckpointGradeInput[], config: AssignmentGradeConfig): FinalGradeResult` and types (`GradingScheme = 'equal_weight' | 'custom_weight'`, `CheckpointGradeInput`, `FinalGradeResult = { score: number | null, letterGrade: string | null, status: 'complete' | 'incomplete' | 'in_progress', contributingCheckpoints: ContributingCheckpoint[] }`, `ContributingCheckpoint = { checkpointId: number, checkpointName: string, templateCheckpointId: number | null, order: number, state: string, score: number, isRubric: boolean, weight: number }`). Called from server handlers (on-demand computation) and cached in `final_grades` table.
*   New server function split: `src/server/gradebook.ts` (client-safe Zod schemas + `createServerFn` stubs with `.inputValidator(Schema).handler(...)` builder pattern) + `src/server/gradebook.server.ts` (handler implementations — `getStudentFinalGradeHandler`, `getAssignmentGradebookHandler`, `saveGradeConfigHandler`). Note: `exportGradebookCsvHandler` lives in `analytics-export.server.ts` (see below), NOT in `gradebook.server.ts`.
*   Existing file extension: `src/server/analytics-export.server.ts` (355 lines, has room) — add `exportGradebookCsvHandler` (admin-only, per-assignment gradebook with ownership check). Uses the file's existing private `escapeCsvValue` and `buildCsv` helpers directly (no export needed — same file).
*   Existing file extension: `src/lib/excel-export.ts` (64 lines) — add `exportGradebookToExcel` helper (client-side `.xlsx` with human-readable column headers, matching existing `exportRubricScoresToExcel` pattern). Uses existing `sanitizeCell` for formula-injection mitigation.
*   Existing file extension: `src/server/reviews-extras.server.ts` — add `recomputeStudentGrade(db, assignmentId, studentId)` helper function. Called from `submitReviewHandler` post-commit advisory section (1-line call + try/catch = ~5 lines added to `reviews.server.ts` which is at 495/500 — tight but fits).
*   Existing file extension: `src/server/assignments-extras.server.ts` — add `createDefaultGradeConfig(tx, assignmentId)` helper. Called from `createAssignmentHandler` inside the transaction (1-line call — `assignments.server.ts` is at 498/500, 1 line fits).
*   shadcn/ui components — `Table` for gradebook grid (students × checkpoints → final grade), `Badge` for letter grades, `Card`/`CardHeader`/`CardContent` for student final grade card, `Input` for custom weight configuration, `Select` for grading scheme selector.
*   i18n codegen — new gradebook keys in both `locales/en.json` and `locales/id.json` under `gradebook.*` namespace.

#### Scope Boundaries
*   **In Scope:**
    *   **Grade configuration schema:** New `assignment_grade_config` table — `assignmentId` (integer, FK → assignments, unique, `onDelete: cascade`), `gradingScheme` (pgEnum: `equal_weight` | `custom_weight`), `customWeights` (jsonb, nullable — `{ templateCheckpointId: weight }` map, used only when scheme is `custom_weight`; keys are `templateCheckpointId` integers as strings, values are integer weights 0–100), `letterGradeBounds` (jsonb — `{ "A": 90, "B": 80, "C": 70, "D": 60 }` configurable lower bounds; score below the lowest bound → "F" implicitly), `createdAt` (timestamp), `updatedAt` (timestamp). Default config auto-created inside `createAssignmentHandler` transaction via `createDefaultGradeConfig(tx, assignmentId)` helper in `assignments-extras.server.ts` (scheme = `equal_weight`, `customWeights` = null, standard letter bounds). For pre-existing assignments (created before this track), a **migration script** backfills default config rows — NOT lazy creation on read.
    *   **Final grades cache table:** New `final_grades` table — `id` (serial PK), `assignmentId` (integer, FK → assignments, `onDelete: cascade`), `studentId` (text, FK → users), `numericScore` (numeric(5,2), nullable — null if incomplete), `letterGrade` (text, nullable), `status` (pgEnum: `complete` | `incomplete` | `in_progress`), `contributingCheckpoints` (jsonb — array of `{ checkpointId: number, checkpointName: string, templateCheckpointId: number | null, order: number, state: string, score: number, isRubric: boolean, weight: number }`), `computedAt` (timestamp), `updatedAt` (timestamp). Unique constraint on `(assignmentId, studentId)`. Recomputed on-demand or when a review is submitted (triggered from `submitReviewHandler` post-commit via `recomputeStudentGrade` in `reviews-extras.server.ts`).
    *   **Grade computation engine:** New `src/lib/grade-computation.ts` — pure function `computeFinalGrade(checkpoints, config): FinalGradeResult`. For each checkpoint: if `gradingType` is `null` (pass/fail), score = `state === 'passed'` ? 100 : 0; if `numeric`/`qualitative`, aggregate `review_scores` weighted by criterion `weight` (using denormalized snapshot values — sum of `score * weight / 100` per criterion). Overall score = weighted average of checkpoint scores using the configured scheme: `equal_weight` = simple average (sum / count), `custom_weight` = weighted by `customWeights` map (keyed by `templateCheckpointId`). Letter grade derived from `letterGradeBounds` (score >= bound → that letter; score below lowest bound → "F"). Status: `complete` if all checkpoints passed, `in_progress` if some passed, `incomplete` if none passed.
    *   **Instructor gradebook view:** New route `/instructor/assignments/$id/gradebook` — table view (students × checkpoints → final grade column). Each cell shows the checkpoint's computed score (or pass/fail badge for non-rubric checkpoints). Final grade column shows numeric score + letter badge. Export CSV and Excel buttons. Linked from the instructor assignment detail page. (Grade Settings dialog is admin-only — see below.)
    *   **Admin grade settings dialog:** "Grade Settings" dialog accessible from the admin template editor or admin analytics — `Select` for scheme, `Input` fields for custom weights (visible only when `custom_weight` selected, keyed by `templateCheckpointId`), `Input` fields for letter bounds. Admin-only (consistent with rubric ownership per TRACK-020 — rubrics are admin-owned, grade config follows the same pattern). `saveGradeConfigHandler` is admin-only via `isAdmin` guard.
    *   **Student final grade card:** New component on `/student/assignments/$id` — shows final grade (numeric + letter badge) when the assignment is complete, or current progress score with "in progress" status. Per-checkpoint score breakdown in a collapsible section. Read-only for students.
    *   **Admin grade overview:** Extend admin analytics (`/admin/analytics`) with a "Grade Distribution" section — aggregate letter grade distribution across all assignments (A/B/C/D/F counts as progress bars). No drill-down to individual students (v2).
    *   **CSV/Excel export:** `exportGradebookCsvHandler` in `analytics-export.server.ts` (admin-only, per-assignment, ownership-verified) returns CSV string with student name, per-checkpoint scores, final numeric score, letter grade. Uses existing private `escapeCsvValue` and `buildCsv` in the same file. Client-side `exportGradebookToExcel` helper in `excel-export.ts` for `.xlsx` export, using existing `sanitizeCell`.
    *   **Grade recomputation trigger:** Extend `submitReviewHandler` (`reviews.server.ts:220`) post-commit advisory section with a call to `recomputeStudentGrade(db, assignmentId, studentId)` (defined in `reviews-extras.server.ts`, try/catch, never affects review transaction). Only triggers on `pass` decision (revise doesn't change pass state). NOT triggered on `submitCheckpointHandler` (submitting doesn't change pass state — grade only changes when a checkpoint transitions to `passed`).
    *   **Audit logging:** All grade config changes (scheme, custom weights, letter bounds) logged to `audit_log` via `logAuditEvent` with action `gradebook.config_updated`, entity type `assignment_grade_config`, details including previous and new values. Consistent with existing audit logging for template/rubric changes.
    *   **Schema registration:** New `src/db/schema/gradebook.ts` file registered in `src/db/schema/index.ts` re-exports + relations (`assignmentGradeConfigRelations`, `finalGradesRelations`).
    *   **i18n keys:** `gradebook.title`, `gradebook.finalGrade`, `gradebook.letterGrade.*` (A/B/C/D/F labels), `gradebook.status.complete`/`.in_progress`/`.incomplete`, `gradebook.settings.scheme`/`.equalWeight`/`.customWeight`, `gradebook.settings.letterBounds`, `gradebook.settings.customWeights`, `gradebook.exportCsv`/`.exportExcel`, `gradebook.empty`/`.noGrades`, `analytics.gradeDistribution`. Added to both locales, run `pnpm generate:i18n`.
    *   **Unit tests:** `grade-computation.ts` (2 schemes in isolation — equal_weight, custom_weight; pass/fail checkpoints vs rubric-scored checkpoints; incomplete assignments; letter grade boundary edge cases — score exactly 90 → "A", score 89.99 → "B", score below D bound → "F"; all-passed → complete, none-passed → incomplete, mixed → in_progress; null gradingType checkpoints scored as pass=100/fail=0; custom_weights keyed by templateCheckpointId). `getStudentFinalGradeHandler` (returns computed grade, returns null when no config exists, ownership verified). `getAssignmentGradebookHandler` (returns all students with per-checkpoint scores, sorted by student name, instructor ownership verified). `exportGradebookCsvHandler` (CSV format correct, formula injection mitigated via `escapeCsvValue`, admin ownership verified). `saveGradeConfigHandler` (admin-only, validates custom weights sum to 100 when scheme is `custom_weight` via `superRefine`, upserts config, audit logs the change). Grade recomputation trigger (fires post-commit on `submitReviewHandler` with `pass` decision, advisory try/catch doesn't throw, upserts `final_grades` row, doesn't affect review transaction, does NOT fire on `revise` decision).
*   **Out of Scope:**
    *   Grade appeals workflow (no formal appeal request/approval flow — v2)
    *   Cross-assignment grade aggregation / transcript generation (v2 — requires course/semester grouping from the proposed Course & Semester track)
    *   GPA computation (v2 — requires institution-specific GPA scales)
    *   Student-facing grade editing or grade negotiation (grades are computed, read-only for students)
    *   Weighted checkpoint categories (e.g., "homework = 30%, exams = 70%" — v2; v1 weights are per-checkpoint, not per-category)
    *   Grade history/audit trail (no time-series of grade changes — `final_grades` is upserted, not append-only; v2 could add `final_grade_history` table)
    *   Automated grade import from external systems (LMS integration — v2)
    *   Student notification on grade update (v2 — students see their grade when they open the assignment page; no push notification for grade changes)
    *   `passThreshold` / numeric pass override (the instructor's pass/revise decision already determines checkpoint completion — a numeric threshold would conflict with instructor judgment)

#### High-Level Execution Vectors
*   **Phase 1 (Schema & Computation Engine):** Create `src/db/schema/gradebook.ts` with `assignment_grade_config` and `final_grades` tables — proper FKs (`assignmentId` → assignments `onDelete: cascade`, `studentId` → users), unique constraints (`assignment_grade_config_assignment_id_unq`, `final_grades_assignment_id_student_id_unq`), and indexes. `numericScore` as `numeric(5,2)`. No `deletedAt` on either table (cascade-deleted with assignment / cache upserted). Register in `src/db/schema/index.ts` re-exports + relations. Generate migration via `pnpm db:generate` — migration includes backfill of default `assignment_grade_config` rows for all existing assignments. Create `src/lib/grade-computation.ts` with `computeFinalGrade(checkpoints, config): FinalGradeResult`. Define types: `GradingScheme` (`'equal_weight' | 'custom_weight'`), `CheckpointGradeInput`, `FinalGradeResult`, `ContributingCheckpoint`, `AssignmentGradeConfig`. Implement 2 schemes: `equal_weight` (simple average of checkpoint scores), `custom_weight` (weighted by `customWeights` map keyed by `templateCheckpointId`). For each checkpoint: if `gradingType === null`, score = `state === 'passed'` ? 100 : 0; if `numeric`/`qualitative`, aggregate `review_scores` (sum of `score * weight / 100` per criterion, using denormalized snapshot). Letter grade from `letterGradeBounds` (score >= bound → letter; below lowest bound → "F"). Status: all passed → `complete`, none passed → `incomplete`, mixed → `in_progress`. Pure function — no DB access. Write unit tests (each scheme in isolation, pass/fail vs rubric checkpoints, incomplete assignments, letter grade boundaries including "F" fallback, custom_weights keyed by templateCheckpointId, null config defaults). Verify: both schemes compute correctly, pass/fail checkpoints scored as 100/0, rubric checkpoints use denormalized snapshot, letter grades derived from configurable bounds with "F" fallback, status reflects completion state.
*   **Phase 2 (Server Functions & Grade Recomputation):** Create `src/server/gradebook.ts` (Zod schemas: `GetStudentFinalGradeSchema`, `GetAssignmentGradebookSchema`, `SaveGradeConfigSchema` with `superRefine` for custom weight sum validation) + `createServerFn` stubs with `.inputValidator(Schema).handler(...)` pattern. Create `src/server/gradebook.server.ts` with handlers: `getStudentFinalGradeHandler` (ownership-verified, returns computed grade or null — does NOT auto-create config; reads from `final_grades` cache or computes on-demand if cache is stale), `getAssignmentGradebookHandler` (instructor ownership-verified, returns all students with per-checkpoint scores via batch query joining checkpoints + reviews + review_scores, passes to `computeFinalGrade`), `saveGradeConfigHandler` (admin-only via `isAdmin` guard, validates custom weights sum to 100 when scheme is `custom_weight`, upserts config, audit logs via `logAuditEvent`). Add `exportGradebookCsvHandler` to `analytics-export.server.ts` (admin-only, ownership-verified, uses existing private `escapeCsvValue` + `buildCsv`). Add `recomputeStudentGrade(db, assignmentId, studentId)` to `reviews-extras.server.ts` — fetches student checkpoint data, calls `computeFinalGrade`, upserts `final_grades` row. Add `createDefaultGradeConfig(tx, assignmentId)` to `assignments-extras.server.ts` — inserts default `assignment_grade_config` row. Extend `submitReviewHandler` post-commit advisory section with 1-line call to `recomputeStudentGrade` (wrapped in try/catch, only when `decision === 'pass'`). Extend `createAssignmentHandler` inside transaction with 1-line call to `createDefaultGradeConfig(tx, assignmentId)`. Write tests (all handlers: success + ownership + validation failure cases; recomputation trigger: fires post-commit on pass, does NOT fire on revise, advisory, upserts `final_grades` row, doesn't affect review transaction; default config creation: fires inside assignment creation transaction). Verify: gradebook returns correct per-student scores, CSV export is sanitized, config save validates custom weights and audit logs, grade recomputes after pass review, default config created with assignment.
*   **Phase 3 (UI, Export & i18n):** Create instructor gradebook route `/instructor/assignments/$id/gradebook` — `Table` with students as rows, checkpoints as columns, final grade as last column. Each cell: numeric score (rubric checkpoints) or pass/fail `Badge` (non-rubric). Final grade column: numeric score + letter `Badge`. Export CSV + Excel buttons (reuse existing `useCsvDownload` hook + `downloadCsv` utility from `src/lib/download.ts`). Create admin grade settings dialog — `Select` for scheme, `Input` fields for custom weights (visible only when `custom_weight` selected, labeled by checkpoint name), `Input` fields for letter bounds. Create student final grade card component on `/student/assignments/$id` — `Card` with numeric score + letter `Badge`, collapsible per-checkpoint breakdown, read-only. Extend admin analytics with "Grade Distribution" section (progress bars for A/B/C/D/F counts via aggregate query). Add i18n keys to both locales. Run `pnpm generate:i18n`. Write tests (gradebook table renders, settings dialog validates, student card shows/hides correctly, admin distribution renders, CSV/Excel export triggers). Verify: gradebook shows all students with scores, admin settings dialog saves config, student sees final grade when complete, admin sees distribution, CSV/Excel export works, i18n parity, all files under 500 lines.

#### Verification & Definition of Done (DoD)
*   [ ] **Manual Checkpoint:** Instructor opens `/instructor/assignments/$id/gradebook` → sees a table of all assigned students with per-checkpoint scores and a final grade column. A student with all checkpoints passed shows a numeric score (e.g., 87.50) and letter badge (e.g., "B"). A student with incomplete checkpoints shows "In Progress" status. Admin opens Grade Settings dialog → changes scheme from "Equal Weight" to "Custom Weight" → enters custom weights per checkpoint (must sum to 100%) → saves → gradebook recalculates. Admin clicks "Export CSV" → downloads a `.csv` file with student names, checkpoint scores, and final grades. Student opens `/student/assignments/$id` → sees a final grade card with their score and letter badge (when assignment is complete) or "In Progress" (when incomplete). Student clicks the breakdown → sees per-checkpoint scores. Admin opens `/admin/analytics` → sees a "Grade Distribution" section with A/B/C/D/F progress bars. Instructor reviews a submission with `pass` decision → the student's final grade in the gradebook updates to reflect the newly passed checkpoint. A `revise` review does NOT trigger grade recomputation. Backward compatibility: pre-existing assignments have default `assignment_grade_config` rows backfilled by the migration script (not lazy-created on read). A new assignment created after this track automatically gets a default config row (inside the creation transaction).
*   [ ] **Automated Tests:** `pnpm test:unit` — all tests pass. New tests for: `computeFinalGrade` (2 schemes in isolation — equal_weight simple average, custom_weight weighted by templateCheckpointId; pass/fail checkpoints scored as 100/0, rubric checkpoints use `review_scores` denormalized snapshot; incomplete assignment → status `incomplete`, mixed → `in_progress`, all passed → `complete`; letter grade boundary edge cases — score exactly 90 → "A", score 89.99 → "B", score 59.99 → "F"; null config → uses defaults), `getStudentFinalGradeHandler` (returns computed grade, returns null when no config exists, ownership verified — student cannot access another student's grade, does NOT auto-create config on read), `getAssignmentGradebookHandler` (returns all students with per-checkpoint scores, sorted by name, instructor ownership verified), `exportGradebookCsvHandler` (CSV format correct — headers, student rows, formula injection mitigated via `escapeCsvValue`, admin ownership verified), `saveGradeConfigHandler` (admin-only — rejects instructor/student, validates custom weights sum to 100% via `superRefine` when scheme is `custom_weight`, upserts config, audit logs the change via `logAuditEvent`), `recomputeStudentGrade` (fires post-commit on `submitReviewHandler` with `pass` decision, does NOT fire on `revise`, advisory try/catch doesn't throw, upserts `final_grades` row, doesn't affect review transaction), `createDefaultGradeConfig` (inserts default config inside assignment creation transaction, scheme = `equal_weight`, customWeights = null, standard letter bounds). `pnpm check:i18n` — parity for all new keys. `pnpm test:coverage` >= 80% on all thresholds.
*   [ ] **Conductor Review:** New `assignment_grade_config` and `final_grades` tables in `src/db/schema/gradebook.ts`, registered in `src/db/schema/index.ts` re-exports + relations. Neither table has `deletedAt` (cascade-deleted with assignment / cache upserted). `numericScore` is `numeric(5,2)`. `gradingScheme` is a pgEnum with 2 values (`equal_weight` | `custom_weight`) — no redundant `rubric_aggregate`. No `passThreshold` column (instructor's pass/revise decision determines checkpoint completion). `customWeights` jsonb keyed by `templateCheckpointId` (string keys, integer values). `letterGradeBounds` jsonb with A/B/C/D lower bounds; "F" is implicit fallback below lowest bound. `contributingCheckpoints` jsonb has defined shape (`{ checkpointId, checkpointName, templateCheckpointId, order, state, score, isRubric, weight }`). `grade-computation.ts` is a pure function (no DB access, no side effects — unit-testable in isolation). Grade recomputation is advisory (try/catch, post-commit, only on `pass` decision, never affects review transaction) — lives in `reviews-extras.server.ts`, called with 1 line from `submitReviewHandler`. Default config creation lives in `assignments-extras.server.ts`, called with 1 line from `createAssignmentHandler` inside the transaction. Pre-existing assignments backfilled by migration script (not lazy-created on read). `exportGradebookCsvHandler` lives in `analytics-export.server.ts` (same file as `escapeCsvValue`/`buildCsv` — no export needed). `saveGradeConfigHandler` is admin-only (consistent with rubric ownership per TRACK-020). Grade config changes audit-logged via `logAuditEvent`. `review_scores` denormalized snapshot used for computation (not live rubric lookup — ensures historical grades are frozen). Excel export uses existing `xlsx` dependency + `sanitizeCell` (no new dependency). All server functions follow two-file split with `.inputValidator(Schema).handler(...)` builder pattern. All files under 500 lines. `pnpm typecheck`, `pnpm lint`, `pnpm check:i18n` all clean.

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

## Milestone 8: E2E Coverage Expansion

> This milestone addresses gaps identified in a comprehensive E2E test audit conducted after Milestone 4 (E2E-FEAT-001) and all subsequent feature tracks. The audit found that the existing 5-spec, 14-test suite covers only 10 of 30 page routes (33%) and leaves several core business flows with zero E2E coverage. Tracks are split by criticality: TRACK-027 covers P0 gaps in untested core flows, TRACK-028 covers P1/P2 breadth and infrastructure quality. Both tracks build on the Playwright infrastructure established in E2E-FEAT-001.

---

### TRACK-027: Critical Business Flow E2E Coverage

- **Status:** ✅ Complete · **Audit IDs:** None (proactive testing gap remediation — identified in E2E audit) · **Deps:** E2E-FEAT-001 (E2E Testing with Playwright — provides infrastructure)
- **Key decisions:** 3 new E2E specs (consultation lifecycle, extension workflow, password setup); seed data expanded with student2 (enrolled) + student3 (not enrolled) + pending consultation; instructor-review tests decoupled (each sets up own state via `createSubmissionForCheckpoint`); notification delivery assertions added to existing specs; upload UI validation (file type + size); negative test cases (invalid login, locked checkpoint, cross-student access denial, superadmin role-creation rule); shared `tests/e2e/helpers/notifications.ts` extracted from duplicated helpers; non-null assertions replaced with guard clauses; template literals without interpolation replaced with single quotes
- **Detail:** `conductor/archive/critical-business-flow-e2e-coverage_20260726/` (spec.md, plan.md)

---

### TRACK-028: E2E Breadth & Infrastructure Expansion

*   **Status:** `Pending`
*   **Dependencies:** E2E-FEAT-001 (E2E Testing with Playwright — provides infrastructure). Recommended AFTER TRACK-027 (builds on expanded seed data and decoupled test patterns). Can be implemented in parallel with TRACK-027 if seed data changes are coordinated.
*   **Estimated Effort:** 5 Days / 3 Sprint Loops
*   **Audit IDs:** None (proactive testing gap remediation — identified in E2E audit)

#### Context Anchors (Traceability)
*   **PRD Reference:** `docs/PRD.md` — Role-based dashboards (student/instructor/admin widgets), assignment templates (admin CRUD), settings hub (profile, password, 2FA, appearance, accessibility, notification preferences), user management (edit, delete with reassignment), analytics & reporting (admin/instructor dashboards, CSV/Excel export), two-factor authentication (TOTP, backup codes), bulk operations (user/template import), checkpoint discussions (Q&A threads), rubric-based grading (numeric/qualitative scoring)
*   **TDD Reference:** All 30 page routes of 37 total route files under `src/routes/` (5 layout files + 1 API catch-all + 1 root + 30 page routes). 10 currently e2e-tested, 20 untested. Key untested routes: `src/routes/index.tsx` (landing page), `src/routes/_authenticated/admin/dashboard.tsx`, `src/routes/_authenticated/admin/audit-log.tsx`, `src/routes/_authenticated/admin/analytics.tsx`, `src/routes/_authenticated/admin/email-queue.tsx`, `src/routes/_authenticated/admin/templates/index.tsx`, `src/routes/_authenticated/admin/templates/$templateId.tsx`, `src/routes/_authenticated/admin/templates/import.tsx`, `src/routes/_authenticated/admin/users/import.tsx`, `src/routes/_authenticated/instructor/dashboard.tsx`, `src/routes/_authenticated/instructor/analytics.tsx`, `src/routes/_authenticated/student/dashboard.tsx`, `src/routes/_authenticated/*/settings.tsx` (3 settings routes), `src/routes/_unauthenticated/auth/forgot-password.tsx`, `src/routes/_unauthenticated/auth/reset-password.tsx`, `src/routes/_unauthenticated/auth/verify-2fa.tsx`, `src/routes/_unauthenticated/auth/verify-backup-code.tsx`. Server files: `src/server/templates.ts` + `templates.server.ts` (CRUD + duplicate), `src/server/settings.ts` + `settings.server.ts` (`updateUserSettingsHandler`), `src/server/users.ts` + `users.server.ts` (`updateUser`, `deleteUser`, `reassignAssignment`, `listInstructorActiveAssignments`), `src/server/two-factor.ts` + `src/server/two-factor.server.ts`, `src/server/discussions.ts` + `discussions.server.ts`, `src/server/rubrics.ts` + `rubrics.server.ts`, `src/server/analytics.ts` + `analytics-admin.server.ts` + `analytics-instructor.server.ts`. Config: `playwright.config.ts` (projects array, webServer, retries).
*   **Product Spec Reference:** `conductor/product.md` — Track 7.2 Role-Based Dashboards (student 4 widgets, instructor 4 widgets, admin 4 widgets), Track 2.2 Assignment Templates (create, edit, duplicate, soft-delete with usage check), Track 1.3 Two-Factor Authentication (TOTP, backup codes, session management), Track 13 (user delete with `ReassignmentDialog`), TRACK-019 Analytics & Reporting (admin + instructor dashboards, CSV/Excel export), TRACK-020 Rubric-Based Grading (numeric/qualitative scoring in review form), TRACK-026 Checkpoint Discussion / Q&A Threads, Track 9 Action Feedback (success toasts, loading skeletons), Track: User Notification Preferences (TRACK-022 — per-event-type toggles in settings)

#### Track Tech Stack
*   Playwright v1.61.1 — New spec files under `tests/e2e/`, extending the existing pattern.
*   `@axe-core/playwright` — Accessibility testing plugin for automated WCAG 2.1 AA assertions on key pages. Added as devDependency.
*   Playwright projects configuration — New `firefox` project and `mobile-chrome` project added to `playwright.config.ts` `projects` array. Mobile project uses `devices['Pixel 7']` or equivalent viewport.
*   Existing helper infrastructure — No new helper files needed; reuses `auth.ts`, `db-reset.ts`, and the expanded seed data from TRACK-027 (second student, consultation seed).

#### Scope Boundaries
*   **In Scope:**
    *   **New `dashboards.spec.ts`** — Smoke test all 3 role dashboards: student (`/student/dashboard` — verify 4 widgets render: active assignments, upcoming deadlines, pending reviews, consultation reminders), instructor (`/instructor/dashboard` — verify 4 widgets: pending review queue with SLA badges, recent submissions, assignment overview, at-risk students), admin (`/admin/dashboard` — verify widgets: system metrics, activity feed, deadline escalation alerts, email queue stats). Assert no console errors on any dashboard. Assert key data from seed is visible (e.g., "E2E Test Assignment" on student dashboard).
    *   **New `admin-templates.spec.ts`** — Admin creates a template (name, type, 3 checkpoints with add/remove/reorder) → verify it appears in the template list. Admin edits the template at `/admin/templates/$templateId` → verify changes persist after reload. Admin duplicates the template → verify "(Copy)" suffix appears. Admin attempts to delete a template in use by an assignment → verify deletion is blocked with usage count. Admin deletes an unused template (type "DELETE" confirmation) → verify it disappears from the list.
    *   **New `settings.spec.ts`** — Profile: edit name → verify it persists after reload and appears in sidebar. Password: change password → verify old password no longer works, new password works. Language: toggle from EN to ID → verify a known UI string changes (e.g., sidebar label or page heading). Theme: toggle from light to dark → verify `dark` class is applied to `<html>`. Notification preferences: toggle off an event type email → verify the checkbox state persists after reload.
    *   **Expand `admin-users.spec.ts`** — Add edit user test: open edit sheet, change name, submit, verify change in table. Add delete user test: delete an instructor with active assignments → verify `ReassignmentDialog` appears → select replacement instructor → confirm → verify assignment is reassigned (instructor changed in DB). Add delete user without active assignments → verify direct deletion without dialog.
    *   **New `cross-role-lifecycle.spec.ts`** — Single serial test exercising the full assignment lifecycle across roles: admin creates template → instructor creates assignment from template → student logs consultation → instructor verifies → student submits (via DB helper) → instructor reviews with Pass → verify next checkpoint unlocks → student submits → instructor reviews with Revise → student resubmits → instructor reviews with Pass → verify assignment completion state. This test may have a longer timeout (120s) and runs last. Browser context management: single context, clear cookies + storageState between role switches, then login as the new role via the Better Auth API (matching the `loginAsRole` pattern). It validates integration between subsystems that individual specs don't cover.
    *   **Remaining route coverage** — Add lightweight smoke tests for untested routes: landing page (`/` — verify hero section and feature cards render), admin audit log (`/admin/audit-log` — verify table loads, filters render), admin email queue (`/admin/email-queue` — verify table loads, status filter renders), admin analytics (`/admin/analytics` — verify metric cards render, date range selector present), instructor analytics (`/instructor/analytics` — verify metrics render), forgot password (`/auth/forgot-password` — fill email, submit, verify success message — note: email sending will fail since `RESEND_API_KEY` is a test key, but the UI should still show success since enqueue succeeds), reset password (`/auth/reset-password` — verify form renders with token), 2FA verify page (`/auth/verify-2fa` — verify TOTP input renders), bulk user import (`/admin/users/import` — verify upload zone and template download button render), bulk template import (`/admin/templates/import` — verify upload zone renders), discussions (student posts a message on checkpoint page → verify it appears → instructor sees it in Discussions tab → instructor replies → verify reply appears with indentation → student deletes within 15-min window → verify soft-delete), rubric grading (set up rubric criteria + `gradingType: 'numeric'` on the Proposal template checkpoint via DB helper at test start — the seed template has `gradingType: null` and no rubric criteria → instructor reviews with rubric scoring — add numeric scores per criterion → verify weighted total auto-computes → submit → verify `review_scores` persisted in DB).
    *   **Multi-browser** — Add a `firefox` project to `playwright.config.ts` using `devices['Desktop Firefox']`. Run the full suite on both Chromium and Firefox. Triage any browser-specific failures (expected: minimal, since the app uses standard web APIs).
    *   **Mobile viewport** — Add a `mobile-chrome` project using `devices['Pixel 7']` (or `devices['iPhone 14']`). Run dashboard and assignment detail tests on mobile viewport to verify responsive layouts (card-based `ProgressTable`, stacked `CheckpointListEditor`, mobile step indicator in wizard).
    *   **Accessibility e2e** — Add `@axe-core/playwright` devDependency. Run axe accessibility scans on key pages after they load: login page, student dashboard, student assignment detail, instructor review detail, admin users, admin templates. Assert zero critical and serious violations. Document but don't fail on moderate/minor issues (tracking in a separate issue).
    *   **Config improvements** — Set `retries: 1` in `playwright.config.ts` (reduces flaky-test noise without masking real failures). Consider `retries: 2` for CI-only via a `CI` env check.
*   **Out of Scope:**
    *   Full R2 upload end-to-end (same limitation as TRACK-027 — TanStack Start server-fn RPC mock)
    *   Visual regression / screenshot comparison testing (no infrastructure for baseline management — separate track if needed)
    *   Performance/load testing (separate concern)
    *   Email delivery verification (Resend API mocking)
    *   Cross-browser testing beyond Chromium + Firefox (no WebKit/Safari project — can be added later if needed)
    *   Full keyboard navigation e2e (axe covers some a11y; comprehensive keyboard nav testing deferred)

#### High-Level Execution Vectors
*   **Phase 1 (Dashboard + admin template smoke tests + config):** Add `retries: 1` to `playwright.config.ts`. Create `dashboards.spec.ts` — 3 tests (one per role), each navigates to the dashboard, waits for `networkidle`, asserts key widgets are visible, asserts no console errors. Create `admin-templates.spec.ts` — create, edit, duplicate, delete-blocked, delete-unused tests. Add `@axe-core/playwright` devDependency. Add `firefox` project to `playwright.config.ts`. Verify: dashboard and template specs pass on Chromium, `pnpm test:e2e` full suite green, axe scans run without configuration errors.
*   **Phase 2 (Settings, user edit/delete, remaining route smoke tests):** Create `settings.spec.ts` — profile, password, language, theme, notification preferences tests. Expand `admin-users.spec.ts` with edit and delete (with reassignment) tests. Add lightweight smoke tests for remaining untested routes (landing, audit log, email queue, analytics, forgot/reset password, 2FA verify, bulk imports). Add discussions spec (post, reply, delete within window). Add rubric grading spec (set up rubric criteria + `gradingType` via DB helper, numeric scoring, weighted total, persistence). Verify: all new specs pass, route coverage increases from 10/30 to 28+/30, `pnpm test:e2e` full suite green on Chromium.
*   **Phase 3 (Cross-role lifecycle + mobile + a11y + Firefox):** Create `cross-role-lifecycle.spec.ts` — single serial test with 120s timeout exercising the full lifecycle across roles. Add `mobile-chrome` project to `playwright.config.ts` — run dashboard + assignment detail tests on mobile viewport. Run axe accessibility scans on 6 key pages, assert zero critical/serious violations. Run full suite on Firefox project — triage any browser-specific failures. Verify: cross-role lifecycle test passes, mobile tests pass, axe reports zero critical/serious violations, Firefox suite passes, full suite runtime ≤ 5 minutes (with Firefox + mobile added).

#### Verification & Definition of Done (DoD)
*   [ ] **Manual Checkpoint:** Run `pnpm test:e2e` — all tests pass on both Chromium and Firefox. Dashboards render all widgets without console errors. Admin template CRUD works end-to-end (create, edit, duplicate, delete-blocked, delete). Settings hub tests verify profile/password/language/theme/notification preferences persist. User edit and delete (with reassignment dialog) work. Cross-role lifecycle test walks the full assignment flow across all roles. Remaining routes have smoke test coverage (landing, audit log, email queue, analytics, 2FA, imports, discussions, rubric grading, forgot/reset password). Mobile viewport tests pass for dashboard and assignment detail. Axe accessibility scans report zero critical/serious violations on 6 key pages. Route coverage is 28+/30 (up from 10/30). Test count is ~50+ (up from 14).
*   [ ] **Automated Tests:** `pnpm test:e2e` — all tests pass on Chromium and Firefox. Full suite runtime ≤ 5 minutes (with both browsers + mobile). `retries: 1` does not mask real failures (verified: removing a deliberate assertion still fails). `pnpm test:unit` — all existing unit tests still pass. `pnpm typecheck` clean. `pnpm check:i18n` parity maintained. `@axe-core/playwright` scans pass (zero critical/serious).
*   [ ] **Conductor Review:** New spec files follow the existing pattern. `playwright.config.ts` has 3 projects (chromium, firefox, mobile-chrome) with `retries: 1`. `@axe-core/playwright` is a devDependency. Mobile project uses a standard Playwright device descriptor. Cross-role lifecycle test is clearly marked as serial with extended timeout and uses single-context cookie clearing for role switches. Rubric grading test sets up rubric criteria via DB helper (not via UI). No new infrastructure files (reuses existing helpers). Seed data changes from TRACK-027 are backward-compatible. All new test files under 500 lines. `playwright.config.ts` stays under 500 lines. Route coverage matrix is updated to reflect 28+/30 routes tested. The `r2-mock.ts` file remains unchanged (limitation documented — not fixed in this track).

---

## Milestone 9: Client Architecture Consistency

> This milestone addresses client-side data-fetching architectural inconsistencies identified after the completion of the gradebook feature (TRACK-025). The TanStack Query architecture established in TRACK-014 (query-key factory + `useQuery`/`useMutation` with optimistic updates) is followed by most domains, but two gaps remain: (1) the query-key factory covers only 7 of ~13 data domains, with 5 settings components and the entire gradebook feature using inline string-array keys or pre-React-Query `useState`/`useEffect` patterns, and (2) the NotificationCenter reimplements infinite-scroll pagination by hand instead of using TanStack Query's native `useInfiniteQuery`. These tracks are consistency/tech-debt work — no new product features, no backend changes, no schema migrations.

---

### TRACK-029: Query-Key Factory Completion & Client Data-Fetching Consistency

*   **Status:** `Pending`
*   **Dependencies:** TRACK-014 (Optimistic UI Updates — introduced the query-key factory pattern). Can be implemented independently of TRACK-030.
*   **Estimated Effort:** 2 Days / 1 Sprint Loop
*   **Audit IDs:** None (architectural consistency / tech-debt remediation — identified in post-TRACK-025 code review)

#### Context Anchors (Traceability)
*   **PRD Reference:** `docs/PRD.md` — Settings hub (profile, password, 2FA, appearance, accessibility, notification preferences — 5 sections with inline query keys), Gradebook & Final Grade Computation (TRACK-025 — 3 components using `useState`/`useEffect` instead of `useQuery`/`useMutation`)
*   **TDD Reference:** `conductor/tech-stack.md` (TanStack Query — "Caching, deduplication, background refetching, polling for notifications"), `src/lib/query-keys.ts` (48 lines — 7 domain factories: `notificationKeys`, `consultationKeys`, `extensionKeys`, `assignmentKeys`, `userKeys`, `templateKeys`, `discussionKeys`), `src/components/settings/ProfileSection.tsx:16` (`queryKey: ['currentUser']` — inline, no invalidation on name update), `src/components/settings/SessionManagement.tsx:51` (`queryKey: ['activeSessions']` — inline), `src/components/settings/TwoFactorSettings.tsx:40` (`queryKey: ['twoFactorStatus']` — inline), `src/components/settings/AccessibilitySection.tsx:11` (`useQuery` with inline key), `src/components/settings/NotificationPreferencesSection.tsx:112` (`queryKey: ['currentUser']` — shared with ProfileSection, invalidates via inline `['currentUser']` on line 138), `src/components/gradebook/StudentFinalGradeCard.tsx:14-36` (`useState`+`useEffect`+manual `async` fetch — no cache, no dedup, no background refetch), `src/components/gradebook/RecomputeGradesButton.tsx:24-43` (`useState(loading)` + inline `async` handler — no `useMutation`, no optimistic UI, no cache invalidation), `src/routes/_authenticated/instructor/assignments/$id.gradebook.tsx:16-31` (route uses TanStack Router SSR `loader` + `Route.useLoaderData()` — NOT TanStack Query; `router.invalidate()` on line 57 is the correct pattern for refetching SSR loader data, not a bug to fix)
*   **Product Spec Reference:** `conductor/archive/optimistic-ui-updates_20260722/spec.md` (TRACK-014 — FR-1: query-key factory for 5 feature domains; "Other features keep inline keys until touched"), `conductor/archive/gradebook-final-grade-computation_20260725/` (TRACK-025 — gradebook feature built without TanStack Query, diverging from the established pattern)

#### Track Tech Stack
*   TanStack Query (`@tanstack/react-query`) — `useQuery`, `useMutation`, `useQueryClient`. Already installed, no new dependency.
*   `src/lib/query-keys.ts` — Typed query-key factory. Extending with new domain entries following the existing pattern (e.g., `notificationKeys`, `assignmentKeys`).
*   No backend changes — all server function stubs (`getAssignmentGradebook`, `saveGradeConfig`, `recomputeAllGrades`, `getStudentFinalGrade`, `getCurrentUser`, `listActiveSessions`, `getTwoFactorStatus`) already exist and are unchanged.
*   No new dependencies, no schema migrations, no i18n keys.

#### Scope Boundaries
*   **In Scope:**
    *   **Complete query-key factory:** Add `settingsKeys` (with `currentUser()`, `activeSessions()`, `twoFactorStatus()` sub-keys), `gradebookKeys` (with `studentFinalGrade(assignmentId)` sub-key only — the gradebook route page uses SSR loader, not TanStack Query, so `detail`/`config` keys are not needed) to `src/lib/query-keys.ts`. These are the two domains with confirmed inline-key usage. Other domains (reviews, analytics, submissions, dashboard) use route loaders or `useQuery` with factory keys already — audit and add factories only if inline keys are found.
    *   **Migrate settings components to factory keys:** Replace inline `queryKey: ['currentUser']` with `settingsKeys.currentUser()` in `ProfileSection.tsx` (line 16) and `NotificationPreferencesSection.tsx` (line 112). Replace `queryKey: ['activeSessions']` with `settingsKeys.activeSessions()` in `SessionManagement.tsx` (line 51). Replace `queryKey: ['twoFactorStatus']` with `settingsKeys.twoFactorStatus()` in `TwoFactorSettings.tsx` (line 40). Replace inline key in `AccessibilitySection.tsx` (line 11). Update all `queryClient.invalidateQueries` calls in these files to use the factory.
    *   **Fix ProfileSection missing invalidation:** `ProfileSection.tsx` `updateNameMutation` (line 36-43) has no `onSuccess`/`onSettled` invalidation — after a name update, the `['currentUser']` cache is stale and the UI shows the old name until the next refetch. Add `onSettled: () => queryClient.invalidateQueries({ queryKey: settingsKeys.currentUser() })`.
    *   **Migrate StudentFinalGradeCard to useQuery:** Replace `useState(grade)` + `useState(loading)` + `useState(error)` + `useEffect` manual fetch (lines 14-36) with `useQuery({ queryKey: gradebookKeys.studentFinalGrade(assignmentId), queryFn: ... })`. Removes manual loading/error state management. Provides cache, deduplication, and background refetch.
    *   **Migrate RecomputeGradesButton to useMutation:** Replace `useState(loading)` + inline `async` handler with try/catch/finally (lines 24-43) with `useMutation`. Add `onSuccess` to call `queryClient.invalidateQueries({ queryKey: gradebookKeys.studentFinalGrade(assignmentId) })` (refetches `StudentFinalGradeCard`'s client-side query) AND `router.invalidate()` (refetches the route's SSR loader data — the gradebook table). Both are needed because the gradebook table comes from the route loader and `StudentFinalGradeCard` fetches independently via `useQuery`. Add `onError` for toast.
    *   **Keep gradebook route's `router.invalidate()`:** The route page uses TanStack Router's SSR `loader` + `Route.useLoaderData()` (lines 16-31), not TanStack Query. `router.invalidate()` is the correct pattern for refetching SSR loader data — `queryClient.invalidateQueries` would NOT refetch route loader data. The route page's `handleSaveConfig` stays as-is. Only the sub-components (`StudentFinalGradeCard`, `RecomputeGradesButton`) are migrated to TanStack Query.
    *   **Unit tests:** Update existing tests for migrated components. Add tests verifying that `RecomputeGradesButton`'s `useMutation` `onSuccess` calls both `queryClient.invalidateQueries({ queryKey: gradebookKeys.studentFinalGrade(assignmentId) })` and `router.invalidate()`. Verify `ProfileSection` name update now triggers cache invalidation (regression test for the missing-invalidation bug).
*   **Out of Scope:**
    *   Migrating route-loader-based data fetching (dashboard, assignment detail, **gradebook route page**) to `useQuery` — these use TanStack Router's `loader` + `Route.useLoaderData()` pattern, which is a valid SSR-first approach. `router.invalidate()` is the correct refetch mechanism for SSR loader data. Only client-side `useState`/`useEffect` fetches and inline-key `useQuery` calls are in scope.
    *   Optimistic UI for gradebook mutations — deferred to a future track (the priority is cache consistency, not perceived latency).
    *   Adding factories for domains that already use `useQuery` with factory keys correctly (notifications, consultations, extensions, assignments, users, templates, discussions — these are already migrated per TRACK-014).
    *   Any backend/server-function changes — all server stubs and handlers are unchanged.
    *   i18n changes — no new user-visible strings.

#### High-Level Execution Vectors
*   **Phase 1 (Query-key factory completion + settings migration):** Add `settingsKeys` and `gradebookKeys` to `src/lib/query-keys.ts` following the existing factory pattern. Migrate all 5 settings components from inline string-array keys to factory calls. Fix the `ProfileSection` missing-invalidation bug by adding `onSettled` invalidation. Update all `queryClient.invalidateQueries` calls in settings components to use factory keys. Update existing unit tests for settings components to mock the factory. Verify: `pnpm typecheck` clean, `pnpm test:unit` passes, `pnpm lint` clean, grep for inline `['currentUser']`/`['activeSessions']`/`['twoFactorStatus']` returns zero matches in `src/components/settings/`.
*   **Phase 2 (Gradebook TanStack Query migration):** Migrate `StudentFinalGradeCard.tsx` from `useState`+`useEffect` to `useQuery` with `gradebookKeys.studentFinalGrade(assignmentId)`. Migrate `RecomputeGradesButton.tsx` from `useState`+`async` to `useMutation` with `onSuccess` calling both `queryClient.invalidateQueries({ queryKey: gradebookKeys.studentFinalGrade(assignmentId) })` and `router.invalidate()` (the route's SSR loader data must be refetched via `router.invalidate()`, not TanStack Query). The route page's `handleSaveConfig` stays as-is — `router.invalidate()` is correct for SSR loader data. Update existing gradebook tests (`tests/unit/components/student-final-grade-card.test.tsx`, `tests/unit/routes/instructor-gradebook.test.tsx`) to use `QueryClientProvider` wrapper pattern. Verify: `pnpm typecheck` clean, `pnpm test:unit` passes, `pnpm test:coverage` ≥80%, `RecomputeGradesButton` uses `useMutation` with dual invalidation (query cache + router).
*   **Phase 3 (Audit + verification):** Grep the entire `src/` directory for remaining inline query key patterns (`queryKey: ['` in `.tsx` files). Migrate any found to factory calls or document why they're intentionally inline (e.g., one-off queries). Run full quality gate: `pnpm typecheck`, `pnpm test:coverage`, `pnpm lint`, `pnpm check:i18n`. Verify: zero inline string-array query keys in `src/components/` (excluding factory file itself), all mutations have `onSettled`/`onSuccess` invalidation using factory keys.

#### Verification & Definition of Done (DoD)
*   [ ] **Manual Checkpoint:** Open `/student/assignments/$id` — the `StudentFinalGradeCard` loads with a skeleton, then shows the grade. Navigate away and back — the cached grade appears instantly (no refetch spinner) if within `staleTime`. Open `/instructor/assignments/$id/gradebook` — the gradebook table loads via SSR. Admin changes grade config (scheme/weights) → saves → `router.invalidate()` refetches the route loader data and the gradebook table updates. Admin clicks "Recompute All Grades" → the recompute succeeds → `router.invalidate()` refetches the gradebook table AND `queryClient.invalidateQueries` refetches any visible `StudentFinalGradeCard` components. Open `/settings` → edit profile name → save → the name updates in the UI immediately (no stale display — regression test for the missing-invalidation bug). Toggle a notification preference → the preference persists after reload. Enable/disable 2FA → the status card updates immediately.
*   [ ] **Automated Tests:** `pnpm test:unit` — all tests pass. Updated tests for: `StudentFinalGradeCard` (renders with `useQuery` wrapper, shows skeleton while loading, shows grade on success, shows error state on failure), `RecomputeGradesButton` (calls `useMutation`, `onSuccess` calls both `queryClient.invalidateQueries(gradebookKeys.studentFinalGrade)` and `router.invalidate()`, shows error toast on failure). Route page `handleSaveConfig` unchanged (still uses `router.invalidate()` — correct for SSR loader data). `ProfileSection` (name update triggers `settingsKeys.currentUser()` invalidation). `pnpm test:coverage` ≥80% on all thresholds. `pnpm typecheck` clean. `pnpm lint` — 0 warnings, 0 errors. `pnpm check:i18n` — parity maintained.
*   [ ] **Conductor Review:** `src/lib/query-keys.ts` has `settingsKeys` and `gradebookKeys` factories following the existing pattern (nested sub-keys, `as const` return types). `gradebookKeys` has only `studentFinalGrade(assignmentId)` (no `detail`/`config` — route uses SSR loader). Zero inline string-array query keys in `src/components/settings/` (grep `queryKey: \['` returns no matches). Zero `useState`/`useEffect` manual-fetch patterns in `src/components/gradebook/` (grep `useEffect` in gradebook returns no matches in data-fetching context). `$id.gradebook.tsx` route keeps `router.invalidate()` (correct for SSR loader data — route uses `Route.useLoaderData()`, not TanStack Query). `RecomputeGradesButton` `useMutation` `onSuccess` calls both `queryClient.invalidateQueries(gradebookKeys.studentFinalGrade)` and `router.invalidate()`. `ProfileSection` `updateNameMutation` has `onSettled` invalidation. All files under 500 lines. `pnpm typecheck`, `pnpm lint`, `pnpm check:i18n` pass. Pre-push gate (`pnpm typecheck` && `pnpm vitest run --coverage`) passes.

---

### TRACK-030: NotificationCenter Infinite Query Migration

*   **Status:** `Pending`
*   **Dependencies:** TRACK-014 (query-key factory — `notificationKeys`), TRACK-012 (Notifications & File Management UX — introduced the "Load More" pagination pattern). Can be implemented independently of TRACK-029.
*   **Estimated Effort:** 1 Day / 0.5 Sprint Loops
*   **Audit IDs:** None (architectural consistency / tech-debt remediation)

#### Context Anchors (Traceability)
*   **PRD Reference:** `docs/PRD.md` — In-App Notification System (notification center with All/Unread tabs, grouped notifications, "Load More" pagination)
*   **TDD Reference:** `src/hooks/use-notifications.ts:36-58` (`useNotificationsList` — uses `useQuery` with `notificationKeys.list({ page, limit, type, unreadOnly })`, `staleTime: 30_000`), `src/components/notifications/NotificationCenter.tsx:47-71` (manual accumulation: `useState<Notification[]>([])` + `useEffect` that appends items across pages with `Set`-based dedup — lines 56-67, `hasMore` derived from `items.length < total` on line 71), `src/hooks/use-notifications.ts:60-116` (`useMarkRead` — optimistic `onMutate`/`onError`/`onSettled` with `notificationKeys.all()` invalidation), `src/hooks/use-notifications.ts:118-172` (`useMarkAllRead` — same optimistic pattern)
*   **Product Spec Reference:** `conductor/archive/notifications-file-management-ux_20260720/spec.md` (TRACK-012 — FR-4: "Load More" pagination), `conductor/archive/optimistic-ui-updates_20260722/spec.md` (TRACK-014 — optimistic `markRead`/`markAllRead` mutations with `notificationKeys` factory)

#### Track Tech Stack
*   TanStack Query (`@tanstack/react-query`) — `useInfiniteQuery`. Already installed, no new dependency.
*   Existing `listNotifications` server function — already returns `{ items, total }` with `page`/`limit` params. Already structured for infinite query (no backend changes needed — `getNextPageParam` derives `page` from `total` and current `items` count).
*   No new dependencies, no schema migrations, no i18n keys, no backend changes.

#### Scope Boundaries
*   **In Scope:**
    *   **Convert `useNotificationsList` to `useInfiniteQuery`:** Replace `useQuery` (with `page` param) in `src/hooks/use-notifications.ts` with `useInfiniteQuery`. The `queryKey` uses `notificationKeys.list({ limit, type, unreadOnly })` (no `page` — `useInfiniteQuery` manages page tracking via `pageParam`/`getNextPageParam`). `getNextPageParam` returns the next page number when `total > accumulated items count`, or `undefined` when all pages are loaded. `initialPageParam: 1`.
    *   **Refactor `NotificationCenter` component:** Remove the manual accumulation `useState<Notification[]>(allItems)` (line 47) and the `useEffect` append/dedup logic (lines 56-67). Replace with `data.pages.flatMap(page => page.items)` to flatten the infinite query's pages into a single array. Replace `setCurrentPage((p) => p + 1)` "Load More" button (line 166) with `fetchNextPage()`. Use `isFetching` for the Load More button spinner, `hasNextPage` for button visibility, and `isFetchingNextPage` for the load-more-specific loading state.
    *   **Rewrite optimistic mutation callbacks for infinite query shape:** The existing `useMarkRead` and `useMarkAllRead` optimistic mutations (lines 60-172) use `queryClient.setQueriesData` with a callback that checks `'items' in old` — this matches the `useQuery` data shape (`{ items, total }`) but NOT the `useInfiniteQuery` shape (`{ pages: Array<{ items, total }>, pageParams: number[] }`). The `'items' in old` check silently falls through to `return old` (no-op), breaking the optimistic update. Rewrite both callbacks to check `'pages' in old` and map over `old.pages` to update `items` within each page. The `typeof old === 'number'` check (for `useUnreadCount` — still uses `useQuery`) is preserved unchanged. The `onSettled` `invalidateQueries({ queryKey: notificationKeys.all() })` works unchanged.
    *   **Update `notificationKeys.list` factory:** Remove `page` from the factory's `list` filter type signature. The current factory accepts `{ page?, limit?, type?, unreadOnly? }` — with `useInfiniteQuery`, `page` is managed by `pageParam` and should not be part of the cache key (all pages of the same filter share one cache entry). This is a breaking API change to the factory type signature, which is intentional — it forces any callers passing `page` to migrate.
    *   **Unit tests:** Update `tests/unit/hooks/use-notifications.test.tsx` and `tests/unit/components/notification-center.test.tsx` to use `useInfiniteQuery` mock pattern. Verify: initial page loads, "Load More" fetches next page, accumulated items include all pages, `hasNextPage` is `false` when all items loaded, optimistic `markRead`/`markAllRead` still updates items across pages, invalidation refetches all pages.
*   **Out of Scope:**
    *   Cursor-based pagination — the server function uses offset pagination (`page`/`limit`). `useInfiniteQuery` works with offset pagination via `pageParam`. Migrating to cursor-based is a separate backend concern (deferred per TRACK-006 v2 note).
    *   Changing the `staleTime` or `refetchInterval` — the existing `staleTime: 30_000` and `refetchInterval: 30_000` (on `useUnreadCount`) are preserved.
    *   Notification grouping logic (`GROUP_CONFIGS` in `NotificationCenter.tsx`) — unchanged. The grouping operates on the flattened items array, which is the same regardless of pagination mechanism.
    *   Any UI/UX changes to the notification center layout — this is a pure internal refactor (same user-visible behavior, better state management).

#### High-Level Execution Vectors
*   **Phase 1 (Hook conversion):** Convert `useNotificationsList` in `src/hooks/use-notifications.ts` from `useQuery` to `useInfiniteQuery`. Set `initialPageParam: 1`, `getNextPageParam: (lastPage, allPages) => { const totalItems = allPages.reduce((sum, p) => sum + p.items.length, 0); return totalItems < lastPage.total ? allPages.length + 1 : undefined; }`. Update the query key to exclude `page` (the page is managed by `pageParam`). Keep `staleTime: 30_000`. Verify: hook compiles, `data.pages` is an array of `{ items, total }`, `fetchNextPage` is available, `hasNextPage` and `isFetchingNextPage` are derived correctly.
*   **Phase 2 (Component refactor):** Refactor `NotificationCenter.tsx` — remove `allItems` state and the `useEffect` accumulation. Compute `items` via `data?.pages.flatMap(p => p.items) ?? []`. Compute `total` via `data?.pages[0]?.total ?? 0`. Replace `setCurrentPage((p) => p + 1)` with `fetchNextPage()`. Replace `hasMore` with `hasNextPage`. Replace `isFetching` on the Load More button with `isFetchingNextPage`. Verify: component renders identical UI, Load More fetches the next page, accumulated items include all fetched pages, navigating away and back preserves cached pages (no refetch of already-loaded pages within `staleTime`).
*   **Phase 3 (Optimistic mutation rewrite + tests):** Rewrite `useMarkRead` and `useMarkAllRead` `onMutate` `setQueriesData` callbacks to handle the `useInfiniteQuery` data shape. Replace the `'items' in old` check with `'pages' in old`, then map over `old.pages` to update `items` within each page. The `typeof old === 'number'` check (for `useUnreadCount`) stays unchanged. Update unit tests to mock `useInfiniteQuery` and verify: pages accumulate, Load More triggers `fetchNextPage`, optimistic `markRead` updates the correct item across all pages (not just the first), `onError` rolls back the entire `{ pages, pageParams }` structure, `onSettled` invalidation refetches all pages. Verify: `pnpm typecheck`, `pnpm test:unit`, `pnpm test:coverage` ≥80%, `pnpm lint`.

#### Verification & Definition of Done (DoD)
*   [ ] **Manual Checkpoint:** Open the NotificationCenter (bell icon) — notifications load on page 1. Click "Load More" — the next page loads and appends to the existing list (no flicker, no duplicate items). Click "Mark All Read" — all visible items across all loaded pages transition to read state immediately (optimistic). Navigate away and reopen the NotificationCenter — previously loaded pages are cached (instant render within `staleTime`), and the scroll position is at the top (acceptable — scroll restoration is out of scope). Toggle between "All" and "Unread" tabs — the infinite query resets to page 1 for the new filter. Verify no console errors during any of these actions.
*   [ ] **Automated Tests:** `pnpm test:unit` — all tests pass. Updated tests for: `useNotificationsList` (returns `useInfiniteQuery` with correct `queryKey`, `initialPageParam: 1`, `getNextPageParam` returns next page when `total > accumulated`, returns `undefined` when all loaded), `NotificationCenter` (renders page 1 items, "Load More" calls `fetchNextPage`, accumulated items include all pages, `hasNextPage` controls Load More visibility, `isFetchingNextPage` shows spinner on Load More button only), `useMarkRead`/`useMarkAllRead` (optimistic `setQueriesData` updates items in the infinite query page structure, `onError` rolls back, `onSettled` invalidates). `pnpm test:coverage` ≥80%. `pnpm typecheck` clean. `pnpm lint` clean. `pnpm check:i18n` parity maintained.
*   [ ] **Conductor Review:** `useNotificationsList` uses `useInfiniteQuery` (not `useQuery`). `NotificationCenter.tsx` has no `useState` for items accumulation and no `useEffect` for append/dedup (grep `allItems` and `existingIds` returns zero matches). `items` is computed via `data?.pages.flatMap(...)` (not `useState`). Load More button calls `fetchNextPage()` (not `setCurrentPage`). `hasNextPage` and `isFetchingNextPage` are used (not manually computed `hasMore`). `useMarkRead`/`useMarkAllRead` `onMutate` `setQueriesData` callback checks `'pages' in old` (not `'items' in old`) and maps over `old.pages` to update items within each page. The `typeof old === 'number'` check for `useUnreadCount` is preserved. `notificationKeys.list` factory type signature no longer accepts `page` (managed by `pageParam`). All files under 500 lines. `pnpm typecheck`, `pnpm lint`, `pnpm check:i18n` pass. Pre-push gate passes.

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
├── TRACK-022: User Notification Preferences [Complete — archived]
├── TRACK-023: At-Risk Student Identification [Complete — archived]
├── TRACK-025: Gradebook & Final Grade Computation [depends on 020 — aggregates review_scores]
└── TRACK-026: Checkpoint Discussion / Q&A Threads [Complete — archived]

Milestone 7: Infrastructure & Tooling
└── TRACK-024: TypeScript 7 Upgrade [Complete — archived]

Milestone 8: E2E Coverage Expansion
├── TRACK-027: Critical Business Flow E2E Coverage [Complete — archived]
└── TRACK-028: E2E Breadth & Infrastructure Expansion [depends on E2E-FEAT-001, recommended after 027]

Milestone 9: Client Architecture Consistency
├── TRACK-029: Query-Key Factory Completion & Client Data-Fetching Consistency [depends on 014 — extends query-key factory]
└── TRACK-030: NotificationCenter Infinite Query Migration [depends on 014 — notificationKeys factory]
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
| **K** | TRACK-022 | Complete — extends existing `users.settings` JSONB + `enqueueEventEmail` chokepoint + 12 notification sites with per-type per-channel preference gating. Implemented alongside TRACK-021 so `deadline_reminder` type respects user prefs from day one (complete — archived) |
| **L** | TRACK-023 | Independent — new risk-scoring module + dashboard widget + event-driven alerts at `submitReviewHandler`. No file overlap with TRACK-020/021/022 (different domain: risk identification vs grading/reminders/preferences). Complementary to TRACK-021 (event-driven catches discrete risk moments, scanner catches time-based risk). Minor overlap with TRACK-022 on notification type registry — coordinate if parallelized (complete — archived) |
| **M** | TRACK-024 | Fully independent — only touches `tsconfig.json` and `package.json`, no feature file overlap (complete — archived) |
| **N** | TRACK-025 | Depends on TRACK-020 (complete) — extends `review_scores` data and analytics export infrastructure. No file overlap with TRACK-023 (different domain: grade computation vs risk scoring). Minor overlap with analytics dashboards — coordinate if parallelized with TRACK-023 admin analytics extension |
| **O** | TRACK-026 | Complete — new domain (discussions), extended notification infrastructure (TRACK-022) and email queue (TRACK-018). No file overlap with TRACK-025 (different domain: discussions vs grading). Archived |
| **P** | TRACK-027 → TRACK-028 | TRACK-027 complete (archived) — expanded seed data (student2, student3, consultation seed) + decoupled instructor-review tests + 3 new specs + notification/upload/negative test assertions. TRACK-028 builds on this expanded seed data and decoupled patterns. No file overlap with feature tracks (TRACK-025/026) — only touches `tests/e2e/`, `scripts/seed-e2e.ts`, and `playwright.config.ts` |
| **Q** | TRACK-029, TRACK-030 | Independent of each other — TRACK-029 touches `query-keys.ts` + settings + gradebook components; TRACK-030 touches `use-notifications.ts` + `NotificationCenter.tsx`. Both depend on TRACK-014 (complete — query-key factory). No file overlap with E2E tracks (TRACK-027/028 — different domain: client data-fetching vs e2e tests). Minor overlap with gradebook feature (TRACK-025 — complete) on gradebook component files |

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
| **Total** | **31** | **~107 Days** |

> Effort estimates assume a single developer. Tracks within the same parallelization group can be distributed across developers to reduce wall-clock time.

---

## Adding New Tracks

New tracks follow a two-phase lifecycle in this document:

1. **Planned/Active** — Add a full-detail entry under the appropriate milestone (status, audit IDs, deps, decisions, scope, execution vectors, DoD). Scaffold via `conductor_new_track` which creates `conductor/tracks/<track_id>/spec.md` + `plan.md`.
2. **Complete** — On archival to `conductor/archive/<track_id>_<date>/`, collapse the entry to an index row: status badge, audit IDs, deps, one-line decision summary, archive link. The archive's `spec.md` and `plan.md` become the single source of truth for full detail.

This keeps the roadmap scannable — new tracks add ~5 lines as index entries, not ~50–100 lines of duplicated detail.
