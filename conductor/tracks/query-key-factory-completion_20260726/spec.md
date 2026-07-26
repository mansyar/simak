# Specification: Query-Key Factory Completion & Client Data-Fetching Consistency (TRACK-029)

## Overview

This track completes the TanStack Query query-key factory pattern introduced in TRACK-014 and eliminates client-side data-fetching inconsistencies identified after the gradebook feature (TRACK-025). Two gaps remain in the codebase:

1. **Query-key factory incomplete:** The factory (`src/lib/query-keys.ts`) covers only 7 of ~13 data domains. Five settings components use inline string-array keys (`['currentUser']`, `['activeSessions']`, `['twoFactorStatus']`), and the gradebook feature has no factory entries.
2. **Pre-React-Query patterns in gradebook:** `StudentFinalGradeCard` uses `useState`+`useEffect`+manual async fetch (no cache, no dedup, no background refetch). `RecomputeGradesButton` uses `useState(loading)` + inline async handler (no `useMutation`, no optimistic UI, no cache invalidation).

This is a **refactor** track — no new product features, no backend changes, no schema migrations, no new dependencies, no i18n keys. The goal is architectural consistency: all client-side data fetching uses the query-key factory + `useQuery`/`useMutation` pattern established in TRACK-014.

**Track Type:** refactor
**Status:** Pending
**Dependencies:** TRACK-014 (Optimistic UI Updates — introduced query-key factory). Can be implemented independently of TRACK-030.
**Estimated Effort:** 2 Days / 1 Sprint Loop

## Context Anchors (Traceability)

* **PRD Reference:** `docs/PRD.md` — Settings hub (profile, password, 2FA, appearance, accessibility, notification preferences — 5 sections with inline query keys), Gradebook & Final Grade Computation (TRACK-025 — components using `useState`/`useEffect` instead of `useQuery`/`useMutation`)
* **TDD Reference:**
  - `conductor/tech-stack.md` (TanStack Query — caching, deduplication, background refetching)
  - `src/lib/query-keys.ts` (48 lines — 7 existing domain factories: `notificationKeys`, `consultationKeys`, `extensionKeys`, `assignmentKeys`, `userKeys`, `templateKeys`, `discussionKeys`)
  - `src/components/settings/ProfileSection.tsx:16` — `queryKey: ['currentUser']` inline, **missing invalidation on name update** (bug)
  - `src/components/settings/SessionManagement.tsx:51` — `queryKey: ['activeSessions']` inline
  - `src/components/settings/TwoFactorSettings.tsx:40` — `queryKey: ['twoFactorStatus']` inline
  - `src/components/settings/AccessibilitySection.tsx:11` — `useQuery` with inline key
  - `src/components/settings/NotificationPreferencesSection.tsx:112` — `queryKey: ['currentUser']` shared with ProfileSection, invalidates via inline `['currentUser']` on line 138
  - `src/components/gradebook/StudentFinalGradeCard.tsx:14-36` — `useState`+`useEffect`+manual async fetch
  - `src/components/gradebook/RecomputeGradesButton.tsx:24-43` — `useState(loading)` + inline async handler
  - `src/routes/_authenticated/instructor/assignments/$id.gradebook.tsx:16-31` — route uses TanStack Router SSR `loader` + `Route.useLoaderData()` (NOT TanStack Query; `router.invalidate()` on line 57 is correct for SSR loader data)
* **Product Spec Reference:**
  - `conductor/archive/optimistic-ui-updates_20260722/spec.md` (TRACK-014 — FR-1: query-key factory; "Other features keep inline keys until touched")
  - `conductor/archive/gradebook-final-grade-computation_20260725/` (TRACK-025 — gradebook built without TanStack Query)

## Functional Requirements

### FR-1: Complete Query-Key Factory

Add two new domain factory entries to `src/lib/query-keys.ts`, following the existing pattern (nested sub-keys, `as const` return types):

1. **`settingsKeys`** — with sub-keys:
   - `currentUser()` → returns `['settings', 'currentUser'] as const`
   - `activeSessions()` → returns `['settings', 'activeSessions'] as const`
   - `twoFactorStatus()` → returns `['settings', 'twoFactorStatus'] as const`
   - `accessibility()` → returns `['settings', 'accessibility'] as const`
2. **`gradebookKeys`** — with sub-key:
   - `studentFinalGrade(assignmentId: number)` → returns `['gradebook', 'studentFinalGrade', assignmentId] as const`
   - (No `detail`/`config` keys — the gradebook route page uses SSR loader, not TanStack Query)

### FR-2: Migrate Settings Components to Factory Keys

Replace all inline string-array query keys with factory calls in 5 settings components:

| Component | File | Inline Key | Factory Replacement |
|-----------|------|------------|---------------------|
| ProfileSection | `src/components/settings/ProfileSection.tsx:16` | `['currentUser']` | `settingsKeys.currentUser()` |
| SessionManagement | `src/components/settings/SessionManagement.tsx:51` | `['activeSessions']` | `settingsKeys.activeSessions()` |
| TwoFactorSettings | `src/components/settings/TwoFactorSettings.tsx:40` | `['twoFactorStatus']` | `settingsKeys.twoFactorStatus()` |
| AccessibilitySection | `src/components/settings/AccessibilitySection.tsx:11` | inline key | `settingsKeys.accessibility()` |
| NotificationPreferencesSection | `src/components/settings/NotificationPreferencesSection.tsx:112,138` | `['currentUser']` | `settingsKeys.currentUser()` |

All `queryClient.invalidateQueries` calls in these files must also be updated to use factory keys.

### FR-3: Fix ProfileSection Missing Invalidation Bug

`ProfileSection.tsx` `updateNameMutation` (line 36-43) has no `onSuccess`/`onSettled` invalidation. After a name update, the `['currentUser']` cache is stale and the UI shows the old name until the next refetch.

**Fix:** Add `onSettled: () => queryClient.invalidateQueries({ queryKey: settingsKeys.currentUser() })` to the mutation.

### FR-4: Migrate StudentFinalGradeCard to useQuery

Replace `useState(grade)` + `useState(loading)` + `useState(error)` + `useEffect` manual fetch (lines 14-36 in `StudentFinalGradeCard.tsx`) with:

```ts
const { data: grade, isPending, isError } = useQuery({
  queryKey: gradebookKeys.studentFinalGrade(assignmentId),
  queryFn: () => getStudentFinalGrade({ data: { assignmentId } }),
});
```

This removes manual loading/error state management and provides cache, deduplication, and background refetch.

### FR-5: Migrate RecomputeGradesButton to useMutation

Replace `useState(loading)` + inline async handler with try/catch/finally (lines 24-43 in `RecomputeGradesButton.tsx`) with:

```ts
const recomputeMutation = useMutation({
  mutationFn: () => recomputeAllGrades({ data: { assignmentId } }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: gradebookKeys.studentFinalGrade(assignmentId) });
    router.invalidate();
  },
  onError: () => toast.error(t('gradebook.recomputeError')),
});
```

**Dual invalidation required:**
- `queryClient.invalidateQueries({ queryKey: gradebookKeys.studentFinalGrade(assignmentId) })` — refetches `StudentFinalGradeCard`'s client-side query
- `router.invalidate()` — refetches the route's SSR loader data (the gradebook table)

Both are needed because the gradebook table comes from the route loader and `StudentFinalGradeCard` fetches independently via `useQuery`.

### FR-6: Keep Gradebook Route's router.invalidate()

The route page (`$id.gradebook.tsx`) uses TanStack Router's SSR `loader` + `Route.useLoaderData()` (lines 16-31), NOT TanStack Query. `router.invalidate()` is the **correct** pattern for refetching SSR loader data — `queryClient.invalidateQueries` would NOT refetch route loader data.

The route page's `handleSaveConfig` stays as-is. Only the sub-components (`StudentFinalGradeCard`, `RecomputeGradesButton`) are migrated to TanStack Query.

### FR-7: Audit and Migrate All Remaining Inline Keys

After migrating settings + gradebook, grep the entire `src/` directory for remaining inline query key patterns (`queryKey: ['` in `.tsx` files). **Migrate ALL found** to factory calls — proactively complete the factory comprehensively. This may involve:
- Adding new domain entries to `src/lib/query-keys.ts` for any newly discovered domains
- Updating `useQuery` calls to use factory keys
- Updating `queryClient.invalidateQueries` calls to use factory keys

If a key is intentionally inline (e.g., a one-off query with no reuse), document the exception with a code comment.

## Non-Functional Requirements

1. **No behavioral changes:** The refactor must not change user-visible behavior. The only user-facing improvement is the ProfileSection name update reflecting immediately (bug fix).
2. **No new dependencies:** TanStack Query is already installed. No new npm packages.
3. **No backend changes:** All server function stubs and handlers are unchanged.
4. **No schema migrations:** No database changes.
5. **No i18n changes:** No new user-visible strings (unless a new error toast key is needed for `RecomputeGradesButton` `onError` — verify existing keys first).
6. **File limit:** All files must remain under 500 lines.
7. **Coverage:** Test coverage thresholds ≥80% (lines/functions/branches/statements).

## Acceptance Criteria

1. **AC-1:** `src/lib/query-keys.ts` contains `settingsKeys` (4 sub-keys) and `gradebookKeys` (1 sub-key) factories following the existing pattern (`as const` return types).
2. **AC-2:** Zero inline string-array query keys in `src/components/settings/` — grep for `queryKey: ['` returns no matches.
3. **AC-3:** `ProfileSection.tsx` `updateNameMutation` has `onSettled` invalidation using `settingsKeys.currentUser()`.
4. **AC-4:** `StudentFinalGradeCard.tsx` uses `useQuery` with `gradebookKeys.studentFinalGrade(assignmentId)` — no `useState`/`useEffect` for data fetching.
5. **AC-5:** `RecomputeGradesButton.tsx` uses `useMutation` with `onSuccess` calling both `queryClient.invalidateQueries(gradebookKeys.studentFinalGrade)` AND `router.invalidate()`.
6. **AC-6:** `$id.gradebook.tsx` route page keeps `router.invalidate()` for `handleSaveConfig` (unchanged — correct for SSR loader data).
7. **AC-7:** Grep for `queryKey: ['` across all `src/**/*.tsx` files returns zero matches (excluding intentional one-off queries documented with a comment).
8. **AC-8:** Dedicated unit tests for `settingsKeys` and `gradebookKeys` factory functions exist in `tests/unit/lib/query-keys.test.ts` (or similar), verifying key structure.
9. **AC-9:** All existing unit tests pass. Updated component tests use `QueryClientProvider` wrapper pattern where needed.
10. **AC-10:** `pnpm typecheck`, `pnpm lint`, `pnpm check:i18n`, `pnpm test:coverage` all pass.

## Out of Scope

- Migrating route-loader-based data fetching (dashboard, assignment detail, gradebook route page) to `useQuery` — these use TanStack Router's `loader` + `Route.useLoaderData()` pattern, which is a valid SSR-first approach. `router.invalidate()` is the correct refetch mechanism for SSR loader data.
- Optimistic UI for gradebook mutations — deferred to a future track (priority is cache consistency, not perceived latency).
- Any backend/server-function changes — all server stubs and handlers are unchanged.
- Schema migrations or database changes.
- New product features.
- i18n key additions (unless an error toast key is genuinely missing — verify first).
- TRACK-030 (NotificationCenter Infinite Query Migration) — separate track.
