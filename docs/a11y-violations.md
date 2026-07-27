# Accessibility Violations — Moderate & Minor

This document tracks moderate and minor accessibility violations identified by axe-core scans during E2E testing (TRACK-028).

**Last scanned:** 2026-07-27  
**Scanner:** @axe-core/playwright 4.12.1  
**Critical/serious violations:** 0 (all fixed)  
**Pages scanned:** Login, Student Dashboard, Student Assignment Detail, Instructor Review Detail, Admin Users, Admin Templates

---

## Common Violations (appear on multiple pages)

### 1. `region` (moderate) — All pages except login

**Rule:** Ensure all page content is contained by landmarks.  
**Help:** All page content should be contained by landmarks.  
**Affected pages:** Student dashboard, student assignment detail, instructor review detail, admin users, admin templates (1 node each).  
**Root cause:** Some page content (e.g., sidebar, header elements) falls outside of `<main>` or other landmark regions.  
**Remediation:** Wrap remaining content sections in appropriate landmark elements (`<nav>`, `<aside>`, `<header>`).

### 2. `skip-link` (moderate) — All authenticated pages

**Rule:** Ensure all skip links have a focusable target.  
**Help:** The skip-link target should exist and be focusable.  
**Affected pages:** Student dashboard, student assignment detail, instructor review detail, admin users, admin templates (1 node each).  
**Root cause:** The skip-to-content link targets an element that is not focusable or does not exist.  
**Remediation:** Ensure the skip link target has `tabindex="-1"` and the target element exists in the DOM.

### 3. `heading-order` (moderate) — Student/instructor/admin pages

**Rule:** Ensure the order of headings is semantically correct.  
**Help:** Heading levels should only increase by one.  
**Affected pages:** Student dashboard, student assignment detail, instructor review detail, admin templates (1 node each).  
**Root cause:** A heading level is skipped (e.g., `<h1>` directly followed by `<h3>` without an `<h2>`).  
**Remediation:** Fix the heading hierarchy in affected page components.

---

## Page-Specific Violations

### Login page (`/auth/login`)

| Rule | Impact | Nodes | Description |
|------|--------|-------|-------------|
| `landmark-one-main` | moderate | 1 | Document should have one main landmark |
| `region` | moderate | 4 | All page content should be contained by landmarks |

**Note:** The login page is rendered outside the authenticated layout and lacks a `<main>` landmark. The unauthenticated auth layout should wrap content in `<main>`.

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
