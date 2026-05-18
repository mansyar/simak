# Technology Stack

## Core Framework

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Framework** | TanStack Start (Vite + SSR) | Full-stack React meta-framework with type-safe routing, server functions, and fast Vite dev server |
| **Routing** | TanStack Router | File-based routing with type-safe params and search params; Zod integration for runtime validation |
| **Server State** | TanStack Query | Caching, deduplication, background refetching, polling for notifications |
| **Rendering** | SSR + Client hydration | Dashboard SSR for initial data; interactive pages client-rendered |

## Frontend

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **UI Library** | shadcn/ui (Radix UI) | Accessible, composable components with built-in ARIA compliance |
| **Styling** | Tailwind CSS v4 | Utility-first CSS with design system integration |
| **Forms** | React Hook Form + Zod | Performant forms with Zod validation resolver |
| **i18n** | typesafe-i18n | Type-safe translations with compile-time checks |

## Backend & Data

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Database** | PostgreSQL | Relational data model with strong integrity constraints |
| **ORM** | Drizzle ORM | Type-safe SQL-first ORM, lightweight, no code generation |
| **Validation** | Zod | Runtime schema validation for forms and API inputs |
| **Authentication** | Better-Auth | Framework-agnostic auth with email/password, session management, role support |

## Infrastructure

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **File Storage** | Cloudflare R2 | S3-compatible object storage with presigned URL uploads |
| **Email** | Resend | Transactional email API for invitations and password setup |
| **Package Manager** | pnpm | Fast, disk-efficient package management |
| **Containerization** | Docker | Multi-stage build for production deployment |
| **Hosting** | Coolify on VPS | Self-hosted deployment with auto-proxied SSL via Traefik |

## Testing & Quality

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Unit/Integration Tests** | Vitest | Fast unit and integration tests with coverage reporting |
| **E2E Tests** | Playwright | End-to-end browser tests (v2) |
| **Code Quality** | ESLint + Prettier + Husky + lint-staged | Pre-commit linting, formatting, typechecking |

## Version Requirements

- Node.js >= 20
- pnpm >= 9
- PostgreSQL >= 16
- Docker (for local dev and production build)
