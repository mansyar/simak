<protect>
# Implementation Plan: Landing Page

## Phase 1: Landing Page Foundation

- [ ] Task 1.0: Read spec.md and review requirements before starting implementation
- [ ] Task 1.1: Add i18n translation keys for landing page
  - [ ] Add `landing.*` keys to `locales/en.json` (hero, features, howItWorks, footer)
  - [ ] Add `landing.*` keys to `locales/id.json` (Indonesian translations)
  - [ ] Run `pnpm generate:i18n` to update types
- [ ] Task 1.2: Write failing tests for landing page
  - [ ] Create `tests/unit/routes/index.test.tsx`
  - [ ] Test: Landing page renders hero section with headline
  - [ ] Test: Landing page renders features grid with 6 cards
  - [ ] Test: Landing page renders How It Works section with 3 steps
  - [ ] Test: Landing page renders footer
  - [ ] Test: CTA button links to `/auth/login`
  - [ ] Run tests and confirm they fail (Red phase)
- [ ] Task 1.3: Implement landing page component
  - [ ] Rewrite `src/routes/index.tsx` with full landing page
  - [ ] Hero section with headline, subtitle, CTA button
  - [ ] Features grid (2×3 responsive) with icons
  - [ ] How It Works section (3-step flow)
  - [ ] Footer with links
  - [ ] All text uses `t()` translation keys
  - [ ] Responsive: mobile-first with md/lg breakpoints
- [ ] Task 1.4: Verify all tests pass
  - [ ] Run `pnpm test` and confirm all tests pass (Green phase)
  - [ ] Run `pnpm test -- --coverage` and verify >80% coverage
- [ ] Task: Conductor - Phase Completion Verification (Protocol in workflow.md)
      </protect>
