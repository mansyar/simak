# SIMAK UI Redesign — Design Plan

**Status:** Proposed  
**Direction:** Warm Academic  
**Date:** May 2026

---

## 1. Design Philosophy

> _"An approachable, trustworthy system that feels like a well-organized academic workspace — not a cold enterprise tool."_

### Core Principles

1. **Academic Warmth** — Soft colors, rounded corners, serif display fonts evoke trust and approachability
2. **Progressive Disclosure** — Show only what's needed at each stage (per product guidelines)
3. **Semantic Color System** — Green=Success, Amber=Warning, Red=Error, Blue=Info (per product guidelines)
4. **Accessibility First** — WCAG 2.1 AA compliance, keyboard navigation, screen reader support

---

## 2. Color System

### Light Mode

```
┌─────────────────────────────────────────────────────────────────────┐
│  SEMANTIC COLORS                                                    │
├─────────────────────────────────────────────────────────────────────┤
│  Primary (Brand)    #2563EB  ████  Trust, links, active states     │
│  Success            #059669  ████  Pass, completed, positive       │
│  Warning            #D97706  ████  Revise, pending, caution        │
│  Error              #DC2626  ████  Overdue, failed, destructive    │
│  Info               #0891B2  ████  Consultation, neutral info      │
├─────────────────────────────────────────────────────────────────────┤
│  NEUTRALS (Warm Grays)                                             │
├─────────────────────────────────────────────────────────────────────┤
│  Background         #FAF9F7  ████  Page background                 │
│  Surface            #FFFFFF  ████  Cards, modals                   │
│  Surface Hover      #F5F3EF  ████  Row/card hover                  │
│  Border             #E7E5E0  ████  Default borders                 │
│  Border Subtle      #F0EDE8  ████  Dividers, subtle separators     │
│  Text               #1C1917  ████  Primary text                    │
│  Text Secondary     #57534E  ████  Descriptions, labels            │
│  Text Muted         #A8A29E  ████  Placeholders, timestamps        │
├─────────────────────────────────────────────────────────────────────┤
│  SIDEBAR                                                           │
├─────────────────────────────────────────────────────────────────────┤
│  Background         #1C2333  ████  Dark navy                       │
│  Surface            #242D3F  ████  User card bg                    │
│  Hover              #2A3448  ████  Link hover                      │
│  Active BG          rgba(37,99,235,0.12)  ░░░░  Active link bg     │
│  Active Border      #3B82F6  ████  Left accent                     │
│  Text               #94A3B8  ████  Inactive links                  │
│  Text Active        #FFFFFF  ████  Active link text                │
└─────────────────────────────────────────────────────────────────────┘
```

### Dark Mode

```
┌─────────────────────────────────────────────────────────────────────┐
│  NEUTRALS (Dark)                                                   │
├─────────────────────────────────────────────────────────────────────┤
│  Background         #0F1115  ████  Page background                 │
│  Surface            #181B22  ████  Cards, modals                   │
│  Surface Hover      #252830  ████  Row/card hover                  │
│  Border             #2A2D35  ████  Default borders                 │
│  Text               #F5F5F4  ████  Primary text                    │
│  Text Secondary     #A8A29E  ████  Descriptions                    │
│  Text Muted         #6B6560  ████  Placeholders                    │
└─────────────────────────────────────────────────────────────────────┘
```

### Semantic Color Mapping

| State             | Light     | Dark      | Usage                             |
| ----------------- | --------- | --------- | --------------------------------- |
| Passed/Success    | `#059669` | `#10B981` | Checkpoint passed, verified, sent |
| Warning/Pending   | `#D97706` | `#F59E0B` | Pending review, awaiting action   |
| Error/Overdue     | `#DC2626` | `#EF4444` | Overdue, failed, SLA breach       |
| Info/Consultation | `#0891B2` | `#06B6D4` | Consultation, neutral info        |

---

## 3. Typography

### Font Stack

```css
--font-display: 'Fraunces', Georgia, serif; /* Headings, brand */
--font-body: 'DM Sans', system-ui, sans-serif; /* Body text, UI */
```

### Type Scale

```
┌─────────────────────────────────────────────────────────────────────┐
│  SCALE                                                             │
├─────────────────────────────────────────────────────────────────────┤
│  Display      2rem / 700    Page titles (Dashboard, Users)         │
│  Heading 2    1.5rem / 600  Section headers (Email Queue)          │
│  Heading 3    1.25rem / 600 Card titles, subsections               │
│  Body Large   1rem / 400    Important body text                    │
│  Body         0.875rem/400  Default text, labels                   │
│  Small        0.75rem/400   Captions, timestamps, badges           │
├─────────────────────────────────────────────────────────────────────┤
│  LINE HEIGHT                                                        │
├─────────────────────────────────────────────────────────────────────┤
│  Tight        1.2           Headings, numbers                      │
│  Normal       1.5           Body text                              │
│  Relaxed      1.6           Long-form content                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Spacing & Layout

### Spacing Scale (4px base)

```
xs:  4px     sm:  8px     md:  16px    lg:  24px
xl:  32px    2xl: 48px    3xl: 64px
```

### Layout Constants

```
┌─────────────────────────────────────────────────────────────────────┐
│  SIDEBAR                                                           │
├─────────────────────────────────────────────────────────────────────┤
│  Width (expanded)    272px                                         │
│  Width (collapsed)   72px  (icon-only mode, future)                │
│  Position            Fixed left, full viewport height              │
├─────────────────────────────────────────────────────────────────────┤
│  HEADER                                                            │
├─────────────────────────────────────────────────────────────────────┤
│  Height              64px                                          │
│  Position            Sticky top                                    │
│  Background          Surface + backdrop-filter blur                │
├─────────────────────────────────────────────────────────────────────┤
│  PAGE CONTENT                                                      │
├─────────────────────────────────────────────────────────────────────┤
│  Max Width           1400px                                        │
│  Padding             32px (desktop) / 20px (mobile)                │
│  Content Offset      272px (sidebar width)                         │
└─────────────────────────────────────────────────────────────────────┘
```

### Border Radius

```
sm:   6px      Buttons, small elements
md:   10px     Cards, inputs, dropdowns
lg:   14px     Modals, large cards
xl:   20px     Feature cards
full: 9999px   Avatars, badges, pills
```

---

## 5. Component Specifications

### 5.1 Sidebar

```
┌────────────────────────────────────┐
│  ┌──────┐                         │
│  │  🎓  │  SIMAK                  │  Brand: Logo (36px) + Name (Fraunces)
│  └──────┘                         │
│  ──────────────────────────────── │  Divider
│                                   │
│  MAIN                             │  Section label (0.6875rem, uppercase)
│                                   │
│  ╔═══════════════════════════╗    │  Active: left border (3px, blue)
│  ║  📊  Dashboard            ║    │          + background tint
│  ╚═══════════════════════════╝    │
│                                   │
│     👥  Users                     │  Inactive: muted text, no bg
│                                   │
│     📋  Templates                 │
│                                   │
│     📝  Audit Log                 │
│                                   │
│  PREFERENCES                      │  Section label
│                                   │
│     ⚙  Settings                   │
│                                   │
│  ──────────────────────────────── │
│  ┌─────────────────────────────┐ │
│  │  ┌────┐                    │ │  User card (surface bg)
│  │  │ SA │  SuperAdmin     ⋮  │ │  Avatar (36px) + Name + Email
│  │  └────┘  superadmin@...    │ │
│  └─────────────────────────────┘ │
│                                   │
│  ┌─────────────────────────────┐ │
│  │  ↪  Log out                 │ │  Logout: hover → red tint
│  └─────────────────────────────┘ │
└────────────────────────────────────┘

Behavior:
- Fixed position, full viewport height
- Active link: left accent border + bg tint
- Hover: subtle background change
- User card: clickable (future dropdown)
- Logout: red hover state
```

### 5.2 Header

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                              🔍 ... │
│  [empty left]                          [EN|ID]  🔔3  🌙  👤 ▾    │
└──────────────────────────────────────────────────────────────────────┘

Components (right to left):
1. User dropdown    — Avatar + name + chevron
2. Theme toggle     — Sun/Moon icon button (40x40px)
3. Notifications    — Bell icon + red badge (count)
4. Language toggle  — EN/ID segmented control (border, 36px height)

Behavior:
- Sticky at top
- Backdrop blur for transparency effect
- Notification badge: auto-hides at 0
- Theme toggle: persists to localStorage
```

### 5.3 Metric Cards (Dashboard)

```
┌─────────────────────────────────────┐
│  ████████████████████████████████  │  ← Color-coded top border (3px)
│                                     │
│  ┌──────────┐                       │
│  │    👥    │                       │  ← Icon: 44px, rounded, tinted bg
│  └──────────┘                       │
│                                     │
│           6                         │  ← Number: Fraunces, 2.25rem, 700
│      Total Users                    │  ← Label: 0.8125rem, muted
│                                     │
└─────────────────────────────────────┘

Color assignments:
  Blue (#3B82F6)   → Users, Accounts, General metrics
  Green (#10B981)  → Assignments, Progress, Success
  Amber (#F59E0B)  → Reviews, Pending, Warning
  Red (#EF4444)    → Alerts, Errors, Overdue
  Cyan (#06B6D4)   → Consultations, Info
  Purple (#8B5CF6) → Templates, Special

Behavior:
- Hover: translateY(-2px) + shadow increase
- Transition: 0.2s ease
```

### 5.4 Tables (Users, Audit Log)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Name                 Role           Status        Created     ⋮    │  ← Sticky header
├──────────────────────────────────────────────────────────────────────┤
│  👤 SuperAdmin        SuperAdmin     ● Verified    May 19      ⋮    │  ← Zebra row
│  👤 Instructor        Instructor     ● Verified    May 22      ⋮    │  ← Hover: bg tint
│  👤 Student           Student        ○ Not Verified May 22     ⋮    │
│  👤 Test Instructor   Instructor     ○ Not Verified May 29     ⋮    │
│  👤 Student 1         Student        ○ Not Verified May 29     ⋮    │
│  👤 Student 2         Student        ○ Not Verified May 29     ⋮    │
├──────────────────────────────────────────────────────────────────────┤
│  Showing 6 of 6 users                              < Back  Next >   │
└──────────────────────────────────────────────────────────────────────┘

Row specs:
- Height: ~56px
- Zebra: alternating bg/subtle-gray
- Hover: var(--surface-hover) + cursor pointer
- Status dots: green (verified) / gray (not verified)
- Role badges: blue (admin) / amber (instructor) / green (student)
- Actions: 3-dot menu (⋮)
```

### 5.5 Empty States

```
┌────────────────────────────────────┐
│                                    │
│           ┌──────────┐             │
│           │    📭    │             │  ← 64px icon, dashed border
│           └──────────┘             │
│                                    │
│      No assignments yet            │  ← h3, 0.9375rem, 600 weight
│                                    │
│  Create your first assignment      │  ← body, 0.8125rem, muted
│  to get started.                   │
│                                    │
│      ┌─────────────────────┐       │
│      │  Create Assignment  │       │  ← Primary button
│      └─────────────────────┘       │
│                                    │
└────────────────────────────────────┘

Specs:
- Padding: 40px top/bottom
- Icon: circular (64px), dashed border, muted color
- Headline: centered, 600 weight
- Description: centered, muted
- CTA: shadcn Button, primary variant
```

---

## 6. Page Wireframes

### 6.1 Admin Dashboard

```
┌──────────────────────────────────────────────────────────────────────┐
│ SIDEBAR           │  HEADER                                         │
│                   │                                                 │
│ ┌──────────────┐  │  [EN|ID]  🔔3  🌙  👤 ▾                      │
│ │ 🎓 SIMAK     │  ├─────────────────────────────────────────────────┤
│ └──────────────┘  │                                                 │
│                   │  Dashboard                                      │
│ ────────────────  │  System overview and metrics                    │
│                   │                                                 │
│ ╔══ 📊 Dashboard  │  ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│ ║                 │  │ ████████ │ │ ████████ │ │ ████████ │       │
│ ║  👥 Users       │  │ 👥       │ │ 👤       │ │ 🎓       │       │
│ ║                 │  │    6     │ │    2     │ │    3     │       │
│ ║  📋 Templates   │  │  Users   │ │ Instruct │ │ Students │       │
│ ║                 │  └──────────┘ └──────────┘ └──────────┘       │
│ ║  📝 Audit Log   │                                                 │
│ ║                 │  ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│ ║  ⚙ Settings    │  │ ████████ │ │ ████████ │ │ ████████ │       │
│ ╚═════════════════│  │ 📋       │ │ ✏️       │ │ 💬       │       │
│                   │  │    1     │ │    0     │ │    0     │       │
│                   │  │ Active   │ │ Pending  │ │ Consult  │       │
│ ┌──────────────┐  │  │ Assign   │ │ Reviews  │ │          │       │
│ │ ┌────┐       │  │  └──────────┘ └──────────┘ └──────────┘       │
│ │ │ SA │ Super │  │                                                 │
│ │ └────┘ admin │  │  ┌─────────────────────┐ ┌───────────────────┐ │
│ └──────────────┘  │  │ Email Queue         │ │ Escalation Alerts │ │
│                   │  │ ┌─────┬─────┬─────┐ │ │                   │ │
│ ↪ Log out         │  │ │  0  │  0  │  1  │ │ │  📭 No alerts    │ │
│                   │  │ │PEND │SENT │FAIL │ │ │                   │ │
│                   │  │ └─────┴─────┴─────┘ │ │                   │ │
│                   │  └─────────────────────┘ └───────────────────┘ │
│                   │                                                 │
│                   │  ┌─────────────────────┐ ┌───────────────────┐ │
│                   │  │ Recent Activity     │ │ Quick Actions     │ │
│                   │  │ • User created...   │ │ [+ Create User]   │ │
│                   │  │ • File submitted... │ │ [+ Create Template│ │
│                   │  │ • Revision...       │ │ [📋 Audit Log]    │ │
│                   │  └─────────────────────┘ └───────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.2 Admin Users Page

```
┌──────────────────────────────────────────────────────────────────────┐
│ SIDEBAR           │  HEADER                                         │
│                   │                                                 │
│ ╔══ 👥 Users      │  Users                                          │
│ ║                 │  Manage your organization's users, roles.       │
│ ║  📊 Dashboard   │                                                 │
│ ║                 │  🔍 Search users by name or email...  [All ▾]  │
│ ║  📋 Templates   │                     [+ New User]                │
│ ║                 ├─────────────────────────────────────────────────┤
│ ║  📝 Audit Log   │                                                 │
│ ║                 │  Name              Role        Status    Date   │
│ ║  ⚙ Settings    │  ─────────────────────────────────────────────  │
│ ╚═════════════════│  👤 SuperAdmin     SuperAdmin  ● Verified  May  │
│                   │  👤 Instructor     Instructor  ● Verified  May  │
│                   │  👤 Student        Student     ○ Not Verified   │
│                   │  👤 Test Instr.    Instructor  ○ Not Verified   │
│                   │  👤 Student 1      Student     ○ Not Verified   │
│                   │  👤 Student 2      Student     ○ Not Verified   │
│                   │                                                 │
│                   │  Showing 6 of 6 users           < Back  Next > │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.3 Admin Templates Page

```
┌──────────────────────────────────────────────────────────────────────┐
│ SIDEBAR           │  HEADER                                         │
│                   │                                                 │
│ ╔══ 📋 Templates  │  Templates                                      │
│ ║                 │  Create and manage assignment templates.         │
│ ║  📊 Dashboard   │                                                 │
│ ║                 │  🔍 Search templates...          [All Types ▾]  │
│ ║  👥 Users       │                     [+ New Template]             │
│ ║                 ├─────────────────────────────────────────────────┤
│ ║  📝 Audit Log   │                                                 │
│ ║                 │  ┌───────────────────┐ ┌───────────────────┐   │
│ ║  ⚙ Settings    │  │ █████████████████ │ │ █████████████████ │   │
│ ╚═════════════════│  │ Thesis Template   │ │ Lab Report        │   │
│                   │  │ Thesis      ⋮    │ │ Practical    ⋮    │   │
│                   │  │                   │ │                   │   │
│                   │  │ 5 checkpoints     │ │ 3 checkpoints     │   │
│                   │  │ Created May 20    │ │ Created May 22    │   │
│                   │  └───────────────────┘ └───────────────────┘   │
│                   │                                                 │
│                   │  Page 1 of 1              < Back  Next >       │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.4 Instructor Dashboard

```
┌──────────────────────────────────────────────────────────────────────┐
│ SIDEBAR           │  HEADER                                         │
│                   │                                                 │
│ ┌──────────────┐  │  [EN|ID]  🔔5  🌙  👤 ▾                      │
│ │ 🎓 SIMAK     │  ├─────────────────────────────────────────────────┤
│ └──────────────┘  │                                                 │
│                   │  Dashboard                                      │
│ ╔══ 📊 Dashboard  │  Welcome back, Instructor                       │
│ ║                 │                                                 │
│ ║  📚 Assignments │  ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│ ║                 │  │ ████████ │ │ ████████ │ │ ████████ │       │
│ ║  ✏️ Reviews     │  │ 📚       │ │ ✏️       │ │ 👥       │       │
│ ║    [!] 5        │  │    3     │ │    5     │ │   12     │       │
│ ║                 │  │ Active   │ │ Pending  │ │ Students │       │
│ ║  💬 Consults    │  │ Assign   │ │ Reviews  │ │          │       │
│ ║                 │  └──────────┘ └──────────┘ └──────────┘       │
│ ║  ⚙ Settings    │                                                 │
│ ╚═════════════════│  ┌─────────────────────────────────────────────┐│
│                   │  │ Pending Reviews                             ││
│ ┌──────────────┐  │  │ ┌─────────────────────────────────────────┐ ││
│ │ ┌────┐       │  │  │ │ 📄 Thesis - Ch2    SLA: ⚠️ 2.5 days   │ ││
│ │ │ 👤 │ Inst. │  │  │ │ 📄 Lab Report - Ch1 SLA: ✅ On Time   │ ││
│ │ └────┘       │  │  │ │ 📄 Thesis - Ch1    SLA: 🔴 Breached   │ ││
│ └──────────────┘  │  │ └─────────────────────────────────────────┘ ││
│                   │  └─────────────────────────────────────────────┘│
│ ↪ Log out         │                                                 │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.5 Student Dashboard

```
┌──────────────────────────────────────────────────────────────────────┐
│ SIDEBAR           │  HEADER                                         │
│                   │                                                 │
│ ┌──────────────┐  │  [EN|ID]  🔔2  🌙  👤 ▾                      │
│ │ 🎓 SIMAK     │  ├─────────────────────────────────────────────────┤
│ └──────────────┘  │                                                 │
│                   │  Dashboard                                      │
│ ╔══ 📊 Dashboard  │  Welcome back, Student                          │
│ ║                 │                                                 │
│ ║  📚 Assignments │  ┌─────────────────────────────────────────────┐│
│ ║                 │  │ Active Assignments                          ││
│ ║  💬 Consults    │  │ ┌─────────────────────────────────────────┐ ││
│ ║                 │  │ │ Thesis Project          ████████░░ 80%  │ ││
│ ║  ⚙ Settings    │  │ │ Lab Report              ████░░░░░░ 40%  │ ││
│ ╚═════════════════│  │ └─────────────────────────────────────────┘ ││
│                   │  └─────────────────────────────────────────────┘│
│ ┌──────────────┐  │                                                 │
│ │ ┌────┐       │  │  ┌──────────────────┐ ┌──────────────────────┐ │
│ │ │ 🎓 │ Stud. │  │  │ Upcoming Deadlines│ │ Pending Reviews      │ │
│ │ └────┘       │  │  │ ⚠️ Thesis Ch3     │ │ ⏳ 1 awaiting review │ │
│ └──────────────┘  │  │    Due in 2 days  │ │                      │ │
│                   │  └──────────────────┘ └──────────────────────┘ │
│ ↪ Log out         │                                                 │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.6 Login Page

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│                                                                      │
│                        ┌──────────────────────┐                      │
│                        │       🎓 SIMAK       │                      │
│                        │                      │                      │
│                        │   Welcome back       │                      │
│                        │   Sign in to your    │                      │
│                        │   account            │                      │
│                        │                      │                      │
│                        │   Email              │                      │
│                        │   ┌────────────────┐ │                      │
│                        │   │ you@email.com  │ │                      │
│                        │   └────────────────┘ │                      │
│                        │                      │                      │
│                        │   Password           │                      │
│                        │   ┌────────────────┐ │                      │
│                        │   │ ••••••••       │ │                      │
│                        │   └────────────────┘ │                      │
│                        │                      │                      │
│                        │   [    Sign In    ]  │                      │
│                        │                      │                      │
│                        │   Forgot password?   │                      │
│                        │                      │                      │
│                        │   [EN | ID]          │                      │
│                        └──────────────────────┘                      │
│                                                                      │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 7. Responsive Breakpoints

```
┌─────────────────────────────────────────────────────────────────────┐
│  BREAKPOINTS                                                        │
├─────────────────────────────────────────────────────────────────────┤
│  Mobile      < 640px    Sidebar hidden, hamburger menu              │
│  Tablet      640-1024px Sidebar collapsed (icons), 2-col grid      │
│  Desktop     > 1024px   Full sidebar, 3-col grid                   │
│  Wide        > 1400px   Max content width, centered                │
├─────────────────────────────────────────────────────────────────────┤
│  GRID SYSTEM                                                        │
├─────────────────────────────────────────────────────────────────────┤
│  Metrics     3-col (desktop) → 2-col (tablet) → 1-col (mobile)    │
│  Sections    2-col (desktop) → 1-col (tablet/mobile)               │
│  Tables      Full width, horizontal scroll on mobile                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 8. Implementation Phases

### Phase 1: Design Tokens & Foundation

**Files:** `src/app.css`, `tailwind.config.ts`

- [ ] Add CSS custom properties (colors, spacing, typography)
- [ ] Configure Tailwind extended theme
- [ ] Add Google Fonts (Fraunces, DM Sans)
- [ ] Update dark mode class strategy

### Phase 2: Shared Layout Components

**Files:** `src/components/layout/*`

- [ ] Redesign sidebar component (all 3 variants)
- [ ] Redesign header/top bar
- [ ] Create notification badge component
- [ ] Create language toggle component

### Phase 3: Core UI Components

**Files:** `src/components/ui/*`

- [ ] Enhance Card component (color-coded borders)
- [ ] Enhance Table component (sticky headers, zebra)
- [ ] Enhance Badge component (semantic color variants)
- [ ] Create EmptyState component
- [ ] Create MetricCard component

### Phase 4: Admin Pages

**Files:** `src/routes/_authenticated/admin/*`, `src/components/admin/*`

- [ ] Admin Dashboard (metric cards, email queue, activity)
- [ ] Users Page (table redesign, filters)
- [ ] Templates Page (card grid)
- [ ] Audit Log Page (table redesign)
- [ ] Settings Page (section cards)

### Phase 5: Instructor Pages

**Files:** `src/routes/_authenticated/instructor/*`, `src/components/instructor/*`

- [ ] Instructor Dashboard (metrics, review queue)
- [ ] Assignments List (card redesign)
- [ ] Assignment Detail (progress table)
- [ ] Reviews Queue (SLA badges)
- [ ] Review Detail (decision form)

### Phase 6: Student Pages

**Files:** `src/routes/_authenticated/student/*`, `src/components/student/*`

- [ ] Student Dashboard (progress, deadlines)
- [ ] Assignments List (card redesign)
- [ ] Assignment Detail (timeline, checkpoints)
- [ ] Checkpoint Submission (file upload)

### Phase 7: Auth Pages

**Files:** `src/routes/_unauthenticated/*`

- [ ] Login Page (centered card)
- [ ] Forgot/Reset Password
- [ ] Setup Password
- [ ] 2FA Verification

### Phase 8: Testing & Polish

**Files:** `tests/*`

- [ ] Visual regression tests
- [ ] Responsive breakpoint tests
- [ ] Accessibility audit (axe-core)
- [ ] Cross-browser testing

---

## 9. File Impact Summary

```
Core Changes:
  src/app.css                              Design tokens
  tailwind.config.ts                       Extended theme

Layout Components:
  src/components/layout/admin-sidebar.tsx   Redesign
  src/components/layout/instructor-sidebar.tsx  Redesign
  src/components/layout/student-sidebar.tsx     Redesign
  src/components/layout/header.tsx         New/modified

UI Components:
  src/components/ui/card.tsx               Enhanced
  src/components/ui/table.tsx              Enhanced
  src/components/ui/badge.tsx              Color variants
  src/components/ui/button.tsx             Verify variants
  src/components/dashboard/*.tsx           Metric cards
  src/components/admin/users/*.tsx         Table redesign

Routes (pages):
  src/routes/_authenticated/admin/*.tsx    All admin pages
  src/routes/_authenticated/instructor/*.tsx  All instructor pages
  src/routes/_authenticated/student/*.tsx  All student pages
  src/routes/_unauthenticated/auth/*.tsx   Auth pages
```

---

## 10. References

- [HTML/CSS Style Guide](./code_styleguides/html-css.md)
- [React Style Guide](./code_styleguides/react.md)
- [Product Guidelines](../conductor/product-guidelines.md)
- [Product Definition](../conductor/product.md)
- [Mockup File](../mockup-admin-dashboard.html)

---

_Document created: May 2026_  
_Status: Proposed — awaiting approval before implementation_
