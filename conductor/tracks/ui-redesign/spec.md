# Track: UI Redesign — Specification

## Overview

Complete visual redesign of SIMAK's user interface implementing the "Warm Academic" design system as defined in `docs/UI_REDESIGN.md`. This is a frontend-only change that restyles all existing pages and components while preserving all current functionality.

**Design Document:** `docs/UI_REDESIGN.md`  
**Mockup:** `mockup-admin-dashboard.html`

---

## Goals

1. Establish a cohesive "Warm Academic" design system with warm neutrals, serif display fonts, and semantic color coding
2. Improve visual hierarchy across all pages (dashboards, tables, forms)
3. Enhance navigation UX with redesigned sidebar and header
4. Add meaningful empty states with illustrations and CTAs
5. Maintain full accessibility (WCAG 2.1 AA) and responsive behavior
6. Preserve all existing functionality — this is a visual-only change

---

## Scope

### In Scope

| Phase                     | Description                                  | Key Changes                                              |
| ------------------------- | -------------------------------------------- | -------------------------------------------------------- |
| **1. Design Tokens**      | CSS custom properties, Tailwind config       | New color palette, typography scale, spacing, shadows    |
| **2. Shared Layout**      | Sidebar, Header components                   | Redesigned sidebar (3 variants), sticky header with blur |
| **3. Core UI Components** | Card, Table, Badge, EmptyState, MetricCard   | Color-coded borders, zebra tables, semantic badges       |
| **4. Admin Pages**        | Dashboard, Users, Templates, Audit, Settings | Metric cards, improved tables, empty states              |
| **5. Instructor Pages**   | Dashboard, Assignments, Reviews              | Progress indicators, SLA badges                          |
| **6. Student Pages**      | Dashboard, Assignments, Checkpoints          | Progress bars, deadline urgency                          |
| **7. Auth Pages**         | Login, Password Setup, 2FA                   | Centered card layout                                     |
| **8. Testing**            | Update broken tests                          | Fix assertions, don't add new visual tests               |

### Out of Scope

- New features or functionality changes
- Backend/server changes
- Database schema changes
- New routes or pages
- i18n key additions (existing keys only)
- Collapsible sidebar (noted as "future" in design doc)
- Mobile hamburger menu (noted as future responsive enhancement)

---

## Design System Specifications

### Color Palette

**Light Mode:**

- Background: `#FAF9F7` (warm white)
- Surface: `#FFFFFF`
- Border: `#E7E5E0` (warm gray)
- Text: `#1C1917` / Secondary: `#57534E` / Muted: `#A8A29E`

**Dark Mode:**

- Background: `#0F1115`
- Surface: `#181B22`
- Border: `#2A2D35`
- Text: `#F5F5F4` / Secondary: `#A8A29E` / Muted: `#6B6560`

**Semantic Colors:**

- Primary (Brand): `#2563EB` (blue)
- Success: `#059669` (green)
- Warning: `#D97706` (amber)
- Error: `#DC2626` (red)
- Info: `#0891B2` (cyan)

**Sidebar:**

- Background: `#1C2333` (dark navy)
- Active Border: `#3B82F6`
- Text: `#94A3B8` / Active: `#FFFFFF`

### Typography

**Fonts (Self-hosted):**

- Display: Fraunces (serif) — headings, brand
- Body: DM Sans (sans-serif) — body text, UI

**Type Scale:**

- Display: 2rem / 700 weight
- H2: 1.5rem / 600 weight
- H3: 1.25rem / 600 weight
- Body: 0.875rem / 400 weight
- Small: 0.75rem / 400 weight

### Layout Constants

- Sidebar width: 272px (expanded)
- Header height: 64px (sticky, backdrop blur)
- Page max-width: 1400px
- Page padding: 32px (desktop) / 20px (mobile)
- Border radius: sm(6px), md(10px), lg(14px), xl(20px), full(9999px)

### Component Specifications

**Metric Cards:**

- Color-coded top border (3px)
- Icon: 44px, rounded, tinted background
- Number: Fraunces, 2.25rem, 700
- Hover: translateY(-2px) + shadow increase

**Tables:**

- Sticky headers with subtle shadow
- Zebra striping (alternating rows)
- Row hover: background tint
- Status: dot indicators (green=verified, gray=not verified)

**Empty States:**

- 64px icon with dashed border
- Headline + description text
- CTA button (shadcn Button, primary variant)

---

## Technical Requirements

### Font Loading

- Download Fraunces and DM Sans font files
- Serve from `public/fonts/` directory
- Define `@font-face` declarations in CSS
- Use `font-display: swap` for performance

### Theme Strategy

- Default: System preference (`prefers-color-scheme`)
- Toggle: Manual override in header + settings
- Persistence: `localStorage` key `simak-theme`
- Class strategy: `.dark` class on `<html>` element

### Component Changes

- Extend existing shadcn/ui components via CSS variables
- Create new components: `MetricCard`, `EmptyState`, `LanguageToggle`
- Modify: `admin-sidebar.tsx`, `instructor-sidebar.tsx`, `student-sidebar.tsx`, `header.tsx`

---

## Acceptance Criteria

1. **Visual Consistency:** All pages use the new Warm Academic design system
2. **Color Coding:** Metric cards, badges, and status indicators use semantic colors
3. **Typography:** Fraunces for headings, DM Sans for body text throughout
4. **Dark Mode:** System default with manual toggle, persists across sessions
5. **Responsive:** All layouts work at 320px–1920px viewports
6. **Accessibility:** WCAG 2.1 AA compliance maintained (contrast, focus, ARIA)
7. **Functionality Preserved:** All existing features work identically
8. **Tests Pass:** Updated tests pass (no new visual tests required)
9. **Build Success:** `pnpm build` completes without errors
10. **No Regressions:** No visual or functional regressions on existing pages

---

## Dependencies

- Self-hosted font files (Fraunces, DM Sans) must be downloaded
- Existing shadcn/ui components remain as base
- No new npm packages required

---

## Risks & Mitigations

| Risk                             | Impact | Mitigation                                       |
| -------------------------------- | ------ | ------------------------------------------------ |
| Font loading affects performance | Medium | Use `font-display: swap`, preload critical fonts |
| Dark mode contrast issues        | High   | Test all semantic colors in both modes           |
| Responsive breakpoints break     | Medium | Test at all breakpoints before each phase        |
| Existing tests assert old styles | Low    | Update assertions to match new classes           |

---

## References

- Design Document: `docs/UI_REDESIGN.md`
- Mockup: `mockup-admin-dashboard.html`
- Product Guidelines: `conductor/product-guidelines.md`
- HTML/CSS Style Guide: `conductor/code_styleguides/html-css.md`
- React Style Guide: `conductor/code_styleguides/react.md`
