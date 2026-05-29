# Specification: Estimated Duration & Auto-Calculated DueDates

## Overview

Add `estimated_duration` (days) to `template_checkpoints`. During assignment creation, auto-calculate each checkpoint's `dueDate` as `baseDate + cumulative durations`. Instructors can override calculated dates before finalizing. Validate sequential ordering (CP1 < CP2 < CP3) and reject past dates.

**Dependencies:** V1 database foundation, Track 1.1 (audit log — already wired in `createAssignmentHandler`).

---

## Database Schema Changes

### Modified: `template_checkpoints` (add column)

| Column               | Type    | Default | Notes                                           |
| -------------------- | ------- | ------- | ----------------------------------------------- |
| `estimated_duration` | integer | 0       | Days allotted for this checkpoint. 0 = same-day |

### No change to `checkpoints`

`dueDate` column already exists (nullable timestamp). We stop inserting NULL and start calculating real dates.

---

## Functional Requirements

### FR1: Template Admin UI — Duration Input

The template checkpoint form (CheckpointListEditor) gains an `estimated_duration` input per row:

- Type: integer number input
- Min: 0 (same-day due)
- Default: 7
- Label: "Estimated Duration (days)"
- i18n: translation keys added

### FR2: Assignment Creation — Auto-Calculated DueDates

In `createAssignmentHandler`, when instantiating checkpoints:

1. Fetch `estimated_duration` from `template_checkpoints` (alongside existing `name`, `order`, `minConsultations`)
2. Calculate each checkpoint's `dueDate` as:
   - CP1: `assignment.createdAt + (CP1.estimated_duration days)`
   - CP2: `assignment.createdAt + (CP1.estimated_duration + CP2.estimated_duration days)`
   - CPn: `assignment.createdAt + Σ(CP1..CPn.estimated_duration) days`
3. If `estimated_duration = 0`, the dueDate equals the base date (or previous checkpoint's dueDate if subsequent)
4. Store the calculated `dueDate` in the `checkpoints` row (no longer NULL)

### FR3: Instructor Override

In the assignment creation wizard, after template selection, show a "Due Dates" preview step:

- Display each checkpoint name + calculated dueDate
- Instructor can edit any dueDate before finalizing
- Overrides persist through to the server

### FR4: Server-Side Validation

`createAssignmentHandler` validates:

- **Sequential ordering:** CP1.dueDate < CP2.dueDate < CP3.dueDate
- **No past dueDates:** dueDate must be >= today at time of creation

### FR5: Backfill Migration

A migration sequence:

1. Adds `estimated_duration` column to `template_checkpoints`
2. Backfills existing templates: all existing `template_checkpoints` get `estimated_duration = 14`
3. Backfills existing assignments: for each `checkpoint` where `dueDate IS NULL`, calculate retroactively:
   - `dueDate = assignment.createdAt + cumulative estimated_duration from template`
   - Uses the template's checkpoint ordering to reconstruct durations
   - Falls back to 14 days per checkpoint if template no longer exists

### FR6: Audit Log

No change needed — `logAuditEvent` is already called in `createAssignmentHandler` after successful transaction.

### FR7: Existing Features Affected

- **Student dashboard** "Upcoming Deadlines" widget: now shows all checkpoints (previously filtered by `IS NOT NULL`)
- **SLA breach** `adjustDeadlinesForBreach`: now operates on real dates instead of NULL
- **Student assignment detail** page: shows real dueDates on checkpoint timeline
- **Existing `extendDeadlineHandler`:** reused as-is for post-creation adjustments (no new handler)

---

## Acceptance Criteria

- [ ] Template checkpoint form shows `estimated_duration` input (integer, min 0, default 7)
- [ ] Assignment creation calculates `dueDate` as `assignment.createdAt + Σ(durations)` per checkpoint
- [ ] Instructor can override any calculated `dueDate` before finalizing
- [ ] Server-side validation rejects out-of-order dueDates (CP3 due before CP1)
- [ ] Server-side validation rejects past dueDates
- [ ] Existing `extendDeadlineHandler` is reused for post-creation adjustments
- [ ] `createAssignmentHandler` writes `assignment.created` audit log entry (already done)
- [ ] Student assignment detail page shows real dueDates on all checkpoints
- [ ] Student dashboard "Upcoming Deadlines" widget shows all checkpoints
- [ ] SLA breach `adjustDeadlinesForBreach` operates on real dates
- [ ] Migration adds `estimated_duration` column + backfills existing templates (14 days) and assignments (reconstructed from template)
- [ ] i18n translations for duration labels and UI

---

## Test Plan

| Area                  | Approach                                                                |
| --------------------- | ----------------------------------------------------------------------- |
| Duration calculation  | Unit test — `baseDate + cumulative durations` for 3 checkpoints         |
| Assignment creation   | Unit test — handler inserts dueDates matching template durations        |
| Sequential validation | Unit test — rejects out-of-order, accepts valid order                   |
| Override flow         | Unit test — instructor override persists after creation                 |
| Audit log wiring      | Unit test — `createAssignmentHandler` writes `assignment.created` entry |
| Backfill migration    | Manual verification on dev DB                                           |
| Existing regression   | Full test suite must pass (no regressions)                              |

---

## Out of Scope

- Deadline extension workflow (Track 1.3)
- Group assignments (Track 2.1)
- Email notifications for deadline updates (Track 4.1)
- Dashboard analytics charts (Track 5.1)
