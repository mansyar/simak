# Accessibility Violations — Moderate & Minor

This document tracks moderate and minor accessibility violations identified by axe-core scans during E2E testing (TRACK-028).

**Last scanned:** 2026-08-05 (full UI/UX audit remediation verification)
**Scanner:** @axe-core/playwright 4.12.1  
**Critical/serious violations:** 0 (all fixed)  
**Moderate violations:** 0 reported by the current targeted scans (historical violations are documented below)
**Pages/scenarios scanned:** Full Chromium suite (104 tests), including public/authentication, student, instructor, admin, mobile, settings, imports, reviews, discussions, and security-header flows

The completed `ui-ux-audit-remediation_20260804` track extended the earlier TRACK-037 fixes across all product roles and responsive surfaces. The final browser verification reported no serious/critical axe violations, no hydration mismatch, and no unexpected application console errors. The only retained browser warning is the known TanStack Router `HomePage` code-splitting warning.

---

## Remediated Moderate Violations (TRACK-037, 2026-07-28)

All 4 historical moderate violations were remediated in TRACK-037. Unit tests verify the fixes at the DOM level. The targeted TRACK-053 student-dashboard axe scan passed after adding the semantic Next Actions heading and accessible action links. The later full-surface remediation removed the previously documented hydration/runtime and admin-template verification limitations; current status is recorded above.

| Rule | Impact | Pages Affected | Root Cause | Fix |
|------|--------|----------------|------------|-----|
| `landmark-one-main` | moderate | Login page | `_unauthenticated.tsx` rendered bare `<Outlet />` with no `<main>` landmark | Wrapped `<Outlet />` in `<main id="main-content" tabIndex={-1}>` |
| `skip-link` | moderate | All authenticated pages | Skip link targeted `#main-content` but no element had that `id` | Added `id="main-content"` and `tabIndex={-1}` to `<main>` in all 3 role layouts (`student.tsx`, `instructor.tsx`, `admin.tsx`) and landing page (`index.tsx`); removed duplicate `id="main-content"` from `login.tsx` `<div>` |
| `region` | moderate | All authenticated pages | `KeyboardCheatSheet` trigger button rendered outside landmarks in `_authenticated.tsx`; sonner `<Toaster>` `<section>` lacked `aria-label` | Moved `KeyboardCheatSheet` into `AppHeader` (`<header>` landmark); added `aria-label` to sonner `<Toaster>` via i18n key `notifications.toasterLabel` |
| `heading-order` | moderate | Student dashboard, student assignment detail, instructor review detail, admin template editor | Heading levels skipped (e.g., `h1` → `h3` without `h2`) | Changed `h3` → `h2` and `h4` → `h3` where skips existed; added missing `<h1>` to `TemplateDetailPage.tsx`; changed success message `h2` → `h1` in instructor review detail |

### Files Modified in TRACK-037

**Phase 1 — Landmark Structure & Skip Link:**
- `src/routes/_unauthenticated.tsx` — wrapped `<Outlet />` in `<main>`
- `src/routes/_authenticated/student.tsx` — added `id` and `tabIndex` to `<main>`
- `src/routes/_authenticated/instructor.tsx` — same
- `src/routes/_authenticated/admin.tsx` — same
- `src/routes/index.tsx` — changed outer `<div>` to `<main>`
- `src/routes/_unauthenticated/auth/login.tsx` — removed duplicate `id="main-content"`

**Phase 2 — Region Content Containment:**
- `src/routes/_authenticated.tsx` — removed `KeyboardCheatSheet` rendering
- `src/components/layout/app-header.tsx` — added `KeyboardCheatSheet` inside `<header>`
- `src/components/ui/sonner.tsx` — added `aria-label` to `<Sonner>`
- `locales/en.json`, `locales/id.json` — added `toasterLabel` i18n key

**Phase 3 — Heading Order:**
- `src/components/dashboard/StudentDashboard.tsx` — `h3` → `h2`
- `src/components/student/assignments/CheckpointTimeline.tsx` — `h3` → `h2`
- `src/components/student/extensions/ExtensionHistoryList.tsx` — `h3` → `h2`
- `src/components/student/assignments/CheckpointCard.tsx` — `h4` → `h3`
- `src/components/discussions/discussion-panel.tsx` — `h3` → `h2`
- `src/components/admin/templates/TemplateDangerZone.tsx` — `h3` → `h2`
- `src/components/admin/templates/TemplateDetailPage.tsx` — added `<h1>`
- `src/routes/_authenticated/student/assignments/$id.tsx` — `h3` → `h2` (3 section titles)
- `src/routes/_authenticated/instructor/reviews/$submissionId.tsx` — `h2` → `h1` (success message)

---

## Fixed Violations (Critical & Serious)

The following critical and serious violations were identified and fixed during TRACK-028:

| Rule | Impact | Fix |
|------|--------|-----|
| `color-contrast` | serious | Darkened `--muted-foreground` from `oklch(0.688 ...)` to `oklch(0.50 ...)` for ~5.7:1 contrast |
| `color-contrast` | serious | Changed sidebar section labels from `text-sidebar-foreground/50` to `/90` for ~5.26:1 contrast |
| `color-contrast` | serious | Darkened `--warning` from `#d97706` to `#92400e` (amber-800) for ~6:1 contrast on badge backgrounds |
| `color-contrast` | serious | Darkened `--success` from `#059669` to `#047857` (emerald-700) for ~5.56:1 contrast |
| `color-contrast` | serious | Darkened `--info` from `#0891b2` to `#0e7490` (cyan-700) for ~5.50:1 contrast |
| `aria-progressbar-name` | serious | Added `aria-label` to `<div role="progressbar">` in Progress component |
| `label` | serious | Added `aria-label` to DiscussionPanel textarea |
| `button-name` | critical | Added `aria-label` to Base UI Select triggers in TemplateFilters and UserFilters |
