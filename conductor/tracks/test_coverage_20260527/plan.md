# Implementation Plan: Increase Test Coverage to >80%

## Phase 1: Critical Server Coverage (0-20%) [checkpoint: 7e25278]

- [x] Task: Write unit tests for `src/server/auth.ts` (5.88% → >80%) [8bf683e]
  - [x] Analyze current uncovered lines (28-80)
  - [x] Write tests for `getSessionFromHeaders` edge cases (missing headers, invalid session)
  - [x] Write tests for `requireRole` (authorized, unauthorized, missing role)
  - [x] Run tests and verify coverage increase

- [x] Task: Write unit tests for `src/server/setup-password.ts` (0% → >80%) [e769e60]
  - [x] Analyze module exports and handler logic
  - [x] Write tests for password setup token validation
  - [x] Write tests for password update success/failure paths
  - [x] Run tests and verify coverage increase

- [x] Task: Write unit tests for `src/server/files.ts` and `src/server/files.server.ts` (0% → >80%) [b3770ed]
  - [x] Analyze module exports and handler logic
  - [x] Write tests for `getPresignedUploadUrl` (valid/invalid checkpoint state)
  - [x] Write tests for `getPresignedDownloadUrl` (ownership validation)
  - [x] Run tests and verify coverage increase

- [x] Task: Write unit tests for `src/hooks/use-theme.ts` (0% → >80%) [a9516f9]
  - [x] Analyze hook implementation
  - [x] Write tests for theme toggle (light/dark/system)
  - [x] Write tests for localStorage persistence
  - [x] Run tests and verify coverage increase

- [x] Task: Write unit tests for `src/i18n/index.ts` (5.26% → >80%) [f528ba1]
  - [x] Analyze i18n initialization and locale detection
  - [x] Write tests for locale initialization
  - [x] Write tests for translation loading
  - [x] Run tests and verify coverage increase

- [x] Task: Conductor - User Manual Verification 'Phase 1: Critical Server Coverage' (Protocol in workflow.md)

## Phase 2: Critical Route Coverage (0-20%) [checkpoint: ]

- [x] Task: Write unit tests for route guard layouts [f80026b]
  - [x] Write tests for `src/routes/__root.tsx` (17% → >80%)
  - [x] Write tests for `src/routes/_authenticated.tsx` (20% → >80%)
  - [x] Write tests for `src/routes/_unauthenticated.tsx` (20% → >80%)
  - [x] Write tests for `src/routes/_authenticated/_admin.tsx` (14% → >80%)
  - [x] Write tests for `src/routes/_authenticated/_instructor.tsx` (0% → >80%)
  - [x] Write tests for `src/routes/_authenticated/_student.tsx` (14% → >80%)
  - [x] Run tests and verify coverage increase

- [x] Task: Write unit tests for auth routes
  - [x] Write tests for `src/routes/_unauthenticated/auth/login.tsx` (4.76% → >80%)
  - [x] Write tests for `src/routes/_unauthenticated/auth/forgot-password.tsx` (0% → >80%)
  - [x] Write tests for `src/routes/_unauthenticated/auth/reset-password.tsx` (0% → >80%)
  - [x] Write tests for `src/routes/_unauthenticated/auth/setup-password.tsx` (0% → >80%)
  - [x] Run tests and verify coverage increase

- [x] Task: Write unit tests for dashboard routes
  - [x] Write tests for `src/routes/_authenticated/admin/dashboard.tsx` (20% → >80%)
  - [x] Write tests for `src/routes/_authenticated/instructor/dashboard.tsx` (20% → >80%)
  - [x] Write tests for `src/routes/_authenticated/student/dashboard.tsx` (20% → >80%)
  - [x] Run tests and verify coverage increase

- [x] Task: Write unit tests for admin routes
  - [x] Write tests for `src/routes/_authenticated/admin/users/index.tsx` (3.38% → >80%)
  - [x] Write tests for `src/routes/_authenticated/admin/templates/index.tsx` (0% → >80%)
  - [x] Run tests and verify coverage increase

- [x] Task: Write unit tests for instructor routes
  - [x] Write tests for `src/routes/_authenticated/instructor/assignments/index.tsx` (0% → >80%)
  - [x] Write tests for `src/routes/_authenticated/instructor/assignments/$id.tsx` (0% → >80%)
  - [x] Write tests for `src/routes/_authenticated/instructor/assignments/new.tsx` (0% → >80%)
  - [x] Write tests for `src/routes/_authenticated/instructor/reviews/index.tsx` (0% → >80%)
  - [x] Write tests for `src/routes/_authenticated/instructor/reviews/$submissionId.tsx` (0% → >80%)
  - [x] Run tests and verify coverage increase

- [x] Task: Write unit tests for student routes
  - [x] Write tests for `src/routes/_authenticated/student/assignments/index.tsx` (0% → >80%)
  - [x] Write tests for `src/routes/_authenticated/student/assignments/$id.tsx` (0% → >80%)
  - [x] Write tests for `src/routes/_authenticated/student/assignments/$id/checkpoints/$checkpointId.tsx` (0% → >80%)
  - [x] Run tests and verify coverage increase

- [ ] Task: Write unit tests for API route
  - [ ] Write tests for `src/routes/api/auth.$.tsx` (0% → >80%)
  - [ ] Run tests and verify coverage increase

- [ ] Task: Conductor - User Manual Verification 'Phase 2: Critical Route Coverage' (Protocol in workflow.md)

## Phase 3: High Coverage - Server Stubs (20-50%) [checkpoint: ]

- [ ] Task: Write unit tests for `src/server/assignments.ts` (43% → >80%)
  - [ ] Analyze uncovered lines (82-105)
  - [ ] Write tests for Zod schemas (CreateAssignmentSchema, UpdateAssignmentSchema)
  - [ ] Write tests for server function stubs
  - [ ] Run tests and verify coverage increase

- [ ] Task: Write unit tests for `src/server/consultations.ts` (40% → >80%)
  - [ ] Analyze uncovered lines (77-93)
  - [ ] Write tests for Zod schemas
  - [ ] Write tests for server function stubs
  - [ ] Run tests and verify coverage increase

- [ ] Task: Write unit tests for `src/server/notifications.ts` (40% → >80%)
  - [ ] Analyze uncovered lines (50-65)
  - [ ] Write tests for Zod schemas
  - [ ] Write tests for server function stubs
  - [ ] Run tests and verify coverage increase

- [ ] Task: Write unit tests for `src/server/submissions.ts` (40% → >80%)
  - [ ] Analyze uncovered lines (23-41)
  - [ ] Write tests for Zod schemas
  - [ ] Write tests for server function stubs
  - [ ] Run tests and verify coverage increase

- [ ] Task: Write unit tests for `src/server/templates.ts` (38% → >80%)
  - [ ] Analyze uncovered lines (68-84)
  - [ ] Write tests for Zod schemas
  - [ ] Write tests for server function stubs
  - [ ] Run tests and verify coverage increase

- [ ] Task: Write unit tests for `src/server/users.ts` (40% → >80%)
  - [ ] Analyze uncovered lines (55-71)
  - [ ] Write tests for Zod schemas
  - [ ] Write tests for server function stubs
  - [ ] Run tests and verify coverage increase

- [ ] Task: Write unit tests for `src/server/dashboard.ts` (50% → >80%)
  - [ ] Analyze uncovered lines (13-24)
  - [ ] Write tests for Zod schemas
  - [ ] Write tests for server function stubs
  - [ ] Run tests and verify coverage increase

- [ ] Task: Conductor - User Manual Verification 'Phase 3: High Coverage - Server Stubs' (Protocol in workflow.md)

## Phase 4: High Coverage - Components & Schema (20-50%) [checkpoint: ]

- [ ] Task: Write unit tests for `src/components/reviews/ReviewForm.tsx` (27% → >80%)
  - [ ] Analyze uncovered lines (63-99, 144-180)
  - [ ] Write tests for form submission (pass/revise)
  - [ ] Write tests for feedback file upload
  - [ ] Write tests for revision deadline picker
  - [ ] Run tests and verify coverage increase

- [ ] Task: Write unit tests for `src/db/schema/` files (37-67% → >80%)
  - [ ] Write tests for `assignments.ts` relation exports (50% → >80%)
  - [ ] Write tests for `auth.ts` relation exports (37.5% → >80%)
  - [ ] Write tests for `consultations.ts` relation exports (42.85% → >80%)
  - [ ] Write tests for `notifications.ts` relation exports (66.66% → >80%)
  - [ ] Write tests for `submissions.ts` relation exports (50% → >80%)
  - [ ] Write tests for `templates.ts` relation exports (50% → >80%)
  - [ ] Write tests for `users.ts` relation exports (66.66% → >80%)
  - [ ] Run tests and verify coverage increase

- [ ] Task: Conductor - User Manual Verification 'Phase 4: High Coverage - Components & Schema' (Protocol in workflow.md)

## Phase 5: Medium Coverage - Remaining Gaps (50-80%) [checkpoint: ]

- [ ] Task: Write unit tests for `src/components/dashboard/StudentDashboard.tsx` (64% → >80%)
  - [ ] Analyze uncovered lines (99-201)
  - [ ] Write tests for consultation reminders widget
  - [ ] Write tests for edge cases (empty data, loading states)
  - [ ] Run tests and verify coverage increase

- [ ] Task: Write unit tests for `src/components/files/file-uploader.tsx` (66% → >80%)
  - [ ] Analyze uncovered lines (86-92, 137-138)
  - [ ] Write tests for drag-and-drop interactions
  - [ ] Write tests for upload progress states
  - [ ] Run tests and verify coverage increase

- [ ] Task: Write unit tests for `src/components/instructor/progress-table.tsx` (82.6% → >80%)
  - [ ] Analyze uncovered lines (43-55, 60)
  - [ ] Write tests for edge cases
  - [ ] Run tests and verify coverage increase

- [ ] Task: Write unit tests for `src/lib/review-sla.ts` (81.25% → >80%)
  - [ ] Analyze uncovered lines (61-62, 146)
  - [ ] Write tests for SLA breach edge cases
  - [ ] Run tests and verify coverage increase

- [ ] Task: Write unit tests for `src/server/consultations.server.ts` (80.7% → >80%)
  - [ ] Analyze uncovered lines (450-451, 513-514)
  - [ ] Write tests for edge cases
  - [ ] Run tests and verify coverage increase

- [ ] Task: Conductor - User Manual Verification 'Phase 5: Medium Coverage - Remaining Gaps' (Protocol in workflow.md)

## Phase 6: Threshold Update & Final Verification [checkpoint: ]

- [ ] Task: Update vitest.config.ts coverage thresholds
  - [ ] Change `lines` threshold from 50 to 80
  - [ ] Change `functions` threshold from 50 to 80
  - [ ] Change `branches` threshold from 50 to 80
  - [ ] Change `statements` threshold from 50 to 80
  - [ ] Run `pnpm vitest run --coverage` and verify all thresholds pass

- [ ] Task: Final coverage verification
  - [ ] Run full test suite with coverage
  - [ ] Verify >80% for all four metrics
  - [ ] Verify all existing tests still pass
  - [ ] Document final coverage numbers

- [ ] Task: Conductor - User Manual Verification 'Phase 6: Threshold Update & Final Verification' (Protocol in workflow.md)
