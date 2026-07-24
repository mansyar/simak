# Track: At-Risk Student Identification & Early Warning System

## Overview

TRACK-023 introduces an at-risk student identification and early warning system for SIMAK. The system computes a risk score for each student based on 5 signals derived from existing checkpoint, consultation, submission, and review data. Risk scores are ephemeral — computed on-demand for the instructor dashboard, at event time for alerts, and via TRACK-021's hourly scanner — never persisted to the database.

When a student's risk level reaches medium or high, the system fires an in-app notification and email to the student's instructor. Alerts are deduplicated via a 7-day window per student+assignment pair.

Risk scoring is integrated into three surfaces:
1. **Instructor dashboard** (on-demand) — shows at-risk students sorted by severity
2. **Event-driven alerts** — fired post-commit from `submitReviewHandler` (on revise decision or SLA breach) for signals 1/4/5
3. **TRACK-021 hourly scanner** — `checkAndFireRiskAlert` called from `processDeadlineReminders()` for signals 2 & 3 (time-based: approaching deadlines, insufficient consultations)

Admin analytics shows aggregate at-risk counts (no drill-down).

## Track Type
Feature

## Dependencies
- None (complementary to TRACK-021 — event-driven alerts catch discrete risk moments at review time; TRACK-021's scanner catches time-based risk. TRACK-021 is ✅ Complete, so scanner integration is included in this track's scope.)

## Context Anchors

* **PRD Reference:** `docs/PRD.md#checkpoints--submissions` (checkpoint lifecycle, review workflow — the domain where at-risk identification applies), `docs/PRD.md#analytics--reporting` (instructor/admin analytics — extension point for at-risk aggregate)
* **TDD Reference:** `docs/TDD.md` `checkpoints` table (`src/db/schema/assignments.ts:77` — `state`, `dueDate`, `minConsultations`, `studentId`), `assignment_students` join table (`src/db/schema/assignments.ts:56`), `consultations` table (`src/db/schema/consultations.ts` — `status`, `checkpointId` for verified count), `reviews` table (`src/db/schema/submissions.ts` — `decision` for revise count), `submissions` table (`src/db/schema/submissions.ts` — `uploadedAt` for wait time); `src/server/dashboard-instructor.server.ts:53-255` (`getInstructorDashboardDataHandler` — extension point), `src/lib/review-sla.ts:72-130` (`dispatchSLABreachNotifications` — existing pattern for advisory batch notification + email dispatch), `src/server/reviews.server.ts:220` (`submitReviewHandler` — event site for revise-triggered risk alert), `src/server/analytics-admin.server.ts` (`getAdminAnalyticsDataHandler` — extension point for aggregate at-risk counts), `src/components/notifications/NotificationCenter.tsx:15-36` (`GROUP_CONFIGS` — 4 groups, `student_at_risk` fits in `system` group), `src/lib/deadline-reminder-scanner.ts` (TRACK-021's scanner — integration point for time-based signals 2 & 3)

## Track Tech Stack

* Drizzle ORM — NO new tables, NO migration. All risk signals are computed from existing data. Risk score is ephemeral — never persisted.
* New shared module: `src/lib/risk-scoring.ts` — pure functions, no DB access. Exports `computeStudentRisk(data: StudentRiskInput): RiskAssessment` and types (`RiskLevel`, `RiskFactor`, `RiskCategory`).
* New shared module: `src/lib/risk-alerts.ts` — `checkAndFireRiskAlert(db, opts)`: fetches student checkpoint data, calls `computeStudentRisk`, checks 7-day dedup, fires in-app notification + email. Advisory (try/catch).
* Existing file extension: `src/server/dashboard-instructor.server.ts` — add at-risk student list to response.
* Existing file extension: `src/server/analytics-admin.server.ts` — add aggregate at-risk counts.
* Existing file extension: `src/server/reviews.server.ts` `submitReviewHandler` — post-commit `checkAndFireRiskAlert` call on revise/SLA breach.
* Existing file extension: `src/lib/deadline-reminder-scanner.ts` (TRACK-021) — call `checkAndFireRiskAlert` for students with approaching deadlines (signals 2 & 3 coverage).
* shadcn/ui components — `Badge`, `Card`/`CardHeader`/`CardContent`, `Tooltip`.
* Email infrastructure reuse: `enqueueEventEmail`, `resolveEmailRecipient`, `getNotificationKeys`, `STRINGS` + internal helpers in `email-templates.ts`.
* `email_queue.templateType` Drizzle text enum — adding `'student_at_risk'` is code-only, no `ALTER TYPE`.
* i18n codegen — new notification keys + email subject key in both locales.

## Functional Requirements

### FR-1: Risk Scoring Engine
- New `src/lib/risk-scoring.ts` — pure function `computeStudentRisk(data): RiskAssessment`.
- Takes per-checkpoint data (state, dueDate, minConsultations, verifiedConsultationCount, submissionCount, latestSubmissionDate, reviseCount, underReviewWaitDays) and returns `{ level, factors }`.
- Overall level = highest severity among active factors.
- Each `RiskFactor` has `{ type, severity, category, checkpointId, description }`.
- Category: signals 1-4 = `'student_inaction'`, signal 5 = `'pending_review'`.

### FR-2: Five Risk Signals (Thresholds)
1. **Overdue checkpoint** (High, student_inaction): `state IN ('unlocked','revise') AND dueDate < NOW()`
2. **Approaching deadline, no submission** (Medium, student_inaction): `state = 'unlocked' AND dueDate <= NOW()+3d AND submissionCount = 0`
3. **Insufficient consultations, deadline approaching** (Medium, student_inaction): `verifiedConsultations < minConsultations AND dueDate <= NOW()+7d`
4. **Repeated revise** (Medium, student_inaction): `reviseCount >= 2` for the same checkpoint
5. **Stalled — submitted but not reviewed beyond SLA** (Low, pending_review): `state = 'under_review' AND NOW()-latestSubmissionDate > 3 days`

### FR-3: Instructor Dashboard Integration
- Extend `getInstructorDashboardDataHandler` with `atRiskStudents` array.
- Batch query joining checkpoints + assignments + assignment_students + users + consultations + submissions + reviews.
- Filter to states `('unlocked', 'revise', 'under_review', 'submitted')` (skip `passed`/`locked`).
- Return students with risk level ≥ low, sorted by severity (high → medium → low).
- Each entry: `{ studentName, studentId, assignmentTitle, assignmentId, riskLevel, factors[] }`.

### FR-4: Event-Driven Alerts
- New `src/lib/risk-alerts.ts` exporting `checkAndFireRiskAlert(db, opts)`.
- Called from `submitReviewHandler` post-commit (advisory, try/catch) when `decision === 'revise'` OR SLA breach occurred.
- Fires alert if level is medium or high.
- Dedup: query `notifications` table for existing `type = 'student_at_risk'` for this `studentId` + `assignmentId` in last 7 days. If exists, skip.
- Uses `Promise.allSettled` for parallel in-app notification insert + email enqueue.

### FR-5: TRACK-021 Scanner Integration
- Extend `processDeadlineReminders()` in `src/lib/deadline-reminder-scanner.ts` to call `checkAndFireRiskAlert` for students with approaching deadlines.
- Covers signals 2 (approaching deadline, no submission) and 3 (insufficient consultations, deadline approaching) for event-driven alert coverage.
- For each student-checkpoint the scanner processes, also call `checkAndFireRiskAlert` to compute full risk (catches all 5 signals, not just 2 & 3).
- 7-day dedup prevents alert fatigue.

### FR-6: Admin Analytics Extension
- Extend `getAdminAnalyticsDataHandler` with `atRiskSummary: { high: number, medium: number, low: number }`.
- Counts distinct students matching each risk level across all active assignments.
- Uses simplified SQL (COUNT DISTINCT per signal criteria — no per-student risk function call).
- No drill-down to individual students.

### FR-7: Dashboard Widget (UI)
- New component on instructor dashboard.
- Risk-level `Badge` (yellow/orange/red), student name, assignment title, factor count + descriptions, link to `/instructor/assignments/${assignmentId}`.
- Sorted by severity. Empty state: "No students at risk" (reuses `EmptyState`).

### FR-8: Notification Type
- New `student_at_risk` type — target: instructor.
- Route: `/instructor/assignments/${meta.assignmentId}` (extended in `notification-routes.ts`).
- Params: `studentName`, `assignmentTitle`, `riskLevel`, `riskFactors` (comma-separated).
- Added to `system` group in `GROUP_CONFIGS`.

### FR-9: Email Template
- New `buildStudentAtRiskHtml` in `email-templates.ts` — internal helpers + `STRINGS` object.
- Shows student name, assignment title, risk level, factor descriptions, CTA link.
- New `src/lib/at-risk-email.ts` wrapper (`sendStudentAtRiskEmail` calling `enqueueEventEmail`).
- Add `'student_at_risk'` to `templateType` array in `email-queue.ts` (code-only).

### FR-10: i18n Keys
- `notifications.events.student_at_risk.title`/`.message`, `emails.subjects.studentAtRisk`, `dashboard.atRisk.title`/`.empty`/`.factorCount`, per-factor descriptions, `analytics.atRiskSummary`.
- Added to both locales, run `pnpm generate:i18n`.

## Non-Functional Requirements

- **No new DB tables or migrations.** All risk computed from existing data.
- **Risk score is ephemeral.** Never persisted — computed on-demand.
- **Pure function.** `computeStudentRisk` has no DB access, no side effects — unit-testable in isolation.
- **Advisory alerts.** `checkAndFireRiskAlert` uses try/catch, post-commit, never affects review transaction.
- **File limit.** All files under 500 lines.
- **i18n.** All new user-visible strings in both locales.
- **Coverage.** ≥80% on lines, statements, branches, and functions.

## Acceptance Criteria

1. `computeStudentRisk` correctly detects all 5 signals in isolation.
2. Overall risk level is the highest severity among active factors.
3. Multiple active factors are aggregated and all listed.
4. A no-risk student returns `level: 'low'` with empty `factors[]`.
5. Category labeling: signals 1-4 = `'student_inaction'`, signal 5 = `'pending_review'`.
6. Instructor dashboard shows at-risk students sorted by severity (high first).
7. `passed`/`locked` checkpoints are excluded from risk computation.
8. A `revise` review triggers an alert if risk is medium/high.
9. A `pass` review does NOT trigger an alert.
10. SLA breach triggers an alert (if medium/high).
11. 7-day dedup prevents duplicate alerts for the same student+assignment.
12. TRACK-021 scanner fires alerts for signals 2 & 3.
13. Admin analytics shows aggregate at-risk counts.
14. `student_at_risk` notifications are clickable (navigate to assignment detail).
15. `sla_breach` notifications still go to admins only (unchanged).
16. `student_at_risk` notifications go to instructors only.
17. Email renders correctly in both EN and ID locales.
18. i18n parity maintained (`pnpm check:i18n`).
19. `pnpm typecheck`, `pnpm lint`, `pnpm test:coverage` all pass.

## Out of Scope

- Risk history/trend tracking (deferred to v2 — would require `risk_assessments` table).
- Student-facing risk view (students don't see their own risk score; v2 could add constructive view).
- Automated interventions (no auto-extending deadlines, no auto-scheduling consultations).
- Inline actions in at-risk widget (no "extend deadline" or "message student" buttons).
- Admin drill-down to individual at-risk students (v1 is aggregate counts only).
- Risk-based prioritization of TRACK-021 deadline reminders (v2).
