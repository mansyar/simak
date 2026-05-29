# Track: Eliminate `any` Type Usage — Type Safety Refactor

## Overview

Eliminate all TypeScript `any` type usages in the `src/` directory by extracting shared types, replacing type guards, fixing server function stubs, removing `as any` casts, and typing callback parameters. This is a pure refactor — no behavior changes, no new features.

## Approach

1. **Create shared types** in a new `src/lib/types.ts` file
2. **Fix `.server.ts` files** — Replace `session: any` with proper Session type
3. **Fix server stub files** — Replace `args: { data: any }` with `unknown`
4. **Fix route/component files** — Remove `as any` casts, type callback params
5. **Update ESLint config** — Exclude `tests/**` from `no-explicit-any` rule

## Shared Types to Extract (`src/lib/types.ts`)

- `ServerFnArgs<T>` — Generic wrapper for server function handler args (uses `unknown` instead of `any`)
- `NonNullableSession` — The non-null session shape used by type guards (currently duplicated 12+ times)
- Re-export/inherit from the existing `Session` type in `src/server/auth.ts`

## Affected Files

### Phase 1: Shared types + type guards (`.server.ts` files)

1. `src/server/submissions.server.ts` — `isStudent(session: any)`
2. `src/server/files.server.ts` — `isStudent(session: any)`
3. `src/server/consultations.server.ts` — `isStudent(session: any)`
4. `src/server/reviews.server.ts` — `isInstructor(session: any)`
5. `src/server/reviews-extras.server.ts` — `isInstructor(session: any)`
6. `src/server/assignments.server.ts` — session type guard
7. `src/server/assignments-extras.server.ts` — `isInstructor(session: any)`
8. `src/server/templates.server.ts` — `isAdmin(session: any)`
9. `src/server/notifications.server.ts` — `isAdmin(session: any)`
10. `src/server/dashboard-admin.server.ts` — `isAdmin(session: any)`
11. `src/server/dashboard-student.server.ts` — `isStudent(session: any)`
12. `src/server/dashboard-instructor.server.ts` — `isInstructor(session: any)`
13. `src/lib/review-sla.ts` — `tx: any, db: any`

### Phase 2: Server function stubs (`args: { data: any }`)

14. `src/server/users.ts` — 6 stubs
15. `src/server/templates.ts` — 6 stubs
16. `src/server/assignments.ts` — 7 stubs
17. `src/server/consultations.ts` — 7 stubs
18. `src/server/reviews.ts` — 5 stubs
19. `src/server/submissions.ts` — 3 stubs
20. `src/server/files.ts` — 3 stubs
21. `src/server/notifications.ts` — 5 stubs
22. `src/server/audit-logs.ts` — 2 stubs
23. `src/server/setup-password.ts` — 1 stub

### Phase 3: Route/component `as any` casts + `any[]` + callback params

24. `src/routes/_authenticated/admin/audit-log.tsx`
25. `src/routes/_authenticated/admin/users/index.tsx`
26. `src/routes/_authenticated/admin/templates/index.tsx`
27. `src/routes/_authenticated/student/assignments/index.tsx`
28. `src/routes/_authenticated/student/assignments/$id.tsx`
29. `src/routes/_authenticated/student/assignments/$id.checkpoints.$checkpointId.tsx`
30. `src/routes/_authenticated/instructor/reviews/index.tsx`
31. `src/routes/_authenticated/instructor/reviews/$submissionId.tsx`
32. `src/routes/_authenticated/instructor/assignments/index.tsx`
33. `src/routes/_authenticated/instructor/assignments/$id.tsx`
34. `src/routes/_authenticated/instructor/assignments/new.tsx`
35. `src/components/reviews/ReviewForm.tsx`
36. `src/components/consultations/ConsultationForm.tsx`
37. `src/components/consultations/VerificationDialog.tsx`
38. `src/components/instructor/assignments/AssignmentWizard.tsx`
39. `src/components/instructor/assignments/TemplatePicker.tsx`
40. `src/components/instructor/assignments/StudentPicker.tsx`
41. `src/components/admin/templates/CreateTemplateDialog.tsx`
42. `src/components/admin/templates/EditTemplateSheet.tsx`
43. `src/components/dashboard/AdminDashboard.tsx`
44. `src/components/dashboard/InstructorDashboard.tsx`
45. `src/components/dashboard/StudentDashboard.tsx`
46. `src/components/layout/student-sidebar.tsx`
47. `src/components/layout/instructor-sidebar.tsx`
48. `src/hooks/use-notifications.ts`

### Phase 4: ESLint config

49. `eslint.config.js` — Add `tests/**` to ignore list or configure override

## Success Criteria

- [ ] Zero `: any`, `as any`, or `any[]` in any `src/` file
- [ ] `pnpm typecheck` passes without errors
- [ ] `pnpm lint` passes (with `no-explicit-any` at 'warn')
- [ ] `pnpm test` passes (all existing tests unchanged)
- [ ] `pnpm build` succeeds

## Out of Scope

- Test files (`tests/`) — Will be excluded from the lint rule instead
- `routeTree.gen.ts` — Auto-generated, already in ESLint ignores
- `src/i18n/` — Generated files, already in ESLint ignores
- `z.any()` in Zod schemas — This is a Zod type, not a TypeScript `any`
- New features or behavior changes
