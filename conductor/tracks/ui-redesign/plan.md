# Track: UI Redesign — Implementation Plan

## Phase 1: Design Tokens & Foundation

- [x] Task: Download and set up self-hosted fonts (Fraunces, DM Sans) [85d5088]
  - [x] Download font files (woff2 format) from Google Fonts — via @fontsource-variable npm packages
  - [x] Create `public/fonts/` directory structure — handled by @fontsource
  - [x] Add `@font-face` declarations in `src/app.css` — via CSS @import
  - [x] Verify fonts load correctly in browser — typecheck + all tests pass

- [x] Task: Define CSS custom properties for design system [e05d5b1]
  - [x] Add color tokens (light mode) as CSS variables in `src/app.css`
  - [x] Add color tokens (dark mode) under `.dark` class
  - [x] Add semantic color tokens (primary, success, warning, error, info)
  - [x] Add sidebar-specific color tokens
  - [x] Add typography tokens (font families, sizes, weights)
  - [x] Add spacing scale tokens (xs through 3xl)
  - [x] Add border radius tokens
  - [ ] Add shadow tokens — TODO: will be added when component shadows are applied

- [x] Task: Update Tailwind configuration [697e2ad]
  - [x] Extend `tailwind.config.ts` with custom color palette — via @theme inline in global.css (Tailwind v4 CSS-first approach)
  - [x] Add font family mappings (display, body) — done in Task 1 via @theme inline
  - [x] Add spacing scale extensions — Tailwind v4 defaults already match spec's 4px-base scale
  - [x] Add border radius extensions — done in Task 2 via @theme inline
  - [x] Add shadow extensions — added warm-toned shadow tokens using oklch color-mix
  - [x] Configure dark mode class strategy — via @custom-variant dark (done in Task 2)

- [x] Task: Update global styles and base layer [e05d5b1]
  - [x] Update `body` font to DM Sans — handled via --font-sans in @theme inline
  - [x] Update heading styles to use Fraunces — handled via --font-display in @theme inline
  - [x] Set default background color to warm white — --background: oklch(0.982 0.004 60)
  - [x] Set default text color to stone-900 — --foreground: oklch(0.145 0.006 50)
  - [x] Update focus ring styles for accessibility — outline-ring/50 using blue #3B82F6

- [ ] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)

---

## Phase 2: Shared Layout Components

- [ ] Task: Redesign Admin Sidebar
  - [ ] Update sidebar background to dark navy (#1C2333)
  - [ ] Add left accent border (3px blue) for active state
  - [ ] Update link hover states with background tint
  - [ ] Add section labels (MAIN, PREFERENCES) with uppercase styling
  - [ ] Update user card with surface background
  - [ ] Update logout button with red hover state
  - [ ] Add icons to all navigation links

- [ ] Task: Redesign Instructor Sidebar
  - [ ] Apply same dark navy background
  - [ ] Add left accent border for active state
  - [ ] Update link styles and hover states
  - [ ] Add section labels
  - [ ] Update user card and logout styling

- [ ] Task: Redesign Student Sidebar
  - [ ] Apply same dark navy background
  - [ ] Add left accent border for active state
  - [ ] Update link styles and hover states
  - [ ] Add section labels
  - [ ] Update user card and logout styling

- [ ] Task: Redesign Header component
  - [ ] Set sticky positioning with backdrop blur
  - [ ] Update background to surface with transparency
  - [ ] Add notification badge component (red dot with count)
  - [ ] Add theme toggle (sun/moon icon button)
  - [ ] Add language toggle (EN/ID segmented control)
  - [ ] Update user dropdown styling

- [ ] Task: Create ThemeToggle component
  - [ ] Implement sun/moon icon switching
  - [ ] Add localStorage persistence
  - [ ] Implement system preference detection
  - [ ] Add toggle animation

- [ ] Task: Create LanguageToggle component
  - [ ] Implement EN/ID segmented control
  - [ ] Integrate with existing i18n system
  - [ ] Add visual feedback for active language

- [ ] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

---

## Phase 3: Core UI Components

- [ ] Task: Enhance Card component
  - [ ] Update border radius to md (10px)
  - [ ] Add surface background color
  - [ ] Add subtle border color
  - [ ] Add hover state (surface-hover)

- [ ] Task: Enhance Table component
  - [ ] Add sticky header with shadow
  - [ ] Implement zebra striping (alternating rows)
  - [ ] Add row hover state
  - [ ] Update header typography

- [ ] Task: Enhance Badge component
  - [ ] Add semantic color variants (success, warning, error, info)
  - [ ] Add dot indicator variant
  - [ ] Update border radius to full (pill shape)

- [ ] Task: Create MetricCard component
  - [ ] Implement color-coded top border (3px)
  - [ ] Add icon container (44px, rounded, tinted background)
  - [ ] Add number display (Fraunces, 2.25rem, 700)
  - [ ] Add label text (0.8125rem, muted)
  - [ ] Add hover animation (translateY(-2px))

- [ ] Task: Create EmptyState component
  - [ ] Add icon container (64px, dashed border)
  - [ ] Add headline text (h3, 0.9375rem, 600)
  - [ ] Add description text (body, 0.8125rem, muted)
  - [ ] Add CTA button slot
  - [ ] Center content with proper padding

- [ ] Task: Create StatusDot component
  - [ ] Implement green dot for verified/active
  - [ ] Implement gray dot for not verified/inactive
  - [ ] Add proper sizing and spacing

- [ ] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)

---

## Phase 4: Admin Pages

- [ ] Task: Redesign Admin Dashboard
  - [ ] Update page title typography (Fraunces, 2rem)
  - [ ] Replace stat cards with MetricCard components
  - [ ] Update Email Queue section with colored stat boxes
  - [ ] Update Recent Activity section styling
  - [ ] Update Quick Actions section styling
  - [ ] Update Escalation Alerts styling

- [ ] Task: Redesign Admin Users page
  - [ ] Update page header with description
  - [ ] Update search bar and filter styling
  - [ ] Update table with sticky headers and zebra
  - [ ] Add status dot indicators
  - [ ] Update role badges with semantic colors
  - [ ] Update action menu styling

- [ ] Task: Redesign Admin Templates page
  - [ ] Update page header with description
  - [ ] Update search and filter styling
  - [ ] Update template cards with new Card component
  - [ ] Add color-coded top borders to cards
  - [ ] Update checkpoint count display

- [ ] Task: Redesign Admin Audit Log page
  - [ ] Update page header with description
  - [ ] Update table with sticky headers and zebra
  - [ ] Update action badges with semantic colors
  - [ ] Update expandable details styling

- [ ] Task: Redesign Admin Settings page
  - [ ] Update section cards with new Card component
  - [ ] Update form styling
  - [ ] Update button styling

- [ ] Task: Conductor - User Manual Verification 'Phase 4' (Protocol in workflow.md)

---

## Phase 5: Instructor Pages

- [ ] Task: Redesign Instructor Dashboard
  - [ ] Update page title with welcome message
  - [ ] Replace stat cards with MetricCard components
  - [ ] Update Pending Reviews section with SLA badges
  - [ ] Update Recent Submissions section
  - [ ] Update Assignment Overview section
  - [ ] Update Quick Actions section

- [ ] Task: Redesign Instructor Assignments list
  - [ ] Update page header with description
  - [ ] Update search and filter styling
  - [ ] Update assignment cards with new Card component
  - [ ] Add progress indicators
  - [ ] Update student count display

- [ ] Task: Redesign Instructor Assignment detail
  - [ ] Update progress table with new Table component
  - [ ] Update status badges with semantic colors
  - [ ] Update deadline display with urgency indicators
  - [ ] Update DeadlineManager section styling

- [ ] Task: Redesign Instructor Reviews queue
  - [ ] Update page header with description
  - [ ] Update review list with new Table component
  - [ ] Update SLA badges (On Time, Approaching, Breached)
  - [ ] Update wait time display

- [ ] Task: Redesign Instructor Review detail
  - [ ] Update file preview section styling
  - [ ] Update review history timeline
  - [ ] Update decision form styling
  - [ ] Update feedback upload section

- [ ] Task: Conductor - User Manual Verification 'Phase 5' (Protocol in workflow.md)

---

## Phase 6: Student Pages

- [ ] Task: Redesign Student Dashboard
  - [ ] Update page title with welcome message
  - [ ] Update Active Assignments with progress bars
  - [ ] Update Upcoming Deadlines with urgency colors
  - [ ] Update Pending Reviews section
  - [ ] Update Consultation Reminders section

- [ ] Task: Redesign Student Assignments list
  - [ ] Update page header with description
  - [ ] Update search styling
  - [ ] Update assignment cards with new Card component
  - [ ] Add progress indicators

- [ ] Task: Redesign Student Assignment detail
  - [ ] Update header metadata styling
  - [ ] Update checkpoint timeline with new components
  - [ ] Update status badges with semantic colors
  - [ ] Update overdue indicators
  - [ ] Update consultation progress display

- [ ] Task: Redesign Student Checkpoint submission page
  - [ ] Update file upload area styling
  - [ ] Update submission history table
  - [ ] Update review result display
  - [ ] Update revision deadline display

- [ ] Task: Conductor - User Manual Verification 'Phase 6' (Protocol in workflow.md)

---

## Phase 7: Auth Pages

- [ ] Task: Redesign Login page
  - [ ] Implement centered card layout
  - [ ] Add brand logo (🎓 SIMAK)
  - [ ] Update form styling
  - [ ] Update button styling
  - [ ] Add language toggle

- [ ] Task: Redesign Forgot/Reset Password pages
  - [ ] Apply centered card layout
  - [ ] Update form styling
  - [ ] Update success/error states

- [ ] Task: Redesign Setup Password page
  - [ ] Apply centered card layout
  - [ ] Update form styling
  - [ ] Update password strength indicator

- [ ] Task: Redesign 2FA Verification page
  - [ ] Apply centered card layout
  - [ ] Update TOTP input styling
  - [ ] Update backup code input styling

- [ ] Task: Conductor - User Manual Verification 'Phase 7' (Protocol in workflow.md)

---

## Phase 8: Testing & Polish

- [ ] Task: Update broken tests
  - [ ] Run `pnpm test` to identify failures
  - [ ] Update CSS class assertions in component tests
  - [ ] Update snapshot tests if any exist
  - [ ] Verify all tests pass

- [ ] Task: Visual verification across breakpoints
  - [ ] Test at 320px (mobile)
  - [ ] Test at 640px (tablet)
  - [ ] Test at 1024px (desktop)
  - [ ] Test at 1920px (wide)

- [ ] Task: Accessibility verification
  - [ ] Verify color contrast ratios (WCAG AA)
  - [ ] Verify keyboard navigation
  - [ ] Verify screen reader compatibility
  - [ ] Verify focus states

- [ ] Task: Final build verification
  - [ ] Run `pnpm build`
  - [ ] Run `pnpm typecheck`
  - [ ] Run `pnpm lint`
  - [ ] Verify no regressions

- [ ] Task: Conductor - User Manual Verification 'Phase 8' (Protocol in workflow.md)
