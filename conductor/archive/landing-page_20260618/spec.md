<protect>
# Landing Page — Specification

## Overview

Replace the current placeholder index route (`/`) with a polished, BibliU-inspired landing page. Always visible to all users (authenticated or not). Bilingual EN/ID.

## Visual Style

- **Color palette:** Purple primary (#6B5CE7), green accent (#34D399), white background
- **Typography:** Clean sans-serif (Inter via Tailwind defaults)
- **Layout:** Full-width sections, centered content, generous whitespace
- **Illustrations:** Simple SVG icons or emoji for feature cards (no stock photos)

## Sections

### 1. Hero

- Large headline: `t('landing.hero.title')` — e.g., "Manage Academic Assignments with Clarity"
- Subtitle: `t('landing.hero.subtitle')` — e.g., "Track checkpoints, gather feedback, and hit deadlines — all in one place."
- CTA button: "Get Started" → links to `/auth/login`
- Decorative: Abstract shape or gradient blob (CSS-only, no images)

### 2. Features Grid

- 2×3 grid of feature cards (responsive: 1 col mobile, 2 col tablet, 3 col desktop)
- Each card: icon (lucide-react), title, short description
- Features:
  - Sequential Checkpoints — Students complete work in order
  - Structured Feedback — Pass/Revise with comments
  - Consultation Tracking — Log and verify sessions
  - Deadline Management — Auto-locking, extensions
  - Bilingual Support — English and Bahasa Indonesia
  - Role-Based Access — Student, Instructor, Admin views

### 3. How It Works

- 3-step horizontal flow (responsive: vertical on mobile)
- Step 1: "Create" — Instructor sets up assignment from template
- Step 2: "Submit" — Students complete checkpoints sequentially
- Step 3: "Review" — Instructors provide feedback and verify

### 4. Footer

- App name + tagline
- Links: Login, About (placeholder), Contact (placeholder)
- Copyright: © 2026 SIMAK

## Technical Requirements

- **Route:** `src/routes/index.tsx` (existing file, full rewrite)
- **i18n:** All strings via `t()` keys in `landing.*` namespace
- **No new dependencies** — use existing Tailwind + lucide-react icons
- **Responsive:** Mobile-first, breakpoints at `md` (768px) and `lg` (1024px)
- **Performance:** No images, CSS-only decorative elements, minimal JS

## Acceptance Criteria

- [ ] Landing page renders at `/` for all users
- [ ] Hero section displays headline, subtitle, and CTA button
- [ ] Features grid shows 6 cards with icons
- [ ] How It Works shows 3 steps
- [ ] Footer renders with links
- [ ] All text has EN/ID translations
- [ ] Responsive at mobile/tablet/desktop
- [ ] No console errors
- [ ] Tests pass

## Out of Scope

- Animations/scroll effects
- Testimonials section
- Stats/metrics section
- Dark mode toggle on landing page
- Image assets (SVG/CSS only)
  </protect>
