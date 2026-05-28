# Implementation Plan: Eliminate `any` Type Usage

## Phase 1: Shared Types + ESLint Config [checkpoint: 23f7a9d]

**Objective:** Create the foundation — shared types file and update ESLint config.

- [x] Task: Create `src/lib/types.ts` with shared type utilities
  - [ ] Define `NonNullableSession` type (non-null session shape: `{ user: { id: string; role: string }; session: { id: string; token: string; expiresAt: Date } }`)
  - [ ] Define `ServerFnArgs` generic type `ServerFnArgs<T = unknown> = { data: T }` for stub handlers
  - [ ] Export types for use across all server files
- [x] Task: Update ESLint config to add `tests/**` and `scripts/**` to ignores
  - [x] Add `'tests/**'`, `'scripts/**'` to the ignores array in `eslint.config.js`
- [x] Task: Verify foundation compiles
  - [x] Run `pnpm typecheck` — must pass
  - [x] Run `pnpm lint` — must pass
- [x] Task: Conductor — User Manual Verification 'Phase 1: Shared Types + ESLint Config' (Protocol in workflow.md)

## Phase 2: Fix `.server.ts` Files — Session Type Guards [checkpoint: 00b7787]

**Objective:** Replace `session: any` with the shared `NonNullableSession` type in all server handler files.

- [x] Task: Fix `src/server/submissions.server.ts` — `isStudent(session: any)` → use `NonNullableSession`
- [x] Task: Fix `src/server/files.server.ts` — `isStudent(session: any)` → use `NonNullableSession`
- [x] Task: Fix `src/server/consultations.server.ts` — `isStudent(session: any)` → use `NonNullableSession`
- [x] Task: Fix `src/server/reviews.server.ts` — `isInstructor(session: any)` → use `NonNullableSession`
- [x] Task: Fix `src/server/reviews-extras.server.ts` — `isInstructor(session: any)` → use `NonNullableSession`
- [x] Task: Fix `src/server/assignments.server.ts` — session type guard → use `NonNullableSession`
- [x] Task: Fix `src/server/assignments-extras.server.ts` — `isInstructor(session: any)` → use `NonNullableSession`
- [x] Task: Fix `src/server/templates.server.ts` — `isAdmin(session: any)` → use `NonNullableSession`
- [x] Task: Fix `src/server/notifications.server.ts` — `isAdmin(session: any)` → use `NonNullableSession`
- [x] Task: Fix `src/server/dashboard-admin.server.ts` — `isAdmin(session: any)` → use `NonNullableSession`
- [x] Task: Fix `src/server/dashboard-student.server.ts` — `isStudent(session: any)` → use `NonNullableSession`
- [x] Task: Fix `src/server/dashboard-instructor.server.ts` — `isInstructor(session: any)` → use `NonNullableSession`
- [x] Task: Fix `src/lib/review-sla.ts` — `tx: any, db: any` → use proper types from `drizzle-orm`
- [x] Task: Verify all changes compile
  - [x] Run `pnpm typecheck` — must pass
  - [x] Run `pnpm test` — must pass
- [x] Task: Conductor — User Manual Verification 'Phase 2: Fix .server.ts Type Guards' (Protocol in workflow.md)

## Phase 3: Fix Server Stub Files — `args: { data: any }` [checkpoint: 79028fd]

**Objective:** Replace `args: { data: any }` with `args: { data: unknown }` in all `createServerFn` stubs.

- [x] Task: Fix `src/server/users.ts` — 6 stubs (`listUsers`, `getUser`, `createUser`, `updateUser`, `deleteUser`, `generateSetupLink`)
- [x] Task: Fix `src/server/templates.ts` — 6 stubs (`listTemplates`, `getTemplate`, `createTemplate`, `updateTemplate`, `deleteTemplate`, `duplicateTemplate`)
- [x] Task: Fix `src/server/assignments.ts` — 7 stubs (`createAssignment`, `listInstructorAssignments`, `getAssignmentDetail`, `listStudentAssignments`, `getStudentAssignmentDetail`, `unlockCheckpoint`, `extendDeadline`)
- [x] Task: Fix `src/server/consultations.ts` — 7 stubs (`logConsultation`, `listConsultations`, `listPendingConsultations`, `verifyConsultation`, `rejectConsultation`, `getConsultationDetail`, `listVerifiedCounts`)
- [x] Task: Fix `src/server/reviews.ts` — 5 stubs (`listPendingReviews`, `getReviewDetail`, `openForReview`, `submitReview`, `getLatestReview`)
- [x] Task: Fix `src/server/submissions.ts` — 3 stubs (`submitCheckpoint`, `listSubmissions`, `getSubmissionDetail`)
- [x] Task: Fix `src/server/files.ts` — 3 stubs (`getPresignedUploadUrl`, `getPresignedDownloadUrl`, `getPresignedReviewFeedbackUploadUrl`)
- [x] Task: Fix `src/server/notifications.ts` — 5 stubs (`createNotification`, `listNotifications`, `markRead`, `markAllRead`, `getUnreadCount`)
- [x] Task: Fix `src/server/audit-logs.ts` — 2 stubs (`listAuditLogs`, `getAuditLogDetail`)
- [x] Task: Fix `src/server/setup-password.ts` — 1 stub
- [x] Task: Verify all changes compile
  - [x] Run `pnpm typecheck` — must pass
  - [x] Run `pnpm test` — must pass
- [x] Task: Conductor — User Manual Verification 'Phase 3: Fix Server Stubs' (Protocol in workflow.md)

## Phase 4: Fix Route Files — `as any` Casts + `any[]` + Callback Params

**Objective:** Remove all `as any`, `any[]`, and callback `: any` params from route files.

- [x] Task: Fix `src/routes/_authenticated/admin/audit-log.tsx` — navigate search callbacks + map callback [a244865]
- [ ] Task: Fix `src/routes/_authenticated/admin/users/index.tsx` — server fn calls + `as any` casts
- [ ] Task: Fix `src/routes/_authenticated/admin/templates/index.tsx` — server fn calls + `as any` casts
- [ ] Task: Fix `src/routes/_authenticated/student/assignments/index.tsx` — navigate callbacks + map callback
- [ ] Task: Fix `src/routes/_authenticated/student/assignments/$id.tsx` — loader data + params + server fn calls + `as any` casts
- [ ] Task: Fix `src/routes/_authenticated/student/assignments/$id.checkpoints.$checkpointId.tsx` — loader data + params + navigate + server fn calls
- [ ] Task: Fix `src/routes/_authenticated/instructor/reviews/index.tsx` — loader data + search params + navigate
- [ ] Task: Fix `src/routes/_authenticated/instructor/reviews/$submissionId.tsx` — server fn calls
- [ ] Task: Fix `src/routes/_authenticated/instructor/assignments/index.tsx` — loader data + search params + navigate + map callback
- [ ] Task: Fix `src/routes/_authenticated/instructor/assignments/$id.tsx` — loader data + params + `any[]` useState + map callbacks
- [ ] Task: Fix `src/routes/_authenticated/instructor/assignments/new.tsx` — navigate cast
- [ ] Task: Add `tests/**` and `scripts/**` to ESLint ignores (if not done in Phase 1)
- [ ] Task: Verify all changes compile
  - [ ] Run `pnpm typecheck` — must pass
  - [ ] Run `pnpm test` — must pass
- [ ] Task: Conductor — User Manual Verification 'Phase 4: Fix Route Files' (Protocol in workflow.md)

## Phase 5: Fix Component Files — `as any` Casts

**Objective:** Remove all `as any` casts from shared components.

- [ ] Task: Fix `src/components/reviews/ReviewForm.tsx` — server fn calls
- [ ] Task: Fix `src/components/consultations/ConsultationForm.tsx` — server fn call
- [ ] Task: Fix `src/components/consultations/VerificationDialog.tsx` — server fn calls
- [ ] Task: Fix `src/components/instructor/assignments/AssignmentWizard.tsx` — server fn calls + navigate + i18n casts
- [ ] Task: Fix `src/components/instructor/assignments/TemplatePicker.tsx` — server fn call
- [ ] Task: Fix `src/components/instructor/assignments/StudentPicker.tsx` — server fn call
- [ ] Task: Fix `src/components/admin/templates/CreateTemplateDialog.tsx` — zodResolver cast
- [ ] Task: Fix `src/components/admin/templates/EditTemplateSheet.tsx` — zodResolver cast
- [ ] Task: Fix `src/components/dashboard/AdminDashboard.tsx` — navigate casts
- [ ] Task: Fix `src/components/dashboard/InstructorDashboard.tsx` — navigate casts
- [ ] Task: Fix `src/components/dashboard/StudentDashboard.tsx` — navigate cast
- [ ] Task: Fix `src/components/layout/student-sidebar.tsx` — link `to` cast
- [ ] Task: Fix `src/components/layout/instructor-sidebar.tsx` — link `to` cast
- [ ] Task: Fix `src/hooks/use-notifications.ts` — any type usage
- [ ] Task: Verify all changes compile
  - [ ] Run `pnpm typecheck` — must pass
  - [ ] Run `pnpm test` — must pass
- [ ] Task: Conductor — User Manual Verification 'Phase 5: Fix Component Files' (Protocol in workflow.md)

## Phase 6: Final Verification

**Objective:** Confirm zero `any` types remain in `src/`.

- [ ] Task: Run full verification suite
  - [ ] `pnpm typecheck` — pass
  - [ ] `pnpm lint` — no `no-explicit-any` warnings from `src/` files
  - [ ] `pnpm test` — all tests pass
  - [ ] `pnpm build` — production build succeeds
- [ ] Task: Final grep check for any remaining `: any`, `as any`, `any[]` in `src/`
- [ ] Task: Conductor — User Manual Verification 'Phase 6: Final Verification' (Protocol in workflow.md)
