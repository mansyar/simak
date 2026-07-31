<protect>
# Specification: TRACK-047 — Coolify Private-Pilot Deployment

## Track Type

Chore / Infrastructure

## Overview

Deploy SIMAK for a private pilot through Coolify, with the application and PostgreSQL managed by Coolify, existing Cloudflare R2 and Resend integrations, and access through a custom HTTPS domain.

## Functional Requirements

1. Configure a Coolify application from the repository's production Docker build.
2. Provision and connect a Coolify-managed PostgreSQL 16 service.
3. Configure all required production environment variables in Coolify without committing secrets.
4. Configure the custom pilot domain with valid TLS through Coolify/Traefik.
5. Run database migrations and seed the initial SuperAdmin safely during initial deployment.
6. Verify Cloudflare R2 upload/download and Resend email delivery in production.
7. Configure persistent PostgreSQL storage and a documented, tested backup/restore procedure.
8. Provide deployment, rollback, and pilot smoke-test runbooks.
9. Verify production health, authentication, role access, core assignment flows, and application logs after deployment.

## Non-Functional Requirements

- The deployment must use the existing Dockerfile and approved stack.
- Secrets must remain exclusively in Coolify/environment configuration.
- TLS must be valid and HTTP traffic redirected to HTTPS.
- Database data must survive application redeployments.
- Rollback must be documented and practical for a single-instance pilot.
- Existing tests, typecheck, lint, and coverage gates must pass before release.

## Acceptance Criteria

1. SIMAK is reachable at the configured custom HTTPS domain.
2. The app connects successfully to Coolify-managed PostgreSQL.
3. Required migrations and SuperAdmin bootstrap complete without manual database edits.
4. Invitation/password setup emails and R2 file upload/download work in production.
5. A database backup can be created and its restore steps are validated and documented.
6. Health and logs can be checked in Coolify, and a rollback procedure is documented.
7. Pilot smoke tests for SuperAdmin, Admin, Instructor, and Student roles pass.

## Decisions

- **Topology:** Coolify-managed SIMAK application and PostgreSQL 16 service; Cloudflare R2 and Resend remain external managed services.
- **Access:** A custom HTTPS pilot domain is terminated by Coolify/Traefik.
- **SuperAdmin bootstrap:** Execute the existing idempotent `node .output/server/seed.mjs` command once through Coolify after the first healthy deployment, rather than running it on every container start.

## Out of Scope

- Multi-instance deployment, Redis, or horizontal scaling.
- CI/CD pipeline automation beyond Coolify's repository deployment.
- External monitoring or alerting services.
- Product feature changes unrelated to deployment.
</protect>
