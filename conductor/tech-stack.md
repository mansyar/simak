<protect>
# Technology Stack

## Core Framework

| Component        | Technology                  | Purpose                                                                                            |
| ---------------- | --------------------------- | -------------------------------------------------------------------------------------------------- |
| **Framework**    | TanStack Start (Vite + SSR) | Full-stack React meta-framework with type-safe routing, server functions, and fast Vite dev server |
| **Routing**      | TanStack Router             | File-based routing with type-safe params and search params; Zod integration for runtime validation |
| **Server State** | TanStack Query              | Caching, deduplication, background refetching, polling for notifications                           |
| **Rendering**    | SSR + Client hydration      | Dashboard SSR for initial data; interactive pages client-rendered                                  |

## Frontend

| Component      | Technology            | Purpose                                                         |
| -------------- | --------------------- | --------------------------------------------------------------- |
| **UI Library** | shadcn/ui (Radix UI)  | Accessible, composable components with built-in ARIA compliance |
| **Styling**    | Tailwind CSS v4       | Utility-first CSS with design system integration                |
| **Forms**      | React Hook Form + Zod | Performant forms with Zod validation resolver                   |
| **i18n**       | typesafe-i18n         | Type-safe translations with compile-time checks                 |
| **Client-Side XLSX** | SheetJS (`xlsx`) | Client-side .xlsx parsing + sample-file generation |
| **DOCX Preview**     | mammoth.js           | `.docx` → HTML conversion, ~30KB gzipped, lazy-loaded via dynamic `import()` |

## Backend & Data

| Component           | Technology             | Purpose                                                                       |
| ------------------- | ---------------------- | ----------------------------------------------------------------------------- |
| **Database**        | PostgreSQL             | Relational data model with strong integrity constraints                       |
| **Database Driver** | postgres (postgres.js) | Native ESM PostgreSQL driver, lightweight, recommended by Drizzle             |
| **ORM**             | Drizzle ORM            | Type-safe SQL-first ORM, lightweight, no code generation                      |
| **Validation**      | Zod                    | Runtime schema validation for forms and API inputs                            |
| **Authentication**  | Better-Auth            | Framework-agnostic auth with email/password, session management, role support |

## Infrastructure

| Component            | Technology     | Purpose                                                    |
| -------------------- | -------------- | ---------------------------------------------------------- |
| **File Storage**     | Cloudflare R2  | S3-compatible object storage with presigned URL uploads    |
| **Email**            | Resend         | Transactional email API for invitations and password setup |
| **Package Manager**  | pnpm           | Fast, disk-efficient package management                    |
| **Containerization** | Docker         | Multi-stage build for production deployment                |
| **Hosting**          | Coolify on VPS | Self-hosted deployment with auto-proxied SSL via Traefik   |

## Testing & Quality

| Component                  | Technology                           | Purpose                                                 |
| -------------------------- | ------------------------------------ | ------------------------------------------------------- |
| **Unit/Integration Tests** | Vitest                               | Fast unit and integration tests with coverage reporting |
| **E2E Tests**              | Playwright                           | End-to-end browser tests (v2)                           |
| **Code Quality**           | oxlint + oxfmt + Lefthook            | Pre-commit linting/formatting/modularity; pre-push typecheck & coverage |

## Version Requirements

- Node.js >= 20
- pnpm >= 9
- PostgreSQL >= 16
- Docker (for local dev and production build)

## Changelog

- **2026-07-22:** Added `mammoth.js` for client-side `.docx` → HTML conversion on the instructor review detail page. Lazy-loaded via dynamic `import('mammoth')` to keep it out of the main client bundle. Used in `ReviewFilePreview` component (TRACK-017).
- **2026-07-22:** **Deviation from plan** — The plan (Phase 0) specified `@radix-ui/react-popover` for the keyboard cheat-sheet Popover component. However, the entire codebase uses `@base-ui/react` for all UI primitives (Dialog, Sheet, etc.). `@base-ui/react/popover` is already installed and available. Replaced `@radix-ui/react-popover` with `@base-ui/react/popover` for consistency. Uninstalled `@radix-ui/react-popover` (was installed in Phase 0 commit `784fcd3`).

</protect>
